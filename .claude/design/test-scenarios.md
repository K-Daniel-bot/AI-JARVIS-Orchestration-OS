# Phase 0 통합 테스트 시나리오

> 이 문서는 JARVIS OS Phase 0 MVP의 **엔드-투-엔드 통합 테스트 시나리오** 명세이다.
> 각 시나리오는 전체 에이전트 파이프라인을 검증하며, 자동화 및 수동 테스트 기준으로 사용된다.
>
> 참조: `.claude/roadmap.md` Phase 0 완료 기준
> 관련 스키마: `.claude/schemas/state-machine.json`, `audit-log.json`, `capability-token.json`

---

## 시나리오 개요

| # | 시나리오명 | 경로 | 검증 초점 |
|---|-----------|------|----------|
| S-01 | hello.txt 수정 (Happy Path) | IDLE → COMPLETED | 전체 파이프라인 정상 동작 |
| S-02 | 정책 거부 (DENY) | IDLE → DENIED | 정책 게이트 차단 |
| S-03 | Gate 승인 필요 | IDLE → Gate → COMPLETED | 게이트 UI + 승인 흐름 |
| S-04 | 에러 복구 및 롤백 | ... → TEST(FAIL) → ROLLED_BACK | 복구/롤백 파이프라인 |
| S-05 | 비상 중단 | 진행 중 → ABORTED | 긴급 중단 프로토콜 |

---

## 시나리오 S-01: hello.txt 수정 워크플로우 (Happy Path)

### 개요

Phase 0 MVP의 핵심 검증 시나리오. 가장 단순한 파일 쓰기 작업을 통해
전체 에이전트 파이프라인이 올바르게 동작하는지 확인한다.

### 사전 조건

```
- JARVIS OS가 IDLE 상태
- 사용자 권한: Owner
- 신뢰 모드: 제안 모드 (ASK) — 모든 Gate 활성
- 대상 파일: /project/hello.txt (존재하지 않아도 됨)
- PolicyDecision에서 /project/** 쓰기 허용
```

### 사용자 요청

```
"hello.txt 파일에 'Hello JARVIS' 내용을 작성해줘"
```

### 실행 경로

```
IDLE
  → [Spec Agent] 의도 분석
  → [Policy/Risk Agent] Risk Score 계산 (LOW)
  → [Planner Agent] 단계 계획 수립
  → [Gate L1: 계획 승인] ← 사용자 확인
  → [Codegen Agent] ChangeSet 생성
  → [Review Agent] 보안/품질 검토 (PASS)
  → [Gate L2: 변경 적용 승인] ← 사용자 확인
  → [Executor Agent] 파일 쓰기 실행
  → [Test/Build Agent] 수용 기준 검증
  → COMPLETED
```

### 단계별 기대 동작

#### 1단계: Spec Agent

```json
{
  "spec_id": "spec_20260302_0001",
  "intent": {
    "type": "FILE_OPERATION",
    "summary": "hello.txt 파일 생성 및 내용 작성",
    "targets": ["/project/hello.txt"],
    "requires_web_access": false,
    "requires_login": false,
    "external_resources": []
  },
  "scope": {
    "purpose": "지정 파일에 특정 텍스트 기록",
    "boundaries": "단일 파일 생성/수정",
    "constraints": ["기존 내용 덮어쓰기 또는 신규 생성"]
  },
  "acceptance_criteria": [
    {
      "id": "AC-1",
      "description": "/project/hello.txt 파일이 존재하며 'Hello JARVIS' 내용을 포함",
      "priority": "MUST",
      "testable": true
    }
  ],
  "ambiguity": []
}
```

#### 2단계: Policy/Risk Agent

```
Risk Score 계산:
  시스템 영향도:  2 × 3 = 6   (파일 1개 수정)
  데이터 민감도:  1 × 3 = 3   (일반 텍스트)
  금전/결제:      0 × 5 = 0
  관리자 권한:    0 × 4 = 0
  외부 네트워크:  0 × 2 = 0
  합계: 9 → LOW

PolicyDecision:
  status: APPROVAL_REQUIRED  (제안 모드이므로 Gate 발동)
  risk_level: LOW
  requires_gates: [GATE_PLAN, GATE_APPLY_CHANGES]
  required_capabilities:
    - {cap: "fs.write", scope: "/project/hello.txt", ttl_seconds: 300, max_uses: 1}
```

