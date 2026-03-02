// 프로세스 실행 핸들러 — Phase 0 스텁 구현 (실제 OS 조작은 Phase 1+에서 구현)
import type { JarvisError } from "@jarvis/shared";
import { createError } from "@jarvis/shared";
import type { Result } from "@jarvis/shared";
import { err } from "@jarvis/shared";

// 프로세스 실행 결과
export interface ExecRunResult {
  readonly command: string;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
  readonly pid: number;
}

// 프로세스 종료 결과
export interface ProcessKillResult {
  readonly pid: number;
  readonly signal: string;
  readonly success: boolean;
}

// Phase 0 스텁 공통 에러 생성 헬퍼
function stubNotImplemented(operation: string): JarvisError {
  return createError(
    "INTERNAL_ERROR",
    `[Phase 0 스텁] ${operation} 작업은 Phase 1에서 구현됩니다`,
    { context: { operation, phase: "0", stub: true } }
  );
}

// 프로세스 실행 핸들러 — OS 프로세스 조작 추상화
export class ExecHandler {
  /**
   * 명령어 실행 — Phase 0 스텁
   * allowlist 검증은 PreHookValidator에서 사전에 수행됨
   */
  run(_command: string, _cwd?: string): Result<ExecRunResult, JarvisError> {
    return err(stubNotImplemented("EXEC_RUN"));
  }

  /**
   * 프로세스 종료 — Phase 0 스텁
   * PROCESS_KILL은 반드시 사용자 승인(Gate) 후 실행됨
   */
  kill(_pid: number, _signal: string = "SIGTERM"): Result<ProcessKillResult, JarvisError> {
    return err(stubNotImplemented("PROCESS_KILL"));
  }
}

// 기본 ExecHandler 인스턴스 팩토리
export function createExecHandler(): ExecHandler {
  return new ExecHandler();
}
