// spec-agent.ts 단위 테스트 — 의도 분석, 스텁 폴백, Claude 호출 경로
import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  BaseAgentConfig,
  BaseAgentDependencies,
  AgentExecutionContext,
  AuditLogger,
  PolicyEvaluator,
} from "../types/agent-config.js";
import { SpecAgent } from "./spec-agent.js";

// claude-client 모킹 — 실제 API 호출 금지
vi.mock("../claude-client.js", () => ({
  callClaude: vi.fn(),
  parseJsonResponse: vi.fn(),
}));

import { callClaude, parseJsonResponse } from "../claude-client.js";

// ─── 테스트 픽스처 ────────────────────────────────────────────────────────────

// SpecAgent 전용 BaseAgentConfig
const SPEC_AGENT_CONFIG: BaseAgentConfig = {
  agentId: "test-spec-agent",
  agentRole: "spec",
  model: "claude-haiku-4-5-20251001",
  tools: ["Read", "Grep", "Glob"],
  disallowedTools: ["Edit", "Write", "Bash"],
  permissionMode: "observe",
  maxTurns: 5,
  timeoutMs: 30000,
};

// AgentExecutionContext 기본값
const BASE_CONTEXT: AgentExecutionContext = {
  runId: "run-spec-001",
  sessionId: "session-spec-001",
  userId: "user-spec-001",
  trustMode: "observe",
};

// 성공하는 AuditLogger 목
function buildAuditLogger(): AuditLogger {
  return {
    record: vi.fn().mockResolvedValue({
      ok: true,
      value: { auditId: "aud_spec_test_001" },
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

// 유효한 SpecInput 빌더
function buildSpecInput(rawInput: string, extra?: object): unknown {
  return {
    rawInput,
    context: BASE_CONTEXT,
    ...extra,
  };
}

// ─── execute: 스텁 모드 (claudeClient 없음) ───────────────────────────────────

describe("SpecAgent.execute (스텁 모드)", () => {
  let agent: SpecAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new SpecAgent(SPEC_AGENT_CONFIG, buildStubDeps());
  });

  it("유효 입력: SpecOutput 반환 (스텁 모드)", async () => {
    // Arrange
    const input = buildSpecInput("TypeScript 함수를 구현해줘");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const output = result.value as {
        specId: string;
        interpretation: string;
        intent: string;
        targets: string[];
        requiresWebAccess: boolean;
        requiresLogin: boolean;
        clarifications: string[];
        ambiguities: string[];
      };
      expect(output.specId).toMatch(/^spec_/);
      expect(output.intent).toBeDefined();
      expect(Array.isArray(output.targets)).toBe(true);
      expect(typeof output.requiresWebAccess).toBe("boolean");
      expect(typeof output.requiresLogin).toBe("boolean");
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
    const input = buildSpecInput("");

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

  it("clarificationHistory 포함 입력: 정상 처리", async () => {
    // Arrange
    const input = buildSpecInput("npm 패키지 설치해줘", {
      clarificationHistory: ["어떤 패키지인가요?", "lodash 입니다"],
    });

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
  });

  it("스텁 모드에서 감사 로그 기록 실행", async () => {
    // Arrange
    const deps = buildStubDeps();
    const agentWithSpy = new SpecAgent(SPEC_AGENT_CONFIG, deps);
    const input = buildSpecInput("파일 읽어줘");

    // Act
    await agentWithSpy.execute(input, BASE_CONTEXT);

    // Assert — AuditLogger.record가 호출되었는지 확인
    expect(deps.auditLogger.record).toHaveBeenCalledOnce();
  });
});

// ─── inferIntent 테스트 (스텁 출력에서 검증) ─────────────────────────────────

describe("SpecAgent 의도 분류 (inferIntent)", () => {
  let agent: SpecAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new SpecAgent(SPEC_AGENT_CONFIG, buildStubDeps());
  });

  it('"install" 키워드: PACKAGE_INSTALL 반환', async () => {
    // Arrange
    const input = buildSpecInput("lodash를 install 해줘");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { intent: string }).intent).toBe("PACKAGE_INSTALL");
    }
  });

  it('"npm" 키워드: PACKAGE_INSTALL 반환', async () => {
    // Arrange
    const input = buildSpecInput("npm run build 실행해줘");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { intent: string }).intent).toBe("PACKAGE_INSTALL");
    }
  });

  it('"http" 키워드: WEB_ACCESS 반환', async () => {
    // Arrange
    const input = buildSpecInput("http://example.com에 접근해줘");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { intent: string }).intent).toBe("WEB_ACCESS");
    }
  });

  it('"url" 키워드: WEB_ACCESS 반환', async () => {
    // Arrange
    const input = buildSpecInput("이 url을 열어줘: https://github.com");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { intent: string }).intent).toBe("WEB_ACCESS");
    }
  });

  it('"file" 키워드: FILE_OPERATION 반환', async () => {
    // Arrange
    const input = buildSpecInput("file을 읽어서 내용을 보여줘");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { intent: string }).intent).toBe("FILE_OPERATION");
    }
  });

  it('"directory" 키워드: FILE_OPERATION 반환', async () => {
    // Arrange
    const input = buildSpecInput("directory 목록을 나열해줘");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { intent: string }).intent).toBe("FILE_OPERATION");
    }
  });

  it('아무 키워드도 없을 때: CODE_IMPLEMENTATION 기본값', async () => {
    // Arrange — 특수 키워드 없는 일반 요청
    const input = buildSpecInput("정렬 알고리즘을 구현해줘");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { intent: string }).intent).toBe("CODE_IMPLEMENTATION");
    }
  });
});

