// OS 추상화 레이어 — Node.js 실제 구현 (Phase 1) + 테스트용 스텁 구현
import fs from "node:fs";
import { execSync, spawn } from "node:child_process";
import path from "node:path";
import type { Result, JarvisError } from "@jarvis/shared";
import { ok, err, createError, ERROR_CODES } from "@jarvis/shared";

// 지원 OS 플랫폼
export type OsPlatform = "windows" | "macos" | "linux";

// 파일 읽기 결과
export interface OsReadFileResult {
  readonly path: string;
  readonly content: string;
  readonly sizeBytes: number;
}

// 파일 쓰기 결과
export interface OsWriteFileResult {
  readonly path: string;
  readonly bytesWritten: number;
}

// 파일 삭제 결과
export interface OsDeleteFileResult {
  readonly path: string;
  readonly deleted: boolean;
}

// 명령어 실행 결과
export interface OsExecuteCommandResult {
  readonly command: string;
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
  readonly durationMs: number;
}

// 앱 실행 결과
export interface OsLaunchAppResult {
  readonly appName: string;
  readonly pid: number;
  readonly launched: boolean;
}

// 디렉토리 목록 조회 결과
export interface OsListDirectoryResult {
  readonly path: string;
  readonly entries: readonly {
    name: string;
    isDirectory: boolean;
    sizeBytes: number;
    modifiedAt: string;
  }[];
}

// 파일 이동 결과
export interface OsMoveFileResult {
  readonly sourcePath: string;
  readonly destPath: string;
}

// 프로세스 종료 결과
export interface OsKillProcessResult {
  readonly pid: number;
  readonly signal: string;
  readonly success: boolean;
}

// OS 추상화 인터페이스 — 플랫폼 독립적 OS 조작 계약
export interface OsAbstraction {
  readonly platform: OsPlatform;

  // 파일 읽기
  readFile(path: string): Result<OsReadFileResult, JarvisError>;

  // 파일 쓰기
  writeFile(path: string, content: string): Result<OsWriteFileResult, JarvisError>;

  // 파일 삭제
  deleteFile(path: string): Result<OsDeleteFileResult, JarvisError>;

  // 디렉토리 목록 조회
  listDirectory(path: string): Result<OsListDirectoryResult, JarvisError>;

  // 파일 이동
  moveFile(sourcePath: string, destPath: string): Result<OsMoveFileResult, JarvisError>;

  // 명령어 실행
  executeCommand(command: string, cwd?: string): Result<OsExecuteCommandResult, JarvisError>;

  // 앱 실행
  launchApp(appName: string, args?: readonly string[]): Result<OsLaunchAppResult, JarvisError>;

  // 프로세스 종료
  killProcess(pid: number, signal?: string): Result<OsKillProcessResult, JarvisError>;
}

// 현재 실행 환경의 OS 플랫폼 감지
export function detectPlatform(): OsPlatform {
  const platform = process.platform;
  if (platform === "win32") return "windows";
  if (platform === "darwin") return "macos";
  return "linux";
}

// Node.js 실제 구현 — fs, child_process 기반 OS 조작
class NodeOsAbstraction implements OsAbstraction {
  readonly platform: OsPlatform;

  constructor(platform: OsPlatform) {
    this.platform = platform;
  }

