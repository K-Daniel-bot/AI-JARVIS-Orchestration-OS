// CLI 진입점 단위 테스트 — parseArgs, executeCommand, main 함수 검증
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ok, err, createError } from "@jarvis/shared";
import type { CommandResult } from "./types/commands.js";

// 각 명령어 모듈 모킹 — 실제 OS 조작 없이 라우팅 로직만 검증
vi.mock("./commands/run.js", () => ({
  executeRunCommand: vi.fn(),
}));
vi.mock("./commands/status.js", () => ({
  executeStatusCommand: vi.fn(),
}));
vi.mock("./commands/stop.js", () => ({
  executeStopCommand: vi.fn(),
}));
vi.mock("./commands/audit.js", () => ({
  executeAuditCommand: vi.fn(),
}));
vi.mock("./commands/version.js", () => ({
  executeVersionCommand: vi.fn(),
}));

import { parseArgs, executeCommand, main } from "./cli.js";
import { executeRunCommand } from "./commands/run.js";
import { executeStatusCommand } from "./commands/status.js";
import { executeStopCommand } from "./commands/stop.js";
import { executeAuditCommand } from "./commands/audit.js";
import { executeVersionCommand } from "./commands/version.js";

// 모킹된 함수 타입 캐스팅 헬퍼
const mockRun = vi.mocked(executeRunCommand);
const mockStatus = vi.mocked(executeStatusCommand);
const mockStop = vi.mocked(executeStopCommand);
const mockAudit = vi.mocked(executeAuditCommand);
const mockVersion = vi.mocked(executeVersionCommand);

// 성공 응답 픽스처
const SUCCESS_RESULT: CommandResult = {
  success: true,
  exitCode: 0,
  message: "성공",
  data: {},
};

describe("parseArgs()", () => {
  // 각 테스트 전 모킹 초기화
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("유효한 명령어 파싱", () => {
    it("should parse run command", () => {
      // Arrange
      const argv = ["node", "cli.js", "run", "파일 삭제해줘"];

      // Act
      const result = parseArgs(argv);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.command).toBe("run");
        expect(result.value.args).toEqual(["파일 삭제해줘"]);
      }
    });

    it("should parse status command", () => {
      // Arrange
      const argv = ["node", "cli.js", "status"];

      // Act
      const result = parseArgs(argv);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.command).toBe("status");
        expect(result.value.args).toEqual([]);
      }
    });

    it("should parse stop command with options", () => {
      // Arrange
      const argv = ["node", "cli.js", "stop", "--session", "sess_abc123", "--force"];

      // Act
      const result = parseArgs(argv);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.command).toBe("stop");
        expect(result.value.args).toContain("--session");
        expect(result.value.args).toContain("sess_abc123");
        expect(result.value.args).toContain("--force");
      }
    });

    it("should parse audit command", () => {
      // Arrange
      const argv = ["node", "cli.js", "audit", "--policy-violations"];

      // Act
      const result = parseArgs(argv);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.command).toBe("audit");
        expect(result.value.args).toContain("--policy-violations");
      }
    });

    it("should parse version command", () => {
      // Arrange
      const argv = ["node", "cli.js", "version"];

      // Act
      const result = parseArgs(argv);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.command).toBe("version");
      }
    });

    it("should include all valid commands", () => {
      // Arrange — 지원되는 모든 명령어 목록
      const validCommands = ["run", "status", "stop", "audit", "rollback", "mobile", "policy", "token", "version"];

      // Act & Assert
      for (const cmd of validCommands) {
        const result = parseArgs(["node", "cli.js", cmd]);
        expect(result.ok).toBe(true);
        if (result.ok) {
          expect(result.value.command).toBe(cmd);
        }
      }
    });
  });

  describe("--help 플래그", () => {
    it("should handle --help flag and set command to version", () => {
      // Arrange
      const argv = ["node", "cli.js", "--help"];

      // Act
      const result = parseArgs(argv);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.command).toBe("version");
        expect(result.value.global.help).toBe(true);
        expect(result.value.args).toContain("--help");
      }
    });

    it("should handle -h shorthand flag", () => {
      // Arrange
      const argv = ["node", "cli.js", "-h"];

      // Act
      const result = parseArgs(argv);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.global.help).toBe(true);
      }
    });
  });

  describe("빈 인자", () => {
    it("should return version command when no args provided", () => {
      // Arrange — node, script 경로만 있는 경우
      const argv = ["node", "cli.js"];

      // Act
      const result = parseArgs(argv);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.command).toBe("version");
        expect(result.value.args).toEqual([]);
      }
    });

    it("should set help flag to false for empty args", () => {
      // Arrange
      const argv = ["node", "cli.js"];

      // Act
      const result = parseArgs(argv);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.global.help).toBe(false);
      }
    });
  });

  describe("알 수 없는 명령어 거부", () => {
    it("should reject unknown command", () => {
      // Arrange
      const argv = ["node", "cli.js", "invalid-command"];

      // Act
      const result = parseArgs(argv);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
        expect(result.error.message).toContain("invalid-command");
      }
    });

    it("should reject typosquatted command name", () => {
      // Arrange — 유사하지만 유효하지 않은 명령어
      const argv = ["node", "cli.js", "runn"];

      // Act
      const result = parseArgs(argv);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("should include valid command list in error message", () => {
      // Arrange
      const argv = ["node", "cli.js", "unknown"];

      // Act
      const result = parseArgs(argv);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        // 에러 메시지에 사용 가능한 명령어 안내 포함 확인
        expect(result.error.message).toContain("run");
      }
    });

    it("should set default logLevel to info", () => {
      // Arrange
      const argv = ["node", "cli.js", "version"];

      // Act
      const result = parseArgs(argv);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.global.logLevel).toBe("info");
      }
    });
  });
});

