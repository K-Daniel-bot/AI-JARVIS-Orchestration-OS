// 인메모리 메시지 큐 단위 테스트
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MessageQueue } from "./message-queue.js";
import { AGENT_TYPES } from "@jarvis/shared";
import type { AgentMessage } from "@jarvis/shared";

// 테스트용 AgentMessage 픽스처 생성 헬퍼
function makeMessage(
  toAgent: AgentMessage["toAgent"],
  fromAgent: AgentMessage["fromAgent"] = AGENT_TYPES.ORCHESTRATOR,
  messageId = "msg-001",
): AgentMessage {
  return {
    messageId,
    fromAgent,
    toAgent,
    messageType: "HANDOFF",
    timestamp: new Date().toISOString(),
    runId: "run-001",
    payload: {
      artifactType: "SPEC",
      artifactRef: "ref-001",
      summary: "테스트 메시지",
      metadata: {},
    },
    timeoutMs: 5000,
    retryPolicy: {
      maxRetries: 3,
      backoffMs: 100,
    },
  };
}

describe("MessageQueue", () => {
  let queue: MessageQueue;

  beforeEach(() => {
    // 기본 타임아웃 60초로 큐 초기화
    queue = new MessageQueue(60000);
  });

  describe("enqueue", () => {
    it("메시지를 대상 에이전트 큐에 추가해야 한다", () => {
      // Arrange
      const message = makeMessage(AGENT_TYPES.SPEC_AGENT);

      // Act
      queue.enqueue(message);

      // Assert
      expect(queue.size(AGENT_TYPES.SPEC_AGENT)).toBe(1);
    });

    it("같은 에이전트에 여러 메시지를 추가할 수 있어야 한다", () => {
      // Arrange
      const msg1 = makeMessage(AGENT_TYPES.PLANNER, AGENT_TYPES.ORCHESTRATOR, "msg-001");
      const msg2 = makeMessage(AGENT_TYPES.PLANNER, AGENT_TYPES.ORCHESTRATOR, "msg-002");

      // Act
      queue.enqueue(msg1);
      queue.enqueue(msg2);

      // Assert
      expect(queue.size(AGENT_TYPES.PLANNER)).toBe(2);
    });

    it("서로 다른 에이전트의 큐는 독립적이어야 한다", () => {
      // Arrange
      const msgToSpec = makeMessage(AGENT_TYPES.SPEC_AGENT, AGENT_TYPES.ORCHESTRATOR, "msg-001");
      const msgToPlanner = makeMessage(AGENT_TYPES.PLANNER, AGENT_TYPES.ORCHESTRATOR, "msg-002");

      // Act
      queue.enqueue(msgToSpec);
      queue.enqueue(msgToPlanner);

      // Assert
      expect(queue.size(AGENT_TYPES.SPEC_AGENT)).toBe(1);
      expect(queue.size(AGENT_TYPES.PLANNER)).toBe(1);
    });
  });

  describe("dequeue", () => {
    it("FIFO 순서로 메시지를 꺼내야 한다", () => {
      // Arrange
      const msg1 = makeMessage(AGENT_TYPES.CODEGEN, AGENT_TYPES.PLANNER, "msg-001");
      const msg2 = makeMessage(AGENT_TYPES.CODEGEN, AGENT_TYPES.PLANNER, "msg-002");
      queue.enqueue(msg1);
      queue.enqueue(msg2);

      // Act
      const first = queue.dequeue(AGENT_TYPES.CODEGEN);
      const second = queue.dequeue(AGENT_TYPES.CODEGEN);

      // Assert
      expect(first?.messageId).toBe("msg-001");
      expect(second?.messageId).toBe("msg-002");
    });

    it("빈 큐에서 undefined를 반환해야 한다", () => {
      // Arrange & Act
      const result = queue.dequeue(AGENT_TYPES.REVIEW);

      // Assert
      expect(result).toBeUndefined();
    });

    it("존재하지 않는 에이전트 큐에서 undefined를 반환해야 한다", () => {
      // Arrange & Act
      const result = queue.dequeue(AGENT_TYPES.ROLLBACK);

      // Assert
      expect(result).toBeUndefined();
    });

    it("dequeue 후 큐 크기가 줄어야 한다", () => {
      // Arrange
      queue.enqueue(makeMessage(AGENT_TYPES.EXECUTOR, AGENT_TYPES.ORCHESTRATOR, "msg-001"));
      queue.enqueue(makeMessage(AGENT_TYPES.EXECUTOR, AGENT_TYPES.ORCHESTRATOR, "msg-002"));

      // Act
      queue.dequeue(AGENT_TYPES.EXECUTOR);

      // Assert
      expect(queue.size(AGENT_TYPES.EXECUTOR)).toBe(1);
    });

    it("모든 메시지를 dequeue하면 큐가 비어야 한다", () => {
      // Arrange
      queue.enqueue(makeMessage(AGENT_TYPES.SPEC_AGENT));

      // Act
      queue.dequeue(AGENT_TYPES.SPEC_AGENT);

      // Assert
      expect(queue.size(AGENT_TYPES.SPEC_AGENT)).toBe(0);
    });
  });

  describe("peek", () => {
    it("첫 번째 메시지를 제거하지 않고 반환해야 한다", () => {
      // Arrange
      const msg = makeMessage(AGENT_TYPES.POLICY_RISK);
      queue.enqueue(msg);

      // Act
      const peeked = queue.peek(AGENT_TYPES.POLICY_RISK);

      // Assert
      expect(peeked?.messageId).toBe(msg.messageId);
      expect(queue.size(AGENT_TYPES.POLICY_RISK)).toBe(1);
    });

    it("빈 큐에서 undefined를 반환해야 한다", () => {
      // Arrange & Act
      const result = queue.peek(AGENT_TYPES.CODEGEN);

      // Assert
      expect(result).toBeUndefined();
    });

    it("연속으로 peek해도 같은 메시지를 반환해야 한다", () => {
      // Arrange
      const msg = makeMessage(AGENT_TYPES.PLANNER, AGENT_TYPES.ORCHESTRATOR, "msg-peek");
      queue.enqueue(msg);

      // Act
      const first = queue.peek(AGENT_TYPES.PLANNER);
      const second = queue.peek(AGENT_TYPES.PLANNER);

      // Assert
      expect(first?.messageId).toBe("msg-peek");
      expect(second?.messageId).toBe("msg-peek");
    });

    it("peek은 FIFO 순서에서 첫 번째 메시지를 반환해야 한다", () => {
      // Arrange
      queue.enqueue(makeMessage(AGENT_TYPES.TEST_BUILD, AGENT_TYPES.ORCHESTRATOR, "first"));
      queue.enqueue(makeMessage(AGENT_TYPES.TEST_BUILD, AGENT_TYPES.ORCHESTRATOR, "second"));

      // Act
      const peeked = queue.peek(AGENT_TYPES.TEST_BUILD);

      // Assert
      expect(peeked?.messageId).toBe("first");
    });
  });

  describe("size", () => {
    it("빈 큐의 크기는 0이어야 한다", () => {
      // Arrange & Act
      const result = queue.size(AGENT_TYPES.EXECUTOR);

      // Assert
      expect(result).toBe(0);
    });

    it("메시지 추가 후 크기가 증가해야 한다", () => {
      // Arrange
      queue.enqueue(makeMessage(AGENT_TYPES.REVIEW, AGENT_TYPES.CODEGEN, "msg-001"));
      queue.enqueue(makeMessage(AGENT_TYPES.REVIEW, AGENT_TYPES.CODEGEN, "msg-002"));
      queue.enqueue(makeMessage(AGENT_TYPES.REVIEW, AGENT_TYPES.CODEGEN, "msg-003"));

      // Act
      const result = queue.size(AGENT_TYPES.REVIEW);

      // Assert
      expect(result).toBe(3);
    });
  });

  describe("totalSize", () => {
    it("모든 에이전트 큐의 총 크기를 반환해야 한다", () => {
      // Arrange
      queue.enqueue(makeMessage(AGENT_TYPES.SPEC_AGENT, AGENT_TYPES.ORCHESTRATOR, "msg-001"));
      queue.enqueue(makeMessage(AGENT_TYPES.PLANNER, AGENT_TYPES.ORCHESTRATOR, "msg-002"));
      queue.enqueue(makeMessage(AGENT_TYPES.PLANNER, AGENT_TYPES.ORCHESTRATOR, "msg-003"));

      // Act
      const result = queue.totalSize();

      // Assert
      expect(result).toBe(3);
    });

    it("빈 큐의 총 크기는 0이어야 한다", () => {
      // Arrange & Act
      const result = queue.totalSize();

      // Assert
      expect(result).toBe(0);
    });
  });

  describe("purgeExpired", () => {
    it("만료된 메시지를 제거하고 제거 수를 반환해야 한다", async () => {
      // Arrange — 타임아웃 1ms로 큐 생성
      const shortQueue = new MessageQueue(1);
      shortQueue.enqueue(makeMessage(AGENT_TYPES.SPEC_AGENT));

      // 타임아웃 초과를 위해 시간 조작
      vi.useFakeTimers();
      vi.advanceTimersByTime(10);

      // Act
      const purged = shortQueue.purgeExpired(AGENT_TYPES.SPEC_AGENT);

      // Assert
      expect(purged).toBe(1);
      expect(shortQueue.size(AGENT_TYPES.SPEC_AGENT)).toBe(0);

      vi.useRealTimers();
    });

    it("만료되지 않은 메시지는 제거하지 않아야 한다", () => {
      // Arrange — 긴 타임아웃으로 큐 생성
      const longQueue = new MessageQueue(60000);
      longQueue.enqueue(makeMessage(AGENT_TYPES.SPEC_AGENT));

      // Act
      const purged = longQueue.purgeExpired(AGENT_TYPES.SPEC_AGENT);

      // Assert
      expect(purged).toBe(0);
      expect(longQueue.size(AGENT_TYPES.SPEC_AGENT)).toBe(1);
    });

    it("존재하지 않는 에이전트 큐에서 0을 반환해야 한다", () => {
      // Arrange & Act
      const purged = queue.purgeExpired(AGENT_TYPES.ROLLBACK);

      // Assert
      expect(purged).toBe(0);
    });
  });

  describe("purgeAllExpired", () => {
    it("모든 큐의 만료된 메시지를 제거해야 한다", () => {
      // Arrange — 타임아웃 1ms로 큐 생성
      const shortQueue = new MessageQueue(1);
      shortQueue.enqueue(makeMessage(AGENT_TYPES.SPEC_AGENT, AGENT_TYPES.ORCHESTRATOR, "msg-001"));
      shortQueue.enqueue(makeMessage(AGENT_TYPES.PLANNER, AGENT_TYPES.ORCHESTRATOR, "msg-002"));
      shortQueue.enqueue(makeMessage(AGENT_TYPES.CODEGEN, AGENT_TYPES.ORCHESTRATOR, "msg-003"));

      vi.useFakeTimers();
      vi.advanceTimersByTime(10);

      // Act
      const total = shortQueue.purgeAllExpired();

      // Assert
      expect(total).toBe(3);
      expect(shortQueue.totalSize()).toBe(0);

      vi.useRealTimers();
    });

    it("만료되지 않은 메시지가 없으면 0을 반환해야 한다", () => {
      // Arrange & Act
      const total = queue.purgeAllExpired();

      // Assert
      expect(total).toBe(0);
    });
  });

  describe("clear", () => {
    it("특정 에이전트 큐를 초기화해야 한다", () => {
      // Arrange
      queue.enqueue(makeMessage(AGENT_TYPES.EXECUTOR, AGENT_TYPES.ORCHESTRATOR, "msg-001"));
      queue.enqueue(makeMessage(AGENT_TYPES.EXECUTOR, AGENT_TYPES.ORCHESTRATOR, "msg-002"));

      // Act
      queue.clear(AGENT_TYPES.EXECUTOR);

      // Assert
      expect(queue.size(AGENT_TYPES.EXECUTOR)).toBe(0);
    });

    it("다른 에이전트 큐에 영향을 주지 않아야 한다", () => {
      // Arrange
      queue.enqueue(makeMessage(AGENT_TYPES.EXECUTOR, AGENT_TYPES.ORCHESTRATOR, "msg-001"));
      queue.enqueue(makeMessage(AGENT_TYPES.REVIEW, AGENT_TYPES.ORCHESTRATOR, "msg-002"));

      // Act
      queue.clear(AGENT_TYPES.EXECUTOR);

      // Assert
      expect(queue.size(AGENT_TYPES.REVIEW)).toBe(1);
    });
  });

  describe("clearAll", () => {
    it("모든 에이전트 큐를 초기화해야 한다", () => {
      // Arrange
      queue.enqueue(makeMessage(AGENT_TYPES.SPEC_AGENT, AGENT_TYPES.ORCHESTRATOR, "msg-001"));
      queue.enqueue(makeMessage(AGENT_TYPES.PLANNER, AGENT_TYPES.ORCHESTRATOR, "msg-002"));
      queue.enqueue(makeMessage(AGENT_TYPES.CODEGEN, AGENT_TYPES.ORCHESTRATOR, "msg-003"));

      // Act
      queue.clearAll();

      // Assert
      expect(queue.totalSize()).toBe(0);
    });

    it("초기화 후 새로운 메시지를 정상적으로 추가할 수 있어야 한다", () => {
      // Arrange
      queue.enqueue(makeMessage(AGENT_TYPES.SPEC_AGENT));
      queue.clearAll();

      // Act
      queue.enqueue(makeMessage(AGENT_TYPES.SPEC_AGENT, AGENT_TYPES.ORCHESTRATOR, "msg-new"));

      // Assert
      expect(queue.size(AGENT_TYPES.SPEC_AGENT)).toBe(1);
    });
  });
});
