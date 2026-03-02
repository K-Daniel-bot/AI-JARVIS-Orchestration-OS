/**
 * 액션 API — 38가지 ActionType에 대한 생성, 검증, 디스패치 로직
 * Executor 에이전트가 OS 조작 단위인 Action을 생성하고 검증하는 데 사용한다.
 * contract.md §2: 모든 OS 조작은 Capability Token이 부여된 경우에만 실행 가능하다.
 */

import type {
  Action,
  ActionType,
  ActionEvidence,
  Result,
} from '@jarvis/shared';
import {
  ok,
  err,
  JarvisError,
  ErrorCode,
  generateActionId,
  ActionSchema,
} from '@jarvis/shared';

// ─────────────────────────────────────────
// 액션 카테고리 분류
// ─────────────────────────────────────────

/** 액션 카테고리 — 기능 영역별 분류 */
export type ActionCategory = 'FILE' | 'PROCESS' | 'APP' | 'BROWSER' | 'MOBILE';

/**
 * 카테고리별 액션 매핑 — 38가지 ActionType을 5개 카테고리로 분류한다.
 * 각 카테고리는 필요한 권한 범위와 위험도 기준이 다르다.
 */
export const ACTION_CATEGORIES: Record<ActionCategory, readonly ActionType[]> =
  {
    /** 파일시스템 관련 액션 — 읽기/쓰기/목록/이동/삭제 */
    FILE: ['FS_READ', 'FS_WRITE', 'FS_LIST', 'FS_MOVE', 'FS_DELETE'],
    /** 프로세스/명령 실행 액션 — 명령 실행 및 프로세스 종료 */
    PROCESS: ['EXEC_RUN', 'PROCESS_KILL'],
    /** 앱/윈도우 제어 액션 — 앱 실행, 포커스, 클릭, 입력, 단축키 */
    APP: [
      'APP_LAUNCH',
      'APP_FOCUS',
      'WINDOW_CLICK',
      'WINDOW_TYPE',
      'WINDOW_SHORTCUT',
    ],
    /** 웹/브라우저 자동화 액션 — URL 열기, 클릭, 입력, 다운로드, 업로드, 로그인, 요청 */
    BROWSER: [
      'BROWSER_OPEN_URL',
      'BROWSER_CLICK',
      'BROWSER_TYPE',
      'BROWSER_DOWNLOAD',
      'BROWSER_UPLOAD',
      'BROWSER_LOGIN_REQUEST',
      'BROWSER_FETCH',
    ],
    /** 모바일 디바이스 제어 액션 — 연락처, 전화, 문자, 메신저, 앱, 알림, 시스템 */
    MOBILE: [
      'MOBILE_CONTACT_SEARCH',
      'MOBILE_CONTACT_READ',
      'MOBILE_CALL_DIAL',
      'MOBILE_CALL_END',
      'MOBILE_CALL_STATUS',
      'MOBILE_SMS_SEND',
      'MOBILE_SMS_READ',
      'MOBILE_MESSENGER_SEND',
      'MOBILE_MESSENGER_READ',
      'MOBILE_APP_LAUNCH',
      'MOBILE_APP_FOCUS',
      'MOBILE_APP_ACTION',
      'MOBILE_NOTIFICATION_READ',
      'MOBILE_NOTIFICATION_DISMISS',
      'MOBILE_DEVICE_STATUS',
      'MOBILE_CLIPBOARD_SYNC',
    ],
  } as const;

// ─────────────────────────────────────────
// 액션 타입별 기본 증거 수집 설정
// ─────────────────────────────────────────

/**
 * 액션 타입별 기본 증거 수집 설정 — 위험도가 높을수록 증거를 더 많이 수집한다.
 * 파일 삭제, 프로세스 실행, 브라우저 자동화는 스크린샷과 로그를 모두 수집한다.
 */
