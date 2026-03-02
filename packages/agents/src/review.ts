/**
 * ReviewAgent — 코드 보안 검토 및 품질 검사 에이전트
 * ChangeSet에 대한 보안 스캔, 코드 품질 점수, blockers/warnings를 식별한다.
 * 최종 PASS/NEEDS_FIX/REJECT 판정을 내린다.
 * Sonnet 4.6 모델을 사용한다.
 */

import { getAgentConfig } from '@jarvis/core';
import type { Result } from '@jarvis/shared';
import {
  JarvisError,
  ErrorCode,
  ok,
  err,
  generateReviewId,
} from '@jarvis/shared';
import { BaseAgent } from './base-agent.js';
import type { AgentInput, AgentOutput } from './base-agent.js';
import type { ChangeSetArtifact } from './codegen.js';

// ─────────────────────────────────────────
// Review 산출물 타입
// ─────────────────────────────────────────

/** Review 판정 결과 */
export type ReviewVerdict = 'PASS' | 'NEEDS_FIX' | 'REJECT';

/** 보안 스캔 결과 */
export interface SecurityScanResult {
  /** 시크릿 노출 여부 */
  readonly secretsExposed: boolean;
  /** 인젝션 취약점 여부 */
  readonly injectionVulnerability: boolean;
  /** 라이선스 위반 여부 */
  readonly licenseViolation: boolean;
  /** XSS 취약점 여부 */
  readonly xssVulnerability: boolean;
  /** CSRF 취약점 여부 */
  readonly csrfVulnerability: boolean;
  /** 감지된 CVE 목록 */
  readonly cveReferences: readonly string[];
}

/** 코드 품질 평가 항목 */
export interface CodeQualityScore {
  /** 전체 품질 점수 (0~100) */
  readonly total: number;
  /** 가독성 점수 */
  readonly readability: number;
  /** 유지보수성 점수 */
  readonly maintainability: number;
  /** 타입 안전성 점수 */
  readonly typeSafety: number;
  /** 에러 처리 점수 */
  readonly errorHandling: number;
  /** 테스트 가능성 점수 */
  readonly testability: number;
}

/** 차단 항목 — 즉시 수정이 필요한 심각한 문제 */
export interface Blocker {
  /** 차단 규칙 ID */
  readonly ruleId: string;
  /** 차단 이유 설명 */
  readonly description: string;
  /** 영향받는 파일 경로 */
  readonly filePath: string;
  /** 영향받는 라인 번호 (해당하는 경우) */
  readonly lineNumber?: number;
  /** 수정 제안 */
  readonly suggestion: string;
}

/** 경고 항목 — 수정을 권장하는 문제 */
export interface Warning {
  /** 경고 규칙 ID */
  readonly ruleId: string;
  /** 경고 설명 */
  readonly description: string;
  /** 영향받는 파일 경로 */
  readonly filePath: string;
}

/** Review 산출물 */
export interface ReviewArtifact {
  /** Review 고유 ID */
  readonly reviewId: string;
  /** 검토 대상 ChangeSet ID */
  readonly changesetRef: string;
  /** 최종 판정 */
  readonly verdict: ReviewVerdict;
  /** 보안 스캔 결과 */
  readonly securityScan: SecurityScanResult;
  /** 코드 품질 점수 */
  readonly qualityScore: CodeQualityScore;
  /** 차단 항목 목록 (REJECT 또는 NEEDS_FIX 원인) */
  readonly blockers: readonly Blocker[];
  /** 경고 항목 목록 */
  readonly warnings: readonly Warning[];
  /** 검토 요약 */
  readonly summary: string;
  /** 승인 권고 여부 */
  readonly recommended: boolean;
}

// ─────────────────────────────────────────
// 검토 로직
// ─────────────────────────────────────────

/** TypeScript 품질 패턴 검사 */
const QUALITY_RULES = {
  /** any 타입 사용 */
  noAnyType: /:\s*any\b/,
  /** console.log 과다 사용 */
  excessiveLogging: /(console\.log|console\.debug)/g,
  /** TODO/FIXME 주석 */
  todoComments: /\/\/\s*(TODO|FIXME)/gi,
  /** 명시적 반환 타입 누락 */
  missingReturnType: /function\s+\w+\s*\([^)]*\)\s*\{/,
  /** default export 사용 */
  defaultExport: /export\s+default\s/,
  /** throw 직접 사용 (비즈니스 로직) */
  directThrow: /throw\s+new\s+Error/,
} as const;

/**
 * 코드 내용에서 품질 점수를 계산한다.
 */
