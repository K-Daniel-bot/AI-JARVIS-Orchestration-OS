// @jarvis/core — XState v5 상태 머신 및 메시지 버스 barrel export

// 상태 머신
export { jarvisMachine } from "./machine/jarvis-machine.js";
export type { JarvisMachineEvent, JarvisMachine } from "./machine/jarvis-machine.js";

// 머신 컨텍스트
export type { JarvisMachineContext, GateApproval } from "./machine/context.js";
export { createInitialContext } from "./machine/context.js";

// 상태 전이 가드
export {
  isPolicyAllow,
  isPolicyConstrainedAllow,
  isPolicyApprovalRequired,
  isPolicyDeny,
  canRetry,
  hasGateApproval,
  hasSpec,
  hasPlan,
  hasChangeSet,
  isNotCriticalRisk,
} from "./machine/guards.js";

// 상태 전이 액션
export {
  assignAgent,
  recordPreviousState,
  recordError,
  resetRetryCount,
  addGateApproval,
  updateEnvironment,
  clearAgent,
} from "./machine/actions.js";

// 메시지 버스
export { MessageBus } from "./message-bus/message-bus.js";
export type { MessageHandler } from "./message-bus/message-bus.js";
export { MessageQueue } from "./message-bus/message-queue.js";

// Environment Bundle 타입
export type {
  EnvironmentBundle,
  SpecRef,
  PlanRef,
  PlanStep,
  ChangeSetRef,
  FileChange,
  ReviewRef,
  TestResultRef,
} from "./types/environment.js";
export { createEnvironmentBundle } from "./types/environment.js";
