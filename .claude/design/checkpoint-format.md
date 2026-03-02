# JARVIS OS — 체크포인트 파일 형식 정의

> 이 문서는 실행 상태 저장 및 재개(Resume) 기능의 파일 형식 규격을 정의합니다.
> 체크포인트는 에이전트 파이프라인의 어느 시점에서든 중단 후 정확히 이어서 실행할 수 있도록 합니다.
> 참조: `.claude/design/architecture-deep.md` §10

---

## 1. 체크포인트 저장 시점

다음 이벤트 발생 시 즉시 체크포인트를 저장한다 (architecture-deep.md §10.1):

| 시점 | 체크포인트 이름 패턴 | 설명 |
|------|-------------------|------|
| SPEC 완료 | `cp_{seq}_spec_drafted` | Spec Agent 산출물 확정 |
| POLICY 결정 | `cp_{seq}_policy_decided` | PolicyDecision 확정 |
| Gate L1 승인/거부 | `cp_{seq}_gate1_{approved\|rejected}` | 계획 승인 Gate |
| Gate L2 승인/거부 | `cp_{seq}_gate2_{approved\|rejected}` | 변경 승인 Gate |
| Gate L3 승인/거부 | `cp_{seq}_gate3_{approved\|rejected}` | 실행/배포 승인 Gate |
| 파일 변경 적용 직후 | `cp_{seq}_changes_applied` | ChangeSet 적용 완료 |
| 테스트 완료 | `cp_{seq}_tests_passed` | 테스트 통과 확인 |
| 주기 저장 (30초) | `cp_{seq}_periodic` | 중간 상태 보존 |

---

## 2. CheckpointState 타입 정의

```typescript
// 체크포인트 파일의 최상위 구조 — 모든 실행 상태를 담는다
interface CheckpointState {
  // 체크포인트 고유 식별자
  // 형식: cp_{4자리 순번}_{상태 설명}
  // 예시: cp_001_spec_drafted, cp_003_gate1_approved
  checkpointId: string;

  // 이 체크포인트가 속한 Run ID
  runId: RunId;

  // 세션 ID (재개 시 TTL 만료 여부 확인에 사용)
  sessionId: SessionId;

  // 체크포인트 저장 시각 (ISO 8601, 시간대 포함)
  savedAt: string;

  // XState 상태 머신 스냅샷
  machineState: MachineSnapshot;

  // 저장 시점에 활성 상태였던 에이전트 목록
  activeAgents: AgentSnapshot[];

  // 사용자 승인을 기다리는 Gate 목록
  pendingGates: PendingGateEntry[];

  // 아직 유효한 Capability Token 목록
  activeCapabilities: CapabilitySnapshot[];

  // Environment Bundle 파일 경로 참조
  environmentBundle: EnvironmentBundleRefs;

  // 토큰 예산 현황
  tokenBudget: TokenBudget;

  // 이번 Run에서 실행된 액션 히스토리 (롤백 기반)
  executedActions: ExecutedActionEntry[];

  // 체크포인트 파일 자체의 무결성 해시 (SHA-256)
  // 파일 로드 시 재계산하여 변조 여부 확인
  integrityHash: string;
}
```

---

## 3. MachineSnapshot — XState 상태 머신 스냅샷

```typescript
// XState v5 상태 머신의 현재 상태를 직렬화한 구조
interface MachineSnapshot {
  // XState 상태 노드 이름
  // 예: 'IDLE', 'SPEC_ANALYSIS', 'POLICY_CHECK', 'PLANNING',
  //     'GATE_PLAN_APPROVAL', 'CODE_GENERATION', 'CODE_REVIEW',
  //     'GATE_CHANGESET_APPROVAL', 'TESTING', 'DEPLOYMENT',
  //     'GATE_EXECUTION_APPROVAL', 'COMPLETED', 'ERROR_RECOVERY',
  //     'ROLLED_BACK', 'EMERGENCY_STOP'
  currentState: string;

  // XState Context 전체 — 실행 재개에 필요한 모든 데이터
  context: JarvisMachineContext;

  // 이 스냅샷 직전에 발생한 마지막 XState 이벤트 이름
  // null이면 초기 상태
  lastEvent: string | null;
}
```

