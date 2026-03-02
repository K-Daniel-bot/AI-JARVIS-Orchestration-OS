/**
 * CLI 파서 단위 테스트 — parseCliArgs 함수의 정상/에러 케이스를 검증한다.
 * Arrange-Act-Assert 패턴 준수
 */

import { describe, it, expect } from 'vitest';
import { parseCliArgs } from './parser.js';
import { isOk, isErr } from '@jarvis/shared';

// ─────────────────────────────────────────
// run 커맨드 파싱 테스트
// ─────────────────────────────────────────

describe('parseCliArgs — run 커맨드', () => {
  it('기본 run 커맨드를 파싱해야 한다', () => {
    // Arrange
    const argv = ['run', '파일을 만들어줘'];

    // Act
    const result = parseCliArgs(argv);

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.command).toBe('run');
      if (result.value.command === 'run') {
        expect(result.value.input).toBe('파일을 만들어줘');
        expect(result.value.options.trustMode).toBe('suggest');
        expect(result.value.options.dryRun).toBe(false);
      }
    }
  });

  it('공백이 포함된 여러 단어 입력을 결합해야 한다', () => {
    // Arrange
    const argv = ['run', '로그인', 'API를', '구현해줘'];

    // Act
    const result = parseCliArgs(argv);

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result) && result.value.command === 'run') {
      expect(result.value.input).toBe('로그인 API를 구현해줘');
    }
  });

  it('--trust-mode 옵션을 올바르게 파싱해야 한다', () => {
    // Arrange
    const argv = ['run', '작업 실행', '--trust-mode', 'full-auto'];

    // Act
    const result = parseCliArgs(argv);

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result) && result.value.command === 'run') {
      expect(result.value.options.trustMode).toBe('full-auto');
    }
  });

  it('--dry-run 플래그를 올바르게 파싱해야 한다', () => {
    // Arrange
    const argv = ['run', '테스트 요청', '--dry-run'];

    // Act
    const result = parseCliArgs(argv);

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result) && result.value.command === 'run') {
      expect(result.value.options.dryRun).toBe(true);
    }
  });

  it('입력 텍스트가 없으면 에러를 반환해야 한다', () => {
    // Arrange
    const argv = ['run'];

    // Act
    const result = parseCliArgs(argv);

    // Assert
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toContain('요청 텍스트가 필요합니다');
    }
  });

  it('유효하지 않은 trust-mode는 에러를 반환해야 한다', () => {
    // Arrange
    const argv = ['run', '요청', '--trust-mode', 'super-admin'];

    // Act
    const result = parseCliArgs(argv);

    // Assert
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toContain('trust-mode');
    }
  });
});

// ─────────────────────────────────────────
// status 커맨드 파싱 테스트
// ─────────────────────────────────────────

describe('parseCliArgs — status 커맨드', () => {
  it('기본 status 커맨드를 파싱해야 한다', () => {
    // Arrange
    const argv = ['status'];

    // Act
    const result = parseCliArgs(argv);

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.command).toBe('status');
    }
  });

  it('--format json 옵션을 파싱해야 한다', () => {
    // Arrange
    const argv = ['status', '--format', 'json'];

    // Act
    const result = parseCliArgs(argv);

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result) && result.value.command === 'status') {
      expect(result.value.format).toBe('json');
    }
  });
});

// ─────────────────────────────────────────
// stop 커맨드 파싱 테스트
// ─────────────────────────────────────────

describe('parseCliArgs — stop 커맨드', () => {
  it('기본 stop 커맨드를 파싱해야 한다', () => {
    // Arrange
    const argv = ['stop'];

    // Act
    const result = parseCliArgs(argv);

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result) && result.value.command === 'stop') {
      expect(result.value.force).toBe(false);
    }
  });

  it('--force 플래그를 파싱해야 한다', () => {
    // Arrange
    const argv = ['stop', '--force'];

    // Act
    const result = parseCliArgs(argv);

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result) && result.value.command === 'stop') {
      expect(result.value.force).toBe(true);
    }
  });
});

