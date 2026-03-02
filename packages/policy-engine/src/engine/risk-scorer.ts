// Risk Score 계산 — 5가지 차원별 위험도 평가 및 종합 점수 산출

import type { RequestIntent } from "@jarvis/shared";
import type { AggregatedMatchResult } from "./rule-matcher.js";

// 5가지 위험 차원 점수
export interface RiskDimensions {
  readonly fileSystem: number;
  readonly execution: number;
  readonly network: number;
  readonly authentication: number;
  readonly destructive: number;
}

// 위험도 평가 결과
export interface RiskAssessment {
  readonly dimensions: RiskDimensions;
  readonly totalScore: number;
  readonly dominantDimension: keyof RiskDimensions;
}

// 의도별 기본 위험 가중치 — 각 의도가 어떤 차원에 기본적으로 영향을 주는지 정의
const INTENT_RISK_WEIGHTS: Record<RequestIntent, Partial<RiskDimensions>> = {
  CODE_IMPLEMENTATION: { fileSystem: 15, execution: 10 },
  FILE_OPERATION: { fileSystem: 25, destructive: 10 },
  APP_LAUNCH: { execution: 20, fileSystem: 5 },
  WEB_ACCESS: { network: 20, authentication: 10 },
  SYSTEM_CONFIG: { fileSystem: 20, execution: 25, destructive: 15 },
  PACKAGE_INSTALL: { network: 15, execution: 15, fileSystem: 10 },
  NETWORK_REQUEST: { network: 25 },
  PROCESS_MANAGEMENT: { execution: 30, destructive: 10 },
  MOBILE_ACTION: { authentication: 20, network: 15 },
};

// 카테고리와 차원 매핑
const CATEGORY_DIMENSION_MAP: Record<string, keyof RiskDimensions> = {
  fs: "fileSystem",
  exec: "execution",
  network: "network",
  auth: "authentication",
  destructive: "destructive",
};

// 종합 Risk Score 계산
export function calculateRiskScore(
  intent: RequestIntent,
  matchResult: AggregatedMatchResult,
  options?: {
    readonly requiresWebAccess?: boolean;
    readonly requiresLogin?: boolean;
  },
): RiskAssessment {
  // 1. 의도별 기본 위험 점수 초기화
  const intentWeights = INTENT_RISK_WEIGHTS[intent];
  const dimensions: Record<keyof RiskDimensions, number> = {
    fileSystem: intentWeights.fileSystem ?? 0,
    execution: intentWeights.execution ?? 0,
    network: intentWeights.network ?? 0,
    authentication: intentWeights.authentication ?? 0,
    destructive: intentWeights.destructive ?? 0,
  };

  // 2. 매칭된 규칙의 위험 가중치를 해당 차원에 가산
  const processedRuleIds = new Set<string>();
  for (const match of matchResult.matches) {
    if (processedRuleIds.has(match.rule.id)) {
      continue;
    }
    processedRuleIds.add(match.rule.id);

    const dimension = CATEGORY_DIMENSION_MAP[match.rule.category];
    if (dimension) {
      dimensions[dimension] = Math.min(100, dimensions[dimension] + match.rule.riskWeight);
    }
  }

  // 3. 추가 컨텍스트 반영
  if (options?.requiresWebAccess) {
    dimensions.network = Math.min(100, dimensions.network + 10);
  }
  if (options?.requiresLogin) {
    dimensions.authentication = Math.min(100, dimensions.authentication + 15);
  }

  // 4. 각 차원을 0-100 범위로 클램핑
  for (const key of Object.keys(dimensions) as Array<keyof RiskDimensions>) {
    dimensions[key] = clamp(dimensions[key], 0, 100);
  }

  // 5. 종합 점수 계산 — 가중 평균 (destructive 차원에 가장 높은 가중치)
  const weights: Record<keyof RiskDimensions, number> = {
    fileSystem: 0.2,
    execution: 0.25,
    network: 0.15,
    authentication: 0.15,
    destructive: 0.25,
  };

  let totalScore = 0;
  for (const key of Object.keys(dimensions) as Array<keyof RiskDimensions>) {
    totalScore += dimensions[key] * weights[key];
  }
  totalScore = Math.round(clamp(totalScore, 0, 100));

  // 6. DENY 규칙이 있으면 최소 점수를 76으로 (CRITICAL 보장)
  if (matchResult.hasDeny) {
    totalScore = Math.max(76, totalScore);
  }

  // 7. 가장 높은 차원 결정
  const dominantDimension = findDominantDimension(dimensions);

  return {
    dimensions: { ...dimensions },
    totalScore,
    dominantDimension,
  };
}

// Risk Level 결정 — 점수 범위에 따른 레벨 분류
export function determineRiskLevel(score: number): "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" {
  if (score <= 25) return "LOW";
  if (score <= 50) return "MEDIUM";
  if (score <= 75) return "HIGH";
  return "CRITICAL";
}

// 가장 높은 위험 차원 찾기
function findDominantDimension(dimensions: Record<keyof RiskDimensions, number>): keyof RiskDimensions {
  let maxKey: keyof RiskDimensions = "fileSystem";
  let maxVal = -1;

  for (const key of Object.keys(dimensions) as Array<keyof RiskDimensions>) {
    if (dimensions[key] > maxVal) {
      maxVal = dimensions[key];
      maxKey = key;
    }
  }

  return maxKey;
}

// 값을 최소-최대 범위로 클램핑
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
