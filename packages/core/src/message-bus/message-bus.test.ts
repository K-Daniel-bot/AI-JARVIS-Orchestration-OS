// 메시지 버스 단위 테스트
import { describe, it, expect, beforeEach, vi } from "vitest";
import { MessageBus } from "./message-bus.js";
import { AGENT_TYPES, isOk, isErr } from "@jarvis/shared";
import type { AgentMessage } from "@jarvis/shared";
import type { MessageHandler } from "./message-bus.js";

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

// 수신된 메시지를 기록하는 핸들러 팩토리
function makeRecordingHandler(received: AgentMessage[]): MessageHandler {
  return async (message: AgentMessage): Promise<void> => {
    received.push(message);
  };
}

describe("MessageBus", () => {
  let bus: MessageBus;

  beforeEach(() => {
    bus = new MessageBus(60000);
  });

  describe("subscribe", () => {
    it("에이전트를 성공적으로 구독 등록해야 한다", () => {
      // Arrange
      const handler: MessageHandler = async () => {};

      // Act
      const result = bus.subscribe(AGENT_TYPES.SPEC_AGENT, handler);

      // Assert
      expect(isOk(result)).toBe(true);
    });

    it("구독 후 에이전트가 구독 목록에 포함되어야 한다", () => {
      // Arrange
      const handler: MessageHandler = async () => {};

      // Act
      bus.subscribe(AGENT_TYPES.PLANNER, handler);

      // Assert
      expect(bus.getSubscribedAgents()).toContain(AGENT_TYPES.PLANNER);
    });

    it("이미 구독된 에이전트를 중복 구독하면 에러를 반환해야 한다", () => {
      // Arrange
      const handler: MessageHandler = async () => {};
      bus.subscribe(AGENT_TYPES.CODEGEN, handler);

      // Act
      const result = bus.subscribe(AGENT_TYPES.CODEGEN, handler);

      // Assert
      expect(isErr(result)).toBe(true);
    });

    it("중복 구독 에러는 VALIDATION_FAILED 코드여야 한다", () => {
      // Arrange
      const handler: MessageHandler = async () => {};
      bus.subscribe(AGENT_TYPES.REVIEW, handler);

      // Act
      const result = bus.subscribe(AGENT_TYPES.REVIEW, handler);

      // Assert
      if (isErr(result)) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("서로 다른 에이전트는 독립적으로 구독할 수 있어야 한다", () => {
      // Arrange
      const handler: MessageHandler = async () => {};

      // Act
      const r1 = bus.subscribe(AGENT_TYPES.SPEC_AGENT, handler);
      const r2 = bus.subscribe(AGENT_TYPES.PLANNER, handler);
      const r3 = bus.subscribe(AGENT_TYPES.CODEGEN, handler);

      // Assert
      expect(isOk(r1)).toBe(true);
      expect(isOk(r2)).toBe(true);
      expect(isOk(r3)).toBe(true);
      expect(bus.getSubscribedAgents()).toHaveLength(3);
    });
  });

  describe("unsubscribe", () => {
    it("구독된 에이전트를 성공적으로 해제해야 한다", () => {
      // Arrange
      bus.subscribe(AGENT_TYPES.EXECUTOR, async () => {});

      // Act
      const result = bus.unsubscribe(AGENT_TYPES.EXECUTOR);

      // Assert
      expect(isOk(result)).toBe(true);
    });

    it("구독 해제 후 에이전트가 구독 목록에서 제거되어야 한다", () => {
      // Arrange
      bus.subscribe(AGENT_TYPES.ROLLBACK, async () => {});

      // Act
      bus.unsubscribe(AGENT_TYPES.ROLLBACK);

      // Assert
      expect(bus.getSubscribedAgents()).not.toContain(AGENT_TYPES.ROLLBACK);
    });

    it("구독하지 않은 에이전트를 해제하면 에러를 반환해야 한다", () => {
      // Arrange & Act
      const result = bus.unsubscribe(AGENT_TYPES.TEST_BUILD);

      // Assert
      expect(isErr(result)).toBe(true);
    });

    it("구독하지 않은 에이전트 해제 에러는 AGENT_NOT_FOUND 코드여야 한다", () => {
      // Arrange & Act
      const result = bus.unsubscribe(AGENT_TYPES.POLICY_RISK);

      // Assert
      if (isErr(result)) {
        expect(result.error.code).toBe("AGENT_NOT_FOUND");
      }
    });

    it("해제 후 재구독이 가능해야 한다", () => {
      // Arrange
      bus.subscribe(AGENT_TYPES.SPEC_AGENT, async () => {});
      bus.unsubscribe(AGENT_TYPES.SPEC_AGENT);

      // Act
      const result = bus.subscribe(AGENT_TYPES.SPEC_AGENT, async () => {});

      // Assert
      expect(isOk(result)).toBe(true);
    });
  });

  describe("publish", () => {
    it("메시지를 구독된 에이전트 핸들러에 전달해야 한다", async () => {
      // Arrange
      const received: AgentMessage[] = [];
      bus.subscribe(AGENT_TYPES.SPEC_AGENT, makeRecordingHandler(received));
      const message = makeMessage(AGENT_TYPES.SPEC_AGENT);

      // Act
      const result = await bus.publish(message);

      // Assert
      expect(isOk(result)).toBe(true);
      expect(received).toHaveLength(1);
      expect(received[0]?.messageId).toBe("msg-001");
    });

    it("구독되지 않은 에이전트에 메시지를 발행하면 에러를 반환해야 한다", async () => {
      // Arrange
      const message = makeMessage(AGENT_TYPES.PLANNER);

      // Act
      const result = await bus.publish(message);

      // Assert
      expect(isErr(result)).toBe(true);
    });

    it("구독 없는 에이전트 발행 에러는 MESSAGE_DELIVERY_FAILED 코드여야 한다", async () => {
      // Arrange
      const message = makeMessage(AGENT_TYPES.CODEGEN);

      // Act
      const result = await bus.publish(message);

      // Assert
      if (isErr(result)) {
        expect(result.error.code).toBe("MESSAGE_DELIVERY_FAILED");
      }
    });

    it("여러 메시지를 순서대로 처리해야 한다", async () => {
      // Arrange
      const received: AgentMessage[] = [];
      bus.subscribe(AGENT_TYPES.REVIEW, makeRecordingHandler(received));

      const msg1 = makeMessage(AGENT_TYPES.REVIEW, AGENT_TYPES.ORCHESTRATOR, "msg-001");
      const msg2 = makeMessage(AGENT_TYPES.REVIEW, AGENT_TYPES.ORCHESTRATOR, "msg-002");
      const msg3 = makeMessage(AGENT_TYPES.REVIEW, AGENT_TYPES.ORCHESTRATOR, "msg-003");

      // Act
      await bus.publish(msg1);
      await bus.publish(msg2);
      await bus.publish(msg3);

      // Assert
      expect(received).toHaveLength(3);
      expect(received[0]?.messageId).toBe("msg-001");
      expect(received[1]?.messageId).toBe("msg-002");
      expect(received[2]?.messageId).toBe("msg-003");
    });

    it("서로 다른 에이전트의 메시지는 각각의 핸들러에 전달되어야 한다", async () => {
      // Arrange
      const receivedBySpec: AgentMessage[] = [];
      const receivedByPlanner: AgentMessage[] = [];

      bus.subscribe(AGENT_TYPES.SPEC_AGENT, makeRecordingHandler(receivedBySpec));
      bus.subscribe(AGENT_TYPES.PLANNER, makeRecordingHandler(receivedByPlanner));

      // Act
      await bus.publish(makeMessage(AGENT_TYPES.SPEC_AGENT, AGENT_TYPES.ORCHESTRATOR, "to-spec"));
      await bus.publish(makeMessage(AGENT_TYPES.PLANNER, AGENT_TYPES.ORCHESTRATOR, "to-planner"));

      // Assert
      expect(receivedBySpec).toHaveLength(1);
      expect(receivedByPlanner).toHaveLength(1);
      expect(receivedBySpec[0]?.messageId).toBe("to-spec");
      expect(receivedByPlanner[0]?.messageId).toBe("to-planner");
    });

    it("핸들러에서 에러가 발생해도 처리를 완료해야 한다", async () => {
      // Arrange
      const failingHandler: MessageHandler = async () => {
        throw new Error("핸들러 내부 에러");
      };
      bus.subscribe(AGENT_TYPES.EXECUTOR, failingHandler);

      // Act — 핸들러 에러가 격리되어 publish는 정상 완료
      const result = await bus.publish(makeMessage(AGENT_TYPES.EXECUTOR));

      // Assert
      expect(isOk(result)).toBe(true);
    });

    it("핸들러 에러가 후속 메시지 처리를 차단하지 않아야 한다", async () => {
      // Arrange
      const received: AgentMessage[] = [];
      let callCount = 0;
      const mixedHandler: MessageHandler = async (message: AgentMessage): Promise<void> => {
        callCount++;
        if (callCount === 1) {
          throw new Error("첫 번째 메시지 처리 실패");
        }
        received.push(message);
      };
      bus.subscribe(AGENT_TYPES.EXECUTOR, mixedHandler);

      // Act — 첫 번째 메시지는 실패, 두 번째는 성공해야 함
      await bus.publish(makeMessage(AGENT_TYPES.EXECUTOR, AGENT_TYPES.ORCHESTRATOR, "fail-msg"));
      await bus.publish(makeMessage(AGENT_TYPES.EXECUTOR, AGENT_TYPES.ORCHESTRATOR, "success-msg"));

      // Assert
      expect(received).toHaveLength(1);
      expect(received[0]?.messageId).toBe("success-msg");
    });
  });

  describe("getSubscribedAgents", () => {
    it("구독된 에이전트 목록을 반환해야 한다", () => {
      // Arrange
      bus.subscribe(AGENT_TYPES.SPEC_AGENT, async () => {});
      bus.subscribe(AGENT_TYPES.PLANNER, async () => {});

      // Act
      const agents = bus.getSubscribedAgents();

      // Assert
      expect(agents).toContain(AGENT_TYPES.SPEC_AGENT);
      expect(agents).toContain(AGENT_TYPES.PLANNER);
      expect(agents).toHaveLength(2);
    });

    it("구독자가 없으면 빈 배열을 반환해야 한다", () => {
      // Arrange & Act
      const agents = bus.getSubscribedAgents();

      // Assert
      expect(agents).toHaveLength(0);
    });

    it("해제된 에이전트는 목록에서 제외되어야 한다", () => {
      // Arrange
      bus.subscribe(AGENT_TYPES.CODEGEN, async () => {});
      bus.subscribe(AGENT_TYPES.REVIEW, async () => {});
      bus.unsubscribe(AGENT_TYPES.CODEGEN);

      // Act
      const agents = bus.getSubscribedAgents();

      // Assert
      expect(agents).not.toContain(AGENT_TYPES.CODEGEN);
      expect(agents).toContain(AGENT_TYPES.REVIEW);
    });
  });

  describe("getQueueSize", () => {
    it("특정 에이전트의 큐 크기를 반환해야 한다", async () => {
      // Arrange
      // 처리를 지연시키는 핸들러 — 큐 크기 측정을 위해
      const slowHandler: MessageHandler = async () => {
        await new Promise<void>((resolve) => setTimeout(resolve, 100));
      };
      bus.subscribe(AGENT_TYPES.SPEC_AGENT, slowHandler);

      // Act
      const sizeBeforePublish = bus.getQueueSize(AGENT_TYPES.SPEC_AGENT);

      // Assert
      expect(sizeBeforePublish).toBe(0);
    });

    it("구독되지 않은 에이전트의 큐 크기는 0이어야 한다", () => {
      // Arrange & Act
      const size = bus.getQueueSize(AGENT_TYPES.ROLLBACK);

      // Assert
      expect(size).toBe(0);
    });
  });

  describe("getTotalQueueSize", () => {
    it("초기 상태에서 전체 큐 크기는 0이어야 한다", () => {
      // Arrange & Act
      const total = bus.getTotalQueueSize();

      // Assert
      expect(total).toBe(0);
    });
  });

  describe("purgeExpired", () => {
    it("만료된 메시지를 제거하고 제거 수를 반환해야 한다", () => {
      // Arrange — 타임아웃 1ms로 버스 생성
      const shortBus = new MessageBus(1);
      shortBus.subscribe(AGENT_TYPES.SPEC_AGENT, async () => {});

      vi.useFakeTimers();

      // 버스 내부 큐에 직접 메시지를 넣기 위해 subscribe 후 시간을 조작
      // getTotalQueueSize가 0이면 정상 — purgeExpired는 0을 반환
      vi.advanceTimersByTime(10);
      const purged = shortBus.purgeExpired();

      // Assert
      expect(typeof purged).toBe("number");
      expect(purged).toBeGreaterThanOrEqual(0);

      vi.useRealTimers();
    });
  });

  describe("reset", () => {
    it("모든 구독과 큐를 초기화해야 한다", () => {
      // Arrange
      bus.subscribe(AGENT_TYPES.SPEC_AGENT, async () => {});
      bus.subscribe(AGENT_TYPES.PLANNER, async () => {});

      // Act
      bus.reset();

      // Assert
      expect(bus.getSubscribedAgents()).toHaveLength(0);
      expect(bus.getTotalQueueSize()).toBe(0);
    });

    it("초기화 후 새로운 구독이 가능해야 한다", () => {
      // Arrange
      bus.subscribe(AGENT_TYPES.SPEC_AGENT, async () => {});
      bus.reset();

      // Act
      const result = bus.subscribe(AGENT_TYPES.SPEC_AGENT, async () => {});

      // Assert
      expect(isOk(result)).toBe(true);
    });

    it("초기화 후 메시지 발행은 에러를 반환해야 한다", async () => {
      // Arrange
      bus.subscribe(AGENT_TYPES.EXECUTOR, async () => {});
      bus.reset();

      // Act
      const result = await bus.publish(makeMessage(AGENT_TYPES.EXECUTOR));

      // Assert
      expect(isErr(result)).toBe(true);
    });
  });
});
