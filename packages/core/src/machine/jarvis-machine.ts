// XState v5 상태 머신 — JARVIS 오케스트레이션 핵심 머신 (19개 상태)
import { setup, assign } from "xstate";
import {
  MACHINE_STATES,
  MACHINE_EVENTS,
  AGENT_TYPES,
  type AgentType,
  type PolicyDecision,
  type JarvisError,
} from "@jarvis/shared";
import type { JarvisMachineContext } from "./context.js";
import type { GateApproval } from "./context.js";
import { createInitialContext } from "./context.js";
import { createEnvironmentBundle } from "../types/environment.js";
import type { SpecRef, PlanRef, ChangeSetRef, ReviewRef, TestResultRef } from "../types/environment.js";

// 머신 이벤트 타입 정의
export type JarvisMachineEvent =
  | { type: "USER_REQUEST"; input: string }
  | { type: "SPEC_COMPLETE"; spec: SpecRef }
  | { type: "SPEC_NEED_CLARIFICATION"; question: string }
  | { type: "ALLOW"; decision: PolicyDecision }
  | { type: "CONSTRAINED_ALLOW"; decision: PolicyDecision }
  | { type: "APPROVAL_REQUIRED"; decision: PolicyDecision }
  | { type: "DENY"; decision: PolicyDecision }
  | { type: "APPROVED"; approval: GateApproval }
  | { type: "REJECTED"; reason: string }
  | { type: "SCOPE_MODIFIED"; modifications: readonly string[] }
  | { type: "TIMEOUT" }
  | { type: "PLAN_COMPLETE"; plan: PlanRef }
  | { type: "PLAN_NEEDS_TOOLS"; tools: readonly string[] }
  | { type: "NO_CODE_NEEDED" }
  | { type: "CODE_COMPLETE"; changeSet: ChangeSetRef }
  | { type: "REVIEW_PASS"; review: ReviewRef }
  | { type: "REVIEW_BLOCKERS"; review: ReviewRef }
  | { type: "APPLY_SUCCESS" }
  | { type: "APPLY_FAILED"; error: JarvisError }
  | { type: "TEST_PASS"; result: TestResultRef }
  | { type: "TEST_FAIL"; result: TestResultRef }
  | { type: "SKIPPED" }
  | { type: "SUCCESS" }
  | { type: "ERROR"; error: JarvisError }
  | { type: "RECOVERY_SUCCESS" }
  | { type: "RECOVERY_FAILED"; error: JarvisError }
  | { type: "USER_RESPONSE"; response: string }
  | { type: "CANCEL" }
  | { type: "MOBILE_ACTION_SUCCESS" }
  | { type: "MOBILE_ACTION_FAILED"; error: JarvisError }
  | { type: "MOBILE_DEVICE_DISCONNECTED" };

// 머신 생성 입력 타입
export interface JarvisMachineInput {
  readonly runId: string;
  readonly sessionId: string;
}

