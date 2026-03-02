// 머신 컨텍스트 타입 — XState v5 상태 머신의 확장 컨텍스트
import type {
  AgentType,
  PolicyDecision,
  MachineState,
  JarvisError,
} from "@jarvis/shared";
import type { EnvironmentBundle } from "../types/environment.js";

// 게이트 승인 정보
export interface GateApproval {
  readonly gateId: string;
  readonly gateLevel: "L1" | "L2" | "L3";
  readonly approvedBy: string;
  readonly approvedAt: string;
  readonly scopeModifications: readonly string[];
}

// 머신 컨텍스트 — 상태 머신 전체에서 유지되는 데이터
export interface JarvisMachineContext {
  readonly runId: string;
  readonly sessionId: string;
  readonly currentAgent: AgentType | null;
  readonly previousState: MachineState | null;
  readonly policyDecision: PolicyDecision | null;
  readonly environment: EnvironmentBundle;
  readonly gateApprovals: readonly GateApproval[];
  readonly errorHistory: readonly JarvisError[];
  readonly retryCount: number;
  readonly startedAt: string;
  readonly lastTransitionAt: string;
}

// 초기 컨텍스트 생성
export function createInitialContext(
  runId: string,
  sessionId: string,
  environment: EnvironmentBundle,
): JarvisMachineContext {
  const now = new Date().toISOString();
  return {
    runId,
    sessionId,
    currentAgent: null,
    previousState: null,
    policyDecision: null,
    environment,
    gateApprovals: [],
    errorHistory: [],
    retryCount: 0,
    startedAt: now,
    lastTransitionAt: now,
  };
}
