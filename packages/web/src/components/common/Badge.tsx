// 공통 배지 컴포넌트 — Risk Level, 상태, 모드 표시에 사용
import React from "react";
import type { RiskLevel } from "@jarvis/shared";

// 배지 변형 타입
export type BadgeVariant =
  | "risk-low"
  | "risk-medium"
  | "risk-high"
  | "risk-critical"
  | "status-running"
  | "status-done"
  | "status-waiting"
  | "status-denied"
  | "status-pending"
  | "mode-observe"
  | "mode-suggest"
  | "mode-semi"
  | "mode-auto"
  | "neutral";

// 배지 크기
export type BadgeSize = "sm" | "md" | "lg";

// 배지 Props
export interface BadgeProps {
  readonly variant: BadgeVariant;
  readonly label: string;
  readonly size?: BadgeSize;
  readonly pulse?: boolean;
  readonly className?: string;
}

// variant → 인라인 스타일 매핑 (Tailwind CSS 없이 순수 스타일 사용)
const VARIANT_STYLES: Record<BadgeVariant, React.CSSProperties> = {
  "risk-low":        { background: "#d3f9d8", color: "#15803d", border: "1px solid #22c55e" },
  "risk-medium":     { background: "#fff3bf", color: "#92400e", border: "1px solid #f59e0b" },
  "risk-high":       { background: "#ffd8a8", color: "#9a3412", border: "1px solid #f97316" },
  "risk-critical":   { background: "#ffc9c9", color: "#7f1d1d", border: "1px solid #ef4444" },
  "status-running":  { background: "#a5d8ff", color: "#1e3a5f", border: "1px solid #4a9eed" },
  "status-done":     { background: "#d3f9d8", color: "#15803d", border: "1px solid #22c55e" },
  "status-waiting":  { background: "#fff3bf", color: "#92400e", border: "1px solid #f59e0b" },
  "status-denied":   { background: "#ffc9c9", color: "#7f1d1d", border: "1px solid #ef4444" },
  "status-pending":  { background: "#f0f0f0", color: "#555555", border: "1px solid #cccccc" },
  "mode-observe":    { background: "#e5dbff", color: "#3730a3", border: "1px solid #8b5cf6" },
  "mode-suggest":    { background: "#d0bfff", color: "#3730a3", border: "1px solid #7c3aed" },
  "mode-semi":       { background: "#fff3bf", color: "#92400e", border: "1px solid #f59e0b" },
  "mode-auto":       { background: "#ffd8a8", color: "#9a3412", border: "1px solid #f97316" },
  "neutral":         { background: "#f3f4f6", color: "#374151", border: "1px solid #d1d5db" },
};

const SIZE_STYLES: Record<BadgeSize, React.CSSProperties> = {
  sm: { fontSize: "11px", padding: "2px 6px", borderRadius: "4px" },
  md: { fontSize: "12px", padding: "3px 8px", borderRadius: "6px" },
  lg: { fontSize: "14px", padding: "4px 10px", borderRadius: "8px" },
};

// RiskLevel → BadgeVariant 변환 헬퍼
export function riskLevelToVariant(level: RiskLevel): BadgeVariant {
  const map: Record<RiskLevel, BadgeVariant> = {
    LOW: "risk-low",
    MEDIUM: "risk-medium",
    HIGH: "risk-high",
    CRITICAL: "risk-critical",
  };
  return map[level];
}

export const Badge: React.FC<BadgeProps> = ({
  variant,
  label,
  size = "md",
  pulse = false,
  className,
}) => {
  const baseStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    fontWeight: 600,
    letterSpacing: "0.02em",
    userSelect: "none",
    whiteSpace: "nowrap",
    ...VARIANT_STYLES[variant],
    ...SIZE_STYLES[size],
    animation: pulse ? "pulse 1.5s ease-in-out infinite" : undefined,
  };

  return (
    <span style={baseStyle} className={className}>
      {label}
    </span>
  );
};
