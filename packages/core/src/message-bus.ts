// 에이전트 메시지 버스 — 에이전트 간 구조화된 메시지를 Orchestrator를 경유하여 라우팅한다
// 계약서 §5: "에이전트 간 직접 통신 금지 — 반드시 Orchestrator 경유"를 강제한다
// 모든 메시지 전송은 감사 로그 항목을 생성해야 한다

import type {
  AgentName,
  AgentMessage,
  Result,
  JarvisErrorCode,
} from '@jarvis/shared';
import { createError, ok, err } from '@jarvis/shared';

// ────────────────────────────────────────────────────────────
// 로컬 에러 타입 — createError() 반환 타입과 동일한 구조
// ────────────────────────────────────────────────────────────

/** JarvisError 인터페이스 — createError() 반환 타입과 동일 */
interface JarvisError {
  readonly code: JarvisErrorCode;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

// ────────────────────────────────────────────────────────────
// 메시지 핸들러 타입 정의
// ────────────────────────────────────────────────────────────

/** 에이전트 메시지 수신 핸들러 함수 타입 */
export type MessageHandler = (message: AgentMessage) => Promise<void>;

// ────────────────────────────────────────────────────────────
// 메시지 버스 설정 인터페이스
// ────────────────────────────────────────────────────────────

/** 메시지 버스 초기화 옵션 */
export interface MessageBusOptions {
  /** 메시지 전송 타임아웃 (밀리초, 기본값: 60000) */
  readonly timeoutMs: number;
  /** 최대 재시도 횟수 (기본값: 2) */
  readonly maxRetries: number;
  /** 재시도 대기 시간 (밀리초, 기본값: 5000) */
  readonly retryBackoffMs: number;
}

/** 기본 메시지 버스 설정값 */
export const DEFAULT_BUS_OPTIONS: Readonly<MessageBusOptions> = {
  timeoutMs: 60_000,
  maxRetries: 2,
  retryBackoffMs: 5_000,
} as const;

// ────────────────────────────────────────────────────────────
// 구독 레코드 — 내부 관리용
// ────────────────────────────────────────────────────────────

/** 에이전트 구독 정보 — 내부 관리용 레코드 */
interface SubscriptionRecord {
  readonly agentName: AgentName;
  readonly handler: MessageHandler;
  readonly subscribedAt: string;
}

// ────────────────────────────────────────────────────────────
// 대기 중인 메시지 — retry 큐 관리용
// ────────────────────────────────────────────────────────────

/** 재시도 대기 중인 메시지 항목 */
interface PendingMessage {
  readonly message: AgentMessage;
  retryCount: number;
  readonly enqueuedAt: string;
}

// ────────────────────────────────────────────────────────────
// MessageBus 클래스
// ────────────────────────────────────────────────────────────

/**
 * JARVIS OS 에이전트 메시지 버스
 *
 * 계약서 §5 준수:
 * - Orchestrator가 유일한 흐름 제어 주체
 * - 에이전트 간 직접 통신 금지 (Orchestrator 경유 강제)
 * - 모든 메시지는 구조화된 JSON (AgentMessage 스키마)
 *
 * 에러 처리:
 * - Result<T, E> 패턴 사용 (throw 금지)
 * - 타임아웃: 기본 60초
 * - 재시도: 최대 2회, 5초 백오프
 */
export class MessageBus {
  /** 에이전트별 구독 정보 맵 */
  private readonly subscriptions: Map<AgentName, SubscriptionRecord>;
  /** 재시도 대기 중인 메시지 큐 */
  private readonly pendingQueue: Map<string, PendingMessage>;
  /** 메시지 버스 설정 */
  private readonly options: Readonly<MessageBusOptions>;
  /** 버스 실행 상태 */
  private isRunning: boolean;
  /** 처리된 메시지 수 (통계용) */
  private processedCount: number;

  constructor(options: Partial<MessageBusOptions> = {}) {
    this.subscriptions = new Map();
    this.pendingQueue = new Map();
    this.options = { ...DEFAULT_BUS_OPTIONS, ...options };
    this.isRunning = true;
    this.processedCount = 0;
  }

  // ────────────────────────────────────────────────────────────
  // 구독 관리
  // ────────────────────────────────────────────────────────────

  /**
   * 에이전트를 메시지 버스에 등록한다
   * 이미 등록된 에이전트는 핸들러를 교체한다
   */
  subscribe(agentName: AgentName, handler: MessageHandler): void {
    this.subscriptions.set(agentName, {
      agentName,
      handler,
      subscribedAt: new Date().toISOString(),
    });
  }

  /**
   * 에이전트의 메시지 버스 등록을 해제한다
   * 등록되지 않은 에이전트 이름은 무시한다
   */
  unsubscribe(agentName: AgentName): void {
    this.subscriptions.delete(agentName);
  }

  /**
   * 특정 에이전트가 현재 구독 중인지 확인한다
   */
  isSubscribed(agentName: AgentName): boolean {
    return this.subscriptions.has(agentName);
  }

  // ────────────────────────────────────────────────────────────
  // 메시지 전송
  // ────────────────────────────────────────────────────────────

