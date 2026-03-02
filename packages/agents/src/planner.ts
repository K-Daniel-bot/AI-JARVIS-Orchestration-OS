/**
 * PlannerAgent — 작업 분해 및 실행 계획 생성 에이전트
 * WBS 작업 분해, Task DAG 생성, 예산 계산, 게이트 요구사항 식별을 담당한다.
 * Sonnet 4.6 모델을 사용한다.
 */

import { getAgentConfig } from '@jarvis/core';
import type { Result } from '@jarvis/shared';
import {
  JarvisError,
  ErrorCode,
  ok,
  err,
  generatePlanId,
} from '@jarvis/shared';
import { BaseAgent } from './base-agent.js';
import type { AgentInput, AgentOutput } from './base-agent.js';
import type { SpecArtifact } from './spec-agent.js';
import type { PolicyRiskArtifact } from './policy-risk.js';

// ─────────────────────────────────────────
// Plan 산출물 타입
// ─────────────────────────────────────────

/** 계획 단계 유형 */
export type PlanStepType =
  | 'CODE_GENERATE'
  | 'FILE_READ'
  | 'FILE_WRITE'
  | 'EXEC_RUN'
  | 'REVIEW'
  | 'TEST'
  | 'DEPLOY';

/** 계획 단계 — WBS의 개별 태스크 */
export interface PlanStep {
  /** 단계 ID */
  readonly stepId: string;
  /** 단계 유형 */
  readonly type: PlanStepType;
  /** 단계 설명 */
  readonly description: string;
  /** 입력 참조 목록 */
  readonly inputs: readonly string[];
  /** 출력 파일/아티팩트 목록 */
  readonly outputs: readonly string[];
  /** 의존 단계 ID 목록 */
  readonly dependsOn: readonly string[];
  /** 단계별 제약 조건 */
  readonly constraints: {
    readonly writeAllow: readonly string[];
    readonly packagesAllowed: readonly string[];
  };
  /** 예상 소요 토큰 수 */
  readonly estimatedTokens: number;
}

/** 예산 계획 */
export interface BudgetPlan {
  /** 최대 토큰 수 */
  readonly maxTokens: number;
  /** 최대 단계 수 */
  readonly maxSteps: number;
  /** 예상 총 비용 (단위: 토큰) */
  readonly estimatedTotalTokens: number;
}

/** PLAN 산출물 */
export interface PlanArtifact {
  /** 계획 고유 ID */
  readonly planId: string;
  /** 관련 SPEC ID */
  readonly specRef: string;
  /** 관련 PolicyDecision ID */
  readonly policyRef: string;
  /** 계획 단계 목록 (WBS) */
  readonly steps: readonly PlanStep[];
  /** 예산 계획 */
  readonly budget: BudgetPlan;
  /** 필요한 외부 패키지 목록 */
  readonly toolRequests: readonly string[];
  /** 게이트 요구 목록 */
  readonly requiredGates: readonly string[];
}

// ─────────────────────────────────────────
// WBS 생성 로직
// ─────────────────────────────────────────

/** 단계 ID 카운터 */
let stepCounter = 0;

/** 순차 단계 ID 생성 */
function makeStepId(prefix: string): string {
  stepCounter = (stepCounter + 1) % 10000;
  return `${prefix}_s${String(stepCounter).padStart(3, '0')}`;
}

/**
 * SpecArtifact와 PolicyDecision을 기반으로 WBS 단계를 생성한다.
 */
