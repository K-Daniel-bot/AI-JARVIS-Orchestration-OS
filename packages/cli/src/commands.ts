/**
 * CLI 커맨드 구현체 — 각 커맨드의 실제 동작을 정의한다.
 * 모든 커맨드는 Result<void, JarvisError> 패턴으로 에러를 반환한다.
 * Orchestrator/감사 로그와의 실제 통신은 Phase 1에서 완성되며,
 * 현재는 구조와 인터페이스를 확립하는 Phase 0 구현이다.
 */

import type { Result } from '@jarvis/shared';
import { ok, err, generateRunId, internalError } from '@jarvis/shared';
import type { JarvisError } from '@jarvis/shared';
import type { AuditOptions, RollbackOptions, StatusSnapshot } from './types.js';
import {
  printSuccess,
  printError,
  printInfo,
  printWarning,
  printDivider,
  printAgentActivity,
  printBanner,
  formatRiskScore,
  formatRiskLevel,
  formatAuditEntry,
  printJson,
  bold,
  cyan,
  gray,
} from './formatter.js';

// ─────────────────────────────────────────
// 내부 상태 저장소 (Phase 0: 인메모리)
// Phase 1+: 별도 state store나 IPC 파일로 교체 예정
// ─────────────────────────────────────────

/** 현재 활성 실행 세션 스냅샷 (없으면 null) */
let currentSession: StatusSnapshot | null = null;

/** 비상 중단 요청 플래그 */
let emergencyStopRequested = false;

// ─────────────────────────────────────────
// run 커맨드
// ─────────────────────────────────────────

/**
 * run 커맨드 — 사용자 요청을 Orchestrator에 전달하여 실행한다.
 * Phase 0: 실행 흐름 시뮬레이션, Phase 1+: 실제 상태 머신 연동
 *
 * @param input - 사용자 요청 텍스트
 * @param trustMode - 신뢰 모드 (기본: 'suggest')
 * @param dryRun - 건식 실행 여부
 * @param format - 출력 형식
 */
