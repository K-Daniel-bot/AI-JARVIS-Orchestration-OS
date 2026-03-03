// 프로세스 실행 핸들러 단위 테스트 — ExecHandler 2개 메서드(run/kill) 동작 검증

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ExecHandler, createExecHandler } from "./exec-handler.js";

// ──────────────────────────────────────────────
// 테스트 보조 — 임시 디렉토리 생성/정리
// ──────────────────────────────────────────────

let tmpDir: string;
let handler: ExecHandler;

beforeEach(() => {
  // Arrange: 각 테스트 독립적인 임시 디렉토리와 핸들러 생성
  tmpDir = mkdtempSync(path.join(tmpdir(), "jarvis-exec-test-"));
  handler = new ExecHandler();
});

afterEach(() => {
  // 임시 디렉토리 전체 삭제 — 테스트 격리 보장
  rmSync(tmpDir, { recursive: true, force: true });
});

// ──────────────────────────────────────────────
// run() 테스트 — 명령어 실행
// ──────────────────────────────────────────────

describe("ExecHandler.run()", () => {
  it("echo 명령 성공 시 exitCode 0과 stdout을 반환해야 한다", () => {
    // Arrange
    const command = "echo hello-jarvis";

    // Act
    const result = handler.run(command);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.exitCode).toBe(0);
      expect(result.value.stdout.trim()).toBe("hello-jarvis");
      expect(result.value.command).toBe(command);
    }
  });

  it("성공 명령의 stderr는 빈 문자열이어야 한다", () => {
    // Arrange
    const command = "echo test";

    // Act
    const result = handler.run(command);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.stderr).toBe("");
    }
  });

  it("성공 명령의 durationMs는 양수여야 한다", () => {
    // Arrange
    const command = "echo timing-test";

    // Act
    const result = handler.run(command);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.durationMs).toBeGreaterThanOrEqual(0);
    }
  });

  it("실패 명령(exit 1) 실행 시 ok 상태로 exitCode 1을 반환해야 한다", () => {
    // Arrange — execSync는 exit != 0을 throw하지만 ExecHandler는 ok로 감싸 반환
    const command = "node -e \"process.exit(1)\"";

    // Act
    const result = handler.run(command);

    // Assert — 정책상 실패한 명령도 ok 래퍼로 반환, exitCode로 실패 판단
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.exitCode).toBe(1);
    }
  });

  it("exit code 2로 종료하는 명령은 exitCode 2를 반환해야 한다", () => {
    // Arrange
    const command = "node -e \"process.exit(2)\"";

    // Act
    const result = handler.run(command);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.exitCode).toBe(2);
    }
  });

  it("cwd 옵션 지정 시 해당 디렉토리에서 명령을 실행해야 한다", () => {
    // Arrange — tmpDir에서 pwd(Unix) 또는 cd(Windows) 실행하여 cwd 반영 확인
    // cross-platform을 위해 node -e로 현재 디렉토리 출력
    const command = "node -e \"process.stdout.write(process.cwd())\"";

    // Act
    const result = handler.run(command, tmpDir);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      // cwd가 tmpDir(또는 그 실제 경로)과 일치해야 한다
      // Windows에서 드라이브 문자 대소문자 차이를 허용하기 위해 toLowerCase 비교
      expect(result.value.stdout.toLowerCase()).toContain(
        path.basename(tmpDir).toLowerCase()
      );
      expect(result.value.exitCode).toBe(0);
    }
  });

  it("cwd 없이 실행 시 현재 프로세스 CWD에서 실행되어야 한다", () => {
    // Arrange
    const command = "node -e \"process.stdout.write(process.cwd())\"";

    // Act
    const result = handler.run(command);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.exitCode).toBe(0);
      // stdout은 빈 문자열이 아니어야 한다 (cwd가 출력됨)
      expect(result.value.stdout.length).toBeGreaterThan(0);
    }
  });

  it("node --version 실행 시 버전 문자열을 stdout에 반환해야 한다", () => {
    // Arrange
    const command = "node --version";

    // Act
    const result = handler.run(command);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.exitCode).toBe(0);
      // Node.js 버전 문자열 형식: v18.x.x
      expect(result.value.stdout.trim()).toMatch(/^v\d+\.\d+\.\d+/);
    }
  });

  it("결과 객체는 command 필드를 원본 명령어로 가져야 한다", () => {
    // Arrange
    const command = "echo verify-command-field";

    // Act
    const result = handler.run(command);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.command).toBe(command);
    }
  });

  it("stdout에 멀티라인 출력이 있어도 전체를 반환해야 한다", () => {
    // Arrange — 여러 줄 출력 생성
    const command = "node -e \"console.log('line1'); console.log('line2'); console.log('line3');\"";

    // Act
    const result = handler.run(command);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.stdout).toContain("line1");
      expect(result.value.stdout).toContain("line2");
      expect(result.value.stdout).toContain("line3");
    }
  });
});

// ──────────────────────────────────────────────
// kill() 테스트 — 프로세스 종료 시그널 전송
// ──────────────────────────────────────────────

describe("ExecHandler.kill()", () => {
  it("존재하지 않는 PID에 kill 시 err(JarvisError)를 반환해야 한다", () => {
    // Arrange — PID 999999999는 거의 확실히 존재하지 않음
    const invalidPid = 999999999;

    // Act
    const result = handler.kill(invalidPid);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toContain(String(invalidPid));
    }
  });

  it("존재하지 않는 PID로 kill 시 에러 컨텍스트에 pid가 포함되어야 한다", () => {
    // Arrange
    const invalidPid = 888888888;

    // Act
    const result = handler.kill(invalidPid, "SIGTERM");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.context).toBeDefined();
      const ctx = result.error.context as Record<string, unknown>;
      expect(ctx["pid"]).toBe(invalidPid);
    }
  });

  it("signal 기본값은 SIGTERM이어야 한다", () => {
    // Arrange — 존재하지 않는 PID지만 에러 컨텍스트의 signal 필드를 검증
    const invalidPid = 777777777;

    // Act — signal 인수 없이 호출
    const result = handler.kill(invalidPid);

    // Assert — 에러 컨텍스트에서 signal이 SIGTERM임을 확인
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const ctx = result.error.context as Record<string, unknown>;
      expect(ctx["signal"]).toBe("SIGTERM");
    }
  });

  it("명시적 signal 인수가 에러 컨텍스트에 반영되어야 한다", () => {
    // Arrange
    const invalidPid = 666666666;
    const signal = "SIGKILL";

    // Act
    const result = handler.kill(invalidPid, signal);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      const ctx = result.error.context as Record<string, unknown>;
      expect(ctx["signal"]).toBe(signal);
    }
  });

  it("에러 메시지에 'PID' 문자열이 포함되어야 한다", () => {
    // Arrange
    const invalidPid = 555555555;

    // Act
    const result = handler.kill(invalidPid);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain("PID");
    }
  });
});

// ──────────────────────────────────────────────
// createExecHandler() 팩토리 함수 테스트
// ──────────────────────────────────────────────

describe("createExecHandler()", () => {
  it("ExecHandler 인스턴스를 반환해야 한다", () => {
    // Act
    const instance = createExecHandler();

    // Assert
    expect(instance).toBeInstanceOf(ExecHandler);
  });

  it("팩토리로 생성된 인스턴스도 run()을 정상 실행해야 한다", () => {
    // Arrange
    const instance = createExecHandler();
    const command = "echo factory-test";

    // Act
    const result = instance.run(command);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.exitCode).toBe(0);
      expect(result.value.stdout.trim()).toBe("factory-test");
    }
  });
});