// ─── extractTargets 테스트 (스텁 출력에서 검증) ──────────────────────────────

describe("SpecAgent 대상 추출 (extractTargets)", () => {
  let agent: SpecAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new SpecAgent(SPEC_AGENT_CONFIG, buildStubDeps());
  });

  it("파일 경로 포함 입력: 경로 배열 반환", async () => {
    // Arrange
    const input = buildSpecInput("src/utils/helper.ts 파일을 수정해줘");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const targets = (result.value as { targets: string[] }).targets;
      expect(targets.length).toBeGreaterThan(0);
      // 파일 경로 패턴이 포함되어 있는지 확인
      expect(targets.some((t) => t.includes(".ts") || t.includes("helper"))).toBe(true);
    }
  });

  it(".ts 확장자 파일 경로: 경로 추출됨", async () => {
    // Arrange — extractTargets 정규식이 ts 확장자를 추출
    const input = buildSpecInput("src/index.ts 파일을 수정해줘");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const targets = (result.value as { targets: string[] }).targets;
      expect(targets.some((t) => t.includes("index.ts") || t.includes(".ts"))).toBe(true);
    }
  });

  it("파일 경로 없는 입력: [\"general\"] 반환", async () => {
    // Arrange — 파일 경로 패턴 없는 순수 텍스트
    const input = buildSpecInput("정렬 알고리즘을 구현해줘");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const targets = (result.value as { targets: string[] }).targets;
      expect(targets).toEqual(["general"]);
    }
  });
});

// ─── execute: Claude 모드 테스트 ─────────────────────────────────────────────

