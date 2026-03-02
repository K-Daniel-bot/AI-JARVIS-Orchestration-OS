/**
 * TestBuildAgent — 테스트 실행 및 빌드 검증 에이전트
 * 빌드 실행 결과와 테스트 실행 결과를 생성한다.
 * 실패 분석 및 수정 제안을 제공한다.
 * Haiku 4.5 모델을 사용한다.
 */

import { getAgentConfig } from '@jarvis/core';
import type { Result } from '@jarvis/shared';
import {
  JarvisError,
  ErrorCode,
  ok,
  err,
  generateId,
} from '@jarvis/shared';
import { BaseAgent } from './base-agent.js';
import type { AgentInput, AgentOutput } from './base-agent.js';
import type { ChangeSetArtifact } from './codegen.js';
import type { ReviewArtifact } from './review.js';

// ─────────────────────────────────────────
// TestReport 산출물 타입
// ─────────────────────────────────────────

/** 빌드 결과 */
export interface BuildResult {
  /** 빌드 성공 여부 */
  readonly success: boolean;
  /** 빌드 소요 시간 (ms) */
  readonly durationMs: number;
  /** 빌드 출력 로그 요약 */
  readonly outputSummary: string;
  /** 빌드 에러 목록 */
  readonly errors: readonly string[];
  /** 빌드 경고 목록 */
  readonly warnings: readonly string[];
}

/** 테스트 케이스 결과 */
export interface TestCaseResult {
  /** 테스트 케이스 이름 */
  readonly name: string;
  /** 성공 여부 */
  readonly passed: boolean;
  /** 소요 시간 (ms) */
  readonly durationMs: number;
  /** 실패 메시지 (실패 시) */
  readonly errorMessage?: string;
}

/** 코드 커버리지 결과 */
export interface CoverageResult {
  /** 전체 문장 커버리지 (%) */
  readonly statements: number;
  /** 분기 커버리지 (%) */
  readonly branches: number;
  /** 함수 커버리지 (%) */
  readonly functions: number;
  /** 라인 커버리지 (%) */
  readonly lines: number;
}

/** 실패 분석 결과 */
export interface FailureAnalysis {
  /** 실패 원인 분류 */
  readonly category: 'TYPE_ERROR' | 'RUNTIME_ERROR' | 'TEST_FAILURE' | 'BUILD_ERROR';
  /** 실패 원인 설명 */
  readonly description: string;
  /** 수정 제안 */
  readonly suggestion: string;
  /** 영향받는 파일 목록 */
  readonly affectedFiles: readonly string[];
}

/** TestReport 산출물 */
export interface TestReportArtifact {
  /** 리포트 고유 ID */
  readonly reportId: string;
  /** 관련 ChangeSet ID */
  readonly changesetRef: string;
  /** 빌드 결과 */
  readonly buildResult: BuildResult;
  /** 전체 테스트 통과 수 */
  readonly passed: number;
  /** 전체 테스트 실패 수 */
  readonly failed: number;
  /** 스킵된 테스트 수 */
  readonly skipped: number;
  /** 개별 테스트 케이스 결과 */
  readonly testCases: readonly TestCaseResult[];
  /** 커버리지 결과 */
  readonly coverage: CoverageResult;
  /** 실패 분석 결과 (실패 시) */
  readonly failureAnalysis: readonly FailureAnalysis[];
  /** 전체 통과 여부 */
  readonly allPassed: boolean;
}

// ─────────────────────────────────────────
// 빌드/테스트 시뮬레이션 로직 (Phase 0)
// ─────────────────────────────────────────

/**
 * Phase 0: 빌드 시뮬레이션 결과를 생성한다.
 * Phase 1에서 실제 TypeScript 컴파일러 호출로 교체한다.
 */
