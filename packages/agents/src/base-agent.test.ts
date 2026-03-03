// base-agent.ts 단위 테스트 — validateInput, validateOutput, logAudit, hasToolPermission, callClaudeWithJson
import { describe, it, expect, vi, beforeEach } from "vitest";
import { z } from "zod";
import type { Result, JarvisError, CapabilityToken } from "@jarvis/shared";
import type {
  BaseAgentConfig,
  AgentExecutionContext,
  AuditLogger,
  PolicyEvaluator,
} from "./types/agent-config.js";
import { BaseAgent } from "./base-agent.js";

// claude-client 모킹 — 실제 API 호출 금지
vi.mock("./claude-client.js", () => ({
  callClaude: vi.fn(),
  parseJsonResponse: vi.fn(),
}));

import { callClaude, parseJsonResponse } from "./claude-client.js";

// ─── 테스트용 ConcreteTestAgent 구현 ─────────────────────────────────────────

// abstract BaseAgent를 상속한 테스트용 구체 클래스
class ConcreteTestAgent extends BaseAgent {
  // 외부에서 protected 메서드를 호출하기 위한 공개 래퍼 메서드들

  publicValidateInput<T>(input: unknown, schema: z.ZodType<T>): Result<T, JarvisError> {
    return this.validateInput(input, schema);
  }

  publicValidateOutput<T>(output: unknown, schema: z.ZodType<T>): Result<T, JarvisError> {
    return this.validateOutput(output, schema);
  }

  publicLogAudit(
    context: AgentExecutionContext,
    summary: string,
    status: "COMPLETED" | "FAILED" | "ROLLED_BACK" | "ABORTED" | "DENIED",
    details?: Record<string, unknown>,
  ): Promise<Result<void, JarvisError>> {
    return this.logAudit(context, summary, status, details);
  }

  publicHasToolPermission(tool: Parameters<typeof this.hasToolPermission>[0]): boolean {
    return this.hasToolPermission(tool);
  }

  publicCallClaudeWithJson<T>(
    systemPrompt: string,
    userMessage: string,
    schema: z.ZodType<T>,
  ): Promise<Result<T, JarvisError>> {
    return this.callClaudeWithJson(systemPrompt, userMessage, schema);
  }

  // abstract execute 구현 (테스트에서 직접 사용하지 않음)
  override async execute(
    _input: unknown,
    _context: AgentExecutionContext,
    _capabilityToken?: CapabilityToken,
  ): Promise<Result<unknown, JarvisError>> {
    return { ok: true, value: {} };
  }
}

// ─── 테스트 픽스처 ────────────────────────────────────────────────────────────

// BaseAgentConfig 기본값
function buildConfig(overrides?: Partial<BaseAgentConfig>): BaseAgentConfig {
  return {
    agentId: "test-agent-001",
    agentRole: "spec",
    model: "claude-haiku-4-5-20251001",
    tools: ["Read", "Grep", "Glob"],
    disallowedTools: ["Edit", "Write", "Bash"],
    permissionMode: "observe",
    maxTurns: 5,
    timeoutMs: 30000,
    ...overrides,
  };
}

// AgentExecutionContext 기본값
function buildContext(_overrides?: Partial<AgentExecutionContext>): AgentExecutionContext {
  return {
    runId: "run-test-001",
    sessionId: "session-test-001",
    userId: "user-test-001",
    trustMode: "observe",
    ..._overrides,
  };
}

// AuditLogger 목 — record 성공
function buildAuditLogger(): AuditLogger {
  return {
    record: vi.fn().mockResolvedValue({
      ok: true,
      value: { auditId: "aud_test_12345" } as unknown,
    }),
  };
}

// AuditLogger 목 — record 실패
function buildFailingAuditLogger(): AuditLogger {
  return {
    record: vi.fn().mockResolvedValue({
      ok: false,
      error: {
        code: "INTERNAL_ERROR",
        message: "감사 로그 DB 오류",
        timestamp: new Date().toISOString(),
      },
    }),
  };
}

// PolicyEvaluator 목
function buildPolicyEvaluator(): PolicyEvaluator {
  return {
    evaluate: vi.fn().mockReturnValue({ ok: true, value: {} }),
  };
}

// 테스트용 Zod 스키마
const PersonSchema = z.object({
  name: z.string(),
  age: z.number().positive(),
});

// ─── validateInput 테스트 ─────────────────────────────────────────────────────

