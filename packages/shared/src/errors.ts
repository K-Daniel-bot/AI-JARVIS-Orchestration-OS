/**
 * JARVIS OS 도메인 에러 타입 정의
 * 범용 Error 대신 도메인별 에러 코드와 컨텍스트를 포함하는 JarvisError를 사용한다.
 * 에러 전파 전 반드시 감사 로그에 기록해야 한다.
 */

// ─────────────────────────────────────────
// 에러 코드 열거형
// ─────────────────────────────────────────

/**
 * ErrorCode — JARVIS OS 전체에서 사용되는 표준 에러 코드.
 * 에이전트 간 에러 전파 시 이 코드를 포함하여 근본 원인을 추적한다.
 */
export const ErrorCode = {
  /** 에이전트 응답 시간 초과 */
  AGENT_TIMEOUT: 'AGENT_TIMEOUT',
  /** 입력 데이터 또는 스키마 검증 실패 */
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  /** 메모리, 디스크, API 호출 한도 초과 */
  RESOURCE_EXHAUSTED: 'RESOURCE_EXHAUSTED',
  /** 예상치 못한 내부 오류 */
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  /** 정책 엔진이 요청을 거부함 */
  POLICY_DENIED: 'POLICY_DENIED',
  /** Capability Token이 유효하지 않음 */
  TOKEN_INVALID: 'TOKEN_INVALID',
  /** Capability Token이 만료됨 */
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  /** 요청한 액션이 토큰 범위를 벗어남 */
  TOKEN_SCOPE_MISMATCH: 'TOKEN_SCOPE_MISMATCH',
  /** 감사 로그 해시 체인 무결성 위반 */
  HASH_MISMATCH: 'HASH_MISMATCH',
  /** SQLite 데이터베이스 접근/쿼리 오류 */
  DB_ERROR: 'DB_ERROR',
} as const;

/** ErrorCode 값 타입 — 문자열 리터럴 유니온 */
export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

// ─────────────────────────────────────────
// JarvisError 클래스
// ─────────────────────────────────────────

/** JarvisError 생성 옵션 */
export interface JarvisErrorOptions {
  /** 에러 코드 — 근본 원인 분류 */
  readonly code: ErrorCode;
  /** 사람이 읽을 수 있는 에러 메시지 */
  readonly message: string;
  /** 원인 에러 (에러 체인) */
  readonly cause?: unknown;
  /** 추가 컨텍스트 정보 (민감 정보 제외) */
  readonly context?: Record<string, unknown>;
}

/**
 * JarvisError — JARVIS OS 전용 도메인 에러 클래스.
 * 범용 Error를 확장하며 에러 코드와 컨텍스트를 포함한다.
 * 에러 메시지에 스택 트레이스나 시스템 경로를 노출하지 않는다.
 */
export class JarvisError extends Error {
  /** 에러 분류 코드 */
  public readonly code: ErrorCode;
  /** 원인 에러 (에러 체인 추적용) */
  public readonly cause?: unknown;
  /** 추가 컨텍스트 정보 */
  public readonly context?: Readonly<Record<string, unknown>>;

  public constructor(options: JarvisErrorOptions) {
    super(options.message);
    this.name = 'JarvisError';
    this.code = options.code;
    this.cause = options.cause;
    this.context = options.context;

    // V8 스택 트레이스 캡처 (Node.js 환경)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, JarvisError);
    }
  }

  /**
   * 에러를 로깅용 안전한 객체로 직렬화한다.
   * 스택 트레이스와 민감 컨텍스트를 제거한다.
   */
  public toSafeObject(): Readonly<{
    name: string;
    code: ErrorCode;
    message: string;
    hasContext: boolean;
  }> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      hasContext: this.context !== undefined,
    };
  }
}

// ─────────────────────────────────────────
// 에러 생성 헬퍼 함수
// ─────────────────────────────────────────