---

## 4. JarvisMachineContext — XState Context

```typescript
// XState 상태 머신의 Context — 모든 실행 상태를 담는 단일 소스
interface JarvisMachineContext {
  // ── 식별자 ──────────────────────────────────────────────────
  runId: RunId;
  sessionId: SessionId;

  // 작업을 요청한 사용자 ID
  userId: string;

  // 사용자 역할 (권한 범위 결정)
  userRole: 'Owner' | 'Admin' | 'User' | 'Guest';

  // 신뢰 모드 (contract.md §4)
  // observe: 관찰만, suggest: Gate 필수, semi-auto: 반자동, full-auto: 완전자율
  trustMode: 'observe' | 'suggest' | 'semi-auto' | 'full-auto';

  // ── 현재 에이전트 ────────────────────────────────────────────
  // 현재 활성 에이전트 ID. null이면 에이전트 간 전환 중
  currentAgent: AgentId | null;

  // ── 에이전트 산출물 참조 ─────────────────────────────────────
  // 대용량 산출물은 인라인 저장 금지 — 반드시 파일 경로만 참조한다

  // SPEC.md 파일 경로 (Spec Agent 산출물)
  specRef: string | null;

  // PLAN.json 파일 경로 (Planner 산출물)
  planRef: string | null;

  // PolicyDecision 전체 객체 (크기 작음 — 인라인 허용)
  policyDecision: PolicyDecision | null;

  // CHANGES.json 파일 경로 (Codegen 산출물 — 대용량 가능)
  changeSetRef: string | null;

  // ReviewResult 요약 (전체 리뷰 리포트는 별도 파일 참조)
  reviewResult: ReviewResultSummary | null;

  // TestResult 요약 (전체 테스트 로그는 별도 파일 참조)
  testResult: TestResultSummary | null;

  // ── 위험도 ───────────────────────────────────────────────────
  // 5차원 Risk Score (0~100)
  riskScore: number;

  // 위험 레벨 분류
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

  // ── Capability ───────────────────────────────────────────────
  // 현재 활성 Capability Token ID 목록 (상세는 activeCapabilities 참조)
  capabilities: string[];

  // ── 실행 추적 ────────────────────────────────────────────────
  // 상태 전이 기록 (UI Timeline 표시용)
  timeline: TimelineEntry[];

  // ── 토큰 예산 ────────────────────────────────────────────────
  tokenBudget: TokenBudget;

  // ── 에러 추적 ────────────────────────────────────────────────
  // 현재 단계의 재시도 횟수
  retryCount: number;

  // 최대 재시도 횟수. 기본값: 3
  maxRetries: number;

  // 가장 최근에 발생한 에러 (없으면 null)
  lastError: JarvisError | null;

  // 무한 루프 탐지 카운터
  // architecture-deep.md §6.6: max_loop 5 초과 시 자동 중단
  loopCounter: number;
}

// 상태 전이 기록 항목 (Timeline UI 표시용)
interface TimelineEntry {
  // 진입한 XState 상태명
  state: string;

  // 이 상태에 진입한 시각
  enteredAt: string;

  // 이 상태를 떠난 시각 (아직 진행 중이면 null)
  exitedAt: string | null;

  // 이 상태에서 실행된 에이전트 ID
  agentId: AgentId | null;

  // 사용자에게 표시할 상태 설명
  description: string;
}

// 토큰 예산 타입
interface TokenBudget {
  // 이번 Run에서 사용한 총 토큰 수
  used: number;

  // 이번 Run의 최대 토큰 한도 (BUDGET.json에서 로드)
  limit: number;
}

// PolicyDecision 요약 타입 (상세 스키마: schemas/policy-decision.json 참조)
interface PolicyDecision {
  policyDecisionId: string;
  outcome: 'ALLOW' | 'DENY' | 'GATE_REQUIRED';
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  decidedAt: string;
}

// ReviewResult 요약 타입 (전체 리포트는 파일 참조)
interface ReviewResultSummary {
  reviewId: string;
  passed: boolean;
  securityIssues: number;
  qualityIssues: number;
  completedAt: string;
  reportRef: string;  // 전체 리포트 파일 경로
}

// TestResult 요약 타입 (전체 로그는 파일 참조)
interface TestResultSummary {
  testRunId: string;
  passed: boolean;
  totalTests: number;
  failedTests: number;
  completedAt: string;
  logRef: string;  // 전체 테스트 로그 파일 경로
}
```

