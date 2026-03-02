/**
 * RollbackAgent — 롤백 실행 및 Postmortem 작성 에이전트
 * 오류 발생 시 실행을 롤백하고 Capability Token을 일괄 무효화한다.
 * Postmortem 리포트를 생성하여 감사 로그에 기록한다.
 * Haiku 4.5 모델을 사용한다.
 */

import { getAgentConfig } from '@jarvis/core';
import {
  createTokenStore,
  revokeAllBySession,
} from '@jarvis/policy-engine';
import type {
  ExecutionTrace,
  Result,
} from '@jarvis/shared';
import {
  JarvisError,
  ErrorCode,
  ok,
  err,
  generateId,
} from '@jarvis/shared';
import { BaseAgent } from './base-agent.js';
import type { AgentInput, AgentOutput } from './base-agent.js';
import type { ExecutorArtifact } from './executor-agent.js';

// ─────────────────────────────────────────
// Rollback 산출물 타입
// ─────────────────────────────────────────

/** 롤백 단계 결과 */
export interface RollbackStep {
  /** 롤백 단계 설명 */
  readonly description: string;
  /** 성공 여부 */
  readonly success: boolean;
  /** 에러 메시지 (실패 시) */
  readonly errorMessage?: string;
  /** 수행 시각 */
  readonly performedAt: string;
}

/** 근본 원인 분석 */
export interface RootCauseAnalysis {
  /** 실패 원인 카테고리 */
  readonly category:
    | 'POLICY_VIOLATION'
    | 'TOKEN_EXPIRED'
    | 'BUILD_FAILURE'
    | 'TEST_FAILURE'
    | 'RUNTIME_ERROR'
    | 'UNKNOWN';
  /** 실패 원인 설명 */
  readonly description: string;
  /** 재발 방지 조치 목록 */
  readonly preventiveMeasures: readonly string[];
}

/** Postmortem 리포트 */
export interface PostmortemReport {
  /** Postmortem 고유 ID */
  readonly postmortemId: string;
  /** 관련 런 ID */
  readonly runId: string;
  /** 세션 ID */
  readonly sessionId: string;
  /** 실패한 에이전트 이름 */
  readonly failedAgent: string;
  /** 실패 발생 시각 */
  readonly failedAt: string;
  /** 원본 에러 메시지 */
  readonly errorMessage: string;
  /** 근본 원인 분석 */
  readonly rootCause: RootCauseAnalysis;
  /** 롤백된 단계 목록 */
  readonly rolledBackSteps: readonly string[];
  /** 무효화된 토큰 수 */
  readonly revokedTokenCount: number;
  /** 권장 조치 목록 */
  readonly recommendations: readonly string[];
  /** Postmortem 작성 시각 */
  readonly writtenAt: string;
}

/** Rollback 산출물 */
export interface RollbackArtifact {
  /** Postmortem 리포트 */
  readonly postmortem: PostmortemReport;
  /** 롤백 단계 목록 */
  readonly rollbackSteps: readonly RollbackStep[];
  /** 롤백 전체 성공 여부 */
  readonly rollbackSuccess: boolean;
  /** 무효화된 Capability Token 수 */
  readonly revokedTokenCount: number;
}

// ─────────────────────────────────────────
// 근본 원인 분석 로직
// ─────────────────────────────────────────

/**
 * 에러 메시지에서 근본 원인을 분석한다.
 */
