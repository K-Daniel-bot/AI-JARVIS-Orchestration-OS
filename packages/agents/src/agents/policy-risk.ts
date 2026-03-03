// Policy Risk 에이전트 — 정책 판정, 위험도 산출, Capability Token 결정
// Opus Extended Thinking을 통한 심층 보안 분석 지원
import { z } from "zod";
import type { Result, JarvisError, CapabilityToken } from "@jarvis/shared";
import { ok, err, createError } from "@jarvis/shared";
import { BaseAgent } from "../base-agent.js";
import type { AgentExecutionContext } from "../types/agent-config.js";
import {
  PolicyRiskInputSchema,
  type PolicyRiskInput,
  type PolicyRiskOutput,
} from "../types/agent-io.js";

// ─── 시스템 프롬프트 ────────────────────────────────────────────────────────────

// Opus Extended Thinking 심층 분석용 시스템 프롬프트
const POLICY_RISK_SYSTEM_PROMPT = `당신은 JARVIS OS의 보안/정책 분석 전문가(Opus)입니다.
정책 엔진의 판정 결과를 심층 분석하고 다음을 수행합니다:

1. 미묘한 보안 이슈 포착 (async 버그, dispose 누락, race condition)
2. 위험도 조정 제안 (정책 엔진이 놓칠 수 있는 컨텍스트 기반 위험)
3. 추가 Capability 요구사항 식별

## 응답 형식
반드시 다음 JSON 형식으로만 응답:
\`\`\`json
{
  "deepAnalysis": "심층 분석 결과 설명",
  "adjustedRiskScore": 0,
  "additionalCapabilities": [],
  "reasoning": "조정 근거"
}
\`\`\`

중요: adjustedRiskScore는 원래 riskScore보다 같거나 높아야 합니다 (보안 원칙: 하향 불가).`;

// ─── Deep Analysis 응답 스키마 ─────────────────────────────────────────────────

// Opus 심층 분석 응답 파싱용 Zod 스키마
const DeepAnalysisResponseSchema = z.object({
  deepAnalysis: z.string(),
  adjustedRiskScore: z.number().min(0).max(100),
  additionalCapabilities: z.array(z.string()),
  reasoning: z.string(),
});

// DeepAnalysisResponse 타입 추론
type DeepAnalysisResponse = z.infer<typeof DeepAnalysisResponseSchema>;

// ─── PolicyRiskAgent ────────────────────────────────────────────────────────────

// Policy Risk 에이전트 — 정책 엔진 호출 후 선택적으로 Opus 심층 분석 수행
export class PolicyRiskAgent extends BaseAgent {
  // 입력 검증 → 정책 엔진 호출 → (선택) Opus 심층 분석 → 결과 변환 → 감사 로그 기록
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
      const denyLogResult = await this.logAudit(
        context,
        `정책 거부: ${decision.outcome.humanExplanation}`,
        "DENIED",
        { decisionId: decision.decisionId, riskLevel: decision.outcome.riskLevel },
      );
      if (!denyLogResult.ok) {
        console.warn(`[PolicyRisk] 거부 감사 로그 기록 실패: ${denyLogResult.error.code}`);
      }
      return err(
        createError("POLICY_DENIED", decision.outcome.humanExplanation, {
          agentId: this.config.agentId,
          runId: context.runId,
          context: { decisionId: decision.decisionId },
        }),
      );
    }

    // 4. Opus Extended Thinking 심층 분석 — claudeClient 주입 시에만 수행
    const deepAnalysisResult = await this.performDeepAnalysis(
      specOutput.interpretation,
      decision.outcome.riskScore,
      decision.outcome.status,
      decision.outcome.humanExplanation,
    );

    // 5. 위험도 조정 — Opus 제안이 원래 점수 이상인 경우에만 반영 (하향 불가 원칙)
    const finalRiskScore = this.resolveAdjustedRiskScore(
      decision.outcome.riskScore,
      deepAnalysisResult,
    );

    // 6. PolicyDecision → PolicyRiskOutput 변환
    const output: PolicyRiskOutput = {
      decisionId: decision.decisionId,
      status: decision.outcome.status,
      riskScore: finalRiskScore,
      riskLevel: decision.outcome.riskLevel,
      requiresGates: [...decision.outcome.requiresGates],
      requiredCapabilities: decision.requiredCapabilities.map((c) => c.cap),
      humanExplanation: decision.outcome.humanExplanation,
      deepAnalysis: deepAnalysisResult?.deepAnalysis,
      adjustedRiskScore: deepAnalysisResult?.adjustedRiskScore,
    };

    // 7. 감사 로그 기록
    const completeLogResult = await this.logAudit(
      context,
      `정책 판정 완료: ${decision.outcome.status} (위험도=${decision.outcome.riskLevel})`,
      "COMPLETED",
      {
        decisionId: decision.decisionId,
        riskScore: finalRiskScore,
        deepAnalysisPerformed: deepAnalysisResult !== null,
      },
    );
    if (!completeLogResult.ok) {
      console.warn(`[PolicyRisk] 완료 감사 로그 기록 실패: ${completeLogResult.error.code}`);
    }

    return ok(output);
  }

  // Opus Extended Thinking 심층 분석 수행 — claudeClient 없으면 null 반환 (하위 호환)
  private async performDeepAnalysis(
    interpretation: string,
    riskScore: number,
    status: string,
    humanExplanation: string,
  ): Promise<DeepAnalysisResponse | null> {
    // claudeClient 미주입 시 기존 동작 유지 (하위 호환)
    if (!this.deps.claudeClient) {
      return null;
    }

    // Opus에게 전달할 분석 요청 메시지 구성
    const userMessage = [
      `## 정책 엔진 판정 결과`,
      `- 해석된 의도: ${interpretation}`,
      `- 판정 상태: ${status}`,
      `- 위험도 점수: ${riskScore}/100`,
      `- 판정 근거: ${humanExplanation}`,
      ``,
      `위 판정 결과를 심층 분석하여 미묘한 보안 이슈, 위험도 조정 필요성, 추가 Capability 요구사항을 식별하세요.`,
    ].join("\n");

    // Extended Thinking + Prompt Caching 으로 심층 분석 호출
    const analysisResult = await this.callClaudeWithJson(
      POLICY_RISK_SYSTEM_PROMPT,
      userMessage,
      DeepAnalysisResponseSchema,
      {
        thinking: { type: "adaptive" },
        cacheControl: true,
      },
    );

    if (!analysisResult.ok) {
      // 심층 분석 실패는 치명적 오류가 아님 — 경고 후 null 반환
      console.warn(`[PolicyRisk] Opus 심층 분석 실패: ${analysisResult.error.code} — 기본 판정 결과 사용`);
      return null;
    }

    return analysisResult.value;
  }

  // 조정된 위험도 점수 결정 — Opus 제안이 원래 점수 이상인 경우에만 반영
  private resolveAdjustedRiskScore(
    originalScore: number,
    deepAnalysis: DeepAnalysisResponse | null,
  ): number {
    if (deepAnalysis === null) {
      return originalScore;
    }

    // 보안 원칙: 위험도 하향 불가 — 원래 점수 이상만 반영
    if (deepAnalysis.adjustedRiskScore >= originalScore) {
      return deepAnalysis.adjustedRiskScore;
    }

    // Opus가 원래보다 낮은 점수를 제안한 경우 원래 점수 유지
    console.warn(
      `[PolicyRisk] Opus 위험도 하향 제안 거부: ${deepAnalysis.adjustedRiskScore} < ${originalScore} — 원래 점수 유지`,
    );
    return originalScore;
  }
}
