// 액션 실행기 — Pre/Post-Hook 검증 후 OS 추상화 레이어를 통해 액션을 실행
import type { Result, JarvisError, CapabilityToken } from "@jarvis/shared";
import { ok, err, createError, ERROR_CODES, generateRunId } from "@jarvis/shared";
import type {
  ActionRequest,
  ActionResult,
  ActionResultStatus,
  ExecutionTrace,
} from "../types/action-types.js";
import { validatePreExecution } from "../enforcement/pre-hook.js";
import { validatePostExecution } from "../enforcement/post-hook.js";
import type { OsAbstraction } from "../os/os-abstraction.js";
import { createOsAbstraction } from "../os/os-abstraction.js";

// 단일 액션 디스패치 — OS 추상화 레이어로 라우팅
function dispatchAction(
  action: ActionRequest,
  os: OsAbstraction
): Result<Record<string, unknown>, JarvisError> {
  switch (action.actionType) {
    case "FS_READ": {
      const path = action.params["path"];
      if (typeof path !== "string") {
        return err(createError(ERROR_CODES.VALIDATION_FAILED, "FS_READ 파라미터 'path'가 문자열이 아닙니다", { context: { params: action.params } }));
      }
      const result = os.readFile(path);
      if (!result.ok) return err(result.error);
      return ok({ path: result.value.path, content: result.value.content, sizeBytes: result.value.sizeBytes });
    }

    case "FS_WRITE": {
      const path = action.params["path"];
      const content = action.params["content"];
      if (typeof path !== "string" || typeof content !== "string") {
        return err(createError(ERROR_CODES.VALIDATION_FAILED, "FS_WRITE 파라미터 'path' 또는 'content'가 문자열이 아닙니다", { context: { params: action.params } }));
      }
      const result = os.writeFile(path, content);
      if (!result.ok) return err(result.error);
      return ok({ path: result.value.path, bytesWritten: result.value.bytesWritten });
    }

    case "FS_LIST": {
      const path = action.params["path"];
      if (typeof path !== "string") {
        return err(createError(ERROR_CODES.VALIDATION_FAILED, "FS_LIST 파라미터 'path'가 문자열이 아닙니다", { context: { params: action.params } }));
      }
      // Phase 0 스텁 — FS_LIST는 readFile로 대리 처리
      return err(createError(ERROR_CODES.INTERNAL_ERROR, "[Phase 0 스텁] FS_LIST 작업은 Phase 1에서 구현됩니다", { context: { path, phase: "0" } }));
    }

    case "FS_MOVE": {
      const sourcePath = action.params["sourcePath"];
      const destinationPath = action.params["destinationPath"];
      if (typeof sourcePath !== "string" || typeof destinationPath !== "string") {
        return err(createError(ERROR_CODES.VALIDATION_FAILED, "FS_MOVE 파라미터 'sourcePath' 또는 'destinationPath'가 문자열이 아닙니다", { context: { params: action.params } }));
      }
      return err(createError(ERROR_CODES.INTERNAL_ERROR, "[Phase 0 스텁] FS_MOVE 작업은 Phase 1에서 구현됩니다", { context: { sourcePath, destinationPath, phase: "0" } }));
    }

    case "FS_DELETE": {
      const path = action.params["path"];
      if (typeof path !== "string") {
        return err(createError(ERROR_CODES.VALIDATION_FAILED, "FS_DELETE 파라미터 'path'가 문자열이 아닙니다", { context: { params: action.params } }));
      }
      const result = os.deleteFile(path);
      if (!result.ok) return err(result.error);
      return ok({ path: result.value.path, deleted: result.value.deleted });
    }

    case "EXEC_RUN": {
      const command = action.params["command"];
      const cwd = action.params["cwd"];
      if (typeof command !== "string") {
        return err(createError(ERROR_CODES.VALIDATION_FAILED, "EXEC_RUN 파라미터 'command'가 문자열이 아닙니다", { context: { params: action.params } }));
      }
      const cwdStr = typeof cwd === "string" ? cwd : undefined;
      const result = os.executeCommand(command, cwdStr);
      if (!result.ok) return err(result.error);
      return ok({ command: result.value.command, exitCode: result.value.exitCode, stdout: result.value.stdout, stderr: result.value.stderr });
    }

    case "PROCESS_KILL": {
      const pid = action.params["pid"];
      if (typeof pid !== "number") {
        return err(createError(ERROR_CODES.VALIDATION_FAILED, "PROCESS_KILL 파라미터 'pid'가 숫자가 아닙니다", { context: { params: action.params } }));
      }
      return err(createError(ERROR_CODES.INTERNAL_ERROR, "[Phase 0 스텁] PROCESS_KILL 작업은 Phase 1에서 구현됩니다", { context: { pid, phase: "0" } }));
    }

    case "APP_LAUNCH": {
      const appName = action.params["appName"];
      if (typeof appName !== "string") {
        return err(createError(ERROR_CODES.VALIDATION_FAILED, "APP_LAUNCH 파라미터 'appName'이 문자열이 아닙니다", { context: { params: action.params } }));
      }
      const result = os.launchApp(appName);
      if (!result.ok) return err(result.error);
      return ok({ appName: result.value.appName, pid: result.value.pid, launched: result.value.launched });
    }

    // Phase 0 스텁 — 앱/윈도우/브라우저/모바일 액션
    case "APP_FOCUS":
    case "WINDOW_CLICK":
    case "WINDOW_TYPE":
    case "WINDOW_SHORTCUT":
    case "BROWSER_OPEN_URL":
    case "BROWSER_CLICK":
    case "BROWSER_TYPE":
    case "BROWSER_DOWNLOAD":
    case "BROWSER_UPLOAD":
    case "BROWSER_LOGIN_REQUEST":
    case "MOBILE_CONTACT_SEARCH":
    case "MOBILE_CONTACT_READ":
    case "MOBILE_CALL_DIAL":
    case "MOBILE_CALL_END":
    case "MOBILE_CALL_STATUS":
    case "MOBILE_SMS_SEND":
    case "MOBILE_SMS_READ":
    case "MOBILE_MESSENGER_SEND":
    case "MOBILE_MESSENGER_READ":
    case "MOBILE_APP_LAUNCH":
    case "MOBILE_APP_FOCUS":
    case "MOBILE_APP_ACTION":
    case "MOBILE_NOTIFICATION_READ":
    case "MOBILE_NOTIFICATION_DISMISS":
    case "MOBILE_DEVICE_STATUS":
    case "MOBILE_CLIPBOARD_SYNC": {
      return err(
        createError(
          ERROR_CODES.INTERNAL_ERROR,
          `[Phase 0 스텁] ${action.actionType} 액션은 Phase 1에서 구현됩니다`,
          { context: { actionType: action.actionType, phase: "0", stub: true } }
        )
      );
    }
  }
}

