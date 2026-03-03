// 채팅 API 라우트 — GET /api/chat, POST /api/chat
import { Router, type IRouter } from "express";
import { successResponse } from "./types.js";
import { sseEmitter } from "../sse/event-emitter.js";

export const chatRouter: IRouter = Router();

// 인메모리 메시지 스토어 (Phase 0 스텁 — Phase 1에서 DB로 교체)
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

// POST /api/chat — 메시지 전송
chatRouter.post("/", (req, res) => {
  const { content, trustMode, isVoice } = req.body as {
    content: string;
    trustMode: string;
    isVoice?: boolean;
  };

  if (!content?.trim()) {
    res.status(400).json({ success: false, data: null, error: { code: "VALIDATION_FAILED", message: "content가 비어있습니다" }, timestamp: new Date().toISOString(), requestId: crypto.randomUUID() });
    return;
  }

  // 사용자 메시지 저장
  const userMsg = {
    messageId: crypto.randomUUID(),
    role: "USER" as const,
    content: content.trim(),
    timestamp: new Date().toISOString(),
    runId: null,
    contextBadge: trustMode === "observe" ? "OBSERVE_ONLY" : "MAY_TRIGGER_ACTIONS",
    isVoice: isVoice ?? false,
  };
  messageStore.push(userMsg);

  // SSE로 메시지 브로드캐스트
  sseEmitter.broadcast("CHAT_MESSAGE_ADDED", { message: userMsg });

  // Phase 0: 즉시 스텁 응답 생성 (실제 Claude API 연결은 Phase 1)
  const jarvisMsg = {
    messageId: crypto.randomUUID(),
    role: "JARVIS" as const,
    content: `[Phase 0 스텁] "${content.trim()}" 요청을 받았습니다. 에이전트 파이프라인은 Phase 1에서 연결됩니다.`,
    timestamp: new Date().toISOString(),
    runId: null,
    contextBadge: "COMPLETED",
    isVoice: false,
  };
  messageStore.push(jarvisMsg);
  sseEmitter.broadcast("CHAT_MESSAGE_ADDED", { message: jarvisMsg });

  res.json(successResponse(userMsg));
});
