// Codegen 에이전트 — 코드 생성, ChangeSet 생성
import { randomUUID } from "node:crypto";
import type { Result, JarvisError, CapabilityToken } from "@jarvis/shared";
import { ok, err } from "@jarvis/shared";
import { BaseAgent } from "../base-agent.js";
import type { AgentExecutionContext } from "../types/agent-config.js";
import {
  CodegenInputSchema,
  CodegenOutputSchema,
  type CodegenInput,
  type CodegenOutput,
} from "../types/agent-io.js";

// Codegen 에이전트 시스템 프롬프트 — ChangeSet 생성 역할 정의
const CODEGEN_SYSTEM_PROMPT = `당신은 JARVIS Orchestration OS의 Codegen 에이전트입니다.
실행 계획의 CODE_GENERATE 단계를 수행하여 코드 변경 세트(ChangeSet)를 생성합니다.

## 절대 규칙
- 계약서(contract.md)가 모든 판단보다 우선합니다
- TypeScript strict mode 준수
- 시크릿/토큰 하드코딩 금지
- SQL/command injection 방지
- Path traversal 방지
- securitySelfCheck에서 위험 요소 정직하게 보고

## 응답 형식
반드시 다음 JSON 형식으로만 응답:
\`\`\`json
{
  "changeSetId": "cs_<8자리UUID>",
  "planRef": "<planId>",
  "stepRef": "<stepId>",
  "filesAdded": [{ "path": "...", "content": "..." }],
  "filesModified": [{ "path": "...", "diff": "..." }],
  "securitySelfCheck": { "secretsFound": false, "injectionRisk": false, "pathTraversalRisk": false }
}
\`\`\``;

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

    const { planStep, specOutput, existingCode } = validationResult.value;

    // 2. Claude API 호출 또는 스텁 폴백
    let output: CodegenOutput;

    if (this.deps.claudeClient) {
      // Phase 2: Claude API로 실제 ChangeSet 생성
      const existingCodeSummary = existingCode
        ? Object.entries(existingCode).map(([path, content]) => `파일: ${path}\n${content.slice(0, 500)}`).join("\n\n")
        : "기존 코드 없음";

      const userMessage = `단계 설명: ${planStep.description}\n의도: ${specOutput.intent}\n대상: ${specOutput.targets.join(", ")}\n\n기존 코드:\n${existingCodeSummary}`;

      const claudeResult = await this.callClaudeWithJson(
        CODEGEN_SYSTEM_PROMPT,
        userMessage,
        CodegenOutputSchema,
      );

      if (!claudeResult.ok) {
        // Claude 실패 시 스텁 폴백
        console.warn(`[CodegenAgent] Claude API 실패, 스텁 폴백: ${claudeResult.error.message}`);
        output = this.buildStubOutput(planStep.stepId, context.runId);
      } else {
        output = claudeResult.value;
      }
    } else {
      // claudeClient 미주입 — 스텁 폴백
      output = this.buildStubOutput(planStep.stepId, context.runId);
    }

    // 3. 감사 로그 기록
    const auditResult = await this.logAudit(
      context,
      `Codegen 실행: 단계=${planStep.stepId}, 의도=${specOutput.intent}`,
      "COMPLETED",
      {
        changeSetId: output.changeSetId,
        stepId: planStep.stepId,
        filesAdded: output.filesAdded.length,
        filesModified: output.filesModified.length,
        usedClaude: !!this.deps.claudeClient,
      },
    );
    if (!auditResult.ok) {
      console.warn(`[CodegenAgent] 감사 로그 기록 실패: ${auditResult.error.message}`);
    }

    return ok(output);
  }

  // 스텁 출력 생성 — Claude 미사용 시 플레이스홀더 ChangeSet 반환
  private buildStubOutput(stepId: string, runId: string): CodegenOutput {
    return {
      changeSetId: `cs_${randomUUID().slice(0, 8)}`,
      planRef: `plan_ref_${runId}`,
      stepRef: stepId,
      filesAdded: [],
      filesModified: [],
      securitySelfCheck: {
        secretsFound: false,
        injectionRisk: false,
        pathTraversalRisk: false,
      },
    };
  }
}
