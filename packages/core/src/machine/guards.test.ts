// 상태 전이 가드 함수 단위 테스트
import { describe, it, expect } from "vitest";
import {
  isPolicyAllow,
  isPolicyConstrainedAllow,
  isPolicyApprovalRequired,
  isPolicyDeny,
  canRetry,
  hasGateApproval,
  hasSpec,
  hasPlan,
  hasChangeSet,
  isNotCriticalRisk,
} from "./guards.js";
import { createInitialContext } from "./context.js";
import { createEnvironmentBundle } from "../types/environment.js";
import { LOOP_LIMITS } from "@jarvis/shared";
import type { JarvisMachineContext, GateApproval } from "./context.js";
import type { PolicyDecision } from "@jarvis/shared";
import type { SpecRef, PlanRef, ChangeSetRef } from "../types/environment.js";

// 테스트용 기본 컨텍스트 생성 헬퍼
function makeContext(overrides?: Partial<JarvisMachineContext>): JarvisMachineContext {
  const env = createEnvironmentBundle("run-001", "session-001");
  const base = createInitialContext("run-001", "session-001", env);
  return { ...base, ...overrides } as JarvisMachineContext;
}

// 테스트용 PolicyDecision 픽스처 생성 헬퍼
function makePolicyDecision(
  status: "ALLOW" | "DENY" | "APPROVAL_REQUIRED" | "CONSTRAINED_ALLOW",
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW",
): PolicyDecision {
  return {
    decisionId: "decision-001",
    timestamp: new Date().toISOString(),
    subject: {
      userId: "user-001",
      role: "User",
      device: "desktop",
      sessionId: "session-001",
    },
    request: {
      rawInput: "테스트 요청",
      intent: "CODE_IMPLEMENTATION",
      targets: [],
      requiresWebAccess: false,
      requiresLogin: false,
    },
    outcome: {
      status,
      riskScore: 10,
      riskLevel,
      requiresGates: [],
      reasonCodes: [],
      humanExplanation: "테스트 판정",
    },
    constraints: {
      fs: { readAllow: [], writeAllow: [], writeDeny: [] },
      exec: { allow: [], deny: [] },
      network: { allowDomains: [], denyDomains: [], default: "DENY" },
    },
    requiredCapabilities: [],
  };
}

// 테스트용 게이트 승인 픽스처
function makeGateApproval(gateLevel: "L1" | "L2" | "L3"): GateApproval {
  return {
    gateId: `gate-${gateLevel}`,
    gateLevel,
    approvedBy: "user-test",
    approvedAt: new Date().toISOString(),
    scopeModifications: [],
  };
}

// 테스트용 SpecRef 픽스처
function makeSpecRef(): SpecRef {
  return {
    specId: "spec-001",
    rawInput: "파일 생성",
    interpretation: "파일 생성 요청",
    clarifications: [],
  };
}

// 테스트용 PlanRef 픽스처
function makePlanRef(): PlanRef {
  return {
    planId: "plan-001",
    steps: [],
    estimatedDurationMs: 1000,
  };
}

// 테스트용 ChangeSetRef 픽스처
function makeChangeSetRef(): ChangeSetRef {
  return {
    changeSetId: "changeset-001",
    files: [],
    summary: "테스트 변경",
  };
}

describe("isPolicyAllow", () => {
  it("policyDecision.outcome.status가 ALLOW이면 true를 반환해야 한다", () => {
    // Arrange
    const context = makeContext({ policyDecision: makePolicyDecision("ALLOW") });

    // Act
    const result = isPolicyAllow(context);

    // Assert
    expect(result).toBe(true);
  });

  it("policyDecision.outcome.status가 DENY이면 false를 반환해야 한다", () => {
    // Arrange
    const context = makeContext({ policyDecision: makePolicyDecision("DENY") });

    // Act
    const result = isPolicyAllow(context);

    // Assert
    expect(result).toBe(false);
  });

  it("policyDecision이 null이면 false를 반환해야 한다", () => {
    // Arrange
    const context = makeContext({ policyDecision: null });

    // Act
    const result = isPolicyAllow(context);

    // Assert
    expect(result).toBe(false);
  });

  it("CONSTRAINED_ALLOW 상태에서 false를 반환해야 한다", () => {
    // Arrange
    const context = makeContext({ policyDecision: makePolicyDecision("CONSTRAINED_ALLOW") });

    // Act
    const result = isPolicyAllow(context);

    // Assert
    expect(result).toBe(false);
  });
});

