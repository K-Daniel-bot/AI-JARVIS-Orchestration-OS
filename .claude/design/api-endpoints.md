# JARVIS OS — 내부 API 인터페이스 명세

> 이 문서는 JARVIS OS 각 레이어 간 내부 API를 정의합니다.
> 외부 공개 API가 아닌 패키지 간 TypeScript 인터페이스입니다.
> 모든 함수는 Result<T, JarvisError> 패턴을 반환하며, throw는 금지됩니다.
> 메시지 페이로드는 실행 전 반드시 Zod 스키마로 검증해야 합니다.

---

## 전제 조건 — 공통 타입

```typescript
// packages/shared/src/types/common.ts

/** 도메인 에러 코드 — error-catalog.md 참조 */
type JarvisErrorCode =
  | 'AGENT_TIMEOUT'
  | 'VALIDATION_FAILED'
  | 'RESOURCE_EXHAUSTED'
  | 'INTERNAL_ERROR'
  | 'POLICY_DENIED'
  | 'TOKEN_INVALID'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_SCOPE_MISMATCH'
  | 'HASH_MISMATCH'
  | 'DB_ERROR';

/** 내부 에러 구조체 — 사용자에게 stack trace 노출 금지 */
interface JarvisError {
  code: JarvisErrorCode;
  message: string;
  userMessage: string;
  agentId?: string;
  runId?: string;
  retryable: boolean;
  blocksOsActions: boolean;
}

/** 비즈니스 로직 결과 래퍼 — throw 대신 사용 */
type Result<T, E = JarvisError> =
  | { ok: true; value: T }
  | { ok: false; error: E };

/** 에이전트 식별자 */
type AgentId =
  | 'orchestrator'
  | 'spec-agent'
  | 'policy-risk'
  | 'planner'
  | 'codegen'
  | 'review'
  | 'test-build'
  | 'executor'
  | 'rollback';

/** 실행 Run 식별자 형식: run_{date}_{seq} */
type RunId = string;

/** 세션 식별자 */
type SessionId = string;
```

---

## 1. CLI → Core

### 1.1 사용자 요청 전달

CLI가 사용자 입력을 받아 Core(Orchestrator)로 전달하는 진입점.

```typescript
// packages/cli/src/handlers/request.ts → packages/core/src/orchestrator.ts

/**
 * 사용자 요청을 Orchestrator에 전달하고 Run을 시작한다.
 * 이 함수는 상태 머신 IDLE → SPEC_ANALYSIS 전이를 트리거한다.
 */
async function submitUserRequest(
  input: UserRequestInput
): Promise<Result<RunStarted, JarvisError>>;

/** 사용자 요청 입력 */
interface UserRequestInput {
  /** 사용자 원본 자연어 입력 */
  rawInput: string;
  /** 세션 식별자 (세션 TTL 검증에 사용) */
  sessionId: SessionId;
  /** 요청자 정보 */
  user: {
    userId: string;
    role: 'Owner' | 'Admin' | 'User' | 'Guest';
  };
  /** 현재 신뢰 모드 (env 설정 또는 런타임 변경값) */
  trustMode: 'observe' | 'suggest' | 'semi-auto' | 'full-auto';
}

/** Run 시작 결과 */
interface RunStarted {
  runId: RunId;
  /** 예상 처리 시간 (밀리초) */
  estimatedDurationMs: number;
  /** 초기 복잡도 평가 */
  complexityLevel: 'LOW' | 'MEDIUM' | 'HIGH';
}

/** 에러 케이스 */
// VALIDATION_FAILED: rawInput이 비어있거나 너무 긴 경우
// RESOURCE_EXHAUSTED: 동시 실행 Run 한도 초과
// INTERNAL_ERROR: Orchestrator 상태 머신 초기화 실패
```

---

### 1.2 상태 조회

