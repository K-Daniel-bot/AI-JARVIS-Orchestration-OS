// 타임라인 패널 — 실행 단계별 진행 상황 표시 (중앙 패널)
import React, { useState } from "react";
import type { TimelineNodeDto, TimelineNodeDetailDto } from "../../api/schema.js";
import type { RiskLevel } from "@jarvis/shared";
import { Badge, riskLevelToVariant } from "../common/Badge.js";

// TimelinePanel Props
export interface TimelinePanelProps {
  readonly nodes: readonly TimelineNodeDto[];
  readonly selectedNodeId: string | null;
  readonly onNodeSelect: (nodeId: string) => void;
  readonly onNodeDetail: (nodeId: string) => Promise<TimelineNodeDetailDto>;
  readonly onUndoTo: (nodeId: string) => void;
}

// 단계 상태 → 아이콘
const STATUS_ICONS: Record<string, string> = {
  DONE:         "✅",
  RUNNING:      "⏳",
  WAITING_GATE: "⏸",
  DENIED:       "⛔",
  FAILED:       "❌",
  PENDING:      "○",
  SKIPPED:      "—",
};

// 단계 상태 → 배경색
const STATUS_BG: Record<string, string> = {
  DONE:         "#d3f9d8",
  RUNNING:      "#fff3bf",
  WAITING_GATE: "#ffd8a8",
  DENIED:       "#ffc9c9",
  FAILED:       "#ffc9c9",
  PENDING:      "#f3f4f6",
  SKIPPED:      "#f3f4f6",
};

// 단계 상태 → 테두리색
const STATUS_BORDER: Record<string, string> = {
  DONE:         "#22c55e",
  RUNNING:      "#f59e0b",
  WAITING_GATE: "#f97316",
  DENIED:       "#ef4444",
  FAILED:       "#ef4444",
  PENDING:      "#d1d5db",
  SKIPPED:      "#d1d5db",
};

// ms → "2.3s" 형태 포맷
function formatDuration(ms: number | null): string {
  if (ms === null) return "";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// 개별 타임라인 노드 컴포넌트
const TimelineNode: React.FC<{
  node: TimelineNodeDto;
  selected: boolean;
  onSelect: () => void;
  onUndoTo: () => void;
}> = ({ node, selected, onSelect, onUndoTo }) => {
  const bg = STATUS_BG[node.status] ?? "#f3f4f6";
  const border = STATUS_BORDER[node.status] ?? "#d1d5db";
  const icon = STATUS_ICONS[node.status] ?? "○";

  const nodeStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    gap: "4px",
    padding: "10px 12px",
    borderRadius: "8px",
    border: `1.5px solid ${selected ? "#4a9eed" : border}`,
    background: selected ? "#eff6ff" : bg,
    cursor: "pointer",
    transition: "box-shadow 0.15s",
    boxShadow: selected ? "0 0 0 2px #4a9eed44" : undefined,
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  };

  const titleStyle: React.CSSProperties = {
    flex: 1,
    fontWeight: 600,
    fontSize: "13px",
    color: "#1e1e2e",
  };

  const metaStyle: React.CSSProperties = {
    display: "flex",
    gap: "8px",
    alignItems: "center",
    flexWrap: "wrap",
  };

  return (
    <div
      style={nodeStyle}
      onClick={onSelect}
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      aria-label={`${node.title} — ${node.status}`}
      onKeyDown={(e) => e.key === "Enter" && onSelect()}
    >
      <div style={headerStyle}>
        <span style={{ fontSize: "16px" }} aria-hidden>
          {icon}
        </span>
        <span style={titleStyle}>{node.title}</span>
        {node.agentType && (
          <Badge variant="neutral" label={node.agentType} size="sm" />
        )}
        {node.durationMs !== null && (
          <span style={{ fontSize: "11px", color: "#888", fontFamily: "monospace" }}>
            {formatDuration(node.durationMs)}
          </span>
        )}
      </div>

      {/* 요약 */}
      {node.summary && (
        <span style={{ fontSize: "12px", color: "#555", paddingLeft: "24px" }}>
          {node.summary}
        </span>
      )}

      {/* 메타 정보 */}
      <div style={{ ...metaStyle, paddingLeft: "24px" }}>
        {node.riskLevel && (
          <Badge
            variant={riskLevelToVariant(node.riskLevel as RiskLevel)}
            label={`${node.riskScore ?? ""} ${node.riskLevel}`}
            size="sm"
          />
        )}
        {node.riskTags.map((tag) => (
          <Badge key={tag} variant="neutral" label={tag} size="sm" />
        ))}
        {node.isUndoPoint && (
          <button
            style={{
              fontSize: "11px",
              padding: "1px 6px",
              borderRadius: "4px",
              border: "1px solid #4a9eed",
              background: "#eff6ff",
              color: "#2563eb",
              cursor: "pointer",
            }}
            onClick={(e) => { e.stopPropagation(); onUndoTo(); }}
            aria-label={`${node.title} 지점으로 롤백`}
          >
            ↩ Undo to here
          </button>
        )}
      </div>
    </div>
  );
};

