// 상태 전이 가드 — PolicyDecision 검증 및 조건부 전이 제어
import { LOOP_LIMITS } from "@jarvis/shared";
import type { JarvisMachineContext } from "./context.js";

// 정책 판정 존재 여부 — policyDecision이 설정되었는지 확인
export function hasPolicyDecision(
  context: JarvisMachineContext,
): boolean {
  return context.policyDecision !== null;
}

// 정책 판정이 허용(ALLOW)인지 검증
export function isPolicyAllow(
  context: JarvisMachineContext,
): boolean {
  if (!context.policyDecision) return false;
  return context.policyDecision.outcome.status === "ALLOW";
}

// 정책 판정이 조건부 허용(CONSTRAINED_ALLOW)인지 검증
export function isPolicyConstrainedAllow(
  context: JarvisMachineContext,
): boolean {
  if (!context.policyDecision) return false;
  return context.policyDecision.outcome.status === "CONSTRAINED_ALLOW";
}

// 정책 판정이 승인 필요(APPROVAL_REQUIRED)인지 검증
export function isPolicyApprovalRequired(
  context: JarvisMachineContext,
): boolean {
  if (!context.policyDecision) return false;
  return context.policyDecision.outcome.status === "APPROVAL_REQUIRED";
}

// 정책 판정이 거부(DENY)인지 검증
export function isPolicyDeny(
  context: JarvisMachineContext,
): boolean {
  if (!context.policyDecision) return false;
  return context.policyDecision.outcome.status === "DENY";
}

// 재시도 횟수가 최대 에러 한도 이내인지 검증
export function canRetry(
  context: JarvisMachineContext,
): boolean {
  return context.retryCount < LOOP_LIMITS.MAX_CONSECUTIVE_ERRORS;
}

// 게이트 승인이 완료되었는지 검증
export function hasGateApproval(
  context: JarvisMachineContext,
  gateLevel: "L1" | "L2" | "L3",
): boolean {
  return context.gateApprovals.some((g) => g.gateLevel === gateLevel);
}

// 환경 번들에 스펙이 존재하는지 검증
export function hasSpec(
  context: JarvisMachineContext,
): boolean {
  return context.environment.spec !== null;
}

// 환경 번들에 계획이 존재하는지 검증
export function hasPlan(
  context: JarvisMachineContext,
): boolean {
  return context.environment.plan !== null;
}

// 환경 번들에 변경 세트가 존재하는지 검증
export function hasChangeSet(
  context: JarvisMachineContext,
): boolean {
  return context.environment.changeSet !== null;
}

// 위험도가 CRITICAL이 아닌지 검증
export function isNotCriticalRisk(
  context: JarvisMachineContext,
): boolean {
  if (!context.policyDecision) return true;
  return context.policyDecision.outcome.riskLevel !== "CRITICAL";
}
