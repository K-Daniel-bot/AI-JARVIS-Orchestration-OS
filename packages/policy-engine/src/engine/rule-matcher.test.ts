// 규칙 매칭 엔진 단위 테스트

import { describe, it, expect } from "vitest";
import { matchTarget, matchTargets, matchesAnyPattern } from "./rule-matcher.js";
import type { PolicyRule } from "../rules/default-rules.js";

// 테스트용 규칙 픽스처
const DENY_RULE: PolicyRule = {
  id: "test.deny.system",
  description: "테스트 거부 규칙",
  category: "fs",
  patterns: ["/Windows/**", "/System/**"],
  action: "DENY",
  riskWeight: 100,
  appliesTo: ["FILE_OPERATION", "SYSTEM_CONFIG"],
};

const GATE_RULE: PolicyRule = {
  id: "test.gate.secrets",
  description: "테스트 게이트 규칙",
  category: "fs",
  patterns: ["**/.env", "**/*.key"],
  action: "GATE_REQUIRED",
  riskWeight: 70,
  appliesTo: ["FILE_OPERATION", "CODE_IMPLEMENTATION"],
  requiredGate: "GATE_APPLY_CHANGES",
  requiredCapability: "fs.write",
};

const ALLOW_RULE: PolicyRule = {
  id: "test.allow.src",
  description: "테스트 허용 규칙",
  category: "fs",
  patterns: ["src/**"],
  action: "ALLOW",
  riskWeight: 10,
  appliesTo: ["FILE_OPERATION", "CODE_IMPLEMENTATION"],
};

const EXEC_DENY_RULE: PolicyRule = {
  id: "test.deny.sudo",
  description: "테스트 sudo 거부 규칙",
  category: "exec",
  patterns: ["sudo", "sudo *"],
  action: "DENY",
  riskWeight: 95,
  appliesTo: ["PROCESS_MANAGEMENT", "SYSTEM_CONFIG"],
};

describe("matchTarget", () => {
  it("패턴에 매칭되는 대상에 대해 결과를 반환해야 한다", () => {
    // Arrange
    const target = "/Windows/system32/file.dll";
    const rules = [DENY_RULE];

    // Act
    const results = matchTarget(target, rules, "FILE_OPERATION");

    // Assert
    expect(results.length).toBe(1);
    expect(results[0]?.rule.id).toBe("test.deny.system");
    expect(results[0]?.matchedTarget).toBe(target);
    expect(results[0]?.matchedPattern).toBe("/Windows/**");
  });

  it("의도가 규칙에 포함되지 않으면 매칭을 건너뛰어야 한다", () => {
    // Arrange
    const target = "/Windows/system32/file.dll";
    const rules = [DENY_RULE];

    // Act — DENY_RULE은 APP_LAUNCH에 적용되지 않음
    const results = matchTarget(target, rules, "APP_LAUNCH");

    // Assert
    expect(results.length).toBe(0);
  });

  it("매칭되지 않는 대상에 대해 빈 배열을 반환해야 한다", () => {
    // Arrange
    const target = "/home/user/project/src/index.ts";
    const rules = [DENY_RULE];

    // Act
    const results = matchTarget(target, rules, "FILE_OPERATION");

    // Assert
    expect(results).toHaveLength(0);
  });

  it("glob 패턴(**.env)이 정확히 매칭되어야 한다", () => {
    // Arrange
    const target = "/project/.env";
    const rules = [GATE_RULE];

    // Act
    const results = matchTarget(target, rules, "FILE_OPERATION");

    // Assert
    expect(results.length).toBe(1);
    expect(results[0]?.rule.id).toBe("test.gate.secrets");
  });

  it("**.key 패턴이 중첩 경로에 매칭되어야 한다", () => {
    // Arrange
    const target = "secrets/api.key";
    const rules = [GATE_RULE];

    // Act
    const results = matchTarget(target, rules, "CODE_IMPLEMENTATION");

    // Assert
    expect(results.length).toBe(1);
    expect(results[0]?.matchedPattern).toBe("**/*.key");
  });

  it("같은 규칙의 두 번째 패턴이 매칭되더라도 한 번만 결과에 포함되어야 한다", () => {
    // Arrange — DENY_RULE의 두 번째 패턴 /System/**도 매칭되지만 break로 중단
    const target = "/System/Library/file";
    const rules = [DENY_RULE];

    // Act
    const results = matchTarget(target, rules, "FILE_OPERATION");

    // Assert
    expect(results.length).toBe(1);
    expect(results[0]?.matchedPattern).toBe("/System/**");
  });

  it("여러 규칙이 매칭될 때 모두 반환해야 한다", () => {
    // Arrange
    const target = "/project/.env";
    const rules = [DENY_RULE, GATE_RULE, ALLOW_RULE];

    // Act
    const results = matchTarget(target, rules, "FILE_OPERATION");

    // Assert — GATE_RULE만 매칭됨
    expect(results.length).toBe(1);
    expect(results[0]?.rule.id).toBe("test.gate.secrets");
  });
});

