// SSE 이벤트 에미터 단위 테스트 — 실시간 Server-Sent Events 브로드캐스트 메커니즘 검증

import { describe, it, expect, vi } from "vitest";
import type { Response } from "express";
import { sseEmitter } from "./event-emitter.js";

// -----------------------------------------------------------------------
// Mock Response 팩토리 — express Response 객체를 모킹
// -----------------------------------------------------------------------

interface MockResponseResult {
  res: Response;
  // write()로 전달된 원시 데이터 문자열 목록
  written: string[];
  // 파싱된 SSE 이벤트 페이로드 목록
  parsedEvents: Array<{
    type: string;
    payload: unknown;
    timestamp: string;
    sequenceId: number;
  }>;
  // res.on("close") 핸들러를 외부에서 트리거하기 위한 함수
  triggerClose: () => void;
}

function createMockResponse(): MockResponseResult {
  const written: string[] = [];
  let closeHandler: (() => void) | null = null;

  const parsedEvents: MockResponseResult["parsedEvents"] = [];

  const res = {
    setHeader: vi.fn(),
    flushHeaders: vi.fn(),
    write: vi.fn((data: string) => {
      written.push(data);
      // "data: {...}\n\n" 형식에서 JSON 파싱
      const match = data.match(/^data: (.+)\n\n$/s);
      if (match?.[1]) {
        try {
          parsedEvents.push(JSON.parse(match[1]) as MockResponseResult["parsedEvents"][number]);
        } catch {
          // 파싱 실패 시 무시
        }
      }
      return true;
    }),
    on: vi.fn((event: string, handler: () => void) => {
      if (event === "close") {
        closeHandler = handler;
      }
      return res;
    }),
  } as unknown as Response;

  return {
    res,
    written,
    parsedEvents,
    triggerClose: () => {
      if (closeHandler) closeHandler();
    },
  };
}

// -----------------------------------------------------------------------
// sseEmitter 싱글톤 상태 정리 — 각 테스트 전 등록된 클라이언트 제거
// -----------------------------------------------------------------------

// 테스트용 세션 ID 생성 (테스트마다 고유하게)
let sessionCounter = 0;
function makeSessionId(): string {
  sessionCounter += 1;
  return `test-session-${sessionCounter}`;
}

// addClient 후 close 이벤트로 클라이언트를 제거하는 헬퍼
function removeClient(mock: MockResponseResult): void {
  mock.triggerClose();
}

