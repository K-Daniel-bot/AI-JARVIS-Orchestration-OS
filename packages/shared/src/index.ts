/**
 * @jarvis/shared 패키지 barrel export
 * 다른 패키지는 이 파일을 통해 shared 패키지의 모든 공개 API에 접근한다.
 * export 순서: types → result → errors → schemas → id
 */

// ─────────────────────────────────────────
// 1. 핵심 타입 정의
// ─────────────────────────────────────────

// 공통 타입 (JarvisErrorCode, JarvisErrorRecord 인터페이스)
// Result 패턴 함수(ok, err)는 result.ts로 통합됨
export type { JarvisErrorCode, JarvisErrorRecord } from './types/common.js';

// 감사 로그 타입 (audit-log.json 스키마 기반)
export type {
  AuditLogLevel,
  ActionStatus,
  AuditAction,
} from './types/audit.js';

// 중복 방지: audit.ts에서 이미 export된 타입은 여기서 재export
export type {
  UserRole,
  RiskLevel,
  PolicyStatus,
  AuditResultStatus,
  AuditWho,
  AuditWhat,
  AuditPolicy,
  AuditCapability,
  AuditExecution,
  AuditResult,
  AuditEvidence,
  AuditRedactions,
  AuditIntegrity,
  AuditEntry,
} from './types/audit.js';

// 전체 시스템 타입 (types.ts — policy, capability, action, agent 등)
export type {
  // 기본 열거 타입
  TrustMode,
  TokenStatus,
  ActionType,
  AgentName,
  MessageType,
  ArtifactType,
  AgentHealthStatus,
  RunStatus,
  LogLevel,
  // PolicyDecision 관련 타입
  PolicySubject,
  PolicyRequest,
  PolicyConstraints,
  PolicyOutcome,
  CapabilityGrant,
  PolicyDecision,
  // CapabilityToken 관련 타입
  CapabilityContext,
  CapabilityToken,
  // Action / ExecutionTrace 관련 타입
  ActionEvidence,
  Action,
  ExecutionStep,
  ExecutionTrace,
  // AgentMessage 관련 타입
  AgentMessagePayload,
  RetryPolicy,
  AgentMessage,
} from './types.js';

// ─────────────────────────────────────────
// 2. Result 모나드 패턴
// ─────────────────────────────────────────

export type { Result, OkResult, ErrResult } from './result.js';
export {
  ok,
  err,
  isOk,
  isErr,
  unwrapOr,
  mapOk,
  mapErr,
  andThen,
} from './result.js';

// ─────────────────────────────────────────
// 3. 도메인 에러 타입 (확장판)
// ─────────────────────────────────────────

// types/common.ts의 createError 함수도 함께 export
export { createError } from './types/common.js';

// errors.ts — 클래스 기반 에러, 에러 코드 상수, 헬퍼 함수
// ErrorCode는 const 객체이므로 타입+값 모두 export { ErrorCode }로 처리
export type { JarvisErrorOptions } from './errors.js';
export {
  ErrorCode,
  JarvisError,
  agentTimeoutError,
  validationFailedError,
  policyDeniedError,
  tokenInvalidError,
  tokenExpiredError,
  tokenScopeMismatchError,
  hashMismatchError,
  dbError,
  internalError,
} from './errors.js';

// ─────────────────────────────────────────
// 4. Zod 런타임 검증 스키마
// ─────────────────────────────────────────

export type {
  PolicyDecisionInput,
  CapabilityTokenInput,
  ActionInput,
  AuditEntryInput,
  AgentMessageInput,
} from './schemas.js';
export {
  // 기본 열거 스키마
  TrustModeSchema,
  RiskLevelSchema,
  PolicyStatusSchema,
  TokenStatusSchema,
  ActionTypeSchema,
  UserRoleSchema,
  AgentNameSchema,
  MessageTypeSchema,
  ArtifactTypeSchema,
  RunStatusSchema,
  AuditResultStatusSchema,
  LogLevelSchema,
  // PolicyDecision 스키마
  PolicySubjectSchema,
  PolicyRequestSchema,
  PolicyConstraintsSchema,
  PolicyOutcomeSchema,
  CapabilityGrantSchema,
  PolicyDecisionSchema,
  // CapabilityToken 스키마
  CapabilityContextSchema,
  CapabilityTokenSchema,
  // Action / ExecutionTrace 스키마
  ActionEvidenceSchema,
  ActionSchema,
  ExecutionStepSchema,
  ExecutionTraceSchema,
  // AuditEntry 스키마
  AuditEntrySchema,
  // AgentMessage 스키마
  AgentMessagePayloadSchema,
  RetryPolicySchema,
  AgentMessageSchema,
} from './schemas.js';

// ─────────────────────────────────────────
// 5. ID 생성 유틸리티
// ─────────────────────────────────────────

export type { IdPrefix } from './id.js';
export {
  ID_PREFIX,
  generateId,
  generatePolicyDecisionId,
  generateCapabilityTokenId,
  generateActionId,
  generateAuditEntryId,
  generateMessageId,
  generateRunId,
  generateSpecId,
  generatePlanId,
  generateChangesetId,
  generateReviewId,
  hasPrefix,
  isValidJarvisId,
} from './id.js';
