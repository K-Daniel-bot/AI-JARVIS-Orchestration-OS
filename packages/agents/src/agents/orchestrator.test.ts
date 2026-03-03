// orchestrator.ts 단위 테스트 — 흐름 제어, 복잡도 분류, 파이프라인 조율
import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  BaseAgentConfig,
  BaseAgentDependencies,
  AgentExecutionContext,
  AuditLogger,
  PolicyEvaluator,
} from "../types/agent-config.js";
import { OrchestratorAgent } from "./orchestrator.js";

// claude-client 모킹 — 실제 API 호출 금지
vi.mock("../claude-client.js", () => ({
  callClaude: vi.fn(),
  parseJsonResponse: vi.fn(),
}));

import { callClaude, parseJsonResponse } from "../claude-client.js";

// ─── 테스트 픽스처 ────────────────────────────────────────────────────────────

// OrchestratorAgent 전용 BaseAgentConfig
const ORCHESTRATOR_AGENT_CONFIG: BaseAgentConfig = {
  agentId: "test-orchestrator-agent",
  agentRole: "orchestrator",
  model: "claude-opus-4-6",
  tools: ["Read", "Grep", "Glob", "Agent"],
  disallowedTools: ["Edit", "Write", "Bash"],
  permissionMode: "observe",
  maxTurns: 10,
  timeoutMs: 60000,
};

// AgentExecutionContext 기본값
const BASE_CONTEXT: AgentExecutionContext = {
  runId: "run-orch-001",
  sessionId: "session-orch-001",
  userId: "user-orch-001",
  trustMode: "observe",
};

// 성공하는 AuditLogger 목
function buildAuditLogger(): AuditLogger {
  return {
    record: vi.fn().mockResolvedValue({
      ok: true,
      value: { auditId: "aud_orch_test_001" },
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

// 유효한 OrchestratorInput 빌더
function buildOrchestratorInput(rawInput: string): unknown {
  return {
    rawInput,
    context: BASE_CONTEXT,
  };
}

// ─── execute: 스텁 모드 (claudeClient 없음) ───────────────────────────────────

describe("OrchestratorAgent.execute (스텁 모드)", () => {
  let agent: OrchestratorAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new OrchestratorAgent(ORCHESTRATOR_AGENT_CONFIG, buildStubDeps());
  });

  it("유효 입력: OrchestratorOutput 반환 (스텁 모드)", async () => {
    // Arrange
    const input = buildOrchestratorInput("TypeScript 함수를 구현해줘");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const output = result.value as {
        complexity: string;
        recommendedPipeline: string[];
        specRef: string;
        runId: string;
      };
      expect(output.complexity).toBeDefined();
      expect(Array.isArray(output.recommendedPipeline)).toBe(true);
      expect(output.recommendedPipeline.length).toBeGreaterThan(0);
      expect(typeof output.specRef).toBe("string");
      expect(typeof output.runId).toBe("string");
    }
  });

  it("잘못된 입력 (rawInput 누락): VALIDATION_FAILED 반환", async () => {
    // Arrange — rawInput 없는 입력
    const input = { context: BASE_CONTEXT };

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("잘못된 입력 (빈 문자열): VALIDATION_FAILED 반환", async () => {
    // Arrange — rawInput이 최소 길이(1) 위반
    const input = buildOrchestratorInput("");

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
    const agentWithSpy = new OrchestratorAgent(ORCHESTRATOR_AGENT_CONFIG, deps);
    const input = buildOrchestratorInput("파일 읽어줘");

    // Act
    await agentWithSpy.execute(input, BASE_CONTEXT);

    // Assert — AuditLogger.record가 호출되었는지 확인
    expect(deps.auditLogger.record).toHaveBeenCalledOnce();
  });

  it("specRef에 runId가 포함되어 있음", async () => {
    // Arrange
    const input = buildOrchestratorInput("코드 작성해줘");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const output = result.value as { specRef: string; runId: string };
      expect(output.specRef).toContain(output.runId);
    }
  });

  it("recommendedPipeline에 spec-agent와 policy-risk가 포함됨", async () => {
    // Arrange — 파이프라인에는 항상 기본 에이전트가 포함
    const input = buildOrchestratorInput("간단한 요청");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const pipeline = (result.value as { recommendedPipeline: string[] }).recommendedPipeline;
      expect(pipeline).toContain("spec-agent");
      expect(pipeline).toContain("policy-risk");
      expect(pipeline).toContain("planner");
    }
  });
});

// ─── 복잡도 분류 테스트 (classifyComplexity) ─────────────────────────────────

describe("OrchestratorAgent 복잡도 분류 (classifyComplexity)", () => {
  let agent: OrchestratorAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new OrchestratorAgent(ORCHESTRATOR_AGENT_CONFIG, buildStubDeps());
  });

  it('"deploy" 키워드: complex 반환', async () => {
    // Arrange
    const input = buildOrchestratorInput("서비스를 deploy 해줘");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { complexity: string }).complexity).toBe("complex");
    }
  });

  it('"architecture" 키워드: complex 반환', async () => {
    // Arrange
    const input = buildOrchestratorInput("architecture 설계를 해줘");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { complexity: string }).complexity).toBe("complex");
    }
  });

  it('"refactor" 키워드: complex 반환', async () => {
    // Arrange
    const input = buildOrchestratorInput("전체 코드베이스를 refactor 해줘");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { complexity: string }).complexity).toBe("complex");
    }
  });

  it('"implement" 키워드: moderate 반환', async () => {
    // Arrange
    const input = buildOrchestratorInput("기능을 implement 해줘");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { complexity: string }).complexity).toBe("moderate");
    }
  });

  it('"create" 키워드: moderate 반환', async () => {
    // Arrange
    const input = buildOrchestratorInput("새 모듈을 create 해줘");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { complexity: string }).complexity).toBe("moderate");
    }
  });

  it("짧은 요청 (100자 미만, 특수 키워드 없음): simple 반환", async () => {
    // Arrange — 짧은 일반 요청
    const input = buildOrchestratorInput("파일 읽어줘");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { complexity: string }).complexity).toBe("simple");
    }
  });

  it("500자 초과 입력: complex 반환", async () => {
    // Arrange — 500자 초과 텍스트
    const longInput = "일반 내용 ".repeat(100); // 500자 초과
    const input = buildOrchestratorInput(longInput);

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { complexity: string }).complexity).toBe("complex");
    }
  });

  it("complex 복잡도: rollback 에이전트 포함된 파이프라인", async () => {
    // Arrange — complex 파이프라인에는 rollback이 포함
    const input = buildOrchestratorInput("전체 system을 migration 해줘");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const output = result.value as { complexity: string; recommendedPipeline: string[] };
      expect(output.complexity).toBe("complex");
      expect(output.recommendedPipeline).toContain("rollback");
    }
  });
});

