// @jarvis/core 패키지 barrel export
// 외부 패키지는 이 파일을 통해 core 패키지의 모든 공개 API에 접근한다
// export 순서: types → state-machine → message-bus

// ────────────────────────────────────────────────────────────
// 1. 에이전트 타입 및 설정
// ────────────────────────────────────────────────────────────

export type {
  ClaudeModel,
  PermissionMode,
  AgentConfig,
} from './agent-types.js';

export {
  ComplexityLevel,
  MODEL_ASSIGNMENT,
  AGENT_CONFIGS,
  COMPLEXITY_AGENT_TEAMS,
  getAgentConfig,
  getTeamConfigs,
} from './agent-types.js';

// ────────────────────────────────────────────────────────────
// 2. XState v5 상태 머신
// ────────────────────────────────────────────────────────────

export type {
  JarvisMachineContext,
  JarvisMachineEvent,
  JarvisError,
  // 개별 이벤트 타입 (외부 컴포넌트에서 타입 좁히기에 사용)
  UserRequestEvent,
  SpecCompleteEvent,
  SpecNeedClarificationEvent,
  PolicyAllowEvent,
  PolicyConstrainedAllowEvent,
  PolicyApprovalRequiredEvent,
  PolicyDenyEvent,
  GateApprovedEvent,
  GateRejectedEvent,
  GateScopeModifiedEvent,
  GateTimeoutEvent,
  GateSkippedEvent,
  PlanCompleteEvent,
  PlanNeedsToolsEvent,
  NoCodeNeededEvent,
  CodeCompleteEvent,
  ReviewPassEvent,
  ReviewBlockersEvent,
  ApplySuccessEvent,
  ApplyFailedEvent,
  TestPassEvent,
  TestFailEvent,
  DeploySuccessEvent,
  ErrorEvent,
  RecoverySuccessEvent,
  RecoveryFailedEvent,
  UserResponseEvent,
  UserCancelEvent,
  MobileActionSuccessEvent,
  MobileActionFailedEvent,
  MobileDeviceDisconnectedEvent,
} from './state-machine.js';

export {
  JarvisState,
  jarvisMachine,
  isFinalState,
  isGateState,
  isAgentWorkState,
  getStateDescription,
} from './state-machine.js';

// ────────────────────────────────────────────────────────────
// 3. 에이전트 메시지 버스
// ────────────────────────────────────────────────────────────

export type {
  MessageHandler,
  MessageBusOptions,
  MessageBusStatus,
} from './message-bus.js';

export {
  MessageBus,
  DEFAULT_BUS_OPTIONS,
  getGlobalMessageBus,
  resetGlobalMessageBus,
} from './message-bus.js';