function buildWbsSteps(
  spec: SpecArtifact,
  policy: PolicyRiskArtifact,
  planId: string,
): readonly PlanStep[] {
  const steps: PlanStep[] = [];
  const { intentType } = spec;
  const writeAllowPaths = policy.decision.constraints.fs.write_allow;

  // 코드 구현 의도인 경우 CODE_GENERATE 단계 추가
  if (intentType === 'CODE_IMPLEMENTATION') {
    const codeStepId = makeStepId(planId);
    steps.push({
      stepId: codeStepId,
      type: 'CODE_GENERATE',
      description: `코드 생성: ${spec.interpretedIntent.slice(0, 60)}`,
      inputs: [spec.specId, policy.decision.decision_id],
      outputs: spec.targets.length > 0 ? spec.targets : ['src/output.ts'],
      dependsOn: [],
      constraints: {
        writeAllow: writeAllowPaths.length > 0 ? writeAllowPaths : ['/project/src/**'],
        packagesAllowed: policy.decision.constraints.exec.allow,
      },
      estimatedTokens: 2048,
    });

    // 코드 리뷰 단계
    const reviewStepId = makeStepId(planId);
    steps.push({
      stepId: reviewStepId,
      type: 'REVIEW',
      description: '생성된 코드 보안/품질 검토',
      inputs: [codeStepId],
      outputs: [`review_${codeStepId}`],
      dependsOn: [codeStepId],
      constraints: {
        writeAllow: [],
        packagesAllowed: [],
      },
      estimatedTokens: 1024,
    });

    // 테스트 단계
    const testStepId = makeStepId(planId);
    steps.push({
      stepId: testStepId,
      type: 'TEST',
      description: '단위 테스트 실행',
      inputs: [reviewStepId],
      outputs: [`test_report_${testStepId}`],
      dependsOn: [reviewStepId],
      constraints: {
        writeAllow: [],
        packagesAllowed: ['vitest'],
      },
      estimatedTokens: 512,
    });

    return steps;
  }

  // 파일 작업 의도인 경우
  if (intentType === 'FILE_OPERATION') {
    const readStepId = makeStepId(planId);
    steps.push({
      stepId: readStepId,
      type: 'FILE_READ',
      description: '대상 파일 읽기',
      inputs: spec.targets,
      outputs: [`content_${readStepId}`],
      dependsOn: [],
      constraints: {
        writeAllow: [],
        packagesAllowed: [],
      },
      estimatedTokens: 256,
    });

    const writeStepId = makeStepId(planId);
    steps.push({
      stepId: writeStepId,
      type: 'FILE_WRITE',
      description: '파일 작업 수행',
      inputs: [readStepId],
      outputs: spec.targets,
      dependsOn: [readStepId],
      constraints: {
        writeAllow: writeAllowPaths.length > 0 ? writeAllowPaths : [],
        packagesAllowed: [],
      },
      estimatedTokens: 256,
    });

    return steps;
  }

  // 기본 단계 — 단순 실행
  const defaultStepId = makeStepId(planId);
  steps.push({
    stepId: defaultStepId,
    type: 'EXEC_RUN',
    description: spec.interpretedIntent.slice(0, 80),
    inputs: [spec.specId],
    outputs: [],
    dependsOn: [],
    constraints: {
      writeAllow: writeAllowPaths,
      packagesAllowed: policy.decision.constraints.exec.allow,
    },
    estimatedTokens: 512,
  });

  return steps;
}

/**
 * 단계 목록을 기반으로 예산 계획을 산출한다.
 */
function calculateBudget(steps: readonly PlanStep[]): BudgetPlan {
  const totalTokens = steps.reduce((sum, s) => sum + s.estimatedTokens, 0);
  return {
    maxTokens: Math.max(totalTokens * 2, 8192),
    maxSteps: steps.length + 5, // 여유 단계 포함
    estimatedTotalTokens: totalTokens,
  };
}

// ─────────────────────────────────────────
// PlannerAgent 구현
// ─────────────────────────────────────────

/**
 * PlannerAgent — WBS 작업 분해 및 Task DAG 생성 에이전트.
 */
export class PlannerAgent extends BaseAgent {
  /**
   * PlannerAgent를 기본 설정으로 생성한다.
   */
  static create(): PlannerAgent {
    const config = getAgentConfig('planner');
    if (config === undefined) {
      throw new Error('planner 에이전트 설정을 찾을 수 없습니다');
    }
    return new PlannerAgent(config);
  }

