// 상태 전이 액션 함수 단위 테스트
import { describe, it, expect } from "vitest";
import {
  assignAgent,
  recordPreviousState,
  recordError,
  resetRetryCount,
  addGateApproval,
  updateEnvironment,
  clearAgent,
} from "./actions.js";
import { createInitialContext } from "./context.js";
import { createEnvironmentBundle } from "../types/environment.js";
import { AGENT_TYPES, MACHINE_STATES, ERROR_CODES, createError } from "@jarvis/shared";
import type { JarvisMachineContext, GateApproval } from "./context.js";

// 테스트용 기본 컨텍스트 생성 헬퍼
function makeContext(overrides?: Partial<JarvisMachineContext>): JarvisMachineContext {
  const env = createEnvironmentBundle("run-001", "session-001");
  const base = createInitialContext("run-001", "session-001", env);
  return { ...base, ...overrides } as JarvisMachineContext;
}

// 테스트용 게이트 승인 픽스처
function makeGateApproval(gateLevel: "L1" | "L2" | "L3" = "L1"): GateApproval {
  return {
    gateId: `gate-${gateLevel}`,
    gateLevel,
    approvedBy: "user-test",
    approvedAt: new Date().toISOString(),
    scopeModifications: [],
  };
}

describe("assignAgent", () => {
  it("currentAgent를 지정된 에이전트로 교체해야 한다", () => {
    // Arrange
    const context = makeContext();

    // Act
    const result = assignAgent(context, AGENT_TYPES.SPEC_AGENT);

    // Assert
    expect(result.currentAgent).toBe(AGENT_TYPES.SPEC_AGENT);
  });

  it("lastTransitionAt이 갱신되어야 한다", () => {
    // Arrange
    const context = makeContext();
    const before = new Date().toISOString();

    // Act
    const result = assignAgent(context, AGENT_TYPES.PLANNER);

    // Assert
    const after = new Date().toISOString();
    expect(result.lastTransitionAt >= before).toBe(true);
    expect(result.lastTransitionAt <= after).toBe(true);
  });

  it("원본 컨텍스트를 변경하지 않아야 한다 (불변성)", () => {
    // Arrange
    const context = makeContext();
    const originalAgent = context.currentAgent;

    // Act
    assignAgent(context, AGENT_TYPES.EXECUTOR);

    // Assert
    expect(context.currentAgent).toBe(originalAgent);
  });

  it("다른 필드는 그대로 유지되어야 한다", () => {
    // Arrange
    const context = makeContext({ retryCount: 2 });

    // Act
    const result = assignAgent(context, AGENT_TYPES.CODEGEN);

    // Assert
    expect(result.runId).toBe(context.runId);
    expect(result.sessionId).toBe(context.sessionId);
    expect(result.retryCount).toBe(2);
  });

  it("모든 에이전트 타입을 할당할 수 있어야 한다", () => {
    // Arrange
    const context = makeContext();
    const agentTypes = Object.values(AGENT_TYPES);

    for (const agentType of agentTypes) {
      // Act
      const result = assignAgent(context, agentType);

      // Assert
      expect(result.currentAgent).toBe(agentType);
    }
  });
});

describe("recordPreviousState", () => {
  it("previousState를 지정된 상태로 설정해야 한다", () => {
    // Arrange
    const context = makeContext();

    // Act
    const result = recordPreviousState(context, MACHINE_STATES.SPEC_ANALYSIS);

    // Assert
    expect(result.previousState).toBe(MACHINE_STATES.SPEC_ANALYSIS);
  });

  it("lastTransitionAt이 갱신되어야 한다", () => {
    // Arrange
    const context = makeContext();
    const before = new Date().toISOString();

    // Act
    const result = recordPreviousState(context, MACHINE_STATES.POLICY_CHECK);

    // Assert
    const after = new Date().toISOString();
    expect(result.lastTransitionAt >= before).toBe(true);
    expect(result.lastTransitionAt <= after).toBe(true);
  });

  it("원본 컨텍스트를 변경하지 않아야 한다 (불변성)", () => {
    // Arrange
    const context = makeContext();

    // Act
    recordPreviousState(context, MACHINE_STATES.PLANNING);

    // Assert
    expect(context.previousState).toBeNull();
  });
});

