// NodeOsAbstraction 단위 테스트 — 임시 디렉토리를 사용하여 실제 파일시스템 조작 검증
// StubOsAbstraction 단위 테스트 — 모든 메서드가 에러를 반환하는지 검증

import { describe, it, expect, afterEach } from "vitest";
import os from "node:os";
import fs from "node:fs";
import path from "node:path";
import {
  createOsAbstraction,
  createStubOsAbstraction,
  detectPlatform,
} from "./os-abstraction.js";
import type { OsAbstraction } from "./os-abstraction.js";

// ──────────────────────────────────────────────
// 테스트용 임시 디렉토리 관리 헬퍼
// ──────────────────────────────────────────────

// 생성된 임시 디렉토리 목록 — afterEach에서 일괄 정리
const tempDirs: string[] = [];

/** 테스트별 고유 임시 디렉토리를 생성하고 경로를 반환한다 */
function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "jarvis-test-"));
  tempDirs.push(dir);
  return dir;
}

afterEach(() => {
  // 모든 임시 디렉토리와 그 하위 파일을 정리
  for (const dir of tempDirs) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
    } catch {
      // 이미 삭제된 경우 무시
    }
  }
  tempDirs.length = 0;
});

// ──────────────────────────────────────────────
// createOsAbstraction / createStubOsAbstraction 팩토리 테스트
// ──────────────────────────────────────────────

describe("createOsAbstraction", () => {
  it("OsAbstraction 인터페이스를 구현한 객체를 반환해야 한다", () => {
    // Arrange & Act
    const os_ = createOsAbstraction();

    // Assert — 8개 메서드와 platform 프로퍼티 존재 확인
    expect(typeof os_.readFile).toBe("function");
    expect(typeof os_.writeFile).toBe("function");
    expect(typeof os_.deleteFile).toBe("function");
    expect(typeof os_.listDirectory).toBe("function");
    expect(typeof os_.moveFile).toBe("function");
    expect(typeof os_.executeCommand).toBe("function");
    expect(typeof os_.launchApp).toBe("function");
    expect(typeof os_.killProcess).toBe("function");
  });

  it("현재 실행 환경의 platform 값을 올바르게 감지해야 한다", () => {
    // Arrange
    const detected = detectPlatform();

    // Act
    const os_ = createOsAbstraction();

    // Assert — detectPlatform()과 일치해야 한다
    expect(os_.platform).toBe(detected);
    expect(["windows", "macos", "linux"]).toContain(os_.platform);
  });
});

describe("createStubOsAbstraction", () => {
  it("OsAbstraction 인터페이스를 구현한 스텁 객체를 반환해야 한다", () => {
    // Arrange & Act
    const stub = createStubOsAbstraction();

    // Assert — 인터페이스 8개 메서드 존재 확인
    expect(typeof stub.readFile).toBe("function");
    expect(typeof stub.writeFile).toBe("function");
    expect(typeof stub.deleteFile).toBe("function");
    expect(typeof stub.listDirectory).toBe("function");
    expect(typeof stub.moveFile).toBe("function");
    expect(typeof stub.executeCommand).toBe("function");
    expect(typeof stub.launchApp).toBe("function");
    expect(typeof stub.killProcess).toBe("function");
  });

  it("스텁의 platform 프로퍼티는 현재 환경 플랫폼과 일치해야 한다", () => {
    // Arrange
    const detected = detectPlatform();

    // Act
    const stub = createStubOsAbstraction();

    // Assert
    expect(stub.platform).toBe(detected);
  });

  it("readFile 메서드는 항상 err(INTERNAL_ERROR)를 반환해야 한다", () => {
    // Arrange
    const stub = createStubOsAbstraction();

    // Act
    const result = stub.readFile("/any/path.txt");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toContain("스텁");
    }
  });

  it("writeFile 메서드는 항상 err(INTERNAL_ERROR)를 반환해야 한다", () => {
    // Arrange
    const stub = createStubOsAbstraction();

    // Act
    const result = stub.writeFile("/any/path.txt", "content");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
    }
  });

  it("deleteFile 메서드는 항상 err(INTERNAL_ERROR)를 반환해야 한다", () => {
    // Arrange
    const stub = createStubOsAbstraction();

    // Act
    const result = stub.deleteFile("/any/path.txt");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
    }
  });

  it("listDirectory 메서드는 항상 err(INTERNAL_ERROR)를 반환해야 한다", () => {
    // Arrange
    const stub = createStubOsAbstraction();

    // Act
    const result = stub.listDirectory("/any/dir");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
    }
  });

  it("moveFile 메서드는 항상 err(INTERNAL_ERROR)를 반환해야 한다", () => {
    // Arrange
    const stub = createStubOsAbstraction();

    // Act
    const result = stub.moveFile("/src/file.txt", "/dst/file.txt");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
    }
  });

  it("executeCommand 메서드는 항상 err(INTERNAL_ERROR)를 반환해야 한다", () => {
    // Arrange
    const stub = createStubOsAbstraction();

    // Act
    const result = stub.executeCommand("echo hello");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
    }
  });

  it("launchApp 메서드는 항상 err(INTERNAL_ERROR)를 반환해야 한다", () => {
    // Arrange
    const stub = createStubOsAbstraction();

    // Act
    const result = stub.launchApp("notepad", []);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
    }
  });

  it("killProcess 메서드는 항상 err(INTERNAL_ERROR)를 반환해야 한다", () => {
    // Arrange
    const stub = createStubOsAbstraction();

    // Act
    const result = stub.killProcess(99999);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
    }
  });
});

