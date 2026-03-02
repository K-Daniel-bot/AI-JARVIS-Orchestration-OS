/**
 * 공통 타입 정의 — 프로젝트 전체에서 사용하는 기본 타입들.
 * Result 패턴 함수(ok, err)는 result.ts로 이전되었으며
 * 이 파일은 JarvisErrorCode, JarvisError 인터페이스, createError만 담당한다.
 */

/** 도메인 특화 에러 코드 */
export type JarvisErrorCode =
  | 'AGENT_TIMEOUT'
  | 'VALIDATION_FAILED'
  | 'RESOURCE_EXHAUSTED'
  | 'INTERNAL_ERROR'
  | 'POLICY_DENIED'
  | 'CAPABILITY_EXPIRED'
  | 'CAPABILITY_EXHAUSTED'
  | 'HASH_CHAIN_VIOLATED'
  | 'DB_ERROR'
  | 'NOT_FOUND'
  | 'PERMISSION_DENIED';

/** JARVIS OS 도메인 에러 인터페이스 (경량 버전 — 클래스 기반은 errors.ts 참고) */
export interface JarvisErrorRecord {
  readonly code: JarvisErrorCode;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

/**
 * JarvisErrorRecord 생성 헬퍼.
 * throw 없이 에러를 생성하여 Result 패턴과 함께 사용한다.
 */
export function createError(
  code: JarvisErrorCode,
  message: string,
  details?: Record<string, unknown>,
): JarvisErrorRecord {
  return { code, message, ...(details !== undefined ? { details } : {}) };
}
