/**
 * @jarvis/web 패키지 barrel export
 * 외부 패키지에서 web 패키지의 공개 API에 접근하기 위한 진입점.
 * 주요 컴포넌트와 타입을 export한다.
 */

// ─────────────────────────────────────────
// 메인 앱 컴포넌트
// ─────────────────────────────────────────

export { App } from './App.js';

// ─────────────────────────────────────────
// UI 컴포넌트 (재사용 가능)
// ─────────────────────────────────────────

// 에이전트 상태 인디케이터
export type { AgentStatusItem, AgentDisplayStatus, AgentStatusBarProps } from './components/AgentStatusBar.js';
export { AgentStatusBar, DEFAULT_AGENT_STATUSES } from './components/AgentStatusBar.js';

// Gate 승인 카드
export type {
  GateRequest,
  GateApprovalHandlers,
  GateApprovalCardProps,
  RiskDisplayLevel,
} from './components/GateApprovalCard.js';
export { GateApprovalCard } from './components/GateApprovalCard.js';

// 감사 로그 패널
export type { AuditLogEntry, AuditLogPanelProps } from './components/AuditLogPanel.js';
export { AuditLogPanel } from './components/AuditLogPanel.js';

// 타임라인 뷰
export type {
  TimelineStep,
  TimelineStepStatus,
  TimelineViewProps,
} from './components/TimelineView.js';
export { TimelineView } from './components/TimelineView.js';
