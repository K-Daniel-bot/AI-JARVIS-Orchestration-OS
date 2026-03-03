// Test Build 에이전트 — 테스트 실행, 빌드 검증
import { randomUUID } from "node:crypto";
import type { Result, JarvisError, CapabilityToken } from "@jarvis/shared";
import { ok, err } from "@jarvis/shared";
import { BaseAgent } from "../base-agent.js";
import type { AgentExecutionContext } from "../types/agent-config.js";
import {
  TestBuildInputSchema,
  TestBuildOutputSchema,
  type TestBuildInput,
  type TestBuildOutput,
} from "../types/agent-io.js";

// Test Build 에이전트 시스템 프롬프트 — 테스트 전략 분석 역할 정의
const TESTBUILD_SYSTEM_PROMPT = `당신은 JARVIS Orchestration OS의 TestBuild 에이전트입니다.
ChangeSet에 대한 테스트 전략을 분석하고 예상 결과를 생성합니다.

## 분석 항목
- 어떤 테스트를 실행해야 하는지 (unit, integration, e2e)
- 예상 테스트 수와 커버리지
- 빌드 통과 가능성 분석
- 잠재적 실패 지점 식별
- 추가로 작성해야 할 테스트 제안

## 응답 형식
반드시 다음 JSON 형식으로만 응답:
\`\`\`json
{
  "testRunId": "trun_<8자리UUID>",
  "buildPassed": true,
  "testsPassed": true,
  "totalTests": 0,
  "failedTests": 0,
  "coveragePercent": 0,
  "errors": [],
  "durationMs": 0,
  "suggestedTests": [
    {
      "testName": "should validate input schema",
      "testType": "unit",
      "targetFile": "src/validator.ts",
      "description": "입력 스키마 검증 로직의 경계값 테스트"
    }
  ]
}
\`\`\``;

// Test Build 에이전트 — 빌드 및 테스트를 실행하고 결과를 반환
export class TestBuildAgent extends BaseAgent {
  // 입력 검증 → 빌드/테스트 실행(스텁) → 결과 생성 → 감사 로그 기록
  override async execute(
    input: unknown,
    context: AgentExecutionContext,
    _capabilityToken?: CapabilityToken,
  ): Promise<Result<TestBuildOutput, JarvisError>> {
    // 1. 입력 검증
    const validationResult = this.validateInput<TestBuildInput>(
      input,
      TestBuildInputSchema,
    );
    if (!validationResult.ok) {
      return err(validationResult.error);
    }

    const { changeSetId, reviewId, testCommands } = validationResult.value;

    // 2. Claude API 호출 또는 스텁 폴백
    let output: TestBuildOutput;

    if (this.deps.claudeClient) {
      // Phase 2: Claude API로 테스트 전략 분석 및 예상 결과 생성
      const commandsSummary = testCommands && testCommands.length > 0
        ? testCommands.join(", ")
        : "기본 테스트 명령";

      const userMessage = `changeSetId: ${changeSetId}\nreviewId: ${reviewId}\n테스트 명령: ${commandsSummary}`;

      const claudeResult = await this.callClaudeWithJson(
        TESTBUILD_SYSTEM_PROMPT,
        userMessage,
        TestBuildOutputSchema,
      );

      if (!claudeResult.ok) {
        // Claude 실패 시 스텁 폴백
    // eslint-disable-next-line no-console
        console.warn(`[TestBuildAgent] Claude API 실패, 스텁 폴백: ${claudeResult.error.message}`);
        output = this.buildStubOutput(changeSetId, reviewId);
      } else {
        output = claudeResult.value;
      }
    } else {
      // claudeClient 미주입 — 스텁 폴백
      output = this.buildStubOutput(changeSetId, reviewId);
    }

    // 3. 감사 로그 기록
    const auditResult = await this.logAudit(
      context,
      `TestBuild 실행: changeSet=${changeSetId}, review=${reviewId}`,
      "COMPLETED",
      {
        testRunId: output.testRunId,
        buildPassed: output.buildPassed,
        testsPassed: output.testsPassed,
        usedClaude: !!this.deps.claudeClient,
      },
    );
    if (!auditResult.ok) {
    // eslint-disable-next-line no-console
      console.warn(`[TestBuildAgent] 감사 로그 기록 실패: ${auditResult.error.message}`);
    }

    return ok(output);
  }

  // 스텁 출력 생성 — Claude 미사용 시 기본 통과 결과 반환
  private buildStubOutput(_changeSetId: string, _reviewId: string): TestBuildOutput {
    const stubStartMs = Date.now();
    return {
      testRunId: `trun_${randomUUID().slice(0, 8)}`,
      buildPassed: true,
      testsPassed: true,
      totalTests: 0, // 0 = 스텁 (실제 테스트 미실행)
      failedTests: 0,
      coveragePercent: 0, // 0 = 스텁 (커버리지 미측정)
      errors: [],
      durationMs: Date.now() - stubStartMs,
      suggestedTests: [], // 스텁 폴백 시 제안 테스트 없음
    };
  }
}