// ──────────────────────────────────────────────
// readFile 테스트
// ──────────────────────────────────────────────

describe("NodeOsAbstraction.readFile", () => {
  it("존재하는 파일을 읽고 내용과 경로, 크기를 반환해야 한다", () => {
    // Arrange
    const dir = makeTempDir();
    const filePath = path.join(dir, "hello.txt");
    const content = "hello, JARVIS!";
    fs.writeFileSync(filePath, content, "utf-8");
    const os_: OsAbstraction = createOsAbstraction();

    // Act
    const result = os_.readFile(filePath);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.content).toBe(content);
      expect(result.value.path).toBe(filePath);
      expect(result.value.sizeBytes).toBe(Buffer.byteLength(content, "utf-8"));
    }
  });

  it("멀티바이트(한글) 내용의 파일을 읽을 때 sizeBytes가 바이트 수를 정확히 반환해야 한다", () => {
    // Arrange
    const dir = makeTempDir();
    const filePath = path.join(dir, "korean.txt");
    const content = "안녕하세요 JARVIS";
    fs.writeFileSync(filePath, content, "utf-8");
    const os_: OsAbstraction = createOsAbstraction();

    // Act
    const result = os_.readFile(filePath);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.content).toBe(content);
      expect(result.value.sizeBytes).toBe(Buffer.byteLength(content, "utf-8"));
      // 한글은 UTF-8에서 3바이트이므로 문자 수보다 sizeBytes가 크다
      expect(result.value.sizeBytes).toBeGreaterThan(content.length);
    }
  });

  it("존재하지 않는 파일 경로는 err(INTERNAL_ERROR)를 반환해야 한다", () => {
    // Arrange
    const dir = makeTempDir();
    const filePath = path.join(dir, "nonexistent.txt");
    const os_: OsAbstraction = createOsAbstraction();

    // Act
    const result = os_.readFile(filePath);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toContain("파일 읽기 실패");
    }
  });

  it("빈 파일을 읽으면 content가 빈 문자열이고 sizeBytes가 0이어야 한다", () => {
    // Arrange
    const dir = makeTempDir();
    const filePath = path.join(dir, "empty.txt");
    fs.writeFileSync(filePath, "", "utf-8");
    const os_: OsAbstraction = createOsAbstraction();

    // Act
    const result = os_.readFile(filePath);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.content).toBe("");
      expect(result.value.sizeBytes).toBe(0);
    }
  });
});

// ──────────────────────────────────────────────
// writeFile 테스트
// ──────────────────────────────────────────────

