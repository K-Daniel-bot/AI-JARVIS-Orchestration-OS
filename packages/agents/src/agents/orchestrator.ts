// Orchestrator 에이전트 — 흐름 제어, 복잡도 분류, 파이프라인 조율
import type { Result, JarvisError, CapabilityToken } from "@jarvis/shared";
import { ok, err, generateRunId } from "@jarvis/shared";
import { BaseAgent } from "../base-agent.js";
import type { AgentExecutionContext } from "../types/agent-config.js";
import {
  OrchestratorInputSchema,
  type OrchestratorInput,
  type OrchestratorOutput,
} from "../types/agent-io.js";

// Orchestrator 에이전트 — 사용자 입력을 수신하고 파이프라인 흐름을 결정
export class OrchestratorAgent extends BaseAgent {
  // 입력 검증 → 복잡도 분류 → 파이프라인 결정 → 감사 로그 기록
  override async execute(
    input: unknown,
    context: AgentExecutionContext,
    _capabilityToken?: CapabilityToken,
  ): Promise<Result<OrchestratorOutput, JarvisError>> {
    // 1. 입력 검증
    const validationResult = this.validateInput<OrchestratorInput>(
      input,
      OrchestratorInputSchema,
    );
    if (!validationResult.ok) {
      return err(validationResult.error);
    }

    const { rawInput } = validationResult.value;

    // 2. Phase 0 스텁 — 복잡도 분류 (실제 Claude API 호출은 Phase 1에서 구현)
    const complexity = this.classifyComplexity(rawInput);
    const recommendedPipeline = this.buildPipeline(complexity);
    const runId = generateRunId();

    const output: OrchestratorOutput = {
      complexity,
      recommendedPipeline,
      specRef: `spec_pending_${runId}`,
      runId,
    };

    // 3. 감사 로그 기록
    const logResult = await this.logAudit(
      context,
      `Orchestrator 실행: 복잡도=${complexity}`,
      "COMPLETED",
      { rawInput: rawInput.slice(0, 200) },
    );
    if (!logResult.ok) {
      // 감사 로그 실패는 경고로 처리하고 계속 진행
      return ok(output);
    }

    return ok(output);
  }

  // 입력 길이와 키워드 기반 복잡도 분류 — Phase 0 휴리스틱
  private classifyComplexity(
    input: string,
  ): "simple" | "moderate" | "complex" {
    const lower = input.toLowerCase();
    const complexKeywords = ["deploy", "migration", "architecture", "refactor", "system"];
    const moderateKeywords = ["implement", "create", "add feature", "modify", "update"];

    if (complexKeywords.some((kw) => lower.includes(kw)) || input.length > 500) {
      return "complex";
    }
    if (moderateKeywords.some((kw) => lower.includes(kw)) || input.length > 100) {
      return "moderate";
    }
    return "simple";
  }

  // 복잡도에 따른 에이전트 파이프라인 구성
  private buildPipeline(complexity: "simple" | "moderate" | "complex"): string[] {
    const base = ["spec-agent", "policy-risk", "planner"];

    if (complexity === "simple") {
      return [...base, "codegen", "review", "test-build", "executor"];
    }
    if (complexity === "moderate") {
      return [...base, "codegen", "review", "test-build", "executor"];
    }
    // complex: 모든 에이전트 포함
    return [...base, "codegen", "review", "test-build", "executor", "rollback"];
  }
}
