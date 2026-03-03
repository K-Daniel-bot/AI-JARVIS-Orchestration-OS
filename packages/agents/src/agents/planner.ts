// Planner 에이전트 — 작업 분해(WBS), Task DAG 생성
import { randomUUID } from "node:crypto";
import type { Result, JarvisError, CapabilityToken } from "@jarvis/shared";
import { ok, err } from "@jarvis/shared";
import { BaseAgent } from "../base-agent.js";
import type { AgentExecutionContext } from "../types/agent-config.js";
import {
  PlannerInputSchema,
  PlannerOutputSchema,
  type PlannerInput,
  type PlannerOutput,
} from "../types/agent-io.js";

// Planner 에이전트 시스템 프롬프트 — Task DAG 생성 역할 정의
const PLANNER_SYSTEM_PROMPT = `당신은 JARVIS Orchestration OS의 Planner 에이전트입니다.
Spec 분석 결과와 정책 판정을 기반으로 실행 계획(Task DAG)을 생성합니다.

## 절대 규칙
- 계약서(contract.md)가 모든 판단보다 우선합니다
- 최소 권한 원칙: 필요한 최소 단계만 포함
- 각 단계는 독립적으로 롤백 가능해야 합니다

## Step 유형
- CODE_GENERATE: 코드 생성/수정 (agent: codegen)
- FILE_OP: 파일 시스템 조작 (agent: executor)
- EXEC: 명령 실행 (agent: executor)
- REVIEW: 코드 리뷰 (agent: review)
- TEST: 테스트/빌드 (agent: test-build)
- DEPLOY: 배포 (agent: executor)

## 응답 형식
반드시 다음 JSON 형식으로만 응답:
\`\`\`json
{
  "planId": "plan_<8자리UUID>",
  "steps": [
    { "stepId": "s1", "type": "CODE_GENERATE", "description": "...", "agent": "codegen", "dependsOn": [], "estimatedDurationMs": 30000 }
  ],
  "estimatedTotalMs": 30000,
  "toolRequests": []
}
\`\`\``;

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

    // 2. Claude API 호출 또는 스텁 폴백
    let output: PlannerOutput;

    if (this.deps.claudeClient) {
      // Phase 2: Claude API로 실제 Task DAG 생성
      const userMessage = `의도: ${specOutput.intent}\n해석: ${specOutput.interpretation}\n대상: ${specOutput.targets.join(", ")}\n정책 ID: ${policyDecisionId}`;

      const claudeResult = await this.callClaudeWithJson(
        PLANNER_SYSTEM_PROMPT,
        userMessage,
        PlannerOutputSchema,
      );

      if (!claudeResult.ok) {
        // Claude 실패 시 스텁 폴백
        console.warn(`[PlannerAgent] Claude API 실패, 스텁 폴백: ${claudeResult.error.message}`);
        output = this.buildStubOutput(specOutput.intent);
      } else {
        output = claudeResult.value;
      }
    } else {
      // claudeClient 미주입 — 스텁 폴백
      output = this.buildStubOutput(specOutput.intent);
    }

    // 3. 감사 로그 기록
    const auditResult = await this.logAudit(
      context,
      `Planner 실행: ${output.steps.length}개 단계 생성 (정책=${policyDecisionId})`,
      "COMPLETED",
      { planId: output.planId, stepCount: output.steps.length, intent: specOutput.intent, usedClaude: !!this.deps.claudeClient },
    );
    if (!auditResult.ok) {
      console.warn(`[PlannerAgent] 감사 로그 기록 실패: ${auditResult.error.message}`);
    }

    return ok(output);
  }

  // 스텁 출력 생성 — Claude 미사용 시 의도 기반 단계 생성
  private buildStubOutput(intent: PlannerInput["specOutput"]["intent"]): PlannerOutput {
    const steps = this.buildSteps(intent);
    const planId = `plan_${randomUUID().slice(0, 8)}`;
    return {
      planId,
      steps,
      estimatedTotalMs: steps.reduce((sum, s) => sum + s.estimatedDurationMs, 0),
      toolRequests: [],
    };
  }

  // 의도에 따른 실행 단계 생성 — 스텁 템플릿 기반
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