/**
 * AGENT_TIMEOUT 에러를 생성한다.
 * @param agentName - 타임아웃이 발생한 에이전트 이름
 * @param timeoutMs - 설정된 타임아웃 시간 (ms)
 */
export function agentTimeoutError(
  agentName: string,
  timeoutMs: number,
): JarvisError {
  return new JarvisError({
    code: ErrorCode.AGENT_TIMEOUT,
    message: `Agent '${agentName}' timed out after ${timeoutMs}ms`,
    context: { agentName, timeoutMs },
  });
}

/**
 * VALIDATION_FAILED 에러를 생성한다.
 * @param field - 검증 실패한 필드 이름
 * @param reason - 실패 이유
 */
export function validationFailedError(
  field: string,
  reason: string,
): JarvisError {
  return new JarvisError({
    code: ErrorCode.VALIDATION_FAILED,
    message: `Validation failed for field '${field}': ${reason}`,
    context: { field, reason },
  });
}

/**
 * POLICY_DENIED 에러를 생성한다.
 * @param decisionId - 거부한 PolicyDecision ID
 * @param reason - 거부 이유 코드
 */
export function policyDeniedError(
  decisionId: string,
  reason: string,
): JarvisError {
  return new JarvisError({
    code: ErrorCode.POLICY_DENIED,
    message: `Policy denied request. Decision: ${decisionId}`,
    context: { decisionId, reason },
  });
}

/**
 * TOKEN_INVALID 에러를 생성한다.
 * @param tokenId - 유효하지 않은 토큰 ID
 */
export function tokenInvalidError(tokenId: string): JarvisError {
  return new JarvisError({
    code: ErrorCode.TOKEN_INVALID,
    message: `Capability token '${tokenId}' is invalid`,
    context: { tokenId },
  });
}

/**
 * TOKEN_EXPIRED 에러를 생성한다.
 * @param tokenId - 만료된 토큰 ID
 */
export function tokenExpiredError(tokenId: string): JarvisError {
  return new JarvisError({
    code: ErrorCode.TOKEN_EXPIRED,
    message: `Capability token '${tokenId}' has expired`,
    context: { tokenId },
  });
}

/**
 * TOKEN_SCOPE_MISMATCH 에러를 생성한다.
 * @param tokenId - 검사한 토큰 ID
 * @param requiredScope - 필요한 권한 범위
 * @param grantedScope - 토큰에 부여된 권한 범위
 */
export function tokenScopeMismatchError(
  tokenId: string,
  requiredScope: string,
  grantedScope: string,
): JarvisError {
  return new JarvisError({
    code: ErrorCode.TOKEN_SCOPE_MISMATCH,
    message: `Token '${tokenId}' scope mismatch`,
    context: { tokenId, requiredScope, grantedScope },
  });
}

/**
 * HASH_MISMATCH 에러를 생성한다.
 * @param auditId - 무결성 위반이 발생한 감사 로그 ID
 */
export function hashMismatchError(auditId: string): JarvisError {
  return new JarvisError({
    code: ErrorCode.HASH_MISMATCH,
    message: `Audit log integrity violation detected at entry '${auditId}'`,
    context: { auditId },
  });
}

/**
 * DB_ERROR 에러를 생성한다.
 * @param operation - 실패한 데이터베이스 작업
 * @param cause - 원인 에러
 */
export function dbError(operation: string, cause?: unknown): JarvisError {
  return new JarvisError({
    code: ErrorCode.DB_ERROR,
    message: `Database operation '${operation}' failed`,
    cause,
    context: { operation },
  });
}

/**
 * INTERNAL_ERROR 에러를 생성한다.
 * @param message - 내부 에러 설명
 * @param cause - 원인 에러
 */
export function internalError(message: string, cause?: unknown): JarvisError {
  return new JarvisError({
    code: ErrorCode.INTERNAL_ERROR,
    message,
    cause,
  });
}
