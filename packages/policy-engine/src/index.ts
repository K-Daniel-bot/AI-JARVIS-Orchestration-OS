// @jarvis/policy-engine 패키지 배럴 익스포트
// policy-risk 에이전트가 사용하는 정책 판정, 위험도 계산, Capability Token 관리를 제공한다.
// export 순서: types → risk-score → capability-token → policy-decision

// ─────────────────────────────────────────
// 위험도 계산 모듈
// ─────────────────────────────────────────

export type { RiskDimensions } from './risk-score.js';
export {
  calculateRiskScore,
  classifyRiskLevel,
  assessDimensions,
} from './risk-score.js';

// ─────────────────────────────────────────
// Capability Token 생명주기 모듈
// ─────────────────────────────────────────

export type { TokenStore, IssueTokenParams } from './capability-token.js';
export {
  createTokenStore,
  issueToken,
  validateToken,
  consumeToken,
  revokeToken,
  revokeAllBySession,
  expireStaleTokens,
} from './capability-token.js';

// ─────────────────────────────────────────
// 정책 판정 엔진 모듈
// ─────────────────────────────────────────

export type {
  DenyPattern,
  PolicyEngine,
  PolicyEngineOptions,
} from './policy-decision.js';
export {
  createPolicyEngine,
  isAutoAllowed,
  isDenied,
  getReasonCodes,
} from './policy-decision.js';
