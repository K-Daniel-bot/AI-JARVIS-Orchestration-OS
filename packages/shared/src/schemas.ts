/**
 * Zod 런타임 검증 스키마
 * 모든 핵심 인터페이스에 대한 Zod 스키마를 정의한다.
 * 에이전트 간 메시지 수신 시 반드시 이 스키마로 검증 후 처리해야 한다.
 */

import { z } from 'zod';

// ─────────────────────────────────────────
// 기본 열거 스키마
// ─────────────────────────────────────────

/** 신뢰 모드 스키마 */
export const TrustModeSchema = z.enum([
  'observe',
  'suggest',
  'semi-auto',
  'full-auto',
]);

/** 위험 수준 스키마 */
export const RiskLevelSchema = z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);

/** 정책 상태 스키마 */
export const PolicyStatusSchema = z.enum([
  'ALLOW',
  'DENY',
  'APPROVAL_REQUIRED',
  'CONSTRAINED_ALLOW',
]);

/** 토큰 상태 스키마 */
export const TokenStatusSchema = z.enum([
  'ACTIVE',
  'CONSUMED',
  'EXPIRED',
  'REVOKED',
]);

/** 액션 타입 스키마 — 38가지 액션 유형 */
export const ActionTypeSchema = z.enum([
  'FS_READ',
  'FS_WRITE',
  'FS_LIST',
  'FS_MOVE',
  'FS_DELETE',
  'EXEC_RUN',
  'PROCESS_KILL',
  'APP_LAUNCH',
  'APP_FOCUS',
  'WINDOW_CLICK',
  'WINDOW_TYPE',
  'WINDOW_SHORTCUT',
  'BROWSER_OPEN_URL',
  'BROWSER_CLICK',
  'BROWSER_TYPE',
  'BROWSER_DOWNLOAD',
  'BROWSER_UPLOAD',
  'BROWSER_LOGIN_REQUEST',
  'BROWSER_FETCH',
  'MOBILE_CONTACT_SEARCH',
  'MOBILE_CONTACT_READ',
  'MOBILE_CALL_DIAL',
  'MOBILE_CALL_END',
  'MOBILE_CALL_STATUS',
  'MOBILE_SMS_SEND',
  'MOBILE_SMS_READ',
  'MOBILE_MESSENGER_SEND',
  'MOBILE_MESSENGER_READ',
  'MOBILE_APP_LAUNCH',
  'MOBILE_APP_FOCUS',
  'MOBILE_APP_ACTION',
  'MOBILE_NOTIFICATION_READ',
  'MOBILE_NOTIFICATION_DISMISS',
  'MOBILE_DEVICE_STATUS',
  'MOBILE_CLIPBOARD_SYNC',
]);

/** 사용자 역할 스키마 */
export const UserRoleSchema = z.enum([
  'Owner',
  'Admin',
  'User',
  'Guest',
  'AI-Autonomous',
]);

/** 에이전트 이름 스키마 */
export const AgentNameSchema = z.enum([
  'orchestrator',
  'spec-agent',
  'policy-risk',
  'planner',
  'codegen',
  'review',
  'test-build',
  'executor',
  'rollback',
]);

/** 메시지 유형 스키마 */
export const MessageTypeSchema = z.enum([
  'HANDOFF',
  'REQUEST',
  'RESPONSE',
  'ERROR',
  'HEARTBEAT',
]);

/** 아티팩트 유형 스키마 */
export const ArtifactTypeSchema = z.enum([
  'SPEC',
  'POLICY_DECISION',
  'PLAN',
  'CHANGESET',
  'REVIEW',
  'TEST_REPORT',
  'EXECUTION_TRACE',
  'ROLLBACK_LOG',
]);

/** 실행 런 상태 스키마 */
export const RunStatusSchema = z.enum([
  'SUCCESS',
  'PARTIAL_SUCCESS',
  'FAILED',
  'ABORTED',
]);

/** 감사 결과 상태 스키마 */
export const AuditResultStatusSchema = z.enum([
  'COMPLETED',
  'FAILED',
  'ROLLED_BACK',
  'ABORTED',
  'DENIED',
]);

/** 로그 수준 스키마 */
export const LogLevelSchema = z.enum(['FULL', 'SUMMARY']);

// ─────────────────────────────────────────
// PolicyDecision 스키마
// ─────────────────────────────────────────

/** 정책 주체 스키마 */
export const PolicySubjectSchema = z.object({
  user_id: z.string().min(1),
  role: UserRoleSchema,
  device: z.string().min(1),
  session_id: z.string().min(1),
});

