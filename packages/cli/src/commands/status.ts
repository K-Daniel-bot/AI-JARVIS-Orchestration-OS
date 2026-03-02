// jarvis status 명령어 — 현재 상태 조회

import type { Result } from "@jarvis/shared";
import { ok } from "@jarvis/shared";
import type { JarvisError } from "@jarvis/shared";
import type { StatusOptions, CommandResult } from "../types/commands.js";

// 상태 조회 결과
export interface StatusOutput {
  readonly runId: string | null;
  readonly sessionId: string | null;
  readonly status: string;
  readonly progressPercent: number;
  readonly mode: string;
  readonly riskLevel: string;
  readonly timeoutRemainingSeconds: number | null;
}

// jarvis status 실행
export function executeStatusCommand(
  options: StatusOptions,
): Result<CommandResult, JarvisError> {
  // Phase 0: 현재 실행 중인 세션이 없는 상태 반환
  const output: StatusOutput = {
    runId: null,
    sessionId: options.sessionId ?? null,
    status: "IDLE",
    progressPercent: 0,
    mode: "suggest",
    riskLevel: "NONE",
    timeoutRemainingSeconds: null,
  };

  return ok({
    success: true,
    exitCode: 0,
    message: "현재 실행 중인 작업이 없습니다.",
    data: {
      runId: output.runId,
      sessionId: output.sessionId,
      status: output.status,
      progressPercent: output.progressPercent,
      mode: output.mode,
      riskLevel: output.riskLevel,
      timeoutRemainingSeconds: output.timeoutRemainingSeconds,
    },
  });
}