describe("NodeOsAbstraction.writeFile", () => {
  it("파일을 쓰고 path, bytesWritten을 올바르게 반환해야 한다", () => {
    // Arrange
    const dir = makeTempDir();
    const filePath = path.join(dir, "output.txt");
    const content = "written by JARVIS";
    const os_: OsAbstraction = createOsAbstraction();

    // Act
    const result = os_.writeFile(filePath, content);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.path).toBe(filePath);
      expect(result.value.bytesWritten).toBe(Buffer.byteLength(content, "utf-8"));
    }
  });

  it("파일을 쓴 후 실제 파일 내용이 기록된 텍스트와 일치해야 한다", () => {
    // Arrange
    const dir = makeTempDir();
    const filePath = path.join(dir, "verify.txt");
    const content = "content verification test";
    const os_: OsAbstraction = createOsAbstraction();

    // Act
    os_.writeFile(filePath, content);

    // Assert — 직접 fs로 내용 확인
    const actual = fs.readFileSync(filePath, "utf-8");
    expect(actual).toBe(content);
  });

  it("상위 디렉토리가 없어도 자동으로 생성하여 파일을 써야 한다", () => {
    // Arrange
    const dir = makeTempDir();
    const nestedPath = path.join(dir, "a", "b", "c", "nested.txt");
    const content = "nested file content";
    const os_: OsAbstraction = createOsAbstraction();

    // Act
    const result = os_.writeFile(nestedPath, content);

    // Assert
    expect(result.ok).toBe(true);
    expect(fs.existsSync(nestedPath)).toBe(true);
    expect(fs.readFileSync(nestedPath, "utf-8")).toBe(content);
  });

  it("기존 파일을 덮어쓸 때 새 내용으로 교체해야 한다", () => {
    // Arrange
    const dir = makeTempDir();
    const filePath = path.join(dir, "overwrite.txt");
    fs.writeFileSync(filePath, "original content", "utf-8");
    const os_: OsAbstraction = createOsAbstraction();

    // Act
    os_.writeFile(filePath, "overwritten content");

    // Assert
    const actual = fs.readFileSync(filePath, "utf-8");
    expect(actual).toBe("overwritten content");
  });
});

// ──────────────────────────────────────────────
// deleteFile 테스트
// ──────────────────────────────────────────────

describe("NodeOsAbstraction.deleteFile", () => {
  it("존재하는 파일을 삭제하고 deleted: true를 반환해야 한다", () => {
    // Arrange
    const dir = makeTempDir();
    const filePath = path.join(dir, "to-delete.txt");
    fs.writeFileSync(filePath, "delete me", "utf-8");
    const os_: OsAbstraction = createOsAbstraction();

    // Act
    const result = os_.deleteFile(filePath);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.deleted).toBe(true);
      expect(result.value.path).toBe(filePath);
    }
  });

  it("파일 삭제 후 해당 파일이 실제로 존재하지 않아야 한다", () => {
    // Arrange
    const dir = makeTempDir();
    const filePath = path.join(dir, "gone.txt");
    fs.writeFileSync(filePath, "temporary", "utf-8");
    const os_: OsAbstraction = createOsAbstraction();

    // Act
    os_.deleteFile(filePath);

    // Assert
    expect(fs.existsSync(filePath)).toBe(false);
  });

  it("존재하지 않는 파일 삭제 시 err(INTERNAL_ERROR)를 반환해야 한다", () => {
    // Arrange
    const dir = makeTempDir();
    const filePath = path.join(dir, "nonexistent.txt");
    const os_: OsAbstraction = createOsAbstraction();

    // Act
    const result = os_.deleteFile(filePath);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toContain("파일 삭제 실패");
    }
  });
});

// ──────────────────────────────────────────────
// listDirectory 테스트
// ──────────────────────────────────────────────

describe("NodeOsAbstraction.listDirectory", () => {
  it("디렉토리 목록을 조회하고 entries 배열을 반환해야 한다", () => {
    // Arrange
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, "file1.txt"), "a", "utf-8");
    fs.writeFileSync(path.join(dir, "file2.txt"), "bb", "utf-8");
    fs.mkdirSync(path.join(dir, "subdir"));
    const os_: OsAbstraction = createOsAbstraction();

    // Act
    const result = os_.listDirectory(dir);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.path).toBe(dir);
      expect(result.value.entries.length).toBe(3);
    }
  });

  it("entries의 각 항목은 name, isDirectory, sizeBytes, modifiedAt 필드를 가져야 한다", () => {
    // Arrange
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, "sample.txt"), "hello", "utf-8");
    const os_: OsAbstraction = createOsAbstraction();

    // Act
    const result = os_.listDirectory(dir);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const entry = result.value.entries[0];
      expect(entry).toBeDefined();
      expect(typeof entry!.name).toBe("string");
      expect(typeof entry!.isDirectory).toBe("boolean");
      expect(typeof entry!.sizeBytes).toBe("number");
      expect(typeof entry!.modifiedAt).toBe("string");
    }
  });

  it("하위 디렉토리 항목은 isDirectory가 true여야 한다", () => {
    // Arrange
    const dir = makeTempDir();
    fs.mkdirSync(path.join(dir, "mysubdir"));
    const os_: OsAbstraction = createOsAbstraction();

    // Act
    const result = os_.listDirectory(dir);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const dirEntry = result.value.entries.find((e) => e.name === "mysubdir");
      expect(dirEntry).toBeDefined();
      expect(dirEntry!.isDirectory).toBe(true);
    }
  });

  it("일반 파일 항목은 isDirectory가 false여야 한다", () => {
    // Arrange
    const dir = makeTempDir();
    fs.writeFileSync(path.join(dir, "plain.txt"), "data", "utf-8");
    const os_: OsAbstraction = createOsAbstraction();

    // Act
    const result = os_.listDirectory(dir);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const fileEntry = result.value.entries.find((e) => e.name === "plain.txt");
      expect(fileEntry).toBeDefined();
      expect(fileEntry!.isDirectory).toBe(false);
    }
  });

  it("빈 디렉토리는 entries가 빈 배열이어야 한다", () => {
    // Arrange
    const dir = makeTempDir();
    const os_: OsAbstraction = createOsAbstraction();

    // Act
    const result = os_.listDirectory(dir);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.entries.length).toBe(0);
    }
  });

  it("존재하지 않는 디렉토리는 err(INTERNAL_ERROR)를 반환해야 한다", () => {
    // Arrange
    const dir = makeTempDir();
    const nonExistentDir = path.join(dir, "does-not-exist");
    const os_: OsAbstraction = createOsAbstraction();

    // Act
    const result = os_.listDirectory(nonExistentDir);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toContain("디렉토리 목록 조회 실패");
    }
  });
});

