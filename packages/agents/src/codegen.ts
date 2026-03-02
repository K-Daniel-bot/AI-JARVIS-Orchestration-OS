/**
 * CodegenAgent — 코드 생성 에이전트
 * PLAN.json의 CODE_GENERATE step을 실행하여 ChangeSet을 생성한다.
 * 보안 자가 검사(시크릿, 인젝션, 경로 순회)를 수행한다.
 * Sonnet 4.6 모델을 사용한다.
 */

import { getAgentConfig } from '@jarvis/core';
import type { Result } from '@jarvis/shared';
import {
  JarvisError,
  ErrorCode,
  ok,
  err,
  generateChangesetId,
} from '@jarvis/shared';
import { BaseAgent } from './base-agent.js';
import type { AgentInput, AgentOutput } from './base-agent.js';
import type { PlanArtifact, PlanStep } from './planner.js';

// ─────────────────────────────────────────
// ChangeSet 산출물 타입
// ─────────────────────────────────────────

/** 추가된 파일 정보 */
export interface AddedFile {
  /** 파일 경로 */
  readonly path: string;
  /** 파일 전체 내용 */
  readonly content: string;
}

/** 수정된 파일 정보 */
export interface ModifiedFile {
  /** 파일 경로 */
  readonly path: string;
  /** git diff 형식의 변경사항 */
  readonly diff: string;
}

/** 보안 자가 검사 결과 */
export interface SecuritySelfCheck {
  /** 시크릿/토큰/비밀번호 하드코딩 감지 여부 */
  readonly secretsFound: boolean;
  /** SQL/명령어 인젝션 위험 감지 여부 */
  readonly injectionRisk: boolean;
  /** 경로 순회 공격 위험 감지 여부 */
  readonly pathTraversalRisk: boolean;
  /** eval()/exec() 동적 코드 실행 감지 여부 */
  readonly dynamicCodeRisk: boolean;
  /** 감지된 위험 패턴 목록 */
  readonly detectedPatterns: readonly string[];
}

/** ChangeSet 산출물 */
export interface ChangeSetArtifact {
  /** ChangeSet 고유 ID */
  readonly changesetId: string;
  /** 관련 Plan ID */
  readonly planRef: string;
  /** 관련 Step ID */
  readonly stepRef: string;
  /** 새로 추가된 파일 목록 */
  readonly filesAdded: readonly AddedFile[];
  /** 수정된 파일 목록 */
  readonly filesModified: readonly ModifiedFile[];
  /** git diff 형태의 전체 변경사항 요약 */
  readonly diff: string;
  /** 마이그레이션 필요 사항 */
  readonly migrationNotes: string;
  /** 보안 자가 검사 결과 */
  readonly securitySelfCheck: SecuritySelfCheck;
}

// ─────────────────────────────────────────
// 보안 자가 검사 로직
// ─────────────────────────────────────────

