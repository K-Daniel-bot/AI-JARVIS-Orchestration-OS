// 에이전트 메시지 Zod 스키마 — 런타임 검증에 사용
import { z } from "zod";

// 에이전트 타입
export const AgentTypeSchema = z.enum([
  "orchestrator",
  "spec-agent",
  "policy-risk",
  "planner",
  "codegen",
  "review",
  "test-build",
  "executor",
  "rollback",
]);

// 메시지 유형
export const MessageTypeSchema = z.enum([
  "HANDOFF",
  "REQUEST",
  "RESPONSE",
  "ERROR",
  "HEARTBEAT",
  "STATUS_UPDATE",
  "UPSTREAM_FAILURE",
]);

// 아티팩트 유형
export const ArtifactTypeSchema = z.enum([
  "SPEC",
  "POLICY_DECISION",
  "PLAN",
  "CHANGESET",
  "REVIEW_RESULT",
  "TEST_RESULT",
  "EXECUTION_RESULT",
  "ROLLBACK_RESULT",
]);

// 재시도 정책
export const RetryPolicySchema = z.object({
  maxRetries: z.number().int().nonnegative().default(2),
  backoffMs: z.number().positive().default(5000),
});

// 메시지 페이로드
export const MessagePayloadSchema = z.object({
  artifactType: ArtifactTypeSchema,
  artifactRef: z.string(),
  summary: z.string(),
  metadata: z.record(z.unknown()),
});

// 에이전트 메시지 전체 스키마
export const AgentMessageSchema = z.object({
  messageId: z.string().startsWith("msg_"),
  fromAgent: AgentTypeSchema,
  toAgent: AgentTypeSchema,
  messageType: MessageTypeSchema,
  timestamp: z.string().datetime(),
  runId: z.string().startsWith("run_"),
  payload: MessagePayloadSchema,
  timeoutMs: z.number().positive().default(60000),
  retryPolicy: RetryPolicySchema,
});