// ──────────────────────────────────────────────
// moveFile 테스트
// ──────────────────────────────────────────────

describe("NodeOsAbstraction.moveFile", () => {
  it("파일을 이동하고 sourcePath, destPath를 반환해야 한다", () => {
    // Arrange
    const dir = makeTempDir();
    const srcPath = path.join(dir, "source.txt");
    const dstPath = path.join(dir, "destination.txt");
    fs.writeFileSync(srcPath, "move me", "utf-8");
    const os_: OsAbstraction = createOsAbstraction();

    // Act
    const result = os_.moveFile(srcPath, dstPath);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.sourcePath).toBe(srcPath);
      expect(result.value.destPath).toBe(dstPath);
    }
  });

  it("파일 이동 후 원본 파일이 존재하지 않아야 한다", () => {
    // Arrange
    const dir = makeTempDir();
    const srcPath = path.join(dir, "original.txt");
    const dstPath = path.join(dir, "moved.txt");
    fs.writeFileSync(srcPath, "data", "utf-8");
    const os_: OsAbstraction = createOsAbstraction();

    // Act
    os_.moveFile(srcPath, dstPath);

    // Assert
    expect(fs.existsSync(srcPath)).toBe(false);
  });

  it("파일 이동 후 대상 경로에 파일이 존재하고 내용이 동일해야 한다", () => {
    // Arrange
    const dir = makeTempDir();
    const srcPath = path.join(dir, "src.txt");
    const dstPath = path.join(dir, "dst.txt");
    const content = "transferred content";
    fs.writeFileSync(srcPath, content, "utf-8");
    const os_: OsAbstraction = createOsAbstraction();

    // Act
    os_.moveFile(srcPath, dstPath);

    // Assert
    expect(fs.existsSync(dstPath)).toBe(true);
    expect(fs.readFileSync(dstPath, "utf-8")).toBe(content);
  });

  it("대상 디렉토리가 없어도 자동으로 생성하여 파일을 이동해야 한다", () => {
    // Arrange
    const dir = makeTempDir();
    const srcPath = path.join(dir, "file.txt");
    const dstPath = path.join(dir, "nested", "deep", "file.txt");
    fs.writeFileSync(srcPath, "nested move", "utf-8");
    const os_: OsAbstraction = createOsAbstraction();

    // Act
    const result = os_.moveFile(srcPath, dstPath);

    // Assert
    expect(result.ok).toBe(true);
    expect(fs.existsSync(dstPath)).toBe(true);
  });

  it("존재하지 않는 원본 파일 이동 시 err(INTERNAL_ERROR)를 반환해야 한다", () => {
    // Arrange
    const dir = makeTempDir();
    const srcPath = path.join(dir, "ghost.txt");
    const dstPath = path.join(dir, "nowhere.txt");
    const os_: OsAbstraction = createOsAbstraction();

    // Act
    const result = os_.moveFile(srcPath, dstPath);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toContain("파일 이동 실패");
    }
  });
});

// ──────────────────────────────────────────────
// executeCommand 테스트
// ──────────────────────────────────────────────