  /**
   * SPEC과 PolicyDecision을 기반으로 실행 계획(PlanArtifact)을 생성한다.
   * 1. WBS 단계 분해
   * 2. Task DAG 의존성 구성
   * 3. 예산 계산
   * 4. 게이트 요구사항 확인
   */
  async execute(
    input: AgentInput,
  ): Promise<Result<AgentOutput, JarvisError>> {
    // 컨텍스트에서 SPEC과 PolicyDecision 추출
    const specData = input.context['spec'] as SpecArtifact | undefined;
    const policyData = input.context['policyRisk'] as PolicyRiskArtifact | undefined;

    if (specData === undefined) {
      return err(
        new JarvisError({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'PlannerAgent: 컨텍스트에 SPEC 데이터가 없습니다',
          context: { runId: input.runId },
        }),
      );
    }

    if (policyData === undefined) {
      return err(
        new JarvisError({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'PlannerAgent: 컨텍스트에 PolicyDecision 데이터가 없습니다',
          context: { runId: input.runId },
        }),
      );
    }

    this.logAudit({
      runId: input.runId,
      action: '실행 계획 생성 시작',
      result: 'STARTED',
    });

    // Claude로 계획 생성 보조
    const claudeResult = await this.callClaude({
      systemPrompt: this.buildSystemPrompt(),
      userMessage: this.buildUserMessage(specData, policyData),
      maxTokens: 4096,
    });

    if (!claudeResult.ok) {
      return err(claudeResult.error);
    }

    // WBS 단계 생성
    const planId = generatePlanId();
    const steps = buildWbsSteps(specData, policyData, planId);
    const budget = calculateBudget(steps);

    // 외부 패키지 요구 수집 (exec.allow 목록에서)
    const toolRequests = policyData.decision.constraints.exec.allow.slice();

    const plan: PlanArtifact = {
      planId,
      specRef: specData.specId,
      policyRef: policyData.decision.decision_id,
      steps,
      budget,
      toolRequests,
      requiredGates: policyData.requiredGates,
    };

    this.logAudit({
      runId: input.runId,
      action: `계획 생성 완료: ${planId}, ${steps.length}단계`,
      result: 'SUCCESS',
    });

    return ok({
      artifactType: 'PLAN',
      artifactRef: plan.planId,
      summary: `${steps.length}개 단계, 예상 ${budget.estimatedTotalTokens} 토큰`,
      data: plan,
      metadata: {
        stepCount: steps.length,
        estimatedTokens: budget.estimatedTotalTokens,
        hasCodeGenStep: steps.some((s) => s.type === 'CODE_GENERATE'),
        gateCount: plan.requiredGates.length,
      },
    });
  }

  /** PlannerAgent 시스템 프롬프트 생성 */
  private buildSystemPrompt(): string {
    return `당신은 JARVIS OS의 Planner 에이전트입니다.
SPEC과 PolicyDecision을 기반으로 실행 계획을 세웁니다.

다음을 수행하십시오:
1. 작업을 원자적 단계로 분해
2. 단계 간 의존성 파악
3. 각 단계에 필요한 도구/패키지 식별
4. 롤백 가능한 체크포인트 식별

코드 생성이 필요한 경우: CODE_GENERATE → REVIEW → TEST 순서를 준수하십시오.`;
  }

  /** 사용자 메시지 구성 */
  private buildUserMessage(
    spec: SpecArtifact,
    policy: PolicyRiskArtifact,
  ): string {
    return `다음 요구사항에 대한 실행 계획을 세워주십시오:

SPEC:
- 의도: ${spec.interpretedIntent}
- 유형: ${spec.intentType}
- 대상: ${spec.targets.join(', ')}

Policy:
- 상태: ${policy.decision.outcome.status}
- 위험도: ${policy.decision.outcome.risk_level}
- 허용 경로: ${policy.decision.constraints.fs.write_allow.join(', ')}`;
  }
}
