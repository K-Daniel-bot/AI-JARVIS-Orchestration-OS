/**
 * OS 추상화 레이어 — 플랫폼별 OS 작업을 통합 인터페이스로 제공한다.
 * Phase 0에서는 실제 OS 조작 없이 스텁(stub) 구현을 사용한다.
 * Phase 1+에서 각 플랫폼별 실제 구현체로 교체될 예정이다.
 *
 * contract.md §1: Executor 에이전트가 유일한 OS 조작 주체.
 * 모든 메서드는 Result 패턴으로 성공/실패를 명시적으로 반환한다.
 */

import type { Result } from '@jarvis/shared';
import { ok, err, JarvisError, ErrorCode } from '@jarvis/shared';

// ─────────────────────────────────────────
// OS 플랫폼 타입
// ─────────────────────────────────────────

/** OS 플랫폼 식별자 */
export type OsPlatform = 'windows' | 'macos' | 'linux';

// ─────────────────────────────────────────
// 프로세스 실행 결과 타입
// ─────────────────────────────────────────

/** 프로세스 실행 결과 — 표준 출력, 에러 출력, 종료 코드 */
export interface ProcessResult {
  readonly stdout: string;
  readonly stderr: string;
  readonly exitCode: number;
}

/** 앱 실행 결과 — 생성된 프로세스 ID */
export interface AppLaunchResult {
  readonly pid: number;
}

// ─────────────────────────────────────────
// OS 작업 인터페이스
// ─────────────────────────────────────────

/**
 * OsOperations — OS 플랫폼별 작업을 추상화한 인터페이스.
 * 파일시스템, 프로세스, 앱 실행을 통합 API로 제공한다.
 * 구현체는 플랫폼(windows/macos/linux)에 따라 달라진다.
 */
export interface OsOperations {
  /**
   * 파일 내용을 읽는다.
   * contract.md §1: OS 시스템 파일 접근 금지 (경로 검증은 enforcement-hook에서 수행)
   */
  fsRead(path: string): Promise<Result<string, JarvisError>>;

  /**
   * 파일에 내용을 쓴다.
   * 경로 정규화 및 허용 범위 검증은 enforcement-hook에서 수행한다.
   */
  fsWrite(
    path: string,
    content: string,
  ): Promise<Result<void, JarvisError>>;

  /**
   * 디렉토리 내 파일/폴더 목록을 반환한다.
   */
  fsList(path: string): Promise<Result<string[], JarvisError>>;

  /**
   * 파일 또는 디렉토리를 이동한다.
   */
  fsMove(
    source: string,
    destination: string,
  ): Promise<Result<void, JarvisError>>;

  /**
   * 파일 또는 디렉토리를 삭제한다.
   * DESTRUCTIVE 액션 — 반드시 Gate 승인 후 실행해야 한다.
   */
  fsDelete(path: string): Promise<Result<void, JarvisError>>;

  /**
   * 외부 명령을 실행한다.
   * contract.md §1: sudo, regedit, powershell_admin 금지 (enforcement-hook에서 검증)
   */
  execRun(
    command: string,
    args: string[],
    cwd?: string,
  ): Promise<Result<ProcessResult, JarvisError>>;

  /**
   * 프로세스를 종료한다.
   */
  processKill(pid: number): Promise<Result<void, JarvisError>>;

  /**
   * 애플리케이션을 실행한다.
   */
  appLaunch(
    appName: string,
    args?: string[],
  ): Promise<Result<AppLaunchResult, JarvisError>>;
}

// ─────────────────────────────────────────
// OS 플랫폼 감지
// ─────────────────────────────────────────

/**
 * 현재 실행 환경의 OS 플랫폼을 감지한다.
 * Node.js process.platform 값을 OsPlatform으로 매핑한다.
 */
