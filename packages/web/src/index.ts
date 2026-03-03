// @jarvis/web — React 대시보드 barrel export

// ─── 기존 타입 스텁 (하위 호환) ───────────────────────────────
export type {
  PanelPosition,
  PanelState,
  DashboardState,
  ThemeMode,
  AgentStatusItem,
  GateApprovalData,
  TimelineItem,
  AuditLogPanelItem,
} from "./types/dashboard.js";

export type {
  GateApprovalCardProps,
  TimelineViewProps,
  AuditLogPanelProps,
  AuditLogFilter,
  AgentStatusBarProps,
  NavigationPanelProps,
  NavigationSection,
} from "./types/components.js";

// ─── API 스키마 ────────────────────────────────────────────────
export type {
  ApiResponse,
  ApiError,
  SystemStatusDto,
  AgentHealthDto,
  RunDto,
  RunStatus,
  StartRunRequest,
  TimelineNodeDto,
  TimelineNodeType,
  TimelineNodeStatus,
  TimelineNodeDetailDto,
  ImpactSummaryDto,
  CapabilityUsedDto,
  PolicyDecisionSummaryDto,
  GateDto,
  GateStatus,
  GateAction,
  GateScopeDto,
  GateResolutionDto,
  GateApproveRequest,
  GateRejectRequest,
  AuditEntryDto,
  AuditQueryParams,
  AuditListDto,
  EvidenceDto,
  EvidenceType,
  EvidenceContentUrlDto,
  PolicySummaryDto,
  PolicyListDto,
  ChatMessageDto,
  MessageRole,
  MessageContextBadge,
  SendMessageRequest,
  EmergencyStopRequest,
  EmergencyStopDto,
  SseEvent,
  SseEventType,
} from "./api/schema.js";

export type {
  ApiClientConfig,
  JarvisApiClient,
} from "./api/client.js";
export { createApiClient } from "./api/client.js";

// ─── React 컴포넌트 ────────────────────────────────────────────
export { Badge, riskLevelToVariant } from "./components/common/index.js";
export type { BadgeProps, BadgeVariant, BadgeSize } from "./components/common/index.js";

export { TopStatusBar, DashboardLayout, EvidenceStrip } from "./components/layout/index.js";
export type { TopStatusBarProps, EvidenceStripProps } from "./components/layout/index.js";

export { TimelinePanel } from "./components/timeline/index.js";
export type { TimelinePanelProps } from "./components/timeline/index.js";

export { GateCard, SafetyPanel } from "./components/safety/index.js";
export type { GateCardProps, SafetyPanelProps } from "./components/safety/index.js";

export { ChatPanel } from "./components/chat/index.js";
export type { ChatPanelProps } from "./components/chat/index.js";