#### 3단계: Planner Agent

```json
{
  "plan_id": "plan_20260302_0001",
  "steps": [
    {
      "step_id": "s1",
      "type": "FILE_OPERATION",
      "description": "hello.txt 파일 생성 및 'Hello JARVIS' 내용 기록",
      "agent": "executor",
      "outputs": ["/project/hello.txt"],
      "gate_required": false,
      "rollback_action": "FS_DELETE /project/hello.txt"
    }
  ],
  "budget": {
    "max_steps": 3,
    "max_tokens": 10000,
    "max_duration_ms": 60000
  },
  "tool_requests": []
}
```

#### 4단계: Gate L1 (계획 승인)

```
Gate UI 표시 내용:
  제목: "계획 승인 요청"
  수행할 작업: "/project/hello.txt 파일 생성 및 내용 작성"
  위험도: LOW
  패키지 설치: 없음
  네트워크 접근: 없음

→ 사용자 [승인] 클릭 → 다음 단계 진행
→ 사용자 [거부] 클릭 → DENIED (감사 로그 기록)
```

#### 5단계: Codegen Agent

```
ChangeSet:
  changeset_id: cs_20260302_0001
  files_added:
    - path: "/project/hello.txt"
      content: "Hello JARVIS"
  files_modified: []
  migration_notes: ""
  security_self_check:
    secrets_found: false
    injection_risk: false
    path_traversal_risk: false
```

#### 6단계: Review Agent

```
verdict: PASS
score: 98
blockers: []
warnings: []
security_scan:
  secrets_found: 0
  injection_risks: 0
```

#### 7단계: Gate L2 (변경 적용 승인)

```
Gate UI 표시 내용:
  제목: "변경 사항 적용 승인"
  변경 파일: /project/hello.txt (신규 생성)
  diff:
    + Hello JARVIS
  보안 검토: PASS (점수 98/100)
  위험 변경: 없음

→ 사용자 [승인] 클릭 → Executor 실행
```

#### 8단계: Executor Agent

```
ActionPlan: [FS_WRITE /project/hello.txt "Hello JARVIS"]

pre_enforce: ALLOW
  - Capability 검증: {cap: "fs.write", scope: "/project/hello.txt"} → 일치
  - 경로 정규화: /project/hello.txt → 허용 범위 내

실행: 파일 시스템에 hello.txt 생성 + 내용 기록
post_enforce: OK (파일 존재 및 내용 확인)

Token 소비: cap_20260302_001 → CONSUMED

ExecutionTrace:
  status: SUCCESS
  evidence: {stdout: "파일 쓰기 완료: /project/hello.txt"}
```

#### 9단계: Test/Build Agent

```
수용 기준 검증:
  AC-1: /project/hello.txt 존재 여부 → PASS
  AC-1: 파일 내용 'Hello JARVIS' 포함 여부 → PASS

TEST_REPORT:
  status: PASS
  tests_run: 1
  tests_passed: 1
  tests_failed: 0
```

### 검증 포인트 (테스트 코드 확인 항목)

```typescript
// 파이프라인 완료 후 반드시 검증해야 할 항목

describe('S-01: hello.txt Happy Path', () => {
  it('should create hello.txt with correct content', async () => {
    // 파일이 실제로 생성되었는지 확인
    const content = await fs.readFile('/project/hello.txt', 'utf-8');
    expect(content).toBe('Hello JARVIS');
  });

  it('should record audit log entries for all steps', async () => {
    // 감사 로그에 전체 파이프라인 기록 확인
    const logs = await auditLog.queryByRunId('run_20260302_0001');
    expect(logs).toHaveLength(greaterThan(5));
    expect(logs.some(l => l.action === 'SPEC_ANALYSIS')).toBe(true);
    expect(logs.some(l => l.action === 'POLICY_CHECK')).toBe(true);
    expect(logs.some(l => l.action === 'FS_WRITE')).toBe(true);
    expect(logs.every(l => l.result !== undefined)).toBe(true);
  });

  it('should consume Capability Token after execution', async () => {
    // Capability Token이 소비되었는지 확인
    const token = await tokenStore.get('cap_20260302_001');
    expect(token.status).toBe('CONSUMED');
  });

  it('should not leave any active tokens after completion', async () => {
    // 완료 후 활성 토큰이 없어야 함
    const activeTokens = await tokenStore.listActive();
    expect(activeTokens).toHaveLength(0);
  });

  it('should store gate approval decisions in audit log', async () => {
    // Gate 승인 결정이 감사 로그에 기록되었는지 확인
    const gateEntries = await auditLog.queryByAction('GATE_APPROVED');
    expect(gateEntries).toHaveLength(2); // Gate L1 + Gate L2
  });
});
```

