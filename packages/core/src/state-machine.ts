// XState v5 상태 머신 — JARVIS OS 전체 실행 흐름을 18개 상태로 정의한다
// 상태 전이 이벤트는 .claude/schemas/state-machine.json 스키마를 준수한다
// Orchestrator 에이전트가 이 머신을 구동하며 흐름을 제어한다

import { createMachine, assign } from 'xstate';
import type {
  AgentName,
  PolicyDecision,
  CapabilityToken,
  TrustMode,
  JarvisErrorCode,
} from '@jarvis/shared';

// ────────────────────────────────────────────────────────────
// 로컬 에러 타입 — types/common.ts의 JarvisError 인터페이스와 동일한 구조
// ────────────────────────────────────────────────────────────

/** JARVIS 에러 인터페이스 — 상태 머신 컨텍스트에서 사용하는 최소 에러 구조 */
export interface JarvisError {
  readonly code: JarvisErrorCode;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

// ────────────────────────────────────────────────────────────
// 상태 머신 컨텍스트 타입 정의
// ────────────────────────────────────────────────────────────

/** 상태 머신 컨텍스트 — 실행 세션 전체의 공유 상태 */
export interface JarvisMachineContext {
  /** 현재 실행 단위 고유 ID */
  readonly runId: string;
  /** 사용자 세션 ID */
  readonly sessionId: string;
  /** 신뢰 모드 — 자동화 수준 결정 */
  readonly trustMode: TrustMode;
  /** 현재 작업 중인 에이전트 이름 (없으면 null) */
  currentAgent: AgentName | null;
  /** 정책 판정 결과 (POLICY_CHECK 완료 후 설정) */
  policyDecision: PolicyDecision | null;
  /** 발급된 Capability Token 목록 */
  capabilities: CapabilityToken[];
  /** 위험도 점수 (0~100) */
  riskScore: number;
  /** 상태 변경 이력 — 타임라인 추적용 */
  timeline: string[];
  /** 현재 처리 중인 사용자 입력 원문 */
  userInput: string;
  /** 마지막으로 발생한 에러 (있을 경우) */
  lastError: JarvisError | null;
  /** 재시도 횟수 — 무한 루프 방지 */
  retryCount: number;
}

// ────────────────────────────────────────────────────────────
// 상태 머신 이벤트 타입 정의
// ────────────────────────────────────────────────────────────

/** 사용자 요청 수신 이벤트 */
export interface UserRequestEvent {
  readonly type: 'USER_REQUEST';
  readonly input: string;
  readonly sessionId: string;
  readonly trustMode: TrustMode;
}

/** 명세 분석 완료 이벤트 */
export interface SpecCompleteEvent {
  readonly type: 'SPEC_COMPLETE';
  readonly specId: string;
}

/** 명세 추가 정보 요청 이벤트 */
export interface SpecNeedClarificationEvent {
  readonly type: 'SPEC_NEED_CLARIFICATION';
  readonly question: string;
}

/** 정책 허용 이벤트 */
export interface PolicyAllowEvent {
  readonly type: 'ALLOW';
  readonly policyDecision: PolicyDecision;
}

/** 정책 조건부 허용 이벤트 */
export interface PolicyConstrainedAllowEvent {
  readonly type: 'CONSTRAINED_ALLOW';
  readonly policyDecision: PolicyDecision;
}

/** 정책 승인 요청 이벤트 */
export interface PolicyApprovalRequiredEvent {
  readonly type: 'APPROVAL_REQUIRED';
  readonly policyDecision: PolicyDecision;
}

/** 정책 거부 이벤트 */
export interface PolicyDenyEvent {
  readonly type: 'DENY';
  readonly reason: string;
}

/** Gate 승인 이벤트 */
export interface GateApprovedEvent {
  readonly type: 'APPROVED';
  readonly approvedBy: string;
  readonly timestamp: string;
}

/** Gate 거부 이벤트 */
export interface GateRejectedEvent {
  readonly type: 'REJECTED';
  readonly reason: string;
}

/** Gate 범위 수정 이벤트 */
export interface GateScopeModifiedEvent {
  readonly type: 'SCOPE_MODIFIED';
  readonly newScope: string;
}

/** Gate 타임아웃 이벤트 */
export interface GateTimeoutEvent {
  readonly type: 'TIMEOUT';
}

/** Gate 건너뜀 이벤트 (배포 불필요 시) */
export interface GateSkippedEvent {
  readonly type: 'SKIPPED';
}

/** 계획 완료 이벤트 */
export interface PlanCompleteEvent {
  readonly type: 'PLAN_COMPLETE';
  readonly planId: string;
}

/** 계획 도구 승인 필요 이벤트 */
export interface PlanNeedsToolsEvent {
  readonly type: 'PLAN_NEEDS_TOOLS';
  readonly requiredTools: readonly string[];
}

/** 코드 불필요 이벤트 (액션 실행만 필요) */
export interface NoCodeNeededEvent {
  readonly type: 'NO_CODE_NEEDED';
}

/** 코드 생성 완료 이벤트 */
export interface CodeCompleteEvent {
  readonly type: 'CODE_COMPLETE';
  readonly changesetId: string;
}

/** 코드 리뷰 통과 이벤트 */
export interface ReviewPassEvent {
  readonly type: 'REVIEW_PASS';
  readonly reviewId: string;
}

/** 코드 리뷰 블로커 발견 이벤트 */
export interface ReviewBlockersEvent {
  readonly type: 'REVIEW_BLOCKERS';
  readonly blockers: readonly string[];
}

/** 변경 적용 성공 이벤트 */
export interface ApplySuccessEvent {
  readonly type: 'APPLY_SUCCESS';
  readonly appliedFiles: readonly string[];
}

/** 변경 적용 실패 이벤트 */
export interface ApplyFailedEvent {
  readonly type: 'APPLY_FAILED';
  readonly error: JarvisError;
}

/** 테스트 통과 이벤트 */
export interface TestPassEvent {
  readonly type: 'TEST_PASS';
  readonly reportId: string;
}

/** 테스트 실패 이벤트 */
export interface TestFailEvent {
  readonly type: 'TEST_FAIL';
  readonly failures: readonly string[];
}

/** 배포 실행 성공 이벤트 */
export interface DeploySuccessEvent {
  readonly type: 'SUCCESS';
}

/** 에러 발생 이벤트 */
export interface ErrorEvent {
  readonly type: 'ERROR';
  readonly error: JarvisError;
}

/** 에러 복구 성공 이벤트 */
export interface RecoverySuccessEvent {
  readonly type: 'RECOVERY_SUCCESS';
}

/** 에러 복구 실패 이벤트 */
export interface RecoveryFailedEvent {
  readonly type: 'RECOVERY_FAILED';
  readonly error: JarvisError;
}

/** 사용자 응답 수신 이벤트 (명세 보완 정보) */
export interface UserResponseEvent {
  readonly type: 'USER_RESPONSE';
  readonly response: string;
}

/** 사용자 취소 이벤트 */
export interface UserCancelEvent {
  readonly type: 'CANCEL';
}

/** 모바일 액션 성공 이벤트 */
export interface MobileActionSuccessEvent {
  readonly type: 'MOBILE_ACTION_SUCCESS';
  readonly actionId: string;
}

/** 모바일 액션 실패 이벤트 */
export interface MobileActionFailedEvent {
  readonly type: 'MOBILE_ACTION_FAILED';
  readonly error: JarvisError;
}

/** 모바일 디바이스 연결 해제 이벤트 */
export interface MobileDeviceDisconnectedEvent {
  readonly type: 'MOBILE_DEVICE_DISCONNECTED';
}

/** 모든 이벤트의 유니온 타입 */
export type JarvisMachineEvent =
  | UserRequestEvent
  | SpecCompleteEvent
  | SpecNeedClarificationEvent
  | PolicyAllowEvent
  | PolicyConstrainedAllowEvent
  | PolicyApprovalRequiredEvent
  | PolicyDenyEvent
  | GateApprovedEvent
  | GateRejectedEvent
  | GateScopeModifiedEvent
  | GateTimeoutEvent
  | GateSkippedEvent
  | PlanCompleteEvent
  | PlanNeedsToolsEvent
  | NoCodeNeededEvent
  | CodeCompleteEvent
  | ReviewPassEvent
  | ReviewBlockersEvent
  | ApplySuccessEvent
  | ApplyFailedEvent
  | TestPassEvent
  | TestFailEvent
  | DeploySuccessEvent
  | ErrorEvent
  | RecoverySuccessEvent
  | RecoveryFailedEvent
  | UserResponseEvent
  | UserCancelEvent
  | MobileActionSuccessEvent
  | MobileActionFailedEvent
  | MobileDeviceDisconnectedEvent;

// ────────────────────────────────────────────────────────────
// 상태 이름 상수 — 타이포 방지용 enum
// ────────────────────────────────────────────────────────────

/** JARVIS 상태 머신의 모든 상태 이름 */
export enum JarvisState {
  IDLE = 'IDLE',
  SPEC_ANALYSIS = 'SPEC_ANALYSIS',
  POLICY_CHECK = 'POLICY_CHECK',
  GATE_PLAN_APPROVAL = 'GATE_PLAN_APPROVAL',
  PLANNING = 'PLANNING',
  GATE_TOOL_APPROVAL = 'GATE_TOOL_APPROVAL',
  CODE_GENERATION = 'CODE_GENERATION',
  CODE_REVIEW = 'CODE_REVIEW',
  GATE_APPLY_CHANGES = 'GATE_APPLY_CHANGES',
  APPLY_CHANGES = 'APPLY_CHANGES',
  TESTING = 'TESTING',
  GATE_DEPLOY = 'GATE_DEPLOY',
  DEPLOY_EXECUTE = 'DEPLOY_EXECUTE',
  COMPLETED = 'COMPLETED',
  DENIED = 'DENIED',
  ERROR_RECOVERY = 'ERROR_RECOVERY',
  EMERGENCY_STOP = 'EMERGENCY_STOP',
  AWAITING_USER_INPUT = 'AWAITING_USER_INPUT',
  MOBILE_ACTION_EXECUTION = 'MOBILE_ACTION_EXECUTION',
}

// ────────────────────────────────────────────────────────────
// 타임라인 기록 헬퍼 — 상태 변경 이력을 불변하게 추가
// ────────────────────────────────────────────────────────────

/**
 * 현재 타임라인에 새 항목을 추가한 새 배열을 반환한다
 * 원본 배열을 변경하지 않는다 (불변성 유지)
 */
function appendTimeline(timeline: string[], state: string, detail?: string): string[] {
  const entry = `[${new Date().toISOString()}] ${state}${detail ? `: ${detail}` : ''}`;
  return [...timeline, entry];
}

// ────────────────────────────────────────────────────────────
// XState v5 상태 머신 정의
// ────────────────────────────────────────────────────────────

/**
 * JARVIS OS 핵심 상태 머신
 * - 18개 상태, 전체 실행 흐름을 XState v5로 정의
 * - Orchestrator 에이전트가 이 머신을 구동한다
 * - 모든 상태 전이는 감사 로그에 자동 기록된다
 */
export const jarvisMachine = createMachine(
  {
    // 머신 ID — 감사 로그 참조용
    id: 'jarvis-os',
    // 타입 안전성을 위한 타입 파라미터
    types: {} as {
      context: JarvisMachineContext;
      events: JarvisMachineEvent;
    },

    // ──── 초기 상태 ────
    initial: JarvisState.IDLE,

    // ──── 초기 컨텍스트 ────
    context: {
      runId: '',
      sessionId: '',
      trustMode: 'suggest',
      currentAgent: null,
      policyDecision: null,
      capabilities: [],
      riskScore: 0,
      timeline: [],
      userInput: '',
      lastError: null,
      retryCount: 0,
    },

    // ──── 상태 정의 ────
    states: {
      // ────── IDLE: 대기 상태 ──────
      // 사용자 요청 수신 대기. USER_REQUEST 이벤트로 SPEC_ANALYSIS로 전이한다.
      [JarvisState.IDLE]: {
        on: {
          USER_REQUEST: {
            target: JarvisState.SPEC_ANALYSIS,
            actions: assign({
              userInput: ({ event }) => (event as UserRequestEvent).input,
              sessionId: ({ event }) => (event as UserRequestEvent).sessionId,
              trustMode: ({ event }) => (event as UserRequestEvent).trustMode,
              currentAgent: () => 'spec-agent' as AgentName,
              timeline: ({ context, event }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.SPEC_ANALYSIS,
                  `요청 수신: ${(event as UserRequestEvent).input.slice(0, 50)}`,
                ),
              retryCount: () => 0,
              lastError: () => null,
            }),
          },
        },
      },

      // ────── SPEC_ANALYSIS: 명세 분석 ──────
      // spec-agent가 사용자 의도를 분석하고 요구사항 명세를 생성한다.
      [JarvisState.SPEC_ANALYSIS]: {
        on: {
          SPEC_COMPLETE: {
            target: JarvisState.POLICY_CHECK,
            actions: assign({
              currentAgent: () => 'policy-risk' as AgentName,
              timeline: ({ context }) =>
                appendTimeline(context.timeline, JarvisState.POLICY_CHECK, '명세 분석 완료'),
            }),
          },
          SPEC_NEED_CLARIFICATION: {
            target: JarvisState.AWAITING_USER_INPUT,
            actions: assign({
              currentAgent: () => null,
              timeline: ({ context }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.AWAITING_USER_INPUT,
                  '추가 정보 요청',
                ),
            }),
          },
          ERROR: {
            target: JarvisState.ERROR_RECOVERY,
            actions: assign({
              lastError: ({ event }) => (event as ErrorEvent).error,
              currentAgent: () => 'rollback' as AgentName,
              timeline: ({ context, event }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.ERROR_RECOVERY,
                  `에러: ${(event as ErrorEvent).error.code}`,
                ),
            }),
          },
        },
      },

      // ────── POLICY_CHECK: 정책 판정 ──────
      // policy-risk 에이전트가 요청의 위험도를 계산하고 정책 판정 결과를 생성한다.
      [JarvisState.POLICY_CHECK]: {
        on: {
          ALLOW: {
            target: JarvisState.PLANNING,
            actions: assign({
              policyDecision: ({ event }) => (event as PolicyAllowEvent).policyDecision,
              riskScore: ({ event }) =>
                (event as PolicyAllowEvent).policyDecision.outcome.risk_score,
              currentAgent: () => 'planner' as AgentName,
              timeline: ({ context }) =>
                appendTimeline(context.timeline, JarvisState.PLANNING, '정책 허용'),
            }),
          },
          CONSTRAINED_ALLOW: {
            target: JarvisState.PLANNING,
            actions: assign({
              policyDecision: ({ event }) =>
                (event as PolicyConstrainedAllowEvent).policyDecision,
              riskScore: ({ event }) =>
                (event as PolicyConstrainedAllowEvent).policyDecision.outcome.risk_score,
              currentAgent: () => 'planner' as AgentName,
              timeline: ({ context }) =>
                appendTimeline(context.timeline, JarvisState.PLANNING, '조건부 허용'),
            }),
          },
          APPROVAL_REQUIRED: {
            target: JarvisState.GATE_PLAN_APPROVAL,
            actions: assign({
              policyDecision: ({ event }) =>
                (event as PolicyApprovalRequiredEvent).policyDecision,
              riskScore: ({ event }) =>
                (event as PolicyApprovalRequiredEvent).policyDecision.outcome.risk_score,
              currentAgent: () => null,
              timeline: ({ context }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.GATE_PLAN_APPROVAL,
                  '사용자 승인 필요',
                ),
            }),
          },
          DENY: {
            target: JarvisState.DENIED,
            actions: assign({
              currentAgent: () => null,
              timeline: ({ context, event }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.DENIED,
                  `거부: ${(event as PolicyDenyEvent).reason}`,
                ),
            }),
          },
          ERROR: {
            target: JarvisState.ERROR_RECOVERY,
            actions: assign({
              lastError: ({ event }) => (event as ErrorEvent).error,
              currentAgent: () => 'rollback' as AgentName,
              timeline: ({ context, event }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.ERROR_RECOVERY,
                  `정책 판정 에러: ${(event as ErrorEvent).error.code}`,
                ),
            }),
          },
        },
      },

      // ────── GATE_PLAN_APPROVAL: Gate L1 — 계획 승인 게이트 ──────
      // 사용자에게 실행 계획과 범위를 보여주고 승인을 요청한다.
      // 타임아웃 또는 거부 시 DENIED로 전이한다.
      [JarvisState.GATE_PLAN_APPROVAL]: {
        on: {
          APPROVED: {
            target: JarvisState.PLANNING,
            actions: assign({
              currentAgent: () => 'planner' as AgentName,
              timeline: ({ context, event }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.PLANNING,
                  `Gate L1 승인: ${(event as GateApprovedEvent).approvedBy}`,
                ),
            }),
          },
          REJECTED: {
            target: JarvisState.DENIED,
            actions: assign({
              currentAgent: () => null,
              timeline: ({ context, event }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.DENIED,
                  `Gate L1 거부: ${(event as GateRejectedEvent).reason}`,
                ),
            }),
          },
          SCOPE_MODIFIED: {
            // 범위 수정 시 정책 재판정
            target: JarvisState.POLICY_CHECK,
            actions: assign({
              currentAgent: () => 'policy-risk' as AgentName,
              timeline: ({ context, event }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.POLICY_CHECK,
                  `범위 수정 재판정: ${(event as GateScopeModifiedEvent).newScope}`,
                ),
            }),
          },
          TIMEOUT: {
            target: JarvisState.DENIED,
            actions: assign({
              currentAgent: () => null,
              timeline: ({ context }) =>
                appendTimeline(context.timeline, JarvisState.DENIED, 'Gate L1 타임아웃'),
            }),
          },
        },
      },

      // ────── PLANNING: 실행 계획 수립 ──────
      // planner 에이전트가 작업을 분해하고 Task DAG를 포함한 실행 계획을 생성한다.
      [JarvisState.PLANNING]: {
        on: {
          PLAN_COMPLETE: {
            target: JarvisState.CODE_GENERATION,
            actions: assign({
              currentAgent: () => 'codegen' as AgentName,
              retryCount: () => 0,
              timeline: ({ context }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.CODE_GENERATION,
                  '계획 수립 완료',
                ),
            }),
          },
          PLAN_NEEDS_TOOLS: {
            target: JarvisState.GATE_TOOL_APPROVAL,
            actions: assign({
              currentAgent: () => null,
              timeline: ({ context, event }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.GATE_TOOL_APPROVAL,
                  `도구 승인 필요: ${(event as PlanNeedsToolsEvent).requiredTools.join(', ')}`,
                ),
            }),
          },
          NO_CODE_NEEDED: {
            // 코드 변경 없이 액션 실행만 필요한 경우
            target: JarvisState.GATE_APPLY_CHANGES,
            actions: assign({
              currentAgent: () => null,
              timeline: ({ context }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.GATE_APPLY_CHANGES,
                  '코드 불필요 — 직접 실행 승인 요청',
                ),
            }),
          },
          ERROR: {
            target: JarvisState.ERROR_RECOVERY,
            actions: assign({
              lastError: ({ event }) => (event as ErrorEvent).error,
              currentAgent: () => 'rollback' as AgentName,
              timeline: ({ context, event }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.ERROR_RECOVERY,
                  `계획 에러: ${(event as ErrorEvent).error.code}`,
                ),
            }),
          },
        },
      },

      // ────── GATE_TOOL_APPROVAL: Gate L1A — 도구/패키지 승인 게이트 ──────
      // 새 패키지 설치, 네트워크 접근, 외부 도구 사용에 대한 승인을 요청한다.
      [JarvisState.GATE_TOOL_APPROVAL]: {
        on: {
          APPROVED: {
            target: JarvisState.CODE_GENERATION,
            actions: assign({
              currentAgent: () => 'codegen' as AgentName,
              timeline: ({ context, event }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.CODE_GENERATION,
                  `도구 승인: ${(event as GateApprovedEvent).approvedBy}`,
                ),
            }),
          },
          REJECTED: {
            target: JarvisState.DENIED,
            actions: assign({
              currentAgent: () => null,
              timeline: ({ context, event }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.DENIED,
                  `도구 거부: ${(event as GateRejectedEvent).reason}`,
                ),
            }),
          },
        },
      },

      // ────── CODE_GENERATION: 코드 생성 ──────
      // codegen 에이전트가 ChangeSet(파일 추가/수정/diff)을 생성한다.
      [JarvisState.CODE_GENERATION]: {
        on: {
          CODE_COMPLETE: {
            target: JarvisState.CODE_REVIEW,
            actions: assign({
              currentAgent: () => 'review' as AgentName,
              timeline: ({ context }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.CODE_REVIEW,
                  '코드 생성 완료',
                ),
            }),
          },
          ERROR: {
            target: JarvisState.ERROR_RECOVERY,
            actions: assign({
              lastError: ({ event }) => (event as ErrorEvent).error,
              currentAgent: () => 'rollback' as AgentName,
              timeline: ({ context, event }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.ERROR_RECOVERY,
                  `코드 생성 에러: ${(event as ErrorEvent).error.code}`,
                ),
            }),
          },
        },
      },

      // ────── CODE_REVIEW: 코드 리뷰 ──────
      // review 에이전트가 보안 취약점, 코드 품질, 계약서 준수를 검사한다.
      // 블로커 발견 시 PLANNING으로 돌아가 재계획한다.
      [JarvisState.CODE_REVIEW]: {
        on: {
          REVIEW_PASS: {
            target: JarvisState.GATE_APPLY_CHANGES,
            actions: assign({
              currentAgent: () => null,
              timeline: ({ context }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.GATE_APPLY_CHANGES,
                  '코드 리뷰 통과',
                ),
            }),
          },
          REVIEW_BLOCKERS: {
            // 리뷰 블로커 발견 시 Planner로 피드백 — 재계획 루프
            target: JarvisState.PLANNING,
            actions: assign({
              currentAgent: () => 'planner' as AgentName,
              retryCount: ({ context }) => context.retryCount + 1,
              timeline: ({ context, event }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.PLANNING,
                  `리뷰 블로커 ${(event as ReviewBlockersEvent).blockers.length}건 — 재계획`,
                ),
            }),
          },
          ERROR: {
            target: JarvisState.ERROR_RECOVERY,
            actions: assign({
              lastError: ({ event }) => (event as ErrorEvent).error,
              currentAgent: () => 'rollback' as AgentName,
              timeline: ({ context, event }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.ERROR_RECOVERY,
                  `리뷰 에러: ${(event as ErrorEvent).error.code}`,
                ),
            }),
          },
        },
      },

      // ────── GATE_APPLY_CHANGES: Gate L2 — 변경 적용 승인 게이트 ──────
      // 사용자에게 실제 파일 변경 내용(diff)을 보여주고 최종 승인을 요청한다.
      [JarvisState.GATE_APPLY_CHANGES]: {
        on: {
          APPROVED: {
            target: JarvisState.APPLY_CHANGES,
            actions: assign({
              currentAgent: () => 'executor' as AgentName,
              timeline: ({ context, event }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.APPLY_CHANGES,
                  `Gate L2 승인: ${(event as GateApprovedEvent).approvedBy}`,
                ),
            }),
          },
          REJECTED: {
            target: JarvisState.DENIED,
            actions: assign({
              currentAgent: () => null,
              timeline: ({ context, event }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.DENIED,
                  `Gate L2 거부: ${(event as GateRejectedEvent).reason}`,
                ),
            }),
          },
        },
      },

      // ────── APPLY_CHANGES: 변경 적용 ──────
      // executor 에이전트가 Capability Token을 소비하여 실제 파일 변경을 적용한다.
      [JarvisState.APPLY_CHANGES]: {
        on: {
          APPLY_SUCCESS: {
            target: JarvisState.TESTING,
            actions: assign({
              currentAgent: () => 'test-build' as AgentName,
              timeline: ({ context, event }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.TESTING,
                  `변경 적용 완료: ${(event as ApplySuccessEvent).appliedFiles.length}개 파일`,
                ),
            }),
          },
          APPLY_FAILED: {
            target: JarvisState.ERROR_RECOVERY,
            actions: assign({
              lastError: ({ event }) => (event as ApplyFailedEvent).error,
              currentAgent: () => 'rollback' as AgentName,
              timeline: ({ context, event }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.ERROR_RECOVERY,
                  `변경 적용 실패: ${(event as ApplyFailedEvent).error.code}`,
                ),
            }),
          },
        },
      },

      // ────── TESTING: 테스트 실행 ──────
      // test-build 에이전트가 단위/통합/E2E 테스트를 실행하고 결과를 검증한다.
      // 테스트 실패 시 PLANNING으로 돌아가 수정 계획을 수립한다.
      [JarvisState.TESTING]: {
        on: {
          TEST_PASS: {
            target: JarvisState.GATE_DEPLOY,
            actions: assign({
              currentAgent: () => null,
              timeline: ({ context }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.GATE_DEPLOY,
                  '전체 테스트 통과',
                ),
            }),
          },
          TEST_FAIL: {
            // 테스트 실패 → Planner로 피드백하여 수정 계획 수립
            target: JarvisState.PLANNING,
            actions: assign({
              currentAgent: () => 'planner' as AgentName,
              retryCount: ({ context }) => context.retryCount + 1,
              timeline: ({ context, event }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.PLANNING,
                  `테스트 실패 ${(event as TestFailEvent).failures.length}건 — 재계획`,
                ),
            }),
          },
          ERROR: {
            target: JarvisState.ERROR_RECOVERY,
            actions: assign({
              lastError: ({ event }) => (event as ErrorEvent).error,
              currentAgent: () => 'rollback' as AgentName,
              timeline: ({ context, event }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.ERROR_RECOVERY,
                  `테스트 에러: ${(event as ErrorEvent).error.code}`,
                ),
            }),
          },
        },
      },

      // ────── GATE_DEPLOY: Gate L3 — 배포 승인 게이트 (선택적) ──────
      // 배포/실행이 필요한 경우 최종 승인을 요청한다.
      // SKIPPED: 배포 불필요 시 바로 COMPLETED로 전이한다.
      [JarvisState.GATE_DEPLOY]: {
        on: {
          APPROVED: {
            target: JarvisState.DEPLOY_EXECUTE,
            actions: assign({
              currentAgent: () => 'executor' as AgentName,
              timeline: ({ context, event }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.DEPLOY_EXECUTE,
                  `Gate L3 배포 승인: ${(event as GateApprovedEvent).approvedBy}`,
                ),
            }),
          },
          SKIPPED: {
            // 배포 불필요 — 코드 변경만으로 완료
            target: JarvisState.COMPLETED,
            actions: assign({
              currentAgent: () => null,
              timeline: ({ context }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.COMPLETED,
                  '배포 생략 — 작업 완료',
                ),
            }),
          },
          REJECTED: {
            target: JarvisState.DENIED,
            actions: assign({
              currentAgent: () => null,
              timeline: ({ context, event }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.DENIED,
                  `Gate L3 배포 거부: ${(event as GateRejectedEvent).reason}`,
                ),
            }),
          },
        },
      },

      // ────── DEPLOY_EXECUTE: 배포 실행 ──────
      // executor 에이전트가 Capability Token을 소비하여 배포/실행을 수행한다.
      [JarvisState.DEPLOY_EXECUTE]: {
        on: {
          SUCCESS: {
            target: JarvisState.COMPLETED,
            actions: assign({
              currentAgent: () => null,
              timeline: ({ context }) =>
                appendTimeline(context.timeline, JarvisState.COMPLETED, '배포 실행 성공'),
            }),
          },
          ERROR: {
            target: JarvisState.ERROR_RECOVERY,
            actions: assign({
              lastError: ({ event }) => (event as ErrorEvent).error,
              currentAgent: () => 'rollback' as AgentName,
              timeline: ({ context, event }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.ERROR_RECOVERY,
                  `배포 에러: ${(event as ErrorEvent).error.code}`,
                ),
            }),
          },
        },
      },

      // ────── ERROR_RECOVERY: 에러 복구 ──────
      // rollback 에이전트가 변경 사항을 롤백하고 Postmortem을 작성한다.
      [JarvisState.ERROR_RECOVERY]: {
        on: {
          RECOVERY_SUCCESS: {
            target: JarvisState.COMPLETED,
            actions: assign({
              currentAgent: () => null,
              lastError: () => null,
              timeline: ({ context }) =>
                appendTimeline(context.timeline, JarvisState.COMPLETED, '복구 성공'),
            }),
          },
          RECOVERY_FAILED: {
            target: JarvisState.EMERGENCY_STOP,
            actions: assign({
              lastError: ({ event }) => (event as RecoveryFailedEvent).error,
              currentAgent: () => null,
              timeline: ({ context, event }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.EMERGENCY_STOP,
                  `복구 실패 — 비상 중단: ${(event as RecoveryFailedEvent).error.code}`,
                ),
            }),
          },
        },
      },

      // ────── AWAITING_USER_INPUT: 사용자 추가 입력 대기 ──────
      // spec-agent가 모호한 요청에 대한 추가 정보를 사용자에게 요청한다.
      [JarvisState.AWAITING_USER_INPUT]: {
        on: {
          USER_RESPONSE: {
            target: JarvisState.SPEC_ANALYSIS,
            actions: assign({
              userInput: ({ context, event }) =>
                `${context.userInput}\n[보완 정보]: ${(event as UserResponseEvent).response}`,
              currentAgent: () => 'spec-agent' as AgentName,
              timeline: ({ context }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.SPEC_ANALYSIS,
                  '사용자 응답 수신 — 재분석',
                ),
            }),
          },
          CANCEL: {
            target: JarvisState.DENIED,
            actions: assign({
              currentAgent: () => null,
              timeline: ({ context }) =>
                appendTimeline(context.timeline, JarvisState.DENIED, '사용자 취소'),
            }),
          },
        },
      },

      // ────── MOBILE_ACTION_EXECUTION: 모바일 디바이스 액션 실행 ──────
      // executor 에이전트가 Companion App을 통해 모바일 디바이스 액션을 실행한다.
      // 반드시 해당 GATE를 통과한 후에만 진입할 수 있다.
      [JarvisState.MOBILE_ACTION_EXECUTION]: {
        on: {
          MOBILE_ACTION_SUCCESS: {
            target: JarvisState.COMPLETED,
            actions: assign({
              currentAgent: () => null,
              timeline: ({ context, event }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.COMPLETED,
                  `모바일 액션 성공: ${(event as MobileActionSuccessEvent).actionId}`,
                ),
            }),
          },
          MOBILE_ACTION_FAILED: {
            target: JarvisState.ERROR_RECOVERY,
            actions: assign({
              lastError: ({ event }) => (event as MobileActionFailedEvent).error,
              currentAgent: () => 'rollback' as AgentName,
              timeline: ({ context, event }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.ERROR_RECOVERY,
                  `모바일 액션 실패: ${(event as MobileActionFailedEvent).error.code}`,
                ),
            }),
          },
          MOBILE_DEVICE_DISCONNECTED: {
            // 디바이스 연결 해제 시 사용자에게 재연결 안내
            target: JarvisState.AWAITING_USER_INPUT,
            actions: assign({
              currentAgent: () => null,
              timeline: ({ context }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.AWAITING_USER_INPUT,
                  '모바일 디바이스 연결 해제 — 재연결 필요',
                ),
            }),
          },
          ERROR: {
            target: JarvisState.ERROR_RECOVERY,
            actions: assign({
              lastError: ({ event }) => (event as ErrorEvent).error,
              currentAgent: () => 'rollback' as AgentName,
              timeline: ({ context, event }) =>
                appendTimeline(
                  context.timeline,
                  JarvisState.ERROR_RECOVERY,
                  `모바일 에러: ${(event as ErrorEvent).error.code}`,
                ),
            }),
          },
        },
      },

      // ────── 종료 상태들 ──────

      /** 작업 성공 완료 — 모든 단계가 정상적으로 완료됨 */
      [JarvisState.COMPLETED]: {
        type: 'final',
      },

      /** 거부로 종료 — 정책 거부, Gate 거부, 사용자 취소 등 */
      [JarvisState.DENIED]: {
        type: 'final',
      },

      /** 비상 중단 — 복구 불가능한 에러. 모든 Capability Token을 무효화한다 */
      [JarvisState.EMERGENCY_STOP]: {
        type: 'final',
      },
    },
  },
);

// ────────────────────────────────────────────────────────────
// 상태 머신 유틸리티 함수
// ────────────────────────────────────────────────────────────

/**
 * 주어진 상태가 종료 상태인지 확인한다
 */
export function isFinalState(state: JarvisState): boolean {
  return (
    state === JarvisState.COMPLETED ||
    state === JarvisState.DENIED ||
    state === JarvisState.EMERGENCY_STOP
  );
}

/**
 * 주어진 상태가 Gate (사용자 승인 요청) 상태인지 확인한다
 */
export function isGateState(state: JarvisState): boolean {
  return (
    state === JarvisState.GATE_PLAN_APPROVAL ||
    state === JarvisState.GATE_TOOL_APPROVAL ||
    state === JarvisState.GATE_APPLY_CHANGES ||
    state === JarvisState.GATE_DEPLOY
  );
}

/**
 * 주어진 상태가 에이전트 작업 상태인지 확인한다
 */
export function isAgentWorkState(state: JarvisState): boolean {
  return (
    state === JarvisState.SPEC_ANALYSIS ||
    state === JarvisState.POLICY_CHECK ||
    state === JarvisState.PLANNING ||
    state === JarvisState.CODE_GENERATION ||
    state === JarvisState.CODE_REVIEW ||
    state === JarvisState.APPLY_CHANGES ||
    state === JarvisState.TESTING ||
    state === JarvisState.DEPLOY_EXECUTE ||
    state === JarvisState.ERROR_RECOVERY ||
    state === JarvisState.MOBILE_ACTION_EXECUTION
  );
}

/**
 * 상태 이름으로 한글 설명을 반환한다 — UI 표시용
 */
export function getStateDescription(state: JarvisState): string {
  const descriptions: Record<JarvisState, string> = {
    [JarvisState.IDLE]: '대기 중',
    [JarvisState.SPEC_ANALYSIS]: '요구사항 분석 중',
    [JarvisState.POLICY_CHECK]: '정책 검토 중',
    [JarvisState.GATE_PLAN_APPROVAL]: '계획 승인 요청',
    [JarvisState.PLANNING]: '실행 계획 수립 중',
    [JarvisState.GATE_TOOL_APPROVAL]: '도구 사용 승인 요청',
    [JarvisState.CODE_GENERATION]: '코드 생성 중',
    [JarvisState.CODE_REVIEW]: '코드 검토 중',
    [JarvisState.GATE_APPLY_CHANGES]: '변경 적용 승인 요청',
    [JarvisState.APPLY_CHANGES]: '변경 사항 적용 중',
    [JarvisState.TESTING]: '테스트 실행 중',
    [JarvisState.GATE_DEPLOY]: '배포 승인 요청',
    [JarvisState.DEPLOY_EXECUTE]: '배포 실행 중',
    [JarvisState.COMPLETED]: '완료',
    [JarvisState.DENIED]: '거부됨',
    [JarvisState.ERROR_RECOVERY]: '오류 복구 중',
    [JarvisState.EMERGENCY_STOP]: '비상 중단',
    [JarvisState.AWAITING_USER_INPUT]: '사용자 입력 대기',
    [JarvisState.MOBILE_ACTION_EXECUTION]: '모바일 액션 실행 중',
  };
  return descriptions[state];
}
