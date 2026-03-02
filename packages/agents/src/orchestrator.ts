/**
 * OrchestratorAgent — 전체 흐름 제어 에이전트
 * 사용자 요청의 복잡도를 L1~L4로 분류하고, 에이전트 팀을 구성하며,
 * 상태 머신 전이를 결정한다. Opus 4.6 모델을 사용한다.
 */

import {
  ComplexityLevel,
  getAgentConfig,
  COMPLEXITY_AGENT_TEAMS,
} from '@jarvis/core';
import type { AgentName, Result } from '@jarvis/shared';
import {
  JarvisError,
  ErrorCode,
  ok,
  err,
  generateId,
} from '@jarvis/shared';
import { BaseAgent } from './base-agent.js';
import type { AgentInput, AgentOutput } from './base-agent.js';

// ─────────────────────────────────────────
// Orchestrator 산출물 타입
// ─────────────────────────────────────────

/** 복잡도 분류 결과 */
export interface ComplexityAssessment {
  /** 복잡도 레벨 (L1~L4) */
  readonly level: ComplexityLevel;
  /** 분류 근거 설명 */
  readonly reasoning: string;
  /** 필요한 에이전트 팀 목록 */
  readonly requiredAgents: readonly AgentName[];
  /** 예상 소요 시간 (초) */
  readonly estimatedDurationSecs: number;
}

/** Task DAG 노드 */
export interface TaskNode {
  /** 태스크 ID */
  readonly taskId: string;
  /** 실행할 에이전트 이름 */
  readonly agent: AgentName;
  /** 선행 태스크 ID 목록 */
  readonly dependsOn: readonly string[];
  /** 태스크 설명 */
  readonly description: string;
}

/** Orchestrator 산출물 — 복잡도 분류 + Task DAG */
export interface OrchestrationPlan {
  /** 오케스트레이션 계획 ID */
  readonly planId: string;
  /** 복잡도 평가 결과 */
  readonly complexity: ComplexityAssessment;
  /** Task DAG (노드 목록) */
  readonly taskDag: readonly TaskNode[];
  /** 게이트 요구 여부 */
  readonly requiresGates: readonly string[];
}

// ─────────────────────────────────────────
// 복잡도 분류 로직
// ─────────────────────────────────────────

/**
 * 사용자 요청을 분석하여 복잡도 레벨을 분류한다.
 * 키워드 기반 휴리스틱 분류를 사용하며, Phase 1에서 Claude 분석으로 교체된다.
 */
function assessComplexity(rawInput: string): ComplexityAssessment {
  const input = rawInput.toLowerCase();

  // L4: 외부 서비스 연동, 권한 상승, 위험 키워드
  const dangerousKeywords = [
    'admin', 'sudo', 'root', 'registry', 'system32',
    'payment', 'bank', 'credential', 'password',
    'deploy production', '프로덕션 배포', '관리자',
  ];
  if (dangerousKeywords.some((kw) => input.includes(kw))) {
    return {
      level: ComplexityLevel.L4_DANGEROUS,
      reasoning: '위험 키워드 감지 — 외부 서비스 연동 또는 권한 상승 가능성',
      requiredAgents: COMPLEXITY_AGENT_TEAMS[ComplexityLevel.L4_DANGEROUS],
      estimatedDurationSecs: 300,
    };
  }

  // L3: 네트워크 접근, 5개 초과 파일, 빌드/테스트
  const complexKeywords = [
    'network', 'api', 'http', 'database', 'db',
    'build', 'test', 'deploy', 'install',
    '네트워크', 'API', '빌드', '테스트',
  ];
  if (complexKeywords.some((kw) => input.includes(kw))) {
    return {
      level: ComplexityLevel.L3_COMPLEX,
      reasoning: '복잡 작업 감지 — 네트워크 접근 또는 빌드/테스트 포함',
      requiredAgents: COMPLEXITY_AGENT_TEAMS[ComplexityLevel.L3_COMPLEX],
      estimatedDurationSecs: 180,
    };
  }

  // L2: 다중 파일 수정, 코드 생성
  const moderateKeywords = [
    'create', 'implement', 'refactor', 'update', 'modify',
    'function', 'class', 'module', 'component',
    '생성', '구현', '수정', '리팩토링',
  ];
  if (moderateKeywords.some((kw) => input.includes(kw))) {
    return {
      level: ComplexityLevel.L2_MODERATE,
      reasoning: '중간 복잡도 — 코드 생성/수정 포함',
      requiredAgents: COMPLEXITY_AGENT_TEAMS[ComplexityLevel.L2_MODERATE],
      estimatedDurationSecs: 90,
    };
  }

  // L1: 단순 조회, 읽기 전용 작업
  return {
    level: ComplexityLevel.L1_SIMPLE,
    reasoning: '단순 작업 — 단일 에이전트로 처리 가능',
    requiredAgents: COMPLEXITY_AGENT_TEAMS[ComplexityLevel.L1_SIMPLE],
    estimatedDurationSecs: 30,
  };
}

/**
 * 복잡도 레벨과 에이전트 팀을 기반으로 Task DAG를 생성한다.
 */