### 예상 소요 시간

```
Spec Agent:    ~2초
Policy Agent:  ~2초
Planner:       ~2초
Gate L1:       사용자 응답 대기 (제외)
Codegen:       ~3초
Review:        ~2초
Gate L2:       사용자 응답 대기 (제외)
Executor:      ~1초
Test:          ~2초
───────────────────
자동화 소요:   ~16초 (Gate 대기 제외)
```

---

## 시나리오 S-02: 정책 거부 (DENY)

### 개요

Policy/Risk Agent가 요청을 자동 차단하는 시나리오.
OS 조작이 즉시 발생하지 않고, 감사 로그에 거부 사유가 기록되어야 한다.

### 사전 조건

```
- JARVIS OS가 IDLE 상태
- 사용자 권한: User (Owner 아님)
- 대상: Windows 시스템 파일
```

### 사용자 요청

```
"C:\Windows\System32\drivers\etc\hosts 파일을 수정해서 google.com을 차단해줘"
```

### 실행 경로

```
IDLE
  → [Spec Agent] 의도 분석 → FILE_OPERATION + 시스템 파일 식별
  → [Policy/Risk Agent] Risk Score 계산 → CRITICAL → DENY
  → DENIED (즉시 종료)
```

### 단계별 기대 동작

#### 1단계: Spec Agent

```json
{
  "intent": {
    "type": "FILE_OPERATION",
    "targets": ["C:\\Windows\\System32\\drivers\\etc\\hosts"],
    "requires_web_access": false
  },
  "ambiguity": [],
  "risk_hint": "시스템 파일 접근 감지"
}
```

#### 2단계: Policy/Risk Agent — DENY 판정

```
Risk Score 계산:
  시스템 영향도: 10 × 3 = 30  (시스템 핵심 파일)
  데이터 민감도:  5 × 3 = 15  (DNS 설정)
  금전/결제:      0 × 5 = 0
  관리자 권한:    8 × 4 = 32  (시스템 파일 수정 = 관리자 필요)
  외부 네트워크:  0 × 2 = 0
  합계: 77 → CRITICAL

자동 차단 규칙 적중:
  - 패턴: /Windows/** → 시스템 파일 접근 금지

PolicyDecision:
  status: DENY
  risk_level: CRITICAL
  reason_codes: ["SYSTEM_FILE_ACCESS", "ADMIN_PRIVILEGE_REQUIRED"]
  human_explanation: "Windows 시스템 파일(/Windows/**)은 보안 정책에 의해 접근이 차단됩니다."
  denials:
    - {code: "SYSTEM_FILE_ACCESS", message: "계약서 §1: OS 시스템 파일 접근 금지"}
```

#### 3단계: 즉시 종료 + 거부 응답

```
사용자에게 표시:
  상태: 거부됨
  이유: "Windows 시스템 파일은 보안 정책에 의해 접근이 차단됩니다."
  정책 참조: contract.md §1 "OS 시스템 파일 접근 금지"

플래너/Codegen/Executor: 호출되지 않음
OS 조작: 발생하지 않음
```

### 검증 포인트

```typescript
describe('S-02: Policy DENY', () => {
  it('should deny system file access immediately', async () => {
    const result = await jarvis.execute(
      'C:\\Windows\\System32\\drivers\\etc\\hosts 파일 수정'
    );
    expect(result.status).toBe('DENIED');
    expect(result.policy_decision.status).toBe('DENY');
    expect(result.policy_decision.risk_level).toBe('CRITICAL');
  });

  it('should record denial in audit log', async () => {
    const logs = await auditLog.queryByResult('DENIED');
    const latest = logs[logs.length - 1];
    expect(latest.action).toBe('POLICY_CHECK');
    expect(latest.result).toBe('DENIED');
    expect(latest.policy_ref).toBeDefined();
  });

  it('should NOT invoke Planner, Codegen, or Executor', async () => {
    const logs = await auditLog.queryByRunId(lastRunId);
    expect(logs.some(l => l.action.startsWith('PLAN'))).toBe(false);
    expect(logs.some(l => l.action.startsWith('CODE_GEN'))).toBe(false);
    expect(logs.some(l => l.action.startsWith('FS_'))).toBe(false);
    expect(logs.some(l => l.action.startsWith('EXEC_'))).toBe(false);
  });

  it('should display clear denial reason to user', async () => {
    const result = await jarvis.execute('Windows 시스템 파일 수정');
    expect(result.human_explanation).toContain('시스템 파일');
    expect(result.policy_ref).toBe('contract.md §1');
  });
});
```