describe("executeCommand()", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // 기본 성공 응답으로 모킹 초기화
    mockRun.mockReturnValue(ok(SUCCESS_RESULT));
    mockStatus.mockReturnValue(ok(SUCCESS_RESULT));
    mockStop.mockReturnValue(ok(SUCCESS_RESULT));
    mockAudit.mockReturnValue(ok(SUCCESS_RESULT));
    mockVersion.mockReturnValue(ok(SUCCESS_RESULT));
  });

  describe("run 명령어 라우팅", () => {
    it("should route to executeRunCommand for run command", () => {
      // Arrange
      const parsed = {
        command: "run" as const,
        args: ["파일 생성해줘"],
        global: { help: false, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      const result = executeCommand(parsed);

      // Assert
      expect(mockRun).toHaveBeenCalledOnce();
      expect(result.ok).toBe(true);
    });

    it("should pass request text from args to run command", () => {
      // Arrange
      const parsed = {
        command: "run" as const,
        args: ["파일", "생성해줘"],
        global: { help: false, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      executeCommand(parsed);

      // Assert — args를 공백으로 합쳐서 request로 전달
      const callArg = mockRun.mock.calls[0]?.[0];
      expect(callArg?.request).toBe("파일 생성해줘");
    });

    it("should detect --dry-run flag from args", () => {
      // Arrange
      const parsed = {
        command: "run" as const,
        args: ["test", "--dry-run"],
        global: { help: false, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      executeCommand(parsed);

      // Assert
      const callArg = mockRun.mock.calls[0]?.[0];
      expect(callArg?.dryRun).toBe(true);
    });

    it("should set dryRun to false when flag is absent", () => {
      // Arrange
      const parsed = {
        command: "run" as const,
        args: ["some task"],
        global: { help: false, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      executeCommand(parsed);

      // Assert
      const callArg = mockRun.mock.calls[0]?.[0];
      expect(callArg?.dryRun).toBe(false);
    });
  });

  describe("status 명령어 라우팅", () => {
    it("should route to executeStatusCommand for status command", () => {
      // Arrange
      const parsed = {
        command: "status" as const,
        args: [],
        global: { help: false, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      const result = executeCommand(parsed);

      // Assert
      expect(mockStatus).toHaveBeenCalledOnce();
      expect(result.ok).toBe(true);
    });

    it("should detect --watch flag from args", () => {
      // Arrange
      const parsed = {
        command: "status" as const,
        args: ["--watch"],
        global: { help: false, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      executeCommand(parsed);

      // Assert
      const callArg = mockStatus.mock.calls[0]?.[0];
      expect(callArg?.watch).toBe(true);
    });

    it("should detect -w shorthand watch flag", () => {
      // Arrange
      const parsed = {
        command: "status" as const,
        args: ["-w"],
        global: { help: false, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      executeCommand(parsed);

      // Assert
      const callArg = mockStatus.mock.calls[0]?.[0];
      expect(callArg?.watch).toBe(true);
    });

    it("should pass json option from global options", () => {
      // Arrange
      const parsed = {
        command: "status" as const,
        args: [],
        global: { help: false, logLevel: "info" as const, quiet: false, json: true },
      };

      // Act
      executeCommand(parsed);

      // Assert
      const callArg = mockStatus.mock.calls[0]?.[0];
      expect(callArg?.json).toBe(true);
    });
  });

  describe("stop 명령어 라우팅", () => {
    it("should route to executeStopCommand for stop command", () => {
      // Arrange
      const parsed = {
        command: "stop" as const,
        args: [],
        global: { help: false, logLevel: "info" as const, quiet: false, json: false },
      };
      mockStop.mockReturnValue(ok(SUCCESS_RESULT));

      // Act
      const result = executeCommand(parsed);

      // Assert
      expect(mockStop).toHaveBeenCalledOnce();
      expect(result.ok).toBe(true);
    });

    it("should extract --session option value via extractOption", () => {
      // Arrange — extractOption 내부 함수를 stop 명령어를 통해 간접 테스트
      const parsed = {
        command: "stop" as const,
        args: ["--session", "sess_abc123"],
        global: { help: false, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      executeCommand(parsed);

      // Assert
      const callArg = mockStop.mock.calls[0]?.[0];
      expect(callArg?.sessionId).toBe("sess_abc123");
    });

    it("should extract -s shorthand session option", () => {
      // Arrange
      const parsed = {
        command: "stop" as const,
        args: ["-s", "sess_xyz789"],
        global: { help: false, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      executeCommand(parsed);

      // Assert
      const callArg = mockStop.mock.calls[0]?.[0];
      expect(callArg?.sessionId).toBe("sess_xyz789");
    });

    it("should pass undefined sessionId when no --session flag", () => {
      // Arrange
      const parsed = {
        command: "stop" as const,
        args: [],
        global: { help: false, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      executeCommand(parsed);

      // Assert
      const callArg = mockStop.mock.calls[0]?.[0];
      expect(callArg?.sessionId).toBeUndefined();
    });

    it("should detect --force flag", () => {
      // Arrange
      const parsed = {
        command: "stop" as const,
        args: ["--session", "sess_001", "--force"],
        global: { help: false, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      executeCommand(parsed);

      // Assert
      const callArg = mockStop.mock.calls[0]?.[0];
      expect(callArg?.force).toBe(true);
    });

    it("should extract --reason option value via extractOption", () => {
      // Arrange
      const parsed = {
        command: "stop" as const,
        args: ["--session", "sess_001", "--reason", "user-cancelled"],
        global: { help: false, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      executeCommand(parsed);

      // Assert
      const callArg = mockStop.mock.calls[0]?.[0];
      expect(callArg?.reason).toBe("user-cancelled");
    });

    it("should pass undefined reason when --reason flag is absent", () => {
      // Arrange
      const parsed = {
        command: "stop" as const,
        args: ["--session", "sess_001"],
        global: { help: false, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      executeCommand(parsed);

      // Assert
      const callArg = mockStop.mock.calls[0]?.[0];
      expect(callArg?.reason).toBeUndefined();
    });
  });

  describe("audit 명령어 라우팅", () => {
    it("should route to executeAuditCommand for audit command", () => {
      // Arrange
      const parsed = {
        command: "audit" as const,
        args: [],
        global: { help: false, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      const result = executeCommand(parsed);

      // Assert
      expect(mockAudit).toHaveBeenCalledOnce();
      expect(result.ok).toBe(true);
    });

    it("should detect --policy-violations flag", () => {
      // Arrange
      const parsed = {
        command: "audit" as const,
        args: ["--policy-violations"],
        global: { help: false, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      executeCommand(parsed);

      // Assert
      const callArg = mockAudit.mock.calls[0]?.[0];
      expect(callArg?.policyViolations).toBe(true);
    });

    it("should detect --errors flag", () => {
      // Arrange
      const parsed = {
        command: "audit" as const,
        args: ["--errors"],
        global: { help: false, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      executeCommand(parsed);

      // Assert
      const callArg = mockAudit.mock.calls[0]?.[0];
      expect(callArg?.errors).toBe(true);
    });

    it("should extract --run option value via extractOption", () => {
      // Arrange
      const parsed = {
        command: "audit" as const,
        args: ["--run", "run_20260303_abc12345"],
        global: { help: false, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      executeCommand(parsed);

      // Assert
      const callArg = mockAudit.mock.calls[0]?.[0];
      expect(callArg?.runId).toBe("run_20260303_abc12345");
    });

    it("should pass undefined runId when --run flag is absent", () => {
      // Arrange
      const parsed = {
        command: "audit" as const,
        args: [],
        global: { help: false, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      executeCommand(parsed);

      // Assert
      const callArg = mockAudit.mock.calls[0]?.[0];
      expect(callArg?.runId).toBeUndefined();
    });

    it("should set default limit to 50", () => {
      // Arrange
      const parsed = {
        command: "audit" as const,
        args: [],
        global: { help: false, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      executeCommand(parsed);

      // Assert
      const callArg = mockAudit.mock.calls[0]?.[0];
      expect(callArg?.limit).toBe(50);
    });
  });

  describe("version 명령어 라우팅", () => {
    it("should route to executeVersionCommand for version command", () => {
      // Arrange
      const parsed = {
        command: "version" as const,
        args: [],
        global: { help: false, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      const result = executeCommand(parsed);

      // Assert
      expect(mockVersion).toHaveBeenCalledOnce();
      expect(result.ok).toBe(true);
    });

    it("should detect --verbose flag", () => {
      // Arrange
      const parsed = {
        command: "version" as const,
        args: ["--verbose"],
        global: { help: false, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      executeCommand(parsed);

      // Assert
      const callArg = mockVersion.mock.calls[0]?.[0];
      expect(callArg).toBe(true);
    });

    it("should detect -v shorthand verbose flag", () => {
      // Arrange
      const parsed = {
        command: "version" as const,
        args: ["-v"],
        global: { help: false, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      executeCommand(parsed);

      // Assert
      const callArg = mockVersion.mock.calls[0]?.[0];
      expect(callArg).toBe(true);
    });

    it("should pass false to executeVersionCommand when no verbose flag", () => {
      // Arrange
      const parsed = {
        command: "version" as const,
        args: [],
        global: { help: false, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      executeCommand(parsed);

      // Assert
      const callArg = mockVersion.mock.calls[0]?.[0];
      expect(callArg).toBe(false);
    });
  });

  describe("--help 플래그 처리", () => {
    it("should return help message without calling executeVersionCommand", () => {
      // Arrange — help 플래그가 설정된 parsed 인자
      const parsed = {
        command: "version" as const,
        args: ["--help"],
        global: { help: true, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      const result = executeCommand(parsed);

      // Assert — executeVersionCommand은 호출되지 않아야 함
      expect(mockVersion).not.toHaveBeenCalled();
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.message).toContain("사용법");
        expect(result.value.exitCode).toBe(0);
      }
    });

    it("should include command list in help message", () => {
      // Arrange
      const parsed = {
        command: "version" as const,
        args: ["--help"],
        global: { help: true, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      const result = executeCommand(parsed);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.message).toContain("run");
        expect(result.value.message).toContain("status");
        expect(result.value.message).toContain("stop");
        expect(result.value.message).toContain("audit");
      }
    });
  });

  describe("미구현 명령어", () => {
    it("should return error for rollback command (not yet implemented in switch)", () => {
      // Arrange — switch에 case가 없는 명령어
      const parsed = {
        command: "rollback" as const,
        args: [],
        global: { help: false, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      const result = executeCommand(parsed);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
        expect(result.error.message).toContain("rollback");
      }
    });

    it("should return error for mobile command (not yet implemented)", () => {
      // Arrange
      const parsed = {
        command: "mobile" as const,
        args: [],
        global: { help: false, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      const result = executeCommand(parsed);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("should propagate error from command handler", () => {
      // Arrange — run 명령어 핸들러가 에러를 반환하도록 모킹
      const runError = err(createError("VALIDATION_FAILED", "요청 내용이 비어있습니다."));
      mockRun.mockReturnValue(runError);

      const parsed = {
        command: "run" as const,
        args: [],
        global: { help: false, logLevel: "info" as const, quiet: false, json: false },
      };

      // Act
      const result = executeCommand(parsed);

      // Assert — 핸들러 에러가 그대로 전파
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("비어있습니다");
      }
    });
  });
});

describe("main()", () => {
  let originalArgv: string[];
  let originalExitCode: number | undefined;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // process.argv 및 exitCode 저장
    originalArgv = process.argv;
    originalExitCode = process.exitCode as number | undefined;
    vi.clearAllMocks();
    mockRun.mockReturnValue(ok(SUCCESS_RESULT));
    mockStatus.mockReturnValue(ok(SUCCESS_RESULT));
    mockStop.mockReturnValue(ok(SUCCESS_RESULT));
    mockAudit.mockReturnValue(ok(SUCCESS_RESULT));
    mockVersion.mockReturnValue(ok(SUCCESS_RESULT));
    // 콘솔 출력 스파이
    consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    // 원래 값 복구
    process.argv = originalArgv;
    process.exitCode = originalExitCode;
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  it("should set exitCode 0 on successful command", () => {
    // Arrange — version 명령어로 테스트
    process.argv = ["node", "cli.js", "version"];

    // Act
    main();

    // Assert
    expect(process.exitCode).toBe(0);
  });

  it("should set exitCode 1 on parse error", () => {
    // Arrange — 알 수 없는 명령어로 파싱 에러 유발
    process.argv = ["node", "cli.js", "invalid-cmd"];

    // Act
    main();

    // Assert
    expect(process.exitCode).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining("오류"));
  });

  it("should set exitCode 1 on command execution error", () => {
    // Arrange — run 핸들러가 에러를 반환하도록 설정
    process.argv = ["node", "cli.js", "run", "some task"];
    mockRun.mockReturnValue(err(createError("VALIDATION_FAILED", "실행 오류")));

    // Act
    main();

    // Assert
    expect(process.exitCode).toBe(1);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it("should print message to console on success", () => {
    // Arrange — message가 있는 성공 결과
    process.argv = ["node", "cli.js", "version"];
    mockVersion.mockReturnValue(ok({ success: true, exitCode: 0, message: "JARVIS OS v0.1.0", data: {} }));

    // Act
    main();

    // Assert
    expect(consoleLogSpy).toHaveBeenCalledWith("JARVIS OS v0.1.0");
  });

  it("should handle empty argv and default to version command", () => {
    // Arrange — 인자 없음 (node, script만)
    process.argv = ["node", "cli.js"];

    // Act
    main();

    // Assert — version 명령어로 라우팅되어 성공
    expect(process.exitCode).toBe(0);
  });
});
