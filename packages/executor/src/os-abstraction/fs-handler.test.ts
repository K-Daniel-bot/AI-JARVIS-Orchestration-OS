// 파일 시스템 핸들러 단위 테스트 — FsHandler 5개 메서드(read/write/list/move/delete) 실제 I/O 동작 검증

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { FsHandler, createFsHandler, isFsReadResult } from "./fs-handler.js";

// ──────────────────────────────────────────────
// 테스트 보조 — 임시 디렉토리 생성/정리
// ──────────────────────────────────────────────

let tmpDir: string;
let handler: FsHandler;

beforeEach(() => {
  // Arrange: 각 테스트 독립적인 임시 디렉토리 생성
  tmpDir = mkdtempSync(path.join(tmpdir(), "jarvis-fs-test-"));
  handler = new FsHandler();
});

afterEach(() => {
  // 임시 디렉토리 전체 삭제 — 테스트 격리 보장
  rmSync(tmpDir, { recursive: true, force: true });
});

// ──────────────────────────────────────────────
// read() 테스트
// ──────────────────────────────────────────────

describe("FsHandler.read()", () => {
  it("존재하는 파일을 읽으면 ok(FsReadResult)를 반환해야 한다", () => {
    // Arrange
    const filePath = path.join(tmpDir, "hello.txt");
    const content = "안녕하세요, JARVIS!";
    writeFileSync(filePath, content, "utf-8");

    // Act
    const result = handler.read(filePath);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.path).toBe(filePath);
      expect(result.value.content).toBe(content);
      expect(result.value.sizeBytes).toBeGreaterThan(0);
    }
  });

  it("파일 경로와 내용이 일치하는지 확인해야 한다", () => {
    // Arrange
    const filePath = path.join(tmpDir, "data.json");
    const content = JSON.stringify({ version: 1, agent: "codegen" });
    writeFileSync(filePath, content, "utf-8");

    // Act
    const result = handler.read(filePath);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(JSON.parse(result.value.content)).toEqual({ version: 1, agent: "codegen" });
      expect(result.value.sizeBytes).toBe(Buffer.byteLength(content, "utf-8"));
    }
  });

  it("존재하지 않는 파일 읽기 시 err(JarvisError)를 반환해야 한다", () => {
    // Arrange
    const nonExistentPath = path.join(tmpDir, "ghost.txt");

    // Act
    const result = handler.read(nonExistentPath);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toContain(nonExistentPath);
    }
  });

  it("빈 파일을 읽으면 content가 빈 문자열이고 sizeBytes가 0이어야 한다", () => {
    // Arrange
    const filePath = path.join(tmpDir, "empty.txt");
    writeFileSync(filePath, "", "utf-8");

    // Act
    const result = handler.read(filePath);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.content).toBe("");
      expect(result.value.sizeBytes).toBe(0);
    }
  });
});

// ──────────────────────────────────────────────
// write() 테스트
// ──────────────────────────────────────────────

describe("FsHandler.write()", () => {
  it("파일 쓰기 성공 시 ok(FsWriteResult)와 bytesWritten을 반환해야 한다", () => {
    // Arrange
    const filePath = path.join(tmpDir, "output.ts");
    const content = "export const version = '0.1.0';";

    // Act
    const result = handler.write(filePath, content);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.path).toBe(filePath);
      expect(result.value.bytesWritten).toBe(Buffer.byteLength(content, "utf-8"));
    }
  });

  it("쓴 파일이 실제로 디스크에 존재해야 한다", () => {
    // Arrange
    const filePath = path.join(tmpDir, "verify.txt");
    const content = "테스트 내용";

    // Act
    handler.write(filePath, content);

    // Assert — read로 재검증
    const readResult = handler.read(filePath);
    expect(readResult.ok).toBe(true);
    if (readResult.ok) {
      expect(readResult.value.content).toBe(content);
    }
  });

  it("상위 디렉토리가 없어도 자동 생성 후 파일을 써야 한다", () => {
    // Arrange
    const nestedPath = path.join(tmpDir, "deep", "nested", "dir", "file.txt");
    const content = "중첩 디렉토리 자동 생성";

    // Act
    const result = handler.write(nestedPath, content);

    // Assert
    expect(result.ok).toBe(true);
    expect(existsSync(nestedPath)).toBe(true);
  });

  it("기존 파일을 덮어쓰면 새로운 내용이 저장되어야 한다", () => {
    // Arrange
    const filePath = path.join(tmpDir, "overwrite.txt");
    writeFileSync(filePath, "원본 내용", "utf-8");

    // Act
    handler.write(filePath, "새로운 내용");

    // Assert
    const readResult = handler.read(filePath);
    expect(readResult.ok).toBe(true);
    if (readResult.ok) {
      expect(readResult.value.content).toBe("새로운 내용");
    }
  });

  it("한글 유니코드 내용을 올바른 바이트 크기로 써야 한다", () => {
    // Arrange
    const filePath = path.join(tmpDir, "korean.txt");
    const content = "한글"; // UTF-8에서 한 글자당 3바이트

    // Act
    const result = handler.write(filePath, content);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.bytesWritten).toBe(Buffer.byteLength(content, "utf-8"));
    }
  });
});

