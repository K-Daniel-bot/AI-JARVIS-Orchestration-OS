// 민감 정보 마스킹 모듈 — 계약서 §3 및 §9 데이터 보호 규칙 구현
// 감사 로그 기록 전 자동으로 민감 데이터를 마스킹하여 보안 보장

import type { AuditEntry } from '@jarvis/shared';

/** 마스킹 패턴 유형 */
export type RedactionType =
  | 'api_key'
  | 'jwt_token'
  | 'credit_card'
  | 'ssh_key'
  | 'phone_number'
  | 'email';

/** 마스킹 패턴 정의 — 각 유형별 정규식 */
const REDACTION_PATTERNS: Record<RedactionType, RegExp> = {
  // API 키 — 20자 이상의 영숫자+특수문자 조합 (Bearer 토큰 등 포함)
  api_key: /[A-Za-z0-9_-]{20,}/g,
  // JWT 토큰 — eyJ로 시작하는 3-파트 구조
  jwt_token:
    /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,
  // 신용카드 번호 — 4자리씩 구분된 16자리
  credit_card: /\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}/g,
  // SSH 키 — PEM 형식 공개/비밀 키
  ssh_key:
    /-----BEGIN .{1,50} KEY-----[\s\S]*?-----END .{1,50} KEY-----/g,
  // 전화번호 — 한국 형식 (010-1234-5678 등)
  phone_number: /(\d{2,4})-(\d{3,4})-(\d{4})/g,
  // 이메일 주소
  email: /[\w.-]+@[\w.-]+\.\w+/g,
};

/** 마스킹 치환 문자열 */
const REDACTION_REPLACEMENT: Record<RedactionType, string> = {
  api_key: '[REDACTED_API_KEY]',
  jwt_token: '[REDACTED_JWT]',
  credit_card: '[REDACTED_CC]',
  ssh_key: '[REDACTED_SSH_KEY]',
  // 전화번호 — 중간 4자리만 마스킹 (계약서 §9 요구사항)
  phone_number: '$1-****-$3',
  email: '[REDACTED_EMAIL]',
};

/** 마스킹 처리 결과 */
export interface RedactionResult {
  /** 마스킹이 적용된 문자열 */
  readonly redacted: string;
  /** 마스킹 패턴이 일치한 총 횟수 */
  readonly patternsMatched: number;
  /** 적용된 마스킹 유형 목록 */
  readonly appliedTypes: readonly RedactionType[];
}

/**
 * 텍스트에서 민감 정보를 감지하고 마스킹
 * 모든 마스킹 패턴을 순차 적용하여 완전한 데이터 보호 보장
 *
 * @param text - 마스킹할 원본 문자열
 * @returns 마스킹된 문자열, 일치 횟수, 적용된 유형 목록
 */
export function redactSensitiveData(text: string): RedactionResult {
  let redacted = text;
  let patternsMatched = 0;
  const appliedTypes: RedactionType[] = [];

  const patternEntries = Object.entries(REDACTION_PATTERNS) as Array<
    [RedactionType, RegExp]
  >;

  for (const [type, pattern] of patternEntries) {
    // 정규식 재사용 시 lastIndex 초기화 필요 (global 플래그)
    pattern.lastIndex = 0;

    const matches = redacted.match(pattern);
    if (matches !== null && matches.length > 0) {
      patternsMatched += matches.length;
      appliedTypes.push(type);

      // 패턴 재사용을 위해 lastIndex 초기화
      pattern.lastIndex = 0;
      redacted = redacted.replace(pattern, REDACTION_REPLACEMENT[type]);
    }

    // 다음 반복을 위해 lastIndex 초기화
    pattern.lastIndex = 0;
  }

  return {
    redacted,
    patternsMatched,
    appliedTypes,
  };
}

/**
 * 감사 엔트리의 민감 정보 마스킹
 * who.raw_input, ai_interpretation, output_summary 등 텍스트 필드를 마스킹
 * integrity 필드는 해시 계산 후 설정되므로 이 단계에서는 포함하지 않음
 *
 * @param entry - 마스킹할 감사 엔트리 (audit_id, integrity 제외)
 * @returns 마스킹된 엔트리 및 마스킹 적용 정보
 */
export function redactAuditEntry(
  entry: Omit<AuditEntry, 'audit_id' | 'integrity'>
): {
  readonly redactedEntry: Omit<AuditEntry, 'audit_id' | 'integrity'>;
  readonly redactions: {
    readonly applied: readonly string[];
    readonly patterns_matched: number;
  };
} {
  let totalPatternsMatched = 0;
  const allAppliedTypes = new Set<string>();

  /**
   * 문자열 값에 마스킹 적용하고 통계 누적
   */
  const applyRedaction = (text: string): string => {
    const result = redactSensitiveData(text);
    totalPatternsMatched += result.patternsMatched;
    result.appliedTypes.forEach((t) => allAppliedTypes.add(t));
    return result.redacted;
  };

  // what 섹션 — 사용자 원본 입력 및 AI 해석 결과 마스킹
  const redactedWhat = {
    ...entry.what,
    raw_input: applyRedaction(entry.what.raw_input),
    ai_interpretation: applyRedaction(entry.what.ai_interpretation),
    intent: entry.what.intent,
  };

  // result 섹션 — 출력 요약 마스킹
  const redactedResult = {
    ...entry.result,
    output_summary: applyRedaction(entry.result.output_summary),
  };

  // 마스킹 적용 정보 수집
  const redactions = {
    applied: Array.from(allAppliedTypes),
    patterns_matched: totalPatternsMatched,
  };

  const redactedEntry: Omit<AuditEntry, 'audit_id' | 'integrity'> = {
    ...entry,
    what: redactedWhat,
    result: redactedResult,
    // 마스킹 정보 업데이트
    redactions,
  };

  return { redactedEntry, redactions };
}