/** 시크릿 탐지 패턴 목록 */
const SECRET_PATTERNS = [
  /api[_\-]?key\s*[=:]\s*["'][^"']{8,}/i,
  /password\s*[=:]\s*["'][^"']+["']/i,
  /secret\s*[=:]\s*["'][^"']{8,}/i,
  /token\s*[=:]\s*["'][^"']{16,}/i,
  /[a-zA-Z0-9]{32,}/,  // 하드코딩된 긴 랜덤 문자열
] as const;

/** 인젝션 위험 패턴 목록 */
const INJECTION_PATTERNS = [
  /eval\s*\(/,
  /exec\s*\(/,
  /Function\s*\(/,
  /\$\{.*user.*input\}/i,
  /sql.*\+.*req\./i,
] as const;

/** 경로 순회 패턴 목록 */
const PATH_TRAVERSAL_PATTERNS = [
  /\.\.[\/\\]/,
  /%2e%2e/i,
  /\.\.%2f/i,
] as const;

/**
 * 생성된 코드에 대한 보안 자가 검사를 수행한다.
 * 계약서 §1 및 codegen 에이전트 보안 체크리스트 준수.
 */
function performSecurityCheck(code: string): SecuritySelfCheck {
  const detectedPatterns: string[] = [];

  // 시크릿 탐지 (환경변수 참조는 제외)
  const hasSecrets =
    SECRET_PATTERNS.some((pattern) => pattern.test(code)) &&
    !code.includes('process.env') &&
    !code.includes('getenv');

  if (hasSecrets) {
    detectedPatterns.push('HARDCODED_SECRET');
  }

  // 인젝션 위험 탐지
  const hasInjection = INJECTION_PATTERNS.some((pattern) => pattern.test(code));
  if (hasInjection) {
    detectedPatterns.push('INJECTION_RISK');
  }

  // 경로 순회 위험 탐지
  const hasPathTraversal = PATH_TRAVERSAL_PATTERNS.some((pattern) =>
    pattern.test(code),
  );
  if (hasPathTraversal) {
    detectedPatterns.push('PATH_TRAVERSAL');
  }

  // 동적 코드 실행 탐지
  const hasDynamicCode =
    code.includes('eval(') ||
    code.includes('new Function(') ||
    code.includes('exec(');
  if (hasDynamicCode) {
    detectedPatterns.push('DYNAMIC_CODE_EXECUTION');
  }

  return {
    secretsFound: hasSecrets,
    injectionRisk: hasInjection,
    pathTraversalRisk: hasPathTraversal,
    dynamicCodeRisk: hasDynamicCode,
    detectedPatterns,
  };
}

/**
 * 생성된 코드를 기반으로 간단한 git diff 형식을 생성한다.
 */
function buildDiffSummary(
  filesAdded: readonly AddedFile[],
  filesModified: readonly ModifiedFile[],
): string {
  const lines: string[] = [];

  for (const file of filesAdded) {
    lines.push(`--- /dev/null`);
    lines.push(`+++ b/${file.path}`);
    const contentLines = file.content.split('\n');
    lines.push(`@@ -0,0 +1,${contentLines.length} @@`);
    for (const line of contentLines) {
      lines.push(`+${line}`);
    }
  }

  for (const file of filesModified) {
    lines.push(file.diff);
  }

  return lines.join('\n');
}

/**
 * 코드 생성 프롬프트를 구성한다.
 */
function buildCodegenPrompt(step: PlanStep): string {
  return `다음 작업에 대한 TypeScript 코드를 생성하십시오:

작업: ${step.description}
출력 파일: ${step.outputs.join(', ')}
허용 패키지: ${step.constraints.packagesAllowed.join(', ')}

코딩 규칙:
- TypeScript strict mode 준수
- 2-space 들여쓰기
- Named exports만 사용 (default export 금지)
- 한글 주석 필수
- any 타입 사용 금지
- Result<T, E> 패턴으로 에러 처리
- 시크릿 하드코딩 금지 (환경변수 사용)`;
}

// ─────────────────────────────────────────
// CodegenAgent 구현
// ─────────────────────────────────────────

/**
 * CodegenAgent — 코드 생성 및 ChangeSet 작성 에이전트.
 */
export class CodegenAgent extends BaseAgent {
  /**
   * CodegenAgent를 기본 설정으로 생성한다.
   */
  static create(): CodegenAgent {
    const config = getAgentConfig('codegen');
    if (config === undefined) {
      throw new Error('codegen 에이전트 설정을 찾을 수 없습니다');
    }
    return new CodegenAgent(config);
  }

  /**
   * Plan의 CODE_GENERATE step을 실행하여 ChangeSet을 생성한다.
   * 1. CODE_GENERATE 단계 추출
   * 2. Claude API로 코드 생성
   * 3. 보안 자가 검사 수행
   * 4. ChangeSet 구성
   */
  async execute(
    input: AgentInput,
  ): Promise<Result<AgentOutput, JarvisError>> {
    const planData = input.context['plan'] as PlanArtifact | undefined;

    if (planData === undefined) {
      return err(
        new JarvisError({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'CodegenAgent: 컨텍스트에 Plan 데이터가 없습니다',
          context: { runId: input.runId },
        }),
      );
    }

    // CODE_GENERATE 단계만 처리
    const codeSteps = planData.steps.filter((s) => s.type === 'CODE_GENERATE');
    if (codeSteps.length === 0) {
      return err(
        new JarvisError({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'CodegenAgent: Plan에 CODE_GENERATE 단계가 없습니다',
          context: { runId: input.runId, planId: planData.planId },
        }),
      );
    }

    this.logAudit({
      runId: input.runId,
      action: `코드 생성 시작: ${codeSteps.length}개 단계`,
      result: 'STARTED',
    });

    const allFilesAdded: AddedFile[] = [];
    const allFilesModified: ModifiedFile[] = [];
    let combinedSecurityCheck: SecuritySelfCheck = {
      secretsFound: false,
      injectionRisk: false,
      pathTraversalRisk: false,
      dynamicCodeRisk: false,
      detectedPatterns: [],
    };

    // 각 CODE_GENERATE 단계 처리
    for (const step of codeSteps) {
      const claudeResult = await this.callClaude({
        systemPrompt: this.buildSystemPrompt(planData),
        userMessage: buildCodegenPrompt(step),
        maxTokens: 4096,
      });

      if (!claudeResult.ok) {
        return err(claudeResult.error);
      }

      const generatedCode = claudeResult.value;

      // 보안 자가 검사
      const secCheck = performSecurityCheck(generatedCode);

      // 치명적 보안 위험 감지 시 즉시 중단
      if (secCheck.secretsFound || secCheck.dynamicCodeRisk) {
        this.logAudit({
          runId: input.runId,
          action: `보안 위험 감지: ${secCheck.detectedPatterns.join(', ')}`,
          result: 'BLOCKED',
        });

        return err(
          new JarvisError({
            code: ErrorCode.POLICY_DENIED,
            message: `코드 생성 차단: 보안 위험 패턴 감지 — ${secCheck.detectedPatterns.join(', ')}`,
            context: {
              stepId: step.stepId,
              detectedPatterns: secCheck.detectedPatterns,
            },
          }),
        );
      }

      // 보안 검사 결과 누적
      combinedSecurityCheck = {
        secretsFound: combinedSecurityCheck.secretsFound || secCheck.secretsFound,
        injectionRisk: combinedSecurityCheck.injectionRisk || secCheck.injectionRisk,
        pathTraversalRisk:
          combinedSecurityCheck.pathTraversalRisk || secCheck.pathTraversalRisk,
        dynamicCodeRisk:
          combinedSecurityCheck.dynamicCodeRisk || secCheck.dynamicCodeRisk,
        detectedPatterns: [
          ...combinedSecurityCheck.detectedPatterns,
          ...secCheck.detectedPatterns,
        ],
      };

      // 출력 파일을 AddedFile로 구성
      for (const outputPath of step.outputs) {
        if (outputPath !== '') {
          allFilesAdded.push({
            path: outputPath,
            content: generatedCode,
          });
        }
      }
    }

    const changesetId = generateChangesetId();
    const diff = buildDiffSummary(allFilesAdded, allFilesModified);

    const changeset: ChangeSetArtifact = {
      changesetId,
      planRef: planData.planId,
      stepRef: codeSteps.map((s) => s.stepId).join(','),
      filesAdded: allFilesAdded,
      filesModified: allFilesModified,
      diff,
      migrationNotes: '',
      securitySelfCheck: combinedSecurityCheck,
    };

    this.logAudit({
      runId: input.runId,
      action: `코드 생성 완료: ${changesetId}, ${allFilesAdded.length}개 파일 추가`,
      result: 'SUCCESS',
    });

    return ok({
      artifactType: 'CHANGESET',
      artifactRef: changeset.changesetId,
      summary: `${allFilesAdded.length}개 파일 추가, ${allFilesModified.length}개 파일 수정`,
      data: changeset,
      metadata: {
        filesAdded: allFilesAdded.length,
        filesModified: allFilesModified.length,
        securityWarnings: combinedSecurityCheck.detectedPatterns.length,
      },
    });
  }

  /** CodegenAgent 시스템 프롬프트 생성 */
  private buildSystemPrompt(plan: PlanArtifact): string {
    return `당신은 JARVIS OS의 Codegen 에이전트입니다.
TypeScript (strict mode) 코드를 생성합니다.

허용된 패키지: ${plan.toolRequests.join(', ')}
허용된 쓰기 경로: ${plan.steps.flatMap((s) => s.constraints.writeAllow).join(', ')}

절대 금지:
- 시크릿/API 키 하드코딩
- eval(), exec(), new Function() 사용
- any 타입 사용
- default export 사용

필수:
- 한글 주석
- 2-space 들여쓰기
- Result<T, E> 에러 처리 패턴`;
  }
}
