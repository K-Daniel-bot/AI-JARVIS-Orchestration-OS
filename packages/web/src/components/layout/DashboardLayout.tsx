// 3-패널 대시보드 레이아웃 — Chat(28%) / Timeline(44%) / Safety(28%)
import React from "react";

// DashboardLayout Props
export interface DashboardLayoutProps {
  readonly topBar: React.ReactNode;
  readonly leftPanel: React.ReactNode;
  readonly centerPanel: React.ReactNode;
  readonly rightPanel: React.ReactNode;
  readonly evidenceStrip?: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  topBar,
  leftPanel,
  centerPanel,
  rightPanel,
  evidenceStrip,
}) => {
  const rootStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    overflow: "hidden",
    fontFamily: "'Inter', 'Pretendard', -apple-system, sans-serif",
    background: "#f0f2f5",
  };

  const bodyStyle: React.CSSProperties = {
    flex: 1,
    display: "grid",
    gridTemplateColumns: "28% 44% 28%",
    overflow: "hidden",
    minHeight: 0,
  };

  const panelStyle: React.CSSProperties = {
    overflow: "hidden",
    display: "flex",
    flexDirection: "column",
  };

  const evidenceStyle: React.CSSProperties = {
    borderTop: "1px solid #e5e7eb",
    background: "#fff",
    flexShrink: 0,
  };

  return (
    <div style={rootStyle}>
      {/* 상단 상태바 — 항상 고정 */}
      {topBar}

      {/* 3-패널 본체 */}
      <div style={bodyStyle}>
        <div style={panelStyle}>{leftPanel}</div>
        <div style={panelStyle}>{centerPanel}</div>
        <div style={panelStyle}>{rightPanel}</div>
      </div>

      {/* 하단 증거 스트립 */}
      {evidenceStrip && (
        <div style={evidenceStyle}>{evidenceStrip}</div>
      )}
    </div>
  );
};
