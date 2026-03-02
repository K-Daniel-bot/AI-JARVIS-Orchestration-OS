// 정책 관련 Zod 스키마 — 런타임 검증에 사용
import { z } from "zod";

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
