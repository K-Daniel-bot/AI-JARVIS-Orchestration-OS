// CLI 명령어 타입 정의

import type { TrustMode } from "@jarvis/shared";

// CLI 명령어 타입
export type CommandName =
  | "run"
  | "status"
  | "stop"
  | "audit"
  | "rollback"
  | "mobile"
  | "policy"
  | "token"
  | "version";

// 로그 레벨
export type LogLevel = "debug" | "info" | "warn" | "error";

// 출력 형식
export type OutputFormat = "text" | "json" | "csv";

// jarvis run 옵션
export interface RunOptions {
  readonly request: string;
  readonly mode: TrustMode;
  readonly timeout: number;
  readonly noApprove: boolean;
  readonly logLevel: LogLevel;
  readonly sessionId?: string;
  readonly dryRun: boolean;
}

// jarvis status 옵션
export interface StatusOptions {
  readonly sessionId?: string;
  readonly watch: boolean;
  readonly json: boolean;
  readonly verbose: boolean;
}

// jarvis stop 옵션
export interface StopOptions {
  readonly sessionId?: string;
  readonly force: boolean;
  readonly reason?: string;
}

// jarvis audit 옵션
export interface AuditOptions {
  readonly runId?: string;
  readonly sessionId?: string;
  readonly agentId?: string;
  readonly since?: string;
  readonly until?: string;
  readonly policyViolations: boolean;
  readonly errors: boolean;
  readonly limit: number;
  readonly format: OutputFormat;
  readonly exportPath?: string;
}

// jarvis rollback 옵션
export interface RollbackOptions {
  readonly runId: string;
  readonly checkpoint?: string;
  readonly force: boolean;
  readonly preserveLogs: boolean;
}

// jarvis version 옵션
export interface VersionOptions {
  readonly verbose: boolean;
  readonly checkUpdates: boolean;
}

// 공통 옵션 (모든 명령어에 적용)
export interface GlobalOptions {
  readonly help: boolean;
  readonly config?: string;
  readonly logLevel: LogLevel;
  readonly quiet: boolean;
  readonly json: boolean;
}

// 명령어 실행 결과
export interface CommandResult {
  readonly success: boolean;
  readonly exitCode: number;
  readonly message?: string;
  readonly data?: Record<string, unknown>;
}
