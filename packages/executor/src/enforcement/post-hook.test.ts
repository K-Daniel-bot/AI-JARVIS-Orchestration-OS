// Post-Hook 결과 무결성 검증 단위 테스트 — 액션 실행 후 이상 징후 탐지 경로를 검증

import { describe, it, expect } from "vitest";
import {
  validateExecutionResult,
  validatePostExecution,
} from "./post-hook.js";
import type { ActionRequest, ActionResult, ActionType } from "../types/action-types.js";

// 테스트용 ActionRequest mock 생성 헬퍼
function makeAction(
  actionId: string,
  actionType: ActionType,
  params: Record<string, unknown> = {}
): ActionRequest {
  return {
    actionId,
    actionType,
    params,
    requiresCapabilities: [],
    riskTags: [],
    preconditions: [],
    postconditions: [],
    evidence: {
      captureScreenshot: false,
      captureStdout: false,
    },
  };
}

// 테스트용 ActionResult mock 생성 헬퍼
function makeResult(
  actionId: string,
  actionType: ActionType,
  overrides?: Partial<ActionResult>
): ActionResult {
  return {
    actionId,
    actionType,
    status: "SUCCESS",
    durationMs: 100,
    output: { message: "ok" },
    error: null,
    evidence: {
      screenshotRef: null,
      stdoutRef: null,
    },
    ...overrides,
  };
}