function calculateQualityScore(code: string): CodeQualityScore {
  let readability = 100;
  let maintainability = 100;
  let typeSafety = 100;
  let errorHandling = 100;
  let testability = 100;

  // any 타입 감점
  if (QUALITY_RULES.noAnyType.test(code)) {
    typeSafety -= 30;
    maintainability -= 10;
  }

  // console.log 과다 감점
  const logCount = (code.match(QUALITY_RULES.excessiveLogging) ?? []).length;
  if (logCount > 3) {
    readability -= 10;
    maintainability -= 10;
  }

  // TODO/FIXME 감점
  const todoCount = (code.match(QUALITY_RULES.todoComments) ?? []).length;
  if (todoCount > 0) {
    maintainability -= todoCount * 5;
  }

  // default export 감점 (네이밍 컨벤션 위반)
  if (QUALITY_RULES.defaultExport.test(code)) {
    maintainability -= 15;
  }

  // throw 직접 사용 감점 (Result 패턴 미준수)
  const throwCount = (code.match(/throw\s+new/g) ?? []).length;
  if (throwCount > 0) {
    errorHandling -= throwCount * 10;
  }

  // 테스트 관련 코드 존재 여부
  if (!code.includes('test') && !code.includes('spec')) {
    testability -= 20;
  }

  // 점수 범위 제한 (0~100)
  const clamp = (val: number) => Math.max(0, Math.min(100, val));

  const scores = {
    readability: clamp(readability),
    maintainability: clamp(maintainability),
    typeSafety: clamp(typeSafety),
    errorHandling: clamp(errorHandling),
    testability: clamp(testability),
  };

  const total = Math.round(
    (scores.readability + scores.maintainability + scores.typeSafety +
      scores.errorHandling + scores.testability) / 5,
  );

  return { total, ...scores };
}

/**
 * ChangeSet에서 보안 이슈를 스캔한다.
 */
function scanSecurity(changeset: ChangeSetArtifact): SecurityScanResult {
  const allCode = [
    ...changeset.filesAdded.map((f) => f.content),
    ...changeset.filesModified.map((f) => f.diff),
  ].join('\n');

  return {
    secretsExposed: changeset.securitySelfCheck.secretsFound,
    injectionVulnerability: changeset.securitySelfCheck.injectionRisk,
    licenseViolation: false, // Phase 0: 라이선스 스캔 미구현
    xssVulnerability:
      allCode.includes('innerHTML') ||
      allCode.includes('dangerouslySetInnerHTML'),
    csrfVulnerability:
      allCode.includes('fetch(') && !allCode.includes('csrf'),
    cveReferences: [], // Phase 0: CVE 스캔 미구현
  };
}

/**
 * 코드 품질 점수를 기반으로 blockers와 warnings를 추출한다.
 */
function extractBlockersAndWarnings(
  changeset: ChangeSetArtifact,
  securityScan: SecurityScanResult,
): { blockers: Blocker[]; warnings: Warning[] } {
  const blockers: Blocker[] = [];
  const warnings: Warning[] = [];

  // 시크릿 노출은 차단 항목
  if (securityScan.secretsExposed) {
    for (const file of changeset.filesAdded) {
      blockers.push({
        ruleId: 'SEC_HARDCODED_SECRET',
        description: '하드코딩된 시크릿/API 키가 감지되었습니다',
        filePath: file.path,
        suggestion: '환경변수 (process.env.API_KEY) 또는 Credential Vault를 사용하십시오',
      });
    }
  }

  // 인젝션 위험은 차단 항목
  if (securityScan.injectionVulnerability) {
    for (const file of changeset.filesAdded) {
      blockers.push({
        ruleId: 'SEC_INJECTION_RISK',
        description: 'eval()/exec() 또는 인젝션 취약점이 감지되었습니다',
        filePath: file.path,
        suggestion: '동적 코드 실행을 제거하고 안전한 대안을 사용하십시오',
      });
    }
  }

  // XSS 취약점은 경고 항목
  if (securityScan.xssVulnerability) {
    for (const file of changeset.filesAdded) {
      warnings.push({
        ruleId: 'SEC_XSS_RISK',
        description: 'innerHTML 또는 dangerouslySetInnerHTML 사용이 감지되었습니다',
        filePath: file.path,
      });
    }
  }

  return { blockers, warnings };
}

/**
 * 검토 결과를 기반으로 최종 판정을 내린다.
 */
function determineVerdict(
  blockers: readonly Blocker[],
  qualityScore: CodeQualityScore,
): ReviewVerdict {
  // 차단 항목이 있으면 REJECT 또는 NEEDS_FIX
  if (blockers.length > 0) {
    // 보안 관련 차단은 REJECT
    const hasSecurityBlocker = blockers.some((b) => b.ruleId.startsWith('SEC_'));
    if (hasSecurityBlocker) return 'REJECT';
    return 'NEEDS_FIX';
  }

  // 품질 점수가 낮으면 NEEDS_FIX
  if (qualityScore.total < 60) return 'NEEDS_FIX';

  return 'PASS';
}

