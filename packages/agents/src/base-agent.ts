/**
 * BaseAgent — 9개 에이전트 공통 기반 추상 클래스
 * Claude API 호출, 감사 로그 기록, 응답 메시지 생성 등 공통 기능을 제공한다.
 * 각 에이전트는 이 클래스를 상속하고 execute()를 구현해야 한다.
 */

import type { AgentConfig } from '@jarvis/core';
import type {
  AgentMessage,
  AgentName,
  ArtifactType,
  Result,
} from '@jarvis/shared';
import {
  JarvisError,
  ErrorCode,
  ok,
  err,
  generateMessageId,
} from '@jarvis/shared';

// ─────────────────────────────────────────
// 에이전트 입/출력 인터페이스
// ─────────────────────────────────────────

/** 에이전트 실행 입력 — Orchestrator가 에이전트에게 전달하는 데이터 */
export interface AgentInput {
  /** 실행 런 고유 식별자 */
  readonly runId: string;
  /** 세션 고유 식별자 */
  readonly sessionId: string;
  /** Orchestrator로부터 수신한 에이전트 메시지 */
  readonly message: AgentMessage;
  /** 추가 실행 컨텍스트 (정책 결정, 이전 단계 산출물 참조 등) */
  readonly context: Record<string, unknown>;
}

/** 에이전트 실행 출력 — 에이전트가 생성한 산출물 정보 */
export interface AgentOutput {
  /** 산출물 유형 (SPEC, POLICY_DECISION, PLAN 등) */
  readonly artifactType: ArtifactType;
  /** 산출물 경로 또는 ID 참조 */
  readonly artifactRef: string;
  /** 산출물 요약 설명 */
  readonly summary: string;
  /** 산출물 데이터 (에이전트별 구조화된 결과) */
  readonly data: unknown;
  /** 산출물 관련 메타데이터 */
  readonly metadata: Record<string, unknown>;
}

// ─────────────────────────────────────────
// Claude API 호출 파라미터
// ─────────────────────────────────────────

/** Claude API 호출 파라미터 */
interface CallClaudeParams {
  /** 시스템 프롬프트 (에이전트 역할 정의) */
  readonly systemPrompt: string;
  /** 사용자 메시지 (에이전트 작업 내용) */
  readonly userMessage: string;
  /** 최대 응답 토큰 수 (기본값: 4096) */
  readonly maxTokens?: number;
}

/** 감사 로그 기록 파라미터 */
interface LogAuditParams {
  /** 실행 런 ID */
  readonly runId: string;
  /** 수행한 액션 설명 */
  readonly action: string;
  /** 실행 결과 (SUCCESS/FAILED 등) */
  readonly result: string;
}

/** 응답 메시지 생성 파라미터 */
interface CreateResponseParams {
  /** 수신 에이전트 이름 */
  readonly toAgent: AgentName;
  /** 실행 런 ID */
  readonly runId: string;
  /** 산출물 유형 */
  readonly artifactType: ArtifactType;
  /** 산출물 참조 ID */
  readonly artifactRef: string;
  /** 요약 설명 */
  readonly summary: string;
}

// ─────────────────────────────────────────
// 스텁 응답 — API 키 없이 테스트 가능한 기본 응답
// ─────────────────────────────────────────

/** 스텁 모드 응답 생성 — 환경변수 ANTHROPIC_API_KEY 없이 동작 */
function buildStubResponse(agentName: string, userMessage: string): string {
  return JSON.stringify({
    stub: true,
    agent: agentName,
    message: `[STUB] ${agentName} 에이전트 스텁 응답 — 실제 API 키가 없을 때 반환됩니다.`,
    input_summary: userMessage.slice(0, 100),
    timestamp: new Date().toISOString(),
  });
}

// ─────────────────────────────────────────
// BaseAgent 추상 클래스
// ─────────────────────────────────────────

/**
 * BaseAgent — 에이전트 공통 기반 클래스.
 * 9개 에이전트 모두 이 클래스를 상속하며 execute() 메서드를 구현한다.
 *
 * 주요 공통 기능:
 * - callClaude(): Anthropic SDK 기반 Claude API 호출 (스텁 모드 지원)
 * - logAudit(): 감사 로그 기록
 * - createResponse(): Orchestrator로 반환할 AgentMessage 생성
 */
