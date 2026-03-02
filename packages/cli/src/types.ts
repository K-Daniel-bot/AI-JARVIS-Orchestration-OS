/**
 * CLI 전용 타입 정의
 * 커맨드 파싱 결과, 실행 컨텍스트, 출력 형식 등을 정의한다.
 */

// ─────────────────────────────────────────
// CLI 커맨드 열거형
// ─────────────────────────────────────────

/**
 * CLI_COMMAND — jarvis CLI가 지원하는 커맨드 목록
 */
export const CLI_COMMAND = {
  /** 사용자 요청을 Orchestrator에 전달하여 실행 */
  RUN: 'run',
  /** 현재 실행 상태 조회 */
  STATUS: 'status',
  /** 비상 중단 — 모든 진행 중인 작업 강제 종료 */
  STOP: 'stop',
  /** 감사 로그 조회 */
  AUDIT: 'audit',
  /** 마지막 실행 또는 지정 runId 롤백 */
  ROLLBACK: 'rollback',
  /** 도움말 출력 */
  HELP: 'help',
} as const;

/** CLI_COMMAND 값 타입 */
export type CliCommand = (typeof CLI_COMMAND)[keyof typeof CLI_COMMAND];

// ─────────────────────────────────────────
// 커맨드 옵션 타입
// ─────────────────────────────────────────

/** run 커맨드 옵션 */
export interface RunOptions {
  /** 신뢰 모드 — 기본값: 'suggest' */
  readonly trustMode?: 'observe' | 'suggest' | 'semi-auto' | 'full-auto';
  /** 출력 형식 — 기본값: 'human' */
  readonly format?: 'human' | 'json';
  /** 건식 실행 — 실제 변경 없이 계획만 출력 */
  readonly dryRun?: boolean;
}

/** audit 커맨드 옵션 */
export interface AuditOptions {
  /** 조회할 최대 항목 수 — 기본값: 20 */
  readonly limit?: number;
  /** 위험도 필터 (LOW | MEDIUM | HIGH | CRITICAL) */
  readonly risk?: string;
  /** 출력 형식 — 기본값: 'human' */
  readonly format?: 'human' | 'json';
}

/** rollback 커맨드 옵션 */
export interface RollbackOptions {
  /** 롤백할 실행 ID (생략 시 마지막 실행 롤백) */
  readonly runId?: string;
  /** 강제 롤백 — 확인 프롬프트 생략 */
  readonly force?: boolean;
}

// ─────────────────────────────────────────
// 파싱된 커맨드 타입 (discriminated union)
// ─────────────────────────────────────────

/** run 커맨드 파싱 결과 */
export interface ParsedRunCommand {
  readonly command: 'run';
  readonly input: string;
  readonly options: RunOptions;
}

/** status 커맨드 파싱 결과 */
export interface ParsedStatusCommand {
  readonly command: 'status';
  readonly format?: 'human' | 'json';
}

/** stop 커맨드 파싱 결과 */
export interface ParsedStopCommand {
  readonly command: 'stop';
  readonly force: boolean;
}

/** audit 커맨드 파싱 결과 */
export interface ParsedAuditCommand {
  readonly command: 'audit';
  readonly options: AuditOptions;
}

/** rollback 커맨드 파싱 결과 */
export interface ParsedRollbackCommand {
  readonly command: 'rollback';
  readonly options: RollbackOptions;
}

/** help 커맨드 파싱 결과 */
export interface ParsedHelpCommand {
  readonly command: 'help';
  readonly topic?: string;
}

/** 파싱된 커맨드 — discriminated union */
export type ParsedCommand =
  | ParsedRunCommand
  | ParsedStatusCommand
  | ParsedStopCommand
  | ParsedAuditCommand
  | ParsedRollbackCommand
  | ParsedHelpCommand;

// ─────────────────────────────────────────
// 실행 상태 표시 타입
// ─────────────────────────────────────────

/** 실행 상태 스냅샷 — status 커맨드 출력용 */
export interface StatusSnapshot {
  /** 실행 ID */
  readonly runId: string;
  /** 현재 상태 이름 */
  readonly state: string;
  /** 현재 작업 중인 에이전트 */
  readonly currentAgent: string | null;
  /** 위험도 점수 (0~100) */
  readonly riskScore: number;
  /** 타임라인 항목 수 */
  readonly timelineCount: number;
  /** 상태 업데이트 시각 (ISO 8601) */
  readonly updatedAt: string;
}

// ─────────────────────────────────────────
// CLI 출력 유틸리티 타입
// ─────────────────────────────────────────

/** CLI 출력 컬러 코드 — ANSI 이스케이프 시퀀스 */
export const ANSI_COLOR = {
  RESET: '\x1b[0m',
  BOLD: '\x1b[1m',
  DIM: '\x1b[2m',
  RED: '\x1b[31m',
  GREEN: '\x1b[32m',
  YELLOW: '\x1b[33m',
  BLUE: '\x1b[34m',
  MAGENTA: '\x1b[35m',
  CYAN: '\x1b[36m',
  WHITE: '\x1b[37m',
  GRAY: '\x1b[90m',
} as const;