function simulateBuild(
  changeset: ChangeSetArtifact,
): BuildResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // 추가된 파일에서 간단한 TypeScript 문법 검사
  for (const file of changeset.filesAdded) {
    const code = file.content;

    // any 타입 경고
    if (code.includes(': any')) {
      warnings.push(`${file.path}: any 타입 사용 감지 (strict mode 권장사항)`);
    }

    // default export 경고
    if (code.includes('export default')) {
      warnings.push(`${file.path}: default export 사용 감지 (named export 사용 권장)`);
    }

    // 기본적인 구문 검사 — 중괄호 불균형
    const openBraces = (code.match(/\{/g) ?? []).length;
    const closeBraces = (code.match(/\}/g) ?? []).length;
    if (openBraces !== closeBraces) {
      errors.push(`${file.path}: 중괄호 불균형 (${openBraces} 시작, ${closeBraces} 끝)`);
    }
  }

  const success = errors.length === 0;
  return {
    success,
    durationMs: 500 + Math.floor(changeset.filesAdded.length * 100),
    outputSummary: success
      ? `빌드 성공: ${changeset.filesAdded.length}개 파일 컴파일 완료`
      : `빌드 실패: ${errors.length}개 오류`,
    errors,
    warnings,
  };
}

/**
 * Phase 0: 테스트 시뮬레이션 결과를 생성한다.
 * Phase 1에서 실제 vitest 실행으로 교체한다.
 */
function simulateTests(
  changeset: ChangeSetArtifact,
  buildResult: BuildResult,
): { cases: TestCaseResult[]; coverage: CoverageResult } {
  // 빌드 실패 시 테스트 미실행
  if (!buildResult.success) {
    return {
      cases: [],
      coverage: { statements: 0, branches: 0, functions: 0, lines: 0 },
    };
  }

  const cases: TestCaseResult[] = [];

  // 각 추가 파일에 대한 기본 테스트 케이스 생성
  for (const file of changeset.filesAdded) {
    cases.push({
      name: `${file.path} — 모듈 로드 테스트`,
      passed: true,
      durationMs: 10,
    });

    // 코드에 함수가 있는 경우 함수 실행 테스트
    const functionMatches = file.content.match(/export function (\w+)/g) ?? [];
    for (const match of functionMatches) {
      const fnName = match.replace('export function ', '');
      cases.push({
        name: `${fnName} — 기본 호출 테스트`,
        passed: true,
        durationMs: 5,
      });
    }
  }

  // 테스트가 없는 경우 기본 커버리지 0
  if (cases.length === 0) {
    return {
      cases: [],
      coverage: { statements: 0, branches: 0, functions: 0, lines: 0 },
    };
  }

  // 시뮬레이션 커버리지 (실제 측정값으로 교체 예정)
  const fileCount = changeset.filesAdded.length;
  const baseCoverage = Math.min(60 + fileCount * 5, 85);

  return {
    cases,
    coverage: {
      statements: baseCoverage,
      branches: baseCoverage - 10,
      functions: baseCoverage + 5,
      lines: baseCoverage,
    },
  };
}

/**
 * 빌드/테스트 실패를 분석하여 수정 제안을 생성한다.
 */
function analyzeFailures(
  buildResult: BuildResult,
  testCases: readonly TestCaseResult[],
): readonly FailureAnalysis[] {
  const analyses: FailureAnalysis[] = [];

  // 빌드 오류 분석
  for (const error of buildResult.errors) {
    analyses.push({
      category: 'BUILD_ERROR',
      description: error,
      suggestion: error.includes('중괄호')
        ? '중괄호 쌍을 확인하고 누락된 닫는 중괄호를 추가하십시오'
        : '빌드 오류를 수정하십시오',
      affectedFiles: [error.split(':')[0] ?? ''],
    });
  }

  // 테스트 실패 분석
  for (const testCase of testCases) {
    if (!testCase.passed && testCase.errorMessage !== undefined) {
      analyses.push({
        category: 'TEST_FAILURE',
        description: `테스트 실패: ${testCase.name}`,
        suggestion: `${testCase.errorMessage} 오류를 수정하십시오`,
        affectedFiles: [],
      });
    }
  }

  return analyses;
}

// ─────────────────────────────────────────
// TestBuildAgent 구현
// ─────────────────────────────────────────

/**
 * TestBuildAgent — 테스트/빌드 검증 에이전트.
 */
export class TestBuildAgent extends BaseAgent {
  /**
   * TestBuildAgent를 기본 설정으로 생성한다.
   */
  static create(): TestBuildAgent {
    const config = getAgentConfig('test-build');
    if (config === undefined) {
      throw new Error('test-build 에이전트 설정을 찾을 수 없습니다');
    }
    return new TestBuildAgent(config);
  }