```typescript
// packages/cli/src/handlers/status.ts → packages/core/src/orchestrator.ts

/**
 * 진행 중인 Run의 현재 상태를 조회한다.
 */
async function getRunStatus(
  runId: RunId,
  sessionId: SessionId
): Promise<Result<RunStatusSnapshot, JarvisError>>;

/** Run 상태 스냅샷 */
interface RunStatusSnapshot {
  runId: RunId;
  /** XState 상태명 */
  currentState: string;
  /** 활성 에이전트 목록 */
  activeAgents: Array<{
    agentId: AgentId;
    status: 'HEALTHY' | 'DEGRADED' | 'UNRESPONSIVE' | 'CRASHED';
    currentTask?: string;
  }>;
  /** 현재 Gate 대기 여부 */
  pendingGate?: {
    gateLevel: 'L1' | 'L2';
    gateType: string;
    waitingSince: string;
  };
  /** 토큰 예산 사용 현황 */
  tokenBudget: {
    used: number;
    limit: number;
    percentageUsed: number;
  };
  /** 체크포인트 목록 */
  checkpoints: Array<{
    checkpointId: string;
    state: string;
    savedAt: string;
  }>;
}

/** 에러 케이스 */
// INTERNAL_ERROR: runId가 존재하지 않는 경우
// VALIDATION_FAILED: sessionId 불일치 (다른 세션의 Run 조회 시도)
```

---

### 1.3 비상 중단

```typescript
// packages/cli/src/handlers/emergency.ts → packages/core/src/orchestrator.ts

/**
 * 사용자의 비상 중단 명령을 실행한다.
 * 계약서 §7: 모든 에이전트 즉시 정지, Capability 무효화, 상태 저장.
 * 이 함수는 취소 불가 — 호출 즉시 효력 발생.
 */
async function emergencyStop(
  sessionId: SessionId,
  reason: string
): Promise<Result<EmergencyStopResult, JarvisError>>;

/** 비상 중단 결과 */
interface EmergencyStopResult {
  /** 중단된 Run 목록 */
  stoppedRuns: RunId[];
  /** 무효화된 Capability Token 수 */
  revokedTokenCount: number;
  /** 저장된 체크포인트 경로 */
  checkpointPath: string;
  /** 롤백이 필요한 액션 목록 */
  pendingRollbacks: Array<{
    actionId: string;
    actionType: string;
    rollbackPossible: boolean;
  }>;
}

/** 에러 케이스 */
// INTERNAL_ERROR: 체크포인트 저장 실패 (그래도 중단은 진행)
// DB_ERROR: 감사 로그 기록 실패 (중단은 진행, 메모리 버퍼 사용)
```

---

## 2. Core → Agent

### 2.1 에이전트 실행 요청

Orchestrator가 하위 에이전트를 시작할 때 사용한다.

```typescript
// packages/core/src/orchestrator.ts → packages/agents/src/{agent}.ts

/**
 * 에이전트에게 작업을 할당하고 실행을 시작한다.
 * 에이전트는 비동기로 실행되며, 결과는 onAgentComplete 콜백으로 수신한다.
 */
async function dispatchAgent(
  request: AgentDispatchRequest
): Promise<Result<AgentDispatched, JarvisError>>;

/** 에이전트 실행 요청 */
interface AgentDispatchRequest {
  agentId: AgentId;
  runId: RunId;
  sessionId: SessionId;
  /** /.ai-run/ 디렉토리의 Environment Bundle */
  environmentBundle: {
    specPath?: string;       // SPEC.md 경로
    planPath?: string;       // PLAN.json 경로
    policyPath?: string;     // POLICY.json 경로
    budgetPath: string;      // BUDGET.json 경로 (필수)
    taskGraphPath?: string;  // TASK_GRAPH.json 경로
  };
  /** 에이전트별 작업 파라미터 */
  taskParams: Record<string, unknown>;
  /** 완료 시 호출할 다음 상태 전이 이벤트 */
  onCompleteEvent: string;
  /** 에이전트 타임아웃 (밀리초, 기본 60000) */
  timeoutMs?: number;
}

/** 에이전트 시작 확인 */
interface AgentDispatched {
  agentId: AgentId;
  taskId: string;
  startedAt: string;
}

/** 에러 케이스 */
// AGENT_TIMEOUT: 에이전트가 시작 확인을 응답하지 않음
// VALIDATION_FAILED: environmentBundle 필수 파일 누락
// RESOURCE_EXHAUSTED: 토큰 예산 소진
```

---

### 2.2 에이전트 완료 결과 수신

