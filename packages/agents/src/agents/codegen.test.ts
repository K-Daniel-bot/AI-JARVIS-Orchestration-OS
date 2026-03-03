// codegen.ts 단위 테스트 — 코드 생성, ChangeSet 생성, 보안 자가 검사
import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  BaseAgentConfig,
  BaseAgentDependencies,
  AgentExecutionContext,
  AuditLogger,
  PolicyEvaluator,
} from "../types/agent-config.js";
import { CodegenAgent } from "./codegen.js";

// claude-client 모킹 — 실제 API 호출 금지
vi.mock("../claude-client.js", () => ({
  callClaude: vi.fn(),
  parseJsonResponse: vi.fn(),
}));

import { callClaude, parseJsonResponse } from "../claude-client.js";

// ─── 테스트 픽스처 ────────────────────────────────────────────────────────────

// CodegenAgent 전용 BaseAgentConfig
const CODEGEN_AGENT_CONFIG: BaseAgentConfig = {
  agentId: "test-codegen-agent",
  agentRole: "codegen",
  model: "claude-sonnet-4-6",
  tools: ["Read", "Grep", "Glob", "Edit", "Write"],
  disallowedTools: ["Bash"],
  permissionMode: "semi-auto",
  maxTurns: 10,
  timeoutMs: 60000,
};

// AgentExecutionContext 기본값
const BASE_CONTEXT: AgentExecutionContext = {
  runId: "run-codegen-001",
  sessionId: "session-codegen-001",
  userId: "user-codegen-001",
  trustMode: "semi-auto",
};

// 성공하는 AuditLogger 목
function buildAuditLogger(): AuditLogger {
  return {
    record: vi.fn().mockResolvedValue({
      ok: true,
      value: { auditId: "aud_codegen_test_001" },
    }),
  };
}

// PolicyEvaluator 목
function buildPolicyEvaluator(): PolicyEvaluator {
  return {
    evaluate: vi.fn().mockReturnValue({ ok: true, value: {} }),
  };
}

// claudeClient 없는 deps (스텁 모드)
function buildStubDeps(): BaseAgentDependencies {
  return {
    auditLogger: buildAuditLogger(),
    policyEngine: buildPolicyEvaluator(),
  };
}

// claudeClient 있는 deps (Claude 모드)
function buildClaudeDeps(): BaseAgentDependencies {
  return {
    auditLogger: buildAuditLogger(),
    policyEngine: buildPolicyEvaluator(),
    claudeClient: {} as NonNullable<BaseAgentDependencies["claudeClient"]>,
  };
}

// 유효한 CodegenInput 빌더
function buildCodegenInput(extra?: object): unknown {
  return {
    planStep: {
      stepId: "s1",
      description: "TypeScript 유틸 함수 생성",
      outputs: ["src/utils/helper.ts"],
    },
    specOutput: {
      specId: "spec_test_001",
      interpretation: "유틸 함수를 구현해달라는 요청",
      intent: "CODE_IMPLEMENTATION" as const,
      targets: ["src/utils/helper.ts"],
      requiresWebAccess: false,
      requiresLogin: false,
      clarifications: [],
      ambiguities: [],
    },
    context: BASE_CONTEXT,
    ...extra,
  };
}

// ─── execute: 스텁 모드 (claudeClient 없음) ───────────────────────────────────