/** 정책 요청 스키마 */
export const PolicyRequestSchema = z.object({
  raw_input: z.string().min(1),
  intent: z.string().min(1),
  targets: z.array(z.string()),
  requires_web_access: z.boolean(),
  requires_login: z.boolean(),
});

/** 정책 제약 조건 스키마 */
export const PolicyConstraintsSchema = z.object({
  fs: z.object({
    read_allow: z.array(z.string()),
    write_allow: z.array(z.string()),
    write_deny: z.array(z.string()),
  }),
  exec: z.object({
    allow: z.array(z.string()),
    deny: z.array(z.string()),
  }),
  network: z.object({
    allow_domains: z.array(z.string()),
    deny_domains: z.array(z.string()),
    default_policy: z.string(),
  }),
});

/** 정책 판정 결과 스키마 */
export const PolicyOutcomeSchema = z.object({
  status: PolicyStatusSchema,
  /** 위험 점수: 0~100 범위 검증 */
  risk_score: z.number().int().min(0).max(100),
  risk_level: RiskLevelSchema,
  requires_gates: z.array(z.string()),
  reason_codes: z.array(z.string()),
  human_explanation: z.string().min(1),
});

/** Capability 부여 정보 스키마 */
export const CapabilityGrantSchema = z.object({
  cap: z.string().min(1),
  scope: z.union([z.string(), z.array(z.string())]),
  ttl_seconds: z.number().int().positive(),
  max_uses: z.number().int().positive(),
});

/**
 * PolicyDecision 스키마 — 정책 판정 전체 결과 검증.
 * decision_id 패턴: pd_{date}_{seq}
 */
export const PolicyDecisionSchema = z.object({
  decision_id: z.string().regex(/^pd_/),
  timestamp: z.string().datetime(),
  subject: PolicySubjectSchema,
  request: PolicyRequestSchema,
  outcome: PolicyOutcomeSchema,
  constraints: PolicyConstraintsSchema,
  required_capabilities: z.array(CapabilityGrantSchema),
  audit: z.object({
    log_level: LogLevelSchema,
    redactions: z.array(z.string()),
  }),
});

// ─────────────────────────────────────────
// CapabilityToken 스키마
// ─────────────────────────────────────────

/** Capability 컨텍스트 스키마 */
export const CapabilityContextSchema = z.object({
  session_id: z.string().min(1),
  run_id: z.string().min(1),
  policy_decision_id: z.string().regex(/^pd_/),
  trust_mode: TrustModeSchema,
});

/**
 * CapabilityToken 스키마 — 일회성 권한 토큰 검증.
 * token_id 패턴: cap_{date}_{seq}
 */
export const CapabilityTokenSchema = z.object({
  token_id: z.string().regex(/^cap_/),
  issued_at: z.string().datetime(),
  issued_by: z.string().min(1),
  approved_by: z.string().min(1),
  grant: CapabilityGrantSchema,
  context: CapabilityContextSchema,
  status: TokenStatusSchema,
  consumed_at: z.string().datetime().optional(),
  consumed_by_action: z.string().optional(),
  revoked_reason: z.string().optional(),
});

// ─────────────────────────────────────────
// Action / ExecutionTrace 스키마
// ─────────────────────────────────────────

/** 액션 증거 수집 설정 스키마 */
export const ActionEvidenceSchema = z.object({
  capture_screenshot: z.boolean(),
  capture_stdout: z.boolean(),
});

/**
 * Action 스키마 — 단일 OS 조작 단위 검증.
 * action_id 패턴: act_{seq}
 */
export const ActionSchema = z.object({
  action_id: z.string().regex(/^act_/),
  type: ActionTypeSchema,
  params: z.record(z.string(), z.unknown()),
  requires_capabilities: z.array(z.string()),
  risk_tags: z.array(z.string()),
  preconditions: z.array(z.string()),
  postconditions: z.array(z.string()),
  evidence: ActionEvidenceSchema,
});

/** 실행 단계 상태 스키마 */
const ExecutionStepStatusSchema = z.enum([
  'SUCCESS',
  'FAILED',
  'SKIPPED',
  'DENIED',
]);

/** 실행 단계 스키마 */
export const ExecutionStepSchema = z.object({
  action_id: z.string().min(1),
  status: ExecutionStepStatusSchema,
  started_at: z.string().datetime(),
  ended_at: z.string().datetime(),
  evidence: z.object({
    screenshot_ref: z.string().optional(),
    stdout_ref: z.string().optional(),
  }),
  error: z.string().optional(),
});

