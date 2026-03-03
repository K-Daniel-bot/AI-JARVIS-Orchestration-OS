// 상단 상태바 컴포넌트 — 모드, Risk, 단계, TTL, 긴급 정지 버튼 항상 노출
import React, { useState, useEffect } from "react";
import type { RiskLevel, TrustMode } from "@jarvis/shared";
import { Badge, riskLevelToVariant } from "../common/Badge.js";
import type { RunStatus } from "../../api/schema.js";

// TopStatusBar Props
export interface TopStatusBarProps {
  readonly trustMode: TrustMode;
  readonly riskLevel: RiskLevel;
  readonly riskScore: number;
  readonly currentStep: RunStatus | null;
  readonly ttlSeconds: number | null;
  readonly connected: boolean;
  readonly onEmergencyStop: () => void;
}

// TrustMode → 표시 텍스트
const TRUST_MODE_LABELS: Record<TrustMode, string> = {
  "observe":   "Observe",
  "suggest":   "Suggest",
  "semi-auto": "Semi-auto",
  "full-auto": "Auto",
};

// 단계 → 표시 텍스트
const STEP_LABELS: Partial<Record<RunStatus, string>> = {
  IDLE:            "대기 중",
  SPEC_ANALYSIS:   "요구사항 분석",
  POLICY_CHECK:    "정책 검증",
  PLANNING:        "계획 수립",
  GATE_L1:         "Gate L1 승인 대기",
  CODE_GENERATION: "코드 생성",
  CODE_REVIEW:     "코드 리뷰",
  GATE_L2:         "Gate L2 승인 대기",
  TESTING:         "테스트 실행",
  DEPLOYMENT:      "배포",
  GATE_L3:         "Gate L3 승인 대기",
  COMPLETED:       "완료",
  FAILED:          "실패",
  ROLLED_BACK:     "롤백 완료",
};

// TTL 포맷 (초 → mm:ss)
function formatTtl(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export const TopStatusBar: React.FC<TopStatusBarProps> = ({
  trustMode,
  riskLevel,
  riskScore,
  currentStep,
  ttlSeconds,
  connected,
  onEmergencyStop,
}) => {
  // 클라이언트 사이드 TTL 카운트다운
  const [ttl, setTtl] = useState(ttlSeconds);
  useEffect(() => {
    setTtl(ttlSeconds);
  }, [ttlSeconds]);
  useEffect(() => {
    if (ttl === null || ttl <= 0) return;
    const id = setInterval(() => {
      setTtl((prev) => (prev !== null && prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, [ttl]);

  const barStyle: React.CSSProperties = {
    position: "sticky",
    top: 0,
    zIndex: 100,
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "0 16px",
    height: "48px",
    background: "#1e1e2e",
    borderBottom: "1px solid #3a3a5c",
    fontSize: "13px",
    color: "#e5e5e5",
    userSelect: "none",
  };

  const dividerStyle: React.CSSProperties = {
    width: "1px",
    height: "20px",
    background: "#3a3a5c",
    flexShrink: 0,
  };

  const labelStyle: React.CSSProperties = {
    color: "#a0a0b0",
    fontSize: "11px",
    marginRight: "4px",
  };

  const stopBtnStyle: React.CSSProperties = {
    marginLeft: "auto",
    padding: "5px 14px",
    background: "#ef4444",
    color: "#fff",
    border: "none",
    borderRadius: "6px",
    fontWeight: 700,
    fontSize: "13px",
    cursor: "pointer",
    letterSpacing: "0.03em",
  };

  const connDotStyle: React.CSSProperties = {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: connected ? "#22c55e" : "#ef4444",
    flexShrink: 0,
  };

  return (
    <div style={barStyle} role="banner" aria-label="JARVIS 상태 바">
      {/* 연결 상태 */}
      <div style={connDotStyle} title={connected ? "연결됨" : "연결 끊김"} />

      {/* Trust Mode */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <span style={labelStyle}>MODE</span>
        <Badge
          variant={
            trustMode === "observe"   ? "mode-observe"
            : trustMode === "suggest"   ? "mode-suggest"
            : trustMode === "semi-auto" ? "mode-semi"
            : "mode-auto"
          }
          label={TRUST_MODE_LABELS[trustMode]}
          size="sm"
        />
      </div>

      <div style={dividerStyle} />

      {/* Risk Level */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <span style={labelStyle}>RISK</span>
        <Badge
          variant={riskLevelToVariant(riskLevel)}
          label={`${riskScore} (${riskLevel})`}
          size="sm"
          pulse={riskLevel === "HIGH" || riskLevel === "CRITICAL"}
        />
      </div>

      <div style={dividerStyle} />

      {/* 현재 단계 */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <span style={labelStyle}>STEP</span>
        <span style={{ color: "#e5e5e5", fontSize: "12px" }}>
          {currentStep ? (STEP_LABELS[currentStep] ?? currentStep) : "—"}
        </span>
      </div>

      {/* TTL 카운트다운 */}
      {ttl !== null && (
        <>
          <div style={dividerStyle} />
          <div style={{ display: "flex", alignItems: "center" }}>
            <span style={labelStyle}>TTL</span>
            <span
              style={{
                color: ttl < 60 ? "#ef4444" : "#e5e5e5",
                fontSize: "12px",
                fontVariantNumeric: "tabular-nums",
                fontFamily: "monospace",
              }}
              aria-live="polite"
              aria-label={`Capability TTL: ${formatTtl(ttl)}`}
            >
              {formatTtl(ttl)}
            </span>
          </div>
        </>
      )}

      {/* 긴급 정지 버튼 — 항상 오른쪽 끝 */}
      <button
        style={stopBtnStyle}
        onClick={onEmergencyStop}
        aria-label="긴급 정지 — 모든 실행 즉시 중단"
        title="긴급 정지 (Ctrl+/)"
      >
        ⬛ STOP
      </button>
    </div>
  );
};
