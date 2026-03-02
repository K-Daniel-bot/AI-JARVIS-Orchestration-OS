/**
 * ID 생성 유틸리티
 * crypto.randomUUID() 기반으로 타입 안전한 식별자를 생성한다.
 * Math.random() 사용 금지 — 예측 불가능한 난수 보장을 위해 crypto API를 사용한다.
 */

// ─────────────────────────────────────────
// ID 접두사 상수
// ─────────────────────────────────────────

/**
 * ID_PREFIX — 각 도메인 객체의 표준 접두사 상수.
 * 접두사를 통해 ID만 보고도 어떤 객체인지 구분할 수 있다.
 */
export const ID_PREFIX = {
  /** PolicyDecision ID 접두사 */
  POLICY_DECISION: 'pd_',
  /** CapabilityToken ID 접두사 */
  CAPABILITY_TOKEN: 'cap_',
  /** Action ID 접두사 */
  ACTION: 'act_',
  /** AuditEntry ID 접두사 */
  AUDIT_ENTRY: 'aud_',
  /** AgentMessage ID 접두사 */
  MESSAGE: 'msg_',
  /** ExecutionTrace Run ID 접두사 */
  RUN: 'run_',
  /** SPEC 아티팩트 ID 접두사 */
  SPEC: 'spec_',
  /** PLAN 아티팩트 ID 접두사 */
  PLAN: 'plan_',
  /** ChangeSet ID 접두사 */
  CHANGESET: 'cs_',
  /** Review 아티팩트 ID 접두사 */
  REVIEW: 'rev_',
} as const;

/** ID_PREFIX 값 타입 */
export type IdPrefix = (typeof ID_PREFIX)[keyof typeof ID_PREFIX];

// ─────────────────────────────────────────
// 날짜 포맷 유틸리티
// ─────────────────────────────────────────

/**
 * 현재 날짜를 YYYYMMDD 형식으로 반환한다.
 * ID 생성 시 날짜 부분에 사용된다.
 */
function formatDateCompact(): string {
  const now = new Date();
  const year = now.getUTCFullYear().toString();
  const month = (now.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = now.getUTCDate().toString().padStart(2, '0');
  return `${year}${month}${day}`;
}

// ─────────────────────────────────────────
// ID 생성 함수
// ─────────────────────────────────────────

/**
 * 지정된 접두사로 시작하는 고유 ID를 생성한다.
 * 형식: {prefix}{YYYYMMDD}_{uuid-short}
 * 예시: pd_20260302_a1b2c3d4e5f6
 *
 * @param prefix - ID 접두사 (예: "pd_", "cap_", "act_")
 */
export function generateId(prefix: string): string {
  const uuid = crypto.randomUUID();
  // UUID에서 하이픈 제거 후 앞 12자리 사용 (충분한 유일성 보장)
  const shortUuid = uuid.replace(/-/g, '').slice(0, 12);
  const date = formatDateCompact();
  return `${prefix}${date}_${shortUuid}`;
}

// ─────────────────────────────────────────
// 도메인별 ID 생성 헬퍼 함수
// ─────────────────────────────────────────

/**
 * PolicyDecision ID를 생성한다.
 * 형식: pd_{YYYYMMDD}_{uuid-short}
 */
export function generatePolicyDecisionId(): string {
  return generateId(ID_PREFIX.POLICY_DECISION);
}

/**
 * CapabilityToken ID를 생성한다.
 * 형식: cap_{YYYYMMDD}_{uuid-short}
 */
export function generateCapabilityTokenId(): string {
  return generateId(ID_PREFIX.CAPABILITY_TOKEN);
}

/**
 * Action ID를 생성한다.
 * 형식: act_{YYYYMMDD}_{uuid-short}
 */
export function generateActionId(): string {
  return generateId(ID_PREFIX.ACTION);
}

/**
 * AuditEntry ID를 생성한다.
 * 형식: aud_{YYYYMMDD}_{uuid-short}
 */
export function generateAuditEntryId(): string {
  return generateId(ID_PREFIX.AUDIT_ENTRY);
}

/**
 * AgentMessage ID를 생성한다.
 * 형식: msg_{YYYYMMDD}_{uuid-short}
 */
export function generateMessageId(): string {
  return generateId(ID_PREFIX.MESSAGE);
}

/**
 * ExecutionTrace Run ID를 생성한다.
 * 형식: run_{YYYYMMDD}_{uuid-short}
 */
export function generateRunId(): string {
  return generateId(ID_PREFIX.RUN);
}

/**
 * SPEC 아티팩트 ID를 생성한다.
 * 형식: spec_{YYYYMMDD}_{uuid-short}
 */
export function generateSpecId(): string {
  return generateId(ID_PREFIX.SPEC);
}

/**
 * PLAN 아티팩트 ID를 생성한다.
 * 형식: plan_{YYYYMMDD}_{uuid-short}
 */
export function generatePlanId(): string {
  return generateId(ID_PREFIX.PLAN);
}

/**
 * ChangeSet ID를 생성한다.
 * 형식: cs_{YYYYMMDD}_{uuid-short}
 */
export function generateChangesetId(): string {
  return generateId(ID_PREFIX.CHANGESET);
}

/**
 * Review 아티팩트 ID를 생성한다.
 * 형식: rev_{YYYYMMDD}_{uuid-short}
 */
export function generateReviewId(): string {
  return generateId(ID_PREFIX.REVIEW);
}

// ─────────────────────────────────────────
// ID 검증 유틸리티
// ─────────────────────────────────────────

/**
 * 주어진 ID가 특정 접두사로 시작하는지 검증한다.
 * @param id - 검증할 ID 문자열
 * @param prefix - 예상 접두사
 */
export function hasPrefix(id: string, prefix: string): boolean {
  return id.startsWith(prefix);
}

/**
 * 주어진 ID가 유효한 JARVIS ID 형식인지 검증한다.
 * 형식: {prefix}{YYYYMMDD}_{12자리 hex}
 * @param id - 검증할 ID 문자열
 */
export function isValidJarvisId(id: string): boolean {
  // 패턴: 영문소문자+언더스코어 접두사 + 8자리 날짜 + 언더스코어 + 12자리 알파뉴메릭
  return /^[a-z_]+\d{8}_[a-z0-9]{12}$/.test(id);
}
