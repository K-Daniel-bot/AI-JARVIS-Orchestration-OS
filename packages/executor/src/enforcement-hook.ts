/**
 * 강제 검증 훅 — Capability Token 기반 액션 실행 전/후 검증 레이어
 * 모든 OS 조작은 이 훅을 통해 허용 여부를 판정받아야 한다.
 *
 * contract.md §2: 모든 OS 조작은 Capability Token이 부여된 경우에만 실행
 * contract.md §1: 절대 금지사항 위반 시 즉시 거부 + 감사 로그 기록
 */

import { minimatch } from 'minimatch';
import { validateToken } from '@jarvis/policy-engine';
import type {
  CapabilityToken,
  Action,
  ActionType,
  PolicyConstraints,
  ExecutionStep,
  Result,
} from '@jarvis/shared';
import { ok, err, JarvisError, ErrorCode } from '@jarvis/shared';
import { isMobileAction } from './action-api.js';

// ─────────────────────────────────────────
// 강제 검증 결과 타입
// ─────────────────────────────────────────

/**
 * 강제 검증 결과 — 허용 또는 거부 판정과 그 이유를 담는다.
 * gateRequired가 true이면 사용자 Gate 승인이 필요함을 의미한다.
 */
export type EnforcementResult =
  | { readonly allowed: true }
  | {
      readonly allowed: false;
      readonly reason: string;
      readonly gateRequired?: boolean;
    };

// ─────────────────────────────────────────
// 액션 타입 → Capability/Scope 매핑
// ─────────────────────────────────────────

/**
 * ActionType에서 필요한 Capability 이름을 도출한다.
 * Token의 grant.cap과 비교하는 데 사용한다.
 */
function resolveRequiredCap(actionType: ActionType): string {
  // 파일시스템 액션
  if (
    actionType === 'FS_READ' ||
    actionType === 'FS_LIST'
  ) {
    return 'fs.read';
  }
  if (
    actionType === 'FS_WRITE' ||
    actionType === 'FS_MOVE' ||
    actionType === 'FS_DELETE'
  ) {
    return 'fs.write';
  }

  // 프로세스/명령 실행 액션
  if (actionType === 'EXEC_RUN') {
    return 'exec.run';
  }
  if (actionType === 'PROCESS_KILL') {
    return 'process.kill';
  }

  // 앱/윈도우 액션
  if (
    actionType === 'APP_LAUNCH' ||
    actionType === 'APP_FOCUS' ||
    actionType === 'WINDOW_CLICK' ||
    actionType === 'WINDOW_TYPE' ||
    actionType === 'WINDOW_SHORTCUT'
  ) {
    return 'app.control';
  }

  // 브라우저 액션
  if (
    actionType === 'BROWSER_OPEN_URL' ||
    actionType === 'BROWSER_CLICK' ||
    actionType === 'BROWSER_TYPE' ||
    actionType === 'BROWSER_DOWNLOAD' ||
    actionType === 'BROWSER_UPLOAD' ||
    actionType === 'BROWSER_LOGIN_REQUEST' ||
    actionType === 'BROWSER_FETCH'
  ) {
    return 'browser.control';
  }

  // 모바일 액션 — 세부 분류
  if (
    actionType === 'MOBILE_CONTACT_SEARCH' ||
    actionType === 'MOBILE_CONTACT_READ'
  ) {
    return 'mobile.contact';
  }
  if (
    actionType === 'MOBILE_CALL_DIAL' ||
    actionType === 'MOBILE_CALL_END' ||
    actionType === 'MOBILE_CALL_STATUS'
  ) {
    return 'mobile.call';
  }
  if (
    actionType === 'MOBILE_SMS_SEND' ||
    actionType === 'MOBILE_SMS_READ'
  ) {
    return 'mobile.sms';
  }
  if (
    actionType === 'MOBILE_MESSENGER_SEND' ||
    actionType === 'MOBILE_MESSENGER_READ'
  ) {
    return 'mobile.messenger';
  }
  if (
    actionType === 'MOBILE_APP_LAUNCH' ||
    actionType === 'MOBILE_APP_FOCUS' ||
    actionType === 'MOBILE_APP_ACTION'
  ) {
    return 'mobile.app';
  }
  if (
    actionType === 'MOBILE_NOTIFICATION_READ' ||
    actionType === 'MOBILE_NOTIFICATION_DISMISS'
  ) {
    return 'mobile.notification';
  }
  if (actionType === 'MOBILE_DEVICE_STATUS') {
    return 'mobile.status';
  }
  if (actionType === 'MOBILE_CLIPBOARD_SYNC') {
    return 'mobile.clipboard';
  }

  // 알 수 없는 ActionType — INTERNAL_ERROR 방지를 위해 generic 반환
  return 'unknown';
}

