// JARVIS API 서버 진입점 — Express HTTP 서버 + SSE 이벤트 스트림
import express from "express";
import cors from "cors";
import { randomUUID } from "node:crypto";
import { systemRouter } from "./routes/system.js";
import { chatRouter } from "./routes/chat.js";
import { gatesRouter } from "./routes/gates.js";
import { auditRouter } from "./routes/audit.js";
import { policiesRouter } from "./routes/policies.js";
import { eventsRouter } from "./routes/events.js";
import { emergencyRouter } from "./routes/emergency.js";
import { sseEmitter } from "./sse/event-emitter.js";
import { jarvisRuntime } from "./runtime/jarvis-runtime.js";

const PORT = Number(process.env["PORT"] ?? 3001);

const app = express();

// ─── 미들웨어 ─────────────────────────────────────────────────
app.use(cors({
  origin: ["http://localhost:5173", "http://localhost:3000"],
  credentials: true,
}));
app.use(express.json());

// ─── API 라우트 ───────────────────────────────────────────────
app.use("/api/system",          systemRouter);
app.use("/api/chat",            chatRouter);
app.use("/api/gates",           gatesRouter);
app.use("/api/audit",           auditRouter);
app.use("/api/policies",        policiesRouter);
app.use("/api/events",          eventsRouter);
app.use("/api/emergency-stop",  emergencyRouter);

// 미구현 라우트 스텁 (Phase 1에서 구현)
app.get("/api/runs",             (_req, res) => res.json({ success: true, data: [], error: null, timestamp: new Date().toISOString(), requestId: randomUUID() }));
app.get("/api/runs/:runId",      (_req, res) => res.json({ success: true, data: null, error: null, timestamp: new Date().toISOString(), requestId: randomUUID() }));
app.post("/api/runs",            (_req, res) => res.json({ success: true, data: null, error: null, timestamp: new Date().toISOString(), requestId: randomUUID() }));
app.get("/api/evidence/:id",     (_req, res) => res.json({ success: true, data: null, error: null, timestamp: new Date().toISOString(), requestId: randomUUID() }));
app.get("/api/evidence/:id/content", (_req, res) => res.json({ success: true, data: null, error: null, timestamp: new Date().toISOString(), requestId: randomUUID() }));
app.get("/api/runs/:runId/timeline/:nodeId", (_req, res) => res.json({ success: true, data: null, error: null, timestamp: new Date().toISOString(), requestId: randomUUID() }));

// 상태 확인 엔드포인트
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    version: "0.1.0",
    uptime: process.uptime(),
    sse_connections: sseEmitter.connectionCount,
    timestamp: new Date().toISOString(),
  });
});

// ─── JarvisRuntime 초기화 ────────────────────────────────────
console.log("\n📦 JarvisRuntime 초기화 중...");
jarvisRuntime.initialize();

// ─── 서버 시작 ────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 JARVIS API 서버 시작`);
  console.log(`   API:    http://localhost:${PORT}/api`);
  console.log(`   Health: http://localhost:${PORT}/health`);
  console.log(`   SSE:    http://localhost:${PORT}/api/events`);
  console.log(`\n   프론트엔드: pnpm --filter @jarvis/web dev`);
  console.log(`   (Vite가 /api 요청을 이 서버로 프록시합니다)\n`);
});

// 프로세스 종료 시 정리
process.on("SIGTERM", () => {
  jarvisRuntime.shutdown();
  process.exit(0);
});
process.on("SIGINT", () => {
  jarvisRuntime.shutdown();
  process.exit(0);
});
