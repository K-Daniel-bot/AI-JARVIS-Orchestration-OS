// Planner 에이전트 — 작업 분해(WBS), Task DAG 생성
import { randomUUID } from "node:crypto";
import type { Result, JarvisError, CapabilityToken } from "@jarvis/shared";
import { ok, err } from "@jarvis/shared";
import { BaseAgent } from "../base-agent.js";
import type { AgentExecutionContext } from "../types/agent-config.js";
import {
  PlannerInputSchema,
  type PlannerInput,
  type PlannerOutput,
} from "../types/agent-io.js";

// Planner 에이전트 — Spec과 정책 판정 결과를 기반으로 실행 계획 생성
export class PlannerAgent extends BaseAgent {
  // 입력 검증 → 작업 분해 → Task DAG 구성 → 감사 로그 기록
  override async execute(
    input: unknown,
    context: AgentExecutionContext,
    _capabilityToken?: CapabilityToken,
  ): Promise<Result<PlannerOutput, JarvisError>> {
    // 1. 입력 검증
    const validationResult = this.validateInput<PlannerInput>(
      input,
      PlannerInputSchema,
    );
    if (!validationResult.ok) {
      return err(validationResult.error);
    }

    const { specOutput, policyDecisionId } = validationResult.value;

    // 2. Phase 0 스텁 — 의도 기반 단계 생성
    const steps = this.buildSteps(specOutput.intent);
    const planId = `plan_${randomUUID().slice(0, 8)}`;

    const output: PlannerOutput = {
      planId,
      steps,
      estimatedTotalMs: steps.reduce((sum, s) => sum + s.estimatedDurationMs, 0),
      toolRequests: [],
    };

    // 3. 감사 로그 기록
    const auditResult = await this.logAudit(
      context,
      `Planner 실행: ${steps.length}개 단계 생성 (정책=${policyDecisionId})`,
      "COMPLETED",
      { planId, stepCount: steps.length, intent: specOutput.intent },
    );
    if (!auditResult.ok) {
      console.warn(`[PlannerAgent] 감사 로그 기록 실패: ${auditResult.error.message}`);
    }

    return ok(output);
  }

  // 의도에 따른 실행 단계 생성 — Phase 0 템플릿 기반
  private buildSteps(intent: PlannerInput["specOutput"]["intent"]): PlannerOutput["steps"] {
    const stepId = (n: number): string => `s${n}`;

    if (intent === "CODE_IMPLEMENTATION") {
      return [
        {
          stepId: stepId(1),
          type: "CODE_GENERATE",
          description: "코드 생성",
          agent: "codegen",
          dependsOn: [],
          estimatedDurationMs: 30000,
        },
        {
          stepId: stepId(2),
          type: "REVIEW",
          description: "코드 리뷰",
          agent: "review",
          dependsOn: [stepId(1)],
          estimatedDurationMs: 15000,
        },
        {
          stepId: stepId(3),
          type: "TEST",
          description: "테스트 실행",
          agent: "test-build",
          dependsOn: [stepId(2)],
          estimatedDurationMs: 20000,
        },
      ];
    }

    if (intent === "FILE_OPERATION") {
      return [
        {
          stepId: stepId(1),
          type: "FILE_OP",
          description: "파일 시스템 조작",
          agent: "executor",
          dependsOn: [],
          estimatedDurationMs: 5000,
        },
      ];
    }

    if (intent === "PACKAGE_INSTALL") {
      return [
        {
          stepId: stepId(1),
          type: "EXEC",
          description: "패키지 설치",
          agent: "executor",
          dependsOn: [],
          estimatedDurationMs: 60000,
        },
        {
          stepId: stepId(2),
          type: "TEST",
          description: "설치 검증",
          agent: "test-build",
          dependsOn: [stepId(1)],
          estimatedDurationMs: 10000,
        },
      ];
    }

    // 기본 단계 — 알 수 없는 의도
    return [
      {
        stepId: stepId(1),
        type: "EXEC",
        description: `${intent} 실행`,
        agent: "executor",
        dependsOn: [],
        estimatedDurationMs: 10000,
      },
    ];
  }
}