describe("isPolicyConstrainedAllow", () => {
  it("CONSTRAINED_ALLOW 상태에서 true를 반환해야 한다", () => {
    // Arrange
    const context = makeContext({ policyDecision: makePolicyDecision("CONSTRAINED_ALLOW") });

    // Act
    const result = isPolicyConstrainedAllow(context);

    // Assert
    expect(result).toBe(true);
  });

  it("ALLOW 상태에서 false를 반환해야 한다", () => {
    // Arrange
    const context = makeContext({ policyDecision: makePolicyDecision("ALLOW") });

    // Act
    const result = isPolicyConstrainedAllow(context);

    // Assert
    expect(result).toBe(false);
  });

  it("policyDecision이 null이면 false를 반환해야 한다", () => {
    // Arrange
    const context = makeContext({ policyDecision: null });

    // Act
    const result = isPolicyConstrainedAllow(context);

    // Assert
    expect(result).toBe(false);
  });
});

describe("isPolicyApprovalRequired", () => {
  it("APPROVAL_REQUIRED 상태에서 true를 반환해야 한다", () => {
    // Arrange
    const context = makeContext({ policyDecision: makePolicyDecision("APPROVAL_REQUIRED") });

    // Act
    const result = isPolicyApprovalRequired(context);

    // Assert
    expect(result).toBe(true);
  });

  it("ALLOW 상태에서 false를 반환해야 한다", () => {
    // Arrange
    const context = makeContext({ policyDecision: makePolicyDecision("ALLOW") });

    // Act
    const result = isPolicyApprovalRequired(context);

    // Assert
    expect(result).toBe(false);
  });

  it("policyDecision이 null이면 false를 반환해야 한다", () => {
    // Arrange
    const context = makeContext({ policyDecision: null });

    // Act
    const result = isPolicyApprovalRequired(context);

    // Assert
    expect(result).toBe(false);
  });
});

describe("isPolicyDeny", () => {
  it("DENY 상태에서 true를 반환해야 한다", () => {
    // Arrange
    const context = makeContext({ policyDecision: makePolicyDecision("DENY") });

    // Act
    const result = isPolicyDeny(context);

    // Assert
    expect(result).toBe(true);
  });

  it("ALLOW 상태에서 false를 반환해야 한다", () => {
    // Arrange
    const context = makeContext({ policyDecision: makePolicyDecision("ALLOW") });

    // Act
    const result = isPolicyDeny(context);

    // Assert
    expect(result).toBe(false);
  });

  it("policyDecision이 null이면 false를 반환해야 한다", () => {
    // Arrange
    const context = makeContext({ policyDecision: null });

    // Act
    const result = isPolicyDeny(context);

    // Assert
    expect(result).toBe(false);
  });

  it("CONSTRAINED_ALLOW 상태에서 false를 반환해야 한다", () => {
    // Arrange
    const context = makeContext({ policyDecision: makePolicyDecision("CONSTRAINED_ALLOW") });

    // Act
    const result = isPolicyDeny(context);

    // Assert
    expect(result).toBe(false);
  });
});

describe("canRetry", () => {
  it("retryCount가 최대 한도보다 작으면 true를 반환해야 한다", () => {
    // Arrange
    const context = makeContext({ retryCount: 0 });

    // Act
    const result = canRetry(context);

    // Assert
    expect(result).toBe(true);
  });

  it("retryCount가 최대 한도(MAX_CONSECUTIVE_ERRORS - 1)이면 true를 반환해야 한다", () => {
    // Arrange
    const context = makeContext({ retryCount: LOOP_LIMITS.MAX_CONSECUTIVE_ERRORS - 1 });

    // Act
    const result = canRetry(context);

    // Assert
    expect(result).toBe(true);
  });

  it("retryCount가 최대 한도(MAX_CONSECUTIVE_ERRORS)와 같으면 false를 반환해야 한다", () => {
    // Arrange
    const context = makeContext({ retryCount: LOOP_LIMITS.MAX_CONSECUTIVE_ERRORS });

    // Act
    const result = canRetry(context);

    // Assert
    expect(result).toBe(false);
  });

  it("retryCount가 최대 한도를 초과하면 false를 반환해야 한다", () => {
    // Arrange
    const context = makeContext({ retryCount: LOOP_LIMITS.MAX_CONSECUTIVE_ERRORS + 1 });

    // Act
    const result = canRetry(context);

    // Assert
    expect(result).toBe(false);
  });
});

