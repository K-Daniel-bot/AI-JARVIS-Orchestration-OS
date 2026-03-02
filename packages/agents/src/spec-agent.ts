/**
 * SpecAgent — 사용자 의도 분석 에이전트
 * 사용자 요청을 분석하여 구조화된 요구사항 명세(SPEC)를 생성한다.
 * 의도 유형 분류, 모호성 탐지, acceptance_criteria 생성을 담당한다.
 * Haiku 4.5 모델을 사용한다.
 */

import { getAgentConfig } from '@jarvis/core';
import type { Result } from '@jarvis/shared';
import {
  JarvisError,
  ErrorCode,
  ok,
  err,
  generateSpecId,
} from '@jarvis/shared';
import { BaseAgent } from './base-agent.js';
import type { AgentInput, AgentOutput } from './base-agent.js';

// ─────────────────────────────────────────
// SPEC 산출물 타입
// ─────────────────────────────────────────

/** 의도 유형 — 사용자 요청의 주요 목적 분류 */
export type IntentType =
  | 'CODE_IMPLEMENTATION'
  | 'FILE_OPERATION'
  | 'APP_LAUNCH'
  | 'WEB_BROWSING'
  | 'SYSTEM_QUERY'
  | 'DATA_ANALYSIS'
  | 'COMMUNICATION'
  | 'CONFIGURATION'
  | 'UNKNOWN';

/** 모호성 수준 */
export type AmbiguityLevel = 'HIGH' | 'MEDIUM' | 'LOW';

/** 모호한 항목 */
export interface AmbiguityItem {
  /** 모호한 항목 설명 */
  readonly field: string;
  /** 모호성 이유 */
  readonly reason: string;
  /** 권장 명확화 질문 */
  readonly clarifyingQuestion: string;
}

/** 요구사항 명세 (SPEC) 산출물 */
export interface SpecArtifact {
  /** SPEC 고유 ID */
  readonly specId: string;
  /** 원본 사용자 요청 */
  readonly rawInput: string;
  /** AI가 해석한 의도 요약 */
  readonly interpretedIntent: string;
  /** 의도 유형 분류 */
  readonly intentType: IntentType;
  /** 모호성 수준 */
  readonly ambiguityLevel: AmbiguityLevel;
  /** 모호한 항목 목록 */
  readonly ambiguities: readonly AmbiguityItem[];
  /** 기능적 요구사항 목록 */
  readonly functionalRequirements: readonly string[];
  /** 비기능적 요구사항 목록 */
  readonly nonFunctionalRequirements: readonly string[];
  /** 완료 조건 목록 */
  readonly acceptanceCriteria: readonly string[];
  /** 영향받는 대상 파일/경로 목록 */
  readonly targets: readonly string[];
  /** 외부 네트워크 접근 필요 여부 */
  readonly requiresWebAccess: boolean;
  /** 로그인/인증 필요 여부 */
  readonly requiresLogin: boolean;
}

// ─────────────────────────────────────────
// 의도 유형 분류 로직
// ─────────────────────────────────────────

/**
 * 사용자 요청에서 의도 유형을 분류한다.
 * 키워드 기반 휴리스틱 분류를 사용한다.
 */
