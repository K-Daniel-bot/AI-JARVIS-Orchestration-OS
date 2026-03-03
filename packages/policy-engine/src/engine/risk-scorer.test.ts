// Risk Score 계산 단위 테스트

import { describe, it, expect } from "vitest";
import { calculateRiskScore, determineRiskLevel } from "./risk-scorer.js";
import type { AggregatedMatchResult } from "./rule-matcher.js";
import type { PolicyRule } from "../rules/default-rules.js";

// 테스트용 빈 매칭 결과 픽스처
function makeEmptyMatchResult(): AggregatedMatchResult {
  return {
    matches: [],
    highestAction: "ALLOW",
    totalRiskWeight: 0,
    hasDeny: false,
    hasGateRequired: false,
  };
}

// 테스트용 규칙 픽스처
function makeFsRule(riskWeight: number): PolicyRule {
  return {
    id: `test.fs.rule.${riskWeight}`,
    description: "테스트 파일 시스템 규칙",
    category: "fs",
    patterns: ["**/*.secret"],
    action: "GATE_REQUIRED",
    riskWeight,
    appliesTo: ["FILE_OPERATION"],
  };
}

function makeExecRule(riskWeight: number): PolicyRule {
  return {
    id: `test.exec.rule.${riskWeight}`,
    description: "테스트 실행 규칙",
    category: "exec",
    patterns: ["dangerous *"],
    action: "DENY",
    riskWeight,
    appliesTo: ["PROCESS_MANAGEMENT"],
  };
}

function makeDestructiveRule(riskWeight: number): PolicyRule {
  return {
    id: `test.destructive.rule.${riskWeight}`,
    description: "테스트 파괴적 규칙",
    category: "destructive",
    patterns: ["rm -rf *"],
    action: "DENY",
    riskWeight,
    appliesTo: ["FILE_OPERATION"],
  };
}

describe("determineRiskLevel", () => {
  it("점수 0은 LOW 레벨이어야 한다", () => {
    expect(determineRiskLevel(0)).toBe("LOW");
  });

  it("점수 25는 LOW 레벨이어야 한다", () => {
    expect(determineRiskLevel(25)).toBe("LOW");
  });

  it("점수 26은 MEDIUM 레벨이어야 한다", () => {
    expect(determineRiskLevel(26)).toBe("MEDIUM");
  });

  it("점수 50은 MEDIUM 레벨이어야 한다", () => {
    expect(determineRiskLevel(50)).toBe("MEDIUM");
  });

  it("점수 51은 HIGH 레벨이어야 한다", () => {
    expect(determineRiskLevel(51)).toBe("HIGH");
  });

  it("점수 75는 HIGH 레벨이어야 한다", () => {
    expect(determineRiskLevel(75)).toBe("HIGH");
  });

  it("점수 76은 CRITICAL 레벨이어야 한다", () => {
    expect(determineRiskLevel(76)).toBe("CRITICAL");
  });

  it("점수 100은 CRITICAL 레벨이어야 한다", () => {
    expect(determineRiskLevel(100)).toBe("CRITICAL");
  });
});