```typescript
// packages/agents/src/{agent}.ts → packages/core/src/orchestrator.ts

/**
 * 에이전트가 작업 완료 후 Orchestrator에 결과를 보고한다.
 * 성공/실패 모두 이 함수로 보고 (throw 금지).
 * architecture-deep.md §7.2 메시지 표준 포맷 준수.
 */
async function reportAgentResult(
  result: AgentResult
): Promise<Result<void, JarvisError>>;

/** 에이전트 결과 보고 */
interface AgentResult {
  agentId: AgentId;
  runId: RunId;
  taskId: string;
  status: 'SUCCESS' | 'FAILED' | 'BLOCKED';
  /** 상태 머신 전이 이벤트 (성공: onCompleteEvent, 실패: 'ERROR' 등) */
  nextEvent: string;
  /** 생성된 아티팩트 경로 */
  artifacts?: string[];
  /** 후속 에이전트에게 전달할 메타데이터 */
  handoffPayload?: {
    artifactType: 'SPEC' | 'PLAN' | 'POLICY' | 'CHANGESET' | 'REVIEW' | 'TEST_RESULT';
    artifactRef: string;
    summary: string;
    metadata: Record<string, unknown>;
  };
  /** 실패 시 에러 정보 */
  error?: JarvisError;
  /** 토큰 사용량 */
  tokensUsed: number;
}

/** 에러 케이스 */
// VALIDATION_FAILED: result 스키마 불일치
// DB_ERROR: 감사 로그 기록 실패
```

---

## 3. Agent → PolicyEngine

### 3.1 정책 판정 요청

```typescript
// packages/agents/src/{agent}.ts → packages/policy-engine/src/index.ts

/**
 * PolicyEngine에 요청에 대한 정책 판정을 요청한다.
 * 결과로 PolicyDecision을 반환. schemas/policy-decision.json 준수.
 */
async function evaluatePolicy(
  request: PolicyEvaluationRequest
): Promise<Result<PolicyDecision, JarvisError>>;

/** 정책 판정 요청 */
interface PolicyEvaluationRequest {
  runId: RunId;
  sessionId: SessionId;
  /** 요청자 정보 */
  subject: {
    userId: string;
    role: 'Owner' | 'Admin' | 'User' | 'Guest' | 'AI-Autonomous';
    device?: string;
  };
  /** 원본 요청 정보 */
  request: {
    rawInput: string;
    intent: string;
    targets: string[];
    requiresWebAccess: boolean;
    requiresLogin: boolean;
  };
  /** 신뢰 모드 컨텍스트 */
  trustMode: 'observe' | 'suggest' | 'semi-auto' | 'full-auto';
}

/** 정책 판정 결과 (schemas/policy-decision.json 기준) */
interface PolicyDecision {
  decisionId: string;
  timestamp: string;
  outcome: {
    status: 'ALLOW' | 'DENY' | 'APPROVAL_REQUIRED' | 'CONSTRAINED_ALLOW';
    riskScore: number;     // 0~100
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    requiresGates: string[];
    reasonCodes: string[];
    humanExplanation: string;
  };
  constraints: {
    fs: {
      readAllow: string[];
      writeAllow: string[];
      writeDeny: string[];
    };
    exec: {
      allow: string[];
      deny: string[];
    };
    network: {
      allowDomains: string[];
      denyDomains: string[];
      default: 'ALLOW' | 'DENY';
    };
  };
  requiredCapabilities: CapabilitySpec[];
  denials: Array<{
    code: string;
    pattern: string;
    message: string;
  }>;
}

/** Capability 발급 명세 */
interface CapabilitySpec {
  cap: string;
  scope: string | string[];
  ttlSeconds: number;
  maxUses: number;
}

/** 에러 케이스 */
// POLICY_DENIED: status === 'DENY' 판정 (에러가 아닌 정상 결과)
// VALIDATION_FAILED: 요청 스키마 불일치
// INTERNAL_ERROR: 정책 엔진 내부 오류
```

---

### 3.2 Capability Token 발급