export async function runCommand(
  input: string,
  trustMode: 'observe' | 'suggest' | 'semi-auto' | 'full-auto' = 'suggest',
  dryRun = false,
  format: 'human' | 'json' = 'human',
): Promise<Result<void, JarvisError>> {
  // 비상 중단 상태 확인
  if (emergencyStopRequested) {
    return err(
      internalError('비상 중단 상태에서는 새 실행을 시작할 수 없습니다. stop --force 후 재시작하세요.'),
    );
  }

  const runId = generateRunId();

  if (format === 'json') {
    printJson({
      event: 'run_started',
      runId,
      input,
      trustMode,
      dryRun,
      timestamp: new Date().toISOString(),
    });
  } else {
    printBanner();
    printDivider();
    printInfo(`실행 ID: ${bold(runId)}`);
    printInfo(`신뢰 모드: ${cyan(trustMode)}`);
    if (dryRun) {
      printWarning('건식 실행 모드 — 실제 변경이 적용되지 않습니다');
    }
    printDivider();
    process.stdout.write('\n');
    printInfo(`사용자 요청: ${input}\n`);
  }

  // 현재 세션 초기화
  currentSession = {
    runId,
    state: 'SPEC_ANALYSIS',
    currentAgent: 'spec-agent',
    riskScore: 0,
    timelineCount: 0,
    updatedAt: new Date().toISOString(),
  };

  // Phase 0: 에이전트 실행 흐름 시뮬레이션
  // Phase 1+: XState 상태 머신 + MessageBus 연동
  try {
    const steps: Array<{ agent: string; activity: string; state: string }> = [
      { agent: 'spec-agent', activity: '사용자 의도 분석 중...', state: 'SPEC_ANALYSIS' },
      { agent: 'policy-risk', activity: '정책 판정 및 위험도 계산 중...', state: 'POLICY_CHECK' },
      { agent: 'planner', activity: '실행 계획(WBS) 수립 중...', state: 'PLANNING' },
    ];

    for (const step of steps) {
      // 비상 중단 중간 체크
      if (emergencyStopRequested) {
        const stopError = internalError('비상 중단 요청으로 실행이 중단되었습니다');
        if (format === 'json') {
          printJson({ event: 'run_stopped', runId, reason: stopError.message });
        } else {
          printError(stopError.message);
        }
        currentSession = null;
        return err(stopError);
      }

      // 상태 업데이트
      currentSession = {
        ...currentSession,
        state: step.state,
        currentAgent: step.agent as StatusSnapshot['currentAgent'],
        timelineCount: currentSession.timelineCount + 1,
        updatedAt: new Date().toISOString(),
      };

      if (format === 'human') {
        printAgentActivity(step.agent, step.activity);
        // 실제 API 호출 대기 시뮬레이션 (Phase 0)
        await delay(200);
      }
    }

    if (dryRun) {
      // 건식 실행: 계획까지만 출력
      currentSession = {
        ...currentSession,
        state: 'COMPLETED',
        currentAgent: null,
        updatedAt: new Date().toISOString(),
      };

      if (format === 'json') {
        printJson({
          event: 'dry_run_completed',
          runId,
          message: '건식 실행 완료 — 계획 생성까지 수행, 코드 변경 없음',
        });
      } else {
        process.stdout.write('\n');
        printDivider();
        printSuccess(`건식 실행 완료 (runId: ${runId})`);
        printInfo('코드 변경 없이 계획 생성까지 수행했습니다.');
        printInfo('실제 실행: jarvis run --trust-mode=suggest "<요청>"');
      }

      currentSession = null;
      return ok(undefined);
    }

    // Gate L1: 계획 승인 안내 (Phase 0 — 자동 통과, Phase 1+: 실제 Gate UI)
    if (format === 'human') {
      process.stdout.write('\n');
      printDivider();
      printWarning('Gate L1: 계획 승인 필요');
      printInfo('Phase 1에서 대화형 승인 UI가 활성화됩니다.');
      printInfo('현재는 자동 승인 모드로 진행합니다.');
      printDivider();
      process.stdout.write('\n');
    }

    // 이후 단계 (Phase 0 시뮬레이션)
    const codeSteps: Array<{ agent: string; activity: string; state: string }> = [
      { agent: 'codegen', activity: '코드 생성 중...', state: 'CODE_GENERATION' },
      { agent: 'review', activity: '코드 품질/보안 검토 중...', state: 'CODE_REVIEW' },
      { agent: 'test-build', activity: '테스트 실행 중...', state: 'TESTING' },
    ];

    for (const step of codeSteps) {
      if (emergencyStopRequested) {
        const stopError = internalError('비상 중단 요청으로 실행이 중단되었습니다');
        currentSession = null;
        return err(stopError);
      }

      currentSession = {
        ...currentSession,
        state: step.state,
        currentAgent: step.agent as StatusSnapshot['currentAgent'],
        timelineCount: currentSession.timelineCount + 1,
        updatedAt: new Date().toISOString(),
      };

      if (format === 'human') {
        printAgentActivity(step.agent, step.activity);
        await delay(150);
      }
    }

    // 완료
    currentSession = {
      ...currentSession,
      state: 'COMPLETED',
      currentAgent: null,
      updatedAt: new Date().toISOString(),
    };

    if (format === 'json') {
      printJson({
        event: 'run_completed',
        runId,
        stepsExecuted: currentSession.timelineCount,
        timestamp: new Date().toISOString(),
      });
    } else {
      process.stdout.write('\n');
      printDivider();
      printSuccess(`실행 완료 (runId: ${runId})`);
      printInfo(`총 ${currentSession.timelineCount}단계 처리`);
      printInfo(`감사 로그 조회: jarvis audit`);
    }

    currentSession = null;
    return ok(undefined);
  } catch (e) {
    const cause = e instanceof Error ? e : undefined;
    const runError = internalError('실행 중 예상치 못한 오류가 발생했습니다', cause);
    currentSession = null;

    if (format === 'json') {
      printJson({ event: 'run_error', runId, code: runError.code });
    } else {
      printError(runError.message);
    }

    return err(runError);
  }
}