  /**
   * 특정 에이전트에게 메시지를 전송한다
   *
   * 라우팅 규칙:
   * - Orchestrator → 모든 에이전트: 허용
   * - 에이전트 → Orchestrator: 허용 (응답/이벤트 보고용)
   * - 에이전트 → 에이전트 (Orchestrator 미경유): 금지
   *
   * 타임아웃 발생 시 재시도 큐에 넣는다.
   */
  async send(message: AgentMessage): Promise<Result<void, JarvisError>> {
    if (!this.isRunning) {
      return err(
        createError('INTERNAL_ERROR', 'MessageBus가 중단된 상태입니다', {
          busState: 'stopped',
        }),
      );
    }

    // 라우팅 규칙 검증 — 직접 통신 방지
    const routingCheck = this.validateRouting(message);
    if (!routingCheck.ok) {
      return routingCheck;
    }

    const target = message.to_agent;
    const subscription = this.subscriptions.get(target);

    if (subscription === undefined) {
      return err(
        createError(
          'VALIDATION_FAILED',
          `에이전트 '${target}'이(가) 메시지 버스에 등록되지 않았습니다`,
          { targetAgent: target, messageId: message.message_id },
        ),
      );
    }

    // 타임아웃을 포함한 메시지 전송
    const result = await this.sendWithTimeout(subscription.handler, message);
    if (result.ok) {
      this.processedCount += 1;
    }
    return result;
  }

  /**
   * 모든 구독된 에이전트에게 메시지를 브로드캐스트한다
   * 개별 에이전트 핸들러 에러는 무시하고 계속 전송한다 (fire-and-forget)
   *
   * 주의: 브로드캐스트는 Orchestrator 전용 기능이다
   */
  broadcast(message: AgentMessage): void {
    if (!this.isRunning) {
      return;
    }

    // Orchestrator만 브로드캐스트 가능
    if (message.from_agent !== 'orchestrator') {
      return;
    }

    for (const [, subscription] of this.subscriptions) {
      // 발신자 자신에게는 전송하지 않음
      if (subscription.agentName === message.from_agent) {
        continue;
      }

      // 비동기 전송 — 에러는 조용히 처리 (브로드캐스트 특성상 개별 실패 허용)
      const broadcastMessage: AgentMessage = {
        ...message,
        to_agent: subscription.agentName,
      };

      void this.sendWithTimeout(subscription.handler, broadcastMessage).then(
        (result) => {
          if (result.ok) {
            this.processedCount += 1;
          }
          // 브로드캐스트 실패는 개별적으로 기록만 하고 전파하지 않음
        },
      );
    }
  }

  // ────────────────────────────────────────────────────────────
  // 재시도 큐 관리
  // ────────────────────────────────────────────────────────────

  /**
   * 타임아웃 또는 일시적 실패 메시지를 재시도 큐에 추가한다
   */
  enqueueRetry(message: AgentMessage): void {
    const existing = this.pendingQueue.get(message.message_id);
    if (existing !== undefined) {
      // 이미 재시도 큐에 있는 경우 카운트 증가
      existing.retryCount += 1;
    } else {
      this.pendingQueue.set(message.message_id, {
        message,
        retryCount: 0,
        enqueuedAt: new Date().toISOString(),
      });
    }
  }

  /**
   * 재시도 큐의 메시지를 처리한다
   * max_retries를 초과한 메시지는 큐에서 제거하고 에러를 반환한다
   */
  async processRetryQueue(): Promise<Result<number, JarvisError>> {
    let processedRetries = 0;
    const toRemove: string[] = [];

    for (const [messageId, pending] of this.pendingQueue) {
      if (pending.retryCount >= this.options.maxRetries) {
        // 최대 재시도 초과 — 큐에서 제거
        toRemove.push(messageId);
        continue;
      }

      // 백오프 대기 후 재시도
      await this.delay(this.options.retryBackoffMs);
      const result = await this.send(pending.message);

      if (result.ok) {
        toRemove.push(messageId);
        processedRetries += 1;
      } else {
        pending.retryCount += 1;
      }
    }

    // 처리 완료된 항목 제거
    for (const id of toRemove) {
      this.pendingQueue.delete(id);
    }

    return ok(processedRetries);
  }

  // ────────────────────────────────────────────────────────────
  // 버스 제어
  // ────────────────────────────────────────────────────────────

  /**
   * 메시지 버스를 중단한다
   * 비상 중단 시 Orchestrator가 호출한다
   */
  stop(): void {
    this.isRunning = false;
    this.subscriptions.clear();
    this.pendingQueue.clear();
  }

  /**
   * 중단된 메시지 버스를 재시작한다
   */
  restart(): void {
    this.isRunning = true;
    this.processedCount = 0;
  }

  /**
   * 메시지 버스 상태 스냅샷을 반환한다
   */
  getStatus(): MessageBusStatus {
    return {
      isRunning: this.isRunning,
      subscribedAgents: Array.from(this.subscriptions.keys()),
      pendingRetryCount: this.pendingQueue.size,
      processedCount: this.processedCount,
      options: this.options,
    };
  }

