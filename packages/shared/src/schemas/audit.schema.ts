// 감사 로그 Zod 스키마 — 런타임 검증에 사용
import { z } from "zod";
import { PolicyStatusSchema, RiskLevelSchema } from "./policy.schema.js";

// 감사 로그 레벨
export const AuditLogLevelSchema = z.enum(["FULL", "SUMMARY"]);

// 실행 결과 상태
export const AuditResultStatusSchema = z.enum([
  "COMPLETED",
  "FAILED",
  "ROLLED_BACK",
  "ABORTED",
  "DENIED",
]);

// 액션 실행 상태
export const ActionExecutionStatusSchema = z.enum([
  "SUCCESS",
  "FAILED",
  "DENIED",
]);

// 실행된 액션 스키마
export const ActionPerformedSchema = z.object({
  actionId: z.string(),
  type: z.string(),
  status: ActionExecutionStatusSchema,
  durationMs: z.number().nonnegative(),
});

// 감사 로그 엔트리 스키마
export const AuditEntrySchema = z.object({
  auditId: z.string().startsWith("aud_"),
  timestamp: z.string().datetime(),
  logLevel: AuditLogLevelSchema,

  who: z.object({
    userId: z.string(),
    role: z.enum(["Owner", "Admin", "User", "Guest", "AI-Autonomous"]),
    sessionId: z.string(),
  }),

  what: z.object({
    rawInput: z.string(),
    aiInterpretation: z.string(),
    intent: z.string(),
  }),

  policy: z.object({
    policyDecisionId: z.string(),
    riskScore: z.number().min(0).max(100),
    riskLevel: RiskLevelSchema,
    status: PolicyStatusSchema,
  }),

  capability: z.object({
    tokenIds: z.array(z.string()).readonly(),
    scopesGranted: z.array(z.string()).readonly(),
  }),

  execution: z.object({
    runId: z.string(),
    actionsPerformed: z.array(ActionPerformedSchema).readonly(),
    rollbackPerformed: z.boolean(),
    rollbackReason: z.string().nullable(),
  }),

  result: z.object({
    status: AuditResultStatusSchema,
    outputSummary: z.string(),
    artifacts: z.array(z.string()).readonly(),
  }),

  evidence: z.object({
    screenshots: z.array(z.string()).readonly(),
    terminalLogs: z.array(z.string()).readonly(),
    previousActionId: z.string().nullable(),
  }),

  redactions: z.object({
    applied: z.array(z.string()).readonly(),
    patternsMatched: z.number().nonnegative(),
  }),

  integrity: z.object({
    hash: z.string(),
    previousHash: z.string(),
  }),
});