// ──────────────────────────────────────────────
// list() 테스트
// ──────────────────────────────────────────────

describe("FsHandler.list()", () => {
  it("디렉토리 목록 조회 성공 시 ok(FsListResult)를 반환해야 한다", () => {
    // Arrange
    writeFileSync(path.join(tmpDir, "a.ts"), "const a = 1;", "utf-8");
    writeFileSync(path.join(tmpDir, "b.ts"), "const b = 2;", "utf-8");

    // Act
    const result = handler.list(tmpDir);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.path).toBe(tmpDir);
      expect(result.value.entries.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("각 항목은 name, path, isDirectory, sizeBytes, modifiedAt 필드를 가져야 한다", () => {
    // Arrange
    const filePath = path.join(tmpDir, "entry.txt");
    writeFileSync(filePath, "항목 내용", "utf-8");

    // Act
    const result = handler.list(tmpDir);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const entry = result.value.entries.find((e) => e.name === "entry.txt");
      expect(entry).toBeDefined();
      if (entry) {
        expect(typeof entry.name).toBe("string");
        expect(entry.path).toBe(filePath);
        expect(typeof entry.isDirectory).toBe("boolean");
        expect(typeof entry.sizeBytes).toBe("number");
        // modifiedAt이 ISO 8601 형식인지 확인
        expect(() => new Date(entry.modifiedAt)).not.toThrow();
      }
    }
  });

  it("파일과 서브디렉토리를 isDirectory 플래그로 구분해야 한다", () => {
    // Arrange
    const subDir = path.join(tmpDir, "subdir");
    mkdirSync(subDir);
    writeFileSync(path.join(tmpDir, "file.ts"), "// 파일", "utf-8");

    // Act
    const result = handler.list(tmpDir);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const fileEntry = result.value.entries.find((e) => e.name === "file.ts");
      const dirEntry = result.value.entries.find((e) => e.name === "subdir");
      expect(fileEntry?.isDirectory).toBe(false);
      expect(dirEntry?.isDirectory).toBe(true);
    }
  });

  it("존재하지 않는 디렉토리 조회 시 err(JarvisError)를 반환해야 한다", () => {
    // Arrange
    const nonExistentDir = path.join(tmpDir, "ghost-dir");

    // Act
    const result = handler.list(nonExistentDir);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toContain(nonExistentDir);
    }
  });

  it("빈 디렉토리 조회 시 entries가 빈 배열이어야 한다", () => {
    // Arrange
    const emptyDir = path.join(tmpDir, "empty-dir");
    mkdirSync(emptyDir);

    // Act
    const result = handler.list(emptyDir);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entries).toHaveLength(0);
    }
  });
});

// ──────────────────────────────────────────────
// move() 테스트
// ──────────────────────────────────────────────

describe("FsHandler.move()", () => {
  it("파일 이동 성공 시 ok(FsMoveResult)를 반환해야 한다", () => {
    // Arrange
    const srcPath = path.join(tmpDir, "source.txt");
    const destPath = path.join(tmpDir, "destination.txt");
    writeFileSync(srcPath, "이동할 내용", "utf-8");

    // Act
    const result = handler.move(srcPath, destPath);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sourcePath).toBe(srcPath);
      expect(result.value.destinationPath).toBe(destPath);
    }
  });

  it("이동 후 원본 파일이 제거되어야 한다", () => {
    // Arrange
    const srcPath = path.join(tmpDir, "to-move.txt");
    const destPath = path.join(tmpDir, "moved.txt");
    writeFileSync(srcPath, "파일 내용", "utf-8");

    // Act
    handler.move(srcPath, destPath);

    // Assert — 원본은 사라지고 목적지에만 존재
    expect(existsSync(srcPath)).toBe(false);
    expect(existsSync(destPath)).toBe(true);
  });

  it("이동 후 내용이 보존되어야 한다", () => {
    // Arrange
    const srcPath = path.join(tmpDir, "content-src.txt");
    const destPath = path.join(tmpDir, "content-dest.txt");
    const originalContent = "보존되어야 할 내용";
    writeFileSync(srcPath, originalContent, "utf-8");

    // Act
    handler.move(srcPath, destPath);

    // Assert
    const readResult = handler.read(destPath);
    expect(readResult.ok).toBe(true);
    if (readResult.ok) {
      expect(readResult.value.content).toBe(originalContent);
    }
  });

  it("대상 디렉토리가 없으면 자동 생성 후 이동해야 한다", () => {
    // Arrange
    const srcPath = path.join(tmpDir, "src-auto.txt");
    const destPath = path.join(tmpDir, "new-dir", "nested", "dest-auto.txt");
    writeFileSync(srcPath, "자동 디렉토리 생성 테스트", "utf-8");

    // Act
    const result = handler.move(srcPath, destPath);

    // Assert
    expect(result.ok).toBe(true);
    expect(existsSync(destPath)).toBe(true);
  });

  it("존재하지 않는 원본 파일 이동 시 err(JarvisError)를 반환해야 한다", () => {
    // Arrange
    const nonExistentSrc = path.join(tmpDir, "no-such-file.txt");
    const destPath = path.join(tmpDir, "dest.txt");

    // Act
    const result = handler.move(nonExistentSrc, destPath);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
    }
  });
});

