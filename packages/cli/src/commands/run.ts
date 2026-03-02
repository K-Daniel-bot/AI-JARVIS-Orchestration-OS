// jarvis run 명령어 — 사용자 요청 실행 (메인 진입점)

import type { Result } from "@jarvis/shared";
import { ok, err, createError, generateRunId, generateSessionId, nowISO } from "@jarvis/shared";
import type { JarvisError } from "@jarvis/shared";
import type { RunOptions, CommandResult } from "../types/commands.js";
import type { JarvisConfig } from "../config.js";

// 실행 요청 결과
export interface RunCommandOutput {
  readonly runId: string;
  readonly sessionId: string;
  readonly status: string;
  readonly message: string;
  readonly riskLevel: string;
  readonly startedAt: string;
}

// jarvis run 실행
export function executeRunCommand(
  options: RunOptions,
  config: JarvisConfig,
): Result<CommandResult, JarvisError> {
  // 요청 검증
  if (!options.request || options.request.trim().length === 0) {
    return err(createError(
      "VALIDATION_FAILED",
      "요청 내용이 비어있습니다. 실행할 작업을 입력하세요.",
    ));
  }

  // 타임아웃 검증
  const timeout = options.timeout > 0 ? options.timeout : config.timeoutSeconds;
  if (timeout > 3600) {
    return err(createError(
      "VALIDATION_FAILED",
      "타임아웃은 3600초(1시간)를 초과할 수 없습니다.",
    ));
  }

  // 실행 ID 생성
  const runId = generateRunId();
  const sessionId = options.sessionId ?? generateSessionId();

  // Phase 0: 실제 에이전트 파이프라인 대신 응답 생성
  const output: RunCommandOutput = {
    runId,
    sessionId,
    status: options.dryRun ? "DRY_RUN" : "PENDING",
    message: options.dryRun
      ? `시뮬레이션 완료: "${options.request}"`
      : `작업 시작: "${options.request}" (모드: ${options.mode})`,
    riskLevel: "LOW",
    startedAt: nowISO(),
  };

  return ok({
    success: true,
    exitCode: 0,
    message: output.message,
    data: {
      runId: output.runId,
      sessionId: output.sessionId,
      status: output.status,
      riskLevel: output.riskLevel,
      startedAt: output.startedAt,
    },
  });
}