describe("CodegenAgent.execute (스텁 모드)", () => {
  let agent: CodegenAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new CodegenAgent(CODEGEN_AGENT_CONFIG, buildStubDeps());
  });

  it("유효 입력: CodegenOutput 반환 (스텁 모드)", async () => {
    // Arrange
    const input = buildCodegenInput();

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const output = result.value as {
        changeSetId: string;
        planRef: string;
        stepRef: string;
        filesAdded: unknown[];
        filesModified: unknown[];
        securitySelfCheck: {
          secretsFound: boolean;
          injectionRisk: boolean;
          pathTraversalRisk: boolean;
        };
      };
      expect(output.changeSetId).toMatch(/^cs_/);
      expect(Array.isArray(output.filesAdded)).toBe(true);
      expect(Array.isArray(output.filesModified)).toBe(true);
      expect(typeof output.securitySelfCheck.secretsFound).toBe("boolean");
      expect(typeof output.securitySelfCheck.injectionRisk).toBe("boolean");
      expect(typeof output.securitySelfCheck.pathTraversalRisk).toBe("boolean");
    }
  });

  it("스텁 모드: securitySelfCheck 모두 false (안전한 기본값)", async () => {
    // Arrange
    const input = buildCodegenInput();

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const check = (result.value as {
        securitySelfCheck: { secretsFound: boolean; injectionRisk: boolean; pathTraversalRisk: boolean };
      }).securitySelfCheck;
      expect(check.secretsFound).toBe(false);
      expect(check.injectionRisk).toBe(false);
      expect(check.pathTraversalRisk).toBe(false);
    }
  });

  it("스텁 모드: stepRef에 planStep.stepId 반영됨", async () => {
    // Arrange
    const input = buildCodegenInput();

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { stepRef: string }).stepRef).toBe("s1");
    }
  });

  it("스텁 모드: planRef에 runId가 포함됨", async () => {
    // Arrange
    const input = buildCodegenInput();

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { planRef: string }).planRef).toContain("run-codegen-001");
    }
  });

  it("잘못된 입력 (planStep 누락): VALIDATION_FAILED 반환", async () => {
    // Arrange — planStep 없는 입력
    const input = {
      specOutput: {
        specId: "spec_test_001",
        interpretation: "테스트",
        intent: "CODE_IMPLEMENTATION",
        targets: ["general"],
        requiresWebAccess: false,
        requiresLogin: false,
        clarifications: [],
        ambiguities: [],
      },
      context: BASE_CONTEXT,
    };

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("잘못된 입력 (specOutput 누락): VALIDATION_FAILED 반환", async () => {
    // Arrange — specOutput 없는 입력
    const input = {
      planStep: {
        stepId: "s1",
        description: "코드 생성",
        outputs: ["src/test.ts"],
      },
      context: BASE_CONTEXT,
    };

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("null 입력: VALIDATION_FAILED 반환", async () => {
    // Act
    const result = await agent.execute(null, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("스텁 모드에서 감사 로그 기록 실행", async () => {
    // Arrange
    const deps = buildStubDeps();
    const agentWithSpy = new CodegenAgent(CODEGEN_AGENT_CONFIG, deps);
    const input = buildCodegenInput();

    // Act
    await agentWithSpy.execute(input, BASE_CONTEXT);

    // Assert — AuditLogger.record가 호출되었는지 확인
    expect(deps.auditLogger.record).toHaveBeenCalledOnce();
  });

  it("감사 로그 결과 상태 COMPLETED", async () => {
    // Arrange
    const deps = buildStubDeps();
    const agentWithSpy = new CodegenAgent(CODEGEN_AGENT_CONFIG, deps);
    const input = buildCodegenInput();

    // Act
    await agentWithSpy.execute(input, BASE_CONTEXT);

    // Assert — 감사 로그의 result.status가 COMPLETED
    const auditCall = (deps.auditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(auditCall.result.status).toBe("COMPLETED");
  });

  it("existingCode 포함 입력: 정상 처리", async () => {
    // Arrange
    const input = buildCodegenInput({
      existingCode: {
        "src/utils/helper.ts": "export function oldHelper() { return 'old'; }",
      },
    });

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
  });
});

// ─── execute: Claude 모드 테스트 ─────────────────────────────────────────────

describe("CodegenAgent.execute (Claude 모드)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Claude 모드: callClaude 호출 + ChangeSet 반환", async () => {
    // Arrange — callClaude 성공, parseJsonResponse 성공
    const mockCodegenOutput = {
      changeSetId: "cs_abcd1234",
      planRef: "plan_ref_run-codegen-001",
      stepRef: "s1",
      filesAdded: [
        { path: "src/utils/helper.ts", content: "export function helper() {}" },
      ],
      filesModified: [],
      securitySelfCheck: {
        secretsFound: false,
        injectionRisk: false,
        pathTraversalRisk: false,
      },
    };

    vi.mocked(callClaude).mockResolvedValue({
      ok: true,
      value: {
        content: JSON.stringify(mockCodegenOutput),
        model: "claude-sonnet-4-6",
        inputTokens: 100,
        outputTokens: 200,
        stopReason: "end_turn",
      },
    });

    vi.mocked(parseJsonResponse).mockReturnValue({
      ok: true,
      value: mockCodegenOutput,
    });

    const deps = buildClaudeDeps();
    const agent = new CodegenAgent(CODEGEN_AGENT_CONFIG, deps);
    const input = buildCodegenInput();

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const output = result.value as typeof mockCodegenOutput;
      expect(output.changeSetId).toBe("cs_abcd1234");
      expect(output.filesAdded).toHaveLength(1);
      expect(output.filesAdded[0].path).toBe("src/utils/helper.ts");
    }
    // callClaude가 호출되었는지 확인
    expect(callClaude).toHaveBeenCalledOnce();
  });

  it("Claude 실패 시: 스텁 폴백으로 정상 응답", async () => {
    // Arrange — callClaude 실패
    vi.mocked(callClaude).mockResolvedValue({
      ok: false,
      error: {
        code: "UPSTREAM_FAILURE",
        message: "Claude 연결 실패",
        timestamp: new Date().toISOString(),
      },
    });

    vi.mocked(parseJsonResponse).mockReturnValue({
      ok: false,
      error: {
        code: "UPSTREAM_FAILURE",
        message: "Claude 연결 실패",
        timestamp: new Date().toISOString(),
      },
    });

    const deps = buildClaudeDeps();
    const agent = new CodegenAgent(CODEGEN_AGENT_CONFIG, deps);
    const input = buildCodegenInput();

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert — Claude 실패해도 스텁 폴백으로 성공 반환
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { changeSetId: string }).changeSetId).toMatch(/^cs_/);
    }
  });

  it("parseJsonResponse 실패 시: 스텁 폴백으로 정상 응답", async () => {
    // Arrange — callClaude 성공이나 parseJsonResponse 실패
    vi.mocked(callClaude).mockResolvedValue({
      ok: true,
      value: {
        content: "잘못된 JSON",
        model: "claude-sonnet-4-6",
        inputTokens: 10,
        outputTokens: 5,
        stopReason: "end_turn",
      },
    });

    vi.mocked(parseJsonResponse).mockReturnValue({
      ok: false,
      error: {
        code: "VALIDATION_FAILED",
        message: "JSON 파싱 실패",
        timestamp: new Date().toISOString(),
      },
    });

    const deps = buildClaudeDeps();
    const agent = new CodegenAgent(CODEGEN_AGENT_CONFIG, deps);
    const input = buildCodegenInput();

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert — 스텁 폴백으로 성공
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { changeSetId: string }).changeSetId).toMatch(/^cs_/);
    }
  });

  it("Claude 모드 실행 후 감사 로그 COMPLETED 기록", async () => {
    // Arrange
    const mockOutput = {
      changeSetId: "cs_audit_test",
      planRef: "plan_ref_test",
      stepRef: "s1",
      filesAdded: [],
      filesModified: [],
      securitySelfCheck: {
        secretsFound: false,
        injectionRisk: false,
        pathTraversalRisk: false,
      },
    };

    vi.mocked(callClaude).mockResolvedValue({
      ok: true,
      value: {
        content: JSON.stringify(mockOutput),
        model: "claude-sonnet-4-6",
        inputTokens: 50,
        outputTokens: 80,
        stopReason: "end_turn",
      },
    });
    vi.mocked(parseJsonResponse).mockReturnValue({ ok: true, value: mockOutput });

    const deps = buildClaudeDeps();
    const agent = new CodegenAgent(CODEGEN_AGENT_CONFIG, deps);
    const input = buildCodegenInput();

    // Act
    await agent.execute(input, BASE_CONTEXT);

    // Assert — AuditLogger.record 호출 확인
    expect(deps.auditLogger.record).toHaveBeenCalledOnce();
    const auditCall = (deps.auditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(auditCall.result.status).toBe("COMPLETED");
  });

  it("Claude 모드: userMessage에 planStep.description 포함", async () => {
    // Arrange
    vi.mocked(callClaude).mockResolvedValue({
      ok: true,
      value: {
        content: "{}",
        model: "claude-sonnet-4-6",
        inputTokens: 30,
        outputTokens: 50,
        stopReason: "end_turn",
      },
    });

    const fallbackOutput = {
      changeSetId: "cs_msg_test",
      planRef: "plan_ref_test",
      stepRef: "s1",
      filesAdded: [],
      filesModified: [],
      securitySelfCheck: { secretsFound: false, injectionRisk: false, pathTraversalRisk: false },
    };
    vi.mocked(parseJsonResponse).mockReturnValue({ ok: true, value: fallbackOutput });

    const deps = buildClaudeDeps();
    const agent = new CodegenAgent(CODEGEN_AGENT_CONFIG, deps);
    const input = buildCodegenInput();

    // Act
    await agent.execute(input, BASE_CONTEXT);

    // Assert — callClaude에 전달된 옵션에 단계 설명 포함
    const callArgs = (callClaude as ReturnType<typeof vi.fn>).mock.calls[0];
    const options = callArgs[1] as { userMessage: string };
    expect(options.userMessage).toContain("TypeScript 유틸 함수 생성");
  });
});