export function detectPlatform(): OsPlatform {
  const platform = process.platform;

  switch (platform) {
    case 'win32':
      return 'windows';
    case 'darwin':
      return 'macos';
    default:
      // linux, freebsd 등 기타 POSIX 계열을 linux로 분류
      return 'linux';
  }
}

// ─────────────────────────────────────────
// Phase 0 스텁 구현
// ─────────────────────────────────────────

/**
 * Phase 0 스텁 구현 — 실제 OS 조작을 수행하지 않고 로그만 남긴다.
 * 각 메서드는 성공 또는 실패 Result를 반환하며 실제 파일시스템을 건드리지 않는다.
 *
 * 주의: 이 구현체는 개발/테스트 전용이다.
 * Phase 1에서는 플랫폼별 실제 구현체(WindowsOsOperations 등)로 교체한다.
 */
function createStubOsOperations(): OsOperations {
  // 스텁 메서드 공통 로그 헬퍼 — Phase 0 구현 안내 메시지 출력
  function logStub(methodName: string, args: Record<string, unknown>): void {
    // 민감 정보(비밀번호, 토큰)는 로깅하지 않는다
    const safeArgs = Object.fromEntries(
      Object.entries(args).filter(
        ([key]) =>
          !key.toLowerCase().includes('password') &&
          !key.toLowerCase().includes('token') &&
          !key.toLowerCase().includes('secret'),
      ),
    );
    // TODO: 실제 로거로 교체 (Phase 1)
    void safeArgs;
    void methodName;
  }

  return {
    async fsRead(path: string): Promise<Result<string, JarvisError>> {
      // Phase 0 스텁 — 실제 파일 읽기 미구현
      logStub('fsRead', { path });
      return Promise.resolve(
        ok(
          `[STUB] fsRead: ${path} — Phase 0에서는 실제 파일을 읽지 않습니다.`,
        ),
      );
    },

    async fsWrite(
      path: string,
      content: string,
    ): Promise<Result<void, JarvisError>> {
      // Phase 0 스텁 — 실제 파일 쓰기 미구현
      logStub('fsWrite', { path, contentLength: content.length });
      return Promise.resolve(ok(undefined));
    },

    async fsList(path: string): Promise<Result<string[], JarvisError>> {
      // Phase 0 스텁 — 실제 디렉토리 목록 조회 미구현
      logStub('fsList', { path });
      return Promise.resolve(ok([]));
    },

    async fsMove(
      source: string,
      destination: string,
    ): Promise<Result<void, JarvisError>> {
      // Phase 0 스텁 — 실제 파일 이동 미구현
      logStub('fsMove', { source, destination });
      return Promise.resolve(ok(undefined));
    },

    async fsDelete(path: string): Promise<Result<void, JarvisError>> {
      // Phase 0 스텁 — 실제 파일 삭제 미구현 (DESTRUCTIVE 액션)
      logStub('fsDelete', { path });
      return Promise.resolve(ok(undefined));
    },

    async execRun(
      command: string,
      args: string[],
      cwd?: string,
    ): Promise<Result<ProcessResult, JarvisError>> {
      // Phase 0 스텁 — 실제 명령 실행 미구현
      logStub('execRun', { command, argCount: args.length, cwd });
      return Promise.resolve(
        ok({
          stdout: `[STUB] execRun: ${command} ${args.join(' ')} — Phase 0에서는 실제 명령을 실행하지 않습니다.`,
          stderr: '',
          exitCode: 0,
        }),
      );
    },

    async processKill(pid: number): Promise<Result<void, JarvisError>> {
      // Phase 0 스텁 — 실제 프로세스 종료 미구현
      logStub('processKill', { pid });
      return Promise.resolve(ok(undefined));
    },

    async appLaunch(
      appName: string,
      args?: string[],
    ): Promise<Result<AppLaunchResult, JarvisError>> {
      // Phase 0 스텁 — 실제 앱 실행 미구현
      logStub('appLaunch', { appName, argCount: args?.length ?? 0 });
      // 스텁 PID는 항상 -1 (실제 프로세스 없음)
      return Promise.resolve(ok({ pid: -1 }));
    },
  };
}