```typescript
// packages/agents/src/policy-risk.ts → packages/policy-engine/src/token.ts

/**
 * PolicyDecision에 따라 Capability Token을 발급한다.
 * schemas/capability-token.json 준수. 토큰은 1회성으로 발급됨.
 */
async function issueCapabilityToken(
  spec: CapabilitySpec,
  context: TokenContext
): Promise<Result<CapabilityToken, JarvisError>>;

/** 토큰 발급 컨텍스트 */
interface TokenContext {
  sessionId: SessionId;
  runId: RunId;
  policyDecisionId: string;
  trustMode: 'observe' | 'suggest' | 'semi-auto' | 'full-auto';
  /** 사용자 수동 승인이 이루어진 경우 true */
  userApproved: boolean;
}

/** 발급된 Capability Token */
interface CapabilityToken {
  tokenId: string;          // cap_{date}_{seq}
  issuedAt: string;
  issuedBy: 'policy-risk-agent';
  approvedBy: 'user' | 'auto';
  grant: {
    cap: string;
    scope: string | string[];
    ttlSeconds: number;
    maxUses: number;
  };
  context: TokenContext;
  status: 'ACTIVE';
}

/**
 * 토큰 유효성 검증 — 액션 실행 직전 호출 필수.
 * ValidationRules: schemas/capability-token.json 참조.
 */
async function validateCapabilityToken(
  tokenId: string,
  action: ActionValidationInput
): Promise<Result<TokenValidated, JarvisError>>;

/** 액션 검증 입력 */
interface ActionValidationInput {
  cap: string;
  scope: string;
  actionType: string;
}

/** 검증 통과 결과 */
interface TokenValidated {
  tokenId: string;
  remainingUses: number;
}

/** 에러 케이스 */
// TOKEN_INVALID: 토큰이 ACTIVE 상태가 아님
// TOKEN_EXPIRED: TTL 만료
// TOKEN_SCOPE_MISMATCH: scope 또는 cap 불일치
// VALIDATION_FAILED: 입력 스키마 오류
```

---

## 4. Agent → Audit

### 4.1 감사 로그 기록

```typescript
// packages/agents/src/{any-agent}.ts → packages/audit/src/index.ts

/**
 * 불변 감사 로그에 엔트리를 추가한다.
 * 계약서 §3: 모든 에이전트는 작업마다 이 함수를 반드시 호출해야 한다.
 * append-only — 삭제/수정 불가. 해시 체인으로 무결성 보장.
 */
async function appendAuditEntry(
  entry: AuditEntryInput
): Promise<Result<AuditEntryCreated, JarvisError>>;

/** 감사 로그 입력 (schemas/audit-log.json 기준) */
interface AuditEntryInput {
  who: {
    userId: string;
    role: string;
    sessionId: SessionId;
  };
  what: {
    rawInput?: string;
    aiInterpretation: string;
    intent: string;
  };
  policy?: {
    policyDecisionId: string;
    riskScore: number;
    riskLevel: string;
    status: string;
  };
  capability?: {
    tokenIds: string[];
    scopesGranted: string[];
  };
  execution?: {
    runId: RunId;
    actionsPerformed: Array<{
      actionId: string;
      type: string;
      status: 'SUCCESS' | 'FAILED' | 'DENIED';
      durationMs: number;
    }>;
    rollbackPerformed: boolean;
    rollbackReason?: string;
  };
  result: {
    status: 'COMPLETED' | 'FAILED' | 'ROLLED_BACK' | 'ABORTED' | 'DENIED';
    outputSummary: string;
    artifacts?: string[];
  };
  logLevel: 'FULL' | 'SUMMARY';
}

/** 생성된 감사 로그 확인 */
interface AuditEntryCreated {
  auditId: string;      // aud_{date}_{seq}
  timestamp: string;
  hash: string;         // 이 엔트리의 SHA-256 해시
  previousHash: string; // 이전 엔트리 해시 (체인 연결)
  entryIndex: number;   // DB 내 순서 번호
}

/** 에러 케이스 */
// DB_ERROR: DB 쓰기 실패 (OS 작업 차단 트리거)
// HASH_MISMATCH: 이전 해시 불일치 (무결성 위반)
// VALIDATION_FAILED: entry 스키마 불일치
```

---

### 4.2 감사 로그 조회