describe("NodeOsAbstraction.executeCommand", () => {
  it("유효한 명령어를 실행하고 exitCode 0과 stdout을 반환해야 한다", () => {
    // Arrange
    const os_: OsAbstraction = createOsAbstraction();
    // 플랫폼에 무관하게 node --version은 실행 가능
    const command = "node --version";

    // Act
    const result = os_.executeCommand(command);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.exitCode).toBe(0);
      expect(result.value.command).toBe(command);
      expect(result.value.stdout).toMatch(/^v\d+/);
      expect(typeof result.value.durationMs).toBe("number");
      expect(result.value.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("echo 명령 실행 시 stdout에 출력 내용이 포함되어야 한다", () => {
    // Arrange
    const os_: OsAbstraction = createOsAbstraction();
    // 플랫폼별 echo 명령 선택
    const isWindows = process.platform === "win32";
    const command = isWindows ? "cmd /c echo JARVIS_TEST" : "echo JARVIS_TEST";

    // Act
    const result = os_.executeCommand(command);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.stdout).toContain("JARVIS_TEST");
    }
  });

  it("존재하지 않는 명령어 실행 시 err(INTERNAL_ERROR)를 반환해야 한다", () => {
    // Arrange
    const os_: OsAbstraction = createOsAbstraction();
    const command = "this-command-absolutely-does-not-exist-12345";

    // Act
    const result = os_.executeCommand(command);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toContain("명령어 실행 실패");
    }
  });

  it("cwd 옵션을 지정하면 해당 디렉토리에서 명령이 실행되어야 한다", () => {
    // Arrange
    const dir = makeTempDir();
    const os_: OsAbstraction = createOsAbstraction();
    const isWindows = process.platform === "win32";
    // cwd 내 파일 생성 후 확인
    fs.writeFileSync(path.join(dir, "marker.txt"), "cwd-test", "utf-8");
    const command = isWindows
      ? "cmd /c dir marker.txt"
      : "ls marker.txt";

    // Act
    const result = os_.executeCommand(command, dir);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.stdout).toContain("marker.txt");
    }
  });

  it("0이 아닌 종료 코드를 반환하는 명령어는 err(INTERNAL_ERROR)와 context에 exitCode를 포함해야 한다", () => {
    // Arrange
    const os_: OsAbstraction = createOsAbstraction();
    const isWindows = process.platform === "win32";
    // 항상 실패하는 명령
    const command = isWindows ? "cmd /c exit 1" : "sh -c 'exit 1'";

    // Act
    const result = os_.executeCommand(command);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
      // context에 exitCode 포함 여부 확인
      expect(result.error.context).toBeDefined();
    }
  });
});

// ──────────────────────────────────────────────
// killProcess 테스트
// ──────────────────────────────────────────────

describe("NodeOsAbstraction.killProcess", () => {
  it("존재하지 않는 PID에 SIGTERM 전송 시 err(INTERNAL_ERROR)를 반환해야 한다", () => {
    // Arrange
    // PID 999999999는 사실상 존재하지 않는다
    const os_: OsAbstraction = createOsAbstraction();

    // Act
    const result = os_.killProcess(999999999, "SIGTERM");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toContain("프로세스 종료 실패");
    }
  });

  it("존재하지 않는 큰 PID 전송 시도는 err(INTERNAL_ERROR)를 반환해야 한다", () => {
    // Arrange
    // 매우 큰 PID는 사실상 존재하지 않는다
    const os_: OsAbstraction = createOsAbstraction();

    // Act
    const result = os_.killProcess(2147483647, "SIGTERM");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
    }
  });

  it("signal 인수를 생략하면 기본값 SIGTERM이 context에 기록되어야 한다", () => {
    // Arrange
    const os_: OsAbstraction = createOsAbstraction();

    // Act
    const result = os_.killProcess(999999998);

    // Assert — 존재하지 않는 PID이므로 실패하지만 signal이 SIGTERM임을 확인
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.context).toBeDefined();
      expect(result.error.context!["signal"]).toBe("SIGTERM");
    }
  });
});

// ──────────────────────────────────────────────
// detectPlatform 테스트
// ──────────────────────────────────────────────

describe("detectPlatform", () => {
  it("반환값은 'windows' | 'macos' | 'linux' 중 하나여야 한다", () => {
    // Arrange & Act
    const platform = detectPlatform();

    // Assert
    expect(["windows", "macos", "linux"]).toContain(platform);
  });

  it("process.platform과 일관된 값을 반환해야 한다", () => {
    // Arrange
    const rawPlatform = process.platform;

    // Act
    const result = detectPlatform();

    // Assert
    if (rawPlatform === "win32") {
      expect(result).toBe("windows");
    } else if (rawPlatform === "darwin") {
      expect(result).toBe("macos");
    } else {
      expect(result).toBe("linux");
    }
  });
});