// ─── 감사 로그 상세 기록 테스트 ──────────────────────────────────────────────

describe("CodegenAgent — 감사 로그 상세 기록", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("감사 로그에 changeSetId 포함됨", async () => {
    // Arrange
    const deps = buildStubDeps();
    const agent = new CodegenAgent(CODEGEN_AGENT_CONFIG, deps);
    const input = buildCodegenInput();

    // Act
    await agent.execute(input, BASE_CONTEXT);

    // Assert
    const auditCall = (deps.auditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(auditCall.what.aiInterpretation).toContain("changeSetId");
  });

  it("감사 로그 who.userId 컨텍스트와 일치", async () => {
    // Arrange
    const deps = buildStubDeps();
    const agent = new CodegenAgent(CODEGEN_AGENT_CONFIG, deps);
    const input = buildCodegenInput();

    // Act
    await agent.execute(input, BASE_CONTEXT);

    // Assert
    const auditCall = (deps.auditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(auditCall.who.userId).toBe("user-codegen-001");
    expect(auditCall.who.sessionId).toBe("session-codegen-001");
  });

  it("감사 로그 execution.runId 컨텍스트와 일치", async () => {
    // Arrange
    const deps = buildStubDeps();
    const agent = new CodegenAgent(CODEGEN_AGENT_CONFIG, deps);
    const input = buildCodegenInput();

    // Act
    await agent.execute(input, BASE_CONTEXT);

    // Assert
    const auditCall = (deps.auditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(auditCall.execution.runId).toBe("run-codegen-001");
  });

  it("감사 로그에 stepId 포함됨", async () => {
    // Arrange
    const deps = buildStubDeps();
    const agent = new CodegenAgent(CODEGEN_AGENT_CONFIG, deps);
    const input = buildCodegenInput();

    // Act
    await agent.execute(input, BASE_CONTEXT);

    // Assert — 감사 로그의 aiInterpretation에 stepId 포함
    const auditCall = (deps.auditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(auditCall.what.aiInterpretation).toContain("stepId");
  });
});
