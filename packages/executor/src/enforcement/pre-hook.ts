// Pre-Hook — 액션 실행 직전 보안 검증
import type { Result, JarvisError, CapabilityToken, CapabilityType } from "@jarvis/shared";
import { ok, err, createError, ERROR_CODES, isExpired } from "@jarvis/shared";
import type { ActionRequest, ActionType } from "../types/action-types.js";

// 액션 타입 → 필요 Capability 매핑
const ACTION_CAPABILITY_MAP: Readonly<Record<ActionType, CapabilityType>> = {
  FS_READ: "fs.read",
  FS_WRITE: "fs.write",
  FS_LIST: "fs.read",
  FS_MOVE: "fs.write",
  FS_DELETE: "fs.write",
  EXEC_RUN: "exec.run",
  PROCESS_KILL: "process.kill",
  APP_LAUNCH: "app.launch",
  APP_FOCUS: "app.launch",
  WINDOW_CLICK: "app.launch",
  WINDOW_TYPE: "app.launch",
  WINDOW_SHORTCUT: "app.launch",
  BROWSER_OPEN_URL: "browser.navigate",
  BROWSER_CLICK: "browser.navigate",
  BROWSER_TYPE: "browser.navigate",
  BROWSER_DOWNLOAD: "browser.download",
  BROWSER_UPLOAD: "browser.navigate",
  BROWSER_LOGIN_REQUEST: "browser.navigate",
  MOBILE_CONTACT_SEARCH: "mobile.contact.read",
  MOBILE_CONTACT_READ: "mobile.contact.read",
  MOBILE_CALL_DIAL: "mobile.call.dial",
  MOBILE_CALL_END: "mobile.call.dial",
  MOBILE_CALL_STATUS: "mobile.call.dial",
  MOBILE_SMS_SEND: "mobile.sms.send",
  MOBILE_SMS_READ: "mobile.sms.read",
  MOBILE_MESSENGER_SEND: "mobile.messenger.send",
  MOBILE_MESSENGER_READ: "mobile.messenger.read",
  MOBILE_APP_LAUNCH: "mobile.app.control",
  MOBILE_APP_FOCUS: "mobile.app.control",
  MOBILE_APP_ACTION: "mobile.app.control",
  MOBILE_NOTIFICATION_READ: "mobile.notification.read",
  MOBILE_NOTIFICATION_DISMISS: "mobile.notification.read",
  MOBILE_DEVICE_STATUS: "mobile.app.control",
  MOBILE_CLIPBOARD_SYNC: "clipboard.write",
};

// 경로 탐색 공격 방어를 위한 위험 패턴
const PATH_TRAVERSAL_PATTERNS: readonly RegExp[] = [
  /\.\./,
  /\/etc\//,
  /\/proc\//,
  /\/sys\//,
  /\/dev\//,
  /~\//,
];

// EXEC_RUN 허용 명령어 allowlist
const ALLOWED_COMMANDS: readonly string[] = [
  "pnpm",
  "npm",
  "node",
  "tsc",
  "vitest",
  "eslint",
  "git",
  "ls",
  "cat",
  "echo",
  "mkdir",
  "rm",
  "cp",
  "mv",
];

// Pre-Hook 검증 결과
export interface PreHookResult {
  readonly passed: boolean;
  readonly checkedActions: number;
  readonly failedAction: string | null;
}

// Capability 토큰이 액션에 필요한 권한을 보유하는지 검증
export function validateCapabilityForAction(
  token: CapabilityToken,
  actionType: ActionType
): Result<true, JarvisError> {
  // 토큰 상태 검사
  if (token.status !== "ACTIVE") {
    return err(
      createError(ERROR_CODES.CAPABILITY_CONSUMED, `토큰 상태가 유효하지 않습니다: ${token.status}`, {
        context: { tokenId: token.tokenId, status: token.status },
      })
    );
  }

  // TTL 만료 검사
  if (isExpired(token.issuedAt, token.grant.ttlSeconds)) {
    return err(
      createError(ERROR_CODES.CAPABILITY_EXPIRED, "Capability 토큰이 만료되었습니다", {
        context: { tokenId: token.tokenId, issuedAt: token.issuedAt, ttlSeconds: token.grant.ttlSeconds },
      })
    );
  }

  // 필요 Capability 확인
  const requiredCap = ACTION_CAPABILITY_MAP[actionType];
  if (token.grant.cap !== requiredCap) {
    return err(
      createError(
        ERROR_CODES.CAPABILITY_SCOPE_MISMATCH,
        `액션 '${actionType}'에 필요한 권한이 없습니다 (필요: ${requiredCap}, 보유: ${token.grant.cap})`,
        { context: { actionType, required: requiredCap, granted: token.grant.cap } }
      )
    );
  }

  return ok(true);
}

