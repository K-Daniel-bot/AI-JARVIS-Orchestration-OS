// 에러 타입 단위 테스트
import { describe, it, expect } from "vitest";
import { ERROR_CODES, createError } from "./errors.js";
import type { ErrorCode } from "./errors.js";

describe("ERROR_CODES", () => {
  it("should define 16 error codes", () => {
    expect(Object.keys(ERROR_CODES)).toHaveLength(16);
  });

  it("should include all required error codes", () => {
    expect(ERROR_CODES.AGENT_TIMEOUT).toBe("AGENT_TIMEOUT");
    expect(ERROR_CODES.VALIDATION_FAILED).toBe("VALIDATION_FAILED");
    expect(ERROR_CODES.POLICY_DENIED).toBe("POLICY_DENIED");
    expect(ERROR_CODES.CAPABILITY_EXPIRED).toBe("CAPABILITY_EXPIRED");
    expect(ERROR_CODES.CAPABILITY_CONSUMED).toBe("CAPABILITY_CONSUMED");
    expect(ERROR_CODES.AUDIT_INTEGRITY_VIOLATION).toBe("AUDIT_INTEGRITY_VIOLATION");
    expect(ERROR_CODES.STATE_TRANSITION_INVALID).toBe("STATE_TRANSITION_INVALID");
    expect(ERROR_CODES.LOOP_LIMIT_EXCEEDED).toBe("LOOP_LIMIT_EXCEEDED");
  });
});

describe("createError()", () => {
  it("should create error with required fields", () => {
    const error = createError("VALIDATION_FAILED", "invalid input");
    expect(error.code).toBe("VALIDATION_FAILED");
    expect(error.message).toBe("invalid input");
    expect(error.timestamp).toBeTruthy();
  });

  it("should include ISO timestamp", () => {
    const before = new Date().toISOString();
    const error = createError("INTERNAL_ERROR", "test");
    const after = new Date().toISOString();
    expect(error.timestamp >= before).toBe(true);
    expect(error.timestamp <= after).toBe(true);
  });

  it("should include optional agentId and runId", () => {
    const error = createError("AGENT_TIMEOUT", "timeout", {
      agentId: "orchestrator",
      runId: "run_20260302_abc123",
    });
    expect(error.agentId).toBe("orchestrator");
    expect(error.runId).toBe("run_20260302_abc123");
  });

  it("should include optional context", () => {
    const error = createError("RESOURCE_EXHAUSTED", "memory limit", {
      context: { limit: 1024, used: 2048 },
    });
    expect(error.context).toEqual({ limit: 1024, used: 2048 });
  });

  it("should leave optional fields undefined when not provided", () => {
    const error = createError("INTERNAL_ERROR", "test");
    expect(error.agentId).toBeUndefined();
    expect(error.runId).toBeUndefined();
    expect(error.context).toBeUndefined();
  });

  it("should accept all valid error codes", () => {
    const codes = Object.values(ERROR_CODES);
    for (const code of codes) {
      const error = createError(code as ErrorCode, `test ${code}`);
      expect(error.code).toBe(code);
    }
  });
});
