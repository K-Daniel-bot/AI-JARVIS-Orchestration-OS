// CLI 설정 관리 — .jarvis.config.json 로딩 및 검증

import { z } from "zod";
import type { Result } from "@jarvis/shared";
import { ok, err, createError } from "@jarvis/shared";
import type { JarvisError } from "@jarvis/shared";

// 설정 스키마 (Zod 검증)
export const JarvisConfigSchema = z.object({
  trustMode: z.enum(["observe", "suggest", "semi-auto", "full-auto"]).default("suggest"),
  timeoutSeconds: z.number().positive().default(300),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  databasePath: z.string().default("./data/audit.db"),
  policyFile: z.string().default("./.claude/contract.md"),
  capabilities: z.object({
    autoApproveLowRisk: z.boolean().default(false),
    requireBiometricForGate: z.boolean().default(false),
    mobileRequireApproval: z.boolean().default(true),
  }).default({}),
  advanced: z.object({
    batchApiEnabled: z.boolean().default(false),
    promptCachingEnabled: z.boolean().default(false),
    maxTokensPerRun: z.number().positive().default(100000),
  }).default({}),
});

export type JarvisConfig = z.infer<typeof JarvisConfigSchema>;

// 기본 설정
export const DEFAULT_CONFIG: JarvisConfig = {
  trustMode: "suggest",
  timeoutSeconds: 300,
  logLevel: "info",
  databasePath: "./data/audit.db",
  policyFile: "./.claude/contract.md",
  capabilities: {
    autoApproveLowRisk: false,
    requireBiometricForGate: false,
    mobileRequireApproval: true,
  },
  advanced: {
    batchApiEnabled: false,
    promptCachingEnabled: false,
    maxTokensPerRun: 100000,
  },
};

// 설정 파일 파싱
export function parseConfig(raw: unknown): Result<JarvisConfig, JarvisError> {
  const parsed = JarvisConfigSchema.safeParse(raw);
  if (parsed.success) {
    return ok(parsed.data);
  }
  return err(createError(
    "VALIDATION_FAILED",
    `설정 파일 검증 실패: ${parsed.error.message}`,
  ));
}

// 설정 병합 (기본값 + 파일)
export function mergeConfig(
  fileConfig: Partial<JarvisConfig>,
): Result<JarvisConfig, JarvisError> {
  return parseConfig({ ...DEFAULT_CONFIG, ...fileConfig });
}
