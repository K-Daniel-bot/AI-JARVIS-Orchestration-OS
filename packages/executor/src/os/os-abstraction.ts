// OS 추상화 레이어 — Phase 0 스텁 구현 (실제 OS 조작은 Phase 1+에서 구현)
import type { Result, JarvisError } from "@jarvis/shared";
import { err, createError, ERROR_CODES } from "@jarvis/shared";

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

// OS 추상화 인터페이스 — 플랫폼 독립적 OS 조작 계약
export interface OsAbstraction {
  readonly platform: OsPlatform;

  // 파일 읽기
  readFile(path: string): Result<OsReadFileResult, JarvisError>;

  // 파일 쓰기
  writeFile(path: string, content: string): Result<OsWriteFileResult, JarvisError>;

  // 파일 삭제
  deleteFile(path: string): Result<OsDeleteFileResult, JarvisError>;

  // 명령어 실행
  executeCommand(command: string, cwd?: string): Result<OsExecuteCommandResult, JarvisError>;

  // 앱 실행
  launchApp(appName: string, args?: readonly string[]): Result<OsLaunchAppResult, JarvisError>;
}

// 현재 실행 환경의 OS 플랫폼 감지
export function detectPlatform(): OsPlatform {
  const platform = process.platform;
  if (platform === "win32") return "windows";
  if (platform === "darwin") return "macos";
  return "linux";
}

// Phase 0 스텁 에러 생성 헬퍼
function stubError(operation: string): JarvisError {
  return createError(
    ERROR_CODES.INTERNAL_ERROR,
    `[Phase 0 스텁] ${operation} 작업은 Phase 1에서 구현됩니다`,
    { context: { operation, phase: "0", stub: true } }
  );
}

// Phase 0 스텁 구현 — 실제 OS 조작 없이 에러 반환
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

  executeCommand(_command: string, _cwd?: string): Result<OsExecuteCommandResult, JarvisError> {
    return err(stubError("executeCommand"));
  }

  launchApp(_appName: string, _args?: readonly string[]): Result<OsLaunchAppResult, JarvisError> {
    return err(stubError("launchApp"));
  }
}

// OsAbstraction 팩토리 — 현재 플랫폼 감지 후 스텁 인스턴스 반환
export function createOsAbstraction(): OsAbstraction {
  const platform = detectPlatform();
  return new StubOsAbstraction(platform);
}
