// 안전 패널 컴포넌트 — 우측 패널 (Approval / Policy / Evidence / Audit 4개 탭)
import React, { useState } from "react";
import type { GateDto, GateAction, GateScopeDto, AuditEntryDto, EvidenceDto, PolicyListDto } from "../../api/schema.js";
import { GateCard } from "./GateCard.js";
import { Badge, riskLevelToVariant } from "../common/Badge.js";
import type { RiskLevel } from "@jarvis/shared";

// 탭 타입
type SafetyTab = "APPROVAL" | "POLICY" | "EVIDENCE" | "AUDIT";

// SafetyPanel Props
export interface SafetyPanelProps {
  readonly openGates: readonly GateDto[];
  readonly auditEntries: readonly AuditEntryDto[];
  readonly evidenceItems: readonly EvidenceDto[];
  readonly policies: PolicyListDto | null;
  readonly activeTab?: SafetyTab;
  readonly onGateApprove: (gateId: string, action: GateAction, scopeOverride?: Partial<GateScopeDto>) => void;
  readonly onGateReject: (gateId: string, reason: string) => void;
  readonly onEvidenceView: (evidenceId: string) => void;
}

// ─────────────────────────────────────────────
// 감사 로그 탭
// ─────────────────────────────────────────────
const AuditTab: React.FC<{ entries: readonly AuditEntryDto[] }> = ({ entries }) => {
  const levelColor: Record<string, string> = {
    DEBUG:    "#9ca3af",
    INFO:     "#374151",
    WARN:     "#f59e0b",
    ERROR:    "#ef4444",
    CRITICAL: "#7f1d1d",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          fontFamily: "monospace",
          fontSize: "11px",
          padding: "8px",
          background: "#0d1117",
          borderRadius: "8px",
          color: "#c9d1d9",
        }}
        role="log"
        aria-label="감사 로그"
        aria-live="polite"
      >
        {entries.length === 0 && (
          <span style={{ color: "#6b7280" }}>감사 로그가 없습니다.</span>
        )}
        {entries.map((entry) => (
          <div
            key={entry.entryId}
            style={{ marginBottom: "4px", borderBottom: "1px solid #21262d", paddingBottom: "4px" }}
          >
            <span style={{ color: "#6b7280" }}>[{entry.timestamp.slice(11, 23)}]</span>
            {" "}
            <span style={{ color: levelColor[entry.logLevel] ?? "#c9d1d9" }}>
              [{entry.logLevel}]
            </span>
            {" "}
            <span style={{ color: "#58a6ff" }}>{entry.agentType}</span>
            {" "}
            <span>{entry.summary}</span>
            {entry.isRedacted && (
              <span style={{ marginLeft: "6px", color: "#f59e0b", fontSize: "10px" }}>[REDACTED]</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// 증거 탭
// ─────────────────────────────────────────────
const EvidenceTab: React.FC<{
  items: readonly EvidenceDto[];
  onView: (evidenceId: string) => void;
}> = ({ items, onView }) => {
  const typeIcons: Record<string, string> = {
    SCREENSHOT:       "📷",
    TERMINAL_LOG:     "📋",
    DIFF:             "📝",
    SCAN_REPORT:      "🔍",
    HASH:             "🔒",
    POLICY_DECISION:  "⚖",
    PLAN_JSON:        "📊",
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {items.length === 0 && (
        <span style={{ color: "#6b7280", fontSize: "12px" }}>증거 항목이 없습니다.</span>
      )}
      {items.map((item) => (
        <div
          key={item.evidenceId}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 10px",
            background: "#f9fafb",
            borderRadius: "8px",
            border: "1px solid #e5e7eb",
            cursor: "pointer",
          }}
          role="button"
          tabIndex={0}
          onClick={() => onView(item.evidenceId)}
          onKeyDown={(e) => e.key === "Enter" && onView(item.evidenceId)}
          aria-label={`증거 보기: ${item.label}`}
        >
          <span style={{ fontSize: "18px" }}>{typeIcons[item.type] ?? "📄"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: "12px", fontWeight: 600, color: "#1e1e2e", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {item.label}
            </div>
            <div style={{ fontSize: "11px", color: "#6b7280" }}>
              {item.type} · {Math.round(item.sizeBytes / 1024)}KB
              {item.isRedacted && " · [REDACTED]"}
            </div>
          </div>
          <span style={{ fontSize: "11px", color: "#4a9eed" }}>열기 →</span>
        </div>
      ))}
    </div>
  );
};

// ─────────────────────────────────────────────
// 정책 탭
// ─────────────────────────────────────────────
const PolicyTab: React.FC<{ policies: PolicyListDto | null }> = ({ policies }) => {
  if (!policies) {
    return <span style={{ color: "#6b7280", fontSize: "12px" }}>정책 정보 없음</span>;
  }

  const policyRowStyle: React.CSSProperties = {
    padding: "6px 8px",
    borderRadius: "6px",
    fontSize: "12px",
    color: "#374151",
    background: "#f9fafb",
    border: "1px solid #e5e7eb",
    marginBottom: "4px",
  };

  return (
    <div>
      <div style={{ fontWeight: 700, fontSize: "11px", color: "#6b7280", marginBottom: "6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        활성 정책 ({policies.active.length})
      </div>
      {policies.active.map((p) => (
        <div key={p.policyId} style={policyRowStyle}>
          <div style={{ fontWeight: 600 }}>{p.name}</div>
          <div style={{ color: "#6b7280", fontSize: "11px", marginTop: "2px" }}>{p.description}</div>
        </div>
      ))}
      {policies.proposed.length > 0 && (
        <>
          <div style={{ fontWeight: 700, fontSize: "11px", color: "#f59e0b", margin: "12px 0 6px", textTransform: "uppercase", letterSpacing: "0.08em" }}>
            제안된 정책 ({policies.proposed.length})
          </div>
          {policies.proposed.map((p) => (
            <div key={p.policyId} style={{ ...policyRowStyle, borderColor: "#f59e0b", background: "#fffbeb" }}>
              <div style={{ fontWeight: 600 }}>{p.name}</div>
              <div style={{ color: "#6b7280", fontSize: "11px", marginTop: "2px" }}>{p.description}</div>
            </div>
          ))}
        </>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────
// SafetyPanel 본체
// ─────────────────────────────────────────────
export const SafetyPanel: React.FC<SafetyPanelProps> = ({
  openGates,
  auditEntries,
  evidenceItems,
  policies,
  activeTab: initialTab = "APPROVAL",
  onGateApprove,
  onGateReject,
  onEvidenceView,
}) => {
  const [activeTab, setActiveTab] = useState<SafetyTab>(initialTab);

  const panelStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "#f8f9fa",
    borderLeft: "1px solid #e5e7eb",
  };

  const tabBarStyle: React.CSSProperties = {
    display: "flex",
    borderBottom: "1px solid #e5e7eb",
    background: "#fff",
  };

  const tabStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "10px 4px",
    fontSize: "12px",
    fontWeight: active ? 700 : 400,
    color: active ? "#1e1e2e" : "#6b7280",
    background: "none",
    border: "none",
    borderBottom: active ? "2px solid #4a9eed" : "2px solid transparent",
    cursor: "pointer",
    transition: "color 0.12s",
  });

  const contentStyle: React.CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: "12px",
  };

  // Approval 탭 뱃지 (미처리 Gate 수)
  const pendingGateCount = openGates.filter((g) => g.status === "OPEN").length;

  return (
    <div style={panelStyle} role="region" aria-label="안전 패널">
      {/* 탭 바 */}
      <div style={tabBarStyle} role="tablist">
        {(["APPROVAL", "POLICY", "EVIDENCE", "AUDIT"] as SafetyTab[]).map((tab) => (
          <button
            key={tab}
            style={tabStyle(activeTab === tab)}
            onClick={() => setActiveTab(tab)}
            role="tab"
            aria-selected={activeTab === tab}
            aria-label={tab}
          >
            {tab === "APPROVAL"
              ? `승인${pendingGateCount > 0 ? ` (${pendingGateCount})` : ""}`
              : tab === "POLICY"
              ? "정책"
              : tab === "EVIDENCE"
              ? "증거"
              : "감사"}
          </button>
        ))}
      </div>

      {/* 탭 콘텐츠 */}
      <div style={contentStyle} role="tabpanel">
        {activeTab === "APPROVAL" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {openGates.length === 0 && (
              <div style={{ color: "#6b7280", fontSize: "13px", textAlign: "center", marginTop: "32px" }}>
                대기 중인 게이트가 없습니다.
              </div>
            )}
            {openGates.map((gate) => (
              <GateCard
                key={gate.gateId}
                gate={gate}
                onApprove={onGateApprove}
                onReject={onGateReject}
              />
            ))}
          </div>
        )}
        {activeTab === "POLICY" && <PolicyTab policies={policies} />}
        {activeTab === "EVIDENCE" && (
          <EvidenceTab items={evidenceItems} onView={onEvidenceView} />
        )}
        {activeTab === "AUDIT" && <AuditTab entries={auditEntries} />}
      </div>
    </div>
  );
};
