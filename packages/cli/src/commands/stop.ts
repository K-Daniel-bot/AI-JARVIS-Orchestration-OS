// jarvis stop 명령어 — 비상 중단

import type { Result } from "@jarvis/shared";
import { ok, err, createError } from "@jarvis/shared";
import type { JarvisError } from "@jarvis/shared";
import type { StopOptions, CommandResult } from "../types/commands.js";

// jarvis stop 실행
export function executeStopCommand(
  options: StopOptions,
): Result<CommandResult, JarvisError> {
  // Phase 0: 실행 중인 세션이 없으면 에러
  if (!options.sessionId) {
    return err(createError(
      "VALIDATION_FAILED",
      "중단할 세션이 없습니다. 현재 실행 중인 작업이 없습니다.",
    ));
  }

  return ok({
    success: true,
    exitCode: 0,
    message: `세션 ${options.sessionId} 중단 완료`,
    data: {
      sessionId: options.sessionId,
      reason: options.reason ?? "사용자 요청",
      forceStopped: options.force,
    },
  });
}