const DEFAULT_EVIDENCE_SETTINGS: Record<ActionType, ActionEvidence> = {
  // 파일시스템 — 읽기/목록은 최소 증거, 쓰기/이동/삭제는 전체 증거
  FS_READ: { capture_screenshot: false, capture_stdout: true },
  FS_WRITE: { capture_screenshot: false, capture_stdout: true },
  FS_LIST: { capture_screenshot: false, capture_stdout: true },
  FS_MOVE: { capture_screenshot: false, capture_stdout: true },
  FS_DELETE: { capture_screenshot: true, capture_stdout: true },
  // 프로세스 — 모두 전체 증거 수집
  EXEC_RUN: { capture_screenshot: false, capture_stdout: true },
  PROCESS_KILL: { capture_screenshot: true, capture_stdout: true },
  // 앱/윈도우 — 시각적 상호작용이므로 스크린샷 포함
  APP_LAUNCH: { capture_screenshot: true, capture_stdout: false },
  APP_FOCUS: { capture_screenshot: false, capture_stdout: false },
  WINDOW_CLICK: { capture_screenshot: true, capture_stdout: false },
  WINDOW_TYPE: { capture_screenshot: true, capture_stdout: false },
  WINDOW_SHORTCUT: { capture_screenshot: true, capture_stdout: false },
  // 브라우저 — 모두 스크린샷 수집 (시각적 증거 중요)
  BROWSER_OPEN_URL: { capture_screenshot: true, capture_stdout: false },
  BROWSER_CLICK: { capture_screenshot: true, capture_stdout: false },
  BROWSER_TYPE: { capture_screenshot: true, capture_stdout: false },
  BROWSER_DOWNLOAD: { capture_screenshot: true, capture_stdout: true },
  BROWSER_UPLOAD: { capture_screenshot: true, capture_stdout: true },
  BROWSER_LOGIN_REQUEST: { capture_screenshot: true, capture_stdout: false },
  BROWSER_FETCH: { capture_screenshot: false, capture_stdout: true },
  // 모바일 — 연락처/통화/문자는 전체 증거, 상태 조회는 최소
  MOBILE_CONTACT_SEARCH: { capture_screenshot: false, capture_stdout: true },
  MOBILE_CONTACT_READ: { capture_screenshot: false, capture_stdout: true },
  MOBILE_CALL_DIAL: { capture_screenshot: true, capture_stdout: true },
  MOBILE_CALL_END: { capture_screenshot: true, capture_stdout: true },
  MOBILE_CALL_STATUS: { capture_screenshot: false, capture_stdout: true },
  MOBILE_SMS_SEND: { capture_screenshot: true, capture_stdout: true },
  MOBILE_SMS_READ: { capture_screenshot: false, capture_stdout: true },
  MOBILE_MESSENGER_SEND: { capture_screenshot: true, capture_stdout: true },
  MOBILE_MESSENGER_READ: { capture_screenshot: false, capture_stdout: true },
  MOBILE_APP_LAUNCH: { capture_screenshot: true, capture_stdout: false },
  MOBILE_APP_FOCUS: { capture_screenshot: false, capture_stdout: false },
  MOBILE_APP_ACTION: { capture_screenshot: true, capture_stdout: true },
  MOBILE_NOTIFICATION_READ: { capture_screenshot: false, capture_stdout: true },
  MOBILE_NOTIFICATION_DISMISS: {
    capture_screenshot: false,
    capture_stdout: false,
  },
  MOBILE_DEVICE_STATUS: { capture_screenshot: false, capture_stdout: true },
  MOBILE_CLIPBOARD_SYNC: { capture_screenshot: false, capture_stdout: true },
};

// ─────────────────────────────────────────
// 위험 태그 자동 추론
// ─────────────────────────────────────────

/**
 * 액션 타입에서 위험 태그를 자동 추론한다.
 * 위험 태그는 Gate 결정과 감사 로그 분류에 활용된다.
 */
