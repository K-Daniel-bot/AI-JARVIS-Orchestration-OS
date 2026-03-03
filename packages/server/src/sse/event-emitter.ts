// SSE 이벤트 에미터 — 연결된 클라이언트에 실시간 이벤트 브로드캐스트
import type { Response } from "express";

// SSE 클라이언트 연결 정보
interface SseClient {
  readonly sessionId: string;
  readonly res: Response;
}

// SSE 이벤트 브로드캐스터 — 전역 싱글톤
class SseEventEmitter {
  private readonly clients = new Map<string, SseClient>();
  private sequenceId = 0;

  // 클라이언트 연결 등록
  addClient(sessionId: string, res: Response): void {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    // 초기 연결 확인 이벤트
    this.sendToClient(res, "CONNECTED", { sessionId });
    this.clients.set(sessionId, { sessionId, res });

    // 연결 해제 처리
    res.on("close", () => {
      this.clients.delete(sessionId);
    });
  }

  // 특정 세션에 이벤트 전송
  sendToSession(sessionId: string, type: string, payload: unknown): void {
    const client = this.clients.get(sessionId);
    if (client) {
      this.sendToClient(client.res, type, payload);
    }
  }

  // 전체 클라이언트에 브로드캐스트
  broadcast(type: string, payload: unknown): void {
    for (const client of this.clients.values()) {
      this.sendToClient(client.res, type, payload);
    }
  }

  // 활성 연결 수
  get connectionCount(): number {
    return this.clients.size;
  }

  // 내부 전송 헬퍼
  private sendToClient(res: Response, type: string, payload: unknown): void {
    this.sequenceId += 1;
    const event = {
      type,
      payload,
      timestamp: new Date().toISOString(),
      sequenceId: this.sequenceId,
    };
    res.write(`data: ${JSON.stringify(event)}\n\n`);
  }
}

// 전역 싱글톤 인스턴스
export const sseEmitter = new SseEventEmitter();
