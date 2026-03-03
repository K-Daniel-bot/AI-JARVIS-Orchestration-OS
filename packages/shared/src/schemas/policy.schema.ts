// 정책 관련 Zod 스키마 — 런타임 검증에 사용
import { z } from "zod";
import type { UserRole, TrustMode } from "../types/agent.js";

// 정책 상태
export const PolicyStatusSchema = z.enum([
  "ALLOW",
  "DENY",
  "APPROVAL_REQUIRED",
  "CONSTRAINED_ALLOW",
]);

// 위험도 레벨
export const RiskLevelSchema = z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);

// 요청 의도
export const RequestIntentSchema = z.enum([
  "CODE_IMPLEMENTATION",
  "FILE_OPERATION",
  "APP_LAUNCH",
  "WEB_ACCESS",
  "SYSTEM_CONFIG",
  "PACKAGE_INSTALL",
  "NETWORK_REQUEST",
  "PROCESS_MANAGEMENT",
  "MOBILE_ACTION",
]);

// Capability 유형
export const CapabilityTypeSchema = z.enum([
  "fs.read",
  "fs.write",
  "exec.run",
  "app.launch",
  "network.access",
  "clipboard.read",
  "clipboard.write",
  "browser.navigate",
  "browser.download",
  "process.kill",
  "mobile.contact.read",
  "mobile.call.dial",
  "mobile.sms.send",
  "mobile.sms.read",
  "mobile.messenger.send",
  "mobile.messenger.read",
  "mobile.app.control",
  "mobile.notification.read",
]);

// Capability 부여 스키마
export const CapabilityGrantSchema = z.object({
  cap: CapabilityTypeSchema,
  scope: z.union([z.string(), z.array(z.string()).readonly()]),
  ttlSeconds: z.number().positive(),
  maxUses: z.number().int().positive().default(1),
});

// 정책 판정 결과 스키마
export const PolicyOutcomeSchema = z.object({
  status: PolicyStatusSchema,
  riskScore: z.number().min(0).max(100),
  riskLevel: RiskLevelSchema,
  requiresGates: z.array(z.string()).readonly(),
  reasonCodes: z.array(z.string()).readonly(),
  humanExplanation: z.string(),
});

// Capability 토큰 상태
export const CapabilityTokenStatusSchema = z.enum([
  "ACTIVE",
  "CONSUMED",
  "EXPIRED",
  "REVOKED",
]);

// 게이트 타입 스키마
export const GateTypeSchema = z.enum([
  "GATE_PLAN",
  "GATE_APPLY_CHANGES",
  "GATE_DEPLOY",
  "GATE_WEB_PRECHECK",
  "GATE_DOWNLOAD",
  "GATE_DESTRUCTIVE",
  "GATE_PHONE_CONFIRM",
  "GATE_SMS_CONFIRM",
  "GATE_APP_ACCESS",
  "GATE_MESSENGER_READ",
]);

// 게이트 레벨 스키마
export const GateLevelSchema = z.enum(["L1", "L2", "L3"]);

// 정책 판정 요청 주체 스키마
export const PolicySubjectSchema = z.object({
  userId: z.string().min(1),
  role: z.string() as z.ZodType<UserRole>,
  device: z.string(),
  sessionId: z.string().min(1),
});

// 정책 판정 요청 스키마
export const PolicyRequestSchema = z.object({
  rawInput: z.string(),
  intent: RequestIntentSchema,
  targets: z.array(z.string()).readonly(),
  requiresWebAccess: z.boolean(),
  requiresLogin: z.boolean(),
});

// 파일 시스템 제약 스키마
export const FsConstraintsSchema = z.object({
  readAllow: z.array(z.string()).readonly(),
  writeAllow: z.array(z.string()).readonly(),
  writeDeny: z.array(z.string()).readonly(),
});

// 실행 제약 스키마
export const ExecConstraintsSchema = z.object({
  allow: z.array(z.string()).readonly(),
  deny: z.array(z.string()).readonly(),
});

// 네트워크 제약 스키마
export const NetworkConstraintsSchema = z.object({
  allowDomains: z.array(z.string()).readonly(),
  denyDomains: z.array(z.string()).readonly(),
  default: z.enum(["ALLOW", "DENY"]),
});

// 전체 제약 조건 스키마
export const PolicyConstraintsSchema = z.object({
  fs: FsConstraintsSchema,
  exec: ExecConstraintsSchema,
  network: NetworkConstraintsSchema,
});

// 정책 판정 전체 구조 스키마
export const PolicyDecisionSchema = z.object({
  decisionId: z.string().min(1),
  timestamp: z.string(),
  subject: PolicySubjectSchema,
  request: PolicyRequestSchema,
  outcome: PolicyOutcomeSchema,
  constraints: PolicyConstraintsSchema,
  requiredCapabilities: z.array(CapabilityGrantSchema).readonly(),
});

// Capability 토큰 전체 구조 스키마
export const CapabilityTokenSchema = z.object({
  tokenId: z.string().min(1),
  issuedAt: z.string(),
  issuedBy: z.string(),
  approvedBy: z.string(),
  grant: CapabilityGrantSchema,
  context: z.object({
    sessionId: z.string(),
    runId: z.string(),
    policyDecisionId: z.string(),
    trustMode: z.string() as z.ZodType<TrustMode>,
  }),
  status: CapabilityTokenStatusSchema,
  consumedAt: z.string().nullable(),
  consumedByAction: z.string().nullable(),
  revokedReason: z.string().nullable(),
});
