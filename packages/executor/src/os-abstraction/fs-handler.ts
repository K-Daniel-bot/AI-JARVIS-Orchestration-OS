// 파일 시스템 핸들러 — Phase 0 스텁 구현 (실제 OS 조작은 Phase 1+에서 구현)
import type { JarvisError } from "@jarvis/shared";
import { createError } from "@jarvis/shared";
import type { Result } from "@jarvis/shared";
import { err } from "@jarvis/shared";

// 파일 읽기 결과
export interface FsReadResult {
  readonly path: string;
  readonly content: string;
  readonly sizeBytes: number;
}

// 디렉토리 목록 결과
export interface FsListResult {
  readonly path: string;
  readonly entries: readonly FsEntry[];
}

// 파일/디렉토리 항목
export interface FsEntry {
  readonly name: string;
  readonly path: string;
  readonly isDirectory: boolean;
  readonly sizeBytes: number;
  readonly modifiedAt: string;
}

// 파일 쓰기 결과
export interface FsWriteResult {
  readonly path: string;
  readonly bytesWritten: number;
}

// 파일 이동 결과
export interface FsMoveResult {
  readonly sourcePath: string;
  readonly destinationPath: string;
}

// 파일 삭제 결과
export interface FsDeleteResult {
  readonly path: string;
  readonly movedToTrash: boolean;
}

// Phase 0 스텁 공통 에러 생성 헬퍼
function stubNotImplemented(operation: string): JarvisError {
  return createError(
    "INTERNAL_ERROR",
    `[Phase 0 스텁] ${operation} 작업은 Phase 1에서 구현됩니다`,
    { context: { operation, phase: "0", stub: true } }
  );
}

// 파일 시스템 핸들러 — OS 파일 조작 추상화
export class FsHandler {
  /**
   * 파일 읽기 — Phase 0 스텁
   */
  read(_path: string): Result<FsReadResult, JarvisError> {
    return err(stubNotImplemented("FS_READ"));
  }

  /**
   * 파일 쓰기 — Phase 0 스텁
   */
  write(_path: string, _content: string): Result<FsWriteResult, JarvisError> {
    return err(stubNotImplemented("FS_WRITE"));
  }

  /**
   * 디렉토리 목록 조회 — Phase 0 스텁
   */
  list(_path: string): Result<FsListResult, JarvisError> {
    return err(stubNotImplemented("FS_LIST"));
  }

  /**
   * 파일 이동 — Phase 0 스텁
   */
  move(_sourcePath: string, _destinationPath: string): Result<FsMoveResult, JarvisError> {
    return err(stubNotImplemented("FS_MOVE"));
  }

  /**
   * 파일 삭제 (휴지통 모드 권장) — Phase 0 스텁
   */
  delete(_path: string, _useTrash: boolean = true): Result<FsDeleteResult, JarvisError> {
    return err(stubNotImplemented("FS_DELETE"));
  }
}

// 기본 FsHandler 인스턴스 — 싱글턴 패턴으로 재사용
export function createFsHandler(): FsHandler {
  return new FsHandler();
}

// 타입 가드 — FsReadResult 확인
export function isFsReadResult(value: unknown): value is FsReadResult {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj["path"] === "string" &&
    typeof obj["content"] === "string" &&
    typeof obj["sizeBytes"] === "number"
  );
}

