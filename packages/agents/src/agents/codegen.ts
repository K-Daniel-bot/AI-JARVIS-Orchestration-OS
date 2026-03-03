// Codegen 에이전트 — 코드 생성, ChangeSet 생성
import { randomUUID } from "node:crypto";
import type { Result, JarvisError, CapabilityToken } from "@jarvis/shared";
import { ok, err } from "@jarvis/shared";
import { BaseAgent } from "../base-agent.js";
import type { AgentExecutionContext } from "../types/agent-config.js";
import {
  CodegenInputSchema,
  type CodegenInput,
  type CodegenOutput,
} from "../types/agent-io.js";

// Codegen 에이전트 — 실행 계획 단계를 기반으로 코드 변경 세트 생성
export class CodegenAgent extends BaseAgent {
  // 입력 검증 → 보안 자가 검사 → ChangeSet 생성 → 감사 로그 기록
  override async execute(
    input: unknown,
    context: AgentExecutionContext,
    _capabilityToken?: CapabilityToken,
  ): Promise<Result<CodegenOutput, JarvisError>> {
    // 1. 입력 검증
    const validationResult = this.validateInput<CodegenInput>(
      input,
      CodegenInputSchema,
    );
    if (!validationResult.ok) {
      return err(validationResult.error);
    }

    const { planStep, specOutput } = validationResult.value;

    // 2. Phase 0 스텁 — 플레이스홀더 ChangeSet 생성
    // Phase 1에서 실제 Claude API를 호출하여 코드를 생성
    const changeSetId = `cs_${randomUUID().slice(0, 8)}`;

    const output: CodegenOutput = {
      changeSetId,
      planRef: `plan_ref_${context.runId}`,
      stepRef: planStep.stepId,
      filesAdded: [],
      filesModified: [],
      securitySelfCheck: {
        secretsFound: false,
        injectionRisk: false,
        pathTraversalRisk: false,
      },
    };

    // 3. 감사 로그 기록
    const auditResult = await this.logAudit(
      context,
      `Codegen 실행: 단계=${planStep.stepId}, 의도=${specOutput.intent}`,
      "COMPLETED",
      {
        changeSetId,
        stepId: planStep.stepId,
        filesAdded: output.filesAdded.length,
        filesModified: output.filesModified.length,
      },
    );
    if (!auditResult.ok) {
      console.warn(`[CodegenAgent] 감사 로그 기록 실패: ${auditResult.error.message}`);
    }

    return ok(output);
  }
}