describe("matchTargets", () => {
  it("DENY 규칙이 있으면 highestAction이 DENY여야 한다", () => {
    // Arrange
    const targets = ["/Windows/system32/cmd.exe"];
    const rules = [DENY_RULE, GATE_RULE];

    // Act
    const result = matchTargets(targets, rules, "FILE_OPERATION");

    // Assert
    expect(result.highestAction).toBe("DENY");
    expect(result.hasDeny).toBe(true);
  });

  it("GATE_REQUIRED 규칙만 있으면 highestAction이 GATE_REQUIRED여야 한다", () => {
    // Arrange
    const targets = ["/project/.env"];
    const rules = [GATE_RULE];

    // Act
    const result = matchTargets(targets, rules, "FILE_OPERATION");

    // Assert
    expect(result.highestAction).toBe("GATE_REQUIRED");
    expect(result.hasGateRequired).toBe(true);
    expect(result.hasDeny).toBe(false);
  });

  it("ALLOW 규칙만 있으면 highestAction이 ALLOW여야 한다", () => {
    // Arrange
    const targets = ["src/index.ts"];
    const rules = [ALLOW_RULE];

    // Act
    const result = matchTargets(targets, rules, "FILE_OPERATION");

    // Assert
    expect(result.highestAction).toBe("ALLOW");
    expect(result.hasDeny).toBe(false);
    expect(result.hasGateRequired).toBe(false);
  });

  it("매칭 규칙이 없으면 highestAction이 ALLOW이고 matches가 비어야 한다", () => {
    // Arrange
    const targets = ["/home/user/README.md"];
    const rules = [DENY_RULE];

    // Act
    const result = matchTargets(targets, rules, "FILE_OPERATION");

    // Assert
    expect(result.highestAction).toBe("ALLOW");
    expect(result.matches).toHaveLength(0);
    expect(result.totalRiskWeight).toBe(0);
  });

  it("DENY가 GATE_REQUIRED보다 우선되어야 한다", () => {
    // Arrange
    const targets = ["/Windows/system32/cmd.exe", "/project/.env"];
    const rules = [DENY_RULE, GATE_RULE];

    // Act
    const result = matchTargets(targets, rules, "FILE_OPERATION");

    // Assert
    expect(result.highestAction).toBe("DENY");
    expect(result.hasDeny).toBe(true);
    // DENY가 먼저 매칭되면 hasGateRequired는 설정되지 않음
    expect(result.hasGateRequired).toBe(false);
  });

  it("여러 대상의 totalRiskWeight를 올바르게 합산해야 한다", () => {
    // Arrange
    const targets = ["/project/.env", "/project/api.key"];
    const rules = [GATE_RULE];

    // Act
    const result = matchTargets(targets, rules, "FILE_OPERATION");

    // Assert — 같은 규칙은 중복 제거하므로 riskWeight는 70
    expect(result.totalRiskWeight).toBe(70);
  });

  it("다른 규칙들의 riskWeight를 각각 합산해야 한다", () => {
    // Arrange
    const targets = ["/Windows/system32/cmd.exe", "/project/.env"];
    const rules = [DENY_RULE, GATE_RULE];

    // Act
    const result = matchTargets(targets, rules, "FILE_OPERATION");

    // Assert — DENY_RULE(100) + GATE_RULE(70) = 170
    expect(result.totalRiskWeight).toBe(170);
  });

  it("빈 targets 배열이면 빈 matches를 반환해야 한다", () => {
    // Arrange
    const targets: string[] = [];
    const rules = [DENY_RULE];

    // Act
    const result = matchTargets(targets, rules, "FILE_OPERATION");

    // Assert
    expect(result.matches).toHaveLength(0);
    expect(result.highestAction).toBe("ALLOW");
  });

  it("PROCESS_MANAGEMENT 의도에 exec 규칙이 적용되어야 한다", () => {
    // Arrange
    const targets = ["sudo"];
    const rules = [EXEC_DENY_RULE];

    // Act
    const result = matchTargets(targets, rules, "PROCESS_MANAGEMENT");

    // Assert
    expect(result.hasDeny).toBe(true);
    expect(result.matches.length).toBeGreaterThan(0);
  });
});

describe("matchesAnyPattern", () => {
  it("패턴 목록 중 하나라도 매칭되면 true를 반환해야 한다", () => {
    // Arrange
    const target = "/project/.env";
    const patterns = ["**/.env", "**/*.key"];

    // Act & Assert
    expect(matchesAnyPattern(target, patterns)).toBe(true);
  });

  it("어떤 패턴에도 매칭되지 않으면 false를 반환해야 한다", () => {
    // Arrange
    const target = "/project/src/index.ts";
    const patterns = ["**/.env", "**/*.key"];

    // Act & Assert
    expect(matchesAnyPattern(target, patterns)).toBe(false);
  });

  it("빈 패턴 목록이면 false를 반환해야 한다", () => {
    // Arrange
    const target = "/project/.env";
    const patterns: string[] = [];

    // Act & Assert
    expect(matchesAnyPattern(target, patterns)).toBe(false);
  });

  it("대소문자 구분 없이 매칭해야 한다", () => {
    // Arrange
    const target = "/Project/.ENV";
    const patterns = ["**/.env"];

    // Act & Assert
    expect(matchesAnyPattern(target, patterns)).toBe(true);
  });

  it("dot 파일(숨김 파일)에 매칭해야 한다", () => {
    // Arrange
    const target = ".hidden/secret.key";
    const patterns = ["**/*.key"];

    // Act & Assert
    expect(matchesAnyPattern(target, patterns)).toBe(true);
  });
});
