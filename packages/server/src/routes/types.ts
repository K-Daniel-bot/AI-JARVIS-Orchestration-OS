// 서버 라우트 공용 타입 재export — web/api/schema 와 동일한 구조 유지
// (패키지 간 순환 의존 없이 독립적으로 타입 선언)

export type TrustMode = "observe" | "suggest" | "semi-auto" | "full-auto";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type AgentHealthStatus = "HEALTHY" | "DEGRADED" | "UNRESPONSIVE" | "CRASHED";
export type AgentType =
  | "orchestrator" | "spec-agent" | "policy-risk" | "planner"
  | "codegen" | "review" | "test-build" | "executor" | "rollback";

export interface AgentHealthDto {
  readonly agentType: AgentType;
  readonly agentId: string;
  readonly status: AgentHealthStatus;
  readonly currentTask: string | null;
  readonly lastActiveAt: string;
  readonly consecutiveFailures: number;
}

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

export interface ApiSuccessResponse<T> {
  readonly success: true;
  readonly data: T;
  readonly error: null;
  readonly timestamp: string;
  readonly requestId: string;
}

export interface ApiErrorResponse {
  readonly success: false;
  readonly data: null;
  readonly error: { readonly code: string; readonly message: string };
  readonly timestamp: string;
  readonly requestId: string;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

// 성공 응답 생성 헬퍼
export function successResponse<T>(data: T): ApiSuccessResponse<T> {
  return {
    success: true,
    data,
    error: null,
    timestamp: new Date().toISOString(),
    requestId: crypto.randomUUID(),
  };
}

// 에러 응답 생성 헬퍼
export function errorResponse(code: string, message: string): ApiErrorResponse {
  return {
    success: false,
    data: null,
    error: { code, message },
    timestamp: new Date().toISOString(),
    requestId: crypto.randomUUID(),
  };
}
