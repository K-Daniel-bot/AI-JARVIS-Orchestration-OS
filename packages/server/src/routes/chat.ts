// 채팅 API 라우트 — GET /api/chat, POST /api/chat
import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import { successResponse } from "./types.js";
import { sseEmitter } from "../sse/event-emitter.js";
import { jarvisRuntime } from "../runtime/jarvis-runtime.js";

export const chatRouter: IRouter = Router();

// 인메모리 메시지 스토어 (Phase 1 — DB 교체는 Phase 2)
const messageStore: Array<{
  messageId: string;
  role: "USER" | "JARVIS" | "SYSTEM";
  content: string;
  timestamp: string;
  runId: string | null;
  contextBadge: string;
  isVoice: boolean;
}> = [];

// GET /api/chat — 채팅 이력 조회
chatRouter.get("/", (req, res) => {
  const runId = req.query["runId"] as string | undefined;
  const filtered = runId
    ? messageStore.filter((m) => m.runId === runId)
    : messageStore;
  res.json(successResponse(filtered));
});

// POST /api/chat — 메시지 전송 → 에이전트 파이프라인 시작
chatRouter.post("/", (req, res) => {
  const { content, trustMode, isVoice } = req.body as {
    content: string;
    trustMode: string;
    isVoice?: boolean;
  };

  if (!content?.trim()) {
    res.status(400).json({ success: false, data: null, error: { code: "VALIDATION_FAILED", message: "content가 비어있습니다" }, timestamp: new Date().toISOString(), requestId: randomUUID() });
    return;
  }

  const sessionId = (req.headers["x-session-id"] as string) ?? `sess_${randomUUID().slice(0, 8)}`;

  // 사용자 메시지 저장
  const userMsg = {
    messageId: randomUUID(),
    role: "USER" as const,
    content: content.trim(),
    timestamp: new Date().toISOString(),
    runId: null as string | null,
    contextBadge: trustMode === "observe" ? "OBSERVE_ONLY" : "MAY_TRIGGER_ACTIONS",
    isVoice: isVoice ?? false,
  };

  // JarvisRuntime으로 파이프라인 시작 (비동기 — HTTP 즉시 반환)
  try {
    const runId = jarvisRuntime.startRun(content.trim(), sessionId, trustMode);
    userMsg.runId = runId;
  } catch (e: unknown) {
    console.error("[chat] 파이프라인 시작 실패:", e);
    // 파이프라인 실패해도 메시지는 저장
  }

  messageStore.push(userMsg);
  sseEmitter.broadcast("CHAT_MESSAGE_ADDED", { message: userMsg });

  res.json(successResponse(userMsg));
});
