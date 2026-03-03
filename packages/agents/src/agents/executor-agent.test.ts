// executor-agent.ts 통합 테스트 — Capability Token 검증, OS 액션 실행, 감사 로그 기록
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { CapabilityToken } from "@jarvis/shared";
import type {
  BaseAgentConfig,
  BaseAgentDependencies,
  AgentExecutionContext,
  AuditLogger,
  PolicyEvaluator,
} from "../types/agent-config.js";
import { ExecutorAgent } from "./executor-agent.js";

// claude-client 모킹 — 실제 API 호출 금지
vi.mock("../claude-client.js", () => ({
  callClaude: vi.fn(),
  parseJsonResponse: vi.fn(),
}));

import { callClaude, parseJsonResponse } from "../claude-client.js";

// ─── 테스트 픽스처 ────────────────────────────────────────────────────────────

// ExecutorAgent 전용 BaseAgentConfig
const EXECUTOR_AGENT_CONFIG: BaseAgentConfig = {
  agentId: "test-executor-agent",
  agentRole: "executor",
  model: "claude-sonnet-4-6",
  tools: ["Read", "Edit", "Write", "Bash"],
  disallowedTools: [],
  permissionMode: "auto",
  maxTurns: 10,
  timeoutMs: 60000,
};

// AgentExecutionContext 기본값
const BASE_CONTEXT: AgentExecutionContext = {
  runId: "run-exec-001",
  sessionId: "session-exec-001",
  userId: "user-exec-001",
  trustMode: "full-auto",
};

// 유효한 ACTIVE 상태 Capability Token
const ACTIVE_TOKEN: CapabilityToken = {
  tokenId: "token_test_001",
  status: "ACTIVE",
  grant: {
    scope: {
      paths: ["*"],
      commands: ["*"],
      capabilities: ["fs.write"],
    },
    ttlMs: 60_000,
  },
  issuedAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 60_000).toISOString(),
  usedBy: null,
  policyDecisionId: "pd_001",
};

// 소비된(비활성) Capability Token
const CONSUMED_TOKEN: CapabilityToken = {
  ...ACTIVE_TOKEN,
  tokenId: "token_test_002",
  status: "CONSUMED",
};

// EXPIRED 상태 Capability Token
const EXPIRED_TOKEN: CapabilityToken = {
  ...ACTIVE_TOKEN,
  tokenId: "token_test_003",
  status: "EXPIRED",
};

// 성공하는 AuditLogger 목
function buildAuditLogger(): AuditLogger {
  return {
    record: vi.fn().mockResolvedValue({
      ok: true,
      value: { auditId: "aud_exec_test_001" },
    }),
  };
}

// PolicyEvaluator 목 — ALLOW 판정
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

// 유효한 ExecutorInput 빌더
function buildExecutorInput(
  actionType: string = "fs.write",
  extra?: object,
): unknown {
  return {
    actionType,
    parameters: { path: "/tmp/test.txt", content: "테스트 내용" },
    capabilityTokenId: "token_test_001",
    context: BASE_CONTEXT,
    ...extra,
  };
}

// ─── Capability Token 누락 테스트 ─────────────────────────────────────────────

describe("ExecutorAgent.execute — Capability Token 누락", () => {
  let agent: ExecutorAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new ExecutorAgent(EXECUTOR_AGENT_CONFIG, buildStubDeps());
  });

  it("token=undefined: CAPABILITY_EXPIRED 에러 반환", async () => {
    // Arrange
    const input = buildExecutorInput("fs.write");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT, undefined);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CAPABILITY_EXPIRED");
    }
  });

  it("token=undefined: 에러 메시지에 Token 누락 내용 포함", async () => {
    // Arrange
    const input = buildExecutorInput("fs.read");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT, undefined);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("Capability Token");
    }
  });

  it("token=undefined: 거부 감사 로그 기록 확인", async () => {
    // Arrange
    const deps = buildStubDeps();
    const agentWithSpy = new ExecutorAgent(EXECUTOR_AGENT_CONFIG, deps);
    const input = buildExecutorInput("exec.run");

    // Act
    await agentWithSpy.execute(input, BASE_CONTEXT, undefined);

    // Assert — 거부 감사 로그가 기록되어야 함
    expect(deps.auditLogger.record).toHaveBeenCalledOnce();
    const callArg = (deps.auditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(callArg.result.status).toBe("DENIED");
  });
});