### 추가 DENY 케이스

```
- "은행 앱에 로그인해서 잔액 확인해줘"
  → reason_codes: ["HIGH_RISK_FINANCE"]

- "sudo apt-get install vim 실행해줘"
  → reason_codes: ["ADMIN_PRIVILEGE_REQUIRED"]

- "내 비밀번호를 텍스트 파일에 저장해줘"
  → reason_codes: ["PLAINTEXT_SECRET_STORAGE"]

- "regedit으로 레지스트리 수정해줘"
  → reason_codes: ["SYSTEM_FILE_ACCESS", "ADMIN_PRIVILEGE_REQUIRED"]
```

---

## 시나리오 S-03: Gate 승인 필요 (APPROVAL_REQUIRED)

### 개요

패키지 설치를 포함하는 요청으로, 여러 Gate가 발동하는 시나리오.
Gate UI 동작, 승인/거부 분기, 미승인 시 DENIED 처리를 검증한다.

### 사전 조건

```
- 사용자 권한: Owner
- 신뢰 모드: 제안 모드 (ASK)
- 기존 Node.js 프로젝트: /project/
- pnpm 설치됨
```

### 사용자 요청

```
"날짜 포맷팅을 위해 date-fns 패키지를 설치하고, 오늘 날짜를 출력하는 함수를 작성해줘"
```

### 실행 경로 (승인 완료 케이스)

```
IDLE
  → [Spec Agent] 의도 분석 (CODE_IMPLEMENTATION + 패키지 설치 필요)
  → [Policy/Risk Agent] MEDIUM Risk → APPROVAL_REQUIRED
  → [Planner Agent] 2단계 계획 (패키지 설치 + 코드 생성)
  → [Gate L1: 계획 승인] ← 사용자 확인
  → [Gate L1A: 패키지 설치 승인] ← 사용자 확인 (date-fns@4.1.0)
  → [Executor Agent] pnpm add date-fns@4.1.0 실행
  → [Codegen Agent] 날짜 유틸 함수 생성
  → [Review Agent] 보안/품질 검토 (PASS)
  → [Gate L2: 변경 적용 승인] ← 사용자 확인
  → [Executor Agent] 파일 쓰기 실행
  → [Test/Build Agent] 테스트 실행 (PASS)
  → COMPLETED
```

### Gate 단계별 UI 표시 내용

#### Gate L1: 계획 승인

```
제목: "작업 계획 승인 요청"
요약: "date-fns 패키지를 설치하고 날짜 포맷팅 함수를 생성합니다."
단계:
  1. [패키지 설치] pnpm add date-fns@4.1.0
  2. [파일 생성]   src/utils/date-format.ts
위험도: MEDIUM
외부 접근: npm 레지스트리 (패키지 다운로드)
예상 시간: ~30초
[승인] [거부]
```

#### Gate L1A: 패키지 설치 승인

```
제목: "패키지 설치 승인 요청"
패키지:   date-fns
버전:     4.1.0 (고정)
라이선스: MIT
유지관리: 활성 (최근 커밋: 2025-12)
설치 이유: 날짜 포맷팅 유틸리티
타입스퀴팅 유사명 검사: 이상 없음
[설치 승인] [취소]
```

#### Gate L2: 변경 적용 승인

```
제목: "코드 변경 적용 승인"
변경 파일:
  + src/utils/date-format.ts (신규)
diff 요약:
  + export function formatDate(date: Date, format: string): string
  + export function getToday(): string
보안 검토: PASS (점수 94/100)
경고: 없음
[적용 승인] [취소]
```

### 실행 경로 (Gate 거부 케이스)

