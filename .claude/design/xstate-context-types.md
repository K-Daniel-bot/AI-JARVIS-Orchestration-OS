# XState Context 타입 완전 정의

**Phase**: 0+1
**Status**: 설계 문서 (구현 가이드)
**Last Updated**: 2026-03-02

---

## 목차

1. [개요](#개요)
2. [JarvisMachineContext 인터페이스](#jarvismachinecontext-인터페이스)
3. [상태별 Context 구조](#상태별-context-구조)
4. [Schema State 타입](#schema-state-타입)
5. [Context 전이 규칙](#context-전이-규칙)
6. [구현 패턴](#구현-패턴)

---

## 개요

JARVIS OS의 XState v5 상태 머신은 실행 전 단계 전체를 통해 **JarvisMachineContext**를 누적/변환시킨다.
Context는 불변이고, 각 상태 전이 시 새로운 context 객체가 생성된다.

### 핵심 원칙

- **불변성**: Context는 수정하지 말고, 새 객체로 대체 (XState 권장)
- **누적 저장**: SPEC → PLAN → BUDGET → POLICY 정보는 계속 유지
- **Schema State 저장**: 각 단계의 생성물(spec.md, plan.json 등)을 context.environment_bundle에 저장
- **Checkpoint 매핑**: Context는 전체 rollback 포인트로 사용 (DB에 JSON 직렬화)

---

## JarvisMachineContext 인터페이스

```typescript
/**
 * JarvisMachineContext — XState 머신의 전역 context
 *
 * 이 인터페이스는 IDLE부터 COMPLETED까지 모든 상태에서 사용된다.
 * 각 상태는 자신의 필드들만 읽거나 업데이트한다.
 *
 * 저장소: packages/core/src/machine.ts (XState 머신 정의)
 * 사용처:
 *   - Context 접근: state.context.spec, state.context.plan 등
 *   - Guard 조건: context.policy_decision.policy_decision === 'ALLOW'
 *   - Action 인자: sendTo('executor', { type: 'RUN', context })
 *   - Checkpoint: JSON.stringify(context)로 DB 저장
 */
export interface JarvisMachineContext {
  // ============================================================
  // 실행 메타정보 (IDLE부터 전체 lifecycle)
  // ============================================================

  /** 실행 Run ID (생성: IDLE 상태에서 submitUserRequest 호출 시) */
  runId: string; // 형식: run_{YYYY-MM-DD}_{seq}

  /** 세션 ID (요청자 세션, TTL 검증용) */
  sessionId: string;

  /** 요청자 정보 */
  user: {
    userId: string;
    role: 'Owner' | 'Admin' | 'User' | 'Guest';
  };

  /** 현재 신뢰 모드 (런타임 변경 가능) */
  trustMode: 'observe' | 'suggest' | 'semi-auto' | 'full-auto';

  /** 실행 시작 시각 (ISO 8601) */
  startedAt: string;

  /** 현재 상태명 (XState state.value) */
  currentState: string;

  /** 마지막 상태 전이 시각 */
  lastTransitionAt: string;

  // ============================================================
  // 원본 요청 (SPEC_ANALYSIS부터)
  // ============================================================

  /** 사용자 원본 입력 (자연언어) */
  originalRequest: string;

  // ============================================================
  // SPEC_ANALYSIS → SPEC (명세) 저장
  // ============================================================

  /**
   * spec — Spec Agent가 생성한 구조화된 명세
   *
   * Phase: SPEC_ANALYSIS 상태에서 생성
   * Content: AcceptanceCriteria, constraints, success_metrics 등
   * Used by: 모든 후속 에이전트 (PLAN, CODE, TEST 등)
   * Persistence: checkpoint에 JSON 직렬화
   */
  spec: SpecOutput | null;

  // ============================================================
  // PLANNING → PLAN (계획) 저장
  // ============================================================

  /**
   * plan — Planner Agent가 생성한 작업 분해(WBS) 및 Task DAG
   *
   * Phase: PLANNING 상태에서 생성
   * Content: tasks[], dependencies[], estimated_duration, rollback_points
   * Used by: Codegen (어떤 파일 생성), Test (테스트 케이스)
   * Persistence: checkpoint에 JSON 직렬화
   */
  plan: PlanOutput | null;

  // ============================================================
  // POLICY_CHECK → POLICY (정책 판정) 저장
  // ============================================================

  /**
   * policy_decision — Policy/Risk Agent가 생성한 정책 판정 결과
   *
   * Phase: POLICY_CHECK 상태에서 생성
   * Content: risk_score, risk_level, policy_decision (ALLOW/DENY/...), requires_gates[]
   * Used by: Guard (상태 전이 결정), Gate (사용자 승인)
   * Persistence: checkpoint에 JSON 직렬화
   * Critical: DENY인 경우 DENIED 상태로 즉시 전이
   */
  policy_decision: PolicyDecision | null;

  // ============================================================
  // CAPABILITY_ISSUANCE → CAPABILITY_TOKEN (권한) 저장
  // ============================================================

  /**
   * capability_token — Policy/Risk Agent가 발급한 1회용 권한 토큰
   *
   * Phase: CAPABILITY_ISSUANCE 상태에서 발급 (Phase 1+)
   * Phase 0에서는 null (건너뜀)
   * Content: cap_id, scope, ttl_seconds, remaining_uses=1
   * Used by: Executor (OS 조작 권한 검증)
   * Persistence: checkpoint에 JSON 직렬화 + 동시에 DB(capability_tokens 테이블) 저장
   */
  capability_token: CapabilityToken | null;

  // ============================================================
  // CODE_GENERATION → CHANGESET 저장
  // ============================================================

  /**
   * changeset — Codegen Agent가 생성한 변경사항
   *
   * Phase: CODE_GENERATION 상태에서 생성
   * Content: files_added[], files_modified[], files_deleted[], diff[]
   * Used by: Review (코드 검토), Executor (파일 적용)
   * Persistence: checkpoint에 JSON 직렬화
   * Reversibility: 각 diff 항목에 inverse_diff 포함 (롤백용)
   */
  changeset: ChangeSet | null;

  // ============================================================
  // CODE_REVIEW → REVIEW_RESULT 저장
  // ============================================================

  /**
   * review_result — Review Agent가 수행한 보안/품질 검토 결과
   *
   * Phase: CODE_REVIEW 상태에서 생성
   * Content: passed_checks[], failed_checks[], warnings[], recommendations[]
   * Used by: Guard (검토 통과 여부), Executor (최종 확인)
   * Persistence: checkpoint에 JSON 직렬화
   */
  review_result: ReviewOutput | null;

  // ============================================================
  // TESTING → TEST_RESULT 저장
  // ============================================================

  /**
   * test_result — Test/Build Agent가 수행한 테스트 결과
   *
   * Phase: TESTING 상태에서 생성
   * Content: passed_tests[], failed_tests[], build_output, coverage_percent
   * Used by: Guard (테스트 통과 여부), Rollback (실패 시 원인 분석)
   * Persistence: checkpoint에 JSON 직렬화
   */
  test_result: TestOutput | null;

  // ============================================================
  // DEPLOYMENT → EXECUTION_RESULT 저장
  // ============================================================

  /**
   * execution_result — Executor Agent가 수행한 실제 OS 조작 결과
   *
   * Phase: DEPLOYMENT 상태에서 생성
   * Content: applied_files[], failed_actions[], action_logs[]
   * Used by: Rollback (실패 시 복구), Audit (최종 기록)
   * Persistence: checkpoint에 JSON 직렬화
   */
  execution_result: ExecutorOutput | null;

  // ============================================================
  // 에러 및 복구 정보
  // ============================================================

  /**
   * error — 현재 에러 상태 (ERROR 상태에서만 설정)
   *
   * 발생 에이전트, 에러 코드, 메시지 포함
   * Used by: ErrorRecovery, Rollback
   */
  error: {
    code: string;           // AGENT_TIMEOUT, VALIDATION_FAILED 등
    message: string;
    agentId: string;
    failedState: string;    // 에러 발생한 상태명
    timestamp: string;      // ISO 8601
    retryCount: number;     // 재시도 횟수
  } | null;

  /**
   * recovery_checkpoint_id — Rollback이 복구할 체크포인트 ID
   *
   * Set by: Rollback agent (어느 시점으로 돌아갈지 결정)
   * Used by: Checkpoint loader
   */
  recovery_checkpoint_id: string | null;

  // ============================================================
  // 게이트 관련 정보
  // ============================================================

  /**
   * pending_gates — 대기 중인 사용자 승인 게이트 목록
   *
   * Gate L1/L2/L3 등이 필요한 경우 이 배열에 추가
   * UI가 이 배열을 보고 "승인 필요" 표시
   * Gate 승인 후 pop() 제거
   */
  pending_gates: {
    gateId: string;         // 게이트 ID (gate_001, gate_002 등)
    gateLevel: number;      // 0=plan, 1=changes, 2=execution
    gateName: string;       // "변경 승인", "실행 승인" 등
    reason: string;         // 왜 이 게이트가 필요한가
    riskFactors: string[];  // 위험 요소 (Risk Score 기반)
    createdAt: string;      // ISO 8601
  }[];

  /**
   * approved_gates — 승인 완료된 게이트 이력
   *
   * Gate 승인 후 이 배열에 추가 (감사 추적)
   */
  approved_gates: {
    gateId: string;
    approvedBy: string;     // 'user' 또는 'auto'
    approvedAt: string;
    decision: 'APPROVED' | 'REJECTED' | 'CONSTRAINED';
  }[];

  /**
   * rejected_gates — 거부된 게이트
   *
   * 사용자가 승인 거부 시 추가
   * → DENIED 상태 전이
   */
  rejected_gates: {
    gateId: string;
    rejectedBy: string;
    rejectedAt: string;
    reason: string;
  }[];

  // ============================================================
  // 환경 번들 (모든 Schema State 중앙 저장)
  // ============================================================

  /**
   * environment_bundle — 실행 단계별 생성물을 모두 담는 컨테이너
   *
   * 이 필드는:
   * 1. 각 단계 생성 후 업데이트 (spec, plan, policy, test, changeset 등)
   * 2. Checkpoint 저장 시 전체 context와 함께 직렬화
   * 3. Rollback 시 이전 버전의 environment_bundle 복원
   *
   * 상세: .claude/schemas/environment-bundle.json 참고
   */
  environment_bundle: {
    // SPEC_ANALYSIS 이후
    spec_md?: string;           // Markdown 형식 명세서
    acceptance_criteria?: string[];

    // PLANNING 이후
    plan_json?: any;            // WBS + Task DAG (JSON)
    budget_estimate?: {
      estimated_tokens: number;
      estimated_cost_usd: number;
      estimated_duration_sec: number;
    };

    // POLICY_CHECK 이후
    policy_json?: PolicyDecision;
    risk_assessment?: {
      risk_score: number;
      risk_level: string;
      contributing_factors: string[];
    };

    // CODE_GENERATION 이후
    changeset_json?: ChangeSet;
    file_count?: {
      added: number;
      modified: number;
      deleted: number;
    };

    // CODE_REVIEW 이후
    review_summary?: {
      total_checks: number;
      passed_checks: number;
      failed_checks: number;
      critical_issues: string[];
    };

    // TESTING 이후
    test_summary?: {
      total_tests: number;
      passed_tests: number;
      failed_tests: number;
      coverage_percent: number;
    };

    // DEPLOYMENT 이후
    deployment_log?: {
      applied_files: string[];
      failed_files: string[];
      total_duration_ms: number;
    };

    // 메타
    last_updated_at: string;    // ISO 8601
    last_updated_by: string;    // 에이전트 ID
  };

  // ============================================================
  // 시스템 정보
  // ============================================================

  /**
   * system_info — 실행 환경 정보 (정적)
   *
   * Set at: IDLE 상태 초기화
   * Used by: 모든 에이전트 (OS 특화 처리)
   */
  system_info: {
    os: 'windows' | 'macos' | 'linux';
    osVersion: string;
    arch: 'x64' | 'arm64';
    node_version: string;
    available_cpu_cores: number;
    available_memory_mb: number;
    current_working_directory: string;
  };

  /**
   * execution_budget — 실행 예산 (타임아웃, 토큰 한도 등)
   *
   * Set at: IDLE 상태 초기화 (또는 사용자 커스텀)
   * Checked: 각 에이전트 시작 전 (AGENT_TIMEOUT 방지)
   */
  execution_budget: {
    max_total_tokens: number;      // 전체 실행 최대 토큰 (기본 50000)
    consumed_tokens: number;       // 누적 소비 토큰
    max_execution_time_sec: number; // 최대 실행 시간 (기본 300)
    started_at: string;            // ISO 8601
  };

  /**
   * model_assignment — 각 에이전트별 모델 배정 (동적 선택 가능)
   *
   * Phase: PLANNING 상태에서 Orchestrator가 결정
   * Format:
   *   {
   *     "orchestrator": "claude-opus-4-6",
   *     "spec-agent": "claude-haiku-4-5-20251001",
   *     ...
   *   }
   * Used by: 각 에이전트의 API 호출 시 (callClaudeAPI)
   */
  model_assignment: Record<string, string> | null;
}
```

---

## 상태별 Context 구조

### IDLE 상태 (초기화)

```typescript
// 상태 진입: 애플리케이션 시작
// 상태 퇴출: submitUserRequest() 호출
// Context 변경:

const idleContext: JarvisMachineContext = {
  runId: null,                           // 아직 null
  sessionId: null,                       // 아직 null
  user: null,                            // 아직 null
  trustMode: 'suggest',                  // 기본값
  startedAt: null,                       // 아직 null
  currentState: 'IDLE',
  lastTransitionAt: new Date().toISOString(),
  originalRequest: '',
  spec: null,
  plan: null,
  policy_decision: null,
  capability_token: null,
  changeset: null,
  review_result: null,
  test_result: null,
  execution_result: null,
  error: null,
  recovery_checkpoint_id: null,
  pending_gates: [],
  approved_gates: [],
  rejected_gates: [],
  environment_bundle: {
    last_updated_at: new Date().toISOString(),
    last_updated_by: 'system'
  },
  system_info: { /* 호스트 정보 */ },
  execution_budget: {
    max_total_tokens: 50000,
    consumed_tokens: 0,
    max_execution_time_sec: 300,
    started_at: new Date().toISOString()
  },
  model_assignment: null
};
```

### SPEC_ANALYSIS 상태

```typescript
// 상태 진입: submitUserRequest 호출
// Spec Agent 실행
// Context 변경:

const specContext: JarvisMachineContext = {
  ...idleContext,
  runId: 'run_2026-03-02_001',
  sessionId: 'session_user-abc_123',
  user: { userId: 'user-abc', role: 'Admin' },
  startedAt: '2026-03-02T10:30:00Z',
  currentState: 'SPEC_ANALYSIS',
  lastTransitionAt: '2026-03-02T10:30:00Z',
  originalRequest: 'Create a hello.txt file on desktop',
  system_info: { /* 수집 완료 */ },
  execution_budget: {
    max_total_tokens: 50000,
    consumed_tokens: 2500,  // Spec Agent 사용
    max_execution_time_sec: 300,
    started_at: '2026-03-02T10:30:00Z'
  }
};

// SPEC_ANALYSIS 완료 후 (spec 생성됨)
const postSpecContext = {
  ...specContext,
  spec: {
    title: 'Create hello.txt',
    acceptance_criteria: ['File exists on desktop', 'Content is correct'],
    constraints: ['User permission required'],
    success_metrics: ['File size > 0'],
    out_of_scope: ['Cloud sync'],
    assumptions: ['Desktop path is accessible']
  },
  environment_bundle: {
    ...specContext.environment_bundle,
    spec_md: '# Create hello.txt\n...',
    acceptance_criteria: ['File exists on desktop', ...],
    last_updated_at: '2026-03-02T10:30:05Z',
    last_updated_by: 'spec-agent'
  }
};
```

### POLICY_CHECK 상태

```typescript
// 상태 진입: SPEC_ANALYSIS 완료 후 자동 전이
// Policy/Risk Agent 실행
// Context 변경:

const policyContext = {
  ...postSpecContext,
  currentState: 'POLICY_CHECK',
  lastTransitionAt: '2026-03-02T10:30:10Z',
  execution_budget: {
    ...postSpecContext.execution_budget,
    consumed_tokens: 4000  // +1500 (policy agent)
  }
};

// POLICY_CHECK 완료 후
const postPolicyContext = {
  ...policyContext,
  policy_decision: {
    risk_score: 15,  // 낮음
    risk_level: 'LOW',
    policy_decision: 'ALLOW',
    requires_gates: [],
    reason_codes: ['FS_WRITE_SAFE'],
    policy_sources: ['contract.md §1'],
    human_explanation: 'Creating a text file on user desktop is safe.'
  },
  environment_bundle: {
    ...policyContext.environment_bundle,
    policy_json: { /* policy_decision 내용 */ },
    risk_assessment: {
      risk_score: 15,
      risk_level: 'LOW',
      contributing_factors: ['File operation', 'User-controlled location']
    },
    last_updated_at: '2026-03-02T10:30:15Z',
    last_updated_by: 'policy-risk'
  }
};
```

### GATE 상태들

```typescript
// GATE_PLAN_APPROVAL, GATE_APPLY_CHANGES, GATE_EXECUTION_APPROVAL 등에서
// pending_gates 배열에 항목 추가

const gateContext = {
  ...postPolicyContext,
  currentState: 'GATE_PLAN_APPROVAL',
  pending_gates: [
    {
      gateId: 'gate_001',
      gateLevel: 1,
      gateName: '계획 승인',
      reason: '높은 복잡도',
      riskFactors: ['Multiple file changes'],
      createdAt: '2026-03-02T10:30:20Z'
    }
  ]
};

// 사용자 승인 후
const approvedContext = {
  ...gateContext,
  pending_gates: [],  // pop()
  approved_gates: [
    {
      gateId: 'gate_001',
      approvedBy: 'user',
      approvedAt: '2026-03-02T10:30:30Z',
      decision: 'APPROVED'
    }
  ]
};
```

### DEPLOYMENT 상태 (실행 후)

```typescript
// 상태 진입: TESTING 완료 후
// Executor Agent 실행
// Context 변경:

const executionContext = {
  ...approvedContext,
  currentState: 'DEPLOYMENT',
  lastTransitionAt: '2026-03-02T10:31:00Z',
  execution_result: {
    applied_files: ['C:\\Users\\user\\Desktop\\hello.txt'],
    failed_actions: [],
    action_logs: [
      {
        action_id: 'action_001',
        action: 'FS_CREATE_FILE',
        path: 'C:\\Users\\user\\Desktop\\hello.txt',
        status: 'success',
        duration_ms: 50
      }
    ]
  },
  environment_bundle: {
    ...approvedContext.environment_bundle,
    deployment_log: {
      applied_files: ['C:\\Users\\user\\Desktop\\hello.txt'],
      failed_files: [],
      total_duration_ms: 50
    },
    last_updated_at: '2026-03-02T10:31:00Z',
    last_updated_by: 'executor'
  }
};
```

---

## Schema State 타입

모든 Schema State (SPEC, PLAN, POLICY, BUDGET, CHANGESET, REVIEW, TEST, EXECUTION)는
environment_bundle에 저장되며, 다음 타입을 따른다:

```typescript
/**
 * SchemaState — 각 단계 생성물의 표준 형식
 *
 * Phase: 각 에이전트별 (spec, plan, policy 등)
 * Storage: context.environment_bundle + context.{spec|plan|...} 이중 저장
 * Persistence: Checkpoint JSON 직렬화
 */

// SPEC Schema
export type SpecOutput = {
  title: string;
  acceptance_criteria: string[];
  constraints: string[];
  success_metrics: string[];
  out_of_scope: string[];
  assumptions: string[];
};

// PLAN Schema
export type PlanOutput = {
  tasks: Array<{
    id: string;
    description: string;
    estimated_tokens: number;
    dependencies: string[];
    rollback_action?: string;
  }>;
  dependencies: Array<{ from: string; to: string }>;
  estimated_duration_sec: number;
  estimated_cost_usd: number;
};

// POLICY Schema
export type PolicyDecision = {
  risk_score: number;        // 0-100
  risk_level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  policy_decision: 'ALLOW' | 'DENY' | 'APPROVAL_REQUIRED' | 'CONSTRAINED_ALLOW';
  requires_gates: number[];
  reason_codes: string[];
  policy_sources: string[];
  human_explanation: string;
};

// CHANGESET Schema
export type ChangeSet = {
  files_added: Array<{ path: string; content: string }>;
  files_modified: Array<{ path: string; diff: string }>;
  files_deleted: string[];
  summary: string;
};

// REVIEW Schema
export type ReviewOutput = {
  passed_checks: string[];
  failed_checks: string[];
  warnings: string[];
  recommendations: string[];
};

// TEST Schema
export type TestOutput = {
  passed_tests: number;
  failed_tests: number;
  build_output: string;
  coverage_percent: number;
};

// EXECUTOR Schema
export type ExecutorOutput = {
  applied_files: string[];
  failed_actions: string[];
  action_logs: Array<{
    action_id: string;
    action: string;
    status: 'success' | 'failure';
    duration_ms: number;
  }>;
};
```

---

## Context 전이 규칙

### Guard 조건 (상태 전이 결정)

```typescript
// XState Guard 정의 (packages/core/src/machine.ts)

/**
 * canProceedToPlanning — SPEC_ANALYSIS → PLANNING 진행 가능 여부
 *
 * @param context JarvisMachineContext
 * @return true if spec는 유효하고 사용자는 이 단계를 진행하도록 신뢰됨
 */
function canProceedToPlanning(context: JarvisMachineContext): boolean {
  return context.spec !== null && context.spec.title.length > 0;
}

/**
 * isDeniedByPolicy — POLICY_CHECK 결과가 DENY인가
 *
 * @return true if policy_decision.policy_decision === 'DENY'
 */
function isDeniedByPolicy(context: JarvisMachineContext): boolean {
  return context.policy_decision?.policy_decision === 'DENY';
}

/**
 * requiresGateApproval — Gate 승인이 필요한가
 *
 * @return true if policy_decision.requires_gates.length > 0
 */
function requiresGateApproval(context: JarvisMachineContext): boolean {
  return (context.policy_decision?.requires_gates ?? []).length > 0;
}

/**
 * hasTokenBudget — 토큰 예산이 남았는가
 *
 * @return true if consumed < max
 */
function hasTokenBudget(context: JarvisMachineContext): boolean {
  return (
    context.execution_budget.consumed_tokens < context.execution_budget.max_total_tokens
  );
}

/**
 * canRetryAgent — 에이전트 재시도 가능한가
 *
 * @return true if error.retryCount < 2 (최대 2회 재시도)
 */
function canRetryAgent(context: JarvisMachineContext): boolean {
  return (context.error?.retryCount ?? 0) < 2;
}
```

### Action (Context 업데이트)

```typescript
/**
 * XState Action — Context를 새 값으로 대체
 *
 * 패턴: context = { ...context, spec: newSpec, ... }
 */

// Action: SPEC 저장
const saveSpec = assign({
  spec: (context, event) => event.payload.spec,
  lastTransitionAt: () => new Date().toISOString(),
  environment_bundle: (context, event) => ({
    ...context.environment_bundle,
    spec_md: event.payload.spec_md,
    acceptance_criteria: event.payload.spec.acceptance_criteria,
    last_updated_at: new Date().toISOString(),
    last_updated_by: 'spec-agent'
  })
});

// Action: 토큰 소비 기록
const recordTokenConsumption = assign({
  execution_budget: (context, event) => ({
    ...context.execution_budget,
    consumed_tokens: context.execution_budget.consumed_tokens + event.payload.tokens_used
  })
});

// Action: 에러 저장
const recordError = assign({
  error: (context, event) => ({
    code: event.payload.code,
    message: event.payload.message,
    agentId: event.payload.agentId,
    failedState: context.currentState,
    timestamp: new Date().toISOString(),
    retryCount: (context.error?.retryCount ?? 0) + 1
  })
});

// Action: Gate 추가
const addPendingGate = assign({
  pending_gates: (context, event) => [
    ...context.pending_gates,
    {
      gateId: `gate_${Date.now()}`,
      gateLevel: event.payload.gateLevel,
      gateName: event.payload.gateName,
      reason: event.payload.reason,
      riskFactors: event.payload.riskFactors,
      createdAt: new Date().toISOString()
    }
  ]
});

// Action: Gate 승인
const approvePendingGate = assign({
  pending_gates: (context, event) =>
    context.pending_gates.filter((g) => g.gateId !== event.payload.gateId),
  approved_gates: (context, event) => [
    ...context.approved_gates,
    {
      gateId: event.payload.gateId,
      approvedBy: event.payload.approvedBy,
      approvedAt: new Date().toISOString(),
      decision: 'APPROVED'
    }
  ]
});
```

---

## 구현 패턴

### packages/core/src/machine.ts

```typescript
import { createMachine, assign } from 'xstate';
import { JarvisMachineContext } from '@jarvis-os/core/types';

/**
 * jarvisMachine — JARVIS OS 상태 머신 정의
 *
 * 18개 상태, 모든 전이에 Context 업데이트 포함
 */
export const jarvisMachine = createMachine({
  /** @xstate-layout ... */
  id: 'jarvis-orchestration',
  initial: 'IDLE',
  context: {
    // 기본값 (주입됨)
    runId: null,
    sessionId: null,
    // ... 모든 필드
  } as JarvisMachineContext,

  states: {
    IDLE: {
      on: {
        SUBMIT_REQUEST: {
          target: 'SPEC_ANALYSIS',
          actions: [
            assign({
              runId: () => `run_${new Date().toISOString().split('T')[0]}_${Math.random()}`,
              sessionId: (_, event) => event.payload.sessionId,
              user: (_, event) => event.payload.user,
              originalRequest: (_, event) => event.payload.request,
              startedAt: () => new Date().toISOString(),
              currentState: () => 'SPEC_ANALYSIS',
              lastTransitionAt: () => new Date().toISOString()
            })
          ]
        }
      }
    },

    SPEC_ANALYSIS: {
      // Spec Agent invoked
      invoke: {
        src: (context) => specAgent.execute(context),
        onDone: {
          target: 'PLANNING',
          actions: assign({
            spec: (_, event) => event.data.spec,
            lastTransitionAt: () => new Date().toISOString(),
            currentState: () => 'PLANNING',
            environment_bundle: (context, event) => ({
              ...context.environment_bundle,
              spec_md: event.data.spec_md,
              last_updated_at: new Date().toISOString(),
              last_updated_by: 'spec-agent'
            })
          })
        },
        onError: {
          target: 'ERROR_RECOVERY',
          actions: assign({
            error: (_, event) => ({
              code: 'AGENT_TIMEOUT',
              message: event.data.message,
              agentId: 'spec-agent',
              failedState: 'SPEC_ANALYSIS',
              timestamp: new Date().toISOString(),
              retryCount: 1
            })
          })
        }
      }
    },

    // ... 16 more states

    COMPLETED: {
      type: 'final',
      entry: assign({
        currentState: () => 'COMPLETED'
      })
    }
  }
});
```

### Checkpoint 저장/복원

```typescript
// packages/core/src/checkpoint-manager.ts

export async function saveContextCheckpoint(
  context: JarvisMachineContext,
  runId: string
): Promise<Result<string, DBError>> {
  const checkpoint_id = generateUUID();

  // 전체 context를 JSON으로 직렬화
  const contextJson = JSON.stringify(context);

  // DB에 저장 (queries: saveCheckpoint)
  const result = await auditLog.saveCheckpoint({
    run_id: runId,
    xstate_context: context,
    created_by: 'orchestrator'
  });

  return result;
}

export async function loadContextCheckpoint(
  checkpoint_id: string
): Promise<Result<JarvisMachineContext, DBError>> {
  const result = await auditLog.loadCheckpoint(checkpoint_id);
  if (!result.ok) return result;

  return Ok(result.data.xstate_context as JarvisMachineContext);
}
```

---

## 참고 문서

- `.claude/schemas/xstate-context.json` — JSON 스키마 (런타임 검증용)
- `.claude/design/checkpoint-format.md` — Checkpoint 저장 형식
- `packages/core/src/machine.ts` — XState 머신 구현 (Phase 1)
- `.claude/design/state-manager-integration.md` — StateManager와의 통합

