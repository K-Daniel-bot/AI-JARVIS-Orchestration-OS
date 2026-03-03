// XState v5 JARVIS 상태 머신 단위 테스트
import { describe, it, expect } from "vitest";
import { createActor } from "xstate";
import { jarvisMachine } from "./jarvis-machine.js";
import { MACHINE_STATES, AGENT_TYPES } from "@jarvis/shared";
import type { PolicyDecision } from "@jarvis/shared";

// 테스트용 머신 액터 생성 헬퍼
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function makeActor(runId = "run-001", sessionId = "session-001"): any {
  const actor = createActor(jarvisMachine, {
    input: { runId, sessionId },
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return actor as any;
}

// 테스트용 PolicyDecision 픽스처
function makePolicyDecision(
  status: "ALLOW" | "DENY" | "APPROVAL_REQUIRED" | "CONSTRAINED_ALLOW",
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
      riskLevel: "LOW",
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

describe("jarvisMachine 초기 상태", () => {
  it("초기 상태가 IDLE이어야 한다", () => {
    // Arrange
    const actor = makeActor();
    actor.start();

    // Act
    const snapshot = actor.getSnapshot();

    // Assert
    expect(snapshot.value).toBe(MACHINE_STATES.IDLE);

    actor.stop();
  });

  it("초기 컨텍스트의 runId와 sessionId가 입력값과 일치해야 한다", () => {
    // Arrange
    const actor = makeActor("run-xyz", "session-xyz");
    actor.start();

    // Act
    const { context } = actor.getSnapshot();

    // Assert
    expect(context.runId).toBe("run-xyz");
    expect(context.sessionId).toBe("session-xyz");

    actor.stop();
  });

  it("초기 컨텍스트의 currentAgent가 null이어야 한다", () => {
    // Arrange
    const actor = makeActor();
    actor.start();

    // Act
    const { context } = actor.getSnapshot();

    // Assert
    expect(context.currentAgent).toBeNull();

    actor.stop();
  });

  it("초기 컨텍스트의 retryCount가 0이어야 한다", () => {
    // Arrange
    const actor = makeActor();
    actor.start();

    // Act
    const { context } = actor.getSnapshot();

    // Assert
    expect(context.retryCount).toBe(0);

    actor.stop();
  });
});

describe("IDLE → SPEC_ANALYSIS 전이", () => {
  it("USER_REQUEST 이벤트로 SPEC_ANALYSIS 상태로 전이되어야 한다", () => {
    // Arrange
    const actor = makeActor();
    actor.start();

    // Act
    actor.send({ type: "USER_REQUEST", input: "파일 생성해줘" });
    const snapshot = actor.getSnapshot();

    // Assert
    expect(snapshot.value).toBe(MACHINE_STATES.SPEC_ANALYSIS);

    actor.stop();
  });

  it("SPEC_ANALYSIS 진입 시 currentAgent가 spec-agent로 설정되어야 한다", () => {
    // Arrange
    const actor = makeActor();
    actor.start();

    // Act
    actor.send({ type: "USER_REQUEST", input: "테스트 요청" });
    const { context } = actor.getSnapshot();

    // Assert
    expect(context.currentAgent).toBe(AGENT_TYPES.SPEC_AGENT);

    actor.stop();
  });
});

describe("SPEC_ANALYSIS 전이", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function enterSpecAnalysis(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actor: any = makeActor();
    actor.start();
    actor.send({ type: "USER_REQUEST", input: "테스트 요청" });
    return actor;
  }

  it("SPEC_COMPLETE 이벤트로 POLICY_CHECK 상태로 전이되어야 한다", () => {
    // Arrange
    const actor = enterSpecAnalysis();

    // Act
    actor.send({
      type: "SPEC_COMPLETE",
      spec: {
        specId: "spec-001",
        rawInput: "테스트",
        interpretation: "테스트 해석",
        clarifications: [],
      },
    });
    const snapshot = actor.getSnapshot();

    // Assert
    expect(snapshot.value).toBe(MACHINE_STATES.POLICY_CHECK);

    actor.stop();
  });

  it("SPEC_COMPLETE 후 POLICY_CHECK 진입으로 currentAgent가 policy-risk로 설정되어야 한다", () => {
    // Arrange
    const actor = enterSpecAnalysis();

    // Act — clearAgent 전이 액션 후 POLICY_CHECK entry의 assignPolicyAgent가 실행됨
    actor.send({
      type: "SPEC_COMPLETE",
      spec: {
        specId: "spec-001",
        rawInput: "테스트",
        interpretation: "테스트 해석",
        clarifications: [],
      },
    });
    const { context } = actor.getSnapshot();

    // Assert — POLICY_CHECK 상태의 entry 액션이 적용된 상태
    expect(context.currentAgent).toBe(AGENT_TYPES.POLICY_RISK);

    actor.stop();
  });

  it("SPEC_NEED_CLARIFICATION 이벤트로 AWAITING_USER_INPUT 상태로 전이되어야 한다", () => {
    // Arrange
    const actor = enterSpecAnalysis();

    // Act
    actor.send({ type: "SPEC_NEED_CLARIFICATION", question: "어떤 파일인가요?" });
    const snapshot = actor.getSnapshot();

    // Assert
    expect(snapshot.value).toBe(MACHINE_STATES.AWAITING_USER_INPUT);

    actor.stop();
  });

  it("ERROR 이벤트로 ERROR_RECOVERY 상태로 전이되어야 한다", () => {
    // Arrange
    const actor = enterSpecAnalysis();

    // Act
    actor.send({
      type: "ERROR",
      error: {
        code: "INTERNAL_ERROR",
        message: "스펙 분석 실패",
        timestamp: new Date().toISOString(),
      },
    });
    const snapshot = actor.getSnapshot();

    // Assert
    expect(snapshot.value).toBe(MACHINE_STATES.ERROR_RECOVERY);

    actor.stop();
  });
});

describe("POLICY_CHECK 전이", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function enterPolicyCheck(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actor: any = makeActor();
    actor.start();
    actor.send({ type: "USER_REQUEST", input: "테스트" });
    actor.send({
      type: "SPEC_COMPLETE",
      spec: {
        specId: "spec-001",
        rawInput: "테스트",
        interpretation: "테스트",
        clarifications: [],
      },
    });
    return actor;
  }

  it("POLICY_CHECK 진입 시 currentAgent가 policy-risk로 설정되어야 한다", () => {
    // Arrange
    const actor = enterPolicyCheck();

    // Act
    const { context } = actor.getSnapshot();

    // Assert
    expect(context.currentAgent).toBe(AGENT_TYPES.POLICY_RISK);

    actor.stop();
  });

  it("ALLOW 이벤트로 PLANNING 상태로 전이되어야 한다", () => {
    // Arrange
    const actor = enterPolicyCheck();

    // Act
    actor.send({ type: "ALLOW", decision: makePolicyDecision("ALLOW") });
    const snapshot = actor.getSnapshot();

    // Assert
    expect(snapshot.value).toBe(MACHINE_STATES.PLANNING);

    actor.stop();
  });

  it("CONSTRAINED_ALLOW 이벤트로 PLANNING 상태로 전이되어야 한다", () => {
    // Arrange
    const actor = enterPolicyCheck();

    // Act
    actor.send({ type: "CONSTRAINED_ALLOW", decision: makePolicyDecision("CONSTRAINED_ALLOW") });
    const snapshot = actor.getSnapshot();

    // Assert
    expect(snapshot.value).toBe(MACHINE_STATES.PLANNING);

    actor.stop();
  });

  it("APPROVAL_REQUIRED 이벤트로 GATE_PLAN_APPROVAL 상태로 전이되어야 한다", () => {
    // Arrange
    const actor = enterPolicyCheck();

    // Act
    actor.send({ type: "APPROVAL_REQUIRED", decision: makePolicyDecision("APPROVAL_REQUIRED") });
    const snapshot = actor.getSnapshot();

    // Assert
    expect(snapshot.value).toBe(MACHINE_STATES.GATE_PLAN_APPROVAL);

    actor.stop();
  });

  it("DENY 이벤트로 DENIED 최종 상태로 전이되어야 한다", () => {
    // Arrange
    const actor = enterPolicyCheck();

    // Act
    actor.send({ type: "DENY", decision: makePolicyDecision("DENY") });
    const snapshot = actor.getSnapshot();

    // Assert
    expect(snapshot.value).toBe(MACHINE_STATES.DENIED);

    actor.stop();
  });
});

describe("GATE_PLAN_APPROVAL 전이", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function enterGatePlanApproval(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actor: any = makeActor();
    actor.start();
    actor.send({ type: "USER_REQUEST", input: "테스트" });
    actor.send({
      type: "SPEC_COMPLETE",
      spec: { specId: "s-001", rawInput: "테스트", interpretation: "테스트", clarifications: [] },
    });
    actor.send({ type: "APPROVAL_REQUIRED", decision: makePolicyDecision("APPROVAL_REQUIRED") });
    return actor;
  }

  it("APPROVED 이벤트로 PLANNING 상태로 전이되어야 한다", () => {
    // Arrange
    const actor = enterGatePlanApproval();

    // Act
    actor.send({
      type: "APPROVED",
      approval: {
        gateId: "gate-L1",
        gateLevel: "L1",
        approvedBy: "user-001",
        approvedAt: new Date().toISOString(),
        scopeModifications: [],
      },
    });
    const snapshot = actor.getSnapshot();

    // Assert
    expect(snapshot.value).toBe(MACHINE_STATES.PLANNING);

    actor.stop();
  });

  it("REJECTED 이벤트로 DENIED 상태로 전이되어야 한다", () => {
    // Arrange
    const actor = enterGatePlanApproval();

    // Act
    actor.send({ type: "REJECTED", reason: "사용자 거부" });
    const snapshot = actor.getSnapshot();

    // Assert
    expect(snapshot.value).toBe(MACHINE_STATES.DENIED);

    actor.stop();
  });

  it("TIMEOUT 이벤트로 DENIED 상태로 전이되어야 한다", () => {
    // Arrange
    const actor = enterGatePlanApproval();

    // Act
    actor.send({ type: "TIMEOUT" });
    const snapshot = actor.getSnapshot();

    // Assert
    expect(snapshot.value).toBe(MACHINE_STATES.DENIED);

    actor.stop();
  });

  it("SCOPE_MODIFIED 이벤트로 POLICY_CHECK 상태로 재전이되어야 한다", () => {
    // Arrange
    const actor = enterGatePlanApproval();

    // Act
    actor.send({ type: "SCOPE_MODIFIED", modifications: ["범위 축소"] });
    const snapshot = actor.getSnapshot();

    // Assert
    expect(snapshot.value).toBe(MACHINE_STATES.POLICY_CHECK);

    actor.stop();
  });
});

