// @jarvis/policy-engine — 정책 판정 엔진 및 Capability Token 관리 barrel export

// 정책 평가 엔진
export { evaluate } from "./engine/policy-evaluator.js";
export type { EvaluateOptions } from "./engine/policy-evaluator.js";

// 규칙 매칭
export { matchTarget, matchTargets, matchesAnyPattern } from "./engine/rule-matcher.js";
export type { RuleMatchResult, AggregatedMatchResult } from "./engine/rule-matcher.js";

// Risk Score 계산
export { calculateRiskScore, determineRiskLevel } from "./engine/risk-scorer.js";
export type { RiskDimensions, RiskAssessment } from "./engine/risk-scorer.js";

// 기본 규칙
export type { PolicyRule, RuleAction } from "./rules/default-rules.js";
export {
  DEFAULT_RULES,
  FS_WRITE_DENY_RULES,
  EXEC_DENY_RULES,
  NETWORK_RULES,
  MOBILE_RULES,
  DEFAULT_FS_CONSTRAINTS,
  DEFAULT_EXEC_CONSTRAINTS,
  DEFAULT_NETWORK_CONSTRAINTS,
} from "./rules/default-rules.js";

// Capability Token 관리
export { createTokenManager } from "./capability/token-manager.js";
export type { TokenManager, TokenIssueContext, TokenValidateAction } from "./capability/token-manager.js";

// 토큰 저장소
export { createTokenStore } from "./capability/token-store.js";
export type { TokenStore } from "./capability/token-store.js";
