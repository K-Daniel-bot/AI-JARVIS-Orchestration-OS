// Policy Risk 에이전트 — 정책 판정, 위험도 산출, Capability Token 결정
import type { Result, JarvisError, CapabilityToken } from "@jarvis/shared";
import { ok, err, createError } from "@jarvis/shared";
import { BaseAgent } from "../base-agent.js";
import type { AgentExecutionContext } from "../types/agent-config.js";
import {
  PolicyRiskInputSchema,
  type PolicyRiskInput,
  type PolicyRiskOutput,
} from "../types/agent-io.js";

// Policy Risk 에이전트 — 정책 엔진을 호출해 판정 결과 반환
export class PolicyRiskAgent extends BaseAgent {
  // 입력 검증 → 정책 엔진 호출 → 결과 변환 → 감사 로그 기록
  override async execute(
    input: unknown,
    context: AgentExecutionContext,
    _capabilityToken?: CapabilityToken,
  ): Promise<Result<PolicyRiskOutput, JarvisError>> {
    // 1. 입력 검증
    const validationResult = this.validateInput<PolicyRiskInput>(
      input,
      PolicyRiskInputSchema,
    );
    if (!validationResult.ok) {
      return err(validationResult.error);
    }

    const { specOutput, subject } = validationResult.value;

    // 2. 정책 엔진 호출
    const policyResult = this.deps.policyEngine.evaluate(
      {
        userId: subject.userId,
        role: subject.role,
        device: subject.device,
        sessionId: subject.sessionId,
      },
      {
        rawInput: specOutput.interpretation,
        intent: specOutput.intent,
        targets: specOutput.targets,
        requiresWebAccess: specOutput.requiresWebAccess,
        requiresLogin: specOutput.requiresLogin,
      },
    );

    if (!policyResult.ok) {
      return err(policyResult.error);
    }

    const decision = policyResult.value;

    // 3. DENY 판정 시 즉시 에러 반환
    if (decision.outcome.status === "DENY") {
      await this.logAudit(
        context,
        `정책 거부: ${decision.outcome.humanExplanation}`,
        "DENIED",
        { decisionId: decision.decisionId, riskLevel: decision.outcome.riskLevel },
      );
      return err(
        createError("POLICY_DENIED", decision.outcome.humanExplanation, {
          agentId: this.config.agentId,
          runId: context.runId,
          context: { decisionId: decision.decisionId },
        }),
      );
    }

    // 4. PolicyDecision → PolicyRiskOutput 변환
    const output: PolicyRiskOutput = {
      decisionId: decision.decisionId,
      status: decision.outcome.status,
      riskScore: decision.outcome.riskScore,
      riskLevel: decision.outcome.riskLevel,
      requiresGates: [...decision.outcome.requiresGates],
      requiredCapabilities: decision.requiredCapabilities.map((c) => c.cap),
      humanExplanation: decision.outcome.humanExplanation,
    };

    // 5. 감사 로그 기록
    await this.logAudit(
      context,
      `정책 판정 완료: ${decision.outcome.status} (위험도=${decision.outcome.riskLevel})`,
      "COMPLETED",
      { decisionId: decision.decisionId, riskScore: decision.outcome.riskScore },
    );

    return ok(output);
  }
}
