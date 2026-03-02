// 컴포넌트 Props 인터페이스 — Phase 0 타입 스텁

import type {
  AgentStatusItem,
  GateApprovalData,
  TimelineItem,
  AuditLogPanelItem,
  DashboardState,
} from "./dashboard.js";

// GateApprovalCard 컴포넌트 Props
export interface GateApprovalCardProps {
  readonly data: GateApprovalData;
  readonly onApprove: (gateId: string) => void;
  readonly onDeny: (gateId: string, reason: string) => void;
  readonly disabled: boolean;
}

// TimelineView 컴포넌트 Props
export interface TimelineViewProps {
  readonly items: readonly TimelineItem[];
  readonly onUndoTo: (itemId: string) => void;
  readonly maxItems: number;
}

// AuditLogPanel 컴포넌트 Props
export interface AuditLogPanelProps {
  readonly entries: readonly AuditLogPanelItem[];
  readonly autoScroll: boolean;
  readonly filter?: AuditLogFilter;
}

// 감사 로그 필터
export interface AuditLogFilter {
  readonly logLevel?: readonly string[];
  readonly agentId?: string;
  readonly status?: readonly string[];
}

// AgentStatusBar 컴포넌트 Props
export interface AgentStatusBarProps {
  readonly agents: readonly AgentStatusItem[];
  readonly compact: boolean;
}

// DashboardLayout 컴포넌트 Props
export interface DashboardLayoutProps {
  readonly state: DashboardState;
  readonly onPanelToggle: (position: string) => void;
  readonly onThemeChange: (theme: string) => void;
}

// NavigationPanel 컴포넌트 Props (왼쪽 패널)
export interface NavigationPanelProps {
  readonly activeSection: NavigationSection;
  readonly onNavigate: (section: NavigationSection) => void;
}

// 네비게이션 섹션
export type NavigationSection =
  | "overview"
  | "agents"
  | "audit"
  | "policy"
  | "tokens"
  | "settings";