  // 파일을 UTF-8로 읽고 크기를 바이트 단위로 반환
  readFile(filePath: string): Result<OsReadFileResult, JarvisError> {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const sizeBytes = Buffer.byteLength(content, "utf-8");
      return ok({ path: filePath, content, sizeBytes });
    } catch (e) {
      return err(createError(
        ERROR_CODES.INTERNAL_ERROR,
        `파일 읽기 실패: ${filePath}`,
        { context: { filePath, cause: String(e) } }
      ));
    }
  }

  // 파일 쓰기 — 상위 디렉토리가 없으면 자동 생성
  writeFile(filePath: string, content: string): Result<OsWriteFileResult, JarvisError> {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, "utf-8");
      const bytesWritten = Buffer.byteLength(content, "utf-8");
      return ok({ path: filePath, bytesWritten });
    } catch (e) {
      return err(createError(
        ERROR_CODES.INTERNAL_ERROR,
        `파일 쓰기 실패: ${filePath}`,
        { context: { filePath, cause: String(e) } }
      ));
    }
  }

  // 파일 삭제
  deleteFile(filePath: string): Result<OsDeleteFileResult, JarvisError> {
    try {
      fs.unlinkSync(filePath);
      return ok({ path: filePath, deleted: true });
    } catch (e) {
      return err(createError(
        ERROR_CODES.INTERNAL_ERROR,
        `파일 삭제 실패: ${filePath}`,
        { context: { filePath, cause: String(e) } }
      ));
    }
  }

  // 디렉토리 목록 조회 — 각 항목의 이름/타입/크기/수정일 반환
  listDirectory(dirPath: string): Result<OsListDirectoryResult, JarvisError> {
    try {
      const names = fs.readdirSync(dirPath);
      const entries = names.map((name) => {
        const fullPath = path.join(dirPath, name);
        const stat = fs.statSync(fullPath);
        return {
          name,
          isDirectory: stat.isDirectory(),
          sizeBytes: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        };
      });
      return ok({ path: dirPath, entries });
    } catch (e) {
      return err(createError(
        ERROR_CODES.INTERNAL_ERROR,
        `디렉토리 목록 조회 실패: ${dirPath}`,
        { context: { dirPath, cause: String(e) } }
      ));
    }
  }

  // 파일 이동 — 대상 디렉토리가 없으면 자동 생성
  moveFile(sourcePath: string, destPath: string): Result<OsMoveFileResult, JarvisError> {
    try {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.renameSync(sourcePath, destPath);
      return ok({ sourcePath, destPath });
    } catch (e) {
      return err(createError(
        ERROR_CODES.INTERNAL_ERROR,
        `파일 이동 실패: ${sourcePath} → ${destPath}`,
        { context: { sourcePath, destPath, cause: String(e) } }
      ));
    }
  }

  // 명령어 실행 — 최대 30초 타임아웃, 10MB 출력 버퍼 제한
  executeCommand(command: string, cwd?: string): Result<OsExecuteCommandResult, JarvisError> {
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
        stdout: stdout ?? "",
        stderr: "",
        durationMs,
      });
    } catch (e) {
      const durationMs = Date.now() - startMs;
      // execSync 실패 시 Error 객체에 stdout/stderr/status 포함
      const caught = e as { stdout?: string; stderr?: string; status?: number; message?: string };
      return err(createError(
        ERROR_CODES.INTERNAL_ERROR,
        `명령어 실행 실패: ${command}`,
        {
          context: {
            command,
            cwd,
            exitCode: caught.status ?? 1,
            stdout: caught.stdout ?? "",
            stderr: caught.stderr ?? caught.message ?? "",
            durationMs,
          },
        }
      ));
    }
  }

  // 앱 실행 — 분리된 프로세스로 비동기 실행, pid 반환
  launchApp(appName: string, args?: readonly string[]): Result<OsLaunchAppResult, JarvisError> {
    try {
      const child = spawn(appName, [...(args ?? [])], {
        detached: true,
        stdio: "ignore",
      });
      // 부모 프로세스와의 참조 해제 — 독립 실행
      child.unref();
      const pid = child.pid ?? 0;
      return ok({ appName, pid, launched: true });
    } catch (e) {
      return err(createError(
        ERROR_CODES.INTERNAL_ERROR,
        `앱 실행 실패: ${appName}`,
        { context: { appName, args, cause: String(e) } }
      ));
    }
  }

  // 프로세스 종료 — 기본 시그널은 SIGTERM
  killProcess(pid: number, signal?: string): Result<OsKillProcessResult, JarvisError> {
    const resolvedSignal = signal ?? "SIGTERM";
    try {
      process.kill(pid, resolvedSignal);
      return ok({ pid, signal: resolvedSignal, success: true });
    } catch (e) {
      return err(createError(
        ERROR_CODES.INTERNAL_ERROR,
        `프로세스 종료 실패: PID ${pid}`,
        { context: { pid, signal: resolvedSignal, cause: String(e) } }
      ));
    }
  }
}

// 스텁 에러 생성 헬퍼 — 테스트 스텁 전용
function stubError(operation: string): JarvisError {
  return createError(
    ERROR_CODES.INTERNAL_ERROR,
    `[스텁] ${operation} 작업은 실제 구현에서만 동작합니다`,
    { context: { operation, stub: true } }
  );
}

// 테스트용 스텁 구현 — 실제 OS 조작 없이 에러 반환
class StubOsAbstraction implements OsAbstraction {
  readonly platform: OsPlatform;

  constructor(platform: OsPlatform) {
    this.platform = platform;
  }

  readFile(_path: string): Result<OsReadFileResult, JarvisError> {
    return err(stubError("readFile"));
  }

  writeFile(_path: string, _content: string): Result<OsWriteFileResult, JarvisError> {
    return err(stubError("writeFile"));
  }

  deleteFile(_path: string): Result<OsDeleteFileResult, JarvisError> {
    return err(stubError("deleteFile"));
  }

  listDirectory(_path: string): Result<OsListDirectoryResult, JarvisError> {
    return err(stubError("listDirectory"));
  }

  moveFile(_sourcePath: string, _destPath: string): Result<OsMoveFileResult, JarvisError> {
    return err(stubError("moveFile"));
  }

  executeCommand(_command: string, _cwd?: string): Result<OsExecuteCommandResult, JarvisError> {
    return err(stubError("executeCommand"));
  }

  launchApp(_appName: string, _args?: readonly string[]): Result<OsLaunchAppResult, JarvisError> {
    return err(stubError("launchApp"));
  }

  killProcess(_pid: number, _signal?: string): Result<OsKillProcessResult, JarvisError> {
    return err(stubError("killProcess"));
  }
}

// OsAbstraction 팩토리 — 현재 플랫폼 감지 후 Node.js 실제 구현 반환
export function createOsAbstraction(): OsAbstraction {
  const platform = detectPlatform();
  return new NodeOsAbstraction(platform);
}

// 테스트용 스텁 팩토리 — 실제 OS 조작이 필요 없는 단위 테스트에 사용
export function createStubOsAbstraction(): OsAbstraction {
  const platform = detectPlatform();
  return new StubOsAbstraction(platform);
}