---

## 5. AgentSnapshot — 에이전트 상태 스냅샷

```typescript
// 체크포인트 저장 시점의 각 에이전트 진행 상태
interface AgentSnapshot {
  // 에이전트 ID
  agentId: AgentId;

  // 저장 시점의 건강 상태
  status: 'HEALTHY' | 'DEGRADED' | 'UNRESPONSIVE' | 'CRASHED';

  // 에이전트가 수행 중이던 Task ID (없으면 null)
  currentTaskId: string | null;

  // 작업 진행률 (0~100). 알 수 없으면 null
  progress: number | null;

  // 저장 시점까지 이 에이전트가 사용한 토큰 수
  tokensUsed: number;
}
```

---

## 6. PendingGateEntry — 승인 대기 Gate 항목

```typescript
// 사용자 응답을 아직 받지 못한 Gate 정보
// 재개 시 UI에 다시 표시하여 사용자 결정을 받는다
interface PendingGateEntry {
  // Gate 종류
  gateType: 'PLAN_APPROVAL' | 'CHANGESET_APPROVAL' | 'EXECUTION_APPROVAL' | 'CAPABILITY_APPROVAL';

  // Gate 레벨
  gateLevel: 'L1' | 'L2' | 'L3';

  // Gate 요청 시각
  requestedAt: string;

  // Gate 만료 시각 (재개 시 이미 만료됐으면 새 Gate 생성)
  expiresAt: string;

  // 사용자에게 표시할 제목 (GateApprovalCard 표시용)
  displayTitle: string;

  // 요청 배경 설명
  rationale: string;

  // 연관 산출물 경로 (사용자 검토용)
  artifactRef: string | null;

  // 위험 정보
  riskInfo: {
    score: number;
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reasons: string[];
  };
}
```

---

## 7. CapabilitySnapshot — Capability Token 상태 스냅샷

```typescript
// 체크포인트 저장 시점의 유효한 Capability Token 상태
// 재개 시 만료 여부를 다시 계산하여 처리한다
interface CapabilitySnapshot {
  // Capability Token 고유 ID
  tokenId: string;

  // 부여된 Capability 종류 (예: 'fs.write', 'exec.run', 'mobile.call')
  cap: string;

  // 허용 범위 (경로, 도메인, 전화번호 패턴 등)
  scope: string | string[];

  // 체크포인트 저장 시점의 남은 TTL (초)
  // 재개 시 실제 남은 TTL = remainingTtlSeconds - (재개 시각 - savedAt 초)
  remainingTtlSeconds: number;

  // 남은 사용 가능 횟수 (1회성 토큰은 항상 1)
  remainingUses: number;

  // 토큰 발급 원본 시각 (만료 재계산용)
  issuedAt: string;
}
```

---

## 8. EnvironmentBundleRefs — Environment Bundle 참조

```typescript
// Orchestrator가 생성한 Environment Bundle 파일들의 경로 참조
// 재개 시 이 경로에서 파일을 로드하여 에이전트에 제공한다
// architecture-deep.md §4 참조
interface EnvironmentBundleRefs {
  // SPEC.md 경로 (없으면 null — Spec 단계 이전 재개)
  specPath: string | null;

  // PLAN.json 경로 (없으면 null — Planning 단계 이전 재개)
  planPath: string | null;

  // POLICY.json 경로 (없으면 null — Policy 단계 이전 재개)
  policyPath: string | null;

  // BUDGET.json 경로 (항상 존재 — Orchestrator가 최초에 생성)
  budgetPath: string;

  // TASK_GRAPH.json 경로 (없으면 null)
  taskGraphPath: string | null;

  // MODEL_ASSIGNMENT.json 경로 (없으면 null)
  modelAssignmentPath: string | null;
}
```

