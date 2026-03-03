// @jarvis/executor — Action API, OS 추상화, Enforcement Hook barrel export

// 액션 타입
export type {
  FsActionType,
  ExecActionType,
  AppActionType,
  BrowserActionType,
  MobileActionType,
  ActionType,
  RiskTag,
  ActionRequest,
  ActionResultStatus,
  ActionResult,
  ExecutionTraceStatus,
  ExecutionTrace,
  ActionCategory,
  ActionEvidence,
} from "./types/action-types.js";
export { getActionCategory } from "./types/action-types.js";
export { capabilityToActionType, actionTypeToCapability } from "./types/action-types.js";

// Pre-Hook 검증
export type { PreHookResult } from "./enforcement/pre-hook.js";
export {
  validateCapabilityForAction,
  validateFilePath,
  validateCommand,
  validatePreExecution,
} from "./enforcement/pre-hook.js";

// Post-Hook 검증
export type { PostHookResult } from "./enforcement/post-hook.js";
export {
  validateExecutionResult,
  validatePostExecution,
} from "./enforcement/post-hook.js";

// OS 추상화 레이어
export type {
  OsPlatform,
  OsReadFileResult,
  OsWriteFileResult,
  OsDeleteFileResult,
  OsExecuteCommandResult,
  OsLaunchAppResult,
  OsAbstraction,
} from "./os/os-abstraction.js";
export {
  detectPlatform,
  createOsAbstraction,
} from "./os/os-abstraction.js";

// 액션 실행기
export {
  executeAction,
  executeActions,
} from "./executor/action-executor.js";
