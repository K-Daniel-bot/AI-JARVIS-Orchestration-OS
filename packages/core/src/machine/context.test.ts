// 머신 컨텍스트 생성 함수 단위 테스트
import { describe, it, expect, beforeEach } from "vitest";
import { createInitialContext } from "./context.js";
import { createEnvironmentBundle } from "../types/environment.js";
import type { JarvisMachineContext } from "./context.js";

describe("createInitialContext", () => {
  const RUN_ID = "run-test-001";
  const SESSION_ID = "session-test-001";

  // 각 테스트 전 고정된 환경 번들 생성
  let environment: ReturnType<typeof createEnvironmentBundle>;

  beforeEach(() => {
    environment = createEnvironmentBundle(RUN_ID, SESSION_ID);
  });

  it("runId와 sessionId를 올바르게 설정해야 한다", () => {
    // Arrange & Act
    const context = createInitialContext(RUN_ID, SESSION_ID, environment);

    // Assert
    expect(context.runId).toBe(RUN_ID);
    expect(context.sessionId).toBe(SESSION_ID);
  });

  it("currentAgent가 null로 초기화되어야 한다", () => {
    // Arrange & Act
    const context = createInitialContext(RUN_ID, SESSION_ID, environment);

    // Assert
    expect(context.currentAgent).toBeNull();
  });

  it("previousState가 null로 초기화되어야 한다", () => {
    // Arrange & Act
    const context = createInitialContext(RUN_ID, SESSION_ID, environment);

    // Assert
    expect(context.previousState).toBeNull();
  });

  it("policyDecision이 null로 초기화되어야 한다", () => {
    // Arrange & Act
    const context = createInitialContext(RUN_ID, SESSION_ID, environment);

    // Assert
    expect(context.policyDecision).toBeNull();
  });

  it("gateApprovals가 빈 배열로 초기화되어야 한다", () => {
    // Arrange & Act
    const context = createInitialContext(RUN_ID, SESSION_ID, environment);

    // Assert
    expect(context.gateApprovals).toEqual([]);
    expect(context.gateApprovals).toHaveLength(0);
  });

  it("errorHistory가 빈 배열로 초기화되어야 한다", () => {
    // Arrange & Act
    const context = createInitialContext(RUN_ID, SESSION_ID, environment);

    // Assert
    expect(context.errorHistory).toEqual([]);
    expect(context.errorHistory).toHaveLength(0);
  });

  it("retryCount가 0으로 초기화되어야 한다", () => {
    // Arrange & Act
    const context = createInitialContext(RUN_ID, SESSION_ID, environment);

    // Assert
    expect(context.retryCount).toBe(0);
  });

  it("startedAt이 유효한 ISO 문자열이어야 한다", () => {
    // Arrange
    const before = new Date().toISOString();

    // Act
    const context = createInitialContext(RUN_ID, SESSION_ID, environment);

    // Assert
    const after = new Date().toISOString();
    expect(context.startedAt >= before).toBe(true);
    expect(context.startedAt <= after).toBe(true);
  });

  it("lastTransitionAt이 startedAt과 동일한 값이어야 한다", () => {
    // Arrange & Act
    const context = createInitialContext(RUN_ID, SESSION_ID, environment);

    // Assert
    expect(context.lastTransitionAt).toBe(context.startedAt);
  });

  it("environment가 제공된 번들과 동일해야 한다", () => {
    // Arrange & Act
    const context = createInitialContext(RUN_ID, SESSION_ID, environment);

    // Assert
    expect(context.environment).toBe(environment);
  });

  it("서로 다른 runId로 생성된 컨텍스트는 독립적이어야 한다", () => {
    // Arrange
    const env1 = createEnvironmentBundle("run-001", SESSION_ID);
    const env2 = createEnvironmentBundle("run-002", SESSION_ID);

    // Act
    const ctx1 = createInitialContext("run-001", SESSION_ID, env1);
    const ctx2 = createInitialContext("run-002", SESSION_ID, env2);

    // Assert
    expect(ctx1.runId).not.toBe(ctx2.runId);
    expect(ctx1.environment).not.toBe(ctx2.environment);
  });

  it("반환된 컨텍스트가 JarvisMachineContext 구조를 만족해야 한다", () => {
    // Arrange & Act
    const context: JarvisMachineContext = createInitialContext(
      RUN_ID,
      SESSION_ID,
      environment,
    );

    // Assert — 필수 필드 존재 확인
    expect(typeof context.runId).toBe("string");
    expect(typeof context.sessionId).toBe("string");
    expect(typeof context.retryCount).toBe("number");
    expect(typeof context.startedAt).toBe("string");
    expect(typeof context.lastTransitionAt).toBe("string");
    expect(Array.isArray(context.gateApprovals)).toBe(true);
    expect(Array.isArray(context.errorHistory)).toBe(true);
  });
});