// ─────────────────────────────────────────
// status 커맨드
// ─────────────────────────────────────────

/**
 * status 커맨드 — 현재 실행 상태를 조회하여 출력한다.
 * Phase 0: 인메모리 currentSession 조회
 * Phase 1+: XState 서비스 상태 조회
 *
 * @param format - 출력 형식
 */
export async function statusCommand(
  format: 'human' | 'json' = 'human',
): Promise<Result<void, JarvisError>> {
  if (currentSession === null) {
    if (format === 'json') {
      printJson({ status: 'IDLE', message: '현재 실행 중인 작업이 없습니다' });
    } else {
      printInfo('현재 실행 중인 작업이 없습니다 (IDLE)');
      printInfo('새 작업 시작: jarvis run "<요청>"');
    }
    return ok(undefined);
  }

  if (format === 'json') {
    printJson(currentSession);
    return ok(undefined);
  }

  // 사람이 읽기 쉬운 형식 출력
  printDivider();
  process.stdout.write(bold('현재 실행 상태') + '\n');
  printDivider();
  printInfo(`실행 ID   : ${bold(currentSession.runId)}`);
  printInfo(`상태      : ${cyan(currentSession.state)}`);
  printInfo(
    `에이전트  : ${currentSession.currentAgent !== null ? cyan(currentSession.currentAgent) : gray('없음')}`,
  );
  printInfo(`위험도    : ${formatRiskScore(currentSession.riskScore)}`);
  printInfo(`타임라인  : ${currentSession.timelineCount}단계 처리됨`);
  printInfo(`갱신 시각 : ${new Date(currentSession.updatedAt).toLocaleString('ko-KR')}`);

  if (emergencyStopRequested) {
    printWarning('비상 중단 요청됨 — 현재 단계 완료 후 종료 예정');
  }

  printDivider();
  return ok(undefined);
}

// ─────────────────────────────────────────
// stop 커맨드
// ─────────────────────────────────────────

/**
 * stop 커맨드 — 비상 중단을 요청한다.
 * 실행 중인 에이전트는 현재 단계 완료 후 종료된다.
 * force 옵션 사용 시 즉시 종료 플래그를 설정하고 이전 상태를 초기화한다.
 *
 * @param force - 강제 중단 여부 (확인 생략)
 */
export async function stopCommand(force = false): Promise<Result<void, JarvisError>> {
  if (currentSession === null && !emergencyStopRequested) {
    printInfo('현재 실행 중인 작업이 없습니다');
    return ok(undefined);
  }

  if (!force) {
    // Phase 0: 자동 확인. Phase 1+: 대화형 확인 프롬프트
    printWarning('비상 중단을 요청합니다. 강제 중단: --force 플래그 사용');
    printWarning('강제 실행: jarvis stop --force');
    return ok(undefined);
  }

  emergencyStopRequested = true;

  if (currentSession !== null) {
    printError(`비상 중단 요청 — 실행 ID: ${currentSession.runId}`);
    printWarning('진행 중인 에이전트 작업이 완료되는 즉시 종료됩니다');
    printWarning('롤백 필요 시: jarvis rollback');
  } else {
    printWarning('비상 중단 플래그 해제');
    emergencyStopRequested = false;
    printSuccess('정상 상태로 복구되었습니다');
  }

  return ok(undefined);
}

// ─────────────────────────────────────────
// audit 커맨드
// ─────────────────────────────────────────