describe("PLANNING → CODE_GENERATION 전이", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function enterPlanning(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actor: any = makeActor();
    actor.start();
    actor.send({ type: "USER_REQUEST", input: "테스트" });
    actor.send({
      type: "SPEC_COMPLETE",
      spec: { specId: "s-001", rawInput: "테스트", interpretation: "테스트", clarifications: [] },
    });
    actor.send({ type: "ALLOW", decision: makePolicyDecision("ALLOW") });
    return actor;
  }

  it("PLANNING 진입 시 currentAgent가 planner로 설정되어야 한다", () => {
    // Arrange
    const actor = enterPlanning();

    // Act
    const { context } = actor.getSnapshot();

    // Assert
    expect(context.currentAgent).toBe(AGENT_TYPES.PLANNER);

    actor.stop();
  });

  it("PLAN_COMPLETE 이벤트로 CODE_GENERATION 상태로 전이되어야 한다", () => {
    // Arrange
    const actor = enterPlanning();

    // Act
    actor.send({
      type: "PLAN_COMPLETE",
      plan: { planId: "plan-001", steps: [], estimatedDurationMs: 1000 },
    });
    const snapshot = actor.getSnapshot();

    // Assert
    expect(snapshot.value).toBe(MACHINE_STATES.CODE_GENERATION);

    actor.stop();
  });

  it("PLAN_NEEDS_TOOLS 이벤트로 GATE_TOOL_APPROVAL 상태로 전이되어야 한다", () => {
    // Arrange
    const actor = enterPlanning();

    // Act
    actor.send({ type: "PLAN_NEEDS_TOOLS", tools: ["npm", "git"] });
    const snapshot = actor.getSnapshot();

    // Assert
    expect(snapshot.value).toBe(MACHINE_STATES.GATE_TOOL_APPROVAL);

    actor.stop();
  });

  it("NO_CODE_NEEDED 이벤트로 MOBILE_ACTION_EXECUTION 상태로 전이되어야 한다", () => {
    // Arrange
    const actor = enterPlanning();

    // Act
    actor.send({ type: "NO_CODE_NEEDED" });
    const snapshot = actor.getSnapshot();

    // Assert
    expect(snapshot.value).toBe(MACHINE_STATES.MOBILE_ACTION_EXECUTION);

    actor.stop();
  });
});

