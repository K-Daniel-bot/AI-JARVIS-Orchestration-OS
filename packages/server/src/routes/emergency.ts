// 비상 정지 API 라우트 — POST /api/emergency-stop
import { Router, type IRouter } from "express";
import { successResponse } from "./types.js";
import { sseEmitter } from "../sse/event-emitter.js";

export const emergencyRouter: IRouter = Router();

// POST /api/emergency-stop
emergencyRouter.post("/", (req, res) => {
  const { runId, reason } = req.body as { runId: string; reason: string };

  // 전체 클라이언트에 긴급 정지 이벤트 브로드캐스트
  sseEmitter.broadcast("EMERGENCY_STOPPED", { runId, reason, stoppedAt: new Date().toISOString() });

  res.json(successResponse({
    stopped: true,
    runId: runId ?? "unknown",
    stoppedAt: new Date().toISOString(),
    rollbackPointId: null,
  }));
});
