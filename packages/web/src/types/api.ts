// 웹 대시보드 API 클라이언트 타입 — Phase 0 스텁

import type { Result } from "@jarvis/shared";
import type { JarvisError, AgentType, RiskLevel } from "@jarvis/shared";

// API 응답 래퍼
export interface ApiResponse<T> {
  readonly success: boolean;
  readonly data: T | null;
  readonly error: string | null;
  readonly timestamp: string;
}

// 시스템 상태 요약 요청 응답
export interface SystemStatusResponse {
  readonly currentState: string;
  readonly activeRunId: string | null;
  readonly agentCount: number;
  readonly healthyAgentCount: number;
  readonly pendingGates: number;
  readonly riskLevel: RiskLevel;
}

// 에이전트 목록 응답
export interface AgentListResponse {
  readonly agents: readonly AgentSummary[];
}

// 에이전트 요약
export interface AgentSummary {
  readonly agentType: AgentType;
  readonly agentId: string;
  readonly status: string;
  readonly modelId: string;
  readonly totalTasks: number;
  readonly failedTasks: number;
}

// API 클라이언트 인터페이스
export interface DashboardApiClient {
  getSystemStatus(): Promise<Result<SystemStatusResponse, JarvisError>>;
  getAgents(): Promise<Result<AgentListResponse, JarvisError>>;
}