// ─── Capability Token 비활성 상태 테스트 ─────────────────────────────────────

describe("ExecutorAgent.execute — Capability Token 비활성", () => {
  let agent: ExecutorAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new ExecutorAgent(EXECUTOR_AGENT_CONFIG, buildStubDeps());
  });

  it("status=CONSUMED: CAPABILITY_CONSUMED 에러 반환", async () => {
    // Arrange
    const input = buildExecutorInput("fs.write");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT, CONSUMED_TOKEN);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CAPABILITY_CONSUMED");
    }
  });

  it("status=EXPIRED: CAPABILITY_CONSUMED 에러 반환", async () => {
    // Arrange — EXPIRED 상태도 ACTIVE가 아니므로 거부됨
    const input = buildExecutorInput("fs.read");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT, EXPIRED_TOKEN);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CAPABILITY_CONSUMED");
    }
  });

  it("status=CONSUMED: 에러 메시지에 상태값 포함", async () => {
    // Arrange
    const input = buildExecutorInput("app.launch");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT, CONSUMED_TOKEN);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("CONSUMED");
    }
  });

  it("status=CONSUMED: 거부 감사 로그 기록 확인", async () => {
    // Arrange
    const deps = buildStubDeps();
    const agentWithSpy = new ExecutorAgent(EXECUTOR_AGENT_CONFIG, deps);
    const input = buildExecutorInput("process.kill");

    // Act
    await agentWithSpy.execute(input, BASE_CONTEXT, CONSUMED_TOKEN);

    // Assert
    expect(deps.auditLogger.record).toHaveBeenCalledOnce();
    const callArg = (deps.auditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(callArg.result.status).toBe("DENIED");
  });
});

// ─── 스텁 모드 (claudeClient 없음) 실행 테스트 ───────────────────────────────

describe("ExecutorAgent.execute — 스텁 모드 (유효 토큰)", () => {
  let agent: ExecutorAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new ExecutorAgent(EXECUTOR_AGENT_CONFIG, buildStubDeps());
  });

  it("fs.write (ACTION_TYPE_MAP 존재): SUCCESS 반환", async () => {
    // Arrange
    const input = buildExecutorInput("fs.write");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT, ACTIVE_TOKEN);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("SUCCESS");
      expect(result.value.actionType).toBe("fs.write");
    }
  });

  it("fs.read (ACTION_TYPE_MAP 존재): SUCCESS 반환", async () => {
    // Arrange
    const input = buildExecutorInput("fs.read");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT, ACTIVE_TOKEN);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("SUCCESS");
    }
  });

  it("exec.run (ACTION_TYPE_MAP 존재): SUCCESS 반환", async () => {
    // Arrange
    const input = buildExecutorInput("exec.run", {
      parameters: { command: "echo hello" },
    });

    // Act
    const result = await agent.execute(input, BASE_CONTEXT, ACTIVE_TOKEN);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("SUCCESS");
    }
  });

  it("browser.navigate (ACTION_TYPE_MAP 존재): SUCCESS 반환", async () => {
    // Arrange
    const input = buildExecutorInput("browser.navigate", {
      parameters: { url: "https://example.com" },
    });

    // Act
    const result = await agent.execute(input, BASE_CONTEXT, ACTIVE_TOKEN);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("SUCCESS");
    }
  });

  it("실행 결과에 actionId, durationMs 포함", async () => {
    // Arrange
    const input = buildExecutorInput("app.launch");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT, ACTIVE_TOKEN);

    // Assert — 출력 구조 검증
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.actionId).toMatch(/^act_/);
      expect(typeof result.value.durationMs).toBe("number");
      expect(result.value.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("스텁 성공 시 감사 로그 COMPLETED 기록", async () => {
    // Arrange
    const deps = buildStubDeps();
    const agentWithSpy = new ExecutorAgent(EXECUTOR_AGENT_CONFIG, deps);
    const input = buildExecutorInput("fs.write");

    // Act
    await agentWithSpy.execute(input, BASE_CONTEXT, ACTIVE_TOKEN);

    // Assert
    expect(deps.auditLogger.record).toHaveBeenCalledOnce();
    const callArg = (deps.auditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(callArg.result.status).toBe("COMPLETED");
  });
});