describe("ERROR_RECOVERY 전이", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function enterErrorRecovery(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actor: any = makeActor();
    actor.start();
    actor.send({ type: "USER_REQUEST", input: "테스트" });
    actor.send({
      type: "ERROR",
      error: { code: "INTERNAL_ERROR", message: "테스트 에러", timestamp: new Date().toISOString() },
    });
    return actor;
  }

  it("ERROR_RECOVERY 진입 시 currentAgent가 rollback으로 설정되어야 한다", () => {
    // Arrange
    const actor = enterErrorRecovery();

    // Act
    const { context } = actor.getSnapshot();

    // Assert
    expect(context.currentAgent).toBe(AGENT_TYPES.ROLLBACK);

    actor.stop();
  });

  it("RECOVERY_SUCCESS 이벤트로 COMPLETED 최종 상태로 전이되어야 한다", () => {
    // Arrange
    const actor = enterErrorRecovery();

    // Act
    actor.send({ type: "RECOVERY_SUCCESS" });
    const snapshot = actor.getSnapshot();

    // Assert
    expect(snapshot.value).toBe(MACHINE_STATES.COMPLETED);

    actor.stop();
  });

  it("RECOVERY_FAILED 이벤트로 EMERGENCY_STOP 최종 상태로 전이되어야 한다", () => {
    // Arrange
    const actor = enterErrorRecovery();

    // Act
    actor.send({
      type: "RECOVERY_FAILED",
      error: { code: "INTERNAL_ERROR", message: "복구 실패", timestamp: new Date().toISOString() },
    });
    const snapshot = actor.getSnapshot();

    // Assert
    expect(snapshot.value).toBe(MACHINE_STATES.EMERGENCY_STOP);

    actor.stop();
  });
});