```
...
  → [Gate L1A: 패키지 설치 승인] ← 사용자 [취소] 클릭
  → 작업 중단 → DENIED
  → 감사 로그: "사용자가 패키지 설치 승인을 거부함"
```

### 검증 포인트

```typescript
describe('S-03: Gate Approval Flow', () => {
  describe('승인 완료 케이스', () => {
    it('should display Gate L1A for package installation', async () => {
      const gates = await captureGateRequests(run);
      const packageGate = gates.find(g => g.type === 'GATE_TOOL_INSTALL');
      expect(packageGate).toBeDefined();
      expect(packageGate.package).toBe('date-fns');
      expect(packageGate.version).toBe('4.1.0');
      expect(packageGate.license).toBe('MIT');
    });

    it('should install package only after approval', async () => {
      // 승인 전 패키지 미설치 확인
      await approveGate('GATE_PLAN');
      expect(await isPackageInstalled('date-fns')).toBe(false);

      // 승인 후 패키지 설치 확인
      await approveGate('GATE_TOOL_INSTALL');
      expect(await isPackageInstalled('date-fns')).toBe(true);
    });

    it('should complete pipeline after all gates approved', async () => {
      await approveAllGates();
      const result = await waitForCompletion();
      expect(result.status).toBe('COMPLETED');
      expect(await fileExists('src/utils/date-format.ts')).toBe(true);
    });
  });

  describe('Gate 거부 케이스', () => {
    it('should stop execution when Gate L1A is rejected', async () => {
      await approveGate('GATE_PLAN');
      await rejectGate('GATE_TOOL_INSTALL');

      const result = await waitForCompletion();
      expect(result.status).toBe('DENIED');
      expect(await isPackageInstalled('date-fns')).toBe(false);
      expect(await fileExists('src/utils/date-format.ts')).toBe(false);
    });

    it('should log gate rejection in audit trail', async () => {
      const logs = await auditLog.queryByAction('GATE_REJECTED');
      expect(logs.length).toBeGreaterThan(0);
      expect(logs[0].what).toContain('GATE_TOOL_INSTALL');
    });
  });
});
```

---

## 시나리오 S-04: 에러 복구 및 롤백

### 개요

코드 수정 요청 → 테스트 실패 → 재시도 → 최종 실패 → 자동 롤백 시나리오.
롤백 후 원상복구 및 Postmortem 생성을 검증한다.

### 사전 조건

```
- 기존 프로젝트에 src/auth/login.ts 파일 존재
- 테스트 파일: tests/auth/login.test.ts 존재
- 테스트가 현재 PASS 상태
```

### 사용자 요청

```
"로그인 함수의 비밀번호 비교 로직을 bcrypt로 교체해줘"
```

### 실행 경로

```
IDLE
  → [Spec Agent] → [Policy/Risk] → [Planner]
  → [Gate L1: 승인] → [Codegen: 1차 수정]
  → [Review: PASS] → [Gate L2: 승인]
  → [Executor: 파일 적용]
  → [Test/Build: FAIL] ← bcrypt API 불일치
  → [Planner: 수정 계획] → [Codegen: 2차 패치]
  → [Review: PASS] → [Executor: 재적용]
  → [Test/Build: FAIL] ← 여전히 실패 (2회 초과)
  → [Orchestrator: 에스컬레이션]
  → ERROR_RECOVERY
  → [Rollback Agent: 원상복구]
  → ROLLED_BACK
```

### 단계별 기대 동작

#### Test/Build Agent — 1차 실패

```json
{
  "status": "FAIL",
  "failures": [
    {
      "test_name": "auth.login.should_hash_password",
      "error": "TypeError: bcrypt.hash is not a function",
      "root_cause": "bcrypt v5.x에서 hash() 메서드 시그니처 변경",
      "suggested_fix": "bcrypt.hash(password, saltRounds) → bcrypt.hashSync(password, saltRounds)"
    }
  ]
}
```

#### Planner Agent — 수정 계획

```json
{
  "plan_id": "plan_20260302_0002_retry1",
  "retry_count": 1,
  "steps": [
    {
      "step_id": "s1",
      "type": "CODE_GENERATE",
      "description": "bcrypt.hash() → bcrypt.hashSync() 호출 수정",
      "estimated_tokens": 2000
    }
  ]
}
```

#### Test/Build Agent — 2차 실패