export abstract class BaseAgent {
  /** 에이전트 설정 — 모델, 역할, 도구, 권한 모드 */
  readonly config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
  }

  // ─────────────────────────────────────────
  // 추상 메서드 — 서브클래스에서 반드시 구현
  // ─────────────────────────────────────────

  /**
   * 에이전트 메인 실행 메서드.
   * 각 에이전트 서브클래스에서 구체적인 작업을 구현한다.
   */
  abstract execute(input: AgentInput): Promise<Result<AgentOutput, JarvisError>>;

  // ─────────────────────────────────────────
  // 공통 메서드 — 서브클래스에서 사용
  // ─────────────────────────────────────────

  /**
   * Claude API를 호출하여 텍스트 응답을 반환한다.
   * ANTHROPIC_API_KEY 환경변수가 없으면 스텁 모드로 동작한다.
   *
   * @param params - 시스템 프롬프트, 사용자 메시지, 최대 토큰 수
   * @returns 성공 시 응답 텍스트, 실패 시 JarvisError
   */
  protected async callClaude(
    params: CallClaudeParams,
  ): Promise<Result<string, JarvisError>> {
    const apiKey = process.env['ANTHROPIC_API_KEY'];

    // API 키 미설정 시 스텁 모드 응답 반환
    if (apiKey === undefined || apiKey.trim() === '') {
      const stubResponse = buildStubResponse(
        this.config.name,
        params.userMessage,
      );
      return ok(stubResponse);
    }

    try {
      // 동적 import — 빌드 시 타입 참조를 위해 타입 assertion 사용
      const { default: Anthropic } = await import('@anthropic-ai/sdk');
      const client = new Anthropic({ apiKey });

      const response = await client.messages.create({
        model: this.config.model,
        max_tokens: params.maxTokens ?? 4096,
        system: params.systemPrompt,
        messages: [
          {
            role: 'user',
            content: params.userMessage,
          },
        ],
      });

      // 첫 번째 text 블록을 응답으로 추출
      const firstBlock = response.content[0];
      if (firstBlock === undefined || firstBlock.type !== 'text') {
        return err(
          new JarvisError({
            code: ErrorCode.INTERNAL_ERROR,
            message: 'Claude API가 text 응답을 반환하지 않았습니다',
            context: { agent: this.config.name, contentType: firstBlock?.type },
          }),
        );
      }

      return ok(firstBlock.text);
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : '알 수 없는 API 오류';
      return err(
        new JarvisError({
          code: ErrorCode.INTERNAL_ERROR,
          message: `Claude API 호출 실패: ${message}`,
          cause: error,
          context: { agent: this.config.name },
        }),
      );
    }
  }

  /**
   * 감사 로그를 기록한다.
   * 계약서 §3: 모든 에이전트 작업은 불변 감사 로그에 기록되어야 한다.
   * Phase 0에서는 콘솔 출력으로 대체하며, Phase 1에서 실제 AuditLogger로 교체한다.
   *
   * @param params - 런 ID, 액션 설명, 결과
   */
  protected logAudit(params: LogAuditParams): void {
    // Phase 0: 콘솔 기반 감사 로그 (향후 AuditLogger로 교체)
    const entry = {
      timestamp: new Date().toISOString(),
      agent: this.config.name,
      runId: params.runId,
      action: params.action,
      result: params.result,
    };
    // 감사 로그는 민감 정보를 포함하지 않는 구조화된 형태로 출력
    process.stdout.write(`[AUDIT] ${JSON.stringify(entry)}\n`);
  }

  /**
   * Orchestrator로 반환할 AgentMessage를 생성한다.
   * 계약서 §5: 에이전트는 반드시 Orchestrator를 통해 통신한다.
   *
   * @param params - 수신자, 런 ID, 산출물 유형/참조, 요약
   * @returns Orchestrator로 전달할 AgentMessage
   */
  protected createResponse(params: CreateResponseParams): AgentMessage {
    return {
      message_id: generateMessageId(),
      from_agent: this.config.name,
      to_agent: params.toAgent,
      message_type: 'RESPONSE',
      timestamp: new Date().toISOString(),
      run_id: params.runId,
      payload: {
        artifact_type: params.artifactType,
        artifact_ref: params.artifactRef,
        summary: params.summary,
        metadata: {
          agent: this.config.name,
          model: this.config.model,
        },
      },
      timeout_ms: 60_000,
      retry_policy: {
        max_retries: 2,
        backoff_ms: 5_000,
      },
    };
  }
}
