// 감사 로그 API 라우트 — GET /api/audit
import { Router, type IRouter } from "express";
import { successResponse } from "./types.js";
import { jarvisRuntime } from "../runtime/jarvis-runtime.js";

export const auditRouter: IRouter = Router();

// GET /api/audit — 실제 SQLite 감사 로그 쿼리
auditRouter.get("/", (req, res) => {
  const store = jarvisRuntime.getAuditStore();
  if (!store) {
    res.json(successResponse({ entries: [], total: 0, hasMore: false }));
    return;
  }

  const runId = req.query["runId"] as string | undefined;
  const limit = Math.min(Number(req.query["limit"] ?? 50), 200);

  let result;
  if (runId) {
    result = store.getByRunId(runId);
  } else {
    result = store.getLatest(limit);
  }

  if (!result.ok) {
    res.json(successResponse({ entries: [], total: 0, hasMore: false }));
    return;
  }

  const entries = result.value;
  res.json(successResponse({
    entries,
    total: entries.length,
    hasMore: entries.length >= limit,
  }));
});
