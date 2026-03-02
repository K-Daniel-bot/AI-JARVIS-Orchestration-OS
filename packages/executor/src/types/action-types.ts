// 액션 타입 정의 — action-api.json 스키마 기반 (요구사항 스펙)

// 파일/프로젝트 액션
export type FsActionType = "FS_READ" | "FS_WRITE" | "FS_LIST" | "FS_MOVE" | "FS_DELETE";

// 프로세스/명령 액션
export type ExecActionType = "EXEC_RUN" | "PROCESS_KILL";

// 앱/윈도우 액션
export type AppActionType =
  | "APP_LAUNCH"
  | "APP_FOCUS"
  | "WINDOW_CLICK"
  | "WINDOW_TYPE"
  | "WINDOW_SHORTCUT";

// 웹/브라우저 액션
export type BrowserActionType =
  | "BROWSER_OPEN_URL"
  | "BROWSER_CLICK"
  | "BROWSER_TYPE"
  | "BROWSER_DOWNLOAD"
  | "BROWSER_UPLOAD"
  | "BROWSER_LOGIN_REQUEST";

// 모바일 액션
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

// 전체 액션 타입
export type ActionType =
  | FsActionType
  | ExecActionType
  | AppActionType
  | BrowserActionType
  | MobileActionType;

// 리스크 태그
export type RiskTag =
  | "EXECUTION"
  | "FILE_WRITE"
  | "NETWORK"
  | "DESTRUCTIVE"
  | "AUTH"
  | "MOBILE"
  | "PHONE_CALL"
  | "MESSENGER";

// 액션 요청
export interface ActionRequest {
  readonly actionId: string;
  readonly actionType: ActionType;
  readonly params: Record<string, unknown>;
  readonly requiresCapabilities: readonly string[];
  readonly riskTags: readonly RiskTag[];
  readonly preconditions: readonly string[];
  readonly postconditions: readonly string[];
  readonly evidence: {
    readonly captureScreenshot: boolean;
    readonly captureStdout: boolean;
  };
}

// 실행 결과 상태
export type ActionResultStatus = "SUCCESS" | "FAILED" | "DENIED" | "SKIPPED";

// 액션 실행 결과
export interface ActionResult {
  readonly actionId: string;
  readonly actionType: ActionType;
  readonly status: ActionResultStatus;
  readonly durationMs: number;
  readonly output: Record<string, unknown> | null;
  readonly error: { readonly code: string; readonly message: string } | null;
  readonly evidence: {
    readonly screenshotRef: string | null;
    readonly stdoutRef: string | null;
  };
}

// 실행 트레이스 상태
export type ExecutionTraceStatus = "SUCCESS" | "PARTIAL_SUCCESS" | "FAILED" | "ABORTED";

// 실행 트레이스
export interface ExecutionTrace {
  readonly runId: string;
  readonly status: ExecutionTraceStatus;
  readonly steps: readonly ActionResult[];
  readonly redactionsApplied: readonly string[];
}