describe("hasGateApproval", () => {
  it("해당 레벨의 승인이 존재하면 true를 반환해야 한다", () => {
    // Arrange
    const context = makeContext({ gateApprovals: [makeGateApproval("L1")] });

    // Act
    const result = hasGateApproval(context, "L1");

    // Assert
    expect(result).toBe(true);
  });

  it("해당 레벨의 승인이 없으면 false를 반환해야 한다", () => {
    // Arrange
    const context = makeContext({ gateApprovals: [makeGateApproval("L2")] });

    // Act
    const result = hasGateApproval(context, "L1");

    // Assert
    expect(result).toBe(false);
  });

  it("빈 gateApprovals에서 false를 반환해야 한다", () => {
    // Arrange
    const context = makeContext({ gateApprovals: [] });

    // Act
    const result = hasGateApproval(context, "L3");

    // Assert
    expect(result).toBe(false);
  });

  it("여러 레벨 중 일치하는 레벨만 찾아야 한다", () => {
    // Arrange
    const context = makeContext({
      gateApprovals: [
        makeGateApproval("L1"),
        makeGateApproval("L2"),
      ],
    });

    // Act & Assert
    expect(hasGateApproval(context, "L1")).toBe(true);
    expect(hasGateApproval(context, "L2")).toBe(true);
    expect(hasGateApproval(context, "L3")).toBe(false);
  });
});

describe("hasSpec", () => {
  it("environment.spec이 null이 아니면 true를 반환해야 한다", () => {
    // Arrange
    const env = { ...createEnvironmentBundle("run-001", "session-001"), spec: makeSpecRef() };
    const context = makeContext({ environment: env });

    // Act
    const result = hasSpec(context);

    // Assert
    expect(result).toBe(true);
  });

  it("environment.spec이 null이면 false를 반환해야 한다", () => {
    // Arrange
    const context = makeContext();

    // Act
    const result = hasSpec(context);

    // Assert
    expect(result).toBe(false);
  });
});

describe("hasPlan", () => {
  it("environment.plan이 null이 아니면 true를 반환해야 한다", () => {
    // Arrange
    const env = { ...createEnvironmentBundle("run-001", "session-001"), plan: makePlanRef() };
    const context = makeContext({ environment: env });

    // Act
    const result = hasPlan(context);

    // Assert
    expect(result).toBe(true);
  });

  it("environment.plan이 null이면 false를 반환해야 한다", () => {
    // Arrange
    const context = makeContext();

    // Act
    const result = hasPlan(context);

    // Assert
    expect(result).toBe(false);
  });
});

describe("hasChangeSet", () => {
  it("environment.changeSet이 null이 아니면 true를 반환해야 한다", () => {
    // Arrange
    const env = {
      ...createEnvironmentBundle("run-001", "session-001"),
      changeSet: makeChangeSetRef(),
    };
    const context = makeContext({ environment: env });

    // Act
    const result = hasChangeSet(context);

    // Assert
    expect(result).toBe(true);
  });

  it("environment.changeSet이 null이면 false를 반환해야 한다", () => {
    // Arrange
    const context = makeContext();

    // Act
    const result = hasChangeSet(context);

    // Assert
    expect(result).toBe(false);
  });
});

describe("isNotCriticalRisk", () => {
  it("riskLevel이 CRITICAL이 아닌 경우 true를 반환해야 한다", () => {
    // Arrange
    const context = makeContext({
      policyDecision: makePolicyDecision("ALLOW", "HIGH"),
    });

    // Act
    const result = isNotCriticalRisk(context);

    // Assert
    expect(result).toBe(true);
  });

  it("riskLevel이 CRITICAL이면 false를 반환해야 한다", () => {
    // Arrange
    const context = makeContext({
      policyDecision: makePolicyDecision("DENY", "CRITICAL"),
    });

    // Act
    const result = isNotCriticalRisk(context);

    // Assert
    expect(result).toBe(false);
  });

  it("LOW 위험도에서 true를 반환해야 한다", () => {
    // Arrange
    const context = makeContext({
      policyDecision: makePolicyDecision("ALLOW", "LOW"),
    });

    // Act
    const result = isNotCriticalRisk(context);

    // Assert
    expect(result).toBe(true);
  });

  it("MEDIUM 위험도에서 true를 반환해야 한다", () => {
    // Arrange
    const context = makeContext({
      policyDecision: makePolicyDecision("ALLOW", "MEDIUM"),
    });

    // Act
    const result = isNotCriticalRisk(context);

    // Assert
    expect(result).toBe(true);
  });

  it("policyDecision이 null이면 true를 반환해야 한다 (CRITICAL 아님)", () => {
    // Arrange
    const context = makeContext({ policyDecision: null });

    // Act
    const result = isNotCriticalRisk(context);

    // Assert
    expect(result).toBe(true);
  });
});
