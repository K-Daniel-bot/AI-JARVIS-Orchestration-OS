// 백엔드-프론트엔드 API 스키마 — 전체 인터페이스 정의
// 프론트엔드가 백엔드로부터 수신하는 이벤트 및 요청/응답 타입

import type {
  AgentType,
  AgentHealthStatus,
  RiskLevel,
  PolicyStatus,
  GateType,
  GateLevel,
  TrustMode,
} from "@jarvis/shared";

// ─────────────────────────────────────────────
// 공통 래퍼
// ─────────────────────────────────────────────

// API 응답 공통 래퍼
export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data: T | null;
  readonly error: ApiError | null;
  readonly timestamp: string;
  readonly requestId: string;
}

// API 에러 상세
export interface ApiError {
  readonly code: string;
  readonly message: string;
  readonly details?: Record<string, unknown>;
}

// ─────────────────────────────────────────────
// 시스템 상태 API
// ─────────────────────────────────────────────

// GET /api/system/status
export interface SystemStatusDto {
  readonly currentState: string;
  readonly trustMode: TrustMode;
  readonly activeRunId: string | null;
  readonly sessionId: string;
  readonly connectedAt: string;
  readonly agentHealth: readonly AgentHealthDto[];
  readonly pendingGates: number;
  readonly riskLevel: RiskLevel;
  readonly riskScore: number;
  readonly capabilityTtlSeconds: number | null;
}

// 에이전트 건강 상태 DTO
export interface AgentHealthDto {
  readonly agentType: AgentType;
  readonly agentId: string;
  readonly status: AgentHealthStatus;
  readonly currentTask: string | null;
  readonly lastActiveAt: string;
  readonly consecutiveFailures: number;
}

// ─────────────────────────────────────────────
// Run (실행 세션) API
// ─────────────────────────────────────────────

// POST /api/runs — 새 실행 시작 요청
export interface StartRunRequest {
  readonly input: string;
  readonly trustMode: TrustMode;
  readonly voiceTranscript?: string;
}

// GET /api/runs/:runId
export interface RunDto {
  readonly runId: string;
  readonly sessionId: string;
  readonly trustMode: TrustMode;
  readonly target: "WINDOWS" | "MACOS" | "BROWSER_SANDBOX";
  readonly status: RunStatus;
  readonly riskLevel: RiskLevel;
  readonly riskScore: number;
  readonly riskTags: readonly string[];
  readonly currentStepLabel: string;
  readonly startedAt: string;
  readonly completedAt: string | null;
  readonly timeline: readonly TimelineNodeDto[];
  readonly openGates: readonly GateDto[];
}

// 실행 상태
export type RunStatus =
  | "IDLE"
  | "SPEC_ANALYSIS"
  | "POLICY_CHECK"
  | "PLANNING"
  | "GATE_L1"
  | "CODE_GENERATION"
  | "CODE_REVIEW"
  | "GATE_L2"
  | "TESTING"
  | "DEPLOYMENT"
  | "GATE_L3"
  | "COMPLETED"
  | "FAILED"
  | "ROLLED_BACK";

// ─────────────────────────────────────────────
// 타임라인 API
// ─────────────────────────────────────────────

// 타임라인 노드 타입
export type TimelineNodeType =
  | "SPEC"
  | "POLICY"
  | "PLAN"
  | "GATE"
  | "CODEGEN"
  | "REVIEW"
  | "TEST"
  | "DEPLOY"
  | "ROLLBACK";

// 타임라인 노드 상태
export type TimelineNodeStatus =
  | "PENDING"
  | "RUNNING"
  | "DONE"
  | "WAITING_GATE"
  | "DENIED"
  | "FAILED"
  | "SKIPPED";

// 타임라인 노드 DTO
export interface TimelineNodeDto {
  readonly nodeId: string;
  readonly type: TimelineNodeType;
  readonly status: TimelineNodeStatus;
  readonly title: string;
  readonly summary: string | null;
  readonly agentType: AgentType | null;
  readonly startedAt: string | null;
  readonly completedAt: string | null;
  readonly durationMs: number | null;
  readonly riskScore: number | null;
  readonly riskLevel: RiskLevel | null;
  readonly riskTags: readonly string[];
  readonly policyRefs: readonly string[];
  readonly capabilityIds: readonly string[];
  readonly evidenceIds: readonly string[];
  readonly isUndoPoint: boolean;
  readonly gateId: string | null;
}

