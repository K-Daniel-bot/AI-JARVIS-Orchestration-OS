// 에이전트 5개 순차 체인 통합 테스트 — Zod 스키마 호환 + 데이터 흐름 검증
import { describe, it, expect, vi, beforeEach } from "vitest";
import { SpecAgent } from "./spec-agent.js";
import { PlannerAgent } from "./planner.js";
import { CodegenAgent } from "./codegen.js";
import { ReviewAgent } from "./review.js";
import { TestBuildAgent } from "./test-build.js";
import type { AuditLogger, PolicyEvaluator, BaseAgentConfig, AgentExecutionContext } from "../types/agent-config.js";
import {
  SpecOutputSchema,
  PlannerInputSchema,
  CodegenInputSchema,
  ReviewInputSchema,
  TestBuildInputSchema,
  TestBuildOutputSchema,
  type SpecOutput,
  type PlannerOutput,
  type CodegenOutput,
  type ReviewOutput,
  type TestBuildOutput,
} from "../types/agent-io.js";
import type { AuditEntry, JarvisError, Result } from "@jarvis/shared";
import { ok } from "@jarvis/shared";

// ─── 모킹 설정 ─────────────────────────────────────────────────────────────

// 모킹된 감사 로거 — 호출 횟수 추적
const mockAuditRecord = vi.fn<[Omit<AuditEntry, "integrity">], Promise<Result<AuditEntry, JarvisError>>>()
  .mockImplementation(async (entry) => ok({
    ...entry,
    integrity: { previousHash: "genesis", hash: "mock_hash_001", algorithm: "sha256" },
  } as AuditEntry));

const mockAuditLogger: AuditLogger = {
  record: mockAuditRecord,
};

// 모킹된 정책 엔진 — ALLOW 반환
const mockPolicyEvaluator: PolicyEvaluator = {
  evaluate: vi.fn(() => ok({
    decisionId: "pd_mock_001",
    status: "ALLOW" as const,
    riskScore: 15,
    riskLevel: "LOW" as const,
    matchedRules: [],
    requiredCapabilities: [],
    requiredGates: [],
    humanExplanation: "테스트용 정책 판정",
    timestamp: new Date().toISOString(),
    policySources: [],
  })),
};

// claudeClient 미주입 — 스텁 강제
const baseDeps = {
  auditLogger: mockAuditLogger,
  policyEngine: mockPolicyEvaluator,
};

// 테스트 실행 컨텍스트
const testContext: AgentExecutionContext = {
  runId: "run_chain_test",
  sessionId: "session_chain_001",
  userId: "user_test",
  trustMode: "semi-auto",
};

// 에이전트 공통 설정 생성기
function makeConfig(role: BaseAgentConfig["agentRole"], model: BaseAgentConfig["model"]): BaseAgentConfig {
  return {
    agentId: `${role}_chain_test`,
    agentRole: role,
    model,
    tools: ["Read", "Grep", "Glob"],
    disallowedTools: [],
    permissionMode: "auto",
    maxTurns: 10,
    timeoutMs: 30000,
  };
}

// ─── 테스트 ─────────────────────────────────────────────────────────────────

