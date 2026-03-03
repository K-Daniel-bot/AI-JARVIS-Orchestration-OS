// 감사 로그 API 라우트 — GET /api/audit
import { Router, type IRouter } from "express";
import { successResponse } from "./types.js";

export const auditRouter: IRouter = Router();

// GET /api/audit
auditRouter.get("/", (_req, res) => {
  // Phase 0: 빈 감사 로그 반환 (Phase 1에서 @jarvis/audit 연결)
  res.json(successResponse({
    entries: [],
    total: 0,
    hasMore: false,
  }));
});
