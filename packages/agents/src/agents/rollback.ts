// Rollback 에이전트 — 실패 시 변경사항 되돌리기, Postmortem 리포트 생성
import { randomUUID } from "node:crypto";
import type { Result, JarvisError, CapabilityToken } from "@jarvis/shared";
import { ok, err } from "@jarvis/shared";
import { BaseAgent } from "../base-agent.js";
import type { AgentExecutionContext } from "../types/agent-config.js";
import {
  RollbackInputSchema,
  type RollbackInput,
  type RollbackOutput,
} from "../types/agent-io.js";

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

    const { runId, reason } = validationResult.value;

    // 2. Phase 0 스텁 — 실제 롤백 로직은 Phase 1에서 구현
    const rollbackId = `rb_${randomUUID().slice(0, 8)}`;

    const output: RollbackOutput = {
      rollbackId,
      success: true,
      revertedActions: [],
      postmortem: `[Postmortem] runId=${runId}, reason=${reason}. Phase 0 스텁 — 실제 롤백 미수행.`,
      errors: [],
    };

    // 3. 감사 로그 기록
    await this.logAudit(
      context,
      `Rollback 에이전트 실행: runId=${runId}, reason=${reason}`,
      "ROLLED_BACK",
      { rollbackId, targetRunId: runId },
    );

    return ok(output);
  }
}