/**
 * audit 커맨드 — 감사 로그를 조회하여 출력한다.
 * Phase 0: 샘플 데이터 출력
 * Phase 1+: @jarvis/audit 패키지의 AuditLogger 연동
 *
 * @param options - 조회 옵션 (limit, risk, format)
 */
export async function auditCommand(
  options: AuditOptions = {},
): Promise<Result<void, JarvisError>> {
  const limit = options.limit ?? 20;
  const format = options.format ?? 'human';

  // Phase 0: 샘플 감사 로그 (실제 DB 연동은 Phase 1)
  const sampleEntries: Array<Record<string, unknown>> = generateSampleAuditEntries(limit, options.risk);

  if (format === 'json') {
    printJson({ entries: sampleEntries, count: sampleEntries.length });
    return ok(undefined);
  }

  printDivider();
  process.stdout.write(bold(`감사 로그 (최근 ${sampleEntries.length}건)`) + '\n');
  if (options.risk !== undefined) {
    process.stdout.write(`위험도 필터: ${formatRiskLevel(options.risk)}\n`);
  }
  printDivider();

  if (sampleEntries.length === 0) {
    printInfo('조건에 맞는 감사 로그가 없습니다');
    return ok(undefined);
  }

  for (const entry of sampleEntries) {
    process.stdout.write(formatAuditEntry(entry) + '\n');
    process.stdout.write('\n');
  }

  printDivider();
  printInfo('Phase 1에서 실제 SQLite 감사 로그와 연동됩니다.');

  return ok(undefined);
}

// ─────────────────────────────────────────
// rollback 커맨드
// ─────────────────────────────────────────

/**
 * rollback 커맨드 — 마지막 실행 또는 지정 runId를 롤백한다.
 * Phase 0: 롤백 흐름 시뮬레이션
 * Phase 1+: @jarvis/rollback 에이전트 연동
 *
 * @param options - 롤백 옵션 (runId, force)
 */
export async function rollbackCommand(
  options: RollbackOptions = {},
): Promise<Result<void, JarvisError>> {
  const { runId, force = false } = options;

  if (!force) {
    printWarning('롤백은 파일 시스템 변경을 되돌립니다. 확인: --force 플래그 사용');
    printWarning(`강제 실행: jarvis rollback${runId !== undefined ? ` ${runId}` : ''} --force`);
    return ok(undefined);
  }

  const targetRunId = runId ?? '[마지막 실행]';

  printDivider();
  printInfo(`롤백 대상: ${bold(targetRunId)}`);
  printInfo('롤백 에이전트(rollback) 시작...');

  // Phase 0: 시뮬레이션
  await delay(300);
  printAgentActivity('rollback', '체크포인트 조회 중...');
  await delay(200);
  printAgentActivity('rollback', 'Capability 토큰 전체 무효화 중...');
  await delay(150);
  printAgentActivity('rollback', '파일 시스템 변경 복구 중...');
  await delay(200);
  printAgentActivity('rollback', 'Postmortem 작성 중...');
  await delay(100);

  printDivider();
  printSuccess(`롤백 완료 (대상: ${targetRunId})`);
  printInfo('Phase 1에서 실제 체크포인트 기반 롤백이 적용됩니다.');

  // 비상 중단 플래그 초기화
  emergencyStopRequested = false;
  currentSession = null;

  return ok(undefined);
}

// ─────────────────────────────────────────
// 도움말 출력
// ─────────────────────────────────────────