---

## 9. ExecutedActionEntry — 실행된 액션 히스토리

```typescript
// 이번 Run에서 Executor가 실행한 OS 액션 기록
// Rollback Agent가 되돌리기 수행 시 이 목록을 역순으로 처리한다
interface ExecutedActionEntry {
  // 액션 고유 ID
  actionId: string;

  // 액션 종류 (Action API 타입)
  // 예: 'FS_WRITE', 'FS_DELETE', 'EXEC_RUN', 'APP_LAUNCH', 'PKG_INSTALL'
  type: string;

  // 실행 결과
  status: 'SUCCESS' | 'FAILED';

  // 실행 시각
  executedAt: string;

  // 되돌리기 정보 (architecture-deep.md §15.2 UndoEntry)
  // null이면 되돌리기 불가 (FS_DELETE hard, BROWSER_* 등)
  undoEntry: UndoEntry | null;
}

// 되돌리기 항목 구조 (architecture-deep.md §15.2)
interface UndoEntry {
  action_id: string;
  type: string;
  undo_type: 'RESTORE_BACKUP' | 'REVERSE_OPERATION' | 'NOT_REVERSIBLE';
  backup_ref: string | null;  // 백업 파일 경로 (RESTORE_BACKUP인 경우)
  reversible: boolean;
  expires_at: string;         // 백업 보존 기한 (기본 7일)
}
```

---

## 10. 저장/로드 함수 시그니처

```typescript
// 체크포인트 저장 — 성공 시 저장된 파일 경로를 반환한다
// JSON.stringify 전 순환 참조 감지 및 대용량 산출물 경로 분리 처리를 수행한다
async function saveCheckpoint(
  state: CheckpointState
): Promise<Result<string, JarvisError>>;

// 특정 ID의 체크포인트를 로드한다
// 로드 후 integrityHash 재계산으로 파일 변조 여부를 검증한다
async function loadCheckpoint(
  checkpointId: string
): Promise<Result<CheckpointState, JarvisError>>;

// 특정 Run의 가장 최근 체크포인트를 로드한다
// Run 기록이 없거나 체크포인트가 없으면 null을 반환한다
async function loadLatestCheckpoint(
  runId: RunId
): Promise<Result<CheckpointState | null, JarvisError>>;

// 특정 Run의 모든 체크포인트 목록을 요약 형태로 반환한다
// 타임라인 UI 및 재개 지점 선택 화면에 사용한다
async function listCheckpoints(
  runId: RunId
): Promise<Result<CheckpointSummary[], JarvisError>>;

// 체크포인트 목록 요약 타입
interface CheckpointSummary {
  checkpointId: string;
  savedAt: string;
  currentState: string;
  description: string;       // 사람이 읽기 쉬운 설명 (예: "Gate L1 승인 대기")
  tokenBudgetUsed: number;
}
```

---

## 11. 저장 경로 규칙

```
{runRoot}/
  ├── checkpoints/
  │   ├── cp_001_spec_drafted.json
  │   ├── cp_002_policy_decided.json
  │   ├── cp_003_gate1_approved.json
  │   ├── cp_004_changes_applied.json
  │   ├── cp_005_tests_passed.json
  │   └── cp_latest.json          ← 가장 최근 체크포인트의 복사본
  │                                   (심볼릭 링크는 Windows 호환성 문제로 복사 사용)
  └── resume_manifest.json         ← 재개 시 참조하는 진입점
```

### resume_manifest.json 구조

```json
{
  "runId": "run_20260302_0007",
  "latestCheckpointId": "cp_005_tests_passed",
  "latestCheckpointPath": "/.ai-run/run_20260302_0007/checkpoints/cp_005_tests_passed.json",
  "savedAt": "2026-03-02T09:30:00+09:00",
  "interruptReason": "USER_CLOSED",
  "displayMessage": "이전 세션이 중단되었습니다. 마지막 상태: 테스트 통과 완료"
}
```

### 경로 변수 정의

```
{runRoot} = /.ai-run/{runId}
예시: /.ai-run/run_20260302_0007/checkpoints/cp_001_spec_drafted.json
```

