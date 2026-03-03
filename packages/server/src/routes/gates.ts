// Gate API 라우트 — GET/POST /api/gates/:gateId
import { Router, type IRouter } from "express";
import { successResponse, errorResponse } from "./types.js";
import { sseEmitter } from "../sse/event-emitter.js";
import { gateResolver } from "../runtime/gate-resolver.js";

export const gatesRouter: IRouter = Router();

// 인메모리 게이트 스토어 (Phase 0 스텁)
const gateStore = new Map<string, Record<string, unknown>>();

// GET /api/gates/:gateId
gatesRouter.get("/:gateId", (req, res) => {
  const gate = gateStore.get(req.params["gateId"] ?? "");
  if (!gate) {
    res.status(404).json(errorResponse("NOT_FOUND", "게이트를 찾을 수 없습니다"));
    return;
  }
  res.json(successResponse(gate));
});

// POST /api/gates/:gateId/approve
gatesRouter.post("/:gateId/approve", (req, res) => {
  const gateId = req.params["gateId"] ?? "";
  const { action, scopeOverride } = req.body as { action: string; scopeOverride?: unknown };

  const gate = gateStore.get(gateId);
  if (!gate) {
    res.status(404).json(errorResponse("NOT_FOUND", "게이트를 찾을 수 없습니다"));
    return;
  }

  const resolution = {
    action,
    decidedAt: new Date().toISOString(),
    decidedBy: "USER",
    scopeOverride: scopeOverride ?? null,
    rejectReason: null,
  };

  const updatedGate = { ...gate, status: "APPROVED", resolution };
  gateStore.set(gateId, updatedGate);

  // gateResolver에 승인 해결 알림 (파이프라인 Promise 해제)
  gateResolver.resolveGate(gateId, { action: "APPROVE", scopeOverride: scopeOverride ?? undefined });

  sseEmitter.broadcast("GATE_RESOLVED", { gateId, resolution });

  res.json(successResponse(updatedGate));
});

// POST /api/gates/:gateId/reject
gatesRouter.post("/:gateId/reject", (req, res) => {
  const gateId = req.params["gateId"] ?? "";
  const { reason } = req.body as { reason: string };

  const gate = gateStore.get(gateId);
  if (!gate) {
    res.status(404).json(errorResponse("NOT_FOUND", "게이트를 찾을 수 없습니다"));
    return;
  }

  const resolution = {
    action: "REJECT",
    decidedAt: new Date().toISOString(),
    decidedBy: "USER",
    scopeOverride: null,
    rejectReason: reason,
  };

  const updatedGate = { ...gate, status: "REJECTED", resolution };
  gateStore.set(gateId, updatedGate);

  // gateResolver에 거부 해결 알림 (파이프라인 Promise 해제)
  gateResolver.resolveGate(gateId, { action: "REJECT", reason });

  sseEmitter.broadcast("GATE_RESOLVED", { gateId, resolution });

  res.json(successResponse(updatedGate));
});

// 게이트 등록 헬퍼 (다른 라우트에서 사용)
export function registerGate(gate: Record<string, unknown>): void {
  const gateId = gate["gateId"] as string;
  gateStore.set(gateId, gate);
}