// ─────────────────────────────────────────
// ReviewAgent 구현
// ─────────────────────────────────────────

/**
 * ReviewAgent — 코드 보안/품질 검토 에이전트.
 */
export class ReviewAgent extends BaseAgent {
  /**
   * ReviewAgent를 기본 설정으로 생성한다.
   */
  static create(): ReviewAgent {
    const config = getAgentConfig('review');
    if (config === undefined) {
      throw new Error('review 에이전트 설정을 찾을 수 없습니다');
    }
    return new ReviewAgent(config);
  }

  /**
   * ChangeSet을 검토하여 ReviewArtifact를 생성한다.
   * 1. 보안 스캔 수행
   * 2. 코드 품질 점수 계산
   * 3. blockers/warnings 식별
   * 4. 최종 판정 (PASS/NEEDS_FIX/REJECT)
   */
  async execute(
    input: AgentInput,
  ): Promise<Result<AgentOutput, JarvisError>> {
    const changesetData = input.context['changeset'] as ChangeSetArtifact | undefined;

    if (changesetData === undefined) {
      return err(
        new JarvisError({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'ReviewAgent: 컨텍스트에 ChangeSet 데이터가 없습니다',
          context: { runId: input.runId },
        }),
      );
    }

    this.logAudit({
      runId: input.runId,
      action: `코드 검토 시작: ${changesetData.changesetId}`,
      result: 'STARTED',
    });

    // Claude로 검토 보조
    const claudeResult = await this.callClaude({
      systemPrompt: this.buildSystemPrompt(),
      userMessage: this.buildReviewMessage(changesetData),
      maxTokens: 2048,
    });

    if (!claudeResult.ok) {
      return err(claudeResult.error);
    }

    // 보안 스캔
    const securityScan = scanSecurity(changesetData);

    // 코드 품질 점수 계산 (모든 추가 파일 대상)
    const allCode = changesetData.filesAdded.map((f) => f.content).join('\n');
    const qualityScore = calculateQualityScore(allCode);

    // blockers/warnings 추출
    const { blockers, warnings } = extractBlockersAndWarnings(
      changesetData,
      securityScan,
    );

    // 최종 판정
    const verdict = determineVerdict(blockers, qualityScore);

    const reviewId = generateReviewId();
    const review: ReviewArtifact = {
      reviewId,
      changesetRef: changesetData.changesetId,
      verdict,
      securityScan,
      qualityScore,
      blockers,
      warnings,
      summary: `판정: ${verdict}, 품질 점수: ${qualityScore.total}/100, 차단: ${blockers.length}건, 경고: ${warnings.length}건`,
      recommended: verdict === 'PASS',
    };

    this.logAudit({
      runId: input.runId,
      action: `코드 검토 완료: ${verdict}, 품질=${qualityScore.total}`,
      result: verdict,
    });

    return ok({
      artifactType: 'REVIEW',
      artifactRef: review.reviewId,
      summary: review.summary,
      data: review,
      metadata: {
        verdict,
        qualityTotal: qualityScore.total,
        blockerCount: blockers.length,
        warningCount: warnings.length,
        recommended: review.recommended,
      },
    });
  }

  /** ReviewAgent 시스템 프롬프트 생성 */
  private buildSystemPrompt(): string {
    return `당신은 JARVIS OS의 Review 에이전트입니다.
코드의 보안성과 품질을 검토합니다.

검토 항목:
1. 시크릿/API 키 하드코딩 여부
2. SQL/명령어 인젝션 취약점
3. XSS/CSRF 취약점
4. any 타입 사용 여부
5. 에러 처리 패턴 준수
6. 한글 주석 존재 여부
7. 명시적 반환 타입 존재 여부

판정 기준:
- PASS: 차단 항목 없음 + 품질 점수 60 이상
- NEEDS_FIX: 비보안 차단 항목 존재 또는 품질 점수 60 미만
- REJECT: 보안 관련 차단 항목 존재`;
  }

  /** 검토 요청 메시지 구성 */
  private buildReviewMessage(changeset: ChangeSetArtifact): string {
    const fileList = changeset.filesAdded.map((f) => f.path).join(', ');
    return `다음 ChangeSet을 검토하십시오:

ID: ${changeset.changesetId}
추가 파일: ${fileList}
보안 자가 검사 결과: ${JSON.stringify(changeset.securitySelfCheck)}

파일 수: ${changeset.filesAdded.length}개 추가, ${changeset.filesModified.length}개 수정`;
  }
}