/**
 * 액션 파라미터에서 스코프 문자열을 추출한다.
 * 파일 경로, URL, 앱 이름 등이 스코프로 사용된다.
 */
function resolveActionScope(action: Action): string {
  const params = action.params;

  // 파일시스템 — path 파라미터 우선
  if (typeof params['path'] === 'string') {
    return params['path'];
  }

  // 파일 이동 — source 파라미터
  if (typeof params['source'] === 'string') {
    return params['source'];
  }

  // 브라우저/네트워크 — url 파라미터
  if (typeof params['url'] === 'string') {
    return params['url'];
  }

  // 앱/모바일 — app 또는 appName 파라미터
  if (typeof params['app'] === 'string') {
    return params['app'];
  }
  if (typeof params['appName'] === 'string') {
    return params['appName'];
  }

  // 프로세스 — command 파라미터
  if (typeof params['command'] === 'string') {
    return params['command'];
  }

  // 연락처/전화 — target 파라미터
  if (typeof params['target'] === 'string') {
    return params['target'];
  }

  // 폴백: 액션 ID를 스코프로 사용
  return action.action_id;
}

// ─────────────────────────────────────────
// 제약 조건 검사
// ─────────────────────────────────────────

/**
 * 액션이 PolicyConstraints 범위 내에 있는지 확인한다.
 *
 * 검사 항목:
 * - 파일시스템 액션: write_allow/write_deny 패턴 매칭
 * - 실행 액션: exec allow/deny 목록 확인
 * - 네트워크 액션: 허용/차단 도메인 확인
 */
export function checkConstraints(
  actionType: ActionType,
  params: Record<string, unknown>,
  constraints: PolicyConstraints,
): Result<void, JarvisError> {
  // ─── 파일시스템 쓰기/삭제/이동 제약 검사 ───
  if (
    actionType === 'FS_WRITE' ||
    actionType === 'FS_DELETE' ||
    actionType === 'FS_MOVE'
  ) {
    const targetPath =
      typeof params['path'] === 'string'
        ? params['path']
        : typeof params['destination'] === 'string'
          ? params['destination']
          : null;

    if (targetPath === null) {
      return err(
        new JarvisError({
          code: ErrorCode.VALIDATION_FAILED,
          message: `${actionType} 액션에 대상 경로(path/destination)가 없습니다.`,
          context: { actionType },
        }),
      );
    }

    // write_deny 패턴과 일치하면 거부
    const isDeniedPath = constraints.fs.write_deny.some((denyPattern) =>
      minimatch(targetPath, denyPattern, { dot: true }),
    );
    if (isDeniedPath) {
      return err(
        new JarvisError({
          code: ErrorCode.POLICY_DENIED,
          message: `경로가 write_deny 제약 조건에 의해 차단되었습니다: ${targetPath}`,
          context: { actionType, targetPath },
        }),
      );
    }

    // write_allow가 비어있지 않으면, 허용 목록 중 하나와 일치해야 함
    if (constraints.fs.write_allow.length > 0) {
      const isAllowedPath = constraints.fs.write_allow.some((allowPattern) =>
        minimatch(targetPath, allowPattern, { dot: true }),
      );
      if (!isAllowedPath) {
        return err(
          new JarvisError({
            code: ErrorCode.POLICY_DENIED,
            message: `경로가 write_allow 허용 범위를 벗어났습니다: ${targetPath}`,
            context: { actionType, targetPath },
          }),
        );
      }
    }
  }

  // ─── 파일시스템 읽기 제약 검사 ───
  if (actionType === 'FS_READ' || actionType === 'FS_LIST') {
    const targetPath =
      typeof params['path'] === 'string' ? params['path'] : null;

    if (targetPath !== null && constraints.fs.read_allow.length > 0) {
      const isAllowedPath = constraints.fs.read_allow.some((allowPattern) =>
        minimatch(targetPath, allowPattern, { dot: true }),
      );
      if (!isAllowedPath) {
        return err(
          new JarvisError({
            code: ErrorCode.POLICY_DENIED,
            message: `경로가 read_allow 허용 범위를 벗어났습니다: ${targetPath}`,
            context: { actionType, targetPath },
          }),
        );
      }
    }
  }

  // ─── 명령 실행 제약 검사 ───
  if (actionType === 'EXEC_RUN') {
    const command =
      typeof params['command'] === 'string' ? params['command'] : null;

    if (command !== null) {
      // deny 목록에 포함된 명령은 거부
      const isDeniedCommand = constraints.exec.deny.some(
        (denied) =>
          command.toLowerCase().startsWith(denied.toLowerCase()),
      );
      if (isDeniedCommand) {
        return err(
          new JarvisError({
            code: ErrorCode.POLICY_DENIED,
            message: `명령이 exec.deny 제약 조건에 의해 차단되었습니다.`,
            context: { actionType },
          }),
        );
      }

      // allow 목록이 있으면, 허용된 명령만 실행 가능
      if (constraints.exec.allow.length > 0) {
        const isAllowedCommand = constraints.exec.allow.some(
          (allowed) =>
            command.toLowerCase().startsWith(allowed.toLowerCase()),
        );
        if (!isAllowedCommand) {
          return err(
            new JarvisError({
              code: ErrorCode.POLICY_DENIED,
              message: `명령이 exec.allow 허용 목록에 없습니다.`,
              context: { actionType },
            }),
          );
        }
      }
    }
  }

  // ─── 네트워크 도메인 제약 검사 ───
  if (
    actionType === 'BROWSER_OPEN_URL' ||
    actionType === 'BROWSER_FETCH' ||
    actionType === 'BROWSER_DOWNLOAD' ||
    actionType === 'BROWSER_UPLOAD' ||
    actionType === 'BROWSER_LOGIN_REQUEST'
  ) {
    const url = typeof params['url'] === 'string' ? params['url'] : null;

    if (url !== null) {
      // URL에서 도메인 추출 (간단한 파싱)
      let domain: string;
      try {
        domain = new URL(url).hostname;
      } catch {
        // URL 파싱 실패 시 차단
        return err(
          new JarvisError({
            code: ErrorCode.VALIDATION_FAILED,
            message: `유효하지 않은 URL 형식입니다.`,
            context: { actionType },
          }),
        );
      }

      // deny_domains 패턴과 일치하면 거부
      const isDeniedDomain = constraints.network.deny_domains.some(
        (denyPattern) =>
          minimatch(domain, denyPattern, { dot: true }),
      );
      if (isDeniedDomain) {
        return err(
          new JarvisError({
            code: ErrorCode.POLICY_DENIED,
            message: `도메인이 network.deny_domains에 의해 차단되었습니다.`,
            context: { actionType },
          }),
        );
      }

      // default_policy가 DENY이고 allow_domains가 비어있으면 모든 네트워크 접근 차단
      if (
        constraints.network.default_policy === 'DENY' &&
        constraints.network.allow_domains.length === 0
      ) {
        return err(
          new JarvisError({
            code: ErrorCode.POLICY_DENIED,
            message: `네트워크 기본 정책이 DENY이며 허용된 도메인이 없습니다.`,
            context: { actionType },
          }),
        );
      }

      // allow_domains가 있으면 허용 목록과 대조
      if (constraints.network.allow_domains.length > 0) {
        const isAllowedDomain = constraints.network.allow_domains.some(
          (allowPattern) =>
            minimatch(domain, allowPattern, { dot: true }),
        );
        if (!isAllowedDomain) {
          return err(
            new JarvisError({
              code: ErrorCode.POLICY_DENIED,
              message: `도메인이 network.allow_domains 허용 목록에 없습니다.`,
              context: { actionType },
            }),
          );
        }
      }
    }
  }

  return ok(undefined);
}