// GET /api/runs/:runId/timeline/:nodeId — 노드 상세
export interface TimelineNodeDetailDto extends TimelineNodeDto {
  readonly whyReason: string;
  readonly expectedImpact: ImpactSummaryDto;
  readonly capabilities: readonly CapabilityUsedDto[];
  readonly policyDecision: PolicyDecisionSummaryDto | null;
}

// 실행 영향 요약
export interface ImpactSummaryDto {
  readonly filesModified: number;
  readonly filesCreated: number;
  readonly filesDeleted: number;
  readonly commandsRun: number;
  readonly networkAccess: boolean;
  readonly privilegeEscalation: boolean;
  readonly estimatedSizeBytes: number | null;
}

// 사용된 Capability 요약
export interface CapabilityUsedDto {
  readonly tokenId: string;
  readonly scope: string;
  readonly issuedAt: string;
  readonly consumedAt: string | null;
  readonly status: "ACTIVE" | "CONSUMED" | "EXPIRED" | "REVOKED";
}

// 정책 판정 요약
export interface PolicyDecisionSummaryDto {
  readonly decisionId: string;
  readonly status: PolicyStatus;
  readonly riskLevel: RiskLevel;
  readonly riskScore: number;
  readonly reasoning: string;
  readonly policyIds: readonly string[];
}

// ─────────────────────────────────────────────
// Gate (승인 게이트) API
// ─────────────────────────────────────────────

// 게이트 상태
export type GateStatus = "OPEN" | "APPROVED" | "REJECTED" | "EXPIRED" | "TIMED_OUT";

// 게이트 승인 선택지
export type GateAction = "APPROVE_ONCE" | "APPROVE_ALWAYS" | "REJECT" | "EDIT_SCOPE";

// 게이트 DTO
export interface GateDto {
  readonly gateId: string;
  readonly gateType: GateType;
  readonly gateLevel: GateLevel;
  readonly status: GateStatus;
  readonly title: string;
  readonly description: string;
  readonly whyNeeded: readonly string[];
  readonly riskLevel: RiskLevel;
  readonly riskScore: number;
  readonly riskTags: readonly string[];
  readonly impact: ImpactSummaryDto;
  readonly scope: GateScopeDto;
  readonly allowedActions: readonly GateAction[];
  readonly timeoutSeconds: number;
  readonly expiresAt: string;
  readonly createdAt: string;
  readonly resolution: GateResolutionDto | null;
}

// 게이트 범위 정보
export interface GateScopeDto {
  readonly paths: readonly string[];
  readonly commands: readonly string[];
  readonly domains: readonly string[];
  readonly capabilities: readonly string[];
}

// 게이트 처리 결과
export interface GateResolutionDto {
  readonly action: GateAction;
  readonly decidedAt: string;
  readonly decidedBy: "USER" | "POLICY_AUTO";
  readonly scopeOverride: Partial<GateScopeDto> | null;
  readonly rejectReason: string | null;
}

// POST /api/gates/:gateId/approve
export interface GateApproveRequest {
  readonly action: GateAction;
  readonly scopeOverride?: Partial<GateScopeDto>;
}

// POST /api/gates/:gateId/reject
export interface GateRejectRequest {
  readonly reason: string;
}

// ─────────────────────────────────────────────
// 감사 로그 API
// ─────────────────────────────────────────────

// 감사 로그 항목 DTO
export interface AuditEntryDto {
  readonly entryId: string;
  readonly sequenceNumber: number;
  readonly timestamp: string;
  readonly agentType: AgentType;
  readonly agentId: string;
  readonly runId: string;
  readonly summary: string;
  readonly status: "COMPLETED" | "FAILED" | "DENIED" | "PARTIAL";
  readonly logLevel: "DEBUG" | "INFO" | "WARN" | "ERROR" | "CRITICAL";
  readonly riskLevel: RiskLevel | null;
  readonly isRedacted: boolean;
}

// GET /api/audit — 쿼리 파라미터
export interface AuditQueryParams {
  readonly runId?: string;
  readonly agentType?: AgentType;
  readonly status?: string;
  readonly logLevel?: string;
  readonly from?: string;
  readonly to?: string;
  readonly limit?: number;
  readonly offset?: number;
}