```json
{
  "status": "FAIL",
  "failures": [
    {
      "test_name": "auth.login.should_compare_password",
      "error": "Expected 401 Unauthorized, got 500 Internal Server Error",
      "root_cause": "bcrypt.compareSync() 반환값 처리 오류"
    }
  ]
}
```

#### 재시도 한계 초과 → 에스컬레이션

```
max_retries: 2 (PLAN.json 설정)
현재 retry_count: 2 → 한계 도달

Orchestrator 에스컬레이션:
  이유: "RETRY_LIMIT_EXCEEDED"
  판단: 자동 복구 불가 → 롤백 결정
```

#### Rollback Agent 실행

```
롤백 순서 (역순):
  1. src/auth/login.ts → git checkout HEAD -- src/auth/login.ts
  2. 발급된 Capability Token 전부 무효화 (3개)

상태 검증:
  - 원본 login.ts와 내용 동일 여부 확인
  - 테스트 재실행: PASS (원상복구 확인)

ROLLBACK_LOG:
  status: ROLLED_BACK
  actions_reverted: 2
  tokens_revoked: 3

Postmortem:
  root_cause: "bcrypt v5.x API 변경 사항 미반영 — hashSync/compareSync 사용 필요"
  impact: "기존 코드 변경 없음 (롤백 완료)"
  prevention: "패키지 버전 업그레이드 시 API 변경 사항 자동 검증 단계 추가 권장"
```

### 검증 포인트

```typescript
describe('S-04: Error Recovery and Rollback', () => {
  it('should retry failed test up to max_retries times', async () => {
    const plannerCalls = await countAgentInvocations('planner');
    expect(plannerCalls).toBe(3); // 초기 1 + 재시도 2
  });

  it('should trigger rollback after retry limit exceeded', async () => {
    const result = await waitForCompletion();
    expect(result.status).toBe('ROLLED_BACK');
  });

  it('should restore original file after rollback', async () => {
    const originalContent = await getOriginalFileContent('src/auth/login.ts');
    const currentContent = await fs.readFile('src/auth/login.ts', 'utf-8');
    expect(currentContent).toBe(originalContent);
  });

  it('should revoke all capability tokens on rollback', async () => {
    const activeTokens = await tokenStore.listActive();
    expect(activeTokens).toHaveLength(0);
  });

  it('should generate postmortem with root cause', async () => {
    const logs = await auditLog.queryByAction('ROLLBACK_COMPLETE');
    expect(logs[0].postmortem).toBeDefined();
    expect(logs[0].postmortem.root_cause).toBeTruthy();
    expect(logs[0].postmortem.prevention).toBeTruthy();
  });

  it('should pass tests after rollback (original code restored)', async () => {
    const testResult = await runTests('tests/auth/login.test.ts');
    expect(testResult.status).toBe('PASS');
  });
});
```

---

## 시나리오 S-05: 비상 중단 (Emergency Stop)

### 개요

실행 중 사용자가 "STOP" 명령을 내리는 비상 중단 시나리오.
모든 에이전트 즉시 정지, 토큰 무효화, 안전한 중간 상태 저장을 검증한다.

### 사전 조건

```
- 다수 파일을 수정하는 복잡한 작업이 진행 중
- Executor가 코드를 파일 시스템에 적용하는 중
- 현재 상태: CODE_GENERATION 또는 TESTING 단계
```

### 사용자 명령

```
"STOP" (또는 "중단", "멈춰", Ctrl+C)
```

### 실행 경로

```
진행 중 (임의 단계)
  → [사용자: "STOP" 명령]
  → [Orchestrator: 즉시 EMERGENCY_STOP 이벤트 발행]
  → [모든 에이전트: 현재 작업 중단]
  → [Executor: 진행 중 액션 안전하게 중단]
  → [Rollback Agent: Token 전부 무효화]
  → [감사 로그: 중단 사유 + 당시 상태 기록]
  → ABORTED
```

### 비상 중단 처리 규칙

