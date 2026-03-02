/**
 * PolicyRiskAgent — 정책 판정 및 위험도 계산 에이전트
 * PolicyDecision을 생성하고 Capability Token 발급을 결정한다.
 * policy-engine 패키지를 사용하여 위험도를 5차원으로 평가한다.
 * Opus 4.6 모델을 사용한다.
 */

import { getAgentConfig } from '@jarvis/core';
import {
  createPolicyEngine,
  createTokenStore,
  issueToken,
} from '@jarvis/policy-engine';
import type {
  PolicyDecision,
  CapabilityToken,
  Result,
} from '@jarvis/shared';
import {
  JarvisError,
  ErrorCode,
  ok,
  err,
} from '@jarvis/shared';
import { BaseAgent } from './base-agent.js';
import type { AgentInput, AgentOutput } from './base-agent.js';
import type { SpecArtifact } from './spec-agent.js';

// ─────────────────────────────────────────
// PolicyRiskAgent 산출물 타입
// ─────────────────────────────────────────

/** PolicyRisk 에이전트 산출물 */
export interface PolicyRiskArtifact {
  /** 정책 판정 결과 */
  readonly decision: PolicyDecision;
  /** 발급된 Capability Token 목록 */
  readonly issuedTokens: readonly CapabilityToken[];
  /** 게이트 요구 목록 */
  readonly requiredGates: readonly string[];
  /** 정책 판정 요약 설명 */
  readonly humanExplanation: string;
}

// ─────────────────────────────────────────
// SPEC → PolicyRequest 변환 로직
// ─────────────────────────────────────────

/**
 * SpecArtifact를 PolicyRequest 형태의 데이터로 변환한다.
 */
function specToPolicyRequest(spec: SpecArtifact): {
  raw_input: string;
  intent: string;
  targets: readonly string[];
  requires_web_access: boolean;
  requires_login: boolean;
} {
  return {
    raw_input: spec.rawInput,
    intent: spec.intentType,
    targets: spec.targets,
    requires_web_access: spec.requiresWebAccess,
    requires_login: spec.requiresLogin,
  };
}

// ─────────────────────────────────────────
// PolicyRiskAgent 구현
// ─────────────────────────────────────────

/**
 * PolicyRiskAgent — 정책 판정, 위험도 계산, Capability Token 발급.
 * 계약서 §2: 모든 OS 조작은 Capability Token이 있는 경우에만 실행 가능.
 */
export class PolicyRiskAgent extends BaseAgent {
  /** policy-engine 인스턴스 */
  private readonly policyEngine: ReturnType<typeof createPolicyEngine>;
  /** 토큰 저장소 */
  private readonly tokenStore: ReturnType<typeof createTokenStore>;

  constructor() {
    const config = getAgentConfig('policy-risk');
    if (config === undefined) {
      throw new Error('policy-risk 에이전트 설정을 찾을 수 없습니다');
    }
    super(config);
    this.policyEngine = createPolicyEngine();
    this.tokenStore = createTokenStore();
  }

  /**
   * PolicyRiskAgent를 기본 설정으로 생성한다.
   */
  static create(): PolicyRiskAgent {
    return new PolicyRiskAgent();
  }