describe("recordError", () => {
  it("errorHistory에 에러를 추가해야 한다", () => {
    // Arrange
    const context = makeContext();
    const error = createError(ERROR_CODES.INTERNAL_ERROR, "테스트 에러");

    // Act
    const result = recordError(context, error);

    // Assert
    expect(result.errorHistory).toHaveLength(1);
    expect(result.errorHistory[0]).toBe(error);
  });

  it("retryCount를 1 증가시켜야 한다", () => {
    // Arrange
    const context = makeContext({ retryCount: 1 });
    const error = createError(ERROR_CODES.AGENT_TIMEOUT, "타임아웃");

    // Act
    const result = recordError(context, error);

    // Assert
    expect(result.retryCount).toBe(2);
  });

  it("여러 에러를 누적해야 한다", () => {
    // Arrange
    const context = makeContext();
    const error1 = createError(ERROR_CODES.INTERNAL_ERROR, "에러 1");
    const error2 = createError(ERROR_CODES.AGENT_TIMEOUT, "에러 2");

    // Act
    const ctx1 = recordError(context, error1);
    const ctx2 = recordError(ctx1, error2);

    // Assert
    expect(ctx2.errorHistory).toHaveLength(2);
    expect(ctx2.retryCount).toBe(2);
  });

  it("원본 errorHistory를 변경하지 않아야 한다 (불변성)", () => {
    // Arrange
    const context = makeContext();
    const error = createError(ERROR_CODES.VALIDATION_FAILED, "검증 실패");

    // Act
    recordError(context, error);

    // Assert
    expect(context.errorHistory).toHaveLength(0);
  });

  it("lastTransitionAt이 갱신되어야 한다", () => {
    // Arrange
    const context = makeContext();
    const before = new Date().toISOString();
    const error = createError(ERROR_CODES.RESOURCE_EXHAUSTED, "리소스 초과");

    // Act
    const result = recordError(context, error);

    // Assert
    const after = new Date().toISOString();
    expect(result.lastTransitionAt >= before).toBe(true);
    expect(result.lastTransitionAt <= after).toBe(true);
  });
});

describe("resetRetryCount", () => {
  it("retryCount를 0으로 초기화해야 한다", () => {
    // Arrange
    const context = makeContext({ retryCount: 3 });

    // Act
    const result = resetRetryCount(context);

    // Assert
    expect(result.retryCount).toBe(0);
  });

  it("이미 0인 경우에도 정상 동작해야 한다", () => {
    // Arrange
    const context = makeContext({ retryCount: 0 });

    // Act
    const result = resetRetryCount(context);

    // Assert
    expect(result.retryCount).toBe(0);
  });

  it("lastTransitionAt이 갱신되어야 한다", () => {
    // Arrange
    const context = makeContext({ retryCount: 2 });
    const before = new Date().toISOString();

    // Act
    const result = resetRetryCount(context);

    // Assert
    const after = new Date().toISOString();
    expect(result.lastTransitionAt >= before).toBe(true);
    expect(result.lastTransitionAt <= after).toBe(true);
  });

  it("다른 필드는 그대로 유지되어야 한다", () => {
    // Arrange
    const context = makeContext({ retryCount: 5 });

    // Act
    const result = resetRetryCount(context);

    // Assert
    expect(result.runId).toBe(context.runId);
    expect(result.sessionId).toBe(context.sessionId);
    expect(result.currentAgent).toBe(context.currentAgent);
    expect(result.errorHistory).toBe(context.errorHistory);
  });
});

