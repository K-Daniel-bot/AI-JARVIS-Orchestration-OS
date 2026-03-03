// 민감 정보 마스킹 — secrets, tokens, cookies, passwords 패턴 탐지 및 대체

import type { RedactionCategory } from "@jarvis/shared";

// Redaction 결과
export interface RedactionResult {
  readonly redacted: string;
  readonly applied: readonly RedactionCategory[];
  readonly patternsMatched: number;
}

// 카테고리별 정규식 패턴 정의
const REDACTION_PATTERNS: ReadonlyMap<RedactionCategory, readonly RegExp[]> = new Map([
  ["secrets", [
    // AWS 액세스 키
    /AKIA[0-9A-Z]{16}/g,
    // OpenAI / Anthropic API 키
    /sk-[a-zA-Z0-9_-]{20,}/g,
    // GitHub 토큰 (ghp_, gho_, ghu_, ghs_, ghr_)
    /gh[pousr]_[a-zA-Z0-9]{36,}/g,
    // PEM 형식 비밀 키 블록 (ReDoS 방지: 최대 8KB 길이 제한, RSA-4096 기준 약 3.2KB)
    /-----BEGIN (?:RSA |EC |DSA )?PRIVATE KEY-----[\s\S]{0,8192}?-----END (?:RSA |EC |DSA )?PRIVATE KEY-----/g,
    // 일반 API 키 패턴 (key=value, api_key=value)
    /(?:api[_-]?key|secret[_-]?key|access[_-]?key)\s*[:=]\s*["']?[a-zA-Z0-9_\-/.]{8,}["']?/gi,
  ]],
  ["tokens", [
    // Bearer 토큰
    /Bearer\s+[a-zA-Z0-9_\-/.+=]{20,}/g,
    // JWT 토큰 (3-part dot-separated)
    /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_\-+=]+/g,
    // 일반 토큰 패턴
    /(?:token|auth_token|access_token|refresh_token)\s*[:=]\s*["']?[a-zA-Z0-9_\-/.+=]{8,}["']?/gi,
  ]],
  ["cookies", [
    // Set-Cookie 헤더
    /Set-Cookie:\s*[^\r\n]+/gi,
    // Cookie 헤더
    /Cookie:\s*[^\r\n]+/gi,
    // 세션 쿠키 패턴
    /(?:session[_-]?id|sid)\s*[:=]\s*["']?[a-zA-Z0-9_\-/.+=]{8,}["']?/gi,
  ]],
  ["passwords", [
    // 비밀번호 패턴
    /(?:password|passwd|pwd|pass)\s*[:=]\s*["']?[^\s"']{4,}["']?/gi,
    // 연결 문자열 내 비밀번호
    /[:@][^:@\s]{4,}@/g,
  ]],
]);

// 문자열 내 민감 정보를 마스킹하여 반환
export function redact(input: string): RedactionResult {
  let result = input;
  const applied = new Set<RedactionCategory>();
  let patternsMatched = 0;

  for (const [category, patterns] of REDACTION_PATTERNS) {
    for (const pattern of patterns) {
      // 정규식 lastIndex 초기화 (글로벌 플래그 재사용)
      const regex = new RegExp(pattern.source, pattern.flags);
      const matches = result.match(regex);
      if (matches && matches.length > 0) {
        patternsMatched += matches.length;
        applied.add(category);
        result = result.replace(regex, `[REDACTED:${category}]`);
      }
    }
  }

  return {
    redacted: result,
    applied: [...applied],
    patternsMatched,
  };
}

// JSON 객체 내 모든 문자열 값을 재귀적으로 마스킹
export function redactDeep(value: unknown): { redacted: unknown; totalPatterns: number; categories: readonly RedactionCategory[] } {
  const allCategories = new Set<RedactionCategory>();
  let totalPatterns = 0;

  function walk(v: unknown): unknown {
    if (typeof v === "string") {
      const result = redact(v);
      if (result.patternsMatched > 0) {
        totalPatterns += result.patternsMatched;
        for (const cat of result.applied) {
          allCategories.add(cat);
        }
      }
      return result.redacted;
    }

    if (Array.isArray(v)) {
      return v.map(walk);
    }

    if (v !== null && typeof v === "object") {
      const out: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(v as Record<string, unknown>)) {
        out[key] = walk(val);
      }
      return out;
    }

    return v;
  }

  const redacted = walk(value);
  return {
    redacted,
    totalPatterns,
    categories: [...allCategories],
  };
}
