// 액션 타입 정의 — Action API 스키마(action-api.json) 기반

// 파일 시스템 액션 타입
export type FsActionType =
  | "FS_READ"
  | "FS_WRITE"
  | "FS_LIST"
  | "FS_MOVE"
  | "FS_DELETE";

// 프로세스/명령 액션 타입
export type ProcessActionType =
  | "EXEC_RUN"
  | "PROCESS_KILL";

// 앱/윈도우 액션 타입
export type AppActionType =
  | "APP_LAUNCH"
  | "APP_FOCUS"
  | "WINDOW_CLICK"
  | "WINDOW_TYPE"
  | "WINDOW_SHORTCUT";

// 브라우저 액션 타입
export type BrowserActionType =
  | "BROWSER_OPEN_URL"
  | "BROWSER_CLICK"
  | "BROWSER_TYPE"
  | "BROWSER_DOWNLOAD"
  | "BROWSER_UPLOAD"
  | "BROWSER_LOGIN_REQUEST";

// 모바일 액션 타입
export type MobileActionType =
  | "MOBILE_CONTACT_SEARCH"
  | "MOBILE_CONTACT_READ"
  | "MOBILE_CALL_DIAL"
  | "MOBILE_CALL_END"
  | "MOBILE_CALL_STATUS"
  | "MOBILE_SMS_SEND"
  | "MOBILE_SMS_READ"
  | "MOBILE_MESSENGER_SEND"
  | "MOBILE_MESSENGER_READ"
  | "MOBILE_APP_LAUNCH"
  | "MOBILE_APP_FOCUS"
  | "MOBILE_APP_ACTION"
  | "MOBILE_NOTIFICATION_READ"
  | "MOBILE_NOTIFICATION_DISMISS"
  | "MOBILE_DEVICE_STATUS"
  | "MOBILE_CLIPBOARD_SYNC";

// 전체 액션 타입 유니온
export type ActionType =
  | FsActionType
  | ProcessActionType
  | AppActionType
  | BrowserActionType
  | MobileActionType;

// 액션 카테고리 — 대분류
export type ActionCategory =
  | "FILE"
  | "PROCESS"
  | "APP"
  | "BROWSER"
  | "MOBILE";

// 위험 태그 — 액션의 보안 위험 속성
export type RiskTag =
  | "EXECUTION"
  | "FILE_WRITE"
  | "NETWORK"
  | "DESTRUCTIVE"
  | "AUTH"
  | "MOBILE"
  | "PHONE_CALL"
  | "MESSENGER";

// 증거 수집 설정 — 실행 전후 스크린샷/출력 캡처 여부
export interface ActionEvidence {
  readonly captureScreenshot: boolean;
  readonly captureStdout: boolean;
}

// 액션 요청 — 실행 단위의 기본 구조
export interface ActionRequest {
  readonly actionId: string;
  readonly actionType: ActionType;
  readonly params: Record<string, unknown>;
  readonly riskTags: readonly RiskTag[];
  readonly preconditions: readonly string[];
  readonly postconditions: readonly string[];
  readonly evidence: ActionEvidence;
}

// 액션 타입별 카테고리 매핑 헬퍼
export function getActionCategory(actionType: ActionType): ActionCategory {
  const fsTypes: readonly FsActionType[] = [
    "FS_READ",
    "FS_WRITE",
    "FS_LIST",
    "FS_MOVE",
    "FS_DELETE",
  ];
  const processTypes: readonly ProcessActionType[] = [
    "EXEC_RUN",
    "PROCESS_KILL",
  ];
  const appTypes: readonly AppActionType[] = [
    "APP_LAUNCH",
    "APP_FOCUS",
    "WINDOW_CLICK",
    "WINDOW_TYPE",
    "WINDOW_SHORTCUT",
  ];
  const browserTypes: readonly BrowserActionType[] = [
    "BROWSER_OPEN_URL",
    "BROWSER_CLICK",
    "BROWSER_TYPE",
    "BROWSER_DOWNLOAD",
    "BROWSER_UPLOAD",
    "BROWSER_LOGIN_REQUEST",
  ];

  if ((fsTypes as readonly string[]).includes(actionType)) return "FILE";
  if ((processTypes as readonly string[]).includes(actionType)) return "PROCESS";
  if ((appTypes as readonly string[]).includes(actionType)) return "APP";
  if ((browserTypes as readonly string[]).includes(actionType)) return "BROWSER";
  return "MOBILE";
}
