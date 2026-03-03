// Gate 승인 카드 컴포넌트 — 사용자 승인/거부 인터페이스
import React, { useState, useEffect } from "react";
import type { GateDto, GateAction, GateScopeDto } from "../../api/schema.js";
import { Badge, riskLevelToVariant } from "../common/Badge.js";
import type { RiskLevel } from "@jarvis/shared";

// GateCard Props
export interface GateCardProps {
  readonly gate: GateDto;
  readonly onApprove: (gateId: string, action: GateAction, scopeOverride?: Partial<GateScopeDto>) => void;
  readonly onReject: (gateId: string, reason: string) => void;
  readonly disabled?: boolean;
}

// 버튼 액션 → 라벨
const ACTION_LABELS: Record<GateAction, string> = {
  APPROVE_ONCE:   "Approve once",
  APPROVE_ALWAYS: "Approve always (this scope)",
  REJECT:         "Reject",
  EDIT_SCOPE:     "Edit scope",
};

// TTL 포맷 헬퍼
function formatTtl(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export const GateCard: React.FC<GateCardProps> = ({
  gate,
  onApprove,
  onReject,
  disabled = false,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [rejectMode, setRejectMode] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [ttl, setTtl] = useState(gate.timeoutSeconds);

  // TTL 카운트다운
  useEffect(() => {
    if (gate.status !== "OPEN") return;
    const id = setInterval(() => {
      setTtl((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(id);
  }, [gate.status]);

  const isResolved = gate.status !== "OPEN";
  const isExpired = gate.status === "EXPIRED" || gate.status === "TIMED_OUT" || ttl === 0;

  const cardStyle: React.CSSProperties = {
    border: `2px solid ${
      gate.riskLevel === "CRITICAL" ? "#ef4444"
      : gate.riskLevel === "HIGH"     ? "#f97316"
      : gate.riskLevel === "MEDIUM"   ? "#f59e0b"
      : "#22c55e"
    }`,
    borderRadius: "12px",
    background: isResolved ? "#f8f9fa" : "#fffef0",
    padding: "16px",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    boxShadow: isResolved ? "none" : "0 0 12px rgba(245,158,11,0.15)",
  };

  const titleRowStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  };

  const sectionLabelStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 700,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    marginBottom: "4px",
  };

  const whyItemStyle: React.CSSProperties = {
    fontSize: "12px",
    color: "#374151",
    margin: "2px 0",
    paddingLeft: "8px",
    borderLeft: "2px solid #f59e0b",
  };

  const scopeItemStyle: React.CSSProperties = {
    fontSize: "12px",
    color: "#374151",
    fontFamily: "monospace",
    background: "#f3f4f6",
    padding: "2px 6px",
    borderRadius: "4px",
    display: "inline-block",
    margin: "2px 3px 2px 0",
  };

  const btnBase: React.CSSProperties = {
    flex: 1,
    padding: "7px 10px",
    borderRadius: "7px",
    fontWeight: 600,
    fontSize: "12px",
    cursor: disabled || isResolved || isExpired ? "not-allowed" : "pointer",
    opacity: disabled || isResolved || isExpired ? 0.5 : 1,
    border: "none",
    transition: "opacity 0.12s",
  };

  const approveOnceBtnStyle: React.CSSProperties = {
    ...btnBase,
    background: "#22c55e",
    color: "#fff",
  };

  const approveAlwaysBtnStyle: React.CSSProperties = {
    ...btnBase,
    background: "#4a9eed",
    color: "#fff",
  };

  const rejectBtnStyle: React.CSSProperties = {
    ...btnBase,
    background: "#ffc9c9",
    color: "#7f1d1d",
    border: "1px solid #ef4444",
  };

  const handleApprove = (action: GateAction): void => {
    if (disabled || isResolved || isExpired) return;
    onApprove(gate.gateId, action);
  };

  const handleRejectConfirm = (): void => {
    if (!rejectReason.trim()) return;
    onReject(gate.gateId, rejectReason.trim());
    setRejectMode(false);
    setRejectReason("");
  };

  return (
    <div style={cardStyle} role="region" aria-label={`Gate 승인 카드: ${gate.title}`}>
      {/* 헤더 행 */}
      <div style={titleRowStyle}>
        <span style={{ fontSize: "12px", fontWeight: 700, color: "#6b7280" }}>
          [GATE {gate.gateLevel}]
        </span>
        <span style={{ flex: 1, fontWeight: 700, fontSize: "14px", color: "#1e1e2e" }}>
          {gate.title}
        </span>
        {gate.status === "OPEN" && (
          <span
            style={{
              fontFamily: "monospace",
              fontSize: "12px",
              color: ttl < 60 ? "#ef4444" : "#6b7280",
              fontVariantNumeric: "tabular-nums",
            }}
            aria-live="polite"
            aria-label={`게이트 타임아웃 ${formatTtl(ttl)}`}
          >
            ⏲ {formatTtl(ttl)}
          </span>
        )}
      </div>

      {/* Risk 배지 */}
      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
        <Badge
          variant={riskLevelToVariant(gate.riskLevel as RiskLevel)}
          label={`${gate.riskLevel} (${gate.riskScore})`}
          size="md"
          pulse={gate.riskLevel === "HIGH" || gate.riskLevel === "CRITICAL"}
        />
        {gate.riskTags.map((tag) => (
          <Badge key={tag} variant="neutral" label={tag} size="sm" />
        ))}
        {isResolved && (
          <Badge
            variant={gate.status === "APPROVED" ? "status-done" : "status-denied"}
            label={gate.status}
            size="sm"
          />
        )}
      </div>

      {/* 왜 필요한가 */}
      <div>
        <div style={sectionLabelStyle}>Why needed?</div>
        {gate.whyNeeded.map((reason, i) => (
          <div key={i} style={whyItemStyle}>• {reason}</div>
        ))}
      </div>

      {/* 범위 요약 */}
      <div>
        <div style={sectionLabelStyle}>Scope</div>
        <div style={{ display: "flex", gap: "16px", fontSize: "12px", color: "#374151", flexWrap: "wrap" }}>
          <span>파일: <strong>{gate.impact.filesModified + gate.impact.filesCreated + gate.impact.filesDeleted}</strong></span>
          <span>명령: <strong>{gate.impact.commandsRun}</strong></span>
          <span>네트워크: <strong>{gate.impact.networkAccess ? "Yes" : "No"}</strong></span>
          <span>권한 상승: <strong>{gate.impact.privilegeEscalation ? "Yes" : "No"}</strong></span>
        </div>
        <div style={{ marginTop: "6px" }}>
          {gate.scope.paths.map((p) => (
            <span key={p} style={scopeItemStyle}>{p}</span>
          ))}
        </div>
      </div>

      {/* 상세 펼치기 */}
      <button
        style={{
          background: "none",
          border: "1px solid #e5e7eb",
          borderRadius: "6px",
          fontSize: "12px",
          color: "#6b7280",
          cursor: "pointer",
          padding: "4px 10px",
          textAlign: "left",
        }}
        onClick={() => setShowDetails((v) => !v)}
        aria-expanded={showDetails}
      >
        {showDetails ? "▲ 상세 숨기기" : "▼ 상세 보기"}
      </button>

      {showDetails && (
        <div style={{ fontSize: "12px", color: "#374151", background: "#f3f4f6", borderRadius: "8px", padding: "10px" }}>
          <div style={sectionLabelStyle}>명령어</div>
          {gate.scope.commands.length > 0
            ? gate.scope.commands.map((cmd) => (
                <span key={cmd} style={scopeItemStyle}>{cmd}</span>
              ))
            : <span style={{ color: "#888" }}>없음</span>
          }
          <div style={{ ...sectionLabelStyle, marginTop: "8px" }}>도메인</div>
          {gate.scope.domains.length > 0
            ? gate.scope.domains.map((d) => (
                <span key={d} style={scopeItemStyle}>{d}</span>
              ))
            : <span style={{ color: "#888" }}>없음</span>
          }
        </div>
      )}

      {/* 거절 사유 입력 모드 */}
      {rejectMode && (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <textarea
            style={{
              width: "100%",
              minHeight: "56px",
              borderRadius: "6px",
              border: "1px solid #ef4444",
              fontSize: "12px",
              padding: "6px",
              resize: "vertical",
              boxSizing: "border-box",
            }}
            placeholder="거절 사유를 입력하세요..."
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            aria-label="게이트 거절 사유"
          />
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              style={{ ...rejectBtnStyle, flex: "none", padding: "5px 14px" }}
              onClick={handleRejectConfirm}
              disabled={!rejectReason.trim()}
            >
              거절 확인
            </button>
            <button
              style={{ ...btnBase, flex: "none", padding: "5px 14px", background: "#f3f4f6", color: "#374151" }}
              onClick={() => setRejectMode(false)}
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 이미 처리된 경우 */}
      {isResolved && gate.resolution && (
        <div style={{ fontSize: "12px", color: "#6b7280", background: "#f3f4f6", borderRadius: "6px", padding: "8px" }}>
          {gate.resolution.action === "REJECT" ? "❌ 거절됨" : "✅ 승인됨"}
          {" · "}
          {gate.resolution.decidedAt}
          {gate.resolution.rejectReason && ` · 사유: ${gate.resolution.rejectReason}`}
        </div>
      )}

      {/* 액션 버튼들 — OPEN 상태에서만 */}
      {!isResolved && !rejectMode && (
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {gate.allowedActions.includes("APPROVE_ONCE") && (
            <button
              style={approveOnceBtnStyle}
              onClick={() => handleApprove("APPROVE_ONCE")}
              aria-label="한 번만 승인"
            >
              {ACTION_LABELS["APPROVE_ONCE"]}
            </button>
          )}
          {gate.allowedActions.includes("APPROVE_ALWAYS") && (
            <button
              style={approveAlwaysBtnStyle}
              onClick={() => handleApprove("APPROVE_ALWAYS")}
              aria-label="이 범위에 항상 승인"
            >
              {ACTION_LABELS["APPROVE_ALWAYS"]}
            </button>
          )}
          {gate.allowedActions.includes("REJECT") && (
            <button
              style={rejectBtnStyle}
              onClick={() => setRejectMode(true)}
              aria-label="거절"
            >
              {ACTION_LABELS["REJECT"]}
            </button>
          )}
        </div>
      )}
    </div>
  );
};