// 파일 경로 검증 — Path traversal 방어 및 절대 경로 강제
export function validateFilePath(
  path: string,
  operation: "read" | "write"
): Result<true, JarvisError> {
  for (const pattern of PATH_TRAVERSAL_PATTERNS) {
    if (pattern.test(path)) {
      return err(
        createError(ERROR_CODES.VALIDATION_FAILED, `경로에 위험한 패턴이 포함되어 있습니다: ${path}`, {
          context: { path, operation, pattern: pattern.toString() },
        })
      );
    }
  }

  // 절대 경로 필수 (상대 경로 거부)
  if (!path.startsWith("/") && !path.match(/^[A-Za-z]:\\/)) {
    return err(
      createError(ERROR_CODES.VALIDATION_FAILED, `절대 경로를 사용해야 합니다: ${path}`, {
        context: { path, operation },
      })
    );
  }

  return ok(true);
}

// 명령어 allowlist 검사 — EXEC_RUN 보안 제한
export function validateCommand(command: string): Result<true, JarvisError> {
  if (!command || command.trim().length === 0) {
    return err(
      createError(ERROR_CODES.VALIDATION_FAILED, "명령어가 비어 있습니다", {
        context: { command },
      })
    );
  }

  const firstToken = command.trim().split(/\s+/)[0] ?? "";
  const isAllowed = ALLOWED_COMMANDS.some(
    (allowed) => firstToken === allowed || firstToken.endsWith(`/${allowed}`)
  );

  if (!isAllowed) {
    return err(
      createError(ERROR_CODES.POLICY_DENIED, `허용되지 않은 명령어입니다: ${firstToken}`, {
        context: { command, firstToken, allowlist: ALLOWED_COMMANDS },
      })
    );
  }

  return ok(true);
}

// Pre-Hook 검증 실행 — 액션 목록과 토큰을 받아 종합 검증
export function validatePreExecution(
  actions: readonly ActionRequest[],
  token: CapabilityToken | null
): Result<PreHookResult, JarvisError> {
  // 토큰 존재 확인
  if (!token) {
    return err(createError(ERROR_CODES.CAPABILITY_EXPIRED, "Capability 토큰이 제공되지 않았습니다"));
  }

  for (const action of actions) {
    // Capability 검증
    const capResult = validateCapabilityForAction(token, action.actionType);
    if (!capResult.ok) {
      return err(capResult.error);
    }

    // 파일 경로 검증 (읽기 액션)
    if (action.actionType === "FS_READ" || action.actionType === "FS_LIST") {
      const pathParam = action.params["path"];
      if (typeof pathParam === "string") {
        const pathResult = validateFilePath(pathParam, "read");
        if (!pathResult.ok) return err(pathResult.error);
      }
    }

    // 파일 경로 검증 (쓰기 액션)
    if (
      action.actionType === "FS_WRITE" ||
      action.actionType === "FS_MOVE" ||
      action.actionType === "FS_DELETE"
    ) {
      const pathParam = action.params["path"];
      if (typeof pathParam === "string") {
        const pathResult = validateFilePath(pathParam, "write");
        if (!pathResult.ok) return err(pathResult.error);
      }
    }

    // 명령어 allowlist 검증 (프로세스 실행)
    if (action.actionType === "EXEC_RUN") {
      const commandParam = action.params["command"];
      if (typeof commandParam === "string") {
        const cmdResult = validateCommand(commandParam);
        if (!cmdResult.ok) return err(cmdResult.error);
      }
    }
  }

  return ok({ passed: true, checkedActions: actions.length, failedAction: null });
}

// Pre-Hook 검증기 클래스 — ActionExecutor에서 의존성 주입으로 사용
export class PreHookValidator {
  /** 액션 목록과 토큰에 대한 종합 검증 */
  validateAll(
    actions: readonly ActionRequest[],
    token: CapabilityToken | null
  ): Result<PreHookResult, JarvisError> {
    return validatePreExecution(actions, token);
  }
}