describe("BaseAgent.validateInput", () => {
  let agent: ConcreteTestAgent;

  beforeEach(() => {
    agent = new ConcreteTestAgent(
      buildConfig(),
      {
        auditLogger: buildAuditLogger(),
        policyEngine: buildPolicyEvaluator(),
      },
    );
  });

  it("유효 입력: 스키마 통과 → ok + 파싱된 값 반환", () => {
    // Arrange
    const input = { name: "홍길동", age: 30 };

    // Act
    const result = agent.publicValidateInput(input, PersonSchema);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("홍길동");
      expect(result.value.age).toBe(30);
    }
  });

  it("잘못된 입력 (필수 필드 누락): VALIDATION_FAILED 반환", () => {
    // Arrange — age 필드 없음
    const input = { name: "홍길동" };

    // Act
    const result = agent.publicValidateInput(input, PersonSchema);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
      expect(result.error.message).toContain("입력 검증 실패");
      expect(result.error.agentId).toBe("test-agent-001");
    }
  });

  it("잘못된 입력 (타입 불일치): VALIDATION_FAILED 반환", () => {
    // Arrange — age가 음수
    const input = { name: "홍길동", age: -5 };

    // Act
    const result = agent.publicValidateInput(input, PersonSchema);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("null 입력: VALIDATION_FAILED 반환", () => {
    // Arrange
    const input = null;

    // Act
    const result = agent.publicValidateInput(input, PersonSchema);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
    }
  });
});

// ─── validateOutput 테스트 ────────────────────────────────────────────────────

describe("BaseAgent.validateOutput", () => {
  let agent: ConcreteTestAgent;

  beforeEach(() => {
    agent = new ConcreteTestAgent(
      buildConfig(),
      {
        auditLogger: buildAuditLogger(),
        policyEngine: buildPolicyEvaluator(),
      },
    );
  });

  it("유효 출력: 스키마 통과 → ok 반환", () => {
    // Arrange
    const output = { name: "김철수", age: 25 };

    // Act
    const result = agent.publicValidateOutput(output, PersonSchema);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("김철수");
    }
  });

  it("잘못된 출력 (string이 number여야): VALIDATION_FAILED 반환", () => {
    // Arrange
    const output = { name: "김철수", age: "스물다섯" };

    // Act
    const result = agent.publicValidateOutput(output, PersonSchema);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
      expect(result.error.message).toContain("출력 검증 실패");
    }
  });
});

// ─── logAudit 테스트 ──────────────────────────────────────────────────────────