function buildTaskDag(
  complexity: ComplexityAssessment,
  runId: string,
): readonly TaskNode[] {
  const tasks: TaskNode[] = [];
  let prevTaskId = '';

  // 에이전트 순서에 따라 순차 의존성을 가진 DAG 생성
  for (const agentName of complexity.requiredAgents) {
    const taskId = `${runId}_${agentName}`;
    tasks.push({
      taskId,
      agent: agentName,
      dependsOn: prevTaskId !== '' ? [prevTaskId] : [],
      description: `${agentName} 에이전트 실행`,
    });
    prevTaskId = taskId;
  }

  return tasks;
}

/**
 * 복잡도 레벨에 따라 필요한 게이트 목록을 결정한다.
 */
function determineRequiredGates(level: ComplexityLevel): readonly string[] {
  switch (level) {
    case ComplexityLevel.L1_SIMPLE:
      return [];
    case ComplexityLevel.L2_MODERATE:
      return ['GATE_L1_PLAN'];
    case ComplexityLevel.L3_COMPLEX:
      return ['GATE_L1_PLAN', 'GATE_L2_CHANGES'];
    case ComplexityLevel.L4_DANGEROUS:
      return ['GATE_L1_PLAN', 'GATE_L2_CHANGES', 'GATE_L3_EXECUTE'];
  }
}

// ─────────────────────────────────────────
// OrchestratorAgent 구현
// ─────────────────────────────────────────

/**
 * OrchestratorAgent — 전체 흐름 제어 에이전트.
 * 사용자 요청을 분석하여 실행 계획(OrchestrationPlan)을 생성한다.
 */
export class OrchestratorAgent extends BaseAgent {
  /**
   * OrchestratorAgent를 기본 설정으로 생성한다.
   */
  static create(): OrchestratorAgent {
    const config = getAgentConfig('orchestrator');
    if (config === undefined) {
      throw new Error('orchestrator 에이전트 설정을 찾을 수 없습니다');
    }
    return new OrchestratorAgent(config);
  }

  /**
   * 사용자 요청을 분석하여 OrchestrationPlan을 생성한다.
   * 1. 복잡도 분류 (L1~L4)
   * 2. 에이전트 팀 구성
   * 3. Task DAG 생성
   * 4. 게이트 요구사항 결정
   */
  async execute(
    input: AgentInput,
  ): Promise<Result<AgentOutput, JarvisError>> {
    // 입력 유효성 검사
    const rawInput = input.message.payload.summary;
    if (rawInput.trim() === '') {
      return err(
        new JarvisError({
          code: ErrorCode.VALIDATION_FAILED,
          message: '오케스트레이터: 요청 내용이 비어 있습니다',
          context: { runId: input.runId },
        }),
      );
    }

    this.logAudit({
      runId: input.runId,
      action: `오케스트레이션 시작: "${rawInput.slice(0, 50)}"`,
      result: 'STARTED',
    });

    // 복잡도 분류 (Claude API 또는 휴리스틱)
    const claudeResult = await this.callClaude({
      systemPrompt: this.buildSystemPrompt(),
      userMessage: this.buildUserMessage(rawInput),
      maxTokens: 1024,
    });

    if (!claudeResult.ok) {
      return err(claudeResult.error);
    }

    // 복잡도 평가 수행
    const complexity = assessComplexity(rawInput);
    const taskDag = buildTaskDag(complexity, input.runId);
    const requiredGates = determineRequiredGates(complexity.level);

    const plan: OrchestrationPlan = {
      planId: generateId('orch_'),
      complexity,
      taskDag,
      requiresGates: requiredGates,
    };

    this.logAudit({
      runId: input.runId,
      action: `복잡도 분류 완료: ${complexity.level}`,
      result: 'SUCCESS',
    });

    return ok({
      artifactType: 'PLAN',
      artifactRef: plan.planId,
      summary: `복잡도 ${complexity.level} — ${complexity.requiredAgents.length}개 에이전트 팀 구성`,
      data: plan,
      metadata: {
        complexityLevel: complexity.level,
        agentCount: complexity.requiredAgents.length,
        gateCount: requiredGates.length,
        estimatedDurationSecs: complexity.estimatedDurationSecs,
      },
    });
  }

  /** Orchestrator 시스템 프롬프트 생성 */
  private buildSystemPrompt(): string {
    return `당신은 JARVIS OS의 Orchestrator 에이전트입니다.
사용자 요청의 복잡도를 L1~L4로 분류하고 실행 계획을 세웁니다.

복잡도 레벨 기준:
- L1_SIMPLE: 파일 1개, LOW risk
- L2_MODERATE: 파일 2~5개, 패키지 설치 없음
- L3_COMPLEX: 파일 5개 초과, 네트워크 접근 필요
- L4_DANGEROUS: 외부 서비스 연동, 권한 상승 필요

계약서 §1 절대 금지사항을 반드시 준수하십시오.`;
  }

  /** 사용자 메시지 구성 */
  private buildUserMessage(rawInput: string): string {
    return `다음 요청을 분석하여 복잡도를 평가하십시오:\n\n"${rawInput}"`;
  }
}