export function inferRiskTags(actionType: ActionType): string[] {
  const tags: string[] = [];

  // 파일 삭제 — 복구 불가 위험 (Gate 필수)
  if (actionType === 'FS_DELETE') {
    tags.push('REQUIRES_GATE', 'DESTRUCTIVE', 'IRREVERSIBLE');
  }

  // 파일 쓰기/이동 — 데이터 변경
  if (actionType === 'FS_WRITE' || actionType === 'FS_MOVE') {
    tags.push('DATA_MODIFICATION');
  }

  // 명령 실행 — 임의 코드 실행 위험 (Gate 필수)
  if (actionType === 'EXEC_RUN') {
    tags.push('REQUIRES_GATE', 'CODE_EXECUTION', 'HIGH_IMPACT');
  }

  // 프로세스 종료 — 서비스 중단 가능 (Gate 필수)
  if (actionType === 'PROCESS_KILL') {
    tags.push('REQUIRES_GATE', 'SERVICE_DISRUPTION');
  }

  // 브라우저 로그인 — 자격증명 관련
  if (actionType === 'BROWSER_LOGIN_REQUEST') {
    tags.push('CREDENTIAL_RELATED', 'REQUIRES_GATE');
  }

  // 브라우저 다운로드/업로드 — 외부 데이터 전송
  if (
    actionType === 'BROWSER_DOWNLOAD' ||
    actionType === 'BROWSER_UPLOAD'
  ) {
    tags.push('DATA_TRANSFER', 'EXTERNAL_NETWORK');
  }

  // 브라우저 네트워크 요청
  if (
    actionType === 'BROWSER_OPEN_URL' ||
    actionType === 'BROWSER_FETCH'
  ) {
    tags.push('EXTERNAL_NETWORK');
  }

  // 모바일 전화 걸기 — 사용자 승인 필수 (contract.md §1)
  if (actionType === 'MOBILE_CALL_DIAL') {
    tags.push('REQUIRES_GATE', 'PHONE_ACTION', 'IRREVERSIBLE');
  }

  // 모바일 문자/메신저 발송 — 외부 통신
  if (
    actionType === 'MOBILE_SMS_SEND' ||
    actionType === 'MOBILE_MESSENGER_SEND'
  ) {
    tags.push('REQUIRES_GATE', 'EXTERNAL_COMMUNICATION');
  }

  // 모바일 연락처 접근 — 개인정보
  if (
    actionType === 'MOBILE_CONTACT_SEARCH' ||
    actionType === 'MOBILE_CONTACT_READ'
  ) {
    tags.push('PII_ACCESS');
  }

  // 모바일 메신저/문자 읽기 — 개인정보
  if (
    actionType === 'MOBILE_SMS_READ' ||
    actionType === 'MOBILE_MESSENGER_READ'
  ) {
    tags.push('PII_ACCESS', 'SENSITIVE_CONTENT');
  }

  // 모바일 클립보드 — 민감 데이터 가능성
  if (actionType === 'MOBILE_CLIPBOARD_SYNC') {
    tags.push('SENSITIVE_CONTENT');
  }

  return tags;
}

// ─────────────────────────────────────────
// 액션 생성 파라미터 타입
// ─────────────────────────────────────────

/** 액션 생성 파라미터 */
export interface CreateActionParams {
  /** 액션 유형 */
  readonly type: ActionType;
  /** 액션 유형별 파라미터 */
  readonly params: Record<string, unknown>;
  /** 필요한 Capability 목록 */
  readonly requiredCapabilities: string[];
  /** 커스텀 위험 태그 (지정하지 않으면 inferRiskTags로 자동 추론) */
  readonly riskTags?: string[];
  /** 실행 전 충족해야 할 전제 조건 */
  readonly preconditions?: string[];
  /** 실행 후 보장되어야 할 후제 조건 */
  readonly postconditions?: string[];
  /** 증거 수집 설정 (지정하지 않으면 기본값 사용) */
  readonly evidence?: ActionEvidence;
}

// ─────────────────────────────────────────
// 액션 생성
// ─────────────────────────────────────────

/**
 * Action 객체를 생성한다.
 * riskTags를 지정하지 않으면 inferRiskTags로 자동 추론한다.
 * evidence를 지정하지 않으면 액션 유형별 기본 설정을 사용한다.
 */