// ─── Claude 모드 실행 테스트 ──────────────────────────────────────────────────

describe("ExecutorAgent.execute — Claude 모드 (유효 토큰)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("callClaude 성공: Claude 결과 반환", async () => {
    // Arrange — Claude가 성공적인 ExecutorOutput 반환
    const mockOutput = {
      actionId: "act_claude_001",
      actionType: "fs.write",
      status: "SUCCESS" as const,
      output: { written: true },
      durationMs: 120,
    };

    vi.mocked(callClaude).mockResolvedValue({
      ok: true,
      value: {
        content: JSON.stringify(mockOutput),
        model: "claude-sonnet-4-6",
        inputTokens: 100,
        outputTokens: 50,
        stopReason: "end_turn",
      },
    });

    vi.mocked(parseJsonResponse).mockReturnValue({
      ok: true,
      value: mockOutput,
    });

    const deps = buildClaudeDeps();
    const agent = new ExecutorAgent(EXECUTOR_AGENT_CONFIG, deps);
    const input = buildExecutorInput("fs.write");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT, ACTIVE_TOKEN);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.actionId).toBe("act_claude_001");
      expect(result.value.status).toBe("SUCCESS");
    }
    expect(callClaude).toHaveBeenCalledOnce();
  });

  it("callClaude 호출 시 token 스코프 정보가 메시지에 포함됨", async () => {
    // Arrange
    const mockOutput = {
      actionId: "act_scope_check",
      actionType: "fs.read",
      status: "SUCCESS" as const,
      output: {},
      durationMs: 50,
    };

    vi.mocked(callClaude).mockResolvedValue({
      ok: true,
      value: {
        content: JSON.stringify(mockOutput),
        model: "claude-sonnet-4-6",
        inputTokens: 80,
        outputTokens: 30,
        stopReason: "end_turn",
      },
    });
    vi.mocked(parseJsonResponse).mockReturnValue({ ok: true, value: mockOutput });

    const deps = buildClaudeDeps();
    const agent = new ExecutorAgent(EXECUTOR_AGENT_CONFIG, deps);
    const input = buildExecutorInput("fs.read");

    // Act
    await agent.execute(input, BASE_CONTEXT, ACTIVE_TOKEN);

    // Assert — callClaude에 전달된 옵션에 token 정보가 포함되어 있는지 확인
    const callArgs = (callClaude as ReturnType<typeof vi.fn>).mock.calls[0];
    const options = callArgs[1] as { userMessage: string };
    expect(options.userMessage).toContain("token_test_001");
  });

  it("Claude 성공 후 감사 로그 COMPLETED 기록", async () => {
    // Arrange
    const mockOutput = {
      actionId: "act_audit_test",
      actionType: "exec.run",
      status: "SUCCESS" as const,
      output: { exitCode: 0 },
      durationMs: 200,
    };

    vi.mocked(callClaude).mockResolvedValue({
      ok: true,
      value: {
        content: JSON.stringify(mockOutput),
        model: "claude-sonnet-4-6",
        inputTokens: 60,
        outputTokens: 40,
        stopReason: "end_turn",
      },
    });
    vi.mocked(parseJsonResponse).mockReturnValue({ ok: true, value: mockOutput });

    const deps = buildClaudeDeps();
    const agent = new ExecutorAgent(EXECUTOR_AGENT_CONFIG, deps);
    const input = buildExecutorInput("exec.run");

    // Act
    await agent.execute(input, BASE_CONTEXT, ACTIVE_TOKEN);

    // Assert
    expect(deps.auditLogger.record).toHaveBeenCalledOnce();
    const callArg = (deps.auditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(callArg.result.status).toBe("COMPLETED");
  });
});

// ─── Claude 실패 폴백 테스트 ──────────────────────────────────────────────────