// ──────────────────────────────────────────────
// validateExecutionResult 테스트
// ──────────────────────────────────────────────
describe("validateExecutionResult", () => {
  it("정상 결과 (ID 일치, 타입 일치, 유효 시간, 출력 있음)는 ok(true)를 반환해야 한다", () => {
    // Arrange
    const action = makeAction("action-001", "FS_READ", { path: "/project/src/index.ts" });
    const result = makeResult("action-001", "FS_READ");

    // Act
    const validationResult = validateExecutionResult(action, result);

    // Assert
    expect(validationResult.ok).toBe(true);
    if (validationResult.ok) {
      expect(validationResult.value).toBe(true);
    }
  });

  it("액션 ID 불일치 시 VALIDATION_FAILED 에러를 반환해야 한다", () => {
    // Arrange
    const action = makeAction("action-001", "FS_READ");
    const result = makeResult("action-999", "FS_READ"); // ID 불일치

    // Act
    const validationResult = validateExecutionResult(action, result);

    // Assert
    expect(validationResult.ok).toBe(false);
    if (!validationResult.ok) {
      expect(validationResult.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("액션 타입 불일치 시 VALIDATION_FAILED 에러를 반환해야 한다", () => {
    // Arrange
    const action = makeAction("action-001", "FS_READ");
    const result = makeResult("action-001", "FS_WRITE"); // 타입 불일치

    // Act
    const validationResult = validateExecutionResult(action, result);

    // Assert
    expect(validationResult.ok).toBe(false);
    if (!validationResult.ok) {
      expect(validationResult.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("음수 실행 시간은 INTERNAL_ERROR 에러를 반환해야 한다", () => {
    // Arrange
    const action = makeAction("action-001", "FS_READ");
    const result = makeResult("action-001", "FS_READ", { durationMs: -1 });

    // Act
    const validationResult = validateExecutionResult(action, result);

    // Assert
    expect(validationResult.ok).toBe(false);
    if (!validationResult.ok) {
      expect(validationResult.error.code).toBe("INTERNAL_ERROR");
    }
  });

  it("실행 시간이 300,000ms(5분) 상한을 초과하면 VALIDATION_FAILED 에러를 반환해야 한다", () => {
    // Arrange
    const action = makeAction("action-001", "EXEC_RUN");
    const result = makeResult("action-001", "EXEC_RUN", { durationMs: 300_001 });

    // Act
    const validationResult = validateExecutionResult(action, result);

    // Assert
    expect(validationResult.ok).toBe(false);
    if (!validationResult.ok) {
      expect(validationResult.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("정확히 300,000ms는 허용 범위 내로 ok(true)를 반환해야 한다", () => {
    // Arrange — 상한과 정확히 동일한 값은 초과가 아님
    const action = makeAction("action-001", "EXEC_RUN");
    const result = makeResult("action-001", "EXEC_RUN", { durationMs: 300_000 });

    // Act
    const validationResult = validateExecutionResult(action, result);

    // Assert
    expect(validationResult.ok).toBe(true);
  });

  it("SUCCESS 상태인데 output이 null이면 VALIDATION_FAILED 에러를 반환해야 한다", () => {
    // Arrange
    const action = makeAction("action-001", "FS_READ");
    const result = makeResult("action-001", "FS_READ", { status: "SUCCESS", output: null });

    // Act
    const validationResult = validateExecutionResult(action, result);

    // Assert
    expect(validationResult.ok).toBe(false);
    if (!validationResult.ok) {
      expect(validationResult.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("FAILED 상태에서 output이 null이어도 ok(true)를 반환해야 한다", () => {
    // Arrange — 실패 상태에서는 output null이 정상
    const action = makeAction("action-001", "FS_WRITE");
    const result = makeResult("action-001", "FS_WRITE", {
      status: "FAILED",
      output: null,
      error: { code: "IO_ERROR", message: "파일 쓰기 실패" },
    });

    // Act
    const validationResult = validateExecutionResult(action, result);

    // Assert
    expect(validationResult.ok).toBe(true);
  });

  it("durationMs가 0이면 ok(true)를 반환해야 한다", () => {
    // Arrange — 즉시 완료된 경우
    const action = makeAction("action-001", "FS_LIST");
    const result = makeResult("action-001", "FS_LIST", { durationMs: 0 });

    // Act
    const validationResult = validateExecutionResult(action, result);

    // Assert
    expect(validationResult.ok).toBe(true);
  });
});

// ──────────────────────────────────────────────
// validatePostExecution 테스트
// ──────────────────────────────────────────────
describe("validatePostExecution", () => {
  it("정상 배치 (2개 성공)는 passed: true, successCount: 2, failedCount: 0, needsRollback: false를 반환해야 한다", () => {
    // Arrange
    const actions = [
      makeAction("action-001", "FS_READ", { path: "/project/src/a.ts" }),
      makeAction("action-002", "FS_READ", { path: "/project/src/b.ts" }),
    ];
    const results = [
      makeResult("action-001", "FS_READ"),
      makeResult("action-002", "FS_READ"),
    ];

    // Act
    const batchResult = validatePostExecution(actions, results);

    // Assert
    expect(batchResult.ok).toBe(true);
    if (batchResult.ok) {
      expect(batchResult.value.passed).toBe(true);
      expect(batchResult.value.successCount).toBe(2);
      expect(batchResult.value.failedCount).toBe(0);
      expect(batchResult.value.needsRollback).toBe(false);
    }
  });

  it("일부 실패 (1 성공, 1 실패)는 successCount: 1, failedCount: 1을 반환해야 한다", () => {
    // Arrange
    const actions = [
      makeAction("action-001", "FS_READ", { path: "/project/src/a.ts" }),
      makeAction("action-002", "FS_READ", { path: "/project/src/b.ts" }),
    ];
    const results = [
      makeResult("action-001", "FS_READ"),
      makeResult("action-002", "FS_READ", {
        status: "FAILED",
        output: null,
        error: { code: "NOT_FOUND", message: "파일 없음" },
      }),
    ];

    // Act
    const batchResult = validatePostExecution(actions, results);

    // Assert
    expect(batchResult.ok).toBe(true);
    if (batchResult.ok) {
      expect(batchResult.value.successCount).toBe(1);
      expect(batchResult.value.failedCount).toBe(1);
    }
  });

  it("파괴적 액션(FS_DELETE) 실패 시 needsRollback: true를 반환해야 한다", () => {
    // Arrange
    const actions = [
      makeAction("action-001", "FS_DELETE", { path: "/project/src/old-file.ts" }),
    ];
    const results = [
      makeResult("action-001", "FS_DELETE", {
        status: "FAILED",
        output: null,
        error: { code: "PERMISSION_DENIED", message: "삭제 권한 없음" },
      }),
    ];

    // Act
    const batchResult = validatePostExecution(actions, results);

    // Assert
    expect(batchResult.ok).toBe(true);
    if (batchResult.ok) {
      expect(batchResult.value.needsRollback).toBe(true);
    }
  });

  it("파괴적 액션(FS_WRITE) 실패 시 needsRollback: true를 반환해야 한다", () => {
    // Arrange
    const actions = [
      makeAction("action-001", "FS_WRITE", { path: "/project/src/new-file.ts" }),
    ];
    const results = [
      makeResult("action-001", "FS_WRITE", {
        status: "FAILED",
        output: null,
        error: { code: "IO_ERROR", message: "쓰기 실패" },
      }),
    ];

    // Act
    const batchResult = validatePostExecution(actions, results);

    // Assert
    expect(batchResult.ok).toBe(true);
    if (batchResult.ok) {
      expect(batchResult.value.needsRollback).toBe(true);
    }
  });

  it("비파괴적 액션(FS_READ) 실패 시 needsRollback: false를 반환해야 한다", () => {
    // Arrange
    const actions = [
      makeAction("action-001", "FS_READ", { path: "/project/src/index.ts" }),
    ];
    const results = [
      makeResult("action-001", "FS_READ", {
        status: "FAILED",
        output: null,
        error: { code: "NOT_FOUND", message: "파일 없음" },
      }),
    ];

    // Act
    const batchResult = validatePostExecution(actions, results);

    // Assert
    expect(batchResult.ok).toBe(true);
    if (batchResult.ok) {
      expect(batchResult.value.needsRollback).toBe(false);
    }
  });

  it("액션 수와 결과 수가 다르면 VALIDATION_FAILED 에러를 반환해야 한다", () => {
    // Arrange — 액션 2개, 결과 1개
    const actions = [
      makeAction("action-001", "FS_READ"),
      makeAction("action-002", "FS_READ"),
    ];
    const results = [
      makeResult("action-001", "FS_READ"),
    ];

    // Act
    const batchResult = validatePostExecution(actions, results);

    // Assert
    expect(batchResult.ok).toBe(false);
    if (!batchResult.ok) {
      expect(batchResult.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("빈 배열 쌍은 passed: true, successCount: 0, needsRollback: false를 반환해야 한다", () => {
    // Arrange & Act
    const batchResult = validatePostExecution([], []);

    // Assert
    expect(batchResult.ok).toBe(true);
    if (batchResult.ok) {
      expect(batchResult.value.passed).toBe(true);
      expect(batchResult.value.successCount).toBe(0);
      expect(batchResult.value.failedCount).toBe(0);
      expect(batchResult.value.needsRollback).toBe(false);
    }
  });

  it("FS_MOVE 파괴적 액션 실패 시 needsRollback: true를 반환해야 한다", () => {
    // Arrange
    const actions = [
      makeAction("action-001", "FS_MOVE", { path: "/project/src/index.ts" }),
    ];
    const results = [
      makeResult("action-001", "FS_MOVE", {
        status: "FAILED",
        output: null,
        error: { code: "IO_ERROR", message: "이동 실패" },
      }),
    ];

    // Act
    const batchResult = validatePostExecution(actions, results);

    // Assert
    expect(batchResult.ok).toBe(true);
    if (batchResult.ok) {
      expect(batchResult.value.needsRollback).toBe(true);
    }
  });
});
