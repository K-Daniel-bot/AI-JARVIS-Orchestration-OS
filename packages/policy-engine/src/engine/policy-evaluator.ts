// 정책 판정 엔진 — 요청의 의도/대상 분석 → 규칙 매칭 → Risk Score 산출 → PolicyDecision 반환

import type {
  PolicyDecision,
  PolicySubject,
  PolicyRequest,
  PolicyStatus,
  GateType,
  CapabilityGrant,
  Result,
  JarvisError,
} from "@jarvis/shared";
import {
  ok,
  err,
  createError,
  generatePolicyDecisionId,
  nowISO,
} from "@jarvis/shared";
import { matchTargets } from "./rule-matcher.js";
import { calculateRiskScore, determineRiskLevel } from "./risk-scorer.js";
import type { PolicyRule } from "../rules/default-rules.js";
import {
  DEFAULT_RULES,
  DEFAULT_FS_CONSTRAINTS,
  DEFAULT_EXEC_CONSTRAINTS,
  DEFAULT_NETWORK_CONSTRAINTS,
} from "../rules/default-rules.js";

// 정책 평가 옵션
export interface EvaluateOptions {
  readonly rules?: readonly PolicyRule[];
  readonly overrideConstraints?: {
    readonly fs?: {
      readonly readAllow?: readonly string[];
      readonly writeAllow?: readonly string[];
      readonly writeDeny?: readonly string[];
    };
    readonly exec?: {
      readonly allow?: readonly string[];
      readonly deny?: readonly string[];
    };
    readonly network?: {
      readonly allowDomains?: readonly string[];
      readonly denyDomains?: readonly string[];
      readonly default?: "ALLOW" | "DENY";
    };
  };
}

// 정책 평가 수행 — 메인 엔트리 포인트
export function evaluate(
  subject: PolicySubject,
  request: PolicyRequest,
  options?: EvaluateOptions,
): Result<PolicyDecision, JarvisError> {
  // 1. 입력 검증
  if (!request.intent) {
    return err(createError("VALIDATION_FAILED", "요청 의도(intent)가 누락되었습니다"));
  }

  if (!request.targets || request.targets.length === 0) {
    return err(createError("VALIDATION_FAILED", "요청 대상(targets)이 비어있습니다"));
  }

  // 2. 규칙 목록 결정
  const rules = options?.rules ?? DEFAULT_RULES;

  // 3. 대상에 대해 규칙 매칭 수행
  const matchResult = matchTargets(request.targets, rules, request.intent);

  // 4. Risk Score 계산
  const riskAssessment = calculateRiskScore(request.intent, matchResult, {
    requiresWebAccess: request.requiresWebAccess,
    requiresLogin: request.requiresLogin,
  });

  // 5. Risk Level 결정
  const riskLevel = determineRiskLevel(riskAssessment.totalScore);

  // 6. 정책 상태 결정
  const status = determinePolicyStatus(matchResult.highestAction, riskLevel);

  // 7. 필요한 게이트 수집
  const requiredGates = collectRequiredGates(matchResult.matches, riskLevel);

  // 8. 사유 코드 수집
  const reasonCodes = matchResult.matches.map((m) => m.rule.id);

  // 9. 사람 읽기용 설명 생성
  const humanExplanation = generateExplanation(status, riskLevel, matchResult.matches, riskAssessment.dominantDimension);

  // 10. 필요한 Capability 수집
  const requiredCapabilities = collectRequiredCapabilities(matchResult.matches);

  // 11. 제약 조건 구성
  const fsOverride = options?.overrideConstraints?.fs;
  const execOverride = options?.overrideConstraints?.exec;
  const networkOverride = options?.overrideConstraints?.network;

  const constraints = {
    fs: {
      readAllow: fsOverride?.readAllow ?? DEFAULT_FS_CONSTRAINTS.readAllow,
      writeAllow: fsOverride?.writeAllow ?? DEFAULT_FS_CONSTRAINTS.writeAllow,
      writeDeny: fsOverride?.writeDeny ?? DEFAULT_FS_CONSTRAINTS.writeDeny,
    },
    exec: {
      allow: execOverride?.allow ?? DEFAULT_EXEC_CONSTRAINTS.allow,
      deny: execOverride?.deny ?? DEFAULT_EXEC_CONSTRAINTS.deny,
    },
    network: {
      allowDomains: networkOverride?.allowDomains ?? DEFAULT_NETWORK_CONSTRAINTS.allowDomains,
      denyDomains: networkOverride?.denyDomains ?? DEFAULT_NETWORK_CONSTRAINTS.denyDomains,
      default: networkOverride?.default ?? DEFAULT_NETWORK_CONSTRAINTS.default,
    },
  };

  // 12. PolicyDecision 조합
  const decision: PolicyDecision = {
    decisionId: generatePolicyDecisionId(),
    timestamp: nowISO(),
    subject,
    request,
    outcome: {
      status,
      riskScore: riskAssessment.totalScore,
      riskLevel,
      requiresGates: requiredGates,
      reasonCodes,
      humanExplanation,
    },
    constraints,
    requiredCapabilities,
  };

  return ok(decision);
}