// ─────────────────────────────────────────
// 실행 전 강제 검증 파라미터
// ─────────────────────────────────────────

/** preEnforce 파라미터 */
export interface PreEnforceParams {
  /** 실행 예정 액션 */
  readonly action: Action;
  /** 현재 세션에 발급된 Capability Token 목록 */
  readonly capabilities: CapabilityToken[];
  /** PolicyDecision에서 부과된 제약 조건 */
  readonly constraints: PolicyConstraints;
  /** 현재 시각 (테스트에서 주입 가능) */
  readonly now?: Date;
}

// ─────────────────────────────────────────
// 실행 전 강제 검증
// ─────────────────────────────────────────

/**
 * 액션 실행 전 Capability Token + 제약 조건을 검증한다.
 *
 * 검증 순서:
 * 1. 모바일 액션 — contract.md §4 모바일은 모든 액션에 Gate 필수
 * 2. Gate 필수 액션 태그 확인 (REQUIRES_GATE)
 * 3. 제약 조건 검사 (파일 경로, 명령, 도메인)
 * 4. 필요한 Capability를 만족하는 유효한 Token 검색
 * 5. Token 유효성 검증 (validateToken 위임)
 */
export function preEnforce(
  params: PreEnforceParams,
): Result<EnforcementResult, JarvisError> {
  const { action, capabilities, constraints, now = new Date() } = params;

  // ─── 검증 1: 모바일 액션은 항상 Gate 필수 ───
  // contract.md §4: "모바일은 완전자율 불가 → 강제 제안모드"
  if (isMobileAction(action.type)) {
    if (!action.risk_tags.includes('REQUIRES_GATE')) {
      const result: EnforcementResult = {
        allowed: false,
        reason: `모바일 액션 '${action.type}'은 항상 Gate 승인이 필요합니다 (contract.md §4).`,
        gateRequired: true,
      };
      return ok(result);
    }
  }

  // ─── 검증 2: 제약 조건 검사 ───
  const constraintCheck = checkConstraints(
    action.type,
    action.params,
    constraints,
  );
  if (!constraintCheck.ok) {
    const result: EnforcementResult = {
      allowed: false,
      reason: constraintCheck.error.message,
      gateRequired: false,
    };
    return ok(result);
  }

  // ─── 검증 3: Capability Token 검색 및 검증 ───
  const requiredCap = resolveRequiredCap(action.type);
  const actionScope = resolveActionScope(action);

  // 요청된 Capability를 만족하는 유효한 토큰 탐색
  const matchingToken = capabilities.find((token) => {
    const validationResult = validateToken(
      token,
      requiredCap,
      actionScope,
      now,
    );
    return validationResult.ok;
  });

  if (matchingToken === undefined) {
    // 유효한 토큰이 없는 경우 — Gate를 통해 토큰 발급 필요
    const result: EnforcementResult = {
      allowed: false,
      reason: `액션 '${action.type}'에 대한 유효한 Capability Token (${requiredCap}: ${actionScope})이 없습니다. Gate 승인을 통해 토큰을 발급받으세요.`,
      gateRequired: true,
    };
    return ok(result);
  }

  // 모든 검증 통과
  const result: EnforcementResult = { allowed: true };
  return ok(result);
}

