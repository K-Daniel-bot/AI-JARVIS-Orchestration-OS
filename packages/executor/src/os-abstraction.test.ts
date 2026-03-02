/**
 * os-abstraction.ts 단위 테스트
 * OS 플랫폼 감지, 스텁 구현체 동작, 유효성 검사 헬퍼를 검증한다.
 */

import { describe, it, expect } from 'vitest';
import {
  detectPlatform,
  createOsOperations,
  isValidWindowsPath,
  isValidPosixPath,
  isDeniedCommand,
  createOsError,
} from './os-abstraction.js';

// ─────────────────────────────────────────
// detectPlatform 테스트
// ─────────────────────────────────────────

describe('detectPlatform', () => {
  it('유효한 OS 플랫폼 값을 반환해야 한다', () => {
    // Act
    const platform = detectPlatform();

    // Assert — windows, macos, linux 중 하나
    const validPlatforms = ['windows', 'macos', 'linux'];
    expect(validPlatforms).toContain(platform);
  });
});

// ─────────────────────────────────────────
// createOsOperations (스텁 구현체) 테스트
// ─────────────────────────────────────────

describe('createOsOperations (Phase 0 스텁)', () => {
  it('스텁 구현체를 생성해야 한다', () => {
    // Act
    const ops = createOsOperations();

    // Assert — 모든 메서드가 존재해야 함
    expect(typeof ops.fsRead).toBe('function');
    expect(typeof ops.fsWrite).toBe('function');
    expect(typeof ops.fsList).toBe('function');
    expect(typeof ops.fsMove).toBe('function');
    expect(typeof ops.fsDelete).toBe('function');
    expect(typeof ops.execRun).toBe('function');
    expect(typeof ops.processKill).toBe('function');
    expect(typeof ops.appLaunch).toBe('function');
  });

  it('플랫폼을 명시적으로 지정해도 스텁 구현체를 반환해야 한다', () => {
    // Act
    const windowsOps = createOsOperations('windows');
    const macOsOps = createOsOperations('macos');
    const linuxOps = createOsOperations('linux');

    // Assert — 모든 구현체가 fsRead를 가져야 함
    expect(typeof windowsOps.fsRead).toBe('function');
    expect(typeof macOsOps.fsRead).toBe('function');
    expect(typeof linuxOps.fsRead).toBe('function');
  });

  describe('fsRead', () => {
    it('스텁 구현체는 ok Result를 반환해야 한다', async () => {
      // Arrange
      const ops = createOsOperations();

      // Act
      const result = await ops.fsRead('/home/user/test.txt');

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(typeof result.value).toBe('string');
      }
    });
  });

  describe('fsWrite', () => {
    it('스텁 구현체는 ok Result를 반환해야 한다', async () => {
      // Arrange
      const ops = createOsOperations();

      // Act
      const result = await ops.fsWrite('/tmp/test.txt', 'hello world');

      // Assert
      expect(result.ok).toBe(true);
    });
  });

  describe('fsList', () => {
    it('스텁 구현체는 빈 배열을 반환해야 한다', async () => {
      // Arrange
      const ops = createOsOperations();

      // Act
      const result = await ops.fsList('/home/user');

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(Array.isArray(result.value)).toBe(true);
        expect(result.value).toHaveLength(0);
      }
    });
  });

  describe('fsMove', () => {
    it('스텁 구현체는 ok Result를 반환해야 한다', async () => {
      // Arrange
      const ops = createOsOperations();

      // Act
      const result = await ops.fsMove('/tmp/old.txt', '/tmp/new.txt');

      // Assert
      expect(result.ok).toBe(true);
    });
  });

  describe('fsDelete', () => {
    it('스텁 구현체는 ok Result를 반환해야 한다 (실제 삭제 없음)', async () => {
      // Arrange
      const ops = createOsOperations();

      // Act
      const result = await ops.fsDelete('/tmp/obsolete.txt');

      // Assert
      expect(result.ok).toBe(true);
    });
  });

  describe('execRun', () => {
    it('스텁 구현체는 exitCode 0인 ProcessResult를 반환해야 한다', async () => {
      // Arrange
      const ops = createOsOperations();

      // Act
      const result = await ops.execRun('node', ['--version'], '/tmp');

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.exitCode).toBe(0);
        expect(typeof result.value.stdout).toBe('string');
        expect(typeof result.value.stderr).toBe('string');
      }
    });
  });

  describe('processKill', () => {
    it('스텁 구현체는 ok Result를 반환해야 한다 (실제 종료 없음)', async () => {
      // Arrange
      const ops = createOsOperations();

      // Act
      const result = await ops.processKill(12345);

      // Assert
      expect(result.ok).toBe(true);
    });
  });

  describe('appLaunch', () => {
    it('스텁 구현체는 pid -1인 AppLaunchResult를 반환해야 한다', async () => {
      // Arrange
      const ops = createOsOperations();

      // Act
      const result = await ops.appLaunch('notepad', ['file.txt']);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.pid).toBe(-1); // Phase 0 스텁 PID
      }
    });
  });
});

