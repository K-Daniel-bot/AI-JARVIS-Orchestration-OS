// 하단 증거 스트립 — 증거 칩 가로 나열
import React from "react";
import type { EvidenceDto } from "../../api/schema.js";

export interface EvidenceStripProps {
  readonly items: readonly EvidenceDto[];
  readonly onView: (evidenceId: string) => void;
}

const TYPE_ICONS: Record<string, string> = {
  SCREENSHOT:      "📷",
  TERMINAL_LOG:    "📋",
  DIFF:            "📝",
  SCAN_REPORT:     "🔍",
  HASH:            "🔒",
  POLICY_DECISION: "⚖",
  PLAN_JSON:       "📊",
};

export const EvidenceStrip: React.FC<EvidenceStripProps> = ({ items, onView }) => {
  const stripStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 16px",
    overflowX: "auto",
    minHeight: "52px",
    background: "#f8f9fa",
    borderTop: "1px solid #e5e7eb",
  };

  const labelStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 700,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    whiteSpace: "nowrap",
    flexShrink: 0,
    marginRight: "4px",
  };

  const chipStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "5px",
    padding: "4px 10px",
    borderRadius: "20px",
    border: "1px solid #d1d5db",
    background: "#fff",
    fontSize: "12px",
    color: "#374151",
    cursor: "pointer",
    whiteSpace: "nowrap",
    flexShrink: 0,
    transition: "background 0.12s, border-color 0.12s",
  };

  if (items.length === 0) return null;

  return (
    <div style={stripStyle} role="region" aria-label="증거 스트립">
      <span style={labelStyle}>Evidence</span>
      {items.map((item) => (
        <button
          key={item.evidenceId}
          style={chipStyle}
          onClick={() => onView(item.evidenceId)}
          aria-label={`증거 보기: ${item.label}`}
          title={`${item.type} · ${Math.round(item.sizeBytes / 1024)}KB`}
        >
          <span>{TYPE_ICONS[item.type] ?? "📄"}</span>
          <span>{item.label}</span>
          {item.isRedacted && (
            <span style={{ fontSize: "10px", color: "#f59e0b" }}>[R]</span>
          )}
        </button>
      ))}
    </div>
  );
};