describe("BaseAgent.logAudit", () => {
  it("성공 감사 기록: auditLogger.record 호출 + ok 반환", async () => {
    // Arrange
    const mockAuditLogger = buildAuditLogger();
    const agent = new ConcreteTestAgent(
      buildConfig(),
      {
        auditLogger: mockAuditLogger,
        policyEngine: buildPolicyEvaluator(),
      },
    );
    const context = buildContext();

    // Act
    const result = await agent.publicLogAudit(context, "테스트 요약", "COMPLETED", {
      intent: "CODE_IMPLEMENTATION",
    });

    // Assert
    expect(result.ok).toBe(true);
    expect(mockAuditLogger.record).toHaveBeenCalledOnce();

    // record 호출 인자 검증
    const callArg = (mockAuditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(callArg).toBeDefined();
    expect(callArg.result.status).toBe("COMPLETED");
    expect(callArg.who.userId).toBe("user-test-001");
    expect(callArg.who.sessionId).toBe("session-test-001");
    expect(callArg.execution.runId).toBe("run-test-001");
  });

  it("auditLogger 실패: err 전파", async () => {
    // Arrange
    const failingLogger = buildFailingAuditLogger();
    const agent = new ConcreteTestAgent(
      buildConfig(),
      {
        auditLogger: failingLogger,
        policyEngine: buildPolicyEvaluator(),
      },
    );
    const context = buildContext();

    // Act
    const result = await agent.publicLogAudit(context, "실패 케이스", "FAILED");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toContain("감사 로그 DB 오류");
    }
  });

  it("details 없을 때: 감사 항목 정상 생성", async () => {
    // Arrange
    const mockAuditLogger = buildAuditLogger();
    const agent = new ConcreteTestAgent(
      buildConfig(),
      {
        auditLogger: mockAuditLogger,
        policyEngine: buildPolicyEvaluator(),
      },
    );
    const context = buildContext();

    // Act
    const result = await agent.publicLogAudit(context, "details 없음", "COMPLETED");

    // Assert
    expect(result.ok).toBe(true);
    const callArg = (mockAuditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    // details가 없으면 aiInterpretation이 단순 문자열
    expect(callArg.what.aiInterpretation).not.toContain("{");
  });
});

// ─── hasToolPermission 테스트 ─────────────────────────────────────────────────

describe("BaseAgent.hasToolPermission", () => {
  let agent: ConcreteTestAgent;

  beforeEach(() => {
    agent = new ConcreteTestAgent(
      buildConfig({
        tools: ["Read", "Grep", "Glob"],
        disallowedTools: ["Edit", "Write", "Bash"],
      }),
      {
        auditLogger: buildAuditLogger(),
        policyEngine: buildPolicyEvaluator(),
      },
    );
  });

  it("tools에 있는 도구 (Read): true 반환", () => {
    // Act
    const result = agent.publicHasToolPermission("Read");

    // Assert
    expect(result).toBe(true);
  });

  it("tools에 있는 도구 (Glob): true 반환", () => {
    expect(agent.publicHasToolPermission("Glob")).toBe(true);
  });

  it("tools에 없는 도구 (Agent): false 반환", () => {
    // Act
    const result = agent.publicHasToolPermission("Agent");

    // Assert
    expect(result).toBe(false);
  });

  it("disallowedTools에 있는 도구 (Edit): false 반환", () => {
    // Act — Edit은 tools에는 없고, disallowedTools에만 있음
    const result = agent.publicHasToolPermission("Edit");

    // Assert
    expect(result).toBe(false);
  });

  it("disallowedTools와 tools 모두에 등재된 경우: false 반환 (금지 우선)", () => {
    // Arrange — Write가 tools에도 있고 disallowedTools에도 있는 설정
    const agentWithConflict = new ConcreteTestAgent(
      buildConfig({
        tools: ["Read", "Write"],
        disallowedTools: ["Write"],
      }),
      {
        auditLogger: buildAuditLogger(),
        policyEngine: buildPolicyEvaluator(),
      },
    );

    // Act
    const result = agentWithConflict.publicHasToolPermission("Write");

    // Assert — disallowedTools 우선
    expect(result).toBe(false);
  });
});

// ─── callClaudeWithJson 테스트 ────────────────────────────────────────────────

describe("BaseAgent.callClaudeWithJson", () => {
  const TestSchema = z.object({
    answer: z.string(),
    confidence: z.number(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("claudeClient 미주입: INTERNAL_ERROR 반환", async () => {
    // Arrange — claudeClient 없는 deps
    const agent = new ConcreteTestAgent(
      buildConfig(),
      {
        auditLogger: buildAuditLogger(),
        policyEngine: buildPolicyEvaluator(),
        // claudeClient 미주입
      },
    );

    // Act
    const result = await agent.publicCallClaudeWithJson(
      "시스템 프롬프트",
      "사용자 메시지",
      TestSchema,
    );

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toContain("claudeClient");
    }
  });

  it("callClaude 실패: 에러 전파", async () => {
    // Arrange — callClaude 실패 목
    vi.mocked(callClaude).mockResolvedValue({
      ok: false,
      error: {
        code: "UPSTREAM_FAILURE",
        message: "Claude API 호출 실패",
        timestamp: new Date().toISOString(),
      },
    });

    const mockClient = {} as Parameters<typeof callClaude>[0];
    const agent = new ConcreteTestAgent(
      buildConfig(),
      {
        auditLogger: buildAuditLogger(),
        policyEngine: buildPolicyEvaluator(),
        claudeClient: mockClient as never,
      },
    );

    // Act
    const result = await agent.publicCallClaudeWithJson(
      "시스템 프롬프트",
      "사용자 메시지",
      TestSchema,
    );

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UPSTREAM_FAILURE");
    }
  });

  it("callClaude 성공 + parseJsonResponse 성공: 파싱된 값 반환", async () => {
    // Arrange — callClaude 성공, parseJsonResponse 성공
    vi.mocked(callClaude).mockResolvedValue({
      ok: true,
      value: {
        content: '{"answer": "테스트 답변", "confidence": 0.95}',
        model: "claude-haiku-4-5-20251001",
        inputTokens: 10,
        outputTokens: 20,
        stopReason: "end_turn",
      },
    });

    vi.mocked(parseJsonResponse).mockReturnValue({
      ok: true,
      value: { answer: "테스트 답변", confidence: 0.95 },
    });

    const mockClient = {} as Parameters<typeof callClaude>[0];
    const agent = new ConcreteTestAgent(
      buildConfig(),
      {
        auditLogger: buildAuditLogger(),
        policyEngine: buildPolicyEvaluator(),
        claudeClient: mockClient as never,
      },
    );

    // Act
    const result = await agent.publicCallClaudeWithJson(
      "시스템 프롬프트",
      "사용자 메시지",
      TestSchema,
    );

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.answer).toBe("테스트 답변");
      expect(result.value.confidence).toBe(0.95);
    }
  });

  it("callClaude 성공 + parseJsonResponse 실패: VALIDATION_FAILED 전파", async () => {
    // Arrange
    vi.mocked(callClaude).mockResolvedValue({
      ok: true,
      value: {
        content: "잘못된 JSON",
        model: "claude-haiku-4-5-20251001",
        inputTokens: 5,
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

    const mockClient = {} as Parameters<typeof callClaude>[0];
    const agent = new ConcreteTestAgent(
      buildConfig(),
      {
        auditLogger: buildAuditLogger(),
        policyEngine: buildPolicyEvaluator(),
        claudeClient: mockClient as never,
      },
    );

    // Act
    const result = await agent.publicCallClaudeWithJson(
      "시스템 프롬프트",
      "사용자 메시지",
      TestSchema,
    );

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
    }
  });
});

// ─── getConfig 테스트 ─────────────────────────────────────────────────────────

describe("BaseAgent.getConfig", () => {
  it("설정한 config를 그대로 반환", () => {
    // Arrange
    const config = buildConfig({ agentId: "unique-agent-999" });
    const agent = new ConcreteTestAgent(
      config,
      {
        auditLogger: buildAuditLogger(),
        policyEngine: buildPolicyEvaluator(),
      },
    );

    // Act
    const returned = agent.getConfig();

    // Assert
    expect(returned).toBe(config);
    expect(returned.agentId).toBe("unique-agent-999");
  });
});