function analyzeRootCause(errorMessage: string): RootCauseAnalysis {
  const msg = errorMessage.toLowerCase();

  if (msg.includes('policy') || msg.includes('contract') || msg.includes('§1')) {
    return {
      category: 'POLICY_VIOLATION',
      description: '정책 위반으로 인한 실행 중단',
      preventiveMeasures: [
        '계약서 §1 절대 금지사항을 다시 검토하십시오',
        'PolicyRiskAgent 실행 전 요청 내용을 검증하십시오',
        '금지된 경로/도메인 패턴을 정책 엔진에 추가하십시오',
      ],
    };
  }

  if (msg.includes('token') || msg.includes('expired') || msg.includes('capability')) {
    return {
      category: 'TOKEN_EXPIRED',
      description: 'Capability Token 만료 또는 무효화로 인한 실행 중단',
      preventiveMeasures: [
        'Token TTL 설정을 늘리거나 작업을 더 작은 단위로 분리하십시오',
        '실행 시작 전 토큰 유효성을 확인하십시오',
        '게이트 승인 후 빠르게 실행을 시작하십시오',
      ],
    };
  }

  if (msg.includes('build') || msg.includes('compile') || msg.includes('typescript')) {
    return {
      category: 'BUILD_FAILURE',
      description: 'TypeScript 빌드 실패로 인한 중단',
      preventiveMeasures: [
        'TypeScript strict mode를 준수하는 코드를 생성하십시오',
        '빌드 전 typecheck를 실행하십시오',
        'any 타입 사용을 제거하십시오',
      ],
    };
  }

  if (msg.includes('test') || msg.includes('assertion') || msg.includes('expect')) {
    return {
      category: 'TEST_FAILURE',
      description: '테스트 실패로 인한 중단',
      preventiveMeasures: [
        '실패한 테스트 케이스를 분석하고 코드를 수정하십시오',
        '코드 변경 전 기존 테스트를 실행하여 회귀를 확인하십시오',
        '경계 케이스(edge case)에 대한 테스트를 추가하십시오',
      ],
    };
  }

  return {
    category: 'UNKNOWN',
    description: '알 수 없는 원인으로 인한 중단',
    preventiveMeasures: [
      '감사 로그를 검토하여 실패 원인을 파악하십시오',
      'Orchestrator에 재시도를 요청하십시오',
    ],
  };
}

/**
 * ExecutionTrace에서 롤백 가능한 단계를 식별한다.
 */
function identifyRollbackTargets(trace: ExecutionTrace): readonly string[] {
  // SUCCESS 상태인 단계만 롤백 대상
  return trace.steps
    .filter((s) => s.status === 'SUCCESS')
    .map((s) => s.action_id);
}

// ─────────────────────────────────────────
// RollbackAgent 구현
// ─────────────────────────────────────────

/**
 * RollbackAgent — 롤백 실행 및 Postmortem 작성 에이전트.
 * 계약서 §7: 사용자 "중단" 명령 또는 에러 발생 시 모든 Capability Token을 무효화한다.
 */
export class RollbackAgent extends BaseAgent {
  /** 토큰 저장소 (세션 전체 토큰 무효화용) */
  private readonly tokenStore: ReturnType<typeof createTokenStore>;

  constructor() {
    const config = getAgentConfig('rollback');
    if (config === undefined) {
      throw new Error('rollback 에이전트 설정을 찾을 수 없습니다');
    }
    super(config);
    this.tokenStore = createTokenStore();
  }

  /**
   * RollbackAgent를 기본 설정으로 생성한다.
   */
  static create(): RollbackAgent {
    return new RollbackAgent();
  }

