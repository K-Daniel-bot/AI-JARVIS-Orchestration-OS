// 상태 전이 액션 — 상태 변경 시 실행되는 사이드 이펙트
import type { AgentType, MachineState, JarvisError } from "@jarvis/shared";
import type { JarvisMachineContext, GateApproval } from "./context.js";
import type { EnvironmentBundle } from "../types/environment.js";

// 현재 에이전트 할당
export function assignAgent(
  context: JarvisMachineContext,
  agent: AgentType,
): JarvisMachineContext {
  return {
    ...context,
    currentAgent: agent,
    lastTransitionAt: new Date().toISOString(),
  };
}

// 이전 상태 기록
export function recordPreviousState(
  context: JarvisMachineContext,
  state: MachineState,
): JarvisMachineContext {
  return {
    ...context,
    previousState: state,
    lastTransitionAt: new Date().toISOString(),
  };
}

// 에러 기록 및 재시도 카운트 증가
export function recordError(
  context: JarvisMachineContext,
  error: JarvisError,
): JarvisMachineContext {
  return {
    ...context,
    errorHistory: [...context.errorHistory, error],
    retryCount: context.retryCount + 1,
    lastTransitionAt: new Date().toISOString(),
  };
}

// 재시도 카운트 초기화
export function resetRetryCount(
  context: JarvisMachineContext,
): JarvisMachineContext {
  return {
    ...context,
    retryCount: 0,
    lastTransitionAt: new Date().toISOString(),
  };
}

// 게이트 승인 추가
export function addGateApproval(
  context: JarvisMachineContext,
  approval: GateApproval,
): JarvisMachineContext {
  return {
    ...context,
    gateApprovals: [...context.gateApprovals, approval],
    lastTransitionAt: new Date().toISOString(),
  };
}

// 환경 번들 업데이트
export function updateEnvironment(
  context: JarvisMachineContext,
  patch: Partial<EnvironmentBundle>,
): JarvisMachineContext {
  return {
    ...context,
    environment: { ...context.environment, ...patch },
    lastTransitionAt: new Date().toISOString(),
  };
}

// 에이전트 할당 해제
export function clearAgent(
  context: JarvisMachineContext,
): JarvisMachineContext {
  return {
    ...context,
    currentAgent: null,
    lastTransitionAt: new Date().toISOString(),
  };
}
