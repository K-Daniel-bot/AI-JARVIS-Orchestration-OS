// 에이전트 간 통신 메시지 타입 — architecture-deep.md 7.2절 기반
import type { AgentType } from "./agent.js";

// 메시지 유형
export type MessageType =
  | "HANDOFF"
  | "REQUEST"
  | "RESPONSE"
  | "ERROR"
  | "HEARTBEAT"
  | "STATUS_UPDATE"
  | "UPSTREAM_FAILURE";

// 아티팩트 유형
export type ArtifactType =
  | "SPEC"
  | "POLICY_DECISION"
  | "PLAN"
  | "CHANGESET"
  | "REVIEW_RESULT"
  | "TEST_RESULT"
  | "EXECUTION_RESULT"
  | "ROLLBACK_RESULT";

// 재시도 정책
export interface RetryPolicy {
  readonly maxRetries: number;
  readonly backoffMs: number;
}

// 에이전트 간 메시지 표준 포맷
export interface AgentMessage {
  readonly messageId: string;
  readonly fromAgent: AgentType;
  readonly toAgent: AgentType;
  readonly messageType: MessageType;
  readonly timestamp: string;
  readonly runId: string;
  readonly payload: MessagePayload;
  readonly timeoutMs: number;
  readonly retryPolicy: RetryPolicy;
}

// 메시지 페이로드
export interface MessagePayload {
  readonly artifactType: ArtifactType;
  readonly artifactRef: string;
  readonly summary: string;
  readonly metadata: Record<string, unknown>;
}