export function createAction(params: CreateActionParams): Action {
  const {
    type,
    params: actionParams,
    requiredCapabilities,
    riskTags,
    preconditions = [],
    postconditions = [],
    evidence,
  } = params;

  // 위험 태그: 명시적 지정 없으면 자동 추론
  const resolvedRiskTags =
    riskTags !== undefined ? riskTags : inferRiskTags(type);

  // 증거 수집: 명시적 지정 없으면 타입별 기본값 사용
  const resolvedEvidence =
    evidence !== undefined ? evidence : DEFAULT_EVIDENCE_SETTINGS[type];

  const action: Action = {
    action_id: generateActionId(),
    type,
    params: actionParams,
    requires_capabilities: requiredCapabilities,
    risk_tags: resolvedRiskTags,
    preconditions,
    postconditions,
    evidence: resolvedEvidence,
  };

  return action;
}

// ─────────────────────────────────────────
// 액션 검증 (실행 전)
// ─────────────────────────────────────────

/**
 * Action 실행 전 유효성을 검증한다.
 * Zod 스키마 검증 + 비즈니스 규칙 검증을 수행한다.
 *
 * 검증 항목:
 * 1. Zod 스키마 구조 검증 (액션 ID 패턴, 필수 필드)
 * 2. requiredCapabilities 비어있지 않음 (최소 1개 Capability 필요)
 * 3. MOBILE_CALL_DIAL, MOBILE_SMS_SEND 등 Gate 필수 액션에 REQUIRES_GATE 태그 확인
 */
export function validateAction(action: Action): Result<void, JarvisError> {
  // ─── 검증 1: Zod 스키마 검증 ───
  const parseResult = ActionSchema.safeParse(action);
  if (!parseResult.success) {
    return err(
      new JarvisError({
        code: ErrorCode.VALIDATION_FAILED,
        message: `Action 스키마 검증 실패: ${parseResult.error.message}`,
        context: {
          action_id: action.action_id,
          errors: parseResult.error.issues,
        },
      }),
    );
  }

  // ─── 검증 2: Capability 누락 확인 ───
  if (action.requires_capabilities.length === 0) {
    return err(
      new JarvisError({
        code: ErrorCode.VALIDATION_FAILED,
        message: `Action '${action.action_id}'에 required_capabilities가 비어 있습니다. 최소 1개 Capability가 필요합니다.`,
        context: { action_id: action.action_id, type: action.type },
      }),
    );
  }

  // ─── 검증 3: Gate 필수 액션 태그 확인 ───
  // contract.md §1: 사용자 승인 없이 전화/문자 전송 절대 금지
  const GATE_REQUIRED_TYPES: readonly ActionType[] = [
    'MOBILE_CALL_DIAL',
    'MOBILE_SMS_SEND',
    'MOBILE_MESSENGER_SEND',
    'BROWSER_LOGIN_REQUEST',
    'FS_DELETE',
    'EXEC_RUN',
    'PROCESS_KILL',
  ];

  if (GATE_REQUIRED_TYPES.includes(action.type)) {
    if (!action.risk_tags.includes('REQUIRES_GATE')) {
      return err(
        new JarvisError({
          code: ErrorCode.VALIDATION_FAILED,
          message: `Action 유형 '${action.type}'은 REQUIRES_GATE 위험 태그가 필수입니다.`,
          context: { action_id: action.action_id, type: action.type },
        }),
      );
    }
  }

  return ok(undefined);
}

// ─────────────────────────────────────────
// 액션 카테고리 조회 유틸리티
// ─────────────────────────────────────────

/**
 * ActionType이 속한 카테고리를 반환한다.
 * 매핑되지 않은 타입이면 undefined를 반환한다.
 */
export function getActionCategory(
  actionType: ActionType,
): ActionCategory | undefined {
  for (const [category, types] of Object.entries(ACTION_CATEGORIES) as [
    ActionCategory,
    readonly ActionType[],
  ][]) {
    if ((types as readonly string[]).includes(actionType)) {
      return category;
    }
  }
  return undefined;
}

/**
 * 액션이 모바일 카테고리인지 확인한다.
 * 모바일 액션은 Companion App 페어링이 필요하다 (contract.md §9).
 */
export function isMobileAction(actionType: ActionType): boolean {
  return getActionCategory(actionType) === 'MOBILE';
}

/**
 * 액션이 Gate를 반드시 요구하는지 확인한다.
 */
export function requiresGate(action: Action): boolean {
  return action.risk_tags.includes('REQUIRES_GATE');
}