// JARVIS 상태 머신 정의
export const jarvisMachine = setup({
  types: {
    context: {} as JarvisMachineContext,
    events: {} as JarvisMachineEvent,
    input: {} as JarvisMachineInput,
  },
  guards: {
    // 정책 허용 여부 검증
    isPolicyAllow: ({ context }) =>
      context.policyDecision?.outcome.status === "ALLOW",
    isPolicyConstrainedAllow: ({ context }) =>
      context.policyDecision?.outcome.status === "CONSTRAINED_ALLOW",
    isPolicyApprovalRequired: ({ context }) =>
      context.policyDecision?.outcome.status === "APPROVAL_REQUIRED",
    isPolicyDeny: ({ context }) =>
      context.policyDecision?.outcome.status === "DENY",
    // 재시도 가능 여부 검증
    canRetry: ({ context }) => context.retryCount < 3,
  },
  actions: {
    // 에이전트 할당
    assignSpecAgent: assign({
      currentAgent: () => AGENT_TYPES.SPEC_AGENT as AgentType,
      lastTransitionAt: () => new Date().toISOString(),
    }),
    assignPolicyAgent: assign({
      currentAgent: () => AGENT_TYPES.POLICY_RISK as AgentType,
      lastTransitionAt: () => new Date().toISOString(),
    }),
    assignPlannerAgent: assign({
      currentAgent: () => AGENT_TYPES.PLANNER as AgentType,
      lastTransitionAt: () => new Date().toISOString(),
    }),
    assignCodegenAgent: assign({
      currentAgent: () => AGENT_TYPES.CODEGEN as AgentType,
      lastTransitionAt: () => new Date().toISOString(),
    }),
    assignReviewAgent: assign({
      currentAgent: () => AGENT_TYPES.REVIEW as AgentType,
      lastTransitionAt: () => new Date().toISOString(),
    }),
    assignTestBuildAgent: assign({
      currentAgent: () => AGENT_TYPES.TEST_BUILD as AgentType,
      lastTransitionAt: () => new Date().toISOString(),
    }),
    assignExecutorAgent: assign({
      currentAgent: () => AGENT_TYPES.EXECUTOR as AgentType,
      lastTransitionAt: () => new Date().toISOString(),
    }),
    assignRollbackAgent: assign({
      currentAgent: () => AGENT_TYPES.ROLLBACK as AgentType,
      lastTransitionAt: () => new Date().toISOString(),
    }),
    // 에이전트 해제
    clearAgent: assign({
      currentAgent: () => null,
      lastTransitionAt: () => new Date().toISOString(),
    }),
    // 재시도 카운트 초기화
    resetRetryCount: assign({
      retryCount: () => 0,
      lastTransitionAt: () => new Date().toISOString(),
    }),
  },
}).createMachine({
  id: "jarvis",
  context: ({ input }) => createInitialContext(
    input.runId,
    input.sessionId,
    createEnvironmentBundle(input.runId, input.sessionId),
  ),
  initial: MACHINE_STATES.IDLE,
  states: {
    // 대기 상태 — 사용자 요청 수신 대기
    [MACHINE_STATES.IDLE]: {
      on: {
        [MACHINE_EVENTS.USER_REQUEST]: {
          target: MACHINE_STATES.SPEC_ANALYSIS,
        },
      },
    },

    // 스펙 분석 — Spec Agent가 요구사항 분석
    [MACHINE_STATES.SPEC_ANALYSIS]: {
      entry: "assignSpecAgent",
      on: {
        [MACHINE_EVENTS.SPEC_COMPLETE]: {
          target: MACHINE_STATES.POLICY_CHECK,
          actions: "clearAgent",
        },
        [MACHINE_EVENTS.SPEC_NEED_CLARIFICATION]: {
          target: MACHINE_STATES.AWAITING_USER_INPUT,
          actions: "clearAgent",
        },
        [MACHINE_EVENTS.ERROR]: {
          target: MACHINE_STATES.ERROR_RECOVERY,
          actions: "clearAgent",
        },
      },
    },

    // 정책 판정 — Policy/Risk Agent가 정책 검토
    [MACHINE_STATES.POLICY_CHECK]: {
      entry: "assignPolicyAgent",
      on: {
        [MACHINE_EVENTS.ALLOW]: {
          target: MACHINE_STATES.PLANNING,
          actions: "clearAgent",
        },
        [MACHINE_EVENTS.CONSTRAINED_ALLOW]: {
          target: MACHINE_STATES.PLANNING,
          actions: "clearAgent",
        },
        [MACHINE_EVENTS.APPROVAL_REQUIRED]: {
          target: MACHINE_STATES.GATE_PLAN_APPROVAL,
          actions: "clearAgent",
        },
        [MACHINE_EVENTS.DENY]: {
          target: MACHINE_STATES.DENIED,
          actions: "clearAgent",
        },
        [MACHINE_EVENTS.ERROR]: {
          target: MACHINE_STATES.ERROR_RECOVERY,
          actions: "clearAgent",
        },
      },
    },

    // Gate #1: 계획/범위 승인 요청
    [MACHINE_STATES.GATE_PLAN_APPROVAL]: {
      on: {
        [MACHINE_EVENTS.APPROVED]: {
          target: MACHINE_STATES.PLANNING,
        },
        [MACHINE_EVENTS.REJECTED]: {
          target: MACHINE_STATES.DENIED,
        },
        [MACHINE_EVENTS.SCOPE_MODIFIED]: {
          target: MACHINE_STATES.POLICY_CHECK,
        },
        [MACHINE_EVENTS.TIMEOUT]: {
          target: MACHINE_STATES.DENIED,
        },
      },
    },

    // 계획 수립 — Planner Agent가 실행 계획 생성
    [MACHINE_STATES.PLANNING]: {
      entry: "assignPlannerAgent",
      on: {
        [MACHINE_EVENTS.PLAN_COMPLETE]: {
          target: MACHINE_STATES.CODE_GENERATION,
          actions: "clearAgent",
        },
        [MACHINE_EVENTS.PLAN_NEEDS_TOOLS]: {
          target: MACHINE_STATES.GATE_TOOL_APPROVAL,
          actions: "clearAgent",
        },
        [MACHINE_EVENTS.NO_CODE_NEEDED]: {
          target: MACHINE_STATES.MOBILE_ACTION_EXECUTION,
          actions: "clearAgent",
        },
        [MACHINE_EVENTS.ERROR]: {
          target: MACHINE_STATES.ERROR_RECOVERY,
          actions: "clearAgent",
        },
      },
    },

    // Gate #1A: 도구/패키지/네트워크 승인
    [MACHINE_STATES.GATE_TOOL_APPROVAL]: {
      on: {
        [MACHINE_EVENTS.APPROVED]: {
          target: MACHINE_STATES.CODE_GENERATION,
        },
        [MACHINE_EVENTS.REJECTED]: {
          target: MACHINE_STATES.DENIED,
        },
      },
    },

    // 코드 생성 — Codegen Agent가 코드 생성
    [MACHINE_STATES.CODE_GENERATION]: {
      entry: "assignCodegenAgent",
      on: {
        [MACHINE_EVENTS.CODE_COMPLETE]: {
          target: MACHINE_STATES.CODE_REVIEW,
          actions: "clearAgent",
        },
        [MACHINE_EVENTS.ERROR]: {
          target: MACHINE_STATES.ERROR_RECOVERY,
          actions: "clearAgent",
        },
      },
    },

    // 코드 리뷰 — Review Agent가 정적 분석/보안 검토
    [MACHINE_STATES.CODE_REVIEW]: {
      entry: "assignReviewAgent",
      on: {
        [MACHINE_EVENTS.REVIEW_PASS]: {
          target: MACHINE_STATES.GATE_APPLY_CHANGES,
          actions: "clearAgent",
        },
        [MACHINE_EVENTS.REVIEW_BLOCKERS]: {
          target: MACHINE_STATES.PLANNING,
          actions: "clearAgent",
        },
        [MACHINE_EVENTS.ERROR]: {
          target: MACHINE_STATES.ERROR_RECOVERY,
          actions: "clearAgent",
        },
      },
    },

    // Gate #2: 변경 적용 승인
    [MACHINE_STATES.GATE_APPLY_CHANGES]: {
      on: {
        [MACHINE_EVENTS.APPROVED]: {
          target: MACHINE_STATES.APPLY_CHANGES,
        },
        [MACHINE_EVENTS.REJECTED]: {
          target: MACHINE_STATES.DENIED,
        },
      },
    },

    // 변경 적용 — Executor Agent가 패치 적용
    [MACHINE_STATES.APPLY_CHANGES]: {
      entry: "assignExecutorAgent",
      on: {
        [MACHINE_EVENTS.APPLY_SUCCESS]: {
          target: MACHINE_STATES.TESTING,
          actions: "clearAgent",
        },
        [MACHINE_EVENTS.APPLY_FAILED]: {
          target: MACHINE_STATES.ERROR_RECOVERY,
          actions: "clearAgent",
        },
      },
    },

    // 테스트 검증 — Test/Build Agent가 검증
    [MACHINE_STATES.TESTING]: {
      entry: "assignTestBuildAgent",
      on: {
        [MACHINE_EVENTS.TEST_PASS]: {
          target: MACHINE_STATES.GATE_DEPLOY,
          actions: "clearAgent",
        },
        [MACHINE_EVENTS.TEST_FAIL]: {
          target: MACHINE_STATES.PLANNING,
          actions: "clearAgent",
        },
        [MACHINE_EVENTS.ERROR]: {
          target: MACHINE_STATES.ERROR_RECOVERY,
          actions: "clearAgent",
        },
      },
    },

    // Gate #3: 실행/배포 승인
    [MACHINE_STATES.GATE_DEPLOY]: {
      on: {
        [MACHINE_EVENTS.APPROVED]: {
          target: MACHINE_STATES.DEPLOY_EXECUTE,
        },
        [MACHINE_EVENTS.SKIPPED]: {
          target: MACHINE_STATES.COMPLETED,
        },
        [MACHINE_EVENTS.REJECTED]: {
          target: MACHINE_STATES.DENIED,
        },
      },
    },

    // 배포 실행 — Executor Agent가 실행/배포
    [MACHINE_STATES.DEPLOY_EXECUTE]: {
      entry: "assignExecutorAgent",
      on: {
        [MACHINE_EVENTS.SUCCESS]: {
          target: MACHINE_STATES.COMPLETED,
          actions: "clearAgent",
        },
        [MACHINE_EVENTS.ERROR]: {
          target: MACHINE_STATES.ERROR_RECOVERY,
          actions: "clearAgent",
        },
      },
    },

    // 작업 성공 완료
    [MACHINE_STATES.COMPLETED]: {
      type: "final",
    },

    // 정책 거부 또는 사용자 거부로 종료
    [MACHINE_STATES.DENIED]: {
      type: "final",
    },

    // 에러 복구 — Rollback Agent가 복구
    [MACHINE_STATES.ERROR_RECOVERY]: {
      entry: "assignRollbackAgent",
      on: {
        [MACHINE_EVENTS.RECOVERY_SUCCESS]: {
          target: MACHINE_STATES.COMPLETED,
          actions: "clearAgent",
        },
        [MACHINE_EVENTS.RECOVERY_FAILED]: {
          target: MACHINE_STATES.EMERGENCY_STOP,
          actions: "clearAgent",
        },
      },
    },

    // 비상 중단 — 모든 Capability 무효화
    [MACHINE_STATES.EMERGENCY_STOP]: {
      type: "final",
    },

    // 사용자 추가 입력 대기
    [MACHINE_STATES.AWAITING_USER_INPUT]: {
      on: {
        [MACHINE_EVENTS.USER_RESPONSE]: {
          target: MACHINE_STATES.SPEC_ANALYSIS,
        },
        [MACHINE_EVENTS.CANCEL]: {
          target: MACHINE_STATES.DENIED,
        },
      },
    },

    // 모바일 디바이스 액션 실행
    [MACHINE_STATES.MOBILE_ACTION_EXECUTION]: {
      entry: "assignExecutorAgent",
      on: {
        [MACHINE_EVENTS.MOBILE_ACTION_SUCCESS]: {
          target: MACHINE_STATES.COMPLETED,
          actions: "clearAgent",
        },
        [MACHINE_EVENTS.MOBILE_ACTION_FAILED]: {
          target: MACHINE_STATES.ERROR_RECOVERY,
          actions: "clearAgent",
        },
        [MACHINE_EVENTS.MOBILE_DEVICE_DISCONNECTED]: {
          target: MACHINE_STATES.AWAITING_USER_INPUT,
          actions: "clearAgent",
        },
        [MACHINE_EVENTS.ERROR]: {
          target: MACHINE_STATES.ERROR_RECOVERY,
          actions: "clearAgent",
        },
      },
    },
  },
});

// 머신 타입 추출
export type JarvisMachine = typeof jarvisMachine;
