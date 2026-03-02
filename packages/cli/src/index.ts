// @jarvis/cli — CLI 진입점 barrel export

// CLI 핵심
export { parseArgs, executeCommand } from "./cli.js";
export type { ParsedArgs } from "./cli.js";

// 설정
export { JarvisConfigSchema, DEFAULT_CONFIG, parseConfig, mergeConfig } from "./config.js";
export type { JarvisConfig } from "./config.js";

// 명령어 타입
export type {
  CommandName,
  LogLevel,
  OutputFormat,
  RunOptions,
  StatusOptions,
  StopOptions,
  AuditOptions,
  RollbackOptions,
  VersionOptions,
  GlobalOptions,
  CommandResult,
} from "./types/commands.js";

// 명령어 실행 함수
export { executeRunCommand } from "./commands/run.js";
export type { RunCommandOutput } from "./commands/run.js";

export { executeStatusCommand } from "./commands/status.js";
export type { StatusOutput } from "./commands/status.js";

export { executeStopCommand } from "./commands/stop.js";

export { executeAuditCommand } from "./commands/audit.js";
export type { AuditCommandOutput, AuditEntrySummary } from "./commands/audit.js";

export { executeVersionCommand, JARVIS_VERSION } from "./commands/version.js";
export type { VersionInfo } from "./commands/version.js";
