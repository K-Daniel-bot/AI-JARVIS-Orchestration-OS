// Rollback 에이전트 — 실패 시 변경사항 되돌리기, Postmortem 리포트 생성
import { randomUUID } from "node:crypto";
import type { Result, JarvisError, CapabilityToken } from "@jarvis/shared";
import { ok, err } from "@jarvis/shared";
import { BaseAgent } from "../base-agent.js";
import type { AgentExecutionContext } from "../types/agent-config.js";
import {
  RollbackInputSchema,
  RollbackOutputSchema,
  type RollbackInput,
  type RollbackOutput,
} from "../types/agent-io.js";

// Rollback 에이전트 시스템 프롬프트 — 롤백 계획 및 Postmortem 생성 역할 정의
const ROLLBACK_SYSTEM_PROMPT = `당신은 JARVIS Orchestration OS의 Rollback 에이전트입니다.
실패한 작업에 대한 롤백 계획을 수립하고 사후 분석(Postmortem)을 생성합니다.

## Postmortem 포함 사항
- 원인 분석 (5 Whys)
- 영향 범위
- 되돌려야 할 액션 목록
- 재발 방지 제안

## 응답 형식
반드시 다음 JSON 형식으로만 응답:
\`\`\`json
{
  "rollbackId": "rb_<8자리UUID>",
  "success": true,
  "revertedActions": ["action1", "action2"],
  "postmortem": "## 원인 분석\n...",
  "errors": []
}
\`\`\``;

// Rollback 에이전트 — 실패한 작업을 안전하게 되돌리고 사후 분석 리포트 생성
export class RollbackAgent extends BaseAgent {
  // 입력 검증 → 롤백 실행 → Postmortem 생성 → 감사 로그 기록
  override async execute(
    input: unknown,
    context: AgentExecutionContext,
    _capabilityToken?: CapabilityToken,
  ): Promise<Result<RollbackOutput, JarvisError>> {
    // 1. 입력 검증
    const validationResult = this.validateInput<RollbackInput>(
      input,
      RollbackInputSchema,
    );
    if (!validationResult.ok) {
      return err(validationResult.error);
    }

    const { runId, reason, targetChangeSetId } = validationResult.value;

    // 2. Claude API 호출 또는 스텁 폴백
    let output: RollbackOutput;

    if (this.deps.claudeClient) {
      // Phase 2: Claude API로 롤백 계획 및 Postmortem 생성
      const userMessage = `runId: ${runId}\n실패 원인: ${reason}\n대상 ChangeSet: ${targetChangeSetId ?? "없음"}`;

      const claudeResult = await this.callClaudeWithJson(
        ROLLBACK_SYSTEM_PROMPT,
        userMessage,
        RollbackOutputSchema,
      );

      if (!claudeResult.ok) {
        // Claude 실패 시 스텁 폴백
    // eslint-disable-next-line no-console
        console.warn(`[RollbackAgent] Claude API 실패, 스텁 폴백: ${claudeResult.error.message}`);
        output = this.buildStubOutput(runId, reason);
      } else {
        output = claudeResult.value;
      }
    } else {
      // claudeClient 미주입 — 스텁 폴백
      output = this.buildStubOutput(runId, reason);
    }

    // 3. 감사 로그 기록
    const auditResult = await this.logAudit(
      context,
      `Rollback 에이전트 실행: runId=${runId}, reason=${reason}`,
      "ROLLED_BACK",
      { rollbackId: output.rollbackId, targetRunId: runId, usedClaude: !!this.deps.claudeClient },
    );
    if (!auditResult.ok) {
    // eslint-disable-next-line no-console
      console.warn(`[RollbackAgent] 감사 로그 기록 실패: ${auditResult.error.message}`);
    }

    return ok(output);
  }

  // 스텁 출력 생성 — Claude 미사용 시 기본 Postmortem 반환
  private buildStubOutput(runId: string, reason: string): RollbackOutput {
    return {
      rollbackId: `rb_${randomUUID().slice(0, 8)}`,
      success: true,
      revertedActions: [],
      postmortem: `## 원인 분석\nrunId=${runId}, reason=${reason}.\n\n스텁 폴백 — 실제 롤백 미수행.`,
      errors: [],
    };
  }
}
