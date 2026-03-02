// Post-Hook 검증 — 액션 실행 후 결과 무결성 검사
import type { Result, JarvisError } from "@jarvis/shared";
import { ok, err, createError, ERROR_CODES } from "@jarvis/shared";
import type { ActionRequest, ActionResult } from "../types/action-types.js";

// Post-Hook 검증 결과
export interface PostHookResult {
  readonly passed: boolean;
  readonly successCount: number;
  readonly failedCount: number;
  readonly needsRollback: boolean;
}

// 단일 액션 실행 결과 검증 — 이상 징후 탐지
export function validateExecutionResult(
  action: ActionRequest,
  result: ActionResult
): Result<true, JarvisError> {
  // 액션 ID 일치 여부 확인
  if (action.actionId !== result.actionId) {
    return err(
      createError(ERROR_CODES.VALIDATION_FAILED, "액션 ID가 일치하지 않습니다", {
        context: {
          expectedActionId: action.actionId,
          actualActionId: result.actionId,
        },
      })
    );
  }

  // 액션 타입 일치 여부 확인
  if (action.actionType !== result.actionType) {
    return err(
      createError(ERROR_CODES.VALIDATION_FAILED, "액션 타입이 일치하지 않습니다", {
        context: {
          expectedType: action.actionType,
          actualType: result.actionType,
        },
      })
    );
  }

  // 실행 시간이 음수인 경우 이상 징후
  if (result.durationMs < 0) {
    return err(
      createError(ERROR_CODES.INTERNAL_ERROR, "실행 시간이 유효하지 않습니다 (음수)", {
        context: { actionId: action.actionId, durationMs: result.durationMs },
      })
    );
  }

  return ok(true);
}

// Post-Hook 배치 검증 실행 — 성공/실패 카운트 및 롤백 필요 여부 반환
export function validatePostExecution(
  actions: readonly ActionRequest[],
  results: readonly ActionResult[]
): Result<PostHookResult, JarvisError> {
  // 액션 수와 결과 수 일치 확인
  if (actions.length !== results.length) {
    return err(
      createError(ERROR_CODES.VALIDATION_FAILED, "액션 수와 실행 결과 수가 일치하지 않습니다", {
        context: { actionCount: actions.length, resultCount: results.length },
      })
    );
  }

  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < actions.length; i++) {
    const action = actions[i];
    const result = results[i];

    // noUncheckedIndexedAccess 대응 — undefined 가드
    if (action === undefined || result === undefined) {
      return err(
        createError(ERROR_CODES.INTERNAL_ERROR, `인덱스 ${i}에서 액션 또는 결과가 없습니다`, {
          context: { index: i },
        })
      );
    }

    const singleResult = validateExecutionResult(action, result);
    if (!singleResult.ok) return err(singleResult.error);

    if (result.status === "SUCCESS") {
      successCount++;
    } else {
      failedCount++;
    }
  }

  // 파괴적 액션이 실패한 경우 롤백 필요 판정
  const hasDestructiveFailure = actions.some((action, i) => {
    const result = results[i];
    if (result === undefined) return false;
    const isDestructive =
      action.actionType === "FS_DELETE" ||
      action.actionType === "FS_MOVE" ||
      action.actionType === "FS_WRITE";
    return isDestructive && result.status === "FAILED";
  });

  return ok({
    passed: true,
    successCount,
    failedCount,
    needsRollback: hasDestructiveFailure,
  });
}

// Post-Hook 검증기 클래스 — ActionExecutor에서 의존성 주입으로 사용
export class PostHookValidator {
  /** 액션과 실행 결과의 무결성 검증 */
  validateAll(
    actions: readonly ActionRequest[],
    results: readonly ActionResult[]
  ): Result<PostHookResult, JarvisError> {
    return validatePostExecution(actions, results);
  }
}
