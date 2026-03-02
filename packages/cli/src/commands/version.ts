// jarvis version 명령어 — 버전 정보

import type { Result } from "@jarvis/shared";
import { ok } from "@jarvis/shared";
import type { JarvisError } from "@jarvis/shared";
import type { CommandResult } from "../types/commands.js";

// 버전 정보 상수
export const JARVIS_VERSION = "0.1.0" as const;

// 버전 정보 구조
export interface VersionInfo {
  readonly version: string;
  readonly core: {
    readonly xstate: string;
    readonly typescript: string;
    readonly zod: string;
  };
  readonly runtime: {
    readonly nodeVersion: string;
    readonly platform: string;
  };
}

// jarvis version 실행
export function executeVersionCommand(
  verbose: boolean,
): Result<CommandResult, JarvisError> {
  const info: VersionInfo = {
    version: JARVIS_VERSION,
    core: {
      xstate: "5.19.2",
      typescript: "5.7.3",
      zod: "3.24.1",
    },
    runtime: {
      nodeVersion: process.version,
      platform: process.platform,
    },
  };

  const message = verbose
    ? `JARVIS OS v${info.version}\n` +
      `  xstate: ${info.core.xstate}\n` +
      `  typescript: ${info.core.typescript}\n` +
      `  node: ${info.runtime.nodeVersion}\n` +
      `  platform: ${info.runtime.platform}`
    : `JARVIS OS v${info.version}`;

  return ok({
    success: true,
    exitCode: 0,
    message,
    data: {
      version: info.version,
      core: info.core,
      runtime: info.runtime,
    },
  });
}