// GET /api/audit 응답
export interface AuditListDto {
  readonly entries: readonly AuditEntryDto[];
  readonly total: number;
  readonly hasMore: boolean;
}

// ─────────────────────────────────────────────
// 증거(Evidence) API
// ─────────────────────────────────────────────

// 증거 타입
export type EvidenceType =
  | "SCREENSHOT"
  | "TERMINAL_LOG"
  | "DIFF"
  | "SCAN_REPORT"
  | "HASH"
  | "POLICY_DECISION"
  | "PLAN_JSON";

// 증거 항목 DTO
export interface EvidenceDto {
  readonly evidenceId: string;
  readonly type: EvidenceType;
  readonly label: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
  readonly hash: string;
  readonly createdAt: string;
  readonly isRedacted: boolean;
  // 인라인 콘텐츠 (소형 항목에만 포함)
  readonly inlineContent?: string;
}

// ─────────────────────────────────────────────
// 정책 API
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// 채팅 메시지 API
// ─────────────────────────────────────────────

// 채팅 메시지 역할
export type MessageRole = "USER" | "JARVIS" | "SYSTEM";

// 메시지 컨텍스트 배지
export type MessageContextBadge =
  | "OBSERVE_ONLY"
  | "MAY_TRIGGER_ACTIONS"
  | "EXECUTING"
  | "COMPLETED"
  | "FAILED";

// 채팅 메시지 DTO
export interface ChatMessageDto {
  readonly messageId: string;
  readonly role: MessageRole;
  readonly content: string;
  readonly timestamp: string;
  readonly runId: string | null;
  readonly contextBadge: MessageContextBadge;
  readonly isVoice: boolean;
}


// ─────────────────────────────────────────────
// SSE 실시간 이벤트 스트림 스키마
// ─────────────────────────────────────────────

// SSE 이벤트 타입 — GET /api/events (Server-Sent Events)
export type SseEventType =
  | "RUN_CREATED"
  | "RUN_STATUS_CHANGED"
  | "NODE_UPDATED"
  | "GATE_OPENED"
  | "GATE_RESOLVED"
  | "EVIDENCE_ADDED"
  | "RISK_UPDATED"
  | "TTL_UPDATED"
  | "AGENT_STATUS_CHANGED"
  | "AUDIT_ENTRY_ADDED"
  | "EMERGENCY_STOPPED"
  | "EXECUTOR_DISCONNECTED"
  | "CHAT_MESSAGE_ADDED"
  | "SYSTEM_ERROR";

// SSE 이벤트 래퍼
export interface SseEvent<T = unknown> {
  readonly type: SseEventType;
  readonly payload: T;
  readonly timestamp: string;
  readonly sequenceId: number;
}

// 개별 SSE 페이로드 타입
export type SseRunCreatedPayload = { readonly runId: string; readonly trustMode: TrustMode };
export type SseRunStatusPayload = { readonly runId: string; readonly status: RunStatus };
export type SseNodeUpdatedPayload = { readonly runId: string; readonly node: TimelineNodeDto };
export type SseGateOpenedPayload = { readonly runId: string; readonly gate: GateDto };
export type SseGateResolvedPayload = { readonly runId: string; readonly gateId: string; readonly resolution: GateResolutionDto };
export type SseRiskUpdatedPayload = { readonly runId: string; readonly riskLevel: RiskLevel; readonly riskScore: number };
export type SseTtlUpdatedPayload = { readonly tokenId: string; readonly remainingSeconds: number };
export type SseAgentStatusPayload = { readonly agent: AgentHealthDto };
export type SseAuditEntryPayload = { readonly entry: AuditEntryDto };
export type SseChatMessagePayload = { readonly message: ChatMessageDto };
export type SseSystemErrorPayload = { readonly code: string; readonly message: string };

// ─────────────────────────────────────────────
// Emergency Stop API
// ─────────────────────────────────────────────

// POST /api/emergency-stop
export interface EmergencyStopRequest {
  readonly runId: string;
  readonly reason: string;
}

export interface EmergencyStopDto {
  readonly stopped: boolean;
  readonly runId: string;
  readonly stoppedAt: string;
  readonly rollbackPointId: string | null;
}
