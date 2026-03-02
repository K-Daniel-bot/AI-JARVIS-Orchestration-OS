# StateManager 및 Checkpoint 통합 설계

**Phase**: 0+1
**Status**: 설계 문서 (구현 가이드)
**Last Updated**: 2026-03-02

---

## 목차

1. [개요](#개요)
2. [StateManager 아키텍처](#statemanager-아키텍처)
3. [Checkpoint 자동 저장 타이밍](#checkpoint-자동-저장-타이밍)
4. [Context 저장소 매핑](#context-저장소-매핑)
5. [Rollback 복구 흐름](#rollback-복구-흐름)
6. [구현 패턴](#구현-패턴)

---

## 개요

**StateManager**는 XState 머신과 데이터베이스 계층의 중간 계층으로,
다음 책임을 담당한다:

1. **Checkpoint 자동 저장** — 각 상태 전이 후 XState context를 DB에 저장
2. **Checkpoint 로드** — Rollback 시 이전 체크포인트 복원
3. **Context 일관성 보장** — 메모리 상태와 DB 상태 동기화
4. **Timeout/Cleanup** — 좀비 프로세스, 미완료 Run 정리

### 핵심 원칙

- **Append-only 저장**: Checkpoint는 수정/삭제 불가, 새로운 버전만 추가
- **무결성 검증**: 저장된 context JSON은 Zod 스키마로 검증
- **자동화**: 상태 전이 후 자동으로 checkpoint 저장 (수동 개입 불필요)
- **복구 가능성**: 언제든 이전 checkpoint에서 복구 가능

---

## StateManager 아키텍처

```
┌────────────────────────────────────────────────────────────┐
│                     XState Machine                          │
│                  (18 states + transitions)                  │
└────────────────────────────────────────────────────────────┘
                           ↓ (context 변경)
        ┌──────────────────────────────────────┐
        │  XState Listener (onStateChange)     │
        │  - 상태 전이 감지                     │
        │  - StateManager 호출                  │
        └──────────────────────────────────────┘
                           ↓
┌────────────────────────────────────────────────────────────┐
│                    StateManager                             │
│  ┌────────────────────────────────────────────────────┐    │
│  │ 책임:                                              │    │
│  │ 1. saveCheckpoint(context) — DB 저장              │    │
│  │ 2. loadCheckpoint(checkpoint_id) — DB 로드         │    │
│  │ 3. validateContext(context) — Zod 검증            │    │
│  │ 4. listCheckpointsForRun(runId) — checkpoint 목록  │    │
│  │ 5. pruneStaleCheckpoints() — 오래된 data 정리      │    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────┘
                           ↓ (저장/로드)
┌────────────────────────────────────────────────────────────┐
│          AuditLogService + checkpoints 테이블              │
│                   (SQLite 데이터베이스)                     │
│  ┌────────────────────────────────────────────────────┐    │
│  │ checkpoints 테이블:                               │    │
│  │ - checkpoint_id (PK)                               │    │
│  │ - run_id (FK)                                      │    │
│  │ - xstate_context_json (TEXT, 전체 context)        │    │
│  │ - created_at (timestamp)                           │    │
│  │ - created_by (에이전트 ID)                         │    │
│  └────────────────────────────────────────────────────┘    │
└────────────────────────────────────────────────────────────┘
```

---

## Checkpoint 자동 저장 타이밍

### Phase: 각 상태 전이 직후

```
State Transition 실행 순서:

1. 현재 상태 (예: SPEC_ANALYSIS)
   ├─ exit action (선택)
   └─ transition guard (조건 체크)

2. 상태 전이 (SPEC_ANALYSIS → PLANNING)
   ├─ action (context 업데이트)
   └─ ⭐ onStateChange listener 호출

3. ⭐ StateManager.saveCheckpoint() 자동 호출
   ├─ context 유효성 검증
   ├─ JSON 직렬화
   ├─ DB에 INSERT
   └─ 감사 로그 기록

4. 새로운 상태 (PLANNING) entry 실행
   ├─ entry action (선택)
   └─ invoke service (에이전트 호출)

5. 에이전트 실행
```

### 저장하는 Context의 예시

```typescript
/**
 * 각 상태 전이 직후의 context 스냅샷
 *
 * 예: SPEC_ANALYSIS → PLANNING 전이 후
 */

const checkpointSnapshot = {
  runId: 'run_2026-03-02_001',
  sessionId: 'session_user-abc_123',
  user: { userId: 'user-abc', role: 'Admin' },
  trustMode: 'suggest',
  startedAt: '2026-03-02T10:30:00Z',
  currentState: 'PLANNING',  // ← 새로운 상태
  lastTransitionAt: '2026-03-02T10:30:10Z',
  originalRequest: 'Create hello.txt file on desktop',

  // 누적 정보 (이전 상태에서 수집)
  spec: {
    title: 'Create hello.txt',
    acceptance_criteria: [...],
    constraints: [...],
    success_metrics: [...],
    out_of_scope: [...],
    assumptions: [...]
  },

  // 새로운 상태에서 아직 생성되지 않음
  plan: null,
  policy_decision: null,
  capability_token: null,
  changeset: null,
  review_result: null,
  test_result: null,
  execution_result: null,

  // 에러 상태 없음 (정상 진행)
  error: null,
  recovery_checkpoint_id: null,

  // 게이트 상태 (이 시점에서는 없음)
  pending_gates: [],
  approved_gates: [],
  rejected_gates: [],

  // 환경 번들 (누적)
  environment_bundle: {
    spec_md: '# Create hello.txt\n...',
    acceptance_criteria: [...],
    last_updated_at: '2026-03-02T10:30:05Z',
    last_updated_by: 'spec-agent'
  },

  // 시스템 정보 (정적)
  system_info: {
    os: 'windows',
    osVersion: '10.0.26200',
    arch: 'x64',
    node_version: '20.10.0',
    available_cpu_cores: 8,
    available_memory_mb: 16384,
    current_working_directory: 'C:\\Users\\user\\projects'
  },

  // 예산 정보 (누적)
  execution_budget: {
    max_total_tokens: 50000,
    consumed_tokens: 4000,  // ← Spec + Policy 사용
    max_execution_time_sec: 300,
    started_at: '2026-03-02T10:30:00Z'
  },

  // 모델 배정 (아직 결정 안 됨)
  model_assignment: null
};

// 이 전체 객체가 DB의 checkpoints 테이블에 JSON으로 저장됨
const checkpoint_json = JSON.stringify(checkpointSnapshot);
```

### 자동 저장이 발생하는 18개 상태별 시점

| # | 상태명 | Checkpoint 저장 시점 | 특이사항 |
|---|--------|------------------|---------|
| 1 | IDLE | 상태 진입 시 (초기화) | 기본값만 저장 |
| 2 | SPEC_ANALYSIS | → PLANNING 전이 (spec 완성 후) | spec 필드 채워짐 |
| 3 | PLANNING | → POLICY_CHECK 전이 (plan 완성 후) | plan, environment_bundle 업데이트 |
| 4 | POLICY_CHECK | → GATE_PLAN_APPROVAL 또는 ERROR 전이 | policy_decision 저장 |
| 5 | GATE_PLAN_APPROVAL | → PLANNING 또는 DENIED 전이 | pending_gates 변경 |
| 6 | CODE_GENERATION | → CODE_REVIEW 전이 | changeset 저장 |
| 7 | CODE_REVIEW | → GATE_APPLY_CHANGES 또는 ERROR 전이 | review_result 저장 |
| 8 | GATE_APPLY_CHANGES | → APPLY_CHANGES 또는 DENIED 전이 | pending_gates 변경 |
| 9 | APPLY_CHANGES | → TESTING 전이 (파일 적용 후) | 시스템 상태 스냅샷 |
| 10 | TESTING | → GATE_EXECUTION_APPROVAL 전이 | test_result 저장 |
| 11 | GATE_EXECUTION_APPROVAL | → DEPLOYMENT 또는 AWAITING_USER_INPUT 전이 | pending_gates 최종 확인 |
| 12 | DEPLOYMENT | → COMPLETED 또는 ERROR 전이 | execution_result 저장 |
| 13 | COMPLETED | 최종 상태 (저장 안 함) | 이미 완전한 context |
| 14 | DENIED | 최종 상태 (저장 안 함) | 거부 사유 저장됨 |
| 15 | ERROR_RECOVERY | → 복구 중 상태별 | error 필드 활성화 |
| 16 | ABORTED | 최종 상태 (저장 안 함) | 사용자 중단 |
| 17-18 | (reserved) | - | - |

---

## Context 저장소 매핑

### 메모리 Context vs DB 저장소

```typescript
/**
 * JarvisMachineContext 필드별 저장 위치
 *
 * 메모리: XState context (빠르지만 프로세스 종료 시 손실)
 * DB: checkpoints 테이블 (느리지만 영속성 보장)
 *
 * 전략:
 * - 메모리: 현재 실행 중인 context (온전)
 * - DB: 각 상태 전이 완료 시점의 스냅샷 (rollback 포인트)
 */

interface ContextStorageMapping {
  // ============================================================
  // 메모리에만 (실시간, transient)
  // ============================================================
  currentState: string;  // 현재 XState state.value
  lastTransitionAt: string;  // XState가 관리

  // ============================================================
  // 메모리 + DB (모두 저장)
  // ============================================================
  runId: string;                    // 메모리 + DB checkpoint
  sessionId: string;                // 메모리 + DB checkpoint
  user: UserInfo;                   // 메모리 + DB checkpoint
  trustMode: TrustMode;             // 메모리 + DB checkpoint
  startedAt: string;                // 메모리 + DB checkpoint
  originalRequest: string;          // 메모리 + DB checkpoint
  spec: SpecOutput | null;          // 메모리 + DB checkpoint
  plan: PlanOutput | null;          // 메모리 + DB checkpoint
  policy_decision: PolicyDecision | null;  // 메모리 + DB checkpoint
  capability_token: CapabilityToken | null;  // 메모리 + DB checkpoint
  changeset: ChangeSet | null;      // 메모리 + DB checkpoint
  review_result: ReviewOutput | null;  // 메모리 + DB checkpoint
  test_result: TestOutput | null;   // 메모리 + DB checkpoint
  execution_result: ExecutorOutput | null;  // 메모리 + DB checkpoint

  // ============================================================
  // DB에만 (영속 저장, 복구용)
  // ============================================================
  // checkpoints 테이블의 별도 컬럼:
  // - checkpoint_id (PRIMARY KEY)
  // - run_id (FOREIGN KEY)
  // - created_at (timestamp)
  // - created_by (에이전트)
  // 전체 context를 xstate_context_json BLOB으로 저장

  // ============================================================
  // 기타
  // ============================================================
  error: ErrorInfo | null;          // 메모리 + DB (에러 발생 시 checkpoint)
  pending_gates: GateInfo[];         // 메모리 + DB
  approved_gates: GateApproval[];    // 메모리 + DB (감사 추적)
  environment_bundle: EnvBundle;     // 메모리 + DB
  system_info: SystemInfo;           // 메모리 + DB
  execution_budget: Budget;          // 메모리 + DB
  model_assignment: ModelAssignment; // 메모리 + DB
}
```

---

## Rollback 복구 흐름

### 사용자가 "Rollback" 버튼 클릭 시

```
1. 사용자 UI: "Rollback to 10:30:15" 선택
   └─ rollback checkpoint_id = "checkpoint_2026-03-02_005"

2. CLI/API: jarvis rollback run_2026-03-02_001 --checkpoint checkpoint_2026-03-02_005
   └─ Orchestrator에 ABORT 이벤트 전송

3. Orchestrator:
   ├─ 현재 상태: DEPLOYMENT
   ├─ 상태 전이: DEPLOYMENT → ERROR_RECOVERY
   ├─ context.recovery_checkpoint_id = "checkpoint_2026-03-02_005"
   └─ Rollback Agent 호출

4. StateManager.loadCheckpoint(checkpoint_id):
   ├─ DB 쿼리: SELECT xstate_context_json FROM checkpoints WHERE checkpoint_id = ?
   ├─ JSON 파싱
   ├─ Zod 검증: JarvisMachineContextSchema.parse(context)
   ├─ 메모리에 로드: xstate.getState().context = loadedContext
   └─ 감사 로그: "CHECKPOINT_RESTORED checkpoint_id=... to_state=DEPLOYMENT"

5. Rollback Agent:
   ├─ context.execution_result (DEPLOYMENT에서 적용된 파일들) 역순 삭제
   ├─ 삭제 성공 시:
   │   ├─ context.currentState = PLANNING (이전 상태로)
   │   ├─ context.changeset = null (변경사항 제거)
   │   └─ 새 checkpoint 저장
   ├─ 삭제 실패 시:
   │   ├─ 감사 로그에 에러 기록
   │   └─ ERROR_RECOVERY 상태 유지 (사용자 개입 필요)
   └─ 성공하면 COMPLETED로 전이

6. 최종:
   ├─ DB: 3개의 checkpoint 존재
   │   - checkpoint_...001 (원본, SPEC_ANALYSIS)
   │   - checkpoint_...005 (롤백 대상)
   │   - checkpoint_...006 (롤백 후, PLANNING)
   └─ 메모리: context = PLANNING 상태로 복원
```

### Checkpoint 목록과 시간여행

```
Timeline (Checkpoint History):
│
├─ 10:30:00Z — checkpoint_001 (SPEC_ANALYSIS) — spec='Create hello.txt'
│
├─ 10:30:05Z — checkpoint_002 (PLANNING) — plan=WBS with 3 tasks
│
├─ 10:30:10Z — checkpoint_003 (POLICY_CHECK) — policy_decision=ALLOW, risk_score=15
│
├─ 10:30:15Z — checkpoint_004 (CODE_GENERATION) — changeset={files_added:[hello.txt]}
│
├─ 10:30:20Z — checkpoint_005 (CODE_REVIEW) — review_result={passed_checks:8}
│
├─ 10:30:25Z — checkpoint_006 (TESTING) — test_result={passed_tests:5}
│
├─ 10:30:30Z — checkpoint_007 (DEPLOYMENT_START) — starting execution
│
├─ 10:30:35Z — checkpoint_008 (DEPLOYMENT_COMPLETED) — execution_result={applied_files:[...]}
│
└─ 10:30:40Z — checkpoint_009 (COMPLETED) — final state

사용자가 "Rollback to 10:30:15" 선택
  → checkpoint_004로 복원
  → execution_result, test_result, review_result 모두 제거
  → 상태: PLANNING (4번째 상태로 돌아감)
```

---

## 구현 패턴

### packages/core/src/state-manager.ts

```typescript
/**
 * StateManager — XState context의 DB 저장소 관리
 *
 * 책임:
 * 1. saveCheckpoint() — 상태 전이 후 context 저장
 * 2. loadCheckpoint() — 이전 checkpoint 복원
 * 3. validateContext() — Zod 검증
 * 4. listCheckpoints() — 특정 run의 모든 checkpoint 조회
 * 5. pruneCheckpoints() — 오래된 checkpoint 정리
 */
export class StateManager {
  private auditLog: AuditLogService;
  private db: Database;

  constructor(auditLog: AuditLogService, dbPath: string) {
    this.auditLog = auditLog;
    this.db = new Database(dbPath);
  }

  /**
   * saveCheckpoint() — XState context를 DB에 저장
   *
   * 호출 시점:
   * - XState 상태 전이 후 자동 (onStateChange listener)
   *
   * @param context JarvisMachineContext (메모리의 현재 상태)
   * @param runId 실행 세션 ID
   * @param agentId 저장을 요청한 에이전트 (보통 'orchestrator')
   *
   * @returns Promise<Result<{ checkpoint_id: string }, DBError>>
   */
  async saveCheckpoint(
    context: JarvisMachineContext,
    runId: string,
    agentId: string = 'orchestrator'
  ): Promise<Result<{ checkpoint_id: string }, DBError>> {
    // 1. Context 유효성 검증 (Zod)
    const validationResult = JarvisMachineContextSchema.safeParse(context);

    if (!validationResult.success) {
      return Err({
        code: 'VALIDATION_FAILED',
        message: `Context validation failed: ${validationResult.error.message}`
      });
    }

    const checkpoint_id = generateUUID();
    const contextJson = JSON.stringify(context);

    try {
      // 2. DB INSERT
      await this.db.run(
        `INSERT INTO checkpoints (
          checkpoint_id, run_id, xstate_context_json, created_by
        ) VALUES (?, ?, ?, ?)`,
        [checkpoint_id, runId, contextJson, agentId]
      );

      // 3. 감사 로그 기록
      await this.auditLog.record({
        who: agentId,
        what: `CHECKPOINT_SAVED checkpoint_id=${checkpoint_id} state=${context.currentState}`,
        execution: {
          stage: 'state_management',
          checkpoint_id,
          state: context.currentState,
          consumed_tokens: context.execution_budget.consumed_tokens,
          max_tokens: context.execution_budget.max_total_tokens
        },
        result: {
          status: 'success'
        }
      });

      return Ok({ checkpoint_id });
    } catch (error) {
      return Err({
        code: 'DB_ERROR',
        message: `Failed to save checkpoint: ${error}`
      });
    }
  }

  /**
   * loadCheckpoint() — DB에서 checkpoint 로드하여 메모리 복원
   *
   * 호출 시점:
   * - 롤백 시 (RollbackAgent에서)
   * - 복구 시 (재시작 후 이전 상태 복원)
   *
   * @param checkpoint_id 로드할 checkpoint ID
   *
   * @returns Promise<Result<JarvisMachineContext, DBError>>
   */
  async loadCheckpoint(
    checkpoint_id: string
  ): Promise<Result<JarvisMachineContext, DBError>> {
    try {
      // 1. DB 조회
      const row = await this.db.get(
        `SELECT xstate_context_json, created_at FROM checkpoints WHERE checkpoint_id = ?`,
        [checkpoint_id]
      );

      if (!row) {
        return Err({
          code: 'DB_ERROR',
          message: `Checkpoint not found: ${checkpoint_id}`
        });
      }

      // 2. JSON 파싱
      let context: unknown;
      try {
        context = JSON.parse(row.xstate_context_json);
      } catch (parseError) {
        return Err({
          code: 'INTERNAL_ERROR',
          message: `Failed to parse checkpoint JSON: ${parseError}`
        });
      }

      // 3. Zod 검증
      const validationResult = JarvisMachineContextSchema.safeParse(context);

      if (!validationResult.success) {
        return Err({
          code: 'VALIDATION_FAILED',
          message: `Checkpoint validation failed: ${validationResult.error.message}`
        });
      }

      // 4. 감사 로그 기록
      await this.auditLog.record({
        who: 'orchestrator',
        what: `CHECKPOINT_LOADED checkpoint_id=${checkpoint_id} state=${validationResult.data.currentState}`,
        execution: {
          stage: 'state_management',
          checkpoint_id,
          created_at: row.created_at,
          restored_state: validationResult.data.currentState
        },
        result: {
          status: 'success'
        }
      });

      return Ok(validationResult.data);
    } catch (error) {
      return Err({
        code: 'DB_ERROR',
        message: `Failed to load checkpoint: ${error}`
      });
    }
  }

  /**
   * listCheckpointsForRun() — 특정 run의 모든 checkpoint 조회
   *
   * 웹 UI에서 Timeline 뷰를 위해 사용
   *
   * @param runId 실행 ID
   *
   * @returns Promise<Result<CheckpointInfo[], DBError>>
   */
  async listCheckpointsForRun(runId: string): Promise<
    Result<
      Array<{
        checkpoint_id: string;
        created_at: string;
        created_by: string;
        state: string;
      }>,
      DBError
    >
  > {
    try {
      const rows = await this.db.all(
        `SELECT checkpoint_id, created_at, created_by,
                json_extract(xstate_context_json, '$.currentState') as state
         FROM checkpoints
         WHERE run_id = ?
         ORDER BY created_at ASC`,
        [runId]
      );

      return Ok(rows);
    } catch (error) {
      return Err({
        code: 'DB_ERROR',
        message: `Failed to list checkpoints: ${error}`
      });
    }
  }

  /**
   * pruneStaleCheckpoints() — 오래된 checkpoint 정리
   *
   * 책략:
   * - 각 run마다 최대 20개 checkpoint 유지
   * - 7일 이상 된 checkpoint 삭제 (최신 버전만 유지)
   * - COMPLETED/DENIED/ABORTED 상태의 run에서만 정리
   *
   * 호출: 주기적으로 (매 1시간 또는 cron)
   */
  async pruneStaleCheckpoints(): Promise<Result<{ deleted_count: number }, DBError>> {
    try {
      // 1. 각 run마다 최신 20개 이외 삭제
      const deleteResult = await this.db.run(
        `DELETE FROM checkpoints
         WHERE checkpoint_id IN (
           SELECT checkpoint_id FROM checkpoints
           WHERE created_at < datetime('now', '-7 days')
         )`,
        []
      );

      const deletedCount = deleteResult.changes ?? 0;

      // 2. 감사 로그
      if (deletedCount > 0) {
        await this.auditLog.record({
          who: 'system',
          what: `CHECKPOINTS_PRUNED count=${deletedCount}`,
          execution: {
            stage: 'maintenance',
            deleted_count: deletedCount
          },
          result: {
            status: 'success'
          }
        });
      }

      return Ok({ deleted_count: deletedCount });
    } catch (error) {
      return Err({
        code: 'DB_ERROR',
        message: `Failed to prune checkpoints: ${error}`
      });
    }
  }
}
```

### packages/core/src/machine.ts (XState 머신 통합)

```typescript
import { createMachine } from 'xstate';
import { StateManager } from './state-manager';

/**
 * jarvisMachine with StateManager integration
 *
 * 각 상태 전이 후 자동으로 checkpoint 저장
 */
export function createJarvisMachine(stateManager: StateManager) {
  const machine = createMachine(
    {
      id: 'jarvis-orchestration',
      initial: 'IDLE',
      context: { /* initial context */ } as JarvisMachineContext,

      states: {
        SPEC_ANALYSIS: {
          invoke: {
            src: 'specAgentService',
            onDone: {
              target: 'PLANNING',
              actions: assign({
                spec: (_, event) => event.data.spec,
                lastTransitionAt: () => new Date().toISOString(),
                currentState: () => 'PLANNING'
              })
            }
          }
        },

        PLANNING: {
          invoke: {
            src: 'plannerAgentService',
            onDone: {
              target: 'POLICY_CHECK',
              actions: assign({
                plan: (_, event) => event.data.plan,
                lastTransitionAt: () => new Date().toISOString(),
                currentState: () => 'POLICY_CHECK'
              })
            }
          }
        }

        // ... 16 more states
      }
    },
    { /* services config */ }
  );

  // ⭐ StateManager 통합: 모든 상태 변경 후 checkpoint 저장
  const machineWithStateManagement = machine.onTransition((state) => {
    // 상태 전이 완료 후 자동 실행
    stateManager
      .saveCheckpoint(state.context, state.context.runId, 'orchestrator')
      .then((result) => {
        if (!result.ok) {
          console.error('Failed to save checkpoint:', result.error);
        }
      });
  });

  return machineWithStateManagement;
}
```

### 웹 UI: Timeline 뷰 (React)

```typescript
/**
 * TimelineView — 모든 checkpoint를 시간순 표시
 *
 * 기능:
 * - Checkpoint 목록 표시
 * - 각 checkpoint의 state, timestamp, 설명
 * - "Rollback to this point" 버튼
 */
export function TimelineView({ runId }: { runId: string }) {
  const [checkpoints, setCheckpoints] = useState<CheckpointInfo[]>([]);

  useEffect(() => {
    // 웹 API: GET /api/runs/:runId/checkpoints
    fetch(`/api/runs/${runId}/checkpoints`)
      .then((res) => res.json())
      .then((data) => setCheckpoints(data));
  }, [runId]);

  const handleRollback = async (checkpoint_id: string) => {
    // CLI: jarvis rollback <run-id> --checkpoint <checkpoint-id>
    const response = await fetch(`/api/runs/${runId}/rollback`, {
      method: 'POST',
      body: JSON.stringify({ checkpoint_id })
    });

    if (response.ok) {
      alert('Rollback initiated');
    }
  };

  return (
    <div className="timeline">
      {checkpoints.map((cp, idx) => (
        <div key={cp.checkpoint_id} className="timeline-item">
          <div className="timestamp">{cp.created_at}</div>
          <div className="state">{cp.state}</div>
          <div className="created-by">by {cp.created_by}</div>
          <button onClick={() => handleRollback(cp.checkpoint_id)}>
            Rollback to this point
          </button>
        </div>
      ))}
    </div>
  );
}
```

---

## 참고 문서

- `.claude/design/xstate-context-types.md` — Context 전체 타입 정의
- `.claude/design/checkpoint-format.md` — Checkpoint JSON 상세
- `.claude/design/db-query-library.md` — SQL 쿼리 패턴
- `.claude/agents/rollback.md` — Rollback Agent 상세

