// agents-batch.test.ts — Planner, PolicyRisk, Review, TestBuild, Rollback 일괄 테스트
// 각 에이전트의 핵심 경로: 스텁 폴백 정상 출력 / 입력 검증 실패 / 감사 로그 호출
import { describe, it, expect, vi, beforeEach } from "vitest";
import type {
  BaseAgentConfig,
  BaseAgentDependencies,
  AgentExecutionContext,
  AuditLogger,
  PolicyEvaluator,
} from "../types/agent-config.js";
import type { PolicyDecision } from "@jarvis/shared";
import { PlannerAgent } from "./planner.js";
import { PolicyRiskAgent } from "./policy-risk.js";
import { ReviewAgent } from "./review.js";
import { TestBuildAgent } from "./test-build.js";
import { RollbackAgent } from "./rollback.js";

// claude-client 모킹 — 실제 API 호출 금지
vi.mock("../claude-client.js", () => ({
  callClaude: vi.fn(),
  parseJsonResponse: vi.fn(),
}));

import { callClaude, parseJsonResponse } from "../claude-client.js";

// ─── 공통 픽스처 ──────────────────────────────────────────────────────────────

// AgentExecutionContext 기본값
const BASE_CONTEXT: AgentExecutionContext = {
  runId: "run-batch-001",
  sessionId: "session-batch-001",
  userId: "user-batch-001",
  trustMode: "semi-auto",
};

// 성공하는 AuditLogger 목 빌더
function buildAuditLogger(): AuditLogger {
  return {
    record: vi.fn().mockResolvedValue({
      ok: true,
      value: { auditId: "aud_batch_test_001" },
    }),
  };
}

// PolicyDecision 목 — ALLOW 판정
function buildPolicyDecision(status: "ALLOW" | "DENY" | "APPROVAL_REQUIRED" | "CONSTRAINED_ALLOW" = "ALLOW"): PolicyDecision {
  return {
    decisionId: "pd_batch_001",
    timestamp: new Date().toISOString(),
    subject: {
      userId: "user-batch-001",
      role: "Owner",
      device: "desktop",
      sessionId: "session-batch-001",
    },
    request: {
      rawInput: "테스트 요청",
      intent: "CODE_IMPLEMENTATION",
      targets: ["src/test.ts"],
      requiresWebAccess: false,
      requiresLogin: false,
    },
    outcome: {
      status,
      riskScore: 10,
      riskLevel: "LOW",
      requiresGates: [],
      reasonCodes: ["ROUTINE_CODE_CHANGE"],
      humanExplanation: "정상 코드 변경 요청",
    },
    constraints: {
      fs: { readAllow: ["**"], writeAllow: ["/project/src/**"], writeDeny: ["/system/**"] },
      exec: { allow: ["pnpm", "npm"], deny: ["rm -rf"] },
      network: { allowDomains: ["registry.npmjs.org"], denyDomains: [], default: "DENY" },
    },
    requiredCapabilities: [
      {
        cap: "fs.write",
        scope: "/project/src/**",
        ttlSeconds: 300,
        maxUses: 1,
      },
    ],
  };
}

// PolicyEvaluator 목 — ALLOW 판정 반환
function buildPolicyEvaluator(decision?: PolicyDecision): PolicyEvaluator {
  return {
    evaluate: vi.fn().mockReturnValue({
      ok: true,
      value: decision ?? buildPolicyDecision(),
    }),
  };
}

// DENY 판정 PolicyEvaluator
function buildDenyPolicyEvaluator(): PolicyEvaluator {
  return {
    evaluate: vi.fn().mockReturnValue({
      ok: true,
      value: buildPolicyDecision("DENY"),
    }),
  };
}