// 단일 액션 실행 — Pre-Hook 검증 → 디스패치 → ActionResult 조립
export async function executeAction(
  action: ActionRequest,
  os: OsAbstraction
): Promise<Result<ActionResult, JarvisError>> {
  const startMs = Date.now();

  const dispatchResult = dispatchAction(action, os);
  const durationMs = Date.now() - startMs;

  const status: ActionResultStatus = dispatchResult.ok ? "SUCCESS" : "FAILED";
  const output: Record<string, unknown> | null = dispatchResult.ok ? dispatchResult.value : null;
  const error = dispatchResult.ok
    ? null
    : { code: dispatchResult.error.code, message: dispatchResult.error.message };

  const result: ActionResult = {
    actionId: action.actionId,
    actionType: action.actionType,
    status,
    durationMs,
    output,
    error,
    evidence: {
      screenshotRef: action.evidence.captureScreenshot ? `screenshot_${action.actionId}` : null,
      stdoutRef: action.evidence.captureStdout ? `stdout_${action.actionId}` : null,
    },
  };

  return ok(result);
}

// 배치 액션 실행 — pre-hook → 순차 실행 → post-hook → ExecutionTrace 반환
export async function executeActions(
  actions: readonly ActionRequest[],
  token: CapabilityToken | null,
  os?: OsAbstraction
): Promise<Result<ExecutionTrace, JarvisError>> {
  if (actions.length === 0) {
    return err(
      createError(ERROR_CODES.VALIDATION_FAILED, "실행할 액션이 없습니다", {
        context: { actionCount: 0 },
      })
    );
  }

  // Pre-Hook 검증 — Capability 토큰 및 파라미터 유효성
  const preResult = validatePreExecution(actions, token);
  if (!preResult.ok) {
    return err(preResult.error);
  }

  const osAbstraction = os ?? createOsAbstraction();
  const runId = generateRunId();
  const results: ActionResult[] = [];

  // 순차 실행 — 하나라도 실패하면 중단
  let traceStatus: ExecutionTrace["status"] = "SUCCESS";

  for (const action of actions) {
    const actionResult = await executeAction(action, osAbstraction);
    if (!actionResult.ok) {
      return err(actionResult.error);
    }

    results.push(actionResult.value);

    if (actionResult.value.status !== "SUCCESS") {
      traceStatus = "FAILED";
      break;
    }
  }

  // PARTIAL_SUCCESS 판정 — 일부만 실행된 경우
  if (traceStatus === "SUCCESS" && results.length < actions.length) {
    traceStatus = "PARTIAL_SUCCESS";
  }

  // Post-Hook 검증 — 결과 무결성 및 롤백 필요 여부
  const completedActions = actions.slice(0, results.length);
  const postResult = validatePostExecution(completedActions, results);
  if (!postResult.ok) {
    return err(postResult.error);
  }

  const trace: ExecutionTrace = {
    runId,
    status: traceStatus,
    steps: results,
    redactionsApplied: [],
  };

  return ok(trace);
}