  /**
   * 실행 실패 시 롤백을 수행하고 Postmortem 리포트를 생성한다.
   * 1. 롤백 대상 식별
   * 2. Capability Token 일괄 무효화
   * 3. 실행 단계 역순 롤백
   * 4. Postmortem 리포트 생성
   */
  async execute(
    input: AgentInput,
  ): Promise<Result<AgentOutput, JarvisError>> {
    const errorMessage =
      (input.context['errorMessage'] as string | undefined) ?? '알 수 없는 에러';
    const failedAgent =
      (input.context['failedAgent'] as string | undefined) ?? 'unknown';
    const executorData = input.context['executorTrace'] as ExecutorArtifact | undefined;

    this.logAudit({
      runId: input.runId,
      action: `롤백 시작: ${failedAgent} 에이전트 실패`,
      result: 'STARTED',
    });

    // Claude로 롤백 전략 수립
    const claudeResult = await this.callClaude({
      systemPrompt: this.buildSystemPrompt(),
      userMessage: this.buildRollbackMessage(errorMessage, failedAgent),
      maxTokens: 1024,
    });

    if (!claudeResult.ok) {
      return err(claudeResult.error);
    }

    const rollbackSteps: RollbackStep[] = [];

    // 1. Capability Token 일괄 무효화 (계약서 §7)
    const revokedCount = revokeAllBySession(this.tokenStore, input.sessionId);

    rollbackSteps.push({
      description: `세션 ${input.sessionId}의 Capability Token ${revokedCount}개 무효화`,
      success: true,
      performedAt: new Date().toISOString(),
    });

    // 2. 실행된 단계 역순 롤백
    if (executorData !== undefined) {
      const rollbackTargets = identifyRollbackTargets(executorData.trace);

      for (const actionId of [...rollbackTargets].reverse()) {
        // Phase 0: 실제 롤백 대신 시뮬레이션
        rollbackSteps.push({
          description: `액션 ${actionId} 롤백 (Phase 0: 시뮬레이션)`,
          success: true,
          performedAt: new Date().toISOString(),
        });
      }
    }

    // 3. 근본 원인 분석
    const rootCause = analyzeRootCause(errorMessage);

    // 4. Postmortem 리포트 생성
    const postmortemId = generateId('pm_');
    const postmortem: PostmortemReport = {
      postmortemId,
      runId: input.runId,
      sessionId: input.sessionId,
      failedAgent,
      failedAt: new Date().toISOString(),
      errorMessage,
      rootCause,
      rolledBackSteps: rollbackSteps
        .filter((s) => s.success)
        .map((s) => s.description),
      revokedTokenCount: revokedCount,
      recommendations: [
        ...rootCause.preventiveMeasures,
        '다음 실행 전 감사 로그를 검토하십시오',
        '필요한 경우 Planner에게 재계획을 요청하십시오',
      ],
      writtenAt: new Date().toISOString(),
    };

    const rollbackSuccess = rollbackSteps.every((s) => s.success);

    const artifact: RollbackArtifact = {
      postmortem,
      rollbackSteps,
      rollbackSuccess,
      revokedTokenCount: revokedCount,
    };

    this.logAudit({
      runId: input.runId,
      action: `롤백 완료: ${rollbackSteps.length}단계, 토큰 ${revokedCount}개 무효화`,
      result: rollbackSuccess ? 'SUCCESS' : 'PARTIAL_ROLLBACK',
    });

    return ok({
      artifactType: 'ROLLBACK_LOG',
      artifactRef: postmortemId,
      summary: `롤백 ${rollbackSuccess ? '성공' : '부분 성공'}: ${rollbackSteps.length}단계, 토큰 ${revokedCount}개 무효화`,
      data: artifact,
      metadata: {
        rollbackSuccess,
        rollbackStepCount: rollbackSteps.length,
        revokedTokenCount: revokedCount,
        rootCauseCategory: rootCause.category,
      },
    });
  }

  /**
   * 외부에서 세션의 모든 토큰을 즉시 무효화한다.
   * 계약서 §7: 사용자 "중단" 명령 시 즉시 호출된다.
   */
  emergencyRevokeAll(sessionId: string): number {
    const revokedCount = revokeAllBySession(this.tokenStore, sessionId);
    this.logAudit({
      runId: 'emergency',
      action: `비상 토큰 무효화: 세션 ${sessionId}, ${revokedCount}개`,
      result: 'EMERGENCY_REVOKE',
    });
    return revokedCount;
  }

  /** RollbackAgent 시스템 프롬프트 생성 */
  private buildSystemPrompt(): string {
    return `당신은 JARVIS OS의 Rollback 에이전트입니다.
에러 발생 시 안전하게 시스템을 이전 상태로 복구합니다.

계약서 §7 비상 중단 프로토콜:
1. 진행 중인 OS 액션을 안전하게 중단
2. 발급된 Capability Token 전부 무효화
3. 중단 사유 + 당시 상태를 감사 로그에 기록
4. Postmortem 리포트 작성

롤백은 최대한 안전하고 완전하게 수행하십시오.`;
  }

  /** 롤백 요청 메시지 구성 */
  private buildRollbackMessage(
    errorMessage: string,
    failedAgent: string,
  ): string {
    return `다음 에러에 대한 롤백 전략을 수립하십시오:

실패한 에이전트: ${failedAgent}
에러 메시지: ${errorMessage}

롤백 가능한 작업 목록과 우선순위를 제안하십시오.`;
  }
}