// ─── execute: Claude 모드 테스트 ─────────────────────────────────────────────

describe("OrchestratorAgent.execute (Claude 모드)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Claude 모드: 스텁 폴백으로 OrchestratorOutput 반환 (Orchestrator는 Phase 0 스텁 전용)", async () => {
    // Arrange — Orchestrator는 Claude API 호출 없이 스텁만 사용 (Phase 0)
    const deps = buildClaudeDeps();
    const agent = new OrchestratorAgent(ORCHESTRATOR_AGENT_CONFIG, deps);
    const input = buildOrchestratorInput("코드 생성해줘");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert — Claude 모드라도 Orchestrator는 스텁 폴백 반환
    expect(result.ok).toBe(true);
    if (result.ok) {
      const output = result.value as { complexity: string; recommendedPipeline: string[]; runId: string };
      expect(output.complexity).toBeDefined();
      expect(typeof output.runId).toBe("string");
    }
    // Orchestrator는 Phase 0에서 callClaude를 호출하지 않음
    expect(callClaude).not.toHaveBeenCalled();
  });

  it("Claude 모드에서 감사 로그 COMPLETED 기록", async () => {
    // Arrange
    const deps = buildClaudeDeps();
    const agent = new OrchestratorAgent(ORCHESTRATOR_AGENT_CONFIG, deps);
    const input = buildOrchestratorInput("코드 구현");

    // Act
    await agent.execute(input, BASE_CONTEXT);

    // Assert — AuditLogger.record 호출 확인
    expect(deps.auditLogger.record).toHaveBeenCalledOnce();
    const auditCall = (deps.auditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(auditCall.result.status).toBe("COMPLETED");
  });

  it("감사 로그에 복잡도 정보 포함됨", async () => {
    // Arrange
    const deps = buildStubDeps();
    const agent = new OrchestratorAgent(ORCHESTRATOR_AGENT_CONFIG, deps);
    const input = buildOrchestratorInput("단순 요청");

    // Act
    await agent.execute(input, BASE_CONTEXT);

    // Assert — 감사 로그 rawInput에 복잡도 정보 포함
    const auditCall = (deps.auditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(auditCall.what.rawInput).toContain("복잡도");
  });

  it("감사 로그 execution.runId 컨텍스트와 일치", async () => {
    // Arrange
    const deps = buildStubDeps();
    const agent = new OrchestratorAgent(ORCHESTRATOR_AGENT_CONFIG, deps);
    const input = buildOrchestratorInput("파이프라인 실행");

    // Act
    await agent.execute(input, BASE_CONTEXT);

    // Assert
    const auditCall = (deps.auditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(auditCall.execution.runId).toBe("run-orch-001");
  });

  it("parseJsonResponse는 Orchestrator에서 호출되지 않음", async () => {
    // Arrange — Orchestrator는 Claude API 미호출 (Phase 0 스텁)
    const deps = buildClaudeDeps();
    const agent = new OrchestratorAgent(ORCHESTRATOR_AGENT_CONFIG, deps);
    const input = buildOrchestratorInput("테스트 요청");

    // Act
    await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(parseJsonResponse).not.toHaveBeenCalled();
  });
});

// ─── 감사 로그 실패 내성 테스트 ──────────────────────────────────────────────

describe("OrchestratorAgent — 감사 로그 실패 내성", () => {
  it("감사 로그 실패해도 execute() 결과는 ok 반환", async () => {
    // Arrange — AuditLogger가 실패 반환
    const failAuditLogger: AuditLogger = {
      record: vi.fn().mockResolvedValue({
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "DB 연결 실패",
          timestamp: new Date().toISOString(),
        },
      }),
    };
    const deps: BaseAgentDependencies = {
      auditLogger: failAuditLogger,
      policyEngine: buildPolicyEvaluator(),
    };
    const agent = new OrchestratorAgent(ORCHESTRATOR_AGENT_CONFIG, deps);
    const input = buildOrchestratorInput("로그 실패 테스트");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert — 감사 로그 실패해도 에이전트 결과는 반환
    expect(result.ok).toBe(true);
  });
});