/** 도움말을 출력한다 */
export function printHelp(topic?: string): void {
  if (topic !== undefined) {
    printTopicHelp(topic);
    return;
  }

  printBanner();
  process.stdout.write([
    bold('사용법:'),
    '  jarvis <커맨드> [옵션]\n',
    bold('커맨드:'),
    `  ${cyan('run')} <요청>          사용자 요청을 실행합니다`,
    `  ${cyan('status')}              현재 실행 상태를 조회합니다`,
    `  ${cyan('stop')}                실행 중인 작업을 중단합니다`,
    `  ${cyan('audit')}               감사 로그를 조회합니다`,
    `  ${cyan('rollback')} [runId]    마지막 실행을 롤백합니다`,
    `  ${cyan('help')} [커맨드]        도움말을 표시합니다\n`,
    bold('전역 옵션:'),
    '  -f, --format <human|json>  출력 형식 (기본: human)',
    '  -h, --help                 도움말 표시\n',
    bold('예시:'),
    `  ${gray('# 파일 생성 요청')}`,
    `  jarvis run "src/utils/date.ts 파일을 만들어줘"`,
    '',
    `  ${gray('# 건식 실행으로 계획만 확인')}`,
    `  jarvis run --dry-run "새 기능 추가"`,
    '',
    `  ${gray('# 감사 로그 조회 (위험도 HIGH 이상만)')}`,
    `  jarvis audit --limit 10 --risk HIGH`,
    '',
    `  ${gray('# 강제 롤백')}`,
    `  jarvis rollback --force`,
    '',
  ].join('\n') + '\n');
}

/** 특정 커맨드 상세 도움말 출력 */
function printTopicHelp(topic: string): void {
  const topics: Record<string, string[]> = {
    run: [
      bold('jarvis run <요청> [옵션]'),
      '',
      '  사용자의 자연어 요청을 JARVIS OS 에이전트 파이프라인으로 실행합니다.',
      '  Orchestrator → Spec → Policy → Plan → Code → Review → Test → Deploy 순서로 처리됩니다.',
      '',
      bold('옵션:'),
      '  -t, --trust-mode <모드>  신뢰 모드: observe | suggest | semi-auto | full-auto (기본: suggest)',
      '  -d, --dry-run            건식 실행: 계획 생성 후 실제 변경 없이 종료',
      '  -f, --format <형식>      출력 형식: human | json',
      '',
      bold('예시:'),
      '  jarvis run "로그인 API 구현해줘"',
      '  jarvis run --trust-mode=full-auto --dry-run "패키지 업그레이드"',
    ],
    audit: [
      bold('jarvis audit [옵션]'),
      '',
      '  감사 로그를 조회합니다. 모든 에이전트 작업은 append-only 감사 로그에 기록됩니다.',
      '',
      bold('옵션:'),
      '  -l, --limit <수>         조회할 최대 항목 수 (기본: 20)',
      '  -r, --risk <레벨>        위험도 필터: LOW | MEDIUM | HIGH | CRITICAL',
      '  -f, --format <형식>      출력 형식: human | json',
      '',
      bold('예시:'),
      '  jarvis audit',
      '  jarvis audit --limit 50 --risk HIGH --format json',
    ],
    rollback: [
      bold('jarvis rollback [runId] [옵션]'),
      '',
      '  마지막 실행 또는 지정한 runId의 작업을 롤백합니다.',
      '  파일 시스템 변경을 체크포인트로 복구하고 Capability 토큰을 무효화합니다.',
      '',
      bold('옵션:'),
      '  --force                  확인 프롬프트 없이 즉시 롤백',
      '',
      bold('예시:'),
      '  jarvis rollback --force',
      '  jarvis rollback run_20260302_abc123 --force',
    ],
  };

  const helpLines = topics[topic];
  if (helpLines === undefined) {
    printError(`알 수 없는 커맨드: "${topic}". 사용 가능한 커맨드: run, status, stop, audit, rollback`);
    return;
  }

  process.stdout.write('\n' + helpLines.join('\n') + '\n\n');
}

// ─────────────────────────────────────────
// 내부 유틸리티
// ─────────────────────────────────────────