function classifyIntentType(rawInput: string): IntentType {
  const input = rawInput.toLowerCase();

  // 코드 구현 의도
  if (
    ['implement', 'create function', 'write code', 'coding', 'class', 'module',
      '구현', '코드 작성', '함수', '클래스'].some((kw) => input.includes(kw))
  ) {
    return 'CODE_IMPLEMENTATION';
  }

  // 파일 조작 의도
  if (
    ['file', 'folder', 'directory', 'copy', 'move', 'delete', 'rename',
      '파일', '폴더', '디렉토리', '복사', '이동', '삭제'].some((kw) => input.includes(kw))
  ) {
    return 'FILE_OPERATION';
  }

  // 앱 실행 의도
  if (
    ['open', 'launch', 'run app', 'start',
      '열기', '실행', '앱 실행', '시작'].some((kw) => input.includes(kw))
  ) {
    return 'APP_LAUNCH';
  }

  // 웹 브라우징 의도
  if (
    ['browse', 'website', 'url', 'http', 'search web',
      '웹', '브라우저', '사이트', '검색'].some((kw) => input.includes(kw))
  ) {
    return 'WEB_BROWSING';
  }

  // 통신 의도
  if (
    ['email', 'message', 'send', 'chat', 'call',
      '메시지', '전송', '전화', '이메일'].some((kw) => input.includes(kw))
  ) {
    return 'COMMUNICATION';
  }

  // 데이터 분석 의도
  if (
    ['analyze', 'analysis', 'report', 'data', 'chart',
      '분석', '리포트', '데이터', '차트'].some((kw) => input.includes(kw))
  ) {
    return 'DATA_ANALYSIS';
  }

  // 설정/구성 의도
  if (
    ['configure', 'setting', 'config', 'setup',
      '설정', '구성', '셋업'].some((kw) => input.includes(kw))
  ) {
    return 'CONFIGURATION';
  }

  // 시스템 조회 의도
  if (
    ['show', 'list', 'get', 'check', 'status',
      '조회', '확인', '상태', '목록'].some((kw) => input.includes(kw))
  ) {
    return 'SYSTEM_QUERY';
  }

  return 'UNKNOWN';
}

/**
 * 요청 내용의 모호성 수준을 평가한다.
 */
function assessAmbiguity(rawInput: string): {
  level: AmbiguityLevel;
  items: readonly AmbiguityItem[];
} {
  const items: AmbiguityItem[] = [];
  const input = rawInput.toLowerCase();

  // 경로/파일명이 불명확한 경우
  if (
    !input.includes('/') && !input.includes('\\') &&
    ['file', 'folder', '파일', '폴더'].some((kw) => input.includes(kw))
  ) {
    items.push({
      field: 'target_path',
      reason: '대상 경로가 명시되지 않았습니다',
      clarifyingQuestion: '어느 경로의 파일/폴더를 대상으로 하시나요?',
    });
  }

  // 작업 범위가 불명확한 경우
  if (input.includes('some') || input.includes('few') || input.includes('몇몇')) {
    items.push({
      field: 'scope',
      reason: '작업 범위가 모호합니다',
      clarifyingQuestion: '정확히 몇 개의 항목을 처리해야 하나요?',
    });
  }

  if (items.length >= 2) return { level: 'HIGH', items };
  if (items.length === 1) return { level: 'MEDIUM', items };
  return { level: 'LOW', items };
}

/**
 * 의도 유형과 요청 내용을 기반으로 acceptance criteria를 생성한다.
 */
function buildAcceptanceCriteria(
  intentType: IntentType,
  rawInput: string,
): readonly string[] {
  const base = [
    '작업이 에러 없이 완료된다',
    '계약서 §1 절대 금지사항을 위반하지 않는다',
  ];

  switch (intentType) {
    case 'CODE_IMPLEMENTATION':
      return [
        ...base,
        '생성된 코드가 TypeScript strict mode를 통과한다',
        '단위 테스트가 포함된다',
        '기존 코드 스타일을 준수한다',
      ];
    case 'FILE_OPERATION':
      return [
        ...base,
        '파일 권한 내 작업만 수행된다',
        '원본 파일 백업이 생성된다',
      ];
    case 'WEB_BROWSING':
      return [
        ...base,
        '사용자 승인 없이 외부 데이터를 저장하지 않는다',
        '로그인 정보를 로깅하지 않는다',
      ];
    default:
      return [...base, `${rawInput.slice(0, 30)} 작업이 성공적으로 완료된다`];
  }
}

// ─────────────────────────────────────────
// SpecAgent 구현
// ─────────────────────────────────────────

/**
 * SpecAgent — 사용자 의도 분석 및 SPEC 생성 에이전트.
 */
export class SpecAgent extends BaseAgent {
  /**
   * SpecAgent를 기본 설정으로 생성한다.
   */
  static create(): SpecAgent {
    const config = getAgentConfig('spec-agent');
    if (config === undefined) {
      throw new Error('spec-agent 에이전트 설정을 찾을 수 없습니다');
    }
    return new SpecAgent(config);
  }