/**
 * ExecutionTrace 스키마 — 전체 실행 런 추적 검증.
 * run_id 패턴: run_{date}_{seq}
 */
export const ExecutionTraceSchema = z.object({
  run_id: z.string().regex(/^run_/),
  status: RunStatusSchema,
  steps: z.array(ExecutionStepSchema),
  redactions_applied: z.array(z.string()),
});

// ─────────────────────────────────────────
// AuditEntry 스키마
// ─────────────────────────────────────────

/** 감사 로그 — 액션 실행 상태 스키마 */
const ActionPerformedStatusSchema = z.enum(['SUCCESS', 'FAILED', 'DENIED']);

/**
 * AuditEntry 스키마 — 불변 감사 로그 엔트리 검증.
 * audit_id 패턴: aud_{date}_{seq}
 */
export const AuditEntrySchema = z.object({
  audit_id: z.string().regex(/^aud_/),
  timestamp: z.string().datetime(),
  log_level: LogLevelSchema,
  who: z.object({
    user_id: z.string().min(1),
    role: UserRoleSchema,
    session_id: z.string().min(1),
  }),
  what: z.object({
    raw_input: z.string().min(1),
    ai_interpretation: z.string().min(1),
    intent: z.string().min(1),
  }),
  policy: z.object({
    policy_decision_id: z.string().regex(/^pd_/),
    risk_score: z.number().int().min(0).max(100),
    risk_level: RiskLevelSchema,
    status: PolicyStatusSchema,
  }),
  capability: z.object({
    token_ids: z.array(z.string()),
    scopes_granted: z.array(z.string()),
  }),
  execution: z.object({
    run_id: z.string().regex(/^run_/),
    actions_performed: z.array(
      z.object({
        action_id: z.string().min(1),
        type: z.string().min(1),
        status: ActionPerformedStatusSchema,
        duration_ms: z.number().int().nonnegative(),
      }),
    ),
    rollback_performed: z.boolean(),
    rollback_reason: z.string().optional(),
  }),
  result: z.object({
    status: AuditResultStatusSchema,
    output_summary: z.string(),
    artifacts: z.array(z.string()),
  }),
  evidence: z.object({
    screenshots: z.array(z.string()),
    terminal_logs: z.array(z.string()),
    previous_action_id: z.string().optional(),
  }),
  redactions: z.object({
    applied: z.array(z.string()),
    patterns_matched: z.number().int().nonnegative(),
  }),
  integrity: z.object({
    hash: z.string().regex(/^sha256:/),
    previous_hash: z.string().regex(/^sha256:/),
  }),
});

// ─────────────────────────────────────────
// AgentMessage 스키마
// ─────────────────────────────────────────

/** 에이전트 메시지 페이로드 스키마 */
export const AgentMessagePayloadSchema = z.object({
  artifact_type: ArtifactTypeSchema,
  artifact_ref: z.string().min(1),
  summary: z.string().min(1),
  metadata: z.record(z.string(), z.unknown()),
});

/** 재시도 정책 스키마 */
export const RetryPolicySchema = z.object({
  max_retries: z.number().int().nonnegative(),
  backoff_ms: z.number().int().positive(),
});

/**
 * AgentMessage 스키마 — 에이전트 간 메시지 검증.
 * message_id 패턴: msg_{date}_{seq}
 */
export const AgentMessageSchema = z.object({
  message_id: z.string().regex(/^msg_/),
  from_agent: AgentNameSchema,
  to_agent: AgentNameSchema,
  message_type: MessageTypeSchema,
  timestamp: z.string().datetime(),
  run_id: z.string().regex(/^run_/),
  payload: AgentMessagePayloadSchema,
  timeout_ms: z.number().int().positive(),
  retry_policy: RetryPolicySchema,
});

// ─────────────────────────────────────────
// 스키마 타입 추론 (infer)
// ─────────────────────────────────────────

/** Zod 스키마에서 추론된 PolicyDecision 타입 */
export type PolicyDecisionInput = z.input<typeof PolicyDecisionSchema>;
/** Zod 스키마에서 추론된 CapabilityToken 타입 */
export type CapabilityTokenInput = z.input<typeof CapabilityTokenSchema>;
/** Zod 스키마에서 추론된 Action 타입 */
export type ActionInput = z.input<typeof ActionSchema>;
/** Zod 스키마에서 추론된 AuditEntry 타입 */
export type AuditEntryInput = z.input<typeof AuditEntrySchema>;
/** Zod 스키마에서 추론된 AgentMessage 타입 */
export type AgentMessageInput = z.input<typeof AgentMessageSchema>;
