// 파일 시스템 핸들러 — Node.js fs 모듈 기반 실제 구현
import fs from "node:fs";
import path from "node:path";
import type { JarvisError } from "@jarvis/shared";
import { createError } from "@jarvis/shared";
import type { Result } from "@jarvis/shared";
import { err } from "@jarvis/shared";
import { ok } from "@jarvis/shared";

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

// 미구현 작업 에러 생성 헬퍼 (향후 미지원 기능용)
function stubNotImplemented(operation: string): JarvisError {
  return createError(
    "INTERNAL_ERROR",
    `[스텁] ${operation} 작업은 지원되지 않습니다`,
    { context: { operation, stub: true } }
  );
}

// 사용하지 않는 함수 경고 억제 (하위 호환성 유지)
void stubNotImplemented;

// 파일 시스템 핸들러 — OS 파일 조작 추상화
export class FsHandler {
  /**
   * 파일 읽기 — UTF-8 인코딩으로 파일 내용을 동기적으로 읽는다
   */
  read(filePath: string): Result<FsReadResult, JarvisError> {
    try {
      const content = fs.readFileSync(filePath, "utf-8");
      const sizeBytes = Buffer.byteLength(content, "utf-8");
      return ok({ path: filePath, content, sizeBytes });
    } catch (e) {
      return err(
        createError("INTERNAL_ERROR", `파일 읽기 실패: ${filePath}`, {
          context: { path: filePath, error: String(e) },
        })
      );
    }
  }

  /**
   * 파일 쓰기 — 상위 디렉토리를 자동 생성 후 UTF-8로 기록한다
   */
  write(filePath: string, content: string): Result<FsWriteResult, JarvisError> {
    try {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, content, "utf-8");
      return ok({
        path: filePath,
        bytesWritten: Buffer.byteLength(content, "utf-8"),
      });
    } catch (e) {
      return err(
        createError("INTERNAL_ERROR", `파일 쓰기 실패: ${filePath}`, {
          context: { path: filePath, error: String(e) },
        })
      );
    }
  }

  /**
   * 디렉토리 목록 조회 — 각 항목의 이름, 경로, 크기, 수정일을 반환한다
   */
  list(dirPath: string): Result<FsListResult, JarvisError> {
    try {
      const entries = fs.readdirSync(dirPath);
      const result: FsEntry[] = entries.map((name) => {
        const fullPath = path.join(dirPath, name);
        const stat = fs.statSync(fullPath);
        return {
          name,
          path: fullPath,
          isDirectory: stat.isDirectory(),
          sizeBytes: stat.size,
          modifiedAt: stat.mtime.toISOString(),
        };
      });
      return ok({ path: dirPath, entries: result });
    } catch (e) {
      return err(
        createError("INTERNAL_ERROR", `디렉토리 목록 조회 실패: ${dirPath}`, {
          context: { path: dirPath, error: String(e) },
        })
      );
    }
  }

  /**
   * 파일 이동 — 목적지 상위 디렉토리를 자동 생성 후 파일을 이동한다
   */
  move(sourcePath: string, destinationPath: string): Result<FsMoveResult, JarvisError> {
    try {
      fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
      fs.renameSync(sourcePath, destinationPath);
      return ok({ sourcePath, destinationPath });
    } catch (e) {
      return err(
        createError("INTERNAL_ERROR", `파일 이동 실패: ${sourcePath} → ${destinationPath}`, {
          context: { sourcePath, destinationPath, error: String(e) },
        })
      );
    }
  }

  /**
   * 파일 삭제 — unlinkSync로 파일을 제거한다 (useTrash 플래그는 향후 지원 예정)
   */
  delete(filePath: string, _useTrash: boolean = true): Result<FsDeleteResult, JarvisError> {
    try {
      fs.unlinkSync(filePath);
      // TODO: useTrash=true일 때 휴지통 이동 지원 (Phase 2+)
      return ok({ path: filePath, movedToTrash: false });
    } catch (e) {
      return err(
        createError("INTERNAL_ERROR", `파일 삭제 실패: ${filePath}`, {
          context: { path: filePath, error: String(e) },
        })
      );
    }
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