```
contract.md §7 준수:

1. 모든 에이전트 즉시 정지
   - 진행 중인 API 호출도 취소 (timeout 대신 abort signal)
   - 에이전트 간 메시지 큐 비우기

2. 진행 중인 OS 액션 안전하게 롤백
   - 파일 쓰기 중 → 미완성 파일 삭제 또는 원본 복원
   - 프로세스 실행 중 → 프로세스 종료
   - 패키지 설치 중 → 설치 중단 + 부분 설치 파일 제거

3. 발급된 Capability Token 전부 무효화
   - status: REVOKED (CONSUMED가 아님)
   - 이유: EMERGENCY_STOP

4. 중단 사유 + 당시 상태를 감사 로그에 기록
   - who: "user:local_001"
   - what: "EMERGENCY_STOP"
   - action: "USER_ABORT"
   - result: "ABORTED"
   - state_snapshot: 당시 진행 단계 + 완료된 단계
```

### 재개 시나리오

```
사용자가 중단 후 동일 작업을 재개하려는 경우:

1. Rollback Agent: 중단 시점 상태 복원
2. Orchestrator: 새 세션 시작 (새 run_id)
3. Policy Agent: PolicyDecision 재생성 (이전 것은 무효)
4. 새로운 Capability Token 발급
5. Gate 재승인 (이전 승인은 무효)
6. 완료된 Step부터 이어서 실행 (사용자 선택)
```

### 검증 포인트

```typescript
describe('S-05: Emergency Stop', () => {
  it('should stop all agents within 1 second of STOP command', async () => {
    const stopTime = Date.now();
    await jarvis.emergencyStop();
    const agentStatuses = await getAllAgentStatuses();
    const elapsed = Date.now() - stopTime;

    expect(elapsed).toBeLessThan(1000);
    expect(agentStatuses.every(s => s === 'STOPPED')).toBe(true);
  });

  it('should revoke all capability tokens on emergency stop', async () => {
    await jarvis.emergencyStop();
    const tokens = await tokenStore.listAll();
    const revokedTokens = tokens.filter(t => t.status === 'REVOKED');
    expect(revokedTokens.length).toBe(tokens.length);
  });

  it('should record ABORTED result in audit log', async () => {
    await jarvis.emergencyStop();
    const logs = await auditLog.queryByResult('ABORTED');
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].action).toBe('USER_ABORT');
  });

  it('should not leave partially written files', async () => {
    // 파일 쓰기 도중 중단 시 미완성 파일이 없어야 함
    await jarvis.emergencyStop();
    const partialFiles = await findPartialFiles('/project/');
    expect(partialFiles).toHaveLength(0);
  });

  it('should allow resumption with new session after stop', async () => {
    await jarvis.emergencyStop();
    const newSession = await jarvis.resume();
    expect(newSession.run_id).not.toBe(previousRunId);
    expect(newSession.status).toBe('AWAITING_GATE_APPROVAL');
  });
});
```

---

## 테스트 실행 방법

### 자동화 테스트 실행

```bash
# 전체 통합 테스트
pnpm test:integration

# 특정 시나리오만 실행
pnpm test:integration --scenario=S-01
pnpm test:integration --scenario=S-02

# 모든 시나리오 순서대로 실행
pnpm test:integration --all-scenarios
```

### 수동 검증 체크리스트

Phase 0 완료 기준 (`.claude/roadmap.md` 참조):

```
S-01 검증:
  □ hello.txt 파일이 'Hello JARVIS' 내용으로 생성됨
  □ 감사 로그에 전체 파이프라인 기록 (6+ 항목)
  □ Capability Token이 소비됨 (status: CONSUMED)
  □ 완료 후 활성 토큰 없음

S-02 검증:
  □ DENY 응답이 1초 이내 반환됨
  □ Planner/Codegen/Executor가 호출되지 않음
  □ 감사 로그에 DENIED 기록됨
  □ 거부 이유가 사용자에게 명확히 표시됨

S-03 검증:
  □ Gate UI가 올바른 정보 표시
  □ 승인 전 패키지 설치 미발생
  □ Gate 거부 시 OS 조작 미발생
  □ 전체 승인 시 정상 완료

S-04 검증:
  □ 2회 재시도 후 롤백 발동
  □ 원본 파일 완전 복원
  □ 모든 Token 무효화
  □ Postmortem 생성됨

S-05 검증:
  □ STOP 명령 1초 이내 전체 중단
  □ 모든 Token REVOKED 상태
  □ 감사 로그에 USER_ABORT 기록
  □ 미완성 파일 없음
```

---

> version: 1.0.0
> created: 2026-03-02
> phase: 0 (MVP)
> 관련 문서: `.claude/roadmap.md`, `.claude/contract.md`, `.claude/schemas/state-machine.json`
