// App 루트 컴포넌트 — 전체 상태 관리 + 레이아웃 조립
import React, { useState, useEffect, useCallback } from "react";
import type {
  RunDto,
  ChatMessageDto,
  GateDto,
  AuditEntryDto,
  EvidenceDto,
  GateAction,
  GateScopeDto,
  SseEvent,
  TimelineNodeDetailDto,
  AgentHealthDto,
} from "./api/schema.js";
import { createApiClient } from "./api/client.js";
import { DashboardLayout } from "./components/layout/DashboardLayout.js";
import { TopStatusBar } from "./components/layout/TopStatusBar.js";
import { EvidenceStrip } from "./components/layout/EvidenceStrip.js";
import { ChatPanel } from "./components/chat/ChatPanel.js";
import { TimelinePanel } from "./components/timeline/TimelinePanel.js";
import { SafetyPanel } from "./components/safety/SafetyPanel.js";
import type { TrustMode } from "@jarvis/shared";

// API 클라이언트 초기화 — sessionId를 localStorage에서 관리
const getOrCreateSessionId = (): string => {
  const STORAGE_KEY = "jarvis_session_id";
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored) return stored;
  const newId = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, newId);
  return newId;
};

const api = createApiClient({
  baseUrl: "",           // Vite 프록시가 /api → localhost:3002로 전달
  sessionId: getOrCreateSessionId(),
});

// 목업 초기 상태 (서버 연결 전)
const INITIAL_RUN: RunDto = {
  runId: "run_mock_001",
  sessionId: "sess_mock",
  trustMode: "semi-auto",
  target: "WINDOWS",
  status: "IDLE",
  riskLevel: "LOW",
  riskScore: 0,
  riskTags: [],
  currentStepLabel: "대기 중",
  startedAt: new Date().toISOString(),
  completedAt: null,
  timeline: [],
  openGates: [],
};