describe("AWAITING_USER_INPUT 전이", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function enterAwaitingUserInput(): any {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const actor: any = makeActor();
    actor.start();
    actor.send({ type: "USER_REQUEST", input: "테스트" });
    actor.send({ type: "SPEC_NEED_CLARIFICATION", question: "어떤 파일인가요?" });
    return actor;
  }

  it("USER_RESPONSE 이벤트로 SPEC_ANALYSIS 상태로 전이되어야 한다", () => {
    // Arrange
    const actor = enterAwaitingUserInput();

    // Act
    actor.send({ type: "USER_RESPONSE", response: "TypeScript 파일이요" });
    const snapshot = actor.getSnapshot();

    // Assert
    expect(snapshot.value).toBe(MACHINE_STATES.SPEC_ANALYSIS);

    actor.stop();
  });

  it("CANCEL 이벤트로 DENIED 상태로 전이되어야 한다", () => {
    // Arrange
    const actor = enterAwaitingUserInput();

    // Act
    actor.send({ type: "CANCEL" });
    const snapshot = actor.getSnapshot();

    // Assert
    expect(snapshot.value).toBe(MACHINE_STATES.DENIED);

    actor.stop();
  });
});

describe("최종 상태 검증", () => {
  it("COMPLETED 상태는 최종 상태여야 한다", () => {
    // Arrange
    const actor = makeActor();
    actor.start();
    actor.send({ type: "USER_REQUEST", input: "테스트" });
    actor.send({
      type: "ERROR",
      error: { code: "INTERNAL_ERROR", message: "에러", timestamp: new Date().toISOString() },
    });
    actor.send({ type: "RECOVERY_SUCCESS" });

    // Act
    const snapshot = actor.getSnapshot();

    // Assert
    expect(snapshot.value).toBe(MACHINE_STATES.COMPLETED);
    expect(snapshot.status).toBe("done");

    actor.stop();
  });

  it("DENIED 상태는 최종 상태여야 한다", () => {
    // Arrange
    const actor = makeActor();
    actor.start();
    actor.send({ type: "USER_REQUEST", input: "테스트" });
    actor.send({
      type: "SPEC_COMPLETE",
      spec: { specId: "s-001", rawInput: "테스트", interpretation: "테스트", clarifications: [] },
    });
    actor.send({ type: "DENY", decision: makePolicyDecision("DENY") });

    // Act
    const snapshot = actor.getSnapshot();

    // Assert
    expect(snapshot.value).toBe(MACHINE_STATES.DENIED);
    expect(snapshot.status).toBe("done");

    actor.stop();
  });

  it("EMERGENCY_STOP 상태는 최종 상태여야 한다", () => {
    // Arrange
    const actor = makeActor();
    actor.start();
    actor.send({ type: "USER_REQUEST", input: "테스트" });
    actor.send({
      type: "ERROR",
      error: { code: "INTERNAL_ERROR", message: "에러", timestamp: new Date().toISOString() },
    });
    actor.send({
      type: "RECOVERY_FAILED",
      error: { code: "INTERNAL_ERROR", message: "복구 실패", timestamp: new Date().toISOString() },
    });

    // Act
    const snapshot = actor.getSnapshot();

    // Assert
    expect(snapshot.value).toBe(MACHINE_STATES.EMERGENCY_STOP);
    expect(snapshot.status).toBe("done");

    actor.stop();
  });
});