  /**
   * SPEC을 분석하여 PolicyDecision을 생성하고 Capability Token을 발급한다.
   * 1. SpecArtifact에서 PolicyRequest 구성
   * 2. policy-engine으로 PolicyDecision 생성
   * 3. DENY 시 즉시 에러 반환
   * 4. ALLOW/CONSTRAINED_ALLOW 시 Capability Token 발급
   */
  async execute(
    input: AgentInput,
  ): Promise<Result<AgentOutput, JarvisError>> {
    this.logAudit({
      runId: input.runId,
      action: '정책 판정 시작',
      result: 'STARTED',
    });

    // 컨텍스트에서 SpecArtifact 추출
    const specData = input.context['spec'] as SpecArtifact | undefined;
    if (specData === undefined) {
      return err(
        new JarvisError({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'PolicyRiskAgent: 컨텍스트에 SPEC 데이터가 없습니다',
          context: { runId: input.runId },
        }),
      );
    }

    // PolicyRequest 구성
    const policyRequest = specToPolicyRequest(specData);

    // PolicySubject 구성 (컨텍스트에서 추출)
    const userId = (input.context['userId'] as string | undefined) ?? 'unknown';
    const sessionId = input.sessionId;

    const policySubject = {
      user_id: userId,
      role: 'User' as const,
      device: 'desktop',
      session_id: sessionId,
    };

    // Claude로 추가 위험 분석
    const claudeResult = await this.callClaude({
      systemPrompt: this.buildSystemPrompt(),
      userMessage: `다음 요청의 위험도를 분석하십시오:\n${JSON.stringify(policyRequest, null, 2)}`,
      maxTokens: 1024,
    });

    if (!claudeResult.ok) {
      return err(claudeResult.error);
    }

    // policy-engine으로 PolicyDecision 생성
    const decisionResult = await this.policyEngine.evaluate(
      policyRequest,
      policySubject,
    );

    if (!decisionResult.ok) {
      return err(decisionResult.error);
    }

    const decision = decisionResult.value;

    // DENY 상태 처리 — 에러 반환
    if (decision.outcome.status === 'DENY') {
      this.logAudit({
        runId: input.runId,
        action: `정책 거부: ${decision.outcome.reason_codes.join(', ')}`,
        result: 'DENIED',
      });

      return err(
        new JarvisError({
          code: ErrorCode.POLICY_DENIED,
          message: `정책 거부: ${decision.outcome.human_explanation}`,
          context: {
            decisionId: decision.decision_id,
            reasonCodes: decision.outcome.reason_codes,
          },
        }),
      );
    }

    // Capability Token 발급
    const issuedTokens: CapabilityToken[] = [];
    for (const grant of decision.required_capabilities) {
      const token = issueToken({
        grant,
        context: {
          session_id: sessionId,
          run_id: input.runId,
          policy_decision_id: decision.decision_id,
          trust_mode: 'suggest',
        },
        approvedBy:
          decision.outcome.status === 'ALLOW' ? 'auto' : 'pending-gate',
      });
      this.tokenStore.save(token);
      issuedTokens.push(token);
    }

    const artifact: PolicyRiskArtifact = {
      decision,
      issuedTokens,
      requiredGates: decision.outcome.requires_gates,
      humanExplanation: decision.outcome.human_explanation,
    };

    this.logAudit({
      runId: input.runId,
      action: `정책 판정 완료: ${decision.outcome.status}, 위험도=${decision.outcome.risk_score}`,
      result: 'SUCCESS',
    });

    return ok({
      artifactType: 'POLICY_DECISION',
      artifactRef: decision.decision_id,
      summary: `${decision.outcome.status} — ${decision.outcome.human_explanation}`,
      data: artifact,
      metadata: {
        status: decision.outcome.status,
        riskScore: decision.outcome.risk_score,
        riskLevel: decision.outcome.risk_level,
        tokenCount: issuedTokens.length,
        gateCount: artifact.requiredGates.length,
      },
    });
  }

  /** 토큰 저장소 접근자 — 다른 에이전트가 토큰을 검증할 때 사용 */
  getTokenStore(): ReturnType<typeof createTokenStore> {
    return this.tokenStore;
  }

  /** PolicyRiskAgent 시스템 프롬프트 생성 */
  private buildSystemPrompt(): string {
    return `당신은 JARVIS OS의 Policy & Risk 에이전트입니다.
사용자 요청의 위험도를 5차원으로 평가합니다:
1. 금융 위험 (financial)
2. 시스템 영향도 (systemImpact)
3. 관리자 권한 (adminPrivilege)
4. 외부 네트워크 (externalNetwork)
5. 데이터 민감도 (dataSensitivity)

계약서 §1 절대 금지사항:
- OS 시스템 파일 접근 금지
- 금융/결제 영역 자동화 금지
- 관리자 권한 자동 실행 금지`;
  }
}