// ──────────────────────────────────────────────
// delete() 테스트
// ──────────────────────────────────────────────

describe("FsHandler.delete()", () => {
  it("존재하는 파일 삭제 성공 시 ok(FsDeleteResult)를 반환해야 한다", () => {
    // Arrange
    const filePath = path.join(tmpDir, "to-delete.txt");
    writeFileSync(filePath, "삭제될 파일", "utf-8");

    // Act
    const result = handler.delete(filePath);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.path).toBe(filePath);
    }
  });

  it("삭제 결과의 movedToTrash는 false여야 한다 (휴지통 미지원 Phase 0)", () => {
    // Arrange
    const filePath = path.join(tmpDir, "trash-test.txt");
    writeFileSync(filePath, "휴지통 미사용 테스트", "utf-8");

    // Act
    const result = handler.delete(filePath);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.movedToTrash).toBe(false);
    }
  });

  it("삭제 후 파일이 실제로 없어져야 한다", () => {
    // Arrange
    const filePath = path.join(tmpDir, "gone.txt");
    writeFileSync(filePath, "사라질 파일", "utf-8");

    // Act
    handler.delete(filePath);

    // Assert
    expect(existsSync(filePath)).toBe(false);
  });

  it("존재하지 않는 파일 삭제 시 err(JarvisError)를 반환해야 한다", () => {
    // Arrange
    const nonExistentPath = path.join(tmpDir, "phantom.txt");

    // Act
    const result = handler.delete(nonExistentPath);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toContain(nonExistentPath);
    }
  });

  it("useTrash=true 인수를 전달해도 movedToTrash가 false여야 한다 (Phase 2 예정)", () => {
    // Arrange
    const filePath = path.join(tmpDir, "trash-flag.txt");
    writeFileSync(filePath, "휴지통 플래그 무시 테스트", "utf-8");

    // Act
    const result = handler.delete(filePath, true);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.movedToTrash).toBe(false);
    }
  });
});

// ──────────────────────────────────────────────
// createFsHandler() 팩토리 함수 테스트
// ──────────────────────────────────────────────

describe("createFsHandler()", () => {
  it("FsHandler 인스턴스를 반환해야 한다", () => {
    // Act
    const instance = createFsHandler();

    // Assert
    expect(instance).toBeInstanceOf(FsHandler);
  });

  it("팩토리로 생성된 인스턴스도 read()를 정상 실행해야 한다", () => {
    // Arrange
    const instance = createFsHandler();
    const filePath = path.join(tmpDir, "factory.txt");
    writeFileSync(filePath, "팩토리 테스트", "utf-8");

    // Act
    const result = instance.read(filePath);

    // Assert
    expect(result.ok).toBe(true);
  });
});

// ──────────────────────────────────────────────
// isFsReadResult() 타입 가드 테스트
// ──────────────────────────────────────────────

describe("isFsReadResult()", () => {
  it("올바른 FsReadResult 객체에서 true를 반환해야 한다", () => {
    // Arrange
    const validResult = { path: "/some/path.ts", content: "내용", sizeBytes: 10 };

    // Act & Assert
    expect(isFsReadResult(validResult)).toBe(true);
  });

  it("path 필드가 없으면 false를 반환해야 한다", () => {
    // Arrange
    const invalid = { content: "내용", sizeBytes: 10 };

    // Act & Assert
    expect(isFsReadResult(invalid)).toBe(false);
  });

  it("sizeBytes 필드가 숫자가 아니면 false를 반환해야 한다", () => {
    // Arrange
    const invalid = { path: "/path", content: "내용", sizeBytes: "10" };

    // Act & Assert
    expect(isFsReadResult(invalid)).toBe(false);
  });

  it("null이면 false를 반환해야 한다", () => {
    // Act & Assert
    expect(isFsReadResult(null)).toBe(false);
  });

  it("원시 타입(문자열)이면 false를 반환해야 한다", () => {
    // Act & Assert
    expect(isFsReadResult("string")).toBe(false);
  });
});