// ─────────────────────────────────────────
// 실행 후 강제 검증 파라미터
// ─────────────────────────────────────────

/** postEnforce 파라미터 */
export interface PostEnforceParams {
  /** 완료된 실행 단계 결과 */
  readonly step: ExecutionStep;
  /** 실행된 액션 원본 */
  readonly action: Action;
  /** 예상 실행 결과 설명 (선택) */
  readonly expectedOutcome?: string;
}

/** 실행 후 검증 결과 */
export interface PostEnforceResult {
  /** 다음 단계 진행 여부 */
  readonly proceed: boolean;
  /** 탐지된 이상 징후 목록 */
  readonly anomalies: string[];
}

// ─────────────────────────────────────────
// 실행 후 이상 징후 탐지
// ─────────────────────────────────────────

/**
 * 액션 실행 후 이상 징후를 탐지한다.
 *
 * 탐지 항목:
 * 1. 실행 결과가 FAILED인 경우 — 에러 코드 분석
 * 2. DENIED 실행 — 권한 우회 시도 가능성
 * 3. 예상 결과와 실제 결과 불일치 (expectedOutcome 지정 시)
 * 4. 비정상적으로 긴 실행 시간 (30초 초과)
 */
export function postEnforce(
  params: PostEnforceParams,
): Result<PostEnforceResult, JarvisError> {
  const { step, action, expectedOutcome } = params;
  const anomalies: string[] = [];

  // ─── 탐지 1: DENIED 실행 — 권한 우회 시도 ───
  if (step.status === 'DENIED') {
    anomalies.push(
      `액션 '${action.action_id}' (${action.type})이 실행 중 DENIED 상태가 되었습니다. 권한 우회 시도 여부를 확인하세요.`,
    );
  }

  // ─── 탐지 2: FAILED 실행 ───
  if (step.status === 'FAILED') {
    const errorInfo =
      step.error !== undefined ? ` 에러: ${step.error}` : '';
    anomalies.push(
      `액션 '${action.action_id}' (${action.type}) 실행 실패.${errorInfo}`,
    );
  }

  // ─── 탐지 3: 비정상적으로 긴 실행 시간 (30초 초과) ───
  const startedAt = new Date(step.started_at).getTime();
  const endedAt = new Date(step.ended_at).getTime();
  const durationMs = endedAt - startedAt;
  const LONG_EXECUTION_THRESHOLD_MS = 30_000;

  if (durationMs > LONG_EXECUTION_THRESHOLD_MS) {
    anomalies.push(
      `액션 '${action.action_id}' (${action.type}) 실행 시간이 비정상적으로 깁니다: ${durationMs}ms (임계값: ${LONG_EXECUTION_THRESHOLD_MS}ms).`,
    );
  }

  // ─── 탐지 4: 예상 결과 불일치 ───
  // expectedOutcome이 지정되었고 실패한 경우 이상 징후로 기록
  if (
    expectedOutcome !== undefined &&
    step.status !== 'SUCCESS'
  ) {
    anomalies.push(
      `예상 결과 '${expectedOutcome}'를 달성하지 못했습니다. 실제 상태: ${step.status}.`,
    );
  }

  // 이상 징후가 DENIED를 포함하거나 2개 이상이면 다음 단계 중단
  const shouldHalt =
    step.status === 'DENIED' ||
    anomalies.length >= 2;

  return ok({
    proceed: !shouldHalt,
    anomalies,
  });
}