---

## 12. 순환 참조 처리 규칙

```
체크포인트 직렬화 시 순환 참조 처리 절차:

1. JSON.stringify 호출 전 순환 참조 탐지 함수 실행
   탐지 방법: WeakSet으로 방문한 객체 추적

2. 순환 참조 발견 시:
   → 해당 필드를 "[Circular Reference]" 문자열로 대체
   → 감사 로그에 warn 수준으로 기록
   → 저장은 계속 진행 (중단하지 않음)

3. 대용량 산출물 인라인 금지:
   금지 대상: ChangeSet 전체 코드, 리뷰 리포트 전문, 테스트 로그 전문
   처리 방법: 해당 필드를 파일 경로 참조(string)로만 저장
              실제 내용은 별도 파일에 유지

4. 최대 체크포인트 파일 크기: 1MB
   초과 시: 대용량 필드를 추가로 외부 파일로 분리
```

---

## 13. 재개 흐름

```
시스템 시작 / 재개 명령 수신
  │
  ▼
resume_manifest.json 존재 확인
  │
  ├── 파일 없음 → 새 세션 시작 (IDLE 상태)
  │
  └── 파일 있음
        │
        ▼
      loadLatestCheckpoint(runId)
        │
        ├── 실패 (파일 손상, INTERNAL_ERROR) → 새 세션 시작 + 경고 표시
        │
        └── 성공 → CheckpointState 로드
              │
              ▼
            무결성 검증 (integrityHash 재계산 비교)
              │
              ├── 불일치 → HASH_MISMATCH 에러 → 전체 Run 일시 중단 + 보안 알림
              │
              └── 일치
                    │
                    ▼
                  사용자에게 재개 선택 화면 표시
                  "마지막 상태: {description}
                   저장 시각: {savedAt}
                   [이어서 진행] [처음부터 다시] [취소]"
                    │
                    ├── [이어서 진행]
                    │     │
                    │     ▼
                    │   Capability Token 상태 확인
                    │     │
                    │     ├── 만료된 토큰 발견 (remainingTtlSeconds <= 0)
                    │     │     → 해당 Capability 재발급 요청 → 새 Gate 생성
                    │     │
                    │     ├── 유효한 토큰 → 남은 TTL로 계속 사용
                    │     │
                    │     └── sessionId TTL 만료 확인
                    │           만료 → 새 세션 ID 발급 (보안 원칙)
                    │           유효 → 기존 세션 ID 유지
                    │     │
                    │     ▼
                    │   PendingGate 만료 확인
                    │     만료된 Gate → 새 Gate 생성 (사용자 재승인 요청)
                    │     유효한 Gate → UI에 재표시
                    │     │
                    │     ▼
                    │   XState 상태 머신 복원
                    │   (machineState.currentState + machineState.context 주입)
                    │     │
                    │     ▼
                    │   마지막 저장 지점부터 실행 재개
                    │
                    ├── [처음부터 다시] → 새 Run 생성 (run_id 새로 발급)
                    │
                    └── [취소] → 종료
```

### 재개 후 에이전트 복원 순서

```
1. Orchestrator 가장 먼저 복원 (흐름 제어 주체)
2. activeAgents 목록의 에이전트 순차 복원
   각 에이전트에 context + 남은 Task 정보 전달
3. MessageBus 복원 (큐 비어있는 상태로 시작)
4. Heartbeat 모니터링 재시작 (5초 주기)
5. 상태 머신 이벤트 트리거로 중단된 지점부터 실행
```

---

## 14. 무결성 보장

```typescript
// 체크포인트 파일 저장 시 무결성 해시 계산
// integrityHash 필드 자체는 계산에서 제외한다
async function calculateIntegrityHash(
  state: Omit<CheckpointState, 'integrityHash'>
): Promise<string> {
  // crypto 모듈의 SHA-256 사용 (Math.random() 또는 Date.now() 금지)
  const content = JSON.stringify(state, null, 0);
  const hashBuffer = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(content)
  );
  return 'sha256:' + Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}
```

---

## 15. 체크포인트 JSON 전체 예시

