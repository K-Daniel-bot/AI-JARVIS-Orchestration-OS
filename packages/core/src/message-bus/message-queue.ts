// 인메모리 메시지 큐 — 에이전트별 독립 FIFO 큐, 타임아웃 처리
import type { AgentMessage, AgentType } from "@jarvis/shared";
import { DEFAULT_TTL } from "@jarvis/shared";

// 큐 항목 — 메시지와 메타데이터
interface QueueEntry {
  readonly message: AgentMessage;
  readonly enqueuedAt: number;
}

// 인메모리 메시지 큐 — 에이전트별 독립 큐 관리
export class MessageQueue {
  private readonly queues: Map<AgentType, QueueEntry[]> = new Map();
  private readonly timeoutMs: number;

  constructor(timeoutMs: number = DEFAULT_TTL.MESSAGE_TIMEOUT_MS) {
    this.timeoutMs = timeoutMs;
  }

  // 메시지를 대상 에이전트 큐에 추가
  enqueue(message: AgentMessage): void {
    const targetAgent = message.toAgent;
    if (!this.queues.has(targetAgent)) {
      this.queues.set(targetAgent, []);
    }
    // set 직후이므로 get은 반드시 배열 반환
    this.queues.get(targetAgent)!.push({
      message,
      enqueuedAt: Date.now(),
    });
  }

  // 대상 에이전트 큐에서 메시지 꺼내기 (FIFO)
  dequeue(agentType: AgentType): AgentMessage | undefined {
    const initial = this.queues.get(agentType);
    if (!initial || initial.length === 0) {
      return undefined;
    }
    this.purgeExpired(agentType);
    // purgeExpired가 배열을 교체하므로 새 참조를 가져옴
    const current = this.queues.get(agentType);
    if (!current || current.length === 0) {
      return undefined;
    }
    const entry = current.shift();
    return entry?.message;
  }

  // 대상 에이전트 큐의 첫 번째 메시지 확인 (제거하지 않음)
  peek(agentType: AgentType): AgentMessage | undefined {
    const queue = this.queues.get(agentType);
    if (!queue || queue.length === 0) {
      return undefined;
    }
    return queue[0]?.message;
  }

  // 대상 에이전트 큐 크기 반환
  size(agentType: AgentType): number {
    return this.queues.get(agentType)?.length ?? 0;
  }

  // 전체 큐 크기 반환
  totalSize(): number {
    let total = 0;
    for (const queue of this.queues.values()) {
      total += queue.length;
    }
    return total;
  }

  // 대상 에이전트 큐의 만료된 메시지 제거
  purgeExpired(agentType: AgentType): number {
    const queue = this.queues.get(agentType);
    if (!queue) {
      return 0;
    }
    const now = Date.now();
    const before = queue.length;
    const filtered = queue.filter(
      (entry) => now - entry.enqueuedAt < this.timeoutMs,
    );
    this.queues.set(agentType, filtered);
    return before - filtered.length;
  }

  // 모든 큐의 만료된 메시지 제거
  purgeAllExpired(): number {
    let total = 0;
    for (const agentType of this.queues.keys()) {
      total += this.purgeExpired(agentType);
    }
    return total;
  }

  // 대상 에이전트 큐 초기화
  clear(agentType: AgentType): void {
    this.queues.delete(agentType);
  }

  // 모든 큐 초기화
  clearAll(): void {
    this.queues.clear();
  }
}
