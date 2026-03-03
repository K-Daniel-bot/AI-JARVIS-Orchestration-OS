// routes/types.ts 헬퍼 함수 단위 테스트 — successResponse / errorResponse 동작 검증

import { describe, it, expect } from "vitest";
import {
  successResponse,
  errorResponse,
} from "./types.js";

// -----------------------------------------------------------------------
// ISO 타임스탬프 검증 헬퍼
// -----------------------------------------------------------------------
function isIsoTimestamp(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
}

// UUID v4 형식 검증 헬퍼
function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(value);
}

// -----------------------------------------------------------------------
// successResponse
// -----------------------------------------------------------------------
describe("successResponse", () => {
  it("should return success: true", () => {
    // Arrange & Act
    const result = successResponse({ key: "value" });

    // Assert
    expect(result.success).toBe(true);
  });

  it("should embed the provided data unchanged", () => {
    // Arrange
    const payload = { id: 42, name: "테스트" };

    // Act
    const result = successResponse(payload);

    // Assert
    expect(result.data).toEqual(payload);
  });

  it("should always set error to null", () => {
    // Arrange & Act
    const result = successResponse("anything");

    // Assert
    expect(result.error).toBeNull();
  });

  it("should include a valid ISO timestamp", () => {
    // Arrange & Act
    const result = successResponse(null);

    // Assert
    expect(isIsoTimestamp(result.timestamp)).toBe(true);
  });

  it("should include a valid UUID v4 requestId", () => {
    // Arrange & Act
    const result = successResponse(null);

    // Assert
    expect(isUuid(result.requestId)).toBe(true);
  });

  it("should generate a unique requestId on each call", () => {
    // Arrange & Act — 두 번 호출
    const r1 = successResponse("payload");
    const r2 = successResponse("payload");

    // Assert
    expect(r1.requestId).not.toBe(r2.requestId);
  });

  it("should handle array payload correctly", () => {
    // Arrange
    const arr = [1, 2, 3];

    // Act
    const result = successResponse(arr);

    // Assert
    expect(result.data).toEqual(arr);
  });

  it("should handle null payload without error", () => {
    // Arrange & Act
    const result = successResponse(null);

    // Assert
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it("should handle nested object payload", () => {
    // Arrange
    const nested = { a: { b: { c: 42 } } };

    // Act
    const result = successResponse(nested);

    // Assert
    expect(result.data).toEqual(nested);
  });

  it("should use current time for timestamp (within 1 second tolerance)", () => {
    // Arrange
    const before = Date.now();

    // Act
    const result = successResponse({});
    const after = Date.now();

    // Assert — timestamp가 현재 시간 범위 안에 있어야 함
    const ts = new Date(result.timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after + 100);
  });
});

// -----------------------------------------------------------------------
// errorResponse
// -----------------------------------------------------------------------
describe("errorResponse", () => {
  it("should return success: false", () => {
    // Arrange & Act
    const result = errorResponse("VALIDATION_FAILED", "입력값이 잘못되었습니다");

    // Assert
    expect(result.success).toBe(false);
  });

  it("should always set data to null", () => {
    // Arrange & Act
    const result = errorResponse("NOT_FOUND", "리소스 없음");

    // Assert
    expect(result.data).toBeNull();
  });

  it("should include the provided error code", () => {
    // Arrange
    const code = "RESOURCE_EXHAUSTED";

    // Act
    const result = errorResponse(code, "리소스 한계 초과");

    // Assert
    expect(result.error.code).toBe(code);
  });

  it("should include the provided error message", () => {
    // Arrange
    const message = "요청한 게이트를 찾을 수 없습니다";

    // Act
    const result = errorResponse("NOT_FOUND", message);

    // Assert
    expect(result.error.message).toBe(message);
  });

  it("should include a valid ISO timestamp", () => {
    // Arrange & Act
    const result = errorResponse("INTERNAL_ERROR", "서버 내부 오류");

    // Assert
    expect(isIsoTimestamp(result.timestamp)).toBe(true);
  });

  it("should include a valid UUID v4 requestId", () => {
    // Arrange & Act
    const result = errorResponse("TIMEOUT", "요청 시간 초과");

    // Assert
    expect(isUuid(result.requestId)).toBe(true);
  });

  it("should generate a unique requestId on each call", () => {
    // Arrange & Act
    const r1 = errorResponse("ERR", "메시지1");
    const r2 = errorResponse("ERR", "메시지2");

    // Assert
    expect(r1.requestId).not.toBe(r2.requestId);
  });

  it("should handle empty string error message gracefully", () => {
    // Arrange & Act
    const result = errorResponse("UNKNOWN", "");

    // Assert
    expect(result.success).toBe(false);
    expect(result.error.code).toBe("UNKNOWN");
    expect(result.error.message).toBe("");
  });

  it("should use current time for timestamp (within 1 second tolerance)", () => {
    // Arrange
    const before = Date.now();

    // Act
    const result = errorResponse("ERR", "오류");
    const after = Date.now();

    // Assert
    const ts = new Date(result.timestamp).getTime();
    expect(ts).toBeGreaterThanOrEqual(before);
    expect(ts).toBeLessThanOrEqual(after + 100);
  });
});

// -----------------------------------------------------------------------
// successResponse / errorResponse — 응답 형태 구조 검증 (타입 호환성)
// -----------------------------------------------------------------------
describe("ApiResponse 구조 공통 검증", () => {
  it("successResponse 결과에는 success, data, error, timestamp, requestId 필드가 있어야 한다", () => {
    // Arrange & Act
    const result = successResponse({ test: true });

    // Assert
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("error");
    expect(result).toHaveProperty("timestamp");
    expect(result).toHaveProperty("requestId");
  });

  it("errorResponse 결과에는 success, data, error, timestamp, requestId 필드가 있어야 한다", () => {
    // Arrange & Act
    const result = errorResponse("ERR_CODE", "오류 메시지");

    // Assert
    expect(result).toHaveProperty("success");
    expect(result).toHaveProperty("data");
    expect(result).toHaveProperty("error");
    expect(result).toHaveProperty("timestamp");
    expect(result).toHaveProperty("requestId");
  });

  it("errorResponse의 error 객체에는 code와 message 필드가 있어야 한다", () => {
    // Arrange & Act
    const result = errorResponse("ERR_CODE", "오류 메시지");

    // Assert
    expect(result.error).toHaveProperty("code");
    expect(result.error).toHaveProperty("message");
  });

  it("successResponse와 errorResponse의 success 값은 서로 반대여야 한다", () => {
    // Arrange & Act
    const ok = successResponse({});
    const err = errorResponse("ERR", "오류");

    // Assert
    expect(ok.success).toBe(true);
    expect(err.success).toBe(false);
  });
});