/** 비동기 지연 (Phase 0 시뮬레이션용) */
async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** 샘플 감사 로그 엔트리 생성 (Phase 0용) */
function generateSampleAuditEntries(
  limit: number,
  riskFilter?: string,
): Array<Record<string, unknown>> {
  const allEntries: Array<Record<string, unknown>> = [
    {
      audit_id: 'aud_20260302_aabbcc001122',
      timestamp: new Date(Date.now() - 3600_000).toISOString(),
      who: { agent: 'codegen', run_id: 'run_20260302_111111111111', role: 'user' },
      what: { action_type: 'FS_WRITE', target: 'src/auth/login.ts', description: '인증 모듈 생성' },
      policy: { risk_level: 'MEDIUM', decision: 'ALLOW', decision_id: 'pd_20260302_aaa' },
      result: { status: 'SUCCESS', duration_ms: 1240 },
    },
    {
      audit_id: 'aud_20260302_bbccdd002233',
      timestamp: new Date(Date.now() - 2400_000).toISOString(),
      who: { agent: 'executor', run_id: 'run_20260302_222222222222', role: 'user' },
      what: { action_type: 'EXEC_RUN', target: 'pnpm test', description: '테스트 실행' },
      policy: { risk_level: 'LOW', decision: 'ALLOW', decision_id: 'pd_20260302_bbb' },
      result: { status: 'SUCCESS', duration_ms: 3210 },
    },
    {
      audit_id: 'aud_20260302_ccddeef33344',
      timestamp: new Date(Date.now() - 1200_000).toISOString(),
      who: { agent: 'policy-risk', run_id: 'run_20260302_333333333333', role: 'user' },
      what: { action_type: 'BROWSER_LOGIN_REQUEST', target: 'github.com', description: '외부 서비스 로그인 시도' },
      policy: { risk_level: 'HIGH', decision: 'APPROVAL_REQUIRED', decision_id: 'pd_20260302_ccc' },
      result: { status: 'SKIPPED', duration_ms: 100 },
    },
    {
      audit_id: 'aud_20260302_ddeeff004455',
      timestamp: new Date(Date.now() - 600_000).toISOString(),
      who: { agent: 'executor', run_id: 'run_20260302_444444444444', role: 'user' },
      what: { action_type: 'FS_DELETE', target: '/tmp/jarvis-cache', description: '임시 파일 정리' },
      policy: { risk_level: 'MEDIUM', decision: 'ALLOW', decision_id: 'pd_20260302_ddd' },
      result: { status: 'SUCCESS', duration_ms: 45 },
    },
    {
      audit_id: 'aud_20260302_eeffgg005566',
      timestamp: new Date(Date.now() - 120_000).toISOString(),
      who: { agent: 'executor', run_id: 'run_20260302_555555555555', role: 'user' },
      what: { action_type: 'EXEC_RUN', target: 'rm -rf /system', description: '시스템 파일 삭제 시도 (차단됨)' },
      policy: { risk_level: 'CRITICAL', decision: 'DENY', decision_id: 'pd_20260302_eee' },
      result: { status: 'FAILED', duration_ms: 10 },
    },
  ];

  // 위험도 필터 적용
  const filtered =
    riskFilter !== undefined
      ? allEntries.filter((entry) => {
          const policy = entry['policy'] as Record<string, unknown> | undefined;
          if (policy === undefined) return false;
          const level = typeof policy['risk_level'] === 'string' ? policy['risk_level'] : '';
          return level.toUpperCase() === riskFilter.toUpperCase();
        })
      : allEntries;

  return filtered.slice(0, limit);
}

// ─────────────────────────────────────────
// 내부 상태 초기화 (테스트용)
// ─────────────────────────────────────────

/** 내부 상태를 초기화한다 — 테스트 격리 전용 */
export function _resetInternalState(): void {
  currentSession = null;
  emergencyStopRequested = false;
}

/** 현재 세션 스냅샷을 반환한다 — 테스트 전용 */
export function _getCurrentSession(): StatusSnapshot | null {
  return currentSession;
}

/** 비상 중단 플래그를 반환한다 — 테스트 전용 */
export function _isEmergencyStopRequested(): boolean {
  return emergencyStopRequested;
}