```typescript
// packages/web/src → packages/audit/src/query.ts

/**
 * 감사 로그를 조회한다. 읽기 전용 — 수정 불가.
 * 대시보드 AuditLogPanel에서 실시간 조회에 사용.
 */
async function queryAuditLog(
  filter: AuditLogFilter
): Promise<Result<AuditLogPage, JarvisError>>;

/** 감사 로그 조회 필터 */
interface AuditLogFilter {
  runId?: RunId;
  sessionId?: SessionId;
  agentId?: AgentId;
  fromTimestamp?: string;
  toTimestamp?: string;
  /** 결과 수 제한 (기본 50, 최대 500) */
  limit?: number;
  offset?: number;
  /** 결과 상태 필터 */
  resultStatus?: Array<'COMPLETED' | 'FAILED' | 'ROLLED_BACK' | 'ABORTED' | 'DENIED'>;
}

/** 페이지 조회 결과 */
interface AuditLogPage {
  entries: AuditEntry[];
  totalCount: number;
  hasMore: boolean;
  /** 현재 최신 해시 (클라이언트 무결성 검증용) */
  latestHash: string;
}

/** 해시 체인 전체 무결성 검증 */
async function verifyHashChain(
  fromIndex?: number,
  toIndex?: number
): Promise<Result<HashChainVerified, JarvisError>>;

/** 무결성 검증 결과 */
interface HashChainVerified {
  verified: boolean;
  checkedEntries: number;
  firstMismatchIndex?: number;
}

/** 에러 케이스 */
// DB_ERROR: DB 읽기 실패
// HASH_MISMATCH: 무결성 검증 실패 (verifyHashChain)
// VALIDATION_FAILED: filter 스키마 오류
```

---

## 5. Agent → Executor

### 5.1 OS 작업 실행 요청

```typescript
// packages/agents/src/{agent}.ts → packages/executor/src/index.ts

/**
 * Executor에게 OS 작업 실행을 요청한다.
 * 계약서 §5: Executor만 OS를 조작할 수 있음 — 다른 에이전트 직접 호출 금지.
 * 모든 요청은 유효한 Capability Token을 포함해야 한다.
 * 실행 전 pre_enforce → 실행 → post_enforce 순서 적용.
 */
async function requestExecution(
  request: ExecutionRequest
): Promise<Result<ExecutionResult, JarvisError>>;

/** OS 작업 실행 요청 (schemas/action-api.json 기준) */
interface ExecutionRequest {
  runId: RunId;
  sessionId: SessionId;
  action: {
    actionId: string;     // act_{seq}
    type: string;         // ActionType (action-api.json 참조)
    params: Record<string, unknown>;
    /** 이 액션에 필요한 Capability Token ID 목록 */
    requiredCapabilityTokenIds: string[];
    riskTags: string[];
    /** 선행 작업 완료 여부 의존성 */
    dependsOn?: string[];
    /** 증거 수집 설정 */
    evidence: {
      captureScreenshot: boolean;
      captureStdout: boolean;
    };
  };
  /** Dry-run 여부 (true면 실제 실행 없이 예상 결과 반환) */
  dryRun?: boolean;
}

/** OS 작업 실행 결과 */
interface ExecutionResult {
  actionId: string;
  status: 'SUCCESS' | 'FAILED' | 'DENIED' | 'DRY_RUN';
  startedAt: string;
  endedAt: string;
  durationMs: number;
  /** 실제 실행 결과 (파일 경로, stdout 등) */
  output?: Record<string, unknown>;
  /** Dry-run 시 예상 결과 */
  dryRunResult?: DryRunResult;
  /** 에러 정보 (status === 'FAILED' || 'DENIED') */
  error?: {
    code: JarvisErrorCode;
    message: string;
  };
  /** 증거 수집 결과 */
  evidence?: {
    screenshotRef?: string;
    stdoutRef?: string;
  };
  /** 롤백 정보 (undo 가능한 경우) */
  undoEntry?: {
    undoType: 'RESTORE_BACKUP' | 'REVERSE_OPERATION' | 'NOT_REVERSIBLE';
    backupRef?: string;
    expiresAt: string;
  };
}

/** Dry-run 예상 결과 (architecture-deep.md §12 참조) */
interface DryRunResult {
  simulated: true;
  wouldAffect: Record<string, unknown>;
  riskAssessment: {
    score: number;
    level: string;
    reasons: string[];
  };
  sideEffects: string[];
}

/** 에러 케이스 */
// TOKEN_INVALID: Capability Token 상태 이상
// TOKEN_EXPIRED: TTL 만료
// TOKEN_SCOPE_MISMATCH: 액션 scope가 토큰 scope를 벗어남
// POLICY_DENIED: pre_enforce에서 거부
// INTERNAL_ERROR: OS 추상화 API 실패
```

---

### 5.2 Enforcement Hook