// 타임라인 패널 본체
export const TimelinePanel: React.FC<TimelinePanelProps> = ({
  nodes,
  selectedNodeId,
  onNodeSelect,
  onNodeDetail,
  onUndoTo,
}) => {
  const [expandedNodeId, setExpandedNodeId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TimelineNodeDetailDto | null>(null);
  const [loadingNodeId, setLoadingNodeId] = useState<string | null>(null);

  const handleNodeClick = async (nodeId: string): Promise<void> => {
    onNodeSelect(nodeId);
    if (expandedNodeId === nodeId) {
      setExpandedNodeId(null);
      setDetail(null);
      return;
    }
    setExpandedNodeId(nodeId);
    setLoadingNodeId(nodeId);
    const d = await onNodeDetail(nodeId);
    setDetail(d);
    setLoadingNodeId(null);
  };

  const panelStyle: React.CSSProperties = {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    background: "#ffffff",
    borderLeft: "1px solid #e5e7eb",
    borderRight: "1px solid #e5e7eb",
  };

  const headerStyle: React.CSSProperties = {
    padding: "12px 16px 8px",
    borderBottom: "1px solid #e5e7eb",
    fontWeight: 700,
    fontSize: "14px",
    color: "#1e1e2e",
  };

  const scrollStyle: React.CSSProperties = {
    flex: 1,
    overflowY: "auto",
    padding: "12px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
  };

  const detailBoxStyle: React.CSSProperties = {
    marginTop: "4px",
    padding: "12px",
    background: "#f8f9fa",
    borderRadius: "8px",
    border: "1px solid #e5e7eb",
    fontSize: "12px",
    color: "#374151",
  };

  return (
    <div style={panelStyle} role="region" aria-label="실행 타임라인">
      <div style={headerStyle}>실행 타임라인</div>
      <div style={scrollStyle}>
        {nodes.length === 0 && (
          <div style={{ color: "#888", fontSize: "13px", textAlign: "center", marginTop: "40px" }}>
            실행 중인 작업이 없습니다.
          </div>
        )}
        {nodes.map((node) => (
          <React.Fragment key={node.nodeId}>
            <TimelineNode
              node={node}
              selected={selectedNodeId === node.nodeId}
              onSelect={() => { void handleNodeClick(node.nodeId); }}
              onUndoTo={() => onUndoTo(node.nodeId)}
            />
            {/* 상세 펼치기 */}
            {expandedNodeId === node.nodeId && (
              <div style={detailBoxStyle}>
                {loadingNodeId === node.nodeId ? (
                  <span style={{ color: "#888" }}>불러오는 중...</span>
                ) : detail ? (
                  <>
                    <div style={{ fontWeight: 700, marginBottom: "6px" }}>왜 이 단계인가?</div>
                    <p style={{ margin: "0 0 8px" }}>{detail.whyReason}</p>
                    <div style={{ fontWeight: 700, marginBottom: "4px" }}>예상 영향</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", fontSize: "11px" }}>
                      <span>파일 수정: {detail.expectedImpact.filesModified}</span>
                      <span>파일 생성: {detail.expectedImpact.filesCreated}</span>
                      <span>파일 삭제: {detail.expectedImpact.filesDeleted}</span>
                      <span>명령 실행: {detail.expectedImpact.commandsRun}</span>
                      <span>네트워크: {detail.expectedImpact.networkAccess ? "Yes" : "No"}</span>
                    </div>
                    {detail.capabilities.length > 0 && (
                      <>
                        <div style={{ fontWeight: 700, margin: "8px 0 4px" }}>사용된 Capability</div>
                        {detail.capabilities.map((cap) => (
                          <div key={cap.tokenId} style={{ fontSize: "11px", marginBottom: "2px" }}>
                            <Badge
                              variant={
                                cap.status === "CONSUMED" ? "status-done"
                                : cap.status === "ACTIVE" ? "status-running"
                                : "status-denied"
                              }
                              label={cap.status}
                              size="sm"
                            />
                            {" "}
                            <span style={{ fontFamily: "monospace" }}>{cap.scope}</span>
                          </div>
                        ))}
                      </>
                    )}
                  </>
                ) : null}
              </div>
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};
