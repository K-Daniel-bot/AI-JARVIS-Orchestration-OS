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

// 검증 없이 단순 디스패치만 수행 — executeActions() 내부 루프 전용 (Pre-Hook은 배치 단위로 이미 수행)
async function executeActionInternal(
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
      // 디렉토리 목록 조회 — OsAbstraction.listDirectory() 위임
      const path = action.params["path"];
      if (typeof path !== "string") {
        return err(createError(ERROR_CODES.VALIDATION_FAILED, "FS_LIST 파라미터 'path'가 문자열이 아닙니다", { context: { params: action.params } }));
      }
      const result = os.listDirectory(path);
      if (!result.ok) return err(result.error);
      return ok({ path: result.value.path, entries: result.value.entries });
    }

    case "FS_MOVE": {
      // 파일 이동 — OsAbstraction.moveFile() 위임
      const sourcePath = action.params["sourcePath"];
      const destinationPath = action.params["destinationPath"];
      if (typeof sourcePath !== "string" || typeof destinationPath !== "string") {
        return err(createError(ERROR_CODES.VALIDATION_FAILED, "FS_MOVE 파라미터 'sourcePath' 또는 'destinationPath'가 문자열이 아닙니다", { context: { params: action.params } }));
      }
      const result = os.moveFile(sourcePath, destinationPath);
      if (!result.ok) return err(result.error);
      return ok({ sourcePath: result.value.sourcePath, destPath: result.value.destPath });
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
      // 커맨드 길이 및 위험 문자 검증
      if (command.length > 4096) {
        return err(createError(ERROR_CODES.VALIDATION_FAILED, "EXEC_RUN 커맨드 길이가 4096자를 초과합니다", { context: { length: command.length } }));
      }
      const dangerousPatterns = [/;\s*rm\s+-rf\s+\//, /&&\s*rm\s+-rf/, /\|\s*sh\s*$/, /`.*`/, /\$\(.*\)/];
      const hasDangerous = dangerousPatterns.some((p) => p.test(command));
      if (hasDangerous) {
        return err(createError(ERROR_CODES.VALIDATION_FAILED, "EXEC_RUN 커맨드에 위험한 패턴이 포함되어 있습니다", { context: { command: command.slice(0, 100) } }));
      }
      const cwdStr = typeof cwd === "string" ? cwd : undefined;
      const result = os.executeCommand(command, cwdStr);
      if (!result.ok) return err(result.error);
      return ok({ command: result.value.command, exitCode: result.value.exitCode, stdout: result.value.stdout, stderr: result.value.stderr });
    }

    case "PROCESS_KILL": {
      // 프로세스 종료 — OsAbstraction.killProcess() 위임
      const pid = action.params["pid"];
      if (typeof pid !== "number") {
        return err(createError(ERROR_CODES.VALIDATION_FAILED, "PROCESS_KILL 파라미터 'pid'가 숫자가 아닙니다", { context: { params: action.params } }));
      }
      const signal = typeof action.params["signal"] === "string" ? action.params["signal"] : undefined;
      const result = os.killProcess(pid, signal);
      if (!result.ok) return err(result.error);
      return ok({ pid: result.value.pid, signal: result.value.signal, success: result.value.success });
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

    case "APP_FOCUS": {
      // 윈도우 포커스 — 제목 패턴으로 찾아서 전면 전환
      const titlePattern = action.params["titlePattern"];
      if (typeof titlePattern !== "string") {
        return err(createError(ERROR_CODES.VALIDATION_FAILED, "APP_FOCUS 파라미터 'titlePattern'이 문자열이 아닙니다", { context: { params: action.params } }));
      }
      const focusResult = os.focusWindow(titlePattern);
      if (!focusResult.ok) return err(focusResult.error);
      return ok({ titlePattern: focusResult.value.titlePattern, found: focusResult.value.found, processName: focusResult.value.processName, windowTitle: focusResult.value.windowTitle });
    }

    case "WINDOW_TYPE": {
      // 텍스트 입력 — 활성 윈도우에 클립보드 + Ctrl+V
      const text = action.params["text"];
      if (typeof text !== "string") {
        return err(createError(ERROR_CODES.VALIDATION_FAILED, "WINDOW_TYPE 파라미터 'text'가 문자열이 아닙니다", { context: { params: action.params } }));
      }
      const typeResult = os.typeText(text);
      if (!typeResult.ok) return err(typeResult.error);
      return ok({ text: typeResult.value.text, method: typeResult.value.method, success: typeResult.value.success });
    }

    case "WINDOW_CLICK": {
      // 마우스 클릭 — 지정 좌표에 클릭
      const x = action.params["x"];
      const y = action.params["y"];
      if (typeof x !== "number" || typeof y !== "number") {
        return err(createError(ERROR_CODES.VALIDATION_FAILED, "WINDOW_CLICK 파라미터 'x' 또는 'y'가 숫자가 아닙니다", { context: { params: action.params } }));
      }
      const clickResult = os.clickAt(x, y);
      if (!clickResult.ok) return err(clickResult.error);
      return ok({ x: clickResult.value.x, y: clickResult.value.y, clicked: clickResult.value.clicked });
    }

    case "WINDOW_SHORTCUT": {
      // 단축키 전송 — PowerShell SendKeys
      const keys = action.params["keys"];
      if (typeof keys !== "string") {
        return err(createError(ERROR_CODES.VALIDATION_FAILED, "WINDOW_SHORTCUT 파라미터 'keys'가 문자열이 아닙니다", { context: { params: action.params } }));
      }
      const escaped = keys.replace(/'/g, "''");
      const cmdResult = os.executeCommand(`powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('${escaped}')"`);
      if (!cmdResult.ok) return err(cmdResult.error);
      return ok({ keys, sent: true });
    }

    case "SCREENSHOT": {
      // 화면 캡처 — PNG 파일로 저장
      const outputPath = action.params["outputPath"];
      if (typeof outputPath !== "string") {
        return err(createError(ERROR_CODES.VALIDATION_FAILED, "SCREENSHOT 파라미터 'outputPath'가 문자열이 아닙니다", { context: { params: action.params } }));
      }
      const ssResult = os.screenshot(outputPath);
      if (!ssResult.ok) return err(ssResult.error);
      return ok({ outputPath: ssResult.value.outputPath, width: ssResult.value.width, height: ssResult.value.height, sizeBytes: ssResult.value.sizeBytes });
    }

    case "CLIPBOARD_SET": {
      // 클립보드에 텍스트 설정 — PowerShell Set-Clipboard
      const text = action.params["text"];
      if (typeof text !== "string") {
        return err(createError(ERROR_CODES.VALIDATION_FAILED, "CLIPBOARD_SET 파라미터 'text'가 문자열이 아닙니다", { context: { params: action.params } }));
      }
      const escaped = text.replace(/'/g, "''");
      const cmdResult = os.executeCommand(`powershell -NoProfile -Command "Set-Clipboard -Value '${escaped}'"`);
      if (!cmdResult.ok) return err(cmdResult.error);
      return ok({ text, set: true });
    }

    // Phase 0 스텁 — 브라우저/모바일 액션 (Phase 2에서 구현)
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
          `[Phase 0 스텁] ${action.actionType} 액션은 Phase 2에서 구현됩니다`,
          { context: { actionType: action.actionType, phase: "0", stub: true } }
        )
      );
    }
  }
}

// 단일 액션 실행 — Pre-Hook 검증 → 디스패치 → ActionResult 조립
export async function executeAction(
  action: ActionRequest,
  os: OsAbstraction,
  token: CapabilityToken | null = null
): Promise<Result<ActionResult, JarvisError>> {
  // Pre-Hook 검증 — 단일 액션에 대한 Capability 토큰 및 경로 유효성 확인
  const preResult = validatePreExecution([action], token);
  if (!preResult.ok) {
    return err(preResult.error);
  }

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
    // 배치 Pre-Hook은 루프 진입 전에 일괄 수행 완료 — 내부 디스패치만 호출
    const actionResult = await executeActionInternal(action, osAbstraction);
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