describe("ExecutorAgent.execute — Claude 실패 시 스텁 폴백", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("callClaude 실패: 스텁 모드로 폴백 → ok 반환", async () => {
    // Arrange — callClaude 에러 발생
    vi.mocked(callClaude).mockResolvedValue({
      ok: false,
      error: {
        code: "UPSTREAM_FAILURE",
        message: "Claude API 연결 실패",
        timestamp: new Date().toISOString(),
      },
    });

    vi.mocked(parseJsonResponse).mockReturnValue({
      ok: false,
      error: {
        code: "UPSTREAM_FAILURE",
        message: "폴백 JSON 파싱 불필요",
        timestamp: new Date().toISOString(),
      },
    });

    const deps = buildClaudeDeps();
    const agent = new ExecutorAgent(EXECUTOR_AGENT_CONFIG, deps);
    const input = buildExecutorInput("fs.write");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT, ACTIVE_TOKEN);

    // Assert — Claude 실패해도 스텁 폴백으로 성공 반환
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("SUCCESS");
      expect(result.value.actionType).toBe("fs.write");
    }
  });

  it("parseJsonResponse 실패: 스텁 폴백으로 ok 반환", async () => {
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
    const agent = new ExecutorAgent(EXECUTOR_AGENT_CONFIG, deps);
    const input = buildExecutorInput("browser.navigate");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT, ACTIVE_TOKEN);

    // Assert — 스텁 폴백으로 성공
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("SUCCESS");
    }
  });
});

// ─── 입력 검증 실패 테스트 ────────────────────────────────────────────────────