// ─────────────────────────────────────────
// audit 커맨드 파싱 테스트
// ─────────────────────────────────────────

describe('parseCliArgs — audit 커맨드', () => {
  it('기본 audit 커맨드를 파싱해야 한다', () => {
    // Arrange
    const argv = ['audit'];

    // Act
    const result = parseCliArgs(argv);

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result) && result.value.command === 'audit') {
      expect(result.value.options.limit).toBe(20);
    }
  });

  it('--limit 옵션을 파싱해야 한다', () => {
    // Arrange
    const argv = ['audit', '--limit', '50'];

    // Act
    const result = parseCliArgs(argv);

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result) && result.value.command === 'audit') {
      expect(result.value.options.limit).toBe(50);
    }
  });

  it('--risk 옵션을 대문자로 정규화해야 한다', () => {
    // Arrange
    const argv = ['audit', '--risk', 'high'];

    // Act
    const result = parseCliArgs(argv);

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result) && result.value.command === 'audit') {
      expect(result.value.options.risk).toBe('HIGH');
    }
  });

  it('유효하지 않은 limit은 에러를 반환해야 한다', () => {
    // Arrange
    const argv = ['audit', '--limit', '-5'];

    // Act
    const result = parseCliArgs(argv);

    // Assert
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toContain('limit');
    }
  });

  it('유효하지 않은 위험도는 에러를 반환해야 한다', () => {
    // Arrange
    const argv = ['audit', '--risk', 'EXTREME'];

    // Act
    const result = parseCliArgs(argv);

    // Assert
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toContain('risk');
    }
  });
});

// ─────────────────────────────────────────
// rollback 커맨드 파싱 테스트
// ─────────────────────────────────────────

describe('parseCliArgs — rollback 커맨드', () => {
  it('기본 rollback 커맨드를 파싱해야 한다', () => {
    // Arrange
    const argv = ['rollback'];

    // Act
    const result = parseCliArgs(argv);

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result) && result.value.command === 'rollback') {
      expect(result.value.options.runId).toBeUndefined();
      expect(result.value.options.force).toBe(false);
    }
  });

  it('특정 runId를 파싱해야 한다', () => {
    // Arrange
    const argv = ['rollback', 'run_20260302_abc123456789', '--force'];

    // Act
    const result = parseCliArgs(argv);

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result) && result.value.command === 'rollback') {
      expect(result.value.options.runId).toBe('run_20260302_abc123456789');
      expect(result.value.options.force).toBe(true);
    }
  });
});

// ─────────────────────────────────────────
// help 커맨드 파싱 테스트
// ─────────────────────────────────────────

describe('parseCliArgs — help 커맨드', () => {
  it('빈 인수 배열에서 help를 반환해야 한다', () => {
    // Arrange
    const argv: string[] = [];

    // Act
    const result = parseCliArgs(argv);

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.command).toBe('help');
    }
  });

  it('-h 플래그를 help로 파싱해야 한다', () => {
    // Arrange
    const argv = ['-h'];

    // Act
    const result = parseCliArgs(argv);

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.command).toBe('help');
    }
  });

  it('help run처럼 토픽을 파싱해야 한다', () => {
    // Arrange
    const argv = ['help', 'run'];

    // Act
    const result = parseCliArgs(argv);

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result) && result.value.command === 'help') {
      expect(result.value.topic).toBe('run');
    }
  });
});

// ─────────────────────────────────────────
// 에러 케이스 테스트
// ─────────────────────────────────────────

describe('parseCliArgs — 에러 케이스', () => {
  it('알 수 없는 커맨드는 에러를 반환해야 한다', () => {
    // Arrange
    const argv = ['unknown-command'];

    // Act
    const result = parseCliArgs(argv);

    // Assert
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toContain('알 수 없는 커맨드');
    }
  });

  it('유효하지 않은 format 값은 에러를 반환해야 한다', () => {
    // Arrange
    const argv = ['status', '--format', 'xml'];

    // Act
    const result = parseCliArgs(argv);

    // Assert
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.message).toContain('format');
    }
  });
});
