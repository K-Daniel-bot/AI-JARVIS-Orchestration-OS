// 에이전트 시스템 공통 타입 정의

// 9개 에이전트 타입
export const AGENT_TYPES = {
  ORCHESTRATOR: "orchestrator",
  SPEC_AGENT: "spec-agent",
  POLICY_RISK: "policy-risk",
  PLANNER: "planner",
  CODEGEN: "codegen",
  REVIEW: "review",
  TEST_BUILD: "test-build",
  EXECUTOR: "executor",
  ROLLBACK: "rollback",
} as const;

export type AgentType = typeof AGENT_TYPES[keyof typeof AGENT_TYPES];

// 에이전트 건강 상태
export type AgentHealthStatus = "HEALTHY" | "DEGRADED" | "UNRESPONSIVE" | "CRASHED";

// 에이전트 상태 정보
export interface AgentHealthState {
  readonly agentId: string;
  readonly agentType: AgentType;
  readonly status: AgentHealthStatus;
  readonly lastHeartbeatAt: string;
  readonly currentTaskId?: string;
  readonly cpuUsage?: number;
  readonly memoryUsageMB?: number;
  readonly consecutiveFailures: number;
  readonly lastError?: string;
}

// Claude 모델 타입
export const MODEL_IDS = {
  OPUS: "claude-opus-4-6",
  SONNET: "claude-sonnet-4-6",
  HAIKU: "claude-haiku-4-5-20251001",
} as const;

export type ModelId = typeof MODEL_IDS[keyof typeof MODEL_IDS];

// 에이전트별 모델 배정
export const MODEL_ASSIGNMENT: Record<AgentType, ModelId> = {
  orchestrator: MODEL_IDS.OPUS,
  "spec-agent": MODEL_IDS.HAIKU,
  "policy-risk": MODEL_IDS.OPUS,
  planner: MODEL_IDS.SONNET,
  codegen: MODEL_IDS.SONNET,
  review: MODEL_IDS.SONNET,
  "test-build": MODEL_IDS.HAIKU,
  executor: MODEL_IDS.SONNET,
  rollback: MODEL_IDS.HAIKU,
} as const;

// 사용자 역할
export type UserRole = "Owner" | "Admin" | "User" | "Guest" | "AI-Autonomous";

// 신뢰 모드
export type TrustMode = "observe" | "suggest" | "semi-auto" | "full-auto";