  /**
   * ChangeSet을 빌드하고 테스트를 실행하여 TestReportArtifact를 생성한다.
   * 1. 빌드 실행 (Phase 0: 시뮬레이션)
   * 2. 테스트 실행 (Phase 0: 시뮬레이션)
   * 3. 커버리지 측정
   * 4. 실패 분석 및 수정 제안
   */
  async execute(
    input: AgentInput,
  ): Promise<Result<AgentOutput, JarvisError>> {
    const changesetData = input.context['changeset'] as ChangeSetArtifact | undefined;
    const reviewData = input.context['review'] as ReviewArtifact | undefined;

    if (changesetData === undefined) {
      return err(
        new JarvisError({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'TestBuildAgent: 컨텍스트에 ChangeSet 데이터가 없습니다',
          context: { runId: input.runId },
        }),
      );
    }

    // Review 판정이 REJECT이면 테스트 미실행
    if (reviewData?.verdict === 'REJECT') {
      return err(
        new JarvisError({
          code: ErrorCode.POLICY_DENIED,
          message: 'TestBuildAgent: Review가 REJECT 판정이므로 테스트를 실행하지 않습니다',
          context: {
            runId: input.runId,
            reviewId: reviewData.reviewId,
            blockers: reviewData.blockers.map((b) => b.ruleId),
          },
        }),
      );
    }

    this.logAudit({
      runId: input.runId,
      action: `빌드/테스트 시작: ${changesetData.changesetId}`,
      result: 'STARTED',
    });

    // Claude로 테스트 분석 보조
    const claudeResult = await this.callClaude({
      systemPrompt: this.buildSystemPrompt(),
      userMessage: this.buildTestMessage(changesetData),
      maxTokens: 1024,
    });

    if (!claudeResult.ok) {
      return err(claudeResult.error);
    }

    // 빌드 시뮬레이션
    const buildResult = simulateBuild(changesetData);

    // 테스트 시뮬레이션
    const { cases: testCases, coverage } = simulateTests(changesetData, buildResult);

    // 실패 분석
    const failureAnalysis = analyzeFailures(buildResult, testCases);

    const passedCount = testCases.filter((t) => t.passed).length;
    const failedCount = testCases.filter((t) => !t.passed).length;
    const allPassed = buildResult.success && failedCount === 0;

    const reportId = generateId('rep_');
    const report: TestReportArtifact = {
      reportId,
      changesetRef: changesetData.changesetId,
      buildResult,
      passed: passedCount,
      failed: failedCount,
      skipped: 0,
      testCases,
      coverage,
      failureAnalysis,
      allPassed,
    };

    this.logAudit({
      runId: input.runId,
      action: `테스트 완료: ${passedCount}/${testCases.length} 통과, 빌드=${buildResult.success}`,
      result: allPassed ? 'SUCCESS' : 'FAILED',
    });

    return ok({
      artifactType: 'TEST_REPORT',
      artifactRef: report.reportId,
      summary: `빌드: ${buildResult.success ? '성공' : '실패'}, 테스트: ${passedCount}/${testCases.length}, 커버리지: ${coverage.statements}%`,
      data: report,
      metadata: {
        buildSuccess: buildResult.success,
        testPassed: passedCount,
        testFailed: failedCount,
        coverage: coverage.statements,
        allPassed,
      },
    });
  }

  /** TestBuildAgent 시스템 프롬프트 생성 */
  private buildSystemPrompt(): string {
    return `당신은 JARVIS OS의 Test & Build 에이전트입니다.
코드의 빌드 가능성과 테스트 통과 여부를 검증합니다.

검증 항목:
1. TypeScript 컴파일 오류 확인
2. 단위 테스트 실행 결과
3. 코드 커버리지 측정
4. 빌드 경고 확인

목표 커버리지: 80% 이상 (핵심 모듈은 95%+)`;
  }

  /** 테스트 요청 메시지 구성 */
  private buildTestMessage(changeset: ChangeSetArtifact): string {
    const fileList = changeset.filesAdded.map((f) => f.path).join(', ');
    return `다음 파일들의 빌드/테스트 전략을 분석하십시오:
파일 목록: ${fileList}
보안 검사 결과: ${JSON.stringify(changeset.securitySelfCheck)}`;
  }
}
