#!/usr/bin/env node
/**
 * JARVIS OS CLI 진입점
 * Node.js 환경에서 jarvis 커맨드를 처리하고 적절한 커맨드 핸들러에 디스패치한다.
 * 에러는 stderr로 출력하고 process.exit 코드를 통해 셸에 전달한다.
 */

import { isOk, isErr } from '@jarvis/shared';
import { parseCliArgs } from './parser.js';
import {
  runCommand,
  statusCommand,
  stopCommand,
  auditCommand,
  rollbackCommand,
  printHelp,
} from './commands.js';
import { printError, printInfo } from './formatter.js';

// ─────────────────────────────────────────
// 종료 코드 상수
// ─────────────────────────────────────────

/** 정상 종료 */
const EXIT_SUCCESS = 0;
/** 일반 에러 종료 */
const EXIT_ERROR = 1;
/** 잘못된 사용법 */
const EXIT_USAGE = 2;

// ─────────────────────────────────────────
// 메인 진입점
// ─────────────────────────────────────────

/**
 * CLI 메인 함수 — 인수를 파싱하고 해당 커맨드를 실행한다.
 * 모든 에러는 여기서 처리하며, throw는 사용하지 않는다.
 */
async function main(): Promise<void> {
  // process.argv의 구조: ['node', 'jarvis', ...args]
  const argv = process.argv.slice(2);

  // 인수가 없으면 도움말 출력
  if (argv.length === 0) {
    printHelp();
    process.exit(EXIT_SUCCESS);
    return;
  }

  // 커맨드 파싱
  const parseResult = parseCliArgs(argv);

  if (isErr(parseResult)) {
    printError(parseResult.error.message);
    printInfo('도움말: jarvis help');
    process.exit(EXIT_USAGE);
    return;
  }

  const parsed = parseResult.value;

  // 커맨드 디스패치
  switch (parsed.command) {
    case 'help': {
      printHelp(parsed.topic);
      process.exit(EXIT_SUCCESS);
      return;
    }

    case 'run': {
      const result = await runCommand(
        parsed.input,
        parsed.options.trustMode ?? 'suggest',
        parsed.options.dryRun ?? false,
        parsed.options.format ?? 'human',
      );
      if (isOk(result)) {
        process.exit(EXIT_SUCCESS);
      } else {
        printError(result.error.message);
        process.exit(EXIT_ERROR);
      }
      return;
    }

    case 'status': {
      const result = await statusCommand(parsed.format ?? 'human');
      if (isOk(result)) {
        process.exit(EXIT_SUCCESS);
      } else {
        printError(result.error.message);
        process.exit(EXIT_ERROR);
      }
      return;
    }

    case 'stop': {
      const result = await stopCommand(parsed.force);
      if (isOk(result)) {
        process.exit(EXIT_SUCCESS);
      } else {
        printError(result.error.message);
        process.exit(EXIT_ERROR);
      }
      return;
    }

    case 'audit': {
      const result = await auditCommand(parsed.options);
      if (isOk(result)) {
        process.exit(EXIT_SUCCESS);
      } else {
        printError(result.error.message);
        process.exit(EXIT_ERROR);
      }
      return;
    }

    case 'rollback': {
      const result = await rollbackCommand(parsed.options);
      if (isOk(result)) {
        process.exit(EXIT_SUCCESS);
      } else {
        printError(result.error.message);
        process.exit(EXIT_ERROR);
      }
      return;
    }

    default: {
      // TypeScript exhaustive check — 컴파일 시점에서 누락된 커맨드 감지
      const _exhaustive: never = parsed;
      printError(`처리되지 않은 커맨드: ${JSON.stringify(_exhaustive)}`);
      process.exit(EXIT_ERROR);
    }
  }
}

// ─────────────────────────────────────────
// 처리되지 않은 예외 핸들러
// ─────────────────────────────────────────

/** Promise rejection 전역 핸들러 — 감사 로그 미기록 상태 예외 방지 */
process.on('unhandledRejection', (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  // 시스템 경로나 스택 트레이스는 출력하지 않음
  process.stderr.write(`[JARVIS] 처리되지 않은 비동기 에러: ${message}\n`);
  process.exit(EXIT_ERROR);
});

/** 예기치 않은 동기 예외 핸들러 */
process.on('uncaughtException', (error: Error) => {
  // 에러 메시지에 시스템 정보가 포함되지 않도록 주의
  process.stderr.write(`[JARVIS] 치명적 오류: ${error.message}\n`);
  process.exit(EXIT_ERROR);
});

// ─────────────────────────────────────────
// 실행
// ─────────────────────────────────────────

main().catch((e: unknown) => {
  const message = e instanceof Error ? e.message : '알 수 없는 오류';
  process.stderr.write(`[JARVIS] CLI 초기화 실패: ${message}\n`);
  process.exit(EXIT_ERROR);
});
