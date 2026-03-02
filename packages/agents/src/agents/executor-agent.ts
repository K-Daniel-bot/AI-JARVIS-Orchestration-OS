// Executor 에이전트 — OS 조작, Action API 실행 (에이전트 관점)
import type { Result, JarvisError, CapabilityToken } from "@jarvis/shared";
import { ok, err, createError, generateActionId } from "@jarvis/shared";
import { BaseAgent } from "../base-agent.js";
import type { AgentExecutionContext } from "../types/agent-config.js";
import {
  ExecutorInputSchema,
  type ExecutorInput,
  type ExecutorOutput,
} from "../types/agent-io.js";

// Executor 에이전트 — Capability Token을 검증하고 OS 액션을 실행
// 주의: 이 에이전트만 OS 조작 권한을 가짐 (Single Execution Path 원칙)
export class ExecutorAgent extends BaseAgent {
  // 입력 검증 → Capability Token 검증 → 액션 실행(스텁) → 감사 로그 기록
  override async execute(
    input: unknown,
    context: AgentExecutionContext,
    capabilityToken?: CapabilityToken,
  ): Promise<Result<ExecutorOutput, JarvisError>> {
    // 1. 입력 검증
    const validationResult = this.validateInput<ExecutorInput>(
      input,
      ExecutorInputSchema,
    );
    if (!validationResult.ok) {
      return err(validationResult.error);
    }

    const { actionType, capabilityTokenId } = validationResult.value;

    // 2. Capability Token 존재 여부 확인 — 토큰 없이 OS 조작 불가
    if (capabilityToken === undefined) {
      await this.logAudit(
        context,
        `Executor 거부: Capability Token 누락 (action=${actionType})`,
        "DENIED",
        { actionType, capabilityTokenId },
      );
      return err(
        createError("CAPABILITY_EXPIRED", "Capability Token이 제공되지 않았습니다", {
          agentId: this.config.agentId,
          runId: context.runId,
          context: { actionType },
        }),
      );
    }

    // 3. Capability Token 상태 확인
    if (capabilityToken.status !== "ACTIVE") {
      await this.logAudit(
        context,
        `Executor 거부: Token 상태 비활성 (status=${capabilityToken.status})`,
        "DENIED",
        { tokenId: capabilityToken.tokenId, status: capabilityToken.status },
      );
      return err(
        createError("CAPABILITY_CONSUMED", `Capability Token 상태가 유효하지 않습니다: ${capabilityToken.status}`, {
          agentId: this.config.agentId,
          runId: context.runId,
          context: { tokenId: capabilityToken.tokenId },
        }),
      );
    }

    // 4. Phase 0 스텁 — 실제 OS 조작은 Phase 1에서 executor 패키지를 통해 수행
    const actionId = generateActionId();
    const startMs = Date.now();

    const output: ExecutorOutput = {
      actionId,
      actionType,
      status: "SUCCESS",
      output: {},
      durationMs: Date.now() - startMs,
    };

    // 5. 감사 로그 기록
    await this.logAudit(
      context,
      `Executor 실행: action=${actionType}, token=${capabilityToken.tokenId}`,
      "COMPLETED",
      { actionId, actionType, tokenId: capabilityToken.tokenId },
    );

    return ok(output);
  }
}
