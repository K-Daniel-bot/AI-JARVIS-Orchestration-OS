# Enforcement Hook 실행 흐름 및 보안 검증

**Phase**: 0+1
**Status**: 설계 문서 (구현 가이드)
**Last Updated**: 2026-03-02

---

## 목차

1. [개요](#개요)
2. [Hook 아키텍처](#hook-아키텍처)
3. [5단계 실행 흐름](#5단계-실행-흐름)
4. [Pre-Hook 검증 항목](#pre-hook-검증-항목)
5. [Post-Hook 검증 및 롤백](#post-hook-검증-및-롤백)
6. [Capability Token 검증 시점](#capability-token-검증-시점)
7. [구현 패턴](#구현-패턴)

---

## 개요

**Enforcement Hook**은 Executor Agent가 **실제 OS 조작을 실행하는 직전(Pre)과 직후(Post)에 호출되는 보안 검증 계층**이다.

### 핵심 원칙

- **다층 방어 (Defense in Depth)**: Policy Gate와 Hook 이중 검증
- **실행 차단**: Pre-Hook에서 실패하면 OS 조작 수행 전 즉시 중단
- **자동 복구**: Post-Hook에서 실패하면 자동 롤백 트리거
- **Capability Token 강제**: Hook 통과 후에만 토큰 소비
- **감사 추적**: 모든 Hook 실행 기록을 AuditEntry로 저장

---

## Hook 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                      DEPLOYMENT State                        │
│                   (Executor Agent)                           │
└─────────────────────────────────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────┐
        │  1. GATE_EXECUTION_APPROVAL 체크    │ (XState Guard)
        │     - 사용자 승인 확인               │
        │     - 모든 prior gates 통과 확인    │
        └─────────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────┐
        │   2. PRE-HOOK VALIDATION            │ ← 이 문서의 핵심
        │     - Capability Token 검증         │
        │     - Action 권한 범위 검증          │
        │     - 파일 경로 검증                 │
        │     - 네트워크 접근 검증             │
        │     - 실패 시: ABORT (수행 안 함)    │
        └─────────────────────────────────────┘
                    ↓ (모두 통과)
        ┌─────────────────────────────────────┐
        │   3. OS ACTION EXECUTION            │ (실제 조작)
        │     - FS_CREATE_FILE                │
        │     - FS_WRITE_FILE                 │
        │     - EXEC_COMMAND                  │
        │     - APP_LAUNCH                    │
        │     - ... 38개 액션 타입             │
        └─────────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────┐
        │   4. POST-HOOK VALIDATION           │ ← 이 문서의 핵심
        │     - 실제 적용 결과 검증            │
        │     - 무결성 검사 (파일 해시)        │
        │     - 사이드 이펙트 모니터링          │
        │     - 실패 시: 자동 ROLLBACK        │
        └─────────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────┐
        │   5. AUDIT LOGGING                  │ (최종 기록)
        │     - AuditEntry 생성                │
        │     - Capability Token 소비         │
        │     - 체크포인트 저장                │
        └─────────────────────────────────────┘
                              ↓
        ┌─────────────────────────────────────┐
        │   COMPLETED (성공) 또는 ROLLBACK    │
        └─────────────────────────────────────┘
```

---

## 5단계 실행 흐름

### **1단계: GATE_EXECUTION_APPROVAL 체크**

**담당**: XState Guard (packages/core/src/machine.ts)
**타이밍**: DEPLOYMENT 상태 진입 직전
**실패 시**: AWAITING_USER_INPUT 상태로 되돌림 (사용자 재승인 필요)

```typescript
/**
 * canProceedToExecution() — 실행 승인이 완료되었는가
 *
 * 체크 항목:
 * - pending_gates 배열 비어있는가?
 * - 모든 prior gates (L1, L2)가 approved_gates에 있는가?
 * - execution gate (L3)가 승인되었는가?
 * - 타임아웃 되지 않았는가? (gate approval TTL 30분)
 */
function canProceedToExecution(context: JarvisMachineContext): boolean {
  // 1. pending_gates 비어있는가?
  if (context.pending_gates.length > 0) {
    return false;
  }

  // 2. 모든 prior gates 승인?
  const requiredGates = context.policy_decision?.requires_gates ?? [];
  const approvedGateIds = context.approved_gates.map((g) => g.gateId);

  for (const gate of context.pending_gates) {
    if (!approvedGateIds.includes(gate.gateId)) {
      return false;
    }
  }

  // 3. TTL 체크: 마지막 승인이 30분 이내?
  const lastApproval = context.approved_gates[context.approved_gates.length - 1];
  if (lastApproval) {
    const approvedTime = new Date(lastApproval.approvedAt).getTime();
    const now = Date.now();
    const ageMinutes = (now - approvedTime) / (1000 * 60);

    if (ageMinutes > 30) {
      // Gate approval 만료, 재승인 필요
      return false;
    }
  }

  return true;
}
```

**감사 로그 기록:**

```json
{
  "entry_id": "audit_2026-03-02_001",
  "timestamp": 1740979200,
  "who": "orchestrator",
  "what": "EXECUTION_GATE_APPROVED runId=run_2026-03-02_001",
  "execution": {
    "stage": "gate_check",
    "gate_level": 3,
    "approval_count": 3,
    "approval_age_sec": 120
  },
  "result": {
    "status": "success"
  }
}
```

---

### **2단계: Pre-Hook Validation (실행 직전)**

**담당**: Executor Agent (packages/executor/src/enforcement-hook.ts)
**타이밍**: OS Action 실행 직전
**실패 시**: Error 반환 → DEPLOYMENT 실패 → ERROR_RECOVERY/ROLLBACK 상태

#### 2.1 Capability Token 검증

```typescript
/**
 * Pre-Hook: Capability Token 유효성 검증
 *
 * 검증 항목:
 * 1. 토큰이 존재하는가?
 * 2. 토큰 status = 'ACTIVE'?
 * 3. TTL 만료되지 않았는가? (issued_at + ttl_seconds > now)
 * 4. remaining_uses > 0?
 * 5. HMAC-SHA256 서명 검증 (Phase 1+)
 */
async function validateCapabilityToken(
  token: CapabilityToken,
  requiredCapabilities: string[]
): Promise<Result<void, TokenError>> {
  // 1. 토큰 존재 확인
  if (!token) {
    return Err({
      code: 'TOKEN_INVALID',
      message: 'No capability token provided',
      blocksOsActions: true
    });
  }

  // 2. Status 확인
  if (token.status !== 'ACTIVE') {
    return Err({
      code: 'TOKEN_INVALID',
      message: `Token status is ${token.status}, expected ACTIVE`,
      blocksOsActions: true
    });
  }

  // 3. TTL 확인
  const now = Math.floor(Date.now() / 1000);
  const ttl_expires = token.issued_at + token.ttl_seconds;

  if (ttl_expires <= now) {
    return Err({
      code: 'TOKEN_EXPIRED',
      message: `Token expired at ${new Date(ttl_expires * 1000).toISOString()}`,
      blocksOsActions: true
    });
  }

  // 4. remaining_uses 확인
  if (token.remaining_uses <= 0) {
    return Err({
      code: 'TOKEN_INVALID',
      message: 'Token has no remaining uses',
      blocksOsActions: true
    });
  }

  // 5. 서명 검증 (Phase 1+)
  if (token.signature) {
    const expectedSig = hmacSHA256(
      JSON.stringify({
        cap: token.cap,
        scope: token.scope,
        ttl_seconds: token.ttl_seconds,
        max_uses: token.max_uses
      }),
      SIGNING_KEY
    );

    if (token.signature !== expectedSig) {
      return Err({
        code: 'HASH_MISMATCH',
        message: 'Token signature verification failed',
        blocksOsActions: true
      });
    }
  }

  // 6. 요구되는 Capability가 scope에 포함되었는가?
  for (const reqCap of requiredCapabilities) {
    const isAllowed = token.scope.allow.some((glob) =>
      minimatch(reqCap, glob)
    );
    const isDenied = token.scope.deny.some((glob) =>
      minimatch(reqCap, glob)
    );

    if (!isAllowed || isDenied) {
      return Err({
        code: 'TOKEN_SCOPE_MISMATCH',
        message: `Capability '${reqCap}' not in token scope`,
        blocksOsActions: true
      });
    }
  }

  return Ok(undefined);
}
```

**감사 로그 기록 (성공):**

```json
{
  "entry_id": "audit_2026-03-02_002",
  "timestamp": 1740979210,
  "who": "executor",
  "what": "CAPABILITY_TOKEN_VALIDATED cap=cap_abc_123",
  "capability": {
    "cap": "cap_abc_123",
    "status": "ACTIVE",
    "remaining_uses": 1,
    "ttl_expires_sec": 300
  },
  "execution": {
    "stage": "pre_hook_validation",
    "validation_type": "capability_token",
    "required_capabilities": ["executor.run", "fs.write"]
  },
  "result": {
    "status": "success"
  }
}
```

**감사 로그 기록 (실패):**

```json
{
  "entry_id": "audit_2026-03-02_003",
  "timestamp": 1740979215,
  "who": "executor",
  "what": "CAPABILITY_TOKEN_VALIDATION_FAILED cap=cap_abc_123 reason=TOKEN_EXPIRED",
  "execution": {
    "stage": "pre_hook_validation",
    "validation_type": "capability_token",
    "error_code": "TOKEN_EXPIRED",
    "blocking_action": true
  },
  "result": {
    "status": "error",
    "error_code": "TOKEN_EXPIRED"
  }
}
```

#### 2.2 Action 권한 검증

```typescript
/**
 * Pre-Hook: Action 타입별 권한 범위 검증
 *
 * 각 action 타입마다 허용되는 scope 검증:
 * - FS_CREATE_FILE: "fs.create" capability 필요, 경로는 user data 디렉토리만
 * - FS_WRITE_FILE: "fs.write" capability 필요
 * - EXEC_COMMAND: "exec.shell" capability 필요, 명령어 allowlist 검사
 * - APP_LAUNCH: "app.launch" capability 필요, 앱 이름 검증
 */
async function validateActionPermission(
  action: ActionAPIRequest,
  token: CapabilityToken
): Promise<Result<void, PolicyError>> {
  const actionType = action.action_type;

  // 1. 액션 타입에 필요한 capability 맵
  const requiredCapabilities: Record<string, string[]> = {
    FS_CREATE_FILE: ['fs.create'],
    FS_WRITE_FILE: ['fs.write'],
    FS_DELETE_FILE: ['fs.delete'],
    FS_MOVE_FILE: ['fs.move'],
    EXEC_COMMAND: ['exec.shell'],
    APP_LAUNCH: ['app.launch'],
    NETWORK_REQUEST: ['network.external']
    // ... 38개 액션 타입
  };

  const required = requiredCapabilities[actionType];

  if (!required) {
    return Err({
      code: 'POLICY_DENIED',
      message: `Unknown action type: ${actionType}`,
      blocksOsActions: true
    });
  }

  // 2. Token에서 capability 확인
  for (const cap of required) {
    const isAllowed = token.scope.allow.some((glob) => minimatch(cap, glob));
    const isDenied = token.scope.deny.some((glob) => minimatch(cap, glob));

    if (!isAllowed || isDenied) {
      return Err({
        code: 'TOKEN_SCOPE_MISMATCH',
        message: `Action '${actionType}' requires '${cap}' capability`,
        blocksOsActions: true
      });
    }
  }

  // 3. 액션별 추가 제약사항 검사
  switch (actionType) {
    case 'FS_CREATE_FILE': {
      const path = action.payload.path as string;

      // 금지된 경로인가? (contract.md §1)
      const forbiddenPaths = [
        'C:\\Windows',
        'C:\\Program Files',
        '/System',
        '/Applications',
        process.env.APPDATA
      ];

      const isForbidden = forbiddenPaths.some((fp) =>
        path.toLowerCase().startsWith(fp.toLowerCase())
      );

      if (isForbidden) {
        return Err({
          code: 'POLICY_DENIED',
          message: `Path '${path}' is forbidden (system directory)`,
          blocksOsActions: true
        });
      }

      break;
    }

    case 'EXEC_COMMAND': {
      const command = action.payload.command as string;

      // 명령어 allowlist 검사 (security-deep.md)
      const allowlistedCommands = [
        'npm install',
        'npm test',
        'pnpm build',
        'git commit'
      ];

      const isAllowlisted = allowlistedCommands.some((allowed) =>
        command.toLowerCase().startsWith(allowed)
      );

      if (!isAllowlisted) {
        return Err({
          code: 'POLICY_DENIED',
          message: `Command '${command}' not in allowlist`,
          blocksOsActions: true
        });
      }

      break;
    }

    case 'APP_LAUNCH': {
      const appName = action.payload.app_name as string;

      // 모바일: 18개 차단 앱 검사 (mobile-integration.md)
      const blockedApps = [
        'banking',
        'paypal',
        'stripe',
        'kakao-pay'
        // ... 18개
      ];

      const isBlocked = blockedApps.some((ba) =>
        appName.toLowerCase().includes(ba)
      );

      if (isBlocked) {
        return Err({
          code: 'POLICY_DENIED',
          message: `App '${appName}' is blocked`,
          blocksOsActions: true
        });
      }

      break;
    }
  }

  return Ok(undefined);
}
```

#### 2.3 파일 경로 정규화 및 검증

```typescript
/**
 * Pre-Hook: 파일 경로 검증
 *
 * 1. 경로 정규화 (.. 제거, 심볼릭 링크 해석)
 * 2. 범위 확인 (사용자 디렉토리 내만)
 * 3. 권한 확인 (읽기/쓰기 가능?)
 */
async function validateFilePath(
  path: string,
  operation: 'read' | 'write' | 'delete'
): Promise<Result<string, ValidationError>> {
  // 1. 경로 정규화
  let normalizedPath: string;
  try {
    normalizedPath = await fs.realpath(path); // 심볼릭 링크 해석
  } catch (error) {
    // 아직 존재하지 않는 파일 (생성 시): 부모 디렉토리 검사
    const parentDir = await fs.realpath(path.substring(0, path.lastIndexOf('/')));
    normalizedPath = `${parentDir}/${path.split('/').pop()}`;
  }

  // 2. 범위 확인 (사용자 데이터 디렉토리 내)
  const userDataDir = path.join(os.homedir(), 'AppData', 'Local');
  const desktopDir = path.join(os.homedir(), 'Desktop');

  const isInUserData = normalizedPath.startsWith(userDataDir);
  const isOnDesktop = normalizedPath.startsWith(desktopDir);

  if (!isInUserData && !isOnDesktop) {
    return Err({
      code: 'POLICY_DENIED',
      message: `Path '${normalizedPath}' is outside allowed directories`,
      userMessage: '사용자 데이터 폴더 또는 바탕화면 내의 파일만 조작 가능합니다.'
    });
  }

  // 3. 권한 확인
  try {
    const stats = await fs.stat(normalizedPath);

    if (operation === 'write' || operation === 'delete') {
      if (!stats.isFile()) {
        return Err({
          code: 'VALIDATION_FAILED',
          message: `Path '${normalizedPath}' is not a file`
        });
      }
    }
  } catch (error) {
    if (operation === 'read') {
      return Err({
        code: 'VALIDATION_FAILED',
        message: `File not found: ${normalizedPath}`
      });
    }
    // write/delete: 파일이 없어도 괜찮음 (생성 또는 이미 삭제됨)
  }

  return Ok(normalizedPath);
}
```

---

### **3단계: OS Action Execution (실제 조작)**

**담당**: Executor Agent (packages/executor/src/action-executor.ts)
**타이밍**: Pre-Hook 통과 직후
**에러 처리**: 예외 발생 시 즉시 post-hook으로 진행 (실패 코드 기록)

```typescript
/**
 * executeAction() — 실제 OS 조작 수행
 *
 * 모든 38개 액션 타입을 처리
 * 각 액션은 동기/비동기 혼합 가능
 * 타임아웃: 30초 (액션별로 조정 가능)
 */
async function executeAction(
  action: ActionAPIRequest,
  context: JarvisMachineContext
): Promise<ActionExecutionResult> {
  const startTime = Date.now();
  let result: ActionExecutionResult = {
    action_id: action.action_id,
    action_type: action.action_type,
    status: 'pending',
    duration_ms: 0,
    output: null,
    error: null
  };

  try {
    switch (action.action_type) {
      case 'FS_CREATE_FILE': {
        const { path, content, encoding = 'utf-8' } = action.payload as {
          path: string;
          content: string;
          encoding?: string;
        };

        await fs.writeFile(path, content, encoding);

        result.status = 'success';
        result.output = { path, bytes_written: content.length };
        break;
      }

      case 'FS_WRITE_FILE': {
        const { path, content, encoding = 'utf-8' } = action.payload as {
          path: string;
          content: string;
          encoding?: string;
        };

        await fs.appendFile(path, content, encoding);

        result.status = 'success';
        result.output = { path, bytes_appended: content.length };
        break;
      }

      case 'EXEC_COMMAND': {
        const { command, cwd = process.cwd() } = action.payload as {
          command: string;
          cwd?: string;
        };

        const output = await executeCommand(command, { cwd });

        result.status = 'success';
        result.output = { stdout: output.stdout, stderr: output.stderr };
        break;
      }

      // ... 35 more action types
    }
  } catch (error) {
    result.status = 'failure';
    result.error = {
      code: 'INTERNAL_ERROR',
      message: String(error),
      stack: (error as any).stack
    };
  }

  result.duration_ms = Date.now() - startTime;
  return result;
}
```

---

### **4단계: Post-Hook Validation (실행 직후)**

**담당**: Executor Agent (packages/executor/src/enforcement-hook.ts)
**타이밍**: OS Action 완료 직후
**실패 시**: 자동 Rollback 트리거

#### 4.1 실행 결과 무결성 검증

```typescript
/**
 * Post-Hook: 실행 결과 검증
 *
 * 검증 항목:
 * 1. Action이 success 상태인가?
 * 2. 파일이 실제로 생성/수정되었는가?
 * 3. 파일 내용이 기대값과 일치하는가? (선택적 해시 검사)
 * 4. 사이드 이펙트는 없는가? (예: 예상 외 파일 생성)
 */
async function validateExecutionResult(
  action: ActionAPIRequest,
  result: ActionExecutionResult
): Promise<Result<void, ExecutionError>> {
  // 1. Status 확인
  if (result.status !== 'success') {
    return Err({
      code: 'INTERNAL_ERROR',
      message: `Action failed: ${result.error?.message}`,
      blocksOsActions: false,  // 실패했으므로 이미 수행 안 됨
      triggerRollback: false
    });
  }

  // 2. 파일이 실제로 존재하는가?
  switch (action.action_type) {
    case 'FS_CREATE_FILE':
    case 'FS_WRITE_FILE': {
      const path = action.payload.path as string;

      try {
        const stats = await fs.stat(path);

        if (!stats.isFile()) {
          return Err({
            code: 'INTERNAL_ERROR',
            message: `Expected file, got directory: ${path}`,
            triggerRollback: true  // 롤백 필요
          });
        }

        // 선택적: 파일 해시 검증 (대용량 파일은 비용 크므로 필요시만)
        if (action.payload.expected_hash) {
          const fileContent = await fs.readFile(path);
          const actualHash = sha256(fileContent);

          if (actualHash !== action.payload.expected_hash) {
            return Err({
              code: 'HASH_MISMATCH',
              message: `File hash mismatch: expected ${action.payload.expected_hash}, got ${actualHash}`,
              triggerRollback: true
            });
          }
        }
      } catch (error) {
        return Err({
          code: 'INTERNAL_ERROR',
          message: `File not found after creation: ${path}`,
          triggerRollback: true
        });
      }

      break;
    }

    case 'EXEC_COMMAND': {
      // 명령어 실행 결과: stderr 검사
      const stderr = result.output?.stderr as string | undefined;

      if (stderr && stderr.length > 0) {
        // 주의: stderr 있다고 항상 실패는 아님 (일부 명령어는 stderr 사용)
        // 만약 exit code가 0이 아니면 롤백
        const output = result.output as any;
        if (output.exit_code && output.exit_code !== 0) {
          return Err({
            code: 'INTERNAL_ERROR',
            message: `Command exited with code ${output.exit_code}: ${stderr}`,
            triggerRollback: true
          });
        }
      }

      break;
    }
  }

  // 3. 사이드 이펙트 모니터링 (선택적, 고급 기능)
  // 예: 디렉토리 파일 리스트 변화 모니터링 (스냅샷 비교)
  // → Phase 2+ 고려

  return Ok(undefined);
}
```

**감사 로그 기록 (성공):**

```json
{
  "entry_id": "audit_2026-03-02_004",
  "timestamp": 1740979220,
  "who": "executor",
  "what": "ACTION_EXECUTED_VALIDATED action=FS_CREATE_FILE path=C:\\Users\\user\\Desktop\\hello.txt",
  "execution": {
    "stage": "post_hook_validation",
    "action_id": "action_001",
    "action_type": "FS_CREATE_FILE",
    "status": "success",
    "duration_ms": 50,
    "file_size_bytes": 13,
    "file_hash_sha256": "abc123..."
  },
  "result": {
    "status": "success"
  }
}
```

**감사 로그 기록 (실패 + Rollback 트리거):**

```json
{
  "entry_id": "audit_2026-03-02_005",
  "timestamp": 1740979225,
  "who": "executor",
  "what": "ACTION_EXECUTION_FAILED action=FS_CREATE_FILE validation_failed",
  "execution": {
    "stage": "post_hook_validation",
    "action_id": "action_001",
    "error_code": "HASH_MISMATCH",
    "error_message": "File content differs from expected",
    "rollback_triggered": true,
    "recovery_checkpoint_id": "checkpoint_2026-03-02_001"
  },
  "result": {
    "status": "error",
    "error_code": "INTERNAL_ERROR"
  }
}
```

---

### **5단계: Audit Logging & Token Consumption (최종 기록)**

**담당**: Executor Agent + AuditLogService
**타이밍**: Post-Hook 검증 완료 직후
**Capability Token**: Hook 통과 후에만 소비

```typescript
/**
 * finalizeExecution() — 실행 최종 기록 및 Capability Token 소비
 *
 * 순서:
 * 1. AuditEntry 생성 (전체 실행 결과 요약)
 * 2. Capability Token 소비 (remaining_uses 감소)
 * 3. Checkpoint 저장 (COMPLETED 상태용)
 */
async function finalizeExecution(
  runId: string,
  execution_result: ExecutorOutput,
  capability_token: CapabilityToken,
  context: JarvisMachineContext
): Promise<Result<void, DBError>> {
  // 1. AuditEntry 생성
  const auditEntry: AuditEntry = {
    who: 'executor',
    what: `EXECUTION_COMPLETED runId=${runId} files_applied=${execution_result.applied_files.length}`,
    execution: {
      stage: 'finalization',
      total_actions: execution_result.action_logs.length,
      successful_actions: execution_result.action_logs.filter(
        (a) => a.status === 'success'
      ).length,
      failed_actions: execution_result.failed_actions.length,
      total_duration_ms: execution_result.action_logs.reduce((sum, a) => sum + a.duration_ms, 0)
    },
    capability: {
      cap_id: capability_token.cap,
      remaining_uses_before: capability_token.remaining_uses,
      remaining_uses_after: capability_token.remaining_uses - 1
    },
    result: {
      status: 'success',
      output: {
        applied_files: execution_result.applied_files,
        execution_time_sec: execution_result.action_logs.reduce((sum, a) => sum + a.duration_ms, 0) / 1000
      }
    }
  };

  const logResult = await auditLog.record(auditEntry);
  if (!logResult.ok) return logResult;

  // 2. Capability Token 소비
  const consumeResult = await capabilityTokenManager.consume(capability_token);
  if (!consumeResult.ok) return consumeResult;

  // 3. Checkpoint 저장 (COMPLETED 상태)
  const checkpointResult = await checkpointManager.saveCheckpoint({
    run_id: runId,
    xstate_context: {
      ...context,
      currentState: 'COMPLETED',
      lastTransitionAt: new Date().toISOString(),
      execution_result
    },
    created_by: 'executor'
  });

  return checkpointResult;
}
```

---

## Capability Token 검증 시점

### **Token 검증 vs 소비 생명 주기**

```
┌──────────────────────────────────────────────────────────┐
│                   DEPLOYMENT State Flow                  │
└──────────────────────────────────────────────────────────┘

Time
 │
 ├─ T0: DEPLOYMENT 진입
 │       ├─ context.capability_token 존재 확인 (XState Guard)
 │       └─ token.status = 'ACTIVE' 확인
 │
 ├─ T1: Pre-Hook 시작
 │       ├─ validateCapabilityToken() 호출
 │       ├─ TTL 재확인 (T1 시점 기준)
 │       ├─ remaining_uses > 0 확인
 │       ├─ HMAC 서명 검증 ← 서명은 여전히 유효해야 함
 │       ├─ Scope 검증 (필요한 capability 포함)
 │       └─ 실패 시: Error 반환 (Token 소비 안 함 ⭐)
 │
 ├─ T2: OS Action 실행
 │       ├─ Token이 여전히 유효한가 재확인? (선택, 일반적으로 불필요)
 │       └─ 실행 중 Token 소비 안 함
 │
 ├─ T3: Post-Hook 검증
 │       ├─ 실행 결과 무결성 검증
 │       ├─ 실패 시: Token 소비 안 함, 롤백 트리거 ⭐
 │       └─ 성공 시: 다음 단계로
 │
 ├─ T4: Finalization (Audit Logging)
 │       ├─ AuditEntry 기록
 │       ├─ consumeCapabilityToken() 호출 ← 여기서만 소비!
 │       │   (remaining_uses 감소)
 │       │   (remaining_uses = 0이면 status = 'CONSUMED')
 │       └─ Checkpoint 저장 (COMPLETED 상태)
 │
 └─ T5: COMPLETED 상태

⭐ 핵심: Token은 Pre-Hook에서 검증하지만,
        실제 소비(remaining_uses 감소)는 T4 finalization 단계에서만 수행!
```

### **Token 소비 원자성 (Atomicity)**

```typescript
/**
 * consumeCapabilityToken() — 토큰 소비 (데이터베이스 트랜잭션)
 *
 * 원자성 보장: 이 함수는 완전히 성공하거나 완전히 실패해야 함
 * (중간 상태 없음)
 */
async function consumeCapabilityToken(
  cap_id: string
): Promise<Result<{ remaining_uses: number }, TokenError>> {
  // 트랜잭션 시작
  await db.beginTransaction();

  try {
    // 1. 토큰 재확인 (다시 한 번)
    const token = await db.get(
      `SELECT * FROM capability_tokens WHERE cap_id = ?`,
      [cap_id]
    );

    if (!token || token.status !== 'ACTIVE') {
      throw new Error('Token invalid or already consumed');
    }

    // 2. remaining_uses 감소
    const new_remaining = token.remaining_uses - 1;
    const new_status = new_remaining === 0 ? 'CONSUMED' : 'ACTIVE';

    // 3. 데이터베이스 업데이트
    await db.run(
      `UPDATE capability_tokens
       SET remaining_uses = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE cap_id = ?`,
      [new_remaining, new_status, cap_id]
    );

    // 4. 감사 로그 추가 (트랜잭션 내)
    await db.run(
      `INSERT INTO audit_entries (...) VALUES (...)`,
      [
        /* token consumption entry */
      ]
    );

    // 트랜잭션 커밋
    await db.commit();

    return Ok({ remaining_uses: new_remaining });
  } catch (error) {
    // 트랜잭션 롤백 (Token 상태 변경 안 함)
    await db.rollback();

    return Err({
      code: 'DB_ERROR',
      message: `Failed to consume token: ${error}`
    });
  }
}
```

---

## 구현 패턴

### packages/executor/src/enforcement-hook.ts

```typescript
/**
 * EnforcementHook — Pre/Post Hook 구현
 *
 * 책임:
 * - validatePreExecution(): Pre-Hook 모든 검증 수행
 * - validatePostExecution(): Post-Hook 무결성 검증
 * - triggerRollback(): 실패 시 자동 롤백
 */
export class EnforcementHook {
  private auditLog: AuditLogService;
  private capabilityTokenManager: CapabilityTokenManager;
  private rollbackManager: RollbackManager;

  /**
   * Pre-Hook: 실행 직전 모든 검증
   *
   * @param context XState context
   * @param actions 실행할 액션 배열
   * @param capabilityToken Capability Token
   *
   * @returns Result<void, PolicyError>
   *   - Ok(void): 모든 검증 통과, 실행 진행 가능
   *   - Err(...): 검증 실패, 실행 중단
   */
  async validatePreExecution(
    context: JarvisMachineContext,
    actions: ActionAPIRequest[],
    capabilityToken: CapabilityToken
  ): Promise<Result<void, PolicyError>> {
    // 1. Capability Token 검증
    for (const action of actions) {
      const tokenValidation = await validateCapabilityToken(
        capabilityToken,
        [`executor.run`, `${action.action_type.toLowerCase()}`]
      );

      if (!tokenValidation.ok) {
        // 감사 로그: 토큰 검증 실패
        await this.auditLog.record({
          who: 'executor',
          what: `PRE_HOOK_VALIDATION_FAILED validation=capability_token action=${action.action_type}`,
          execution: {
            stage: 'pre_hook',
            error_code: tokenValidation.error.code
          },
          result: { status: 'error', error: tokenValidation.error }
        });

        return tokenValidation;
      }
    }

    // 2. Action 권한 검증
    for (const action of actions) {
      const permValidation = await validateActionPermission(action, capabilityToken);

      if (!permValidation.ok) {
        await this.auditLog.record({
          who: 'executor',
          what: `PRE_HOOK_VALIDATION_FAILED validation=action_permission action=${action.action_type}`,
          execution: { stage: 'pre_hook', error_code: permValidation.error.code },
          result: { status: 'error', error: permValidation.error }
        });

        return permValidation;
      }
    }

    // 3. 경로 검증 (FS 액션만)
    for (const action of actions) {
      if (action.action_type.startsWith('FS_')) {
        const pathValidation = await validateFilePath(
          action.payload.path as string,
          action.action_type === 'FS_DELETE_FILE' ? 'delete' : 'write'
        );

        if (!pathValidation.ok) {
          await this.auditLog.record({
            who: 'executor',
            what: `PRE_HOOK_VALIDATION_FAILED validation=file_path action=${action.action_type}`,
            execution: { stage: 'pre_hook', error_code: pathValidation.error.code },
            result: { status: 'error', error: pathValidation.error }
          });

          return pathValidation;
        }
      }
    }

    // 모든 검증 통과
    await this.auditLog.record({
      who: 'executor',
      what: 'PRE_HOOK_VALIDATION_PASSED',
      execution: {
        stage: 'pre_hook',
        total_actions: actions.length
      },
      result: { status: 'success' }
    });

    return Ok(undefined);
  }

  /**
   * Post-Hook: 실행 직후 무결성 검증
   *
   * @param actions 실행한 액션 배열
   * @param results 각 액션의 실행 결과
   *
   * @returns Result<void, ExecutionError>
   *   - Ok(void): 모든 결과 검증 통과
   *   - Err(...): 검증 실패, 자동 롤백 필요
   */
  async validatePostExecution(
    actions: ActionAPIRequest[],
    results: ActionExecutionResult[]
  ): Promise<Result<void, ExecutionError>> {
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      const result = results[i];

      const validation = await validateExecutionResult(action, result);

      if (!validation.ok) {
        // 감사 로그: Post-Hook 실패
        await this.auditLog.record({
          who: 'executor',
          what: `POST_HOOK_VALIDATION_FAILED action=${action.action_type}`,
          execution: {
            stage: 'post_hook',
            error_code: validation.error.code,
            rollback_triggered: validation.error.triggerRollback
          },
          result: { status: 'error', error: validation.error }
        });

        // 자동 롤백
        if (validation.error.triggerRollback) {
          await this.triggerRollback(results.slice(0, i)); // 이전까지의 성공한 액션만 롤백
        }

        return validation;
      }
    }

    // 모든 검증 통과
    await this.auditLog.record({
      who: 'executor',
      what: 'POST_HOOK_VALIDATION_PASSED',
      execution: {
        stage: 'post_hook',
        total_actions: actions.length
      },
      result: { status: 'success' }
    });

    return Ok(undefined);
  }

  /**
   * triggerRollback() — 자동 롤백 시작
   *
   * @param appliedActions 이미 적용된 액션들 (역순 실행)
   */
  private async triggerRollback(
    appliedActions: ActionExecutionResult[]
  ): Promise<void> {
    // RollbackAgent 호출
    const rollbackResult = await this.rollbackManager.abort(appliedActions);

    if (!rollbackResult.ok) {
      // 롤백 실패: 치명적 오류
      await this.auditLog.record({
        who: 'executor',
        what: 'ROLLBACK_FAILED CRITICAL',
        execution: {
          stage: 'rollback',
          error_code: 'ROLLBACK_FAILED'
        },
        result: { status: 'error' }
      });
    }
  }
}
```

---

## 참고 문서

- `.claude/design/db-query-library.md` — Capability Token 쿼리
- `.claude/contract.md` — §1 절대 금지사항, §2 Token 규칙
- `.claude/design/security-deep.md` — 보안 정책 전체
- `.claude/agents/executor.md` — Executor Agent 상세
- `.claude/agents/rollback.md` — Rollback Agent 상세