// 정책 상태 결정 — 규칙 매칭 결과와 위험 레벨 기반
function determinePolicyStatus(
  highestAction: "ALLOW" | "DENY" | "GATE_REQUIRED",
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
): PolicyStatus {
  if (highestAction === "DENY") {
    return "DENY";
  }

  if (highestAction === "GATE_REQUIRED") {
    return "APPROVAL_REQUIRED";
  }

  // ALLOW이지만 위험 레벨이 높으면 제한적 허용
  if (riskLevel === "HIGH" || riskLevel === "CRITICAL") {
    return "APPROVAL_REQUIRED";
  }

  if (riskLevel === "MEDIUM") {
    return "CONSTRAINED_ALLOW";
  }

  return "ALLOW";
}

// 필요한 게이트 수집 — 매칭된 규칙과 위험 레벨에서 추출
function collectRequiredGates(
  matches: readonly { readonly rule: PolicyRule }[],
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
): readonly GateType[] {
  const gates = new Set<GateType>();

  // 규칙에서 명시된 게이트 수집
  for (const match of matches) {
    if (match.rule.requiredGate) {
      gates.add(match.rule.requiredGate);
    }
  }

  // 위험 레벨에 따른 기본 게이트 추가
  if (riskLevel === "HIGH" || riskLevel === "CRITICAL") {
    gates.add("GATE_APPLY_CHANGES");
  }

  if (riskLevel === "CRITICAL") {
    gates.add("GATE_DEPLOY");
  }

  return [...gates];
}

// 필요한 Capability 수집 — 매칭된 규칙에서 추출
function collectRequiredCapabilities(
  matches: readonly { readonly rule: PolicyRule }[],
): readonly CapabilityGrant[] {
  const capMap = new Map<string, PolicyRule>();

  for (const match of matches) {
    if (match.rule.requiredCapability) {
      // 중복 제거: 같은 capability 타입이면 마지막 규칙 사용
      capMap.set(match.rule.requiredCapability, match.rule);
    }
  }

  const capabilities: CapabilityGrant[] = [];
  for (const [cap, rule] of capMap) {
    capabilities.push({
      cap: cap as CapabilityGrant["cap"],
      scope: rule.patterns as unknown as readonly string[],
      ttlSeconds: 900,
      maxUses: 1,
    });
  }

  return capabilities;
}

// 사람 읽기용 설명 생성
function generateExplanation(
  status: PolicyStatus,
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  matches: readonly { readonly rule: PolicyRule; readonly matchedTarget: string }[],
  dominantDimension: string,
): string {
  if (matches.length === 0) {
    return `요청이 정책 규칙에 매칭되지 않았습니다. 위험 레벨: ${riskLevel}`;
  }

  const matchDescriptions = matches
    .slice(0, 3)
    .map((m) => `${m.rule.description} (대상: ${m.matchedTarget})`)
    .join("; ");

  const statusKo = {
    ALLOW: "허용",
    DENY: "거부",
    APPROVAL_REQUIRED: "승인 필요",
    CONSTRAINED_ALLOW: "제한적 허용",
  }[status];

  return `[${statusKo}] 위험 레벨 ${riskLevel}, 주요 위험 차원: ${dominantDimension}. 매칭 규칙: ${matchDescriptions}`;
}