```typescript
// packages/executor/src/hooks.ts

/**
 * 액션 실행 직전 강제 검사 — pre_enforce Hook.
 * Capability Token 검증, 정책 constraints 검사, Gate 필요 여부 판단.
 * requestExecution 내부에서 자동 호출 (외부 직접 호출 금지).
 */
async function preEnforce(
  action: ExecutionRequest['action'],
  context: EnforcementContext
): Promise<Result<EnforcementDecision, JarvisError>>;

/**
 * 액션 실행 직후 결과 검증 — post_enforce Hook.
 * 이상 징후 탐지 (예상 외 파일 삭제, 외부 전송 등).
 * requestExecution 내부에서 자동 호출 (외부 직접 호출 금지).
 */
async function postEnforce(
  executionResult: ExecutionResult,
  context: EnforcementContext
): Promise<Result<PostEnforceDecision, JarvisError>>;

/** 강제 검사 컨텍스트 */
interface EnforcementContext {
  runId: RunId;
  sessionId: SessionId;
  trustMode: 'observe' | 'suggest' | 'semi-auto' | 'full-auto';
  policyConstraints: PolicyDecision['constraints'];
}

/** pre_enforce 판정 결과 */
interface EnforcementDecision {
  decision: 'ALLOW' | 'DENY' | 'GATE_REQUIRED';
  reason?: string;
  /** GATE_REQUIRED일 때 표시할 Gate 정보 */
  gateInfo?: {
    gateType: string;
    gateLevel: 'L1' | 'L2';
    displayMessage: string;
  };
}

/** post_enforce 판정 결과 */
interface PostEnforceDecision {
  anomalyDetected: boolean;
  anomalyType?: string;
  /** 이상 징후 발견 시 다음 액션 (CONTINUE | ABORT) */
  nextAction: 'CONTINUE' | 'ABORT';
  abortReason?: string;
}

/** 에러 케이스 */
// TOKEN_INVALID / TOKEN_EXPIRED / TOKEN_SCOPE_MISMATCH: 토큰 검증 실패
// POLICY_DENIED: constraints 위반
// INTERNAL_ERROR: Hook 처리 오류
```

---

## API 호출 흐름 요약

```
사용자 → CLI.submitUserRequest()
  ↓
Core(Orchestrator).dispatchAgent(spec-agent)
  ↓
spec-agent → Audit.appendAuditEntry()   (SPEC_ANALYSIS 시작 기록)
spec-agent → Core.reportAgentResult()  (SPEC 완료)
  ↓
Core.dispatchAgent(policy-risk)
  ↓
policy-risk → PolicyEngine.evaluatePolicy()  (정책 판정)
policy-risk → PolicyEngine.issueCapabilityToken()  (토큰 발급)
policy-risk → Audit.appendAuditEntry()  (POLICY_CHECK 결과 기록)
policy-risk → Core.reportAgentResult()
  ↓
  [Gate L1 표시 — 사용자 승인 대기]
  ↓
Core.dispatchAgent(planner) → Core.dispatchAgent(codegen)
  → Core.dispatchAgent(review) → Core.dispatchAgent(test-build)
  ↓ 각 에이전트: Audit.appendAuditEntry() 호출
  ↓
  [Gate L2 표시 — 변경 승인 대기]
  ↓
Core.dispatchAgent(executor)
  ↓
executor → PolicyEngine.validateCapabilityToken()  (액션 직전 검증)
executor → Executor.requestExecution()  (pre_enforce → OS 조작 → post_enforce)
executor → Audit.appendAuditEntry()  (실행 결과 기록)
executor → Core.reportAgentResult()
  ↓
Core.dispatchAgent(rollback)  [실패 시만]
```

---

## 에이전트별 API 사용 권한

| 에이전트 | submitUserRequest | dispatchAgent | evaluatePolicy | issueToken | appendAuditEntry | requestExecution |
|----------|:-:|:-:|:-:|:-:|:-:|:-:|
| orchestrator | X (수신만) | O | X | X | O | X |
| spec-agent | X | X | X | X | O | X |
| policy-risk | X | X | O | O | O | X |
| planner | X | X | X | X | O | X |
| codegen | X | X | X | X | O | X |
| review | X | X | X | X | O | X |
| test-build | X | X | X | X | O | X |
| executor | X | X | X | X | O | O |
| rollback | X | X | X | X | O | O |

> X = 호출 금지 (역할 분리 원칙, 계약서 §5)

---

> version: 1.0.0
> last_updated: 2026-03-02
> 참조: `.claude/design/architecture-deep.md` §7, `.claude/schemas/` 전체, `.claude/contract.md` §3, §5