```json
{
  "checkpointId": "cp_002_policy_decided",
  "runId": "run_20260302_0007",
  "sessionId": "sess_20260302_0001",
  "savedAt": "2026-03-02T09:05:00+09:00",
  "machineState": {
    "currentState": "PLANNING",
    "context": {
      "runId": "run_20260302_0007",
      "sessionId": "sess_20260302_0001",
      "userId": "user_001",
      "userRole": "Admin",
      "trustMode": "semi-auto",
      "currentAgent": "PLANNER",
      "specRef": "/.ai-run/run_20260302_0007/SPEC.md",
      "planRef": null,
      "policyDecision": {
        "policyDecisionId": "pd_20260302_0001",
        "outcome": "ALLOW",
        "riskScore": 35,
        "riskLevel": "MEDIUM",
        "decidedAt": "2026-03-02T09:04:00+09:00"
      },
      "changeSetRef": null,
      "reviewResult": null,
      "testResult": null,
      "riskScore": 35,
      "riskLevel": "MEDIUM",
      "capabilities": ["cap_20260302_0001"],
      "timeline": [
        {
          "state": "SPEC_ANALYSIS",
          "enteredAt": "2026-03-02T09:00:00+09:00",
          "exitedAt": "2026-03-02T09:02:00+09:00",
          "agentId": "SPEC_AGENT",
          "description": "요구사항 분석 완료"
        },
        {
          "state": "POLICY_CHECK",
          "enteredAt": "2026-03-02T09:02:00+09:00",
          "exitedAt": "2026-03-02T09:04:00+09:00",
          "agentId": "POLICY_RISK",
          "description": "정책 판정 완료 — ALLOW (위험도: MEDIUM)"
        }
      ],
      "tokenBudget": { "used": 8500, "limit": 100000 },
      "retryCount": 0,
      "maxRetries": 3,
      "lastError": null,
      "loopCounter": 0
    },
    "lastEvent": "POLICY_DECIDED"
  },
  "activeAgents": [
    {
      "agentId": "PLANNER",
      "status": "HEALTHY",
      "currentTaskId": "task_003",
      "progress": 15,
      "tokensUsed": 1200
    }
  ],
  "pendingGates": [],
  "activeCapabilities": [
    {
      "tokenId": "cap_20260302_0001",
      "cap": "fs.read",
      "scope": "/.ai-run/run_20260302_0007/**",
      "remainingTtlSeconds": 840,
      "remainingUses": 1,
      "issuedAt": "2026-03-02T09:00:00+09:00"
    }
  ],
  "environmentBundle": {
    "specPath": "/.ai-run/run_20260302_0007/SPEC.md",
    "planPath": null,
    "policyPath": "/.ai-run/run_20260302_0007/POLICY.json",
    "budgetPath": "/.ai-run/run_20260302_0007/BUDGET.json",
    "taskGraphPath": null,
    "modelAssignmentPath": "/.ai-run/run_20260302_0007/MODEL_ASSIGNMENT.json"
  },
  "tokenBudget": { "used": 8500, "limit": 100000 },
  "executedActions": [],
  "integrityHash": "sha256:a1b2c3d4e5f6..."
}
```

---

## 빠른 참조표

| 항목 | 규칙 |
|------|------|
| 파일 형식 | JSON (UTF-8, 2-space indent) |
| 최대 파일 크기 | 1MB (초과 시 대용량 필드 외부 분리) |
| 무결성 검증 | SHA-256 해시 (integrityHash 필드) |
| 대용량 산출물 | 인라인 금지 — 파일 경로 참조만 허용 |
| 순환 참조 | "[Circular Reference]"로 대체 후 계속 저장 |
| cp_latest.json | 심볼릭 링크 대신 파일 복사 (Windows 호환성) |
| 저장 주기 | 이벤트 기반 + 30초 주기 자동 저장 |
| TTL 만료 토큰 | 재개 시 remainingTtlSeconds 재계산 후 신규 Gate 생성 |

---

> version: 1.0.0
> last_updated: 2026-03-02
> 참조: `.claude/design/architecture-deep.md` §10, `.claude/contract.md` §7
