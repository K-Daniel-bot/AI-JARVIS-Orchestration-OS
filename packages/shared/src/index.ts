// @jarvis/shared — 공유 타입, 스키마, 유틸리티 barrel export

// 타입
export type {
  Result,
} from "./types/result.js";
export {
  ok,
  err,
  isOk,
  isErr,
  unwrapOr,
  mapResult,
  flatMap,
} from "./types/result.js";

export type {
  ErrorCode,
  JarvisError,
} from "./types/errors.js";
export {
  ERROR_CODES,
  createError,
} from "./types/errors.js";

export type {
  AgentType,
  AgentHealthStatus,
  AgentHealthState,
  ModelId,
  UserRole,
  TrustMode,
} from "./types/agent.js";
export {
  AGENT_TYPES,
  MODEL_IDS,
  MODEL_ASSIGNMENT,
} from "./types/agent.js";

export type {
  PolicyStatus,
  RiskLevel,
  RequestIntent,
  GateType,
  GateLevel,
  PolicySubject,
  PolicyRequest,
  PolicyOutcome,
  FsConstraints,
  ExecConstraints,
  NetworkConstraints,
  PolicyConstraints,
  PolicyDecision,
  CapabilityGrant,
  CapabilityType,
  CapabilityTokenStatus,
  CapabilityToken,
} from "./types/policy.js";

export type {
  AuditLogLevel,
  AuditResultStatus,
  ActionExecutionStatus,
  AuditEntry,
  ActionPerformed,
} from "./types/audit.js";

export type {
  MachineState,
  MachineEvent,
} from "./types/state-machine.js";
export {
  MACHINE_STATES,
  MACHINE_EVENTS,
} from "./types/state-machine.js";

export type {
  MessageType,
  ArtifactType,
  RetryPolicy,
  AgentMessage,
  MessagePayload,
} from "./types/message.js";

// 스키마
export {
  PolicyStatusSchema,
  RiskLevelSchema,
  RequestIntentSchema,
  CapabilityTypeSchema,
  CapabilityGrantSchema,
  PolicyOutcomeSchema,
  CapabilityTokenStatusSchema,
  GateTypeSchema,
  GateLevelSchema,
  PolicySubjectSchema,
  PolicyRequestSchema,
  FsConstraintsSchema,
  ExecConstraintsSchema,
  NetworkConstraintsSchema,
  PolicyConstraintsSchema,
  PolicyDecisionSchema,
  CapabilityTokenSchema,
} from "./schemas/policy.schema.js";

export {
  AuditLogLevelSchema,
  AuditResultStatusSchema,
  ActionExecutionStatusSchema,
  ActionPerformedSchema,
  AuditEntrySchema,
} from "./schemas/audit.schema.js";

export {
  AgentTypeSchema,
  MessageTypeSchema,
  ArtifactTypeSchema,
  RetryPolicySchema,
  MessagePayloadSchema,
  AgentMessageSchema,
} from "./schemas/message.schema.js";

// 유틸리티
export {
  generateAuditId,
  generatePolicyDecisionId,
  generateCapabilityTokenId,
  generateRunId,
  generateMessageId,
  generateActionId,
  generateSessionId,
} from "./utils/id.js";

export {
  sha256,
  computeAuditHash,
  GENESIS_HASH,
} from "./utils/hash.js";

export {
  nowISO,
  isExpired,
  elapsedMs,
} from "./utils/timestamp.js";

// 상수
export {
  AGENT_HEALTH_CONFIG,
  LOOP_LIMITS,
  DEFAULT_TTL,
  REDACTION_CATEGORIES,
} from "./constants.js";
export type { RedactionCategory } from "./constants.js";
