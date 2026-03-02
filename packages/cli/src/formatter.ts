/**
 * CLI 출력 포맷터 — 사람이 읽기 쉬운 형식과 JSON 형식을 모두 지원한다.
 * 민감 정보(토큰, 비밀번호 등)는 출력에서 제외한다.
 */

import { ANSI_COLOR } from './types.js';

// ─────────────────────────────────────────
// 터미널 색상 출력 헬퍼
// ─────────────────────────────────────────

/** TTY 환경인지 확인 — 파이프 출력 시 색상 코드 제거 */
function isTTY(): boolean {
  return process.stdout.isTTY === true;
}

/** 색상 코드를 텍스트에 적용한다 (TTY 환경에서만 활성화) */
function colorize(text: string, color: string): string {
  if (!isTTY()) {
    return text;
  }
  return `${color}${text}${ANSI_COLOR.RESET}`;
}

/** 굵게 출력 */
export function bold(text: string): string {
  return colorize(text, ANSI_COLOR.BOLD);
}

/** 빨간색 (에러, 위험) */
export function red(text: string): string {
  return colorize(text, ANSI_COLOR.RED);
}

/** 초록색 (성공, 안전) */
export function green(text: string): string {
  return colorize(text, ANSI_COLOR.GREEN);
}

/** 노란색 (경고, 중간 위험) */
export function yellow(text: string): string {
  return colorize(text, ANSI_COLOR.YELLOW);
}

/** 파란색 (정보) */
export function blue(text: string): string {
  return colorize(text, ANSI_COLOR.BLUE);
}

/** 회색 (보조 정보) */
export function gray(text: string): string {
  return colorize(text, ANSI_COLOR.GRAY);
}

/** 청록색 (에이전트 이름 등) */
export function cyan(text: string): string {
  return colorize(text, ANSI_COLOR.CYAN);
}

// ─────────────────────────────────────────
// 공통 출력 형식
// ─────────────────────────────────────────

/** 구분선 출력 */
export function printDivider(): void {
  process.stdout.write(gray('─'.repeat(60)) + '\n');
}

/** JARVIS OS 배너 출력 */
export function printBanner(): void {
  const banner = [
    '',
    bold(cyan('  ╔══════════════════════════════════╗')),
    bold(cyan('  ║       JARVIS Orchestration OS     ║')),
    bold(cyan('  ║    AI 에이전트 오케스트레이션 시스템  ║')),
    bold(cyan('  ╚══════════════════════════════════╝')),
    '',
  ].join('\n');
  process.stdout.write(banner + '\n');
}

/** 성공 메시지 출력 */
export function printSuccess(message: string): void {
  process.stdout.write(green('✓ ') + message + '\n');
}

/** 에러 메시지 출력 (stderr) */
export function printError(message: string): void {
  process.stderr.write(red('✗ ') + message + '\n');
}

/** 경고 메시지 출력 */
export function printWarning(message: string): void {
  process.stdout.write(yellow('⚠ ') + message + '\n');
}

/** 정보 메시지 출력 */
export function printInfo(message: string): void {
  process.stdout.write(blue('ℹ ') + message + '\n');
}

/** 에이전트 작업 진행 상태 출력 */
export function printAgentActivity(agentName: string, activity: string): void {
  const agent = cyan(`[${agentName}]`);
  process.stdout.write(`  ${agent} ${activity}\n`);
}

// ─────────────────────────────────────────
// 위험도 표시 포맷
// ─────────────────────────────────────────

/** 위험도 점수를 색상 레이블로 변환한다 */
export function formatRiskScore(score: number): string {
  if (score >= 80) {
    return red(`CRITICAL(${score})`);
  }
  if (score >= 60) {
    return red(`HIGH(${score})`);
  }
  if (score >= 40) {
    return yellow(`MEDIUM(${score})`);
  }
  return green(`LOW(${score})`);
}

/** 위험도 문자열을 색상 레이블로 변환한다 */
export function formatRiskLevel(level: string): string {
  switch (level.toUpperCase()) {
    case 'CRITICAL':
      return red('CRITICAL');
    case 'HIGH':
      return red('HIGH');
    case 'MEDIUM':
      return yellow('MEDIUM');
    case 'LOW':
      return green('LOW');
    default:
      return gray(level);
  }
}

// ─────────────────────────────────────────
// 감사 로그 엔트리 출력
// ─────────────────────────────────────────

/** 감사 로그 엔트리를 사람이 읽기 쉬운 형식으로 출력한다 */
export function formatAuditEntry(entry: Record<string, unknown>): string {
  const lines: string[] = [];

  // 기본 메타데이터
  const auditId = typeof entry['audit_id'] === 'string' ? entry['audit_id'] : 'unknown';
  const timestamp = typeof entry['timestamp'] === 'string'
    ? new Date(entry['timestamp']).toLocaleString('ko-KR')
    : 'unknown';

  lines.push(gray(`  [${timestamp}]`) + ' ' + bold(auditId));

  // who 섹션
  if (entry['who'] !== null && typeof entry['who'] === 'object') {
    const who = entry['who'] as Record<string, unknown>;
    const agentName = typeof who['agent'] === 'string' ? who['agent'] : '?';
    lines.push(`    에이전트: ${cyan(agentName)}`);
  }

  // what 섹션
  if (entry['what'] !== null && typeof entry['what'] === 'object') {
    const what = entry['what'] as Record<string, unknown>;
    const action = typeof what['action_type'] === 'string' ? what['action_type'] : '?';
    lines.push(`    액션: ${blue(action)}`);
  }

  // policy 섹션
  if (entry['policy'] !== null && typeof entry['policy'] === 'object') {
    const policy = entry['policy'] as Record<string, unknown>;
    const riskLevel = typeof policy['risk_level'] === 'string' ? policy['risk_level'] : '?';
    lines.push(`    위험도: ${formatRiskLevel(riskLevel)}`);
  }

  // result 섹션
  if (entry['result'] !== null && typeof entry['result'] === 'object') {
    const result = entry['result'] as Record<string, unknown>;
    const status = typeof result['status'] === 'string' ? result['status'] : '?';
    const statusColor = status === 'SUCCESS' ? green(status) : red(status);
    lines.push(`    결과: ${statusColor}`);
  }

  return lines.join('\n');
}

// ─────────────────────────────────────────
// JSON 직렬화 헬퍼
// ─────────────────────────────────────────

/**
 * 객체를 JSON 형식으로 출력한다.
 * 민감 키(token, password, secret, key)는 마스킹한다.
 */
export function printJson(data: unknown): void {
  const sanitized = sanitizeForOutput(data);
  process.stdout.write(JSON.stringify(sanitized, null, 2) + '\n');
}

/** 출력용 민감 정보 마스킹 — 토큰, 비밀번호, 시크릿 키 제거 */
function sanitizeForOutput(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }
  if (typeof data !== 'object') {
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(sanitizeForOutput);
  }

  const obj = data as Record<string, unknown>;
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    // 민감 키 패턴 검사
    const lowerKey = key.toLowerCase();
    const isSensitive =
      lowerKey.includes('token') ||
      lowerKey.includes('password') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('credential') ||
      lowerKey.includes('api_key') ||
      lowerKey.includes('private_key');

    if (isSensitive) {
      result[key] = '[REDACTED]';
    } else {
      result[key] = sanitizeForOutput(value);
    }
  }

  return result;
}