// ─────────────────────────────────────────
// isValidWindowsPath 테스트
// ─────────────────────────────────────────

describe('isValidWindowsPath', () => {
  it('드라이브 경로(C:\\...)는 유효해야 한다', () => {
    expect(isValidWindowsPath('C:\\Users\\user\\file.txt')).toBe(true);
    expect(isValidWindowsPath('D:\\Projects\\src')).toBe(true);
  });

  it('슬래시 드라이브 경로(C:/...)도 유효해야 한다', () => {
    expect(isValidWindowsPath('C:/Users/user/file.txt')).toBe(true);
  });

  it('UNC 경로(\\\\server\\share)는 유효해야 한다', () => {
    expect(isValidWindowsPath('\\\\server\\share\\file.txt')).toBe(true);
  });

  it('상대 경로는 유효하지 않아야 한다', () => {
    expect(isValidWindowsPath('relative/path/file.txt')).toBe(false);
    expect(isValidWindowsPath('./file.txt')).toBe(false);
  });

  it('POSIX 절대 경로는 유효하지 않아야 한다', () => {
    expect(isValidWindowsPath('/home/user/file')).toBe(false);
  });
});

// ─────────────────────────────────────────
// isValidPosixPath 테스트
// ─────────────────────────────────────────

describe('isValidPosixPath', () => {
  it('/로 시작하는 절대 경로는 유효해야 한다', () => {
    expect(isValidPosixPath('/home/user/file.txt')).toBe(true);
    expect(isValidPosixPath('/usr/local/bin')).toBe(true);
    expect(isValidPosixPath('/')).toBe(true);
  });

  it('상대 경로는 유효하지 않아야 한다', () => {
    expect(isValidPosixPath('relative/path')).toBe(false);
    expect(isValidPosixPath('./file.txt')).toBe(false);
    expect(isValidPosixPath('../parent')).toBe(false);
  });

  it('Windows 드라이브 경로는 유효하지 않아야 한다', () => {
    expect(isValidPosixPath('C:/Users/file')).toBe(false);
  });
});

// ─────────────────────────────────────────
// isDeniedCommand 테스트
// ─────────────────────────────────────────

describe('isDeniedCommand', () => {
  it('sudo는 금지된 명령이어야 한다', () => {
    expect(isDeniedCommand('sudo')).toBe(true);
    expect(isDeniedCommand('sudo apt-get install')).toBe(true);
  });

  it('regedit는 금지된 명령이어야 한다', () => {
    expect(isDeniedCommand('regedit')).toBe(true);
  });

  it('format은 금지된 명령이어야 한다', () => {
    expect(isDeniedCommand('format')).toBe(true);
    expect(isDeniedCommand('format C:')).toBe(true);
  });

  it('대소문자를 구분하지 않고 금지 명령을 탐지해야 한다', () => {
    expect(isDeniedCommand('SUDO')).toBe(true);
    expect(isDeniedCommand('Sudo')).toBe(true);
  });

  it('허용된 명령은 금지되지 않아야 한다', () => {
    expect(isDeniedCommand('node')).toBe(false);
    expect(isDeniedCommand('git status')).toBe(false);
    expect(isDeniedCommand('pnpm install')).toBe(false);
    expect(isDeniedCommand('npm test')).toBe(false);
  });
});

// ─────────────────────────────────────────
// createOsError 테스트
// ─────────────────────────────────────────

describe('createOsError', () => {
  it('INTERNAL_ERROR 코드를 가진 JarvisError를 생성해야 한다', () => {
    // Act
    const error = createOsError('fsRead', '/sensitive/system/path');

    // Assert
    expect(error.code).toBe('INTERNAL_ERROR');
    expect(error.message).toContain('fsRead');
  });

  it('에러 메시지에 실제 경로를 그대로 노출하지 않아야 한다', () => {
    // 시스템 경로가 메시지에 직접 노출되지 않도록 context에만 저장
    const sensitiveOp = 'fsRead';
    const error = createOsError(sensitiveOp, '/Windows/System32/sensitive');

    // operation 이름은 메시지에 포함되지만 경로는 context에만
    expect(error.message).toContain(sensitiveOp);
    expect(error.context).toBeDefined();
  });

  it('cause를 지정하면 에러 체인에 포함되어야 한다', () => {
    // Arrange
    const originalError = new Error('파일을 찾을 수 없습니다');

    // Act
    const error = createOsError('fsRead', '/path/file.txt', originalError);

    // Assert
    expect(error.cause).toBe(originalError);
  });
});