describe("SpecAgent.execute (Claude 모드)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("Claude 모드: callClaudeWithJson 호출 + 반환값 사용", async () => {
    // Arrange — callClaude 성공, parseJsonResponse 성공
    const mockSpecOutput = {
      specId: "spec_abcd1234",
      interpretation: "Claude가 분석한 요청",
      intent: "CODE_IMPLEMENTATION" as const,
      targets: ["src/main.ts"],
      requiresWebAccess: false,
      requiresLogin: false,
      clarifications: [],
      ambiguities: [],
    };

    vi.mocked(callClaude).mockResolvedValue({
      ok: true,
      value: {
        content: JSON.stringify(mockSpecOutput),
        model: "claude-haiku-4-5-20251001",
        inputTokens: 50,
        outputTokens: 100,
        stopReason: "end_turn",
      },
    });

    vi.mocked(parseJsonResponse).mockReturnValue({
      ok: true,
      value: mockSpecOutput,
    });

    const deps = buildClaudeDeps();
    const agent = new SpecAgent(SPEC_AGENT_CONFIG, deps);
    const input = buildSpecInput("TypeScript 함수를 구현해줘");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const output = result.value as typeof mockSpecOutput;
      expect(output.specId).toBe("spec_abcd1234");
      expect(output.intent).toBe("CODE_IMPLEMENTATION");
      expect(output.targets).toContain("src/main.ts");
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
    const agent = new SpecAgent(SPEC_AGENT_CONFIG, deps);
    const input = buildSpecInput("코드 작성해줘");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert — Claude 실패해도 스텁 폴백으로 성공 반환
    expect(result.ok).toBe(true);
    if (result.ok) {
      // 스텁 출력은 specId가 spec_ 으로 시작
      expect((result.value as { specId: string }).specId).toMatch(/^spec_/);
    }
  });

  it("Claude 모드: clarificationHistory 있으면 대화 이력 포함 메시지 전송", async () => {
    // Arrange
    vi.mocked(callClaude).mockResolvedValue({
      ok: true,
      value: {
        content: "{}",
        model: "claude-haiku-4-5-20251001",
        inputTokens: 30,
        outputTokens: 50,
        stopReason: "end_turn",
      },
    });

    const mockOutput = {
      specId: "spec_xyz",
      interpretation: "대화 이력 포함 분석",
      intent: "CODE_IMPLEMENTATION" as const,
      targets: ["general"],
      requiresWebAccess: false,
      requiresLogin: false,
      clarifications: [],
      ambiguities: [],
    };
    vi.mocked(parseJsonResponse).mockReturnValue({ ok: true, value: mockOutput });

    const deps = buildClaudeDeps();
    const agent = new SpecAgent(SPEC_AGENT_CONFIG, deps);
    const input = buildSpecInput("함수 구현해줘", {
      clarificationHistory: ["어떤 함수인가요?", "정렬 함수입니다"],
    });

    // Act
    await agent.execute(input, BASE_CONTEXT);

    // Assert — callClaude에 전달된 userMessage에 이전 대화가 포함되어 있는지 확인
    const callArgs = (callClaude as ReturnType<typeof vi.fn>).mock.calls[0];
    const options = callArgs[1] as { userMessage: string };
    expect(options.userMessage).toContain("이전 대화");
  });

  it("Claude 모드 실행 후 감사 로그 기록", async () => {
    // Arrange
    const mockOutput = {
      specId: "spec_audit",
      interpretation: "감사 로그 테스트",
      intent: "CODE_IMPLEMENTATION" as const,
      targets: ["general"],
      requiresWebAccess: false,
      requiresLogin: false,
      clarifications: [],
      ambiguities: [],
    };

    vi.mocked(callClaude).mockResolvedValue({
      ok: true,
      value: {
        content: JSON.stringify(mockOutput),
        model: "claude-haiku-4-5-20251001",
        inputTokens: 20,
        outputTokens: 40,
        stopReason: "end_turn",
      },
    });
    vi.mocked(parseJsonResponse).mockReturnValue({ ok: true, value: mockOutput });

    const deps = buildClaudeDeps();
    const agent = new SpecAgent(SPEC_AGENT_CONFIG, deps);
    const input = buildSpecInput("코드 구현");

    // Act
    await agent.execute(input, BASE_CONTEXT);

    // Assert — AuditLogger.record 호출 확인
    expect(deps.auditLogger.record).toHaveBeenCalledOnce();
    const auditCall = (deps.auditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(auditCall.result.status).toBe("COMPLETED");
  });

  it("requiresWebAccess: 'web' 키워드 입력 시 true", async () => {
    // Arrange — 스텁 모드 사용
    const deps = buildStubDeps();
    const agent = new SpecAgent(SPEC_AGENT_CONFIG, deps);
    const input = buildSpecInput("web 페이지를 열어줘");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { requiresWebAccess: boolean }).requiresWebAccess).toBe(true);
    }
  });

  it("requiresLogin: 'login' 키워드 입력 시 true", async () => {
    // Arrange — 스텁 모드
    const deps = buildStubDeps();
    const agent = new SpecAgent(SPEC_AGENT_CONFIG, deps);
    const input = buildSpecInput("login 페이지로 이동해줘");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { requiresLogin: boolean }).requiresLogin).toBe(true);
    }
  });
});
