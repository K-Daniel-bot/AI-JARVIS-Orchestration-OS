// 규칙 매칭 엔진 — minimatch glob 패턴 기반으로 정책 규칙 매칭

import { minimatch } from "minimatch";
import type { RequestIntent } from "@jarvis/shared";
import type { PolicyRule, RuleAction } from "../rules/default-rules.js";

// 규칙 매칭 결과
export interface RuleMatchResult {
  readonly rule: PolicyRule;
  readonly matchedTarget: string;
  readonly matchedPattern: string;
}

// 종합 매칭 결과 — 모든 매칭된 규칙과 최종 액션 포함
export interface AggregatedMatchResult {
  readonly matches: readonly RuleMatchResult[];
  readonly highestAction: RuleAction;
  readonly totalRiskWeight: number;
  readonly hasDeny: boolean;
  readonly hasGateRequired: boolean;
}

// 단일 대상에 대해 규칙 목록을 매칭
export function matchTarget(
  target: string,
  rules: readonly PolicyRule[],
  intent: RequestIntent,
): readonly RuleMatchResult[] {
  const results: RuleMatchResult[] = [];

  for (const rule of rules) {
    // 해당 의도에 적용되는 규칙만 검사
    if (!rule.appliesTo.includes(intent)) {
      continue;
    }

    for (const pattern of rule.patterns) {
      if (minimatch(target, pattern, { nocase: true, dot: true })) {
        results.push({
          rule,
          matchedTarget: target,
          matchedPattern: pattern,
        });
        // 하나의 패턴이 매칭되면 같은 규칙의 다른 패턴은 건너뜀
        break;
      }
    }
  }

  return results;
}

// 여러 대상에 대해 규칙을 매칭하고 결과를 종합
export function matchTargets(
  targets: readonly string[],
  rules: readonly PolicyRule[],
  intent: RequestIntent,
): AggregatedMatchResult {
  const allMatches: RuleMatchResult[] = [];

  for (const target of targets) {
    const matches = matchTarget(target, rules, intent);
    allMatches.push(...matches);
  }

  // 최고 액션 결정: DENY > GATE_REQUIRED > ALLOW
  let highestAction: RuleAction = "ALLOW";
  let hasDeny = false;
  let hasGateRequired = false;

  for (const match of allMatches) {
    if (match.rule.action === "DENY") {
      highestAction = "DENY";
      hasDeny = true;
    } else if (match.rule.action === "GATE_REQUIRED" && !hasDeny) {
      highestAction = "GATE_REQUIRED";
      hasGateRequired = true;
    }
  }

  // 총 위험 가중치 계산 (중복 규칙 제거)
  const uniqueRuleIds = new Set(allMatches.map((m) => m.rule.id));
  let totalRiskWeight = 0;
  for (const match of allMatches) {
    if (uniqueRuleIds.has(match.rule.id)) {
      totalRiskWeight += match.rule.riskWeight;
      uniqueRuleIds.delete(match.rule.id);
    }
  }

  return {
    matches: allMatches,
    highestAction,
    totalRiskWeight,
    hasDeny,
    hasGateRequired,
  };
}

// 단일 대상이 특정 패턴 목록에 매칭되는지 검사
export function matchesAnyPattern(
  target: string,
  patterns: readonly string[],
): boolean {
  return patterns.some((pattern) =>
    minimatch(target, pattern, { nocase: true, dot: true }),
  );
}
