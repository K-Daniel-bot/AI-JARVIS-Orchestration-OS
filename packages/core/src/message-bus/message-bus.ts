// 에이전트 간 메시지 라우팅 버스 — 비동기, 순서 보장, 구독 기반
import type { AgentMessage, AgentType } from "@jarvis/shared";
import type { Result, JarvisError } from "@jarvis/shared";
import { ok, err, createError, ERROR_CODES } from "@jarvis/shared";
import { MessageQueue } from "./message-queue.js";

// 메시지 핸들러 타입
export type MessageHandler = (message: AgentMessage) => Promise<void>;

// 구독 정보
interface Subscription {
  readonly agentType: AgentType;
  readonly handler: MessageHandler;
  readonly subscribedAt: string;
}

// 메시지 버스 — 에이전트 간 구조화된 메시지를 라우팅
export class MessageBus {
  private readonly subscriptions: Map<AgentType, Subscription> = new Map();
  private readonly queue: MessageQueue;

  constructor(timeoutMs?: number) {
    this.queue = new MessageQueue(timeoutMs);
  }

  // 에이전트 메시지 구독 등록
  subscribe(agentType: AgentType, handler: MessageHandler): Result<void, JarvisError> {
    if (this.subscriptions.has(agentType)) {
      return err(createError(
        ERROR_CODES.VALIDATION_FAILED,
        `Agent ${agentType} is already subscribed`,
        { context: { agentType } },
      ));
    }
    this.subscriptions.set(agentType, {
      agentType,
      handler,
      subscribedAt: new Date().toISOString(),
    });
    return ok(undefined);
  }

  // 에이전트 메시지 구독 해제
  unsubscribe(agentType: AgentType): Result<void, JarvisError> {
    if (!this.subscriptions.has(agentType)) {
      return err(createError(
        ERROR_CODES.AGENT_NOT_FOUND,
        `Agent ${agentType} is not subscribed`,
        { context: { agentType } },
      ));
    }
    this.subscriptions.delete(agentType);
    return ok(undefined);
  }

  // 메시지 발행 — 대상 에이전트 큐에 추가 후 처리
  async publish(message: AgentMessage): Promise<Result<void, JarvisError>> {
    const targetAgent = message.toAgent;

    // 대상 에이전트 구독 여부 확인
    if (!this.subscriptions.has(targetAgent)) {
      return err(createError(
        ERROR_CODES.MESSAGE_DELIVERY_FAILED,
        `No subscriber for agent ${targetAgent}`,
        {
          context: {
            messageId: message.messageId,
            fromAgent: message.fromAgent,
            toAgent: targetAgent,
          },
        },
      ));
    }

    // 큐에 추가
    this.queue.enqueue(message);

    // 비동기 처리 시작
    await this.processQueue(targetAgent);

    return ok(undefined);
  }

  // 대상 에이전트 큐 처리 — Promise 체인으로 순서 보장 + 핸들러 에러 격리
  private readonly processingPromises: Map<AgentType, Promise<void>> = new Map();

  private async processQueue(agentType: AgentType): Promise<void> {
    // 이전 처리가 진행 중이면 체인에 연결하여 순차 실행 보장
    const previous = this.processingPromises.get(agentType) ?? Promise.resolve();
    const current = previous.then(async () => {
      let message = this.queue.dequeue(agentType);
      while (message !== undefined) {
        const subscription = this.subscriptions.get(agentType);
        if (subscription) {
          try {
            await subscription.handler(message);
          } catch (handlerError: unknown) {
            // 핸들러 에러를 격리하되 로깅 — 한 메시지 실패가 나머지 큐 처리를 막지 않음
            // eslint-disable-next-line no-console
            console.error(`[MessageBus] ${agentType} 핸들러 에러:`, handlerError);
          }
        }
        message = this.queue.dequeue(agentType);
      }
    });
    this.processingPromises.set(agentType, current);
    await current;
  }

  // 구독된 에이전트 목록 반환
  getSubscribedAgents(): readonly AgentType[] {
    return [...this.subscriptions.keys()];
  }

  // 특정 에이전트의 큐 크기 반환
  getQueueSize(agentType: AgentType): number {
    return this.queue.size(agentType);
  }

  // 전체 큐 크기 반환
  getTotalQueueSize(): number {
    return this.queue.totalSize();
  }

  // 만료된 메시지 정리
  purgeExpired(): number {
    return this.queue.purgeAllExpired();
  }

  // 전체 초기화
  reset(): void {
    this.subscriptions.clear();
    this.queue.clearAll();
    this.processingPromises.clear();
  }
}