describe("ExecutorAgent.execute — 입력 검증 실패", () => {
  let agent: ExecutorAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new ExecutorAgent(EXECUTOR_AGENT_CONFIG, buildStubDeps());
  });

  it("actionType 누락: VALIDATION_FAILED 반환", async () => {
    // Arrange — actionType 없는 입력
    const input = {
      parameters: { path: "/tmp/test.txt" },
      capabilityTokenId: "token_test_001",
      context: BASE_CONTEXT,
    };

    // Act
    const result = await agent.execute(input, BASE_CONTEXT, ACTIVE_TOKEN);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("유효하지 않은 actionType 값: VALIDATION_FAILED 반환", async () => {
    // Arrange — 스키마에 없는 actionType
    const input = {
      actionType: "invalid.action.type",
      parameters: {},
      capabilityTokenId: "token_test_001",
      context: BASE_CONTEXT,
    };

    // Act
    const result = await agent.execute(input, BASE_CONTEXT, ACTIVE_TOKEN);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("capabilityTokenId 누락: VALIDATION_FAILED 반환", async () => {
    // Arrange — capabilityTokenId 없는 입력
    const input = {
      actionType: "fs.read",
      parameters: { path: "/tmp/test.txt" },
      context: BASE_CONTEXT,
    };

    // Act
    const result = await agent.execute(input, BASE_CONTEXT, ACTIVE_TOKEN);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("null 입력: VALIDATION_FAILED 반환", async () => {
    // Act
    const result = await agent.execute(null, BASE_CONTEXT, ACTIVE_TOKEN);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("parameters가 배열인 경우: VALIDATION_FAILED 반환", async () => {
    // Arrange — parameters는 Record<string, unknown>이어야 함
    const input = {
      actionType: "fs.write",
      parameters: ["배열은", "허용되지", "않음"],
      capabilityTokenId: "token_test_001",
      context: BASE_CONTEXT,
    };

    // Act
    const result = await agent.execute(input, BASE_CONTEXT, ACTIVE_TOKEN);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("입력 검증 실패 시 감사 로그 미기록 (조기 반환)", async () => {
    // Arrange — 입력 오류는 감사 기록 전에 반환
    const deps = buildStubDeps();
    const agentWithSpy = new ExecutorAgent(EXECUTOR_AGENT_CONFIG, deps);
    const input = { actionType: "unknown.type" };

    // Act
    await agentWithSpy.execute(input, BASE_CONTEXT, ACTIVE_TOKEN);

    // Assert — 입력 검증 실패는 감사 로그를 남기지 않음
    expect(deps.auditLogger.record).not.toHaveBeenCalled();
  });
});

// ─── 감사 로그 상세 기록 테스트 ──────────────────────────────────────────────

describe("ExecutorAgent.execute — 감사 로그 상세 기록", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("성공 실행: 감사 로그에 tokenId 포함됨", async () => {
    // Arrange
    const deps = buildStubDeps();
    const agent = new ExecutorAgent(EXECUTOR_AGENT_CONFIG, deps);
    const input = buildExecutorInput("fs.write");

    // Act
    await agent.execute(input, BASE_CONTEXT, ACTIVE_TOKEN);

    // Assert — 감사 로그의 aiInterpretation에 token 정보 포함
    const callArg = (deps.auditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(callArg.what.aiInterpretation).toContain("token_test_001");
  });

  it("성공 실행: 감사 로그에 actionType 포함됨", async () => {
    // Arrange
    const deps = buildStubDeps();
    const agent = new ExecutorAgent(EXECUTOR_AGENT_CONFIG, deps);
    const input = buildExecutorInput("exec.run");

    // Act
    await agent.execute(input, BASE_CONTEXT, ACTIVE_TOKEN);

    // Assert
    const callArg = (deps.auditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(callArg.what.rawInput).toContain("exec.run");
  });

  it("토큰 누락 거부: 감사 로그 who.userId 일치", async () => {
    // Arrange
    const deps = buildStubDeps();
    const agent = new ExecutorAgent(EXECUTOR_AGENT_CONFIG, deps);
    const input = buildExecutorInput("fs.read");

    // Act
    await agent.execute(input, BASE_CONTEXT, undefined);

    // Assert — 감사 로그의 who.userId가 컨텍스트와 일치
    const callArg = (deps.auditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(callArg.who.userId).toBe("user-exec-001");
    expect(callArg.who.sessionId).toBe("session-exec-001");
  });

  it("실행 성공: 감사 로그 execution.runId 일치", async () => {
    // Arrange
    const deps = buildStubDeps();
    const agent = new ExecutorAgent(EXECUTOR_AGENT_CONFIG, deps);
    const input = buildExecutorInput("app.launch");

    // Act
    await agent.execute(input, BASE_CONTEXT, ACTIVE_TOKEN);

    // Assert
    const callArg = (deps.auditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(callArg.execution.runId).toBe("run-exec-001");
  });
});

// ─── ACTION_TYPE_MAP 매핑 검증 테스트 ────────────────────────────────────────

describe("ExecutorAgent — ACTION_TYPE_MAP 매핑 검증", () => {
  let agent: ExecutorAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new ExecutorAgent(EXECUTOR_AGENT_CONFIG, buildStubDeps());
  });

  it("network.access: SUCCESS 반환 (BROWSER_OPEN_URL 매핑)", async () => {
    // Arrange
    const input = buildExecutorInput("network.access", {
      parameters: { url: "https://api.example.com" },
    });

    // Act
    const result = await agent.execute(input, BASE_CONTEXT, ACTIVE_TOKEN);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("SUCCESS");
    }
  });

  it("clipboard.read: SUCCESS 반환 (FS_READ 매핑)", async () => {
    // Arrange
    const input = buildExecutorInput("clipboard.read", {
      parameters: {},
    });

    // Act
    const result = await agent.execute(input, BASE_CONTEXT, ACTIVE_TOKEN);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("SUCCESS");
    }
  });

  it("clipboard.write: SUCCESS 반환 (FS_WRITE 매핑)", async () => {
    // Arrange
    const input = buildExecutorInput("clipboard.write", {
      parameters: { content: "클립보드 내용" },
    });

    // Act
    const result = await agent.execute(input, BASE_CONTEXT, ACTIVE_TOKEN);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("SUCCESS");
    }
  });

  it("process.kill: SUCCESS 반환 (PROCESS_KILL 매핑)", async () => {
    // Arrange
    const input = buildExecutorInput("process.kill", {
      parameters: { pid: 1234 },
    });

    // Act
    const result = await agent.execute(input, BASE_CONTEXT, ACTIVE_TOKEN);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.status).toBe("SUCCESS");
    }
  });
});
