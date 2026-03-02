// 도메인 특화 에러 코드 — 범용 Error 대신 구조화된 에러 사용
export const ERROR_CODES = {
  AGENT_TIMEOUT: "AGENT_TIMEOUT",
  VALIDATION_FAILED: "VALIDATION_FAILED",
  RESOURCE_EXHAUSTED: "RESOURCE_EXHAUSTED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
  POLICY_DENIED: "POLICY_DENIED",
  CAPABILITY_EXPIRED: "CAPABILITY_EXPIRED",
  CAPABILITY_CONSUMED: "CAPABILITY_CONSUMED",
  CAPABILITY_REVOKED: "CAPABILITY_REVOKED",
  CAPABILITY_SCOPE_MISMATCH: "CAPABILITY_SCOPE_MISMATCH",
  AUDIT_INTEGRITY_VIOLATION: "AUDIT_INTEGRITY_VIOLATION",
  STATE_TRANSITION_INVALID: "STATE_TRANSITION_INVALID",
  AGENT_NOT_FOUND: "AGENT_NOT_FOUND",
  MESSAGE_DELIVERY_FAILED: "MESSAGE_DELIVERY_FAILED",
  UPSTREAM_FAILURE: "UPSTREAM_FAILURE",
  DEADLOCK_DETECTED: "DEADLOCK_DETECTED",
  LOOP_LIMIT_EXCEEDED: "LOOP_LIMIT_EXCEEDED",
} as const;

export type ErrorCode = typeof ERROR_CODES[keyof typeof ERROR_CODES];

// 구조화된 에러 — 감사 로그 기록 및 에이전트 간 전달에 사용
export interface JarvisError {
  readonly code: ErrorCode;
  readonly message: string;
  readonly agentId?: string;
  readonly runId?: string;
  readonly timestamp: string;
  readonly context?: Record<string, unknown>;
}

// JarvisError 생성 헬퍼
export function createError(
  code: ErrorCode,
  message: string,
  options?: {
    agentId?: string;
    runId?: string;
    context?: Record<string, unknown>;
  }
): JarvisError {
  return {
    code,
    message,
    agentId: options?.agentId,
    runId: options?.runId,
    timestamp: new Date().toISOString(),
    context: options?.context,
  };
}
