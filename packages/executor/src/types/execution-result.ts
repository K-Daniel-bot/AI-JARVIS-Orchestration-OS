// 실행 결과 타입 정의 — ExecutionTrace 스키마(action-api.json) 기반
import type { ActionType } from "./action-types.js";

// 개별 액션 실행 상태
export type ExecutionStatus =
  | "SUCCESS"
  | "FAILED"
  | "SKIPPED"
  | "DENIED"
  | "PENDING";

// 전체 실행 트레이스 상태
export type TraceStatus =
  | "SUCCESS"
  | "PARTIAL_SUCCESS"
  | "FAILED"
  | "ABORTED";

// 실행 증거 — 스크린샷/표준출력 참조
export interface ExecutionEvidence {
  readonly screenshotRef: string | null;
  readonly stdoutRef: string | null;
}

// 개별 액션 실행 결과
export interface ActionExecutionResult {
  readonly actionId: string;
  readonly actionType: ActionType;
  readonly status: ExecutionStatus;
  readonly startedAt: string;
  readonly endedAt: string;
  readonly durationMs: number;
  readonly output: unknown;
  readonly error: string | null;
  readonly evidence: ExecutionEvidence;
}

// 전체 실행 트레이스 — 배치 실행의 종합 결과
export interface ExecutionTrace {
  readonly runId: string;
  readonly status: TraceStatus;
  readonly steps: readonly ActionExecutionResult[];
  readonly redactionsApplied: readonly string[];
  readonly startedAt: string;
  readonly endedAt: string;
}