// claudeClient 없는 deps (스텁 모드)
function buildStubDeps(policyEngine?: PolicyEvaluator): BaseAgentDependencies {
  return {
    auditLogger: buildAuditLogger(),
    policyEngine: policyEngine ?? buildPolicyEvaluator(),
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

// ─── 공통 SpecOutput 픽스처 ──────────────────────────────────────────────────

const VALID_SPEC_OUTPUT = {
  specId: "spec_batch_001",
  interpretation: "TypeScript 유틸 함수 구현 요청",
  intent: "CODE_IMPLEMENTATION" as const,
  targets: ["src/utils/helper.ts"],
  requiresWebAccess: false,
  requiresLogin: false,
  clarifications: [],
  ambiguities: [],
};

// ─── 공통 CodegenOutput (ChangeSet) 픽스처 ───────────────────────────────────

const VALID_CHANGESET = {
  changeSetId: "cs_batch_001",
  planRef: "plan_ref_batch",
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

// ═══════════════════════════════════════════════════════════════════════════════
// 1. PlannerAgent 테스트
// ═══════════════════════════════════════════════════════════════════════════════

// PlannerAgent 전용 BaseAgentConfig
const PLANNER_AGENT_CONFIG: BaseAgentConfig = {
  agentId: "test-planner-agent",
  agentRole: "planner",
  model: "claude-sonnet-4-6",
  tools: ["Read", "Grep", "Glob"],
  disallowedTools: ["Edit", "Write", "Bash"],
  permissionMode: "observe",
  maxTurns: 5,
  timeoutMs: 30000,
};

// 유효한 PlannerInput 빌더
function buildPlannerInput(intent?: string): unknown {
  return {
    specOutput: {
      ...VALID_SPEC_OUTPUT,
      intent: (intent as typeof VALID_SPEC_OUTPUT.intent) ?? "CODE_IMPLEMENTATION",
    },
    policyDecisionId: "pd_batch_001",
    context: BASE_CONTEXT,
  };
}

describe("PlannerAgent.execute (스텁 모드)", () => {
  let agent: PlannerAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new PlannerAgent(PLANNER_AGENT_CONFIG, buildStubDeps());
  });

  it("유효 입력: PlannerOutput 반환 (스텁 모드)", async () => {
    // Arrange
    const input = buildPlannerInput();

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const output = result.value as {
        planId: string;
        steps: unknown[];
        estimatedTotalMs: number;
        toolRequests: unknown[];
      };
      expect(output.planId).toMatch(/^plan_/);
      expect(Array.isArray(output.steps)).toBe(true);
      expect(output.steps.length).toBeGreaterThan(0);
      expect(typeof output.estimatedTotalMs).toBe("number");
      expect(Array.isArray(output.toolRequests)).toBe(true);
    }
  });

  it("CODE_IMPLEMENTATION 의도: codegen 에이전트 포함된 단계 생성", async () => {
    // Arrange
    const input = buildPlannerInput("CODE_IMPLEMENTATION");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const steps = (result.value as { steps: Array<{ agent: string; type: string }> }).steps;
      const hasCodegen = steps.some((s) => s.agent === "codegen");
      expect(hasCodegen).toBe(true);
    }
  });

  it("FILE_OPERATION 의도: FILE_OP 타입 단계 생성", async () => {
    // Arrange
    const input = buildPlannerInput("FILE_OPERATION");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const steps = (result.value as { steps: Array<{ type: string }> }).steps;
      const hasFileOp = steps.some((s) => s.type === "FILE_OP");
      expect(hasFileOp).toBe(true);
    }
  });

  it("PACKAGE_INSTALL 의도: EXEC + TEST 단계 포함", async () => {
    // Arrange
    const input = buildPlannerInput("PACKAGE_INSTALL");

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const steps = (result.value as { steps: Array<{ type: string }> }).steps;
      const types = steps.map((s) => s.type);
      expect(types).toContain("EXEC");
      expect(types).toContain("TEST");
    }
  });

  it("잘못된 입력 (specOutput 누락): VALIDATION_FAILED 반환", async () => {
    // Arrange — specOutput 없는 입력
    const input = {
      policyDecisionId: "pd_batch_001",
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

  it("잘못된 입력 (policyDecisionId 누락): VALIDATION_FAILED 반환", async () => {
    // Arrange
    const input = {
      specOutput: VALID_SPEC_OUTPUT,
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

  it("스텁 모드에서 감사 로그 COMPLETED 기록", async () => {
    // Arrange
    const deps = buildStubDeps();
    const agentWithSpy = new PlannerAgent(PLANNER_AGENT_CONFIG, deps);
    const input = buildPlannerInput();

    // Act
    await agentWithSpy.execute(input, BASE_CONTEXT);

    // Assert
    expect(deps.auditLogger.record).toHaveBeenCalledOnce();
    const auditCall = (deps.auditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(auditCall.result.status).toBe("COMPLETED");
  });
});

describe("PlannerAgent.execute (Claude 모드)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const agent = new PlannerAgent(PLANNER_AGENT_CONFIG, deps);
    const input = buildPlannerInput();

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert — Claude 실패해도 스텁 폴백으로 성공
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { planId: string }).planId).toMatch(/^plan_/);
    }
  });

  it("Claude 모드: userMessage에 의도 정보 포함", async () => {
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
      planId: "plan_claude_msg",
      steps: [{ stepId: "s1", type: "CODE_GENERATE" as const, description: "코드 생성", agent: "codegen", dependsOn: [], estimatedDurationMs: 30000 }],
      estimatedTotalMs: 30000,
      toolRequests: [],
    };
    vi.mocked(parseJsonResponse).mockReturnValue({ ok: true, value: fallbackOutput });

    const deps = buildClaudeDeps();
    const agent = new PlannerAgent(PLANNER_AGENT_CONFIG, deps);
    const input = buildPlannerInput("CODE_IMPLEMENTATION");

    // Act
    await agent.execute(input, BASE_CONTEXT);

    // Assert — callClaude에 전달된 옵션에 의도 정보 포함
    const callArgs = (callClaude as ReturnType<typeof vi.fn>).mock.calls[0];
    const options = callArgs[1] as { userMessage: string };
    expect(options.userMessage).toContain("CODE_IMPLEMENTATION");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. PolicyRiskAgent 테스트
// ═══════════════════════════════════════════════════════════════════════════════

// PolicyRiskAgent 전용 BaseAgentConfig
const POLICY_RISK_AGENT_CONFIG: BaseAgentConfig = {
  agentId: "test-policy-risk-agent",
  agentRole: "policy",
  model: "claude-opus-4-6",
  tools: ["Read", "Grep", "Glob"],
  disallowedTools: ["Edit", "Write", "Bash"],
  permissionMode: "observe",
  maxTurns: 5,
  timeoutMs: 30000,
};

// 유효한 PolicyRiskInput 빌더
function buildPolicyRiskInput(): unknown {
  return {
    specOutput: VALID_SPEC_OUTPUT,
    context: BASE_CONTEXT,
    subject: {
      userId: "user-batch-001",
      role: "Owner",
      device: "desktop",
      sessionId: "session-batch-001",
    },
  };
}

describe("PolicyRiskAgent.execute (ALLOW 판정)", () => {
  let agent: PolicyRiskAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new PolicyRiskAgent(POLICY_RISK_AGENT_CONFIG, buildStubDeps());
  });

  it("유효 입력 + ALLOW 판정: PolicyRiskOutput 반환", async () => {
    // Arrange
    const input = buildPolicyRiskInput();

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const output = result.value as {
        decisionId: string;
        status: string;
        riskScore: number;
        riskLevel: string;
        requiresGates: string[];
        requiredCapabilities: string[];
        humanExplanation: string;
      };
      expect(output.decisionId).toBe("pd_batch_001");
      expect(output.status).toBe("ALLOW");
      expect(typeof output.riskScore).toBe("number");
      expect(output.riskLevel).toBe("LOW");
      expect(Array.isArray(output.requiresGates)).toBe(true);
      expect(Array.isArray(output.requiredCapabilities)).toBe(true);
    }
  });

  it("잘못된 입력 (specOutput 누락): VALIDATION_FAILED 반환", async () => {
    // Arrange
    const input = {
      context: BASE_CONTEXT,
      subject: {
        userId: "user-batch-001",
        role: "Owner",
        device: "desktop",
        sessionId: "session-batch-001",
      },
    };

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("잘못된 입력 (subject 누락): VALIDATION_FAILED 반환", async () => {
    // Arrange
    const input = {
      specOutput: VALID_SPEC_OUTPUT,
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

  it("ALLOW 판정 후 감사 로그 COMPLETED 기록", async () => {
    // Arrange
    const deps = buildStubDeps();
    const agentWithSpy = new PolicyRiskAgent(POLICY_RISK_AGENT_CONFIG, deps);
    const input = buildPolicyRiskInput();

    // Act
    await agentWithSpy.execute(input, BASE_CONTEXT);

    // Assert
    expect(deps.auditLogger.record).toHaveBeenCalledOnce();
    const auditCall = (deps.auditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(auditCall.result.status).toBe("COMPLETED");
  });

  it("ALLOW 판정: requiredCapabilities가 cap 필드로 변환됨", async () => {
    // Arrange — requiredCapabilities에 fs.write 포함된 결정
    const input = buildPolicyRiskInput();

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert — output.requiredCapabilities는 cap 문자열 배열
    expect(result.ok).toBe(true);
    if (result.ok) {
      const caps = (result.value as { requiredCapabilities: string[] }).requiredCapabilities;
      expect(caps).toContain("fs.write");
    }
  });
});

describe("PolicyRiskAgent.execute (DENY 판정)", () => {
  it("DENY 판정: POLICY_DENIED 에러 반환", async () => {
    // Arrange — PolicyEvaluator가 DENY 판정 반환
    const denyDeps = buildStubDeps(buildDenyPolicyEvaluator());
    const agent = new PolicyRiskAgent(POLICY_RISK_AGENT_CONFIG, denyDeps);
    const input = buildPolicyRiskInput();

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("POLICY_DENIED");
    }
  });

  it("DENY 판정 후 감사 로그 DENIED 기록", async () => {
    // Arrange
    const denyDeps = buildStubDeps(buildDenyPolicyEvaluator());
    const agent = new PolicyRiskAgent(POLICY_RISK_AGENT_CONFIG, denyDeps);
    const input = buildPolicyRiskInput();

    // Act
    await agent.execute(input, BASE_CONTEXT);

    // Assert — DENIED 상태로 감사 로그 기록
    expect(denyDeps.auditLogger.record).toHaveBeenCalledOnce();
    const auditCall = (denyDeps.auditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(auditCall.result.status).toBe("DENIED");
  });

  it("정책 엔진 실패 시: 에러 전파", async () => {
    // Arrange — PolicyEvaluator가 에러 반환
    const errorPolicyEngine: PolicyEvaluator = {
      evaluate: vi.fn().mockReturnValue({
        ok: false,
        error: {
          code: "INTERNAL_ERROR",
          message: "정책 엔진 내부 오류",
          timestamp: new Date().toISOString(),
        },
      }),
    };
    const deps = buildStubDeps(errorPolicyEngine);
    const agent = new PolicyRiskAgent(POLICY_RISK_AGENT_CONFIG, deps);
    const input = buildPolicyRiskInput();

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert — 정책 엔진 에러가 전파됨
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2-B. PolicyRiskAgent — Opus Extended Thinking (Claude 모드 심층 분석) 테스트
// ═══════════════════════════════════════════════════════════════════════════════

describe("PolicyRiskAgent.execute (Claude 모드 — 심층 분석)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("심층 분석 성공: output에 deepAnalysis 필드 존재 및 adjustedRiskScore 반영", async () => {
    // Arrange — callClaude 성공, parseJsonResponse가 DeepAnalysisResponse 반환
    vi.mocked(callClaude).mockResolvedValue({
      ok: true,
      value: {
        content: JSON.stringify({
          deepAnalysis: "race condition 발견",
          adjustedRiskScore: 30,
          additionalCapabilities: ["exec.run"],
          reasoning: "async 처리 미흡",
        }),
        model: "claude-opus-4-6",
        inputTokens: 100,
        outputTokens: 200,
        stopReason: "end_turn",
      },
    });

    vi.mocked(parseJsonResponse).mockReturnValue({
      ok: true,
      value: {
        deepAnalysis: "race condition 발견",
        adjustedRiskScore: 30,
        additionalCapabilities: ["exec.run"],
        reasoning: "async 처리 미흡",
      },
    });

    // 정책 엔진이 riskScore=10 반환 — adjustedRiskScore(30) > originalScore(10) 이므로 반영
    const claudeDeps = buildClaudeDeps();
    const agent = new PolicyRiskAgent(POLICY_RISK_AGENT_CONFIG, claudeDeps);
    const input = buildPolicyRiskInput();

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const output = result.value as {
        deepAnalysis?: string;
        adjustedRiskScore?: number;
        riskScore: number;
      };
      // deepAnalysis 필드가 심층 분석 결과로 채워짐
      expect(output.deepAnalysis).toBe("race condition 발견");
      // adjustedRiskScore가 30으로 반환됨
      expect(output.adjustedRiskScore).toBe(30);
      // riskScore도 30으로 상향 조정됨 (원래 10보다 높으므로 반영)
      expect(output.riskScore).toBe(30);
    }
  });

  it("심층 분석: adjustedRiskScore가 원래보다 낮으면 원래 점수 유지 (하향 불가 원칙)", async () => {
    // Arrange — Opus가 adjustedRiskScore=5 (원래 riskScore=10보다 낮음) 반환
    vi.mocked(callClaude).mockResolvedValue({
      ok: true,
      value: {
        content: JSON.stringify({
          deepAnalysis: "낮은 위험으로 판단",
          adjustedRiskScore: 5,
          additionalCapabilities: [],
          reasoning: "단순 읽기 작업",
        }),
        model: "claude-opus-4-6",
        inputTokens: 80,
        outputTokens: 120,
        stopReason: "end_turn",
      },
    });

    vi.mocked(parseJsonResponse).mockReturnValue({
      ok: true,
      value: {
        deepAnalysis: "낮은 위험으로 판단",
        adjustedRiskScore: 5,
        additionalCapabilities: [],
        reasoning: "단순 읽기 작업",
      },
    });

    const claudeDeps = buildClaudeDeps();
    const agent = new PolicyRiskAgent(POLICY_RISK_AGENT_CONFIG, claudeDeps);
    const input = buildPolicyRiskInput();

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const output = result.value as {
        deepAnalysis?: string;
        adjustedRiskScore?: number;
        riskScore: number;
      };
      // adjustedRiskScore는 Opus가 제안한 값 그대로 저장
      expect(output.adjustedRiskScore).toBe(5);
      // riskScore는 원래 점수(10) 유지 — 하향 불가 원칙 적용
      expect(output.riskScore).toBe(10);
    }
  });

  it("심층 분석 실패 시: 기본 판정 결과 사용 (deepAnalysis=undefined)", async () => {
    // Arrange — callClaude 실패 → performDeepAnalysis가 null 반환 → 스텁 결과 사용
    vi.mocked(callClaude).mockResolvedValue({
      ok: false,
      error: {
        code: "UPSTREAM_FAILURE",
        message: "Opus Extended Thinking 호출 실패",
        timestamp: new Date().toISOString(),
      },
    });

    // parseJsonResponse는 호출되지 않음 (callClaude 실패 후 분기)
    vi.mocked(parseJsonResponse).mockReturnValue({
      ok: false,
      error: {
        code: "UPSTREAM_FAILURE",
        message: "호출 실패",
        timestamp: new Date().toISOString(),
      },
    });

    const claudeDeps = buildClaudeDeps();
    const agent = new PolicyRiskAgent(POLICY_RISK_AGENT_CONFIG, claudeDeps);
    const input = buildPolicyRiskInput();

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert — 심층 분석 실패해도 기본 판정 결과로 정상 응답
    expect(result.ok).toBe(true);
    if (result.ok) {
      const output = result.value as {
        deepAnalysis?: string;
        adjustedRiskScore?: number;
        riskScore: number;
        status: string;
      };
      // 심층 분석 실패 시 deepAnalysis 필드 없음
      expect(output.deepAnalysis).toBeUndefined();
      // 심층 분석 미수행 시 adjustedRiskScore 없음
      expect(output.adjustedRiskScore).toBeUndefined();
      // 원래 정책 엔진 판정의 riskScore(10) 유지
      expect(output.riskScore).toBe(10);
      // 기본 판정 상태는 ALLOW
      expect(output.status).toBe("ALLOW");
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. ReviewAgent 테스트
// ═══════════════════════════════════════════════════════════════════════════════

// ReviewAgent 전용 BaseAgentConfig
const REVIEW_AGENT_CONFIG: BaseAgentConfig = {
  agentId: "test-review-agent",
  agentRole: "review",
  model: "claude-sonnet-4-6",
  tools: ["Read", "Grep", "Glob"],
  disallowedTools: ["Edit", "Write", "Bash"],
  permissionMode: "observe",
  maxTurns: 5,
  timeoutMs: 30000,
};

// 유효한 ReviewInput 빌더
function buildReviewInput(securityOverride?: object): unknown {
  return {
    changeSet: {
      ...VALID_CHANGESET,
      securitySelfCheck: {
        ...VALID_CHANGESET.securitySelfCheck,
        ...securityOverride,
      },
    },
    context: BASE_CONTEXT,
    policyDecisionId: "pd_batch_001",
  };
}

describe("ReviewAgent.execute (스텁 모드)", () => {
  let agent: ReviewAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new ReviewAgent(REVIEW_AGENT_CONFIG, buildStubDeps());
  });

  it("보안 이슈 없는 ChangeSet: passed=true 반환", async () => {
    // Arrange
    const input = buildReviewInput();

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const output = result.value as {
        reviewId: string;
        passed: boolean;
        blockers: unknown[];
        warnings: unknown[];
        securityFindings: unknown[];
        approvedChangeSetId?: string;
      };
      expect(output.reviewId).toMatch(/^rev_/);
      expect(output.passed).toBe(true);
      expect(output.blockers).toHaveLength(0);
      expect(output.approvedChangeSetId).toBe("cs_batch_001");
    }
  });

  it("secretsFound=true: blocker 생성 + passed=false", async () => {
    // Arrange — 시크릿 발견된 ChangeSet
    const input = buildReviewInput({ secretsFound: true });

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const output = result.value as { passed: boolean; blockers: Array<{ severity: string }> };
      expect(output.passed).toBe(false);
      expect(output.blockers.length).toBeGreaterThan(0);
      expect(output.blockers[0].severity).toBe("critical");
    }
  });

  it("injectionRisk=true: blocker 생성 + passed=false", async () => {
    // Arrange — injection 위험 ChangeSet
    const input = buildReviewInput({ injectionRisk: true });

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const output = result.value as { passed: boolean; blockers: Array<{ severity: string }> };
      expect(output.passed).toBe(false);
      expect(output.blockers.some((b) => b.severity === "high")).toBe(true);
    }
  });

  it("pathTraversalRisk=true: blocker 생성 + passed=false", async () => {
    // Arrange — 경로 순회 위험 ChangeSet
    const input = buildReviewInput({ pathTraversalRisk: true });

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const output = result.value as { passed: boolean; blockers: Array<{ severity: string }> };
      expect(output.passed).toBe(false);
      expect(output.blockers.some((b) => b.severity === "high")).toBe(true);
    }
  });

  it("passed=false 시 approvedChangeSetId 없음", async () => {
    // Arrange — 보안 이슈 있는 ChangeSet
    const input = buildReviewInput({ secretsFound: true });

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { approvedChangeSetId?: string }).approvedChangeSetId).toBeUndefined();
    }
  });

  it("잘못된 입력 (changeSet 누락): VALIDATION_FAILED 반환", async () => {
    // Arrange
    const input = {
      context: BASE_CONTEXT,
      policyDecisionId: "pd_batch_001",
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

  it("리뷰 통과 시 감사 로그 COMPLETED 기록", async () => {
    // Arrange
    const deps = buildStubDeps();
    const agentWithSpy = new ReviewAgent(REVIEW_AGENT_CONFIG, deps);
    const input = buildReviewInput();

    // Act
    await agentWithSpy.execute(input, BASE_CONTEXT);

    // Assert
    expect(deps.auditLogger.record).toHaveBeenCalledOnce();
    const auditCall = (deps.auditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(auditCall.result.status).toBe("COMPLETED");
  });

  it("리뷰 실패 시 감사 로그 FAILED 기록", async () => {
    // Arrange — 보안 이슈 있는 ChangeSet → passed=false → FAILED 감사 로그
    const deps = buildStubDeps();
    const agentWithSpy = new ReviewAgent(REVIEW_AGENT_CONFIG, deps);
    const input = buildReviewInput({ secretsFound: true });

    // Act
    await agentWithSpy.execute(input, BASE_CONTEXT);

    // Assert
    expect(deps.auditLogger.record).toHaveBeenCalledOnce();
    const auditCall = (deps.auditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(auditCall.result.status).toBe("FAILED");
  });

  it("스텁 모드: qualityMetrics 기본값 반환", async () => {
    // Arrange — 보안 이슈 없는 정상 ChangeSet
    const input = buildReviewInput();

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert — 스텁 출력의 qualityMetrics가 지정된 기본값으로 채워짐
    expect(result.ok).toBe(true);
    if (result.ok) {
      const output = result.value as {
        qualityMetrics?: {
          complexityScore: number;
          maintainabilityScore: number;
          testabilityScore: number;
        };
      };
      expect(output.qualityMetrics).toBeDefined();
      expect(output.qualityMetrics?.complexityScore).toBe(50);
      expect(output.qualityMetrics?.maintainabilityScore).toBe(70);
      expect(output.qualityMetrics?.testabilityScore).toBe(80);
    }
  });
});

describe("ReviewAgent.execute (Claude 모드)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const agent = new ReviewAgent(REVIEW_AGENT_CONFIG, deps);
    const input = buildReviewInput();

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert — Claude 실패해도 스텁 폴백으로 성공
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { reviewId: string }).reviewId).toMatch(/^rev_/);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. TestBuildAgent 테스트
// ═══════════════════════════════════════════════════════════════════════════════

// TestBuildAgent 전용 BaseAgentConfig
const TESTBUILD_AGENT_CONFIG: BaseAgentConfig = {
  agentId: "test-testbuild-agent",
  agentRole: "test",
  model: "claude-haiku-4-5-20251001",
  tools: ["Read", "Grep", "Glob"],
  disallowedTools: ["Edit", "Write", "Bash"],
  permissionMode: "observe",
  maxTurns: 5,
  timeoutMs: 30000,
};

// 유효한 TestBuildInput 빌더
function buildTestBuildInput(extra?: object): unknown {
  return {
    changeSetId: "cs_batch_001",
    reviewId: "rev_batch_001",
    context: BASE_CONTEXT,
    ...extra,
  };
}

describe("TestBuildAgent.execute (스텁 모드)", () => {
  let agent: TestBuildAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new TestBuildAgent(TESTBUILD_AGENT_CONFIG, buildStubDeps());
  });

  it("유효 입력: TestBuildOutput 반환 (스텁 모드)", async () => {
    // Arrange
    const input = buildTestBuildInput();

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const output = result.value as {
        testRunId: string;
        buildPassed: boolean;
        testsPassed: boolean;
        totalTests: number;
        failedTests: number;
        coveragePercent: number;
        errors: unknown[];
        durationMs: number;
      };
      expect(output.testRunId).toMatch(/^trun_/);
      expect(output.buildPassed).toBe(true);
      expect(output.testsPassed).toBe(true);
      expect(output.failedTests).toBe(0);
      expect(Array.isArray(output.errors)).toBe(true);
      expect(typeof output.durationMs).toBe("number");
    }
  });

  it("스텁 모드: totalTests=0 (실제 테스트 미실행)", async () => {
    // Arrange
    const input = buildTestBuildInput();

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert — 스텁은 실제 테스트를 실행하지 않으므로 0
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { totalTests: number }).totalTests).toBe(0);
    }
  });

  it("testCommands 포함 입력: 정상 처리", async () => {
    // Arrange
    const input = buildTestBuildInput({
      testCommands: ["pnpm test", "pnpm build"],
    });

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
  });

  it("잘못된 입력 (changeSetId 누락): VALIDATION_FAILED 반환", async () => {
    // Arrange
    const input = {
      reviewId: "rev_batch_001",
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

  it("잘못된 입력 (reviewId 누락): VALIDATION_FAILED 반환", async () => {
    // Arrange
    const input = {
      changeSetId: "cs_batch_001",
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

  it("스텁 모드에서 감사 로그 COMPLETED 기록", async () => {
    // Arrange
    const deps = buildStubDeps();
    const agentWithSpy = new TestBuildAgent(TESTBUILD_AGENT_CONFIG, deps);
    const input = buildTestBuildInput();

    // Act
    await agentWithSpy.execute(input, BASE_CONTEXT);

    // Assert
    expect(deps.auditLogger.record).toHaveBeenCalledOnce();
    const auditCall = (deps.auditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(auditCall.result.status).toBe("COMPLETED");
  });

  it("스텁 모드: suggestedTests 빈 배열 반환", async () => {
    // Arrange — Claude 미사용 스텁 폴백은 제안 테스트 없음
    const input = buildTestBuildInput();

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert — 스텁 출력의 suggestedTests가 빈 배열
    expect(result.ok).toBe(true);
    if (result.ok) {
      const output = result.value as {
        suggestedTests?: unknown[];
      };
      expect(Array.isArray(output.suggestedTests)).toBe(true);
      expect(output.suggestedTests).toHaveLength(0);
    }
  });
});

describe("TestBuildAgent.execute (Claude 모드)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const agent = new TestBuildAgent(TESTBUILD_AGENT_CONFIG, deps);
    const input = buildTestBuildInput();

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert — Claude 실패해도 스텁 폴백으로 성공
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { testRunId: string }).testRunId).toMatch(/^trun_/);
    }
  });

  it("Claude 모드: callClaude에 changeSetId와 reviewId 포함", async () => {
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

    const fallbackOutput = {
      testRunId: "trun_claude_test",
      buildPassed: true,
      testsPassed: true,
      totalTests: 10,
      failedTests: 0,
      coveragePercent: 85,
      errors: [],
      durationMs: 5000,
    };
    vi.mocked(parseJsonResponse).mockReturnValue({ ok: true, value: fallbackOutput });

    const deps = buildClaudeDeps();
    const agent = new TestBuildAgent(TESTBUILD_AGENT_CONFIG, deps);
    const input = buildTestBuildInput();

    // Act
    await agent.execute(input, BASE_CONTEXT);

    // Assert — callClaude에 전달된 메시지에 changeSetId 포함
    const callArgs = (callClaude as ReturnType<typeof vi.fn>).mock.calls[0];
    const options = callArgs[1] as { userMessage: string };
    expect(options.userMessage).toContain("cs_batch_001");
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. RollbackAgent 테스트
// ═══════════════════════════════════════════════════════════════════════════════

// RollbackAgent 전용 BaseAgentConfig
const ROLLBACK_AGENT_CONFIG: BaseAgentConfig = {
  agentId: "test-rollback-agent",
  agentRole: "rollback",
  model: "claude-haiku-4-5-20251001",
  tools: ["Read", "Grep", "Glob"],
  disallowedTools: ["Edit", "Write", "Bash"],
  permissionMode: "observe",
  maxTurns: 5,
  timeoutMs: 30000,
};

// 유효한 RollbackInput 빌더
function buildRollbackInput(extra?: object): unknown {
  return {
    runId: "run-batch-001",
    reason: "빌드 실패로 인한 롤백",
    context: BASE_CONTEXT,
    ...extra,
  };
}

describe("RollbackAgent.execute (스텁 모드)", () => {
  let agent: RollbackAgent;

  beforeEach(() => {
    vi.clearAllMocks();
    agent = new RollbackAgent(ROLLBACK_AGENT_CONFIG, buildStubDeps());
  });

  it("유효 입력: RollbackOutput 반환 (스텁 모드)", async () => {
    // Arrange
    const input = buildRollbackInput();

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const output = result.value as {
        rollbackId: string;
        success: boolean;
        revertedActions: unknown[];
        postmortem: string;
        errors: unknown[];
      };
      expect(output.rollbackId).toMatch(/^rb_/);
      expect(output.success).toBe(true);
      expect(Array.isArray(output.revertedActions)).toBe(true);
      expect(typeof output.postmortem).toBe("string");
      expect(output.postmortem.length).toBeGreaterThan(0);
      expect(Array.isArray(output.errors)).toBe(true);
    }
  });

  it("스텁 모드: postmortem에 runId와 reason 포함", async () => {
    // Arrange
    const input = buildRollbackInput();

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert — 스텁 postmortem에 입력 정보 포함
    expect(result.ok).toBe(true);
    if (result.ok) {
      const postmortem = (result.value as { postmortem: string }).postmortem;
      expect(postmortem).toContain("run-batch-001");
      expect(postmortem).toContain("빌드 실패로 인한 롤백");
    }
  });

  it("targetChangeSetId 포함 입력: 정상 처리", async () => {
    // Arrange
    const input = buildRollbackInput({
      targetChangeSetId: "cs_batch_001",
    });

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
  });

  it("잘못된 입력 (runId 누락): VALIDATION_FAILED 반환", async () => {
    // Arrange
    const input = {
      reason: "롤백 테스트",
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

  it("잘못된 입력 (reason 누락): VALIDATION_FAILED 반환", async () => {
    // Arrange
    const input = {
      runId: "run-batch-001",
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

  it("스텁 모드에서 감사 로그 ROLLED_BACK 기록", async () => {
    // Arrange
    const deps = buildStubDeps();
    const agentWithSpy = new RollbackAgent(ROLLBACK_AGENT_CONFIG, deps);
    const input = buildRollbackInput();

    // Act
    await agentWithSpy.execute(input, BASE_CONTEXT);

    // Assert — 롤백 에이전트는 ROLLED_BACK 상태로 로그
    expect(deps.auditLogger.record).toHaveBeenCalledOnce();
    const auditCall = (deps.auditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(auditCall.result.status).toBe("ROLLED_BACK");
  });

  it("감사 로그에 rollbackId 포함됨", async () => {
    // Arrange
    const deps = buildStubDeps();
    const agentWithSpy = new RollbackAgent(ROLLBACK_AGENT_CONFIG, deps);
    const input = buildRollbackInput();

    // Act
    await agentWithSpy.execute(input, BASE_CONTEXT);

    // Assert
    const auditCall = (deps.auditLogger.record as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
    expect(auditCall.what.aiInterpretation).toContain("rollbackId");
  });
});

describe("RollbackAgent.execute (Claude 모드)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const agent = new RollbackAgent(ROLLBACK_AGENT_CONFIG, deps);
    const input = buildRollbackInput();

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert — Claude 실패해도 스텁 폴백으로 성공
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect((result.value as { rollbackId: string }).rollbackId).toMatch(/^rb_/);
    }
  });

  it("Claude 성공: 반환된 RollbackOutput 사용", async () => {
    // Arrange — callClaude 성공, parseJsonResponse 성공
    const mockRollbackOutput = {
      rollbackId: "rb_claude_001",
      success: true,
      revertedActions: ["act_001", "act_002"],
      postmortem: "## 원인 분석\nClaude가 분석한 내용",
      errors: [],
    };

    vi.mocked(callClaude).mockResolvedValue({
      ok: true,
      value: {
        content: JSON.stringify(mockRollbackOutput),
        model: "claude-haiku-4-5-20251001",
        inputTokens: 50,
        outputTokens: 100,
        stopReason: "end_turn",
      },
    });

    vi.mocked(parseJsonResponse).mockReturnValue({
      ok: true,
      value: mockRollbackOutput,
    });

    const deps = buildClaudeDeps();
    const agent = new RollbackAgent(ROLLBACK_AGENT_CONFIG, deps);
    const input = buildRollbackInput();

    // Act
    const result = await agent.execute(input, BASE_CONTEXT);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const output = result.value as typeof mockRollbackOutput;
      expect(output.rollbackId).toBe("rb_claude_001");
      expect(output.revertedActions).toHaveLength(2);
    }
    expect(callClaude).toHaveBeenCalledOnce();
  });

  it("Claude 모드: userMessage에 runId와 reason 포함", async () => {
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

    const fallbackOutput = {
      rollbackId: "rb_msg_test",
      success: true,
      revertedActions: [],
      postmortem: "테스트 postmortem",
      errors: [],
    };
    vi.mocked(parseJsonResponse).mockReturnValue({ ok: true, value: fallbackOutput });

    const deps = buildClaudeDeps();
    const agent = new RollbackAgent(ROLLBACK_AGENT_CONFIG, deps);
    const input = buildRollbackInput();

    // Act
    await agent.execute(input, BASE_CONTEXT);

    // Assert — callClaude에 전달된 메시지에 runId와 reason 포함
    const callArgs = (callClaude as ReturnType<typeof vi.fn>).mock.calls[0];
    const options = callArgs[1] as { userMessage: string };
    expect(options.userMessage).toContain("run-batch-001");
    expect(options.userMessage).toContain("빌드 실패로 인한 롤백");
  });
});
