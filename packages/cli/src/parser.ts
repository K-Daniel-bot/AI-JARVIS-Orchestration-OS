/**
 * CLI 인수 파서 — node:util의 parseArgs를 기반으로 커맨드와 옵션을 파싱한다.
 * 잘못된 인수는 Result<ParsedCommand, JarvisError> 형태로 에러를 반환한다.
 */

import { parseArgs } from 'node:util';
import type { Result } from '@jarvis/shared';
import { ok, err, validationFailedError } from '@jarvis/shared';
import type {
  ParsedCommand,
  RunOptions,
  AuditOptions,
  RollbackOptions,
} from './types.js';

// ─────────────────────────────────────────
// 파싱 설정
// ─────────────────────────────────────────

/** parseArgs 옵션 설정 — 지원되는 모든 플래그 정의 */
const PARSE_OPTIONS = {
  options: {
    // run 커맨드 옵션
    'trust-mode': { type: 'string' as const, short: 't' },
    'dry-run': { type: 'boolean' as const, short: 'd', default: false },
    // 공통 출력 옵션
    format: { type: 'string' as const, short: 'f', default: 'human' },
    // audit 커맨드 옵션
    limit: { type: 'string' as const, short: 'l' },
    risk: { type: 'string' as const, short: 'r' },
    // stop/rollback 공통 옵션
    force: { type: 'boolean' as const, default: false },
    // 도움말
    help: { type: 'boolean' as const, short: 'h', default: false },
  },
  allowPositionals: true,
} as const;

// ─────────────────────────────────────────
// 유효성 검사 헬퍼
// ─────────────────────────────────────────

/** 신뢰 모드 값의 유효성을 검사한다 */
function isValidTrustMode(
  value: string,
): value is 'observe' | 'suggest' | 'semi-auto' | 'full-auto' {
  return ['observe', 'suggest', 'semi-auto', 'full-auto'].includes(value);
}

/** 출력 형식 값의 유효성을 검사한다 */
function isValidFormat(value: string): value is 'human' | 'json' {
  return ['human', 'json'].includes(value);
}

/** 위험도 레벨 값의 유효성을 검사한다 */
function isValidRiskLevel(value: string): boolean {
  return ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(value.toUpperCase());
}

// ─────────────────────────────────────────
// 메인 파서 함수
// ─────────────────────────────────────────

/**
 * CLI 인수를 파싱하여 구조화된 커맨드 객체를 반환한다.
 * 잘못된 인수가 있으면 Result 에러로 반환한다 (throw 금지).
 *
 * @param argv - process.argv.slice(2)로 전달받은 인수 배열
 */
export function parseCliArgs(argv: string[]): Result<ParsedCommand, ReturnType<typeof validationFailedError>> {
  // parseArgs 실행 — 알 수 없는 플래그 감지 시 예외 발생 가능
  let parsed: ReturnType<typeof parseArgs<typeof PARSE_OPTIONS['options']>>;
  try {
    parsed = parseArgs({
      args: argv,
      ...PARSE_OPTIONS,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Unknown parse error';
    return err(validationFailedError('argv', message));
  }

  const positionals = parsed.positionals;
  const values = parsed.values;

  // 도움말 플래그 처리
  if (values.help === true) {
    return ok({ command: 'help', topic: positionals[0] } as ParsedCommand);
  }

  // 첫 번째 위치 인수가 커맨드
  const command = positionals[0];

  if (command === undefined || command === 'help') {
    return ok({ command: 'help', topic: positionals[1] } as ParsedCommand);
  }

  // 커맨드별 파싱
  switch (command) {
    case 'run': {
      // 실행할 입력 텍스트 (positionals[1..] 결합)
      const inputParts = positionals.slice(1);
      if (inputParts.length === 0) {
        return err(validationFailedError('input', 'run 커맨드에는 실행할 요청 텍스트가 필요합니다'));
      }
      const input = inputParts.join(' ');

      // trustMode 검증
      const rawTrustMode = values['trust-mode'];
      if (rawTrustMode !== undefined && !isValidTrustMode(rawTrustMode)) {
        return err(
          validationFailedError(
            'trust-mode',
            `유효하지 않은 신뢰 모드: "${rawTrustMode}". 허용: observe | suggest | semi-auto | full-auto`,
          ),
        );
      }

      // format 검증
      const rawFormat = values.format;
      if (rawFormat !== undefined && !isValidFormat(rawFormat)) {
        return err(
          validationFailedError(
            'format',
            `유효하지 않은 출력 형식: "${rawFormat}". 허용: human | json`,
          ),
        );
      }

      const options: RunOptions = {
        trustMode: rawTrustMode as RunOptions['trustMode'] ?? 'suggest',
        format: rawFormat as RunOptions['format'] ?? 'human',
        dryRun: values['dry-run'] === true,
      };

      return ok({ command: 'run', input, options });
    }

    case 'status': {
      const rawFormat = values.format;
      if (rawFormat !== undefined && !isValidFormat(rawFormat)) {
        return err(
          validationFailedError(
            'format',
            `유효하지 않은 출력 형식: "${rawFormat}". 허용: human | json`,
          ),
        );
      }
      return ok({
        command: 'status',
        format: rawFormat as 'human' | 'json' ?? 'human',
      });
    }

    case 'stop': {
      return ok({
        command: 'stop',
        force: values.force === true,
      });
    }

    case 'audit': {
      // limit 파싱 — 양의 정수 검증
      let limit: number | undefined;
      const rawLimit = values.limit;
      if (rawLimit !== undefined) {
        const parsed = parseInt(rawLimit, 10);
        if (isNaN(parsed) || parsed <= 0) {
          return err(
            validationFailedError('limit', `유효하지 않은 limit 값: "${rawLimit}". 양의 정수여야 합니다`),
          );
        }
        limit = parsed;
      }

      // risk 검증
      const rawRisk = values.risk;
      if (rawRisk !== undefined && !isValidRiskLevel(rawRisk)) {
        return err(
          validationFailedError(
            'risk',
            `유효하지 않은 위험도: "${rawRisk}". 허용: LOW | MEDIUM | HIGH | CRITICAL`,
          ),
        );
      }

      const rawFormat = values.format;
      if (rawFormat !== undefined && !isValidFormat(rawFormat)) {
        return err(
          validationFailedError('format', `유효하지 않은 출력 형식: "${rawFormat}". 허용: human | json`),
        );
      }

      const options: AuditOptions = {
        limit: limit ?? 20,
        risk: rawRisk?.toUpperCase(),
        format: rawFormat as AuditOptions['format'] ?? 'human',
      };

      return ok({ command: 'audit', options });
    }

    case 'rollback': {
      const runId = positionals[1];

      const options: RollbackOptions = {
        runId,
        force: values.force === true,
      };

      return ok({ command: 'rollback', options });
    }

    default: {
      return err(
        validationFailedError(
          'command',
          `알 수 없는 커맨드: "${command}". 허용: run | status | stop | audit | rollback | help`,
        ),
      );
    }
  }
}