describe("에이전트 체인 통합 테스트 — Spec→Planner→Codegen→Review→TestBuild", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // 1. SpecAgent 스텁 출력이 SpecOutputSchema 통과
  it("SpecAgent 스텁 출력이 SpecOutputSchema 검증을 통과한다", async () => {
    const spec = new SpecAgent(makeConfig("spec", "claude-haiku-4-5-20251001"), baseDeps);
    const result = await spec.execute(
      {
        rawInput: "TypeScript 파일에 로깅 함수를 추가해줘",
        context: { runId: "run_1", sessionId: "s_1", userId: "u_1", trustMode: "semi-auto" },
      },
      testContext,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Zod 스키마 검증
    const parsed = SpecOutputSchema.safeParse(result.value);
    expect(parsed.success).toBe(true);
  });

  // 2. SpecOutput → PlannerInputSchema 매핑 후 검증 통과
  it("SpecOutput을 PlannerInputSchema 형식으로 매핑하면 검증을 통과한다", async () => {
    const spec = new SpecAgent(makeConfig("spec", "claude-haiku-4-5-20251001"), baseDeps);
    const specResult = await spec.execute(
      {
        rawInput: "코드를 리팩토링해줘",
        context: { runId: "run_2", sessionId: "s_2", userId: "u_2", trustMode: "semi-auto" },
      },
      testContext,
    );
    expect(specResult.ok).toBe(true);
    if (!specResult.ok) return;

    const specOutput: SpecOutput = specResult.value;
    const plannerInput = {
      specOutput,
      policyDecisionId: "pd_mock_001",
      context: { runId: "run_2", sessionId: "s_2", userId: "u_2", trustMode: "semi-auto" as const },
    };

    const parsed = PlannerInputSchema.safeParse(plannerInput);
    expect(parsed.success).toBe(true);
  });

  // 3. PlannerAgent(CODE_IMPLEMENTATION) 스텁 출력에 CODE_GENERATE step 포함
  it("PlannerAgent가 CODE_IMPLEMENTATION 의도에 대해 CODE_GENERATE step을 포함한다", async () => {
    const spec = new SpecAgent(makeConfig("spec", "claude-haiku-4-5-20251001"), baseDeps);
    const specResult = await spec.execute(
      {
        rawInput: "TypeScript 함수 구현",
        context: { runId: "run_3", sessionId: "s_3", userId: "u_3", trustMode: "semi-auto" },
      },
      testContext,
    );
    expect(specResult.ok).toBe(true);
    if (!specResult.ok) return;

    const planner = new PlannerAgent(makeConfig("planner", "claude-sonnet-4-6"), baseDeps);
    const planResult = await planner.execute(
      {
        specOutput: specResult.value,
        policyDecisionId: "pd_mock_001",
        context: { runId: "run_3", sessionId: "s_3", userId: "u_3", trustMode: "semi-auto" },
      },
      testContext,
    );

    expect(planResult.ok).toBe(true);
    if (!planResult.ok) return;

    const planOutput: PlannerOutput = planResult.value;
    const codeGenStep = planOutput.steps.find((s) => s.type === "CODE_GENERATE");
    expect(codeGenStep).toBeDefined();
  });

  // 4. PlannerOutput step → CodegenInputSchema 매핑 후 검증 통과
  it("PlannerOutput의 step을 CodegenInputSchema로 매핑하면 검증을 통과한다", async () => {
    const spec = new SpecAgent(makeConfig("spec", "claude-haiku-4-5-20251001"), baseDeps);
    const specResult = await spec.execute(
      {
        rawInput: "새 유틸리티 함수 작성",
        context: { runId: "run_4", sessionId: "s_4", userId: "u_4", trustMode: "semi-auto" },
      },
      testContext,
    );
    expect(specResult.ok).toBe(true);
    if (!specResult.ok) return;

    const planner = new PlannerAgent(makeConfig("planner", "claude-sonnet-4-6"), baseDeps);
    const planResult = await planner.execute(
      {
        specOutput: specResult.value,
        policyDecisionId: "pd_mock_002",
        context: { runId: "run_4", sessionId: "s_4", userId: "u_4", trustMode: "semi-auto" },
      },
      testContext,
    );
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) return;

    const planOutput: PlannerOutput = planResult.value;
    const firstStep = planOutput.steps[0];

    const codegenInput = {
      planStep: {
        stepId: firstStep.stepId,
        description: firstStep.description,
        outputs: [],
      },
      specOutput: specResult.value,
      context: { runId: "run_4", sessionId: "s_4", userId: "u_4", trustMode: "semi-auto" as const },
    };

    const parsed = CodegenInputSchema.safeParse(codegenInput);
    expect(parsed.success).toBe(true);
  });

  // 5. CodegenAgent 스텁 출력 → ReviewInputSchema 매핑 후 검증 통과
  it("CodegenOutput을 ReviewInputSchema로 매핑하면 검증을 통과한다", async () => {
    const codegen = new CodegenAgent(makeConfig("codegen", "claude-sonnet-4-6"), baseDeps);
    const specOutput: SpecOutput = {
      specId: "spec_test001",
      interpretation: "테스트 해석",
      intent: "CODE_IMPLEMENTATION",
      targets: ["src/utils.ts"],
      requiresWebAccess: false,
      requiresLogin: false,
      clarifications: [],
      ambiguities: [],
    };

    const codegenResult = await codegen.execute(
      {
        planStep: { stepId: "s1", description: "코드 생성", outputs: [] },
        specOutput,
        context: { runId: "run_5", sessionId: "s_5", userId: "u_5", trustMode: "semi-auto" },
      },
      testContext,
    );
    expect(codegenResult.ok).toBe(true);
    if (!codegenResult.ok) return;

    const codegenOutput: CodegenOutput = codegenResult.value;
    const reviewInput = {
      changeSet: codegenOutput,
      context: { runId: "run_5", sessionId: "s_5", userId: "u_5", trustMode: "semi-auto" as const },
      policyDecisionId: "pd_mock_003",
    };

    const parsed = ReviewInputSchema.safeParse(reviewInput);
    expect(parsed.success).toBe(true);
  });

  // 6. ReviewAgent(securitySelfCheck 모두 false) → passed=true
  it("ReviewAgent가 보안 이슈 없는 ChangeSet에 대해 passed=true를 반환한다", async () => {
    const review = new ReviewAgent(makeConfig("review", "claude-sonnet-4-6"), baseDeps);
    const cleanChangeSet: CodegenOutput = {
      changeSetId: "cs_clean001",
      planRef: "plan_ref_001",
      stepRef: "s1",
      filesAdded: [],
      filesModified: [],
      securitySelfCheck: {
        secretsFound: false,
        injectionRisk: false,
        pathTraversalRisk: false,
      },
    };

    const result = await review.execute(
      {
        changeSet: cleanChangeSet,
        context: { runId: "run_6", sessionId: "s_6", userId: "u_6", trustMode: "semi-auto" },
        policyDecisionId: "pd_mock_004",
      },
      testContext,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.passed).toBe(true);
    expect(result.value.blockers).toHaveLength(0);
  });

  // 7. ReviewAgent(secretsFound=true) → passed=false + blocker 1건
  it("ReviewAgent가 시크릿 발견 시 passed=false와 blocker를 반환한다", async () => {
    const review = new ReviewAgent(makeConfig("review", "claude-sonnet-4-6"), baseDeps);
    const riskyChangeSet: CodegenOutput = {
      changeSetId: "cs_risky001",
      planRef: "plan_ref_002",
      stepRef: "s1",
      filesAdded: [{ path: "src/config.ts", content: "const API_KEY = 'sk-12345'" }],
      filesModified: [],
      securitySelfCheck: {
        secretsFound: true,
        injectionRisk: false,
        pathTraversalRisk: false,
      },
    };

    const result = await review.execute(
      {
        changeSet: riskyChangeSet,
        context: { runId: "run_7", sessionId: "s_7", userId: "u_7", trustMode: "semi-auto" },
        policyDecisionId: "pd_mock_005",
      },
      testContext,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.passed).toBe(false);
    expect(result.value.blockers.length).toBeGreaterThanOrEqual(1);
    expect(result.value.blockers[0].severity).toBe("critical");
  });

  // 8. ReviewOutput.qualityMetrics 기본값 존재 (Phase 1+2)
  it("ReviewOutput에 qualityMetrics 기본값이 포함되어 있다", async () => {
    const review = new ReviewAgent(makeConfig("review", "claude-sonnet-4-6"), baseDeps);
    const result = await review.execute(
      {
        changeSet: {
          changeSetId: "cs_qm001",
          planRef: "plan_ref_003",
          stepRef: "s1",
          filesAdded: [],
          filesModified: [],
          securitySelfCheck: { secretsFound: false, injectionRisk: false, pathTraversalRisk: false },
        },
        context: { runId: "run_8", sessionId: "s_8", userId: "u_8", trustMode: "semi-auto" },
        policyDecisionId: "pd_mock_006",
      },
      testContext,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const output: ReviewOutput = result.value;
    expect(output.qualityMetrics).toBeDefined();
    expect(output.qualityMetrics!.complexityScore).toBeGreaterThanOrEqual(0);
    expect(output.qualityMetrics!.maintainabilityScore).toBeGreaterThanOrEqual(0);
    expect(output.qualityMetrics!.testabilityScore).toBeGreaterThanOrEqual(0);
  });

  // 9. CodegenOutput → TestBuildInputSchema 매핑 후 검증 통과
  it("CodegenOutput과 ReviewOutput을 TestBuildInputSchema로 매핑하면 검증을 통과한다", async () => {
    const testBuildInput = {
      changeSetId: "cs_tb001",
      reviewId: "rev_tb001",
      context: { runId: "run_9", sessionId: "s_9", userId: "u_9", trustMode: "semi-auto" as const },
    };

    const parsed = TestBuildInputSchema.safeParse(testBuildInput);
    expect(parsed.success).toBe(true);
  });

  // 10. TestBuildAgent 스텁 출력의 suggestedTests 필드 존재 (Phase 1+2)
  it("TestBuildAgent 스텁 출력에 suggestedTests 필드가 존재한다", async () => {
    const testBuild = new TestBuildAgent(makeConfig("test", "claude-haiku-4-5-20251001"), baseDeps);
    const result = await testBuild.execute(
      {
        changeSetId: "cs_st001",
        reviewId: "rev_st001",
        context: { runId: "run_10", sessionId: "s_10", userId: "u_10", trustMode: "semi-auto" },
      },
      testContext,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const output: TestBuildOutput = result.value;
    expect(output).toHaveProperty("suggestedTests");
    expect(Array.isArray(output.suggestedTests)).toBe(true);

    // 출력이 TestBuildOutputSchema를 통과하는지 확인
    const parsed = TestBuildOutputSchema.safeParse(output);
    expect(parsed.success).toBe(true);
  });

  // 11. Spec→Planner→Codegen→Review→TestBuild 5-agent 체인 순차 실행 성공
  it("5-에이전트 체인 전체가 순차 실행되고 각 출력이 다음 입력으로 연결된다", async () => {
    // 1) Spec
    const spec = new SpecAgent(makeConfig("spec", "claude-haiku-4-5-20251001"), baseDeps);
    const specResult = await spec.execute(
      {
        rawInput: "사용자 인증 모듈 구현",
        context: { runId: "run_full", sessionId: "s_full", userId: "u_full", trustMode: "semi-auto" },
      },
      testContext,
    );
    expect(specResult.ok).toBe(true);
    if (!specResult.ok) return;
    const specOutput = specResult.value;

    // 2) Planner — Spec 출력 사용
    const planner = new PlannerAgent(makeConfig("planner", "claude-sonnet-4-6"), baseDeps);
    const planResult = await planner.execute(
      {
        specOutput,
        policyDecisionId: "pd_full_001",
        context: { runId: "run_full", sessionId: "s_full", userId: "u_full", trustMode: "semi-auto" },
      },
      testContext,
    );
    expect(planResult.ok).toBe(true);
    if (!planResult.ok) return;
    const planOutput = planResult.value;

    // 3) Codegen — Planner 출력의 첫 번째 step 사용
    const codegen = new CodegenAgent(makeConfig("codegen", "claude-sonnet-4-6"), baseDeps);
    const codeStep = planOutput.steps[0];
    const codegenResult = await codegen.execute(
      {
        planStep: { stepId: codeStep.stepId, description: codeStep.description, outputs: [] },
        specOutput,
        context: { runId: "run_full", sessionId: "s_full", userId: "u_full", trustMode: "semi-auto" },
      },
      testContext,
    );
    expect(codegenResult.ok).toBe(true);
    if (!codegenResult.ok) return;
    const codegenOutput = codegenResult.value;

    // 4) Review — Codegen 출력 사용
    const review = new ReviewAgent(makeConfig("review", "claude-sonnet-4-6"), baseDeps);
    const reviewResult = await review.execute(
      {
        changeSet: codegenOutput,
        context: { runId: "run_full", sessionId: "s_full", userId: "u_full", trustMode: "semi-auto" },
        policyDecisionId: "pd_full_001",
      },
      testContext,
    );
    expect(reviewResult.ok).toBe(true);
    if (!reviewResult.ok) return;
    const reviewOutput = reviewResult.value;

    // 5) TestBuild — Review 출력 사용
    const testBuild = new TestBuildAgent(makeConfig("test", "claude-haiku-4-5-20251001"), baseDeps);
    const testResult = await testBuild.execute(
      {
        changeSetId: codegenOutput.changeSetId,
        reviewId: reviewOutput.reviewId,
        context: { runId: "run_full", sessionId: "s_full", userId: "u_full", trustMode: "semi-auto" },
      },
      testContext,
    );
    expect(testResult.ok).toBe(true);
    if (!testResult.ok) return;

    // 전체 체인 성공 검증
    expect(specOutput.specId).toBeTruthy();
    expect(planOutput.planId).toBeTruthy();
    expect(codegenOutput.changeSetId).toBeTruthy();
    expect(reviewOutput.reviewId).toBeTruthy();
    expect(testResult.value.testRunId).toBeTruthy();
  });

  // 12. 각 에이전트의 logAudit 호출 확인
  it("5-에이전트 체인 실행 시 각 에이전트가 감사 로그를 기록한다", async () => {
    vi.clearAllMocks();

    // 1) Spec
    const spec = new SpecAgent(makeConfig("spec", "claude-haiku-4-5-20251001"), baseDeps);
    await spec.execute(
      {
        rawInput: "감사 로그 검증 테스트",
        context: { runId: "run_audit", sessionId: "s_audit", userId: "u_audit", trustMode: "semi-auto" },
      },
      testContext,
    );

    // 2) Planner
    const planner = new PlannerAgent(makeConfig("planner", "claude-sonnet-4-6"), baseDeps);
    await planner.execute(
      {
        specOutput: {
          specId: "spec_audit001",
          interpretation: "감사 테스트",
          intent: "CODE_IMPLEMENTATION",
          targets: ["test.ts"],
          requiresWebAccess: false,
          requiresLogin: false,
          clarifications: [],
          ambiguities: [],
        },
        policyDecisionId: "pd_audit_001",
        context: { runId: "run_audit", sessionId: "s_audit", userId: "u_audit", trustMode: "semi-auto" },
      },
      testContext,
    );

    // 3) Codegen
    const codegen = new CodegenAgent(makeConfig("codegen", "claude-sonnet-4-6"), baseDeps);
    await codegen.execute(
      {
        planStep: { stepId: "s1", description: "코드 생성", outputs: [] },
        specOutput: {
          specId: "spec_audit001",
          interpretation: "감사 테스트",
          intent: "CODE_IMPLEMENTATION",
          targets: ["test.ts"],
          requiresWebAccess: false,
          requiresLogin: false,
          clarifications: [],
          ambiguities: [],
        },
        context: { runId: "run_audit", sessionId: "s_audit", userId: "u_audit", trustMode: "semi-auto" },
      },
      testContext,
    );

    // 4) Review
    const review = new ReviewAgent(makeConfig("review", "claude-sonnet-4-6"), baseDeps);
    await review.execute(
      {
        changeSet: {
          changeSetId: "cs_audit001",
          planRef: "plan_ref_audit",
          stepRef: "s1",
          filesAdded: [],
          filesModified: [],
          securitySelfCheck: { secretsFound: false, injectionRisk: false, pathTraversalRisk: false },
        },
        context: { runId: "run_audit", sessionId: "s_audit", userId: "u_audit", trustMode: "semi-auto" },
        policyDecisionId: "pd_audit_001",
      },
      testContext,
    );

    // 5) TestBuild
    const testBuild = new TestBuildAgent(makeConfig("test", "claude-haiku-4-5-20251001"), baseDeps);
    await testBuild.execute(
      {
        changeSetId: "cs_audit001",
        reviewId: "rev_audit001",
        context: { runId: "run_audit", sessionId: "s_audit", userId: "u_audit", trustMode: "semi-auto" },
      },
      testContext,
    );

    // 5개 에이전트 각각 1번씩 감사 로그 기록 = 최소 5번
    expect(mockAuditRecord).toHaveBeenCalledTimes(5);
  });
});
