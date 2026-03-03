// 프로세스 실행 핸들러 — Node.js child_process 기반 실제 구현
import { execSync } from "node:child_process";
import type { JarvisError } from "@jarvis/shared";
import { createError } from "@jarvis/shared";
import type { Result } from "@jarvis/shared";
import { err } from "@jarvis/shared";
import { ok } from "@jarvis/shared";

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

// 미구현 작업 에러 생성 헬퍼 (하위 호환성 유지)
function stubNotImplemented(operation: string): JarvisError {
  return createError(
    "INTERNAL_ERROR",
    `[스텁] ${operation} 작업은 지원되지 않습니다`,
    { context: { operation, stub: true } }
  );
}

// 사용하지 않는 함수 경고 억제 (하위 호환성 유지)
void stubNotImplemented;

// 프로세스 실행 핸들러 — OS 프로세스 조작 추상화
export class ExecHandler {
  /**
   * 명령어 실행 — execSync로 동기 실행하며 stdout/stderr/exitCode를 반환한다
   * allowlist 검증은 PreHookValidator에서 사전에 수행됨
   */
  run(command: string, cwd?: string): Result<ExecRunResult, JarvisError> {
    const startMs = Date.now();
    try {
      const stdout = execSync(command, {
        cwd,
        encoding: "utf-8",
        timeout: 30_000,
        maxBuffer: 10 * 1024 * 1024,
      });
      const durationMs = Date.now() - startMs;
      return ok({
        command,
        exitCode: 0,
        stdout,
        stderr: "",
        durationMs,
        pid: 0,
      });
    } catch (e: unknown) {
      // execSync는 exit code != 0일 때도 에러를 throw하므로 별도 처리
      if (e !== null && typeof e === "object" && "status" in e) {
        const execErr = e as { status: number | null; stdout: string; stderr: string };
        const durationMs = Date.now() - startMs;
        return ok({
          command,
          exitCode: execErr.status ?? 1,
          stdout: execErr.stdout ?? "",
          stderr: execErr.stderr ?? "",
          durationMs,
          pid: 0,
        });
      }
      return err(
        createError("INTERNAL_ERROR", `명령 실행 실패: ${command}`, {
          context: { command, error: String(e) },
        })
      );
    }
  }

  /**
   * 프로세스 종료 — Node.js process.kill()로 지정 PID에 시그널을 전송한다
   * PROCESS_KILL은 반드시 사용자 승인(Gate) 후 실행됨
   */
  kill(pid: number, signal: string = "SIGTERM"): Result<ProcessKillResult, JarvisError> {
    try {
      process.kill(pid, signal);
      return ok({ pid, signal, success: true });
    } catch (e) {
      return err(
        createError("INTERNAL_ERROR", `프로세스 종료 실패: PID ${pid}`, {
          context: { pid, signal, error: String(e) },
        })
      );
    }
  }
}

// 기본 ExecHandler 인스턴스 팩토리
export function createExecHandler(): ExecHandler {
  return new ExecHandler();
}
