// 대시보드 UI 타입 정의 — Phase 0 기반 구조

import type { AgentType, AgentHealthStatus, RiskLevel, PolicyStatus } from "@jarvis/shared";

// 3-패널 레이아웃 타입
export type PanelPosition = "left" | "center" | "right";

// 패널 상태
export interface PanelState {
  readonly position: PanelPosition;
  readonly visible: boolean;
  readonly width: number;
  readonly collapsed: boolean;
}

// 대시보드 전체 상태
export interface DashboardState {
  readonly panels: readonly PanelState[];
  readonly theme: ThemeMode;
  readonly connected: boolean;
  readonly lastUpdatedAt: string;
}

// 테마 모드
export type ThemeMode = "light" | "dark" | "system";

// 에이전트 상태 바 항목
export interface AgentStatusItem {
  readonly agentType: AgentType;
  readonly status: AgentHealthStatus;
  readonly currentTask: string | null;
  readonly lastActiveAt: string;
}

// 게이트 승인 카드 데이터
export interface GateApprovalData {
  readonly gateId: string;
  readonly gateLevel: number;
  readonly what: string;
  readonly why: string;
  readonly riskLevel: RiskLevel;
  readonly riskScore: number;
  readonly policyStatus: PolicyStatus;
  readonly timeoutSeconds: number;
  readonly createdAt: string;
}

// 타임라인 항목
export interface TimelineItem {
  readonly id: string;
  readonly timestamp: string;
  readonly agentType: AgentType;
  readonly action: string;
  readonly status: "completed" | "in_progress" | "pending" | "failed";
  readonly isUndoPoint: boolean;
  readonly details?: string;
}

// 감사 로그 패널 항목
export interface AuditLogPanelItem {
  readonly entryId: string;
  readonly timestamp: string;
  readonly agentId: string;
  readonly summary: string;
  readonly logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR" | "CRITICAL";
  readonly status: "SUCCESS" | "FAILURE" | "PARTIAL" | "SKIPPED";
}