describe("sseEmitter", () => {
  // 각 테스트마다 이전 테스트 클라이언트가 남지 않도록 독립적 세션 ID 사용
  // (싱글톤이므로 close 이벤트로 정리)

  // -----------------------------------------------------------------------
  // addClient
  // -----------------------------------------------------------------------
  describe("addClient", () => {
    it("SSE 필수 헤더 Content-Type을 설정해야 한다", () => {
      // Arrange
      const sessionId = makeSessionId();
      const mock = createMockResponse();

      // Act
      sseEmitter.addClient(sessionId, mock.res);

      // Assert
      expect(mock.res.setHeader).toHaveBeenCalledWith("Content-Type", "text/event-stream");

      // 정리
      removeClient(mock);
    });

    it("SSE 필수 헤더 Cache-Control을 설정해야 한다", () => {
      // Arrange
      const sessionId = makeSessionId();
      const mock = createMockResponse();

      // Act
      sseEmitter.addClient(sessionId, mock.res);

      // Assert
      expect(mock.res.setHeader).toHaveBeenCalledWith("Cache-Control", "no-cache");

      // 정리
      removeClient(mock);
    });

    it("SSE 필수 헤더 Connection을 설정해야 한다", () => {
      // Arrange
      const sessionId = makeSessionId();
      const mock = createMockResponse();

      // Act
      sseEmitter.addClient(sessionId, mock.res);

      // Assert
      expect(mock.res.setHeader).toHaveBeenCalledWith("Connection", "keep-alive");

      // 정리
      removeClient(mock);
    });

    it("프록시 버퍼링 방지 헤더 X-Accel-Buffering을 설정해야 한다", () => {
      // Arrange
      const sessionId = makeSessionId();
      const mock = createMockResponse();

      // Act
      sseEmitter.addClient(sessionId, mock.res);

      // Assert
      expect(mock.res.setHeader).toHaveBeenCalledWith("X-Accel-Buffering", "no");

      // 정리
      removeClient(mock);
    });

    it("헤더 설정 후 flushHeaders를 호출해야 한다", () => {
      // Arrange
      const sessionId = makeSessionId();
      const mock = createMockResponse();

      // Act
      sseEmitter.addClient(sessionId, mock.res);

      // Assert
      expect(mock.res.flushHeaders).toHaveBeenCalledOnce();

      // 정리
      removeClient(mock);
    });

    it('연결 직후 "CONNECTED" 타입의 초기 이벤트를 전송해야 한다', () => {
      // Arrange
      const sessionId = makeSessionId();
      const mock = createMockResponse();

      // Act
      sseEmitter.addClient(sessionId, mock.res);

      // Assert
      expect(mock.parsedEvents.length).toBeGreaterThanOrEqual(1);
      expect(mock.parsedEvents[0]?.type).toBe("CONNECTED");

      // 정리
      removeClient(mock);
    });

    it("CONNECTED 이벤트 payload에 sessionId가 포함되어야 한다", () => {
      // Arrange
      const sessionId = makeSessionId();
      const mock = createMockResponse();

      // Act
      sseEmitter.addClient(sessionId, mock.res);

      // Assert
      const connectedEvent = mock.parsedEvents[0];
      expect(connectedEvent?.payload).toEqual({ sessionId });

      // 정리
      removeClient(mock);
    });

    it("addClient 후 connectionCount가 증가해야 한다", () => {
      // Arrange
      const beforeCount = sseEmitter.connectionCount;
      const sessionId = makeSessionId();
      const mock = createMockResponse();

      // Act
      sseEmitter.addClient(sessionId, mock.res);

      // Assert
      expect(sseEmitter.connectionCount).toBe(beforeCount + 1);

      // 정리
      removeClient(mock);
    });
  });

  // -----------------------------------------------------------------------
  // 클라이언트 close 이벤트 처리
  // -----------------------------------------------------------------------
  describe("클라이언트 연결 해제 처리", () => {
    it("close 이벤트 발생 시 connectionCount가 감소해야 한다", () => {
      // Arrange
      const sessionId = makeSessionId();
      const mock = createMockResponse();
      sseEmitter.addClient(sessionId, mock.res);
      const countAfterAdd = sseEmitter.connectionCount;

      // Act
      mock.triggerClose();

      // Assert
      expect(sseEmitter.connectionCount).toBe(countAfterAdd - 1);
    });

    it("close 이벤트 발생 후 해당 세션으로 이벤트 전송이 무시되어야 한다", () => {
      // Arrange
      const sessionId = makeSessionId();
      const mock = createMockResponse();
      sseEmitter.addClient(sessionId, mock.res);
      const writtenCountBeforeClose = mock.written.length;

      // Act
      mock.triggerClose();
      sseEmitter.sendToSession(sessionId, "TEST_EVENT", { data: "value" });

      // Assert — close 후에 write가 추가로 호출되지 않아야 함
      expect(mock.written.length).toBe(writtenCountBeforeClose);
    });
  });

  // -----------------------------------------------------------------------
  // sendToSession
  // -----------------------------------------------------------------------
  describe("sendToSession", () => {
    it("대상 세션에만 이벤트를 전송해야 한다", () => {
      // Arrange
      const sessionA = makeSessionId();
      const sessionB = makeSessionId();
      const mockA = createMockResponse();
      const mockB = createMockResponse();
      sseEmitter.addClient(sessionA, mockA.res);
      sseEmitter.addClient(sessionB, mockB.res);
      const writtenBefore = mockB.written.length;

      // Act — A에만 전송
      sseEmitter.sendToSession(sessionA, "ONLY_A", { message: "A용 메시지" });

      // Assert — B는 추가 이벤트를 받지 않아야 함
      expect(mockA.parsedEvents.some((e) => e.type === "ONLY_A")).toBe(true);
      expect(mockB.written.length).toBe(writtenBefore);

      // 정리
      removeClient(mockA);
      removeClient(mockB);
    });

    it("존재하지 않는 세션 ID로 sendToSession 호출 시 예외 없이 무시해야 한다", () => {
      // Arrange & Act & Assert
      expect(() => {
        sseEmitter.sendToSession("non-existent-session-xyz", "TEST", {});
      }).not.toThrow();
    });

    it("전송된 이벤트에 지정한 type이 포함되어야 한다", () => {
      // Arrange
      const sessionId = makeSessionId();
      const mock = createMockResponse();
      sseEmitter.addClient(sessionId, mock.res);

      // Act
      sseEmitter.sendToSession(sessionId, "STATE_CHANGED", { newState: "PLANNING" });

      // Assert
      const stateEvent = mock.parsedEvents.find((e) => e.type === "STATE_CHANGED");
      expect(stateEvent).toBeDefined();
      expect(stateEvent?.payload).toEqual({ newState: "PLANNING" });

      // 정리
      removeClient(mock);
    });

    it("전송된 이벤트에 ISO 형식의 timestamp가 포함되어야 한다", () => {
      // Arrange
      const sessionId = makeSessionId();
      const mock = createMockResponse();
      sseEmitter.addClient(sessionId, mock.res);

      // Act
      sseEmitter.sendToSession(sessionId, "PING", {});

      // Assert
      const pingEvent = mock.parsedEvents.find((e) => e.type === "PING");
      expect(pingEvent?.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);

      // 정리
      removeClient(mock);
    });
  });

  // -----------------------------------------------------------------------
  // broadcast
  // -----------------------------------------------------------------------
  describe("broadcast", () => {
    it("모든 연결된 클라이언트에 이벤트를 전송해야 한다", () => {
      // Arrange
      const sessionA = makeSessionId();
      const sessionB = makeSessionId();
      const sessionC = makeSessionId();
      const mockA = createMockResponse();
      const mockB = createMockResponse();
      const mockC = createMockResponse();
      sseEmitter.addClient(sessionA, mockA.res);
      sseEmitter.addClient(sessionB, mockB.res);
      sseEmitter.addClient(sessionC, mockC.res);

      // Act
      sseEmitter.broadcast("SYSTEM_ALERT", { level: "INFO", message: "시스템 알림" });

      // Assert — 세 클라이언트 모두 SYSTEM_ALERT 수신
      expect(mockA.parsedEvents.some((e) => e.type === "SYSTEM_ALERT")).toBe(true);
      expect(mockB.parsedEvents.some((e) => e.type === "SYSTEM_ALERT")).toBe(true);
      expect(mockC.parsedEvents.some((e) => e.type === "SYSTEM_ALERT")).toBe(true);

      // 정리
      removeClient(mockA);
      removeClient(mockB);
      removeClient(mockC);
    });

    it("연결된 클라이언트가 없을 때 broadcast는 예외 없이 동작해야 한다", () => {
      // 이 테스트는 클라이언트가 없는 상태를 보장하기 어렵지만
      // 현재 테스트 순서와 관계없이 예외가 없음을 확인
      expect(() => {
        sseEmitter.broadcast("EMPTY_BROADCAST", {});
      }).not.toThrow();
    });

    it("broadcast 이벤트에 payload가 정확히 전달되어야 한다", () => {
      // Arrange
      const sessionId = makeSessionId();
      const mock = createMockResponse();
      sseEmitter.addClient(sessionId, mock.res);
      const payload = { runId: "run-001", status: "COMPLETED" };

      // Act
      sseEmitter.broadcast("RUN_COMPLETE", payload);

      // Assert
      const event = mock.parsedEvents.find((e) => e.type === "RUN_COMPLETE");
      expect(event?.payload).toEqual(payload);

      // 정리
      removeClient(mock);
    });
  });

  // -----------------------------------------------------------------------
  // sequenceId 증가 검증
  // -----------------------------------------------------------------------
  describe("sequenceId 증가", () => {
    it("이벤트 전송 시마다 sequenceId가 1씩 증가해야 한다", () => {
      // Arrange
      const sessionId = makeSessionId();
      const mock = createMockResponse();
      sseEmitter.addClient(sessionId, mock.res);

      // addClient 시 CONNECTED 이벤트가 전송되어 첫 sequenceId가 결정됨
      const connectSeq = mock.parsedEvents[0]?.sequenceId ?? 0;

      // Act — 추가로 2개 이벤트 전송
      sseEmitter.sendToSession(sessionId, "EVENT_1", {});
      sseEmitter.sendToSession(sessionId, "EVENT_2", {});

      // Assert — sequenceId가 순서대로 증가
      const event1 = mock.parsedEvents.find((e) => e.type === "EVENT_1");
      const event2 = mock.parsedEvents.find((e) => e.type === "EVENT_2");
      expect(event1?.sequenceId).toBe(connectSeq + 1);
      expect(event2?.sequenceId).toBe(connectSeq + 2);

      // 정리
      removeClient(mock);
    });

    it("broadcast 시 각 클라이언트는 연속적인 sequenceId를 받아야 한다", () => {
      // Arrange
      const sessionA = makeSessionId();
      const sessionB = makeSessionId();
      const mockA = createMockResponse();
      const mockB = createMockResponse();
      sseEmitter.addClient(sessionA, mockA.res);
      sseEmitter.addClient(sessionB, mockB.res);

      // Act
      sseEmitter.broadcast("SHARED_EVENT", { data: "공유 데이터" });

      // Assert — sendToClient가 순차 호출되므로 sequenceId는 연속적
      const eventA = mockA.parsedEvents.find((e) => e.type === "SHARED_EVENT");
      const eventB = mockB.parsedEvents.find((e) => e.type === "SHARED_EVENT");
      expect(eventA?.sequenceId).toBeDefined();
      expect(eventB?.sequenceId).toBeDefined();
      // 두 값의 차이는 정확히 1
      expect(Math.abs((eventA?.sequenceId ?? 0) - (eventB?.sequenceId ?? 0))).toBe(1);

      // 정리
      removeClient(mockA);
      removeClient(mockB);
    });

    it("SSE 데이터는 'data: {...}\\n\\n' 형식이어야 한다", () => {
      // Arrange
      const sessionId = makeSessionId();
      const mock = createMockResponse();
      sseEmitter.addClient(sessionId, mock.res);
      const writtenBefore = mock.written.length;

      // Act
      sseEmitter.sendToSession(sessionId, "FORMAT_CHECK", { value: 42 });

      // Assert — 마지막 write 항목이 SSE 형식에 맞는지 확인
      const lastWritten = mock.written[mock.written.length - 1];
      expect(lastWritten).toMatch(/^data: .+\n\n$/s);
      expect(mock.written.length).toBe(writtenBefore + 1);

      // 정리
      removeClient(mock);
    });
  });

  // -----------------------------------------------------------------------
  // connectionCount
  // -----------------------------------------------------------------------
  describe("connectionCount", () => {
    it("여러 클라이언트 추가 시 connectionCount가 정확히 반영되어야 한다", () => {
      // Arrange
      const beforeCount = sseEmitter.connectionCount;
      const sessions = [makeSessionId(), makeSessionId(), makeSessionId()];
      const mocks = sessions.map(createMockResponse);

      // Act
      sessions.forEach((sid, i) => sseEmitter.addClient(sid, mocks[i]!.res));

      // Assert
      expect(sseEmitter.connectionCount).toBe(beforeCount + 3);

      // 정리
      mocks.forEach(removeClient);
    });

    it("클라이언트 일부만 해제 시 남은 수가 정확해야 한다", () => {
      // Arrange
      const sessionA = makeSessionId();
      const sessionB = makeSessionId();
      const mockA = createMockResponse();
      const mockB = createMockResponse();
      sseEmitter.addClient(sessionA, mockA.res);
      sseEmitter.addClient(sessionB, mockB.res);
      const afterAddCount = sseEmitter.connectionCount;

      // Act — A만 해제
      removeClient(mockA);

      // Assert
      expect(sseEmitter.connectionCount).toBe(afterAddCount - 1);

      // 정리
      removeClient(mockB);
    });
  });
});