describe("addGateApproval", () => {
  it("gateApprovals에 승인 항목을 추가해야 한다", () => {
    // Arrange
    const context = makeContext();
    const approval = makeGateApproval("L1");

    // Act
    const result = addGateApproval(context, approval);

    // Assert
    expect(result.gateApprovals).toHaveLength(1);
    expect(result.gateApprovals[0]).toBe(approval);
  });

  it("여러 게이트 승인을 누적해야 한다", () => {
    // Arrange
    const context = makeContext();
    const approvalL1 = makeGateApproval("L1");
    const approvalL2 = makeGateApproval("L2");
    const approvalL3 = makeGateApproval("L3");

    // Act
    const ctx1 = addGateApproval(context, approvalL1);
    const ctx2 = addGateApproval(ctx1, approvalL2);
    const ctx3 = addGateApproval(ctx2, approvalL3);

    // Assert
    expect(ctx3.gateApprovals).toHaveLength(3);
  });

  it("원본 gateApprovals를 변경하지 않아야 한다 (불변성)", () => {
    // Arrange
    const context = makeContext();
    const approval = makeGateApproval("L2");

    // Act
    addGateApproval(context, approval);

    // Assert
    expect(context.gateApprovals).toHaveLength(0);
  });

  it("lastTransitionAt이 갱신되어야 한다", () => {
    // Arrange
    const context = makeContext();
    const approval = makeGateApproval("L3");
    const before = new Date().toISOString();

    // Act
    const result = addGateApproval(context, approval);

    // Assert
    const after = new Date().toISOString();
    expect(result.lastTransitionAt >= before).toBe(true);
    expect(result.lastTransitionAt <= after).toBe(true);
  });
});

describe("updateEnvironment", () => {
  it("환경 번들의 일부 필드를 패치할 수 있어야 한다", () => {
    // Arrange
    const context = makeContext();
    const specRef = {
      specId: "spec-001",
      rawInput: "파일을 생성해줘",
      interpretation: "파일 생성 요청",
      clarifications: [],
    };

    // Act
    const result = updateEnvironment(context, { spec: specRef });

    // Assert
    expect(result.environment.spec).toBe(specRef);
  });

  it("패치하지 않은 환경 필드는 유지되어야 한다", () => {
    // Arrange
    const context = makeContext();
    const originalRunId = context.environment.runId;

    // Act
    const result = updateEnvironment(context, { metadata: { key: "value" } });

    // Assert
    expect(result.environment.runId).toBe(originalRunId);
    expect(result.environment.spec).toBeNull();
  });

  it("원본 environment를 변경하지 않아야 한다 (불변성)", () => {
    // Arrange
    const context = makeContext();

    // Act
    updateEnvironment(context, { metadata: { updated: true } });

    // Assert
    expect(context.environment.metadata).toEqual({});
  });

  it("lastTransitionAt이 갱신되어야 한다", () => {
    // Arrange
    const context = makeContext();
    const before = new Date().toISOString();

    // Act
    const result = updateEnvironment(context, {});

    // Assert
    const after = new Date().toISOString();
    expect(result.lastTransitionAt >= before).toBe(true);
    expect(result.lastTransitionAt <= after).toBe(true);
  });
});

describe("clearAgent", () => {
  it("currentAgent를 null로 설정해야 한다", () => {
    // Arrange
    const context = makeContext({ currentAgent: AGENT_TYPES.EXECUTOR });

    // Act
    const result = clearAgent(context);

    // Assert
    expect(result.currentAgent).toBeNull();
  });

  it("이미 null인 경우에도 정상 동작해야 한다", () => {
    // Arrange
    const context = makeContext({ currentAgent: null });

    // Act
    const result = clearAgent(context);

    // Assert
    expect(result.currentAgent).toBeNull();
  });

  it("lastTransitionAt이 갱신되어야 한다", () => {
    // Arrange
    const context = makeContext({ currentAgent: AGENT_TYPES.REVIEW });
    const before = new Date().toISOString();

    // Act
    const result = clearAgent(context);

    // Assert
    const after = new Date().toISOString();
    expect(result.lastTransitionAt >= before).toBe(true);
    expect(result.lastTransitionAt <= after).toBe(true);
  });

  it("다른 필드는 그대로 유지되어야 한다", () => {
    // Arrange
    const context = makeContext({
      currentAgent: AGENT_TYPES.PLANNER,
      retryCount: 1,
    });

    // Act
    const result = clearAgent(context);

    // Assert
    expect(result.runId).toBe(context.runId);
    expect(result.retryCount).toBe(1);
    expect(result.gateApprovals).toBe(context.gateApprovals);
  });
});