// ─────────────────────────────────────────
// Windows 전용 유효성 검사 헬퍼
// ─────────────────────────────────────────

/**
 * Windows 경로 유효성 검사 — 절대 경로 형식(C:\... 또는 \\...)인지 확인한다.
 * Phase 1 Windows 구현체에서 사용될 예정이다.
 */
export function isValidWindowsPath(path: string): boolean {
  // Windows 드라이브 경로: C:\ 또는 D:\ 형식
  const drivePathPattern = /^[a-zA-Z]:[/\\]/;
  // UNC 경로: \\server\share 형식
  const uncPathPattern = /^\\\\[^\\]+\\/;
  return drivePathPattern.test(path) || uncPathPattern.test(path);
}

/**
 * POSIX 경로 유효성 검사 — 절대 경로(/)인지 확인한다.
 * Phase 1 macOS/Linux 구현체에서 사용될 예정이다.
 */
export function isValidPosixPath(path: string): boolean {
  return path.startsWith('/');
}

// ─────────────────────────────────────────
// 금지 명령 패턴 검사
// ─────────────────────────────────────────

/**
 * contract.md §1에서 금지된 명령 패턴 목록
 * Executor가 이 명령을 실행하려 할 때 즉시 거부한다.
 */
const DENIED_COMMANDS: readonly string[] = [
  'sudo',
  'su',
  'regedit',
  'powershell_admin',
  'net user',
  'chmod 777',
  'format',
  'diskpart',
  'rm -rf /',
] as const;

/**
 * 주어진 명령이 절대 금지 목록에 해당하는지 확인한다.
 * enforcement-hook에서 호출하기 전 사전 검사로 사용한다.
 */
export function isDeniedCommand(command: string): boolean {
  const lowerCommand = command.toLowerCase().trim();
  return DENIED_COMMANDS.some(
    (denied) =>
      lowerCommand === denied.toLowerCase() ||
      lowerCommand.startsWith(denied.toLowerCase() + ' '),
  );
}

// ─────────────────────────────────────────
// OsOperations 팩토리
// ─────────────────────────────────────────

/**
 * OS 플랫폼에 맞는 OsOperations 구현체를 생성한다.
 *
 * Phase 0: 모든 플랫폼에서 스텁 구현체 반환 (실제 OS 조작 없음)
 * Phase 1: 플랫폼별 실제 구현체 주입 예정
 *
 * @param platform - OS 플랫폼 (미지정 시 현재 플랫폼 자동 감지)
 */
export function createOsOperations(_platform?: OsPlatform): OsOperations {
  // _platform 파라미터는 Phase 1에서 플랫폼별 구현체 분기에 사용될 예정이다.
  // Phase 0: 모든 플랫폼에서 스텁 구현체 반환
  // TODO: Phase 1 — _platform에 따라 Windows/macOS/Linux 구현체 분기
  return createStubOsOperations();
}

// ─────────────────────────────────────────
// 에러 생성 헬퍼
// ─────────────────────────────────────────

/**
 * OS 작업 실패 에러를 생성한다.
 * @param operation - 실패한 OS 작업 이름
 * @param path - 대상 경로 또는 리소스 식별자
 * @param cause - 원인 에러
 */
export function createOsError(
  operation: string,
  _path: string,
  cause?: unknown,
): JarvisError {
  // 시스템 경로(_path)를 에러 메시지에 노출하지 않는다 (contract.md §3: 민감 정보 마스킹)
  // operation 이름만 메시지에 포함하고 경로는 context에만 저장한다
  return new JarvisError({
    code: ErrorCode.INTERNAL_ERROR,
    message: `OS 작업 실패: ${operation}`,
    cause,
    context: { operation },
  });
}
