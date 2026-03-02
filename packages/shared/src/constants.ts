// 시스템 상수 정의

// 에이전트 건강 체크 설정
export const AGENT_HEALTH_CONFIG = {
  CHECK_INTERVAL_MS: 5000,
  TIMEOUT_MS: 30000,
  MAX_RETRIES: 3,
} as const;

// 루프 제한
export const LOOP_LIMITS = {
  MAX_CODEGEN_REVIEW_LOOP: 5,
  MAX_TEST_FIX_LOOP: 3,
  MAX_CONSECUTIVE_ERRORS: 3,
} as const;

// 기본 TTL 설정 (초)
export const DEFAULT_TTL = {
  CAPABILITY_TOKEN: 900,
  MESSAGE_TIMEOUT: 60000,
  SESSION_TIMEOUT: 3600,
} as const;

// Redaction 패턴 (민감 정보 마스킹)
export const REDACTION_CATEGORIES = [
  "secrets",
  "tokens",
  "cookies",
  "passwords",
] as const;

export type RedactionCategory = typeof REDACTION_CATEGORIES[number];