export const App: React.FC = () => {
  // ─── 상태 ───────────────────────────────────────────────
  const [run, setRun] = useState<RunDto>(INITIAL_RUN);
  const [messages, setMessages] = useState<readonly ChatMessageDto[]>([]);
  const [auditEntries, setAuditEntries] = useState<readonly AuditEntryDto[]>([]);
  const [evidenceItems, setEvidenceItems] = useState<readonly EvidenceDto[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [policies, setPolicies] = useState<any>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [chatLoading, setChatLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [ttlSeconds, setTtlSeconds] = useState<number | null>(null);
  const [emergencyStopOpen, setEmergencyStopOpen] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- AgentStatusBar에서 사용 예정 (Phase 2+)
  const [agentHealth, setAgentHealth] = useState<readonly AgentHealthDto[]>([]);
  const [systemError, setSystemError] = useState<string | null>(null);

  // ─── 초기 데이터 로드 ────────────────────────────────────
  useEffect(() => {
    const loadInitial = async (): Promise<void> => {
      // 시스템 상태
      const statusResult = await api.system.getStatus();
      if (statusResult.success && statusResult.data) {
        setConnected(true);
        if (statusResult.data.activeRunId) {
          const runResult = await api.runs.get(statusResult.data.activeRunId);
          if (runResult.success && runResult.data) setRun(runResult.data);
        }
        if (statusResult.data.capabilityTtlSeconds !== null) {
          setTtlSeconds(statusResult.data.capabilityTtlSeconds);
        }
      }
      // 감사 로그
      const auditResult = await api.audit.list({ limit: 50 });
      if (auditResult.success && auditResult.data) {
        setAuditEntries(auditResult.data.entries);
      }
      // 정책
      const policyResult = await api.policies.list();
      if (policyResult.success && policyResult.data) {
        setPolicies(policyResult.data);
      }
    };
    void loadInitial();
  }, []);

  // ─── SSE 이벤트 구독 ─────────────────────────────────────
  useEffect(() => {
    const unsubscribe = api.subscribe((event: SseEvent) => {
      setConnected(true);
      switch (event.type) {
        case "RUN_STATUS_CHANGED": {
          const p = event.payload as { runId: string; status: RunDto["status"] };
          setRun((prev) => ({ ...prev, status: p.status }));
          break;
        }
        case "NODE_UPDATED": {
          const p = event.payload as { runId: string; node: RunDto["timeline"][number] };
          setRun((prev) => ({
            ...prev,
            timeline: prev.timeline.some((n) => n.nodeId === p.node.nodeId)
              ? prev.timeline.map((n) => (n.nodeId === p.node.nodeId ? p.node : n))
              : [...prev.timeline, p.node],
          }));
          break;
        }
        case "GATE_OPENED": {
          const p = event.payload as { runId: string; gate: GateDto };
          setRun((prev) => ({
            ...prev,
            openGates: [...prev.openGates, p.gate],
          }));
          break;
        }
        case "GATE_RESOLVED": {
          const p = event.payload as { runId: string; gateId: string; resolution: GateDto["resolution"] };
          setRun((prev) => ({
            ...prev,
            openGates: prev.openGates.map((g) =>
              g.gateId === p.gateId
                ? { ...g, status: "APPROVED" as const, resolution: p.resolution }
                : g,
            ),
          }));
          break;
        }
        case "RISK_UPDATED": {
          const p = event.payload as { riskLevel: RunDto["riskLevel"]; riskScore: number };
          setRun((prev) => ({ ...prev, riskLevel: p.riskLevel, riskScore: p.riskScore }));
          break;
        }
        case "TTL_UPDATED": {
          const p = event.payload as { remainingSeconds: number };
          setTtlSeconds(p.remainingSeconds);
          break;
        }
        case "AUDIT_ENTRY_ADDED": {
          const p = event.payload as { entry: AuditEntryDto };
          setAuditEntries((prev) => [p.entry, ...prev].slice(0, 200));
          break;
        }
        case "CHAT_MESSAGE_ADDED": {
          const p = event.payload as { message: ChatMessageDto };
          setMessages((prev) => [...prev, p.message]);
          break;
        }
        case "RUN_CREATED": {
          const p = event.payload as { runId: string; trustMode: RunDto["trustMode"] };
          setRun((prev) => ({
            ...prev,
            runId: p.runId,
            trustMode: p.trustMode,
            status: "SPEC_ANALYSIS",
            timeline: [],
            openGates: [],
          }));
          break;
        }
        case "EVIDENCE_ADDED": {
          const p = event.payload as { evidence: EvidenceDto };
          setEvidenceItems((prev) => [p.evidence, ...prev].slice(0, 100));
          break;
        }
        case "AGENT_STATUS_CHANGED": {
          const p = event.payload as { agent: AgentHealthDto };
          setAgentHealth((prev) => {
            const exists = prev.some((a) => a.agentId === p.agent.agentId);
            if (exists) return prev.map((a) => (a.agentId === p.agent.agentId ? p.agent : a));
            return [...prev, p.agent];
          });
          break;
        }
        case "EMERGENCY_STOPPED": {
          const p = event.payload as { runId: string; reason: string };
          setRun((prev) =>
            prev.runId === p.runId ? { ...prev, status: "FAILED" } : prev,
          );
          setEmergencyStopOpen(false);
          break;
        }
        case "SYSTEM_ERROR": {
          const p = event.payload as { code: string; message: string };
          setSystemError(`[${p.code}] ${p.message}`);
          // 5초 후 자동 해제
          setTimeout(() => setSystemError(null), 5000);
          break;
        }
        case "EXECUTOR_DISCONNECTED":
          setConnected(false);
          break;
        default:
          break;
      }
    });
    return unsubscribe;
  }, []);

  // ─── 핸들러 ──────────────────────────────────────────────

  // 채팅 메시지 전송
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleSendMessage = useCallback(async (req: any) => {
    setChatLoading(true);
    try {
      // 사용자 메시지 추가 (낙관적 업데이트)
      const userMessage: ChatMessageDto = {
        messageId: crypto.randomUUID(),
        role: "USER",
        content: req.content,
        timestamp: new Date().toISOString(),
        runId: run.runId === "run_mock_001" ? null : run.runId,
        contextBadge: req.trustMode === "observe" ? "OBSERVE_ONLY" : "MAY_TRIGGER_ACTIONS",
        isVoice: req.isVoice ?? false,
      };
      setMessages((prev) => [...prev, userMessage]);

      // 서버에 메시지 전송 — SSE를 통해 응답이 올 때까지 기다림
      const result = await api.chat.send(req);
      if (!result.success) {
        // 에러 발생 시 에러 메시지 표시
        const errorMsg: ChatMessageDto = {
          messageId: crypto.randomUUID(),
          role: "SYSTEM",
          content: `요청 실패: ${result.error?.message || "Unknown error"}`,
          timestamp: new Date().toISOString(),
          runId: run.runId,
          contextBadge: "OBSERVE_ONLY",
          isVoice: false,
        };
        setMessages((prev) => [...prev, errorMsg]);
      }
      // SSE로 JARVIS 응답이 오면 CHAT_MESSAGE_ADDED 이벤트를 통해 추가됨
    } finally {
      setChatLoading(false);
    }
  }, [run.runId]);

  // Gate 승인
  const handleGateApprove = useCallback(async (
    gateId: string,
    action: GateAction,
    scopeOverride?: Partial<GateScopeDto>,
  ) => {
    await api.gates.approve(gateId, { action, scopeOverride });
  }, []);

  // Gate 거절
  const handleGateReject = useCallback(async (gateId: string, reason: string) => {
    await api.gates.reject(gateId, { reason });
  }, []);

  // 타임라인 노드 상세
  const handleNodeDetail = useCallback(async (nodeId: string): Promise<TimelineNodeDetailDto> => {
    const result = await api.timeline.getNodeDetail(run.runId, nodeId);
    if (result.success && result.data) return result.data;
    // 실패 시 빈 상세 반환
    const node = run.timeline.find((n) => n.nodeId === nodeId);
    return {
      nodeId,
      type: node?.type ?? "SPEC",
      status: node?.status ?? "PENDING",
      title: node?.title ?? "",
      summary: null,
      agentType: node?.agentType ?? null,
      startedAt: null,
      completedAt: null,
      durationMs: null,
      riskScore: null,
      riskLevel: null,
      riskTags: [],
      policyRefs: [],
      capabilityIds: [],
      evidenceIds: [],
      isUndoPoint: false,
      gateId: null,
      whyReason: "상세 정보를 불러올 수 없습니다.",
      expectedImpact: {
        filesModified: 0, filesCreated: 0, filesDeleted: 0,
        commandsRun: 0, networkAccess: false, privilegeEscalation: false,
        estimatedSizeBytes: null,
      },
      capabilities: [],
      policyDecision: null,
    };
  }, [run.runId, run.timeline]);

  // Undo (롤백)
  const handleUndoTo = useCallback((_nodeId: string) => {
    // Phase 1에서 실제 롤백 API 연결
    alert("롤백 기능은 Phase 1에서 구현됩니다.");
  }, []);

  // Evidence 보기
  const handleEvidenceView = useCallback(async (evidenceId: string) => {
    const result = await api.evidence.getContentUrl(evidenceId);
    if (result.success && result.data) {
      window.open(result.data.url, "_blank");
    }
  }, []);

  // 긴급 정지
  const handleEmergencyStop = useCallback(async () => {
    if (!window.confirm("⚠️ 모든 실행을 즉시 중단합니다. 계속하시겠습니까?")) return;
    setEmergencyStopOpen(true);
    await api.emergencyStop({ runId: run.runId, reason: "사용자 긴급 정지" });
    setRun((prev) => ({ ...prev, status: "FAILED" }));
    setEmergencyStopOpen(false);
  }, [run.runId]);

  // ─── 렌더링 ──────────────────────────────────────────────
  const trustMode: TrustMode = run.trustMode;

  return (
    <>
      {/* 시스템 에러 배너 */}
      {systemError && (
        <div
          style={{
            position: "fixed", top: 0, left: 0, right: 0, zIndex: 9998,
            background: "#FEF2F2", borderBottom: "2px solid #EF4444",
            padding: "8px 16px", display: "flex", alignItems: "center",
            justifyContent: "space-between", fontSize: "14px", color: "#991B1B",
          }}
          role="alert"
        >
          <span>{systemError}</span>
          <button
            onClick={() => setSystemError(null)}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "16px", color: "#991B1B" }}
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
      )}

      {/* 긴급 정지 오버레이 */}
      {emergencyStopOpen && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(239,68,68,0.18)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          aria-live="assertive"
          role="alert"
        >
          <div style={{
            background: "#fff", borderRadius: "16px", padding: "32px 48px",
            textAlign: "center", boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
          }}>
            <div style={{ fontSize: "40px" }}>⛔</div>
            <div style={{ fontWeight: 700, fontSize: "20px", marginTop: "12px" }}>
              긴급 정지 처리 중...
            </div>
          </div>
        </div>
      )}

      <DashboardLayout
        topBar={
          <TopStatusBar
            trustMode={trustMode}
            riskLevel={run.riskLevel}
            riskScore={run.riskScore}
            currentStep={run.status}
            ttlSeconds={ttlSeconds}
            connected={connected}
            onEmergencyStop={() => { void handleEmergencyStop(); }}
          />
        }
        leftPanel={
          <ChatPanel
            messages={messages}
            trustMode={trustMode}
            onSendMessage={(req) => { void handleSendMessage(req); }}
            loading={chatLoading}
          />
        }
        centerPanel={
          <TimelinePanel
            nodes={run.timeline}
            selectedNodeId={selectedNodeId}
            onNodeSelect={setSelectedNodeId}
            onNodeDetail={handleNodeDetail}
            onUndoTo={handleUndoTo}
          />
        }
        rightPanel={
          <SafetyPanel
            openGates={run.openGates}
            auditEntries={auditEntries}
            evidenceItems={evidenceItems}
            policies={policies}
            activeTab={run.openGates.some((g) => g.status === "OPEN") ? "APPROVAL" : "AUDIT"}
            onGateApprove={(id, action, scope) => { void handleGateApprove(id, action, scope); }}
            onGateReject={(id, reason) => { void handleGateReject(id, reason); }}
            onEvidenceView={(id) => { void handleEvidenceView(id); }}
          />
        }
        evidenceStrip={
          evidenceItems.length > 0
            ? <EvidenceStrip items={evidenceItems} onView={(id) => { void handleEvidenceView(id); }} />
            : undefined
        }
      />
    </>
  );
};