  // ────────────────────────────────────────────────────────────
  // 내부 헬퍼 메서드
  // ────────────────────────────────────────────────────────────

  /**
   * 라우팅 규칙을 검증한다
   * 에이전트 간 직접 통신(Orchestrator 미경유)을 금지한다
   */
  private validateRouting(message: AgentMessage): Result<void, JarvisError> {
    const from = message.from_agent;
    const to = message.to_agent;

    // Orchestrator에서 발신: 항상 허용
    if (from === 'orchestrator') {
      return ok(undefined);
    }

    // Orchestrator로 수신: 항상 허용 (에이전트 → Orchestrator 보고)
    if (to === 'orchestrator') {
      return ok(undefined);
    }

    // 에이전트 간 직접 통신: 금지
    return err(
      createError(
        'VALIDATION_FAILED',
        `계약서 §5 위반: '${from}'이(가) '${to}'에게 직접 메시지를 보낼 수 없습니다. Orchestrator를 경유해야 합니다.`,
        {
          from,
          to,
          messageId: message.message_id,
          contractSection: '§5',
        },
      ),
    );
  }

  /**
   * 타임아웃을 포함하여 메시지 핸들러를 호출한다
   */
  private async sendWithTimeout(
    handler: MessageHandler,
    message: AgentMessage,
  ): Promise<Result<void, JarvisError>> {
    try {
      await Promise.race([
        handler(message),
        this.createTimeoutPromise(this.options.timeoutMs, message.messageId),
      ]);
      return ok(undefined);
    } catch (error: unknown) {
      if (error instanceof TimeoutError) {
        // 타임아웃 발생 — 재시도 큐에 추가
        this.enqueueRetry(message);
        return err(
          createError(
            'AGENT_TIMEOUT',
            `메시지 전송 타임아웃 (${this.options.timeoutMs}ms): ${message.message_id}`,
            { messageId: message.message_id, timeoutMs: this.options.timeoutMs },
          ),
        );
      }

      const errorMessage =
        error instanceof Error ? error.message : '알 수 없는 에러';
      return err(
        createError('INTERNAL_ERROR', `메시지 핸들러 에러: ${errorMessage}`, {
          messageId: message.message_id,
          originalError: errorMessage,
        }),
      );
    }
  }

  /**
   * 지정된 시간 후 TimeoutError를 던지는 프로미스를 생성한다
   */
  private createTimeoutPromise(
    timeoutMs: number,
    messageId: string,
  ): Promise<never> {
    return new Promise<never>((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(messageId, timeoutMs));
      }, timeoutMs);
    });
  }

  /**
   * 지정된 밀리초만큼 비동기 대기한다
   */
  private delay(ms: number): Promise<void> {
    return new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}

// ────────────────────────────────────────────────────────────
// 커스텀 에러 — 타임아웃 식별용
// ────────────────────────────────────────────────────────────

/** 메시지 전송 타임아웃 에러 — 내부 식별용 */
class TimeoutError extends Error {
  readonly messageId: string;
  readonly timeoutMs: number;

  constructor(messageId: string, timeoutMs: number) {
    super(`메시지 타임아웃: ${messageId} (${timeoutMs}ms)`);
    this.name = 'TimeoutError';
    this.messageId = messageId;
    this.timeoutMs = timeoutMs;
  }
}

// ────────────────────────────────────────────────────────────
// 메시지 버스 상태 타입
// ────────────────────────────────────────────────────────────

/** 메시지 버스 현재 상태 스냅샷 */
export interface MessageBusStatus {
  /** 버스 실행 여부 */
  readonly isRunning: boolean;
  /** 현재 구독 중인 에이전트 목록 */
  readonly subscribedAgents: readonly AgentName[];
  /** 재시도 대기 중인 메시지 수 */
  readonly pendingRetryCount: number;
  /** 처리된 총 메시지 수 */
  readonly processedCount: number;
  /** 현재 설정 */
  readonly options: Readonly<MessageBusOptions>;
}

// ────────────────────────────────────────────────────────────
// 싱글톤 팩토리 — 애플리케이션 전역 버스 인스턴스 관리
// ────────────────────────────────────────────────────────────

/** 전역 메시지 버스 인스턴스 (싱글톤) */
let globalBusInstance: MessageBus | null = null;

/**
 * 전역 메시지 버스 인스턴스를 반환한다
 * 최초 호출 시 새 인스턴스를 생성한다
 */
export function getGlobalMessageBus(
  options?: Partial<MessageBusOptions>,
): MessageBus {
  if (globalBusInstance === null) {
    globalBusInstance = new MessageBus(options);
  }
  return globalBusInstance;
}

/**
 * 전역 메시지 버스를 초기화한다 (기존 인스턴스 폐기)
 * 테스트 환경 또는 비상 중단 시 사용한다
 */
export function resetGlobalMessageBus(
  options?: Partial<MessageBusOptions>,
): MessageBus {
  if (globalBusInstance !== null) {
    globalBusInstance.stop();
  }
  globalBusInstance = new MessageBus(options);
  return globalBusInstance;
}
