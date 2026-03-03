// Test Build 에이전트 — 테스트 실행, 빌드 검증
import { randomUUID } from "node:crypto";
import type { Result, JarvisError, CapabilityToken } from "@jarvis/shared";
import { ok, err } from "@jarvis/shared";
import { BaseAgent } from "../base-agent.js";
import type { AgentExecutionContext } from "../types/agent-config.js";
import {
  TestBuildInputSchema,
  type TestBuildInput,
  type TestBuildOutput,
} from "../types/agent-io.js";

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

    const { changeSetId, reviewId } = validationResult.value;

    // 2. Phase 0 스텁 — 실제 테스트 실행은 Phase 1에서 Executor를 통해 수행
    const testRunId = `trun_${randomUUID().slice(0, 8)}`;

    // Phase 0 스텁 — 실제 값 대신 스텁 마커 반환
    const stubStartMs = Date.now();
    const output: TestBuildOutput = {
      testRunId,
      buildPassed: true,
      testsPassed: true,
      totalTests: -1, // -1 = Phase 0 스텁 (실제 테스트 미실행)
      failedTests: 0,
      coveragePercent: -1, // -1 = Phase 0 스텁 (커버리지 미측정)
      errors: [],
      durationMs: Date.now() - stubStartMs,
    };

    // 3. 감사 로그 기록
    const auditResult = await this.logAudit(
      context,
      `TestBuild 실행: changeSet=${changeSetId}, review=${reviewId}`,
      "COMPLETED",
      {
        testRunId,
        buildPassed: output.buildPassed,
        testsPassed: output.testsPassed,
      },
    );
    if (!auditResult.ok) {
      console.warn(`[TestBuildAgent] 감사 로그 기록 실패: ${auditResult.error.message}`);
    }

    return ok(output);
  }
}