  /**
   * 사용자 요청을 분석하여 SpecArtifact를 생성한다.
   * 1. 의도 유형 분류
   * 2. 모호성 탐지
   * 3. 기능/비기능 요구사항 추출
   * 4. acceptance criteria 생성
   */
  async execute(
    input: AgentInput,
  ): Promise<Result<AgentOutput, JarvisError>> {
    const rawInput = input.message.payload.summary;

    if (rawInput.trim() === '') {
      return err(
        new JarvisError({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'SpecAgent: 분석할 요청 내용이 비어 있습니다',
          context: { runId: input.runId },
        }),
      );
    }

    this.logAudit({
      runId: input.runId,
      action: `SPEC 분석 시작: "${rawInput.slice(0, 50)}"`,
      result: 'STARTED',
    });

    // Claude API 호출로 의도 분석 강화
    const claudeResult = await this.callClaude({
      systemPrompt: this.buildSystemPrompt(),
      userMessage: rawInput,
      maxTokens: 2048,
    });

    if (!claudeResult.ok) {
      return err(claudeResult.error);
    }

    // 로컬 분류 로직으로 구조화된 SPEC 생성
    const intentType = classifyIntentType(rawInput);
    const ambiguityResult = assessAmbiguity(rawInput);
    const acceptanceCriteria = buildAcceptanceCriteria(intentType, rawInput);

    // 경로/URL 패턴 추출
    const pathPattern = /[a-zA-Z가-힣]:[\\\/][^\s]+|\/[^\s]+/g;
    const urlPattern = /https?:\/\/[^\s]+/g;
    const targets: string[] = [
      ...(rawInput.match(pathPattern) ?? []),
      ...(rawInput.match(urlPattern) ?? []),
    ];

    const spec: SpecArtifact = {
      specId: generateSpecId(),
      rawInput,
      interpretedIntent: claudeResult.value.slice(0, 200),
      intentType,
      ambiguityLevel: ambiguityResult.level,
      ambiguities: ambiguityResult.items,
      functionalRequirements: [
        `사용자 요청 "${rawInput.slice(0, 50)}"을 처리한다`,
        '계약서 §1 절대 금지사항을 준수한다',
      ],
      nonFunctionalRequirements: [
        '감사 로그에 모든 작업을 기록한다',
        '민감 정보를 평문으로 저장하지 않는다',
      ],
      acceptanceCriteria,
      targets,
      requiresWebAccess:
        rawInput.toLowerCase().includes('http') ||
        rawInput.toLowerCase().includes('web') ||
        rawInput.includes('웹'),
      requiresLogin:
        rawInput.toLowerCase().includes('login') ||
        rawInput.includes('로그인'),
    };

    this.logAudit({
      runId: input.runId,
      action: `SPEC 생성 완료: ${spec.specId}, 의도=${intentType}, 모호성=${spec.ambiguityLevel}`,
      result: 'SUCCESS',
    });

    return ok({
      artifactType: 'SPEC',
      artifactRef: spec.specId,
      summary: `의도: ${intentType}, 모호성: ${spec.ambiguityLevel}`,
      data: spec,
      metadata: {
        intentType,
        ambiguityLevel: spec.ambiguityLevel,
        ambiguityCount: spec.ambiguities.length,
        requiresWebAccess: spec.requiresWebAccess,
      },
    });
  }

  /** SpecAgent 시스템 프롬프트 생성 */
  private buildSystemPrompt(): string {
    return `당신은 JARVIS OS의 Spec Agent입니다.
사용자 요청을 분석하여 명확한 요구사항 명세를 생성합니다.

다음을 수행하십시오:
1. 사용자의 핵심 의도를 한 문장으로 요약
2. 모호한 부분이 있으면 명확화 질문 제시
3. 기능적/비기능적 요구사항 목록 작성

계약서 §1 절대 금지사항을 항상 확인하십시오.`;
  }
}
