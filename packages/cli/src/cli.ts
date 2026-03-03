#!/usr/bin/env node
// JARVIS OS CLI 진입점 — 사용자 요청을 파싱하여 적절한 명령어 핸들러로 라우팅

import type { Result } from "@jarvis/shared";
import { ok, err, createError } from "@jarvis/shared";
import type { JarvisError } from "@jarvis/shared";
import type { CommandName, CommandResult, GlobalOptions, LogLevel } from "./types/commands.js";
import { DEFAULT_CONFIG } from "./config.js";
import { executeRunCommand } from "./commands/run.js";
import { executeStatusCommand } from "./commands/status.js";
import { executeStopCommand } from "./commands/stop.js";
import { executeAuditCommand } from "./commands/audit.js";
import { executeVersionCommand } from "./commands/version.js";

// CLI 인자 파싱 결과
export interface ParsedArgs {
  readonly command: CommandName;
  readonly args: readonly string[];
  readonly global: GlobalOptions;
}

// CLI 인자 파싱
export function parseArgs(argv: readonly string[]): Result<ParsedArgs, JarvisError> {
  // node, script 경로 이후의 인자만 사용
  const args = argv.slice(2);

  const firstArg = args[0];

  if (firstArg === "--help" || firstArg === "-h") {
    return ok({
      command: "version" as CommandName,
      args: ["--help"],
      global: { ...createDefaultGlobal(), help: true },
    });
  }

  if (args.length === 0 || firstArg === undefined) {
    return ok({
      command: "version" as CommandName,
      args: [],
      global: createDefaultGlobal(),
    });
  }

  const validCommands: readonly CommandName[] = [
    "run", "status", "stop", "audit", "rollback",
    "mobile", "policy", "token", "version",
  ];

  if (!validCommands.includes(firstArg as CommandName)) {
    return err(createError(
      "VALIDATION_FAILED",
      `알 수 없는 명령어: ${firstArg}. 사용 가능: ${validCommands.join(", ")}`,
    ));
  }

  return ok({
    command: firstArg as CommandName,
    args: args.slice(1),
    global: createDefaultGlobal(),
  });
}

// 명령어 라우팅 및 실행
export function executeCommand(parsed: ParsedArgs): Result<CommandResult, JarvisError> {
  switch (parsed.command) {
    case "run":
      return executeRunCommand(
        {
          request: parsed.args.join(" "),
          mode: DEFAULT_CONFIG.trustMode,
          timeout: DEFAULT_CONFIG.timeoutSeconds,
          noApprove: false,
          logLevel: parsed.global.logLevel,
          dryRun: parsed.args.includes("--dry-run"),
        },
        DEFAULT_CONFIG,
      );

    case "status":
      return executeStatusCommand({
        watch: parsed.args.includes("--watch") || parsed.args.includes("-w"),
        json: parsed.global.json,
        verbose: parsed.args.includes("--verbose") || parsed.args.includes("-v"),
      });

    case "stop":
      // --session 또는 -s 옵션으로 세션 ID를 전달
      return executeStopCommand({
        sessionId: extractOption(parsed.args, "--session") ?? extractOption(parsed.args, "-s"),
        force: parsed.args.includes("--force") || parsed.args.includes("-f"),
        reason: extractOption(parsed.args, "--reason"),
      });

    case "audit":
      return executeAuditCommand({
        runId: extractOption(parsed.args, "--run"),
        policyViolations: parsed.args.includes("--policy-violations"),
        errors: parsed.args.includes("--errors"),
        limit: 50,
        format: "text",
      });

    case "version":
      // --help 플래그가 설정된 경우 사용법 출력
      if (parsed.global.help) {
        return ok({
          success: true,
          exitCode: 0,
          message: [
            "사용법: jarvis <명령어> [옵션]",
            "",
            "명령어:",
            "  run <요청>     — AI 에이전트 실행",
            "  status         — 현재 상태 조회",
            "  stop           — 실행 중단",
            "  audit          — 감사 로그 조회",
            "  version        — 버전 정보",
            "",
            "옵션:",
            "  --help, -h     — 도움말 표시",
            "  --json         — JSON 형식 출력",
            "  --quiet        — 최소 출력",
          ].join("\n"),
          data: undefined,
        });
      }
      return executeVersionCommand(
        parsed.args.includes("--verbose") || parsed.args.includes("-v"),
      );

    default:
      return err(createError(
        "VALIDATION_FAILED",
        `명령어 '${parsed.command}'은 아직 구현되지 않았습니다.`,
      ));
  }
}

// 옵션 값 추출 헬퍼
function extractOption(args: readonly string[], flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) {
    return undefined;
  }
  return args[idx + 1];
}

// 기본 글로벌 옵션 생성
function createDefaultGlobal(): GlobalOptions {
  return {
    help: false,
    logLevel: "info" as LogLevel,
    quiet: false,
    json: false,
  };
}

// CLI 메인 진입점 — process.argv를 파싱하여 명령어를 실행하고 종료 코드를 설정
export function main(): void {
  const parseResult = parseArgs(process.argv);
  if (!parseResult.ok) {
    // eslint-disable-next-line no-console
    console.error(`오류: ${parseResult.error.message}`);
    process.exitCode = 1;
    return;
  }

  const cmdResult = executeCommand(parseResult.value);
  if (!cmdResult.ok) {
    // eslint-disable-next-line no-console
    console.error(`오류: ${cmdResult.error.message}`);
    process.exitCode = 1;
    return;
  }

  if (cmdResult.value.message) {
    // eslint-disable-next-line no-console
    console.log(cmdResult.value.message);
  }

  process.exitCode = cmdResult.value.exitCode;
}
