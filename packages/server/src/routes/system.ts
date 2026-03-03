// 시스템 상태 API 라우트 — GET /api/system/status
import { Router, type IRouter } from "express";
import { randomUUID } from "node:crypto";
import type { SystemStatusDto } from "./types.js";
import { jarvisRuntime } from "../runtime/jarvis-runtime.js";

export const systemRouter: IRouter = Router();

// GET /api/system/status — 실제 XState 상태 반환
systemRouter.get("/status", (_req, res) => {
  const activeRun = jarvisRuntime.getActiveRun();
  const currentState = jarvisRuntime.getCurrentState();
  const context = jarvisRuntime.getContext();

  const status: SystemStatusDto = {
    currentState,
    trustMode: (activeRun?.trustMode as SystemStatusDto["trustMode"]) ?? "semi-auto",
    activeRunId: activeRun?.runId ?? null,
    sessionId: activeRun?.sessionId ?? "sess_server_001",
    connectedAt: activeRun?.startedAt ?? new Date().toISOString(),
    agentHealth: [
      { agentType: "orchestrator", agentId: "agt_orch_001", status: "HEALTHY", currentTask: context?.currentAgent === "orchestrator" ? currentState : null, lastActiveAt: new Date().toISOString(), consecutiveFailures: 0 },
      { agentType: "spec-agent",   agentId: "agt_spec_001", status: "HEALTHY", currentTask: context?.currentAgent === "spec-agent" ? currentState : null, lastActiveAt: new Date().toISOString(), consecutiveFailures: 0 },
      { agentType: "policy-risk",  agentId: "agt_pol_001",  status: "HEALTHY", currentTask: context?.currentAgent === "policy-risk" ? currentState : null, lastActiveAt: new Date().toISOString(), consecutiveFailures: 0 },
      { agentType: "planner",      agentId: "agt_plan_001", status: "HEALTHY", currentTask: context?.currentAgent === "planner" ? currentState : null, lastActiveAt: new Date().toISOString(), consecutiveFailures: 0 },
      { agentType: "codegen",      agentId: "agt_code_001", status: "HEALTHY", currentTask: context?.currentAgent === "codegen" ? currentState : null, lastActiveAt: new Date().toISOString(), consecutiveFailures: 0 },
      { agentType: "review",       agentId: "agt_rev_001",  status: "HEALTHY", currentTask: context?.currentAgent === "review" ? currentState : null, lastActiveAt: new Date().toISOString(), consecutiveFailures: 0 },
      { agentType: "test-build",   agentId: "agt_test_001", status: "HEALTHY", currentTask: context?.currentAgent === "test-build" ? currentState : null, lastActiveAt: new Date().toISOString(), consecutiveFailures: 0 },
      { agentType: "executor",     agentId: "agt_exec_001", status: "HEALTHY", currentTask: context?.currentAgent === "executor" ? currentState : null, lastActiveAt: new Date().toISOString(), consecutiveFailures: 0 },
      { agentType: "rollback",     agentId: "agt_roll_001", status: "HEALTHY", currentTask: context?.currentAgent === "rollback" ? currentState : null, lastActiveAt: new Date().toISOString(), consecutiveFailures: 0 },
    ],
    pendingGates: jarvisRuntime.getPendingGatesCount(),
    riskLevel: "LOW",
    riskScore: 0,
    capabilityTtlSeconds: null,
  };
  res.json({ success: true, data: status, error: null, timestamp: new Date().toISOString(), requestId: randomUUID() });
});
