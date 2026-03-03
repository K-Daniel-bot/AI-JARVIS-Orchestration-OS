// 시스템 상태 API 라우트 — GET /api/system/status
import { Router, type IRouter } from "express";
import type { SystemStatusDto } from "./types.js";

export const systemRouter: IRouter = Router();

// GET /api/system/status
systemRouter.get("/status", (_req, res) => {
  const status: SystemStatusDto = {
    currentState: "IDLE",
    trustMode: "semi-auto",
    activeRunId: null,
    sessionId: "sess_server_001",
    connectedAt: new Date().toISOString(),
    agentHealth: [
      { agentType: "orchestrator", agentId: "agt_orch_001", status: "HEALTHY", currentTask: null, lastActiveAt: new Date().toISOString(), consecutiveFailures: 0 },
      { agentType: "spec-agent",   agentId: "agt_spec_001", status: "HEALTHY", currentTask: null, lastActiveAt: new Date().toISOString(), consecutiveFailures: 0 },
      { agentType: "policy-risk",  agentId: "agt_pol_001",  status: "HEALTHY", currentTask: null, lastActiveAt: new Date().toISOString(), consecutiveFailures: 0 },
      { agentType: "planner",      agentId: "agt_plan_001", status: "HEALTHY", currentTask: null, lastActiveAt: new Date().toISOString(), consecutiveFailures: 0 },
      { agentType: "codegen",      agentId: "agt_code_001", status: "HEALTHY", currentTask: null, lastActiveAt: new Date().toISOString(), consecutiveFailures: 0 },
      { agentType: "review",       agentId: "agt_rev_001",  status: "HEALTHY", currentTask: null, lastActiveAt: new Date().toISOString(), consecutiveFailures: 0 },
      { agentType: "test-build",   agentId: "agt_test_001", status: "HEALTHY", currentTask: null, lastActiveAt: new Date().toISOString(), consecutiveFailures: 0 },
      { agentType: "executor",     agentId: "agt_exec_001", status: "HEALTHY", currentTask: null, lastActiveAt: new Date().toISOString(), consecutiveFailures: 0 },
      { agentType: "rollback",     agentId: "agt_roll_001", status: "HEALTHY", currentTask: null, lastActiveAt: new Date().toISOString(), consecutiveFailures: 0 },
    ],
    pendingGates: 0,
    riskLevel: "LOW",
    riskScore: 0,
    capabilityTtlSeconds: null,
  };
  res.json({ success: true, data: status, error: null, timestamp: new Date().toISOString(), requestId: crypto.randomUUID() });
});