describe("calculateRiskScore", () => {
  it("매칭 없이 CODE_IMPLEMENTATION 의도는 기본 가중치로 계산되어야 한다", () => {
    // Arrange
    const matchResult = makeEmptyMatchResult();

    // Act
    const result = calculateRiskScore("CODE_IMPLEMENTATION", matchResult);

    // Assert — fileSystem:15, execution:10, 나머지 0
    // totalScore = 15*0.2 + 10*0.25 + 0*0.15 + 0*0.15 + 0*0.25 = 3 + 2.5 = 5.5 → 6
    expect(result.totalScore).toBeGreaterThan(0);
    expect(result.dimensions.fileSystem).toBe(15);
    expect(result.dimensions.execution).toBe(10);
    expect(result.dimensions.network).toBe(0);
  });

  it("FILE_OPERATION 의도는 fileSystem 차원에 기본 가중치를 가져야 한다", () => {
    // Arrange
    const matchResult = makeEmptyMatchResult();

    // Act
    const result = calculateRiskScore("FILE_OPERATION", matchResult);

    // Assert
    expect(result.dimensions.fileSystem).toBe(25);
    expect(result.dimensions.destructive).toBe(10);
  });

  it("WEB_ACCESS 의도는 network 차원에 기본 가중치를 가져야 한다", () => {
    // Arrange
    const matchResult = makeEmptyMatchResult();

    // Act
    const result = calculateRiskScore("WEB_ACCESS", matchResult);

    // Assert
    expect(result.dimensions.network).toBe(20);
    expect(result.dimensions.authentication).toBe(10);
  });

  it("fs 카테고리 규칙 매칭 시 fileSystem 차원에 가산되어야 한다", () => {
    // Arrange
    const fsRule = makeFsRule(30);
    const matchResult: AggregatedMatchResult = {
      matches: [{ rule: fsRule, matchedTarget: "/project/.env", matchedPattern: "**/*.secret" }],
      highestAction: "GATE_REQUIRED",
      totalRiskWeight: 30,
      hasDeny: false,
      hasGateRequired: true,
    };

    // Act
    const result = calculateRiskScore("FILE_OPERATION", matchResult);

    // Assert — FILE_OPERATION 기본 fileSystem:25 + 규칙 30 = 55
    expect(result.dimensions.fileSystem).toBe(55);
  });

  it("같은 규칙이 여러 대상에 매칭되어도 한 번만 가산되어야 한다", () => {
    // Arrange
    const fsRule = makeFsRule(30);
    const matchResult: AggregatedMatchResult = {
      matches: [
        { rule: fsRule, matchedTarget: "/project/.env", matchedPattern: "**/*.secret" },
        { rule: fsRule, matchedTarget: "/project/api.secret", matchedPattern: "**/*.secret" },
      ],
      highestAction: "GATE_REQUIRED",
      totalRiskWeight: 30,
      hasDeny: false,
      hasGateRequired: true,
    };

    // Act
    const result = calculateRiskScore("FILE_OPERATION", matchResult);

    // Assert — 같은 규칙 id → 중복 제거, 파일시스템 25 + 30 = 55
    expect(result.dimensions.fileSystem).toBe(55);
  });

  it("hasDeny가 true이면 totalScore가 최소 76 이상이어야 한다", () => {
    // Arrange
    const matchResult: AggregatedMatchResult = {
      matches: [],
      highestAction: "DENY",
      totalRiskWeight: 0,
      hasDeny: true,
      hasGateRequired: false,
    };

    // Act
    const result = calculateRiskScore("FILE_OPERATION", matchResult);

    // Assert
    expect(result.totalScore).toBeGreaterThanOrEqual(76);
  });

  it("requiresWebAccess 옵션이 network 차원을 10 증가시켜야 한다", () => {
    // Arrange
    const matchResult = makeEmptyMatchResult();
    const baseResult = calculateRiskScore("CODE_IMPLEMENTATION", matchResult);

    // Act
    const result = calculateRiskScore("CODE_IMPLEMENTATION", matchResult, {
      requiresWebAccess: true,
    });

    // Assert
    expect(result.dimensions.network).toBe(baseResult.dimensions.network + 10);
  });

  it("requiresLogin 옵션이 authentication 차원을 15 증가시켜야 한다", () => {
    // Arrange
    const matchResult = makeEmptyMatchResult();
    const baseResult = calculateRiskScore("CODE_IMPLEMENTATION", matchResult);

    // Act
    const result = calculateRiskScore("CODE_IMPLEMENTATION", matchResult, {
      requiresLogin: true,
    });

    // Assert
    expect(result.dimensions.authentication).toBe(baseResult.dimensions.authentication + 15);
  });

  it("totalScore는 0 이상 100 이하여야 한다", () => {
    // Arrange — 모든 차원을 최대화하는 규칙들
    const execRule = makeExecRule(100);
    const destructiveRule = makeDestructiveRule(100);
    const matchResult: AggregatedMatchResult = {
      matches: [
        { rule: execRule, matchedTarget: "dangerous cmd", matchedPattern: "dangerous *" },
        { rule: destructiveRule, matchedTarget: "rm -rf /home", matchedPattern: "rm -rf *" },
      ],
      highestAction: "DENY",
      totalRiskWeight: 200,
      hasDeny: true,
      hasGateRequired: false,
    };

    // Act
    const result = calculateRiskScore("SYSTEM_CONFIG", matchResult, {
      requiresWebAccess: true,
      requiresLogin: true,
    });

    // Assert
    expect(result.totalScore).toBeGreaterThanOrEqual(0);
    expect(result.totalScore).toBeLessThanOrEqual(100);
  });

  it("dimensions의 각 값이 100을 초과하지 않아야 한다", () => {
    // Arrange — fileSystem 차원을 초과하도록 설정
    const fsRule1 = makeFsRule(80);
    const fsRule2 = { ...makeFsRule(80), id: "test.fs.rule.80b" };
    const matchResult: AggregatedMatchResult = {
      matches: [
        { rule: fsRule1, matchedTarget: "/file1.secret", matchedPattern: "**/*.secret" },
        { rule: fsRule2, matchedTarget: "/file2.secret", matchedPattern: "**/*.secret" },
      ],
      highestAction: "GATE_REQUIRED",
      totalRiskWeight: 160,
      hasDeny: false,
      hasGateRequired: true,
    };

    // Act
    const result = calculateRiskScore("FILE_OPERATION", matchResult);

    // Assert — FILE_OPERATION 기본 fileSystem:25 + 80 + 80 = 185 → 클램핑 → 100
    expect(result.dimensions.fileSystem).toBeLessThanOrEqual(100);
  });

  it("dominantDimension은 가장 높은 값을 가진 차원이어야 한다", () => {
    // Arrange — network 차원을 지배적으로 설정
    const matchResult = makeEmptyMatchResult();

    // Act — WEB_ACCESS는 network:20 + requiresWebAccess:+10 = 30
    const result = calculateRiskScore("WEB_ACCESS", matchResult, {
      requiresWebAccess: true,
      requiresLogin: true,
    });

    // Assert — network:30, authentication:25 → network가 지배적
    expect(result.dominantDimension).toBe("network");
  });

  it("PROCESS_MANAGEMENT 의도는 execution 차원에 최대 기본 가중치를 가져야 한다", () => {
    // Arrange
    const matchResult = makeEmptyMatchResult();

    // Act
    const result = calculateRiskScore("PROCESS_MANAGEMENT", matchResult);

    // Assert
    expect(result.dimensions.execution).toBe(30);
    expect(result.dimensions.destructive).toBe(10);
  });
});
