// SSE 이벤트 스트림 라우트 — GET /api/events
import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { sseEmitter } from "../sse/event-emitter.js";

export const eventsRouter: IRouter = Router();

// GET /api/events?sessionId=xxx
eventsRouter.get("/", (req, res) => {
  const sessionId = (req.query["sessionId"] as string) ?? randomUUID();
  sseEmitter.addClient(sessionId, res);
});
