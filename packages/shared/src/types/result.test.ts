// Result<T, E> 패턴 단위 테스트
import { describe, it, expect } from "vitest";
import { ok, err, isOk, isErr, unwrapOr, mapResult, flatMap } from "./result.js";

describe("Result 패턴", () => {
  describe("ok()", () => {
    it("should create a success result with value", () => {
      const result = ok(42);
      expect(result).toEqual({ ok: true, value: 42 });
    });

    it("should handle string values", () => {
      const result = ok("hello");
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe("hello");
      }
    });

    it("should handle object values", () => {
      const data = { name: "test", count: 1 };
      const result = ok(data);
      if (result.ok) {
        expect(result.value).toEqual(data);
      }
    });

    it("should handle null and undefined values", () => {
      expect(ok(null)).toEqual({ ok: true, value: null });
      expect(ok(undefined)).toEqual({ ok: true, value: undefined });
    });
  });

  describe("err()", () => {
    it("should create a failure result with error", () => {
      const result = err("something went wrong");
      expect(result).toEqual({ ok: false, error: "something went wrong" });
    });

    it("should handle error objects", () => {
      const error = { code: "VALIDATION_FAILED", message: "invalid input" };
      const result = err(error);
      if (!result.ok) {
        expect(result.error).toEqual(error);
      }
    });
  });

  describe("isOk()", () => {
    it("should return true for ok results", () => {
      expect(isOk(ok(1))).toBe(true);
    });

    it("should return false for err results", () => {
      expect(isOk(err("fail"))).toBe(false);
    });
  });

  describe("isErr()", () => {
    it("should return true for err results", () => {
      expect(isErr(err("fail"))).toBe(true);
    });

    it("should return false for ok results", () => {
      expect(isErr(ok(1))).toBe(false);
    });
  });

  describe("unwrapOr()", () => {
    it("should return value for ok results", () => {
      expect(unwrapOr(ok(42), 0)).toBe(42);
    });

    it("should return default value for err results", () => {
      expect(unwrapOr(err("fail"), 0)).toBe(0);
    });
  });

  describe("mapResult()", () => {
    it("should transform ok value", () => {
      const result = mapResult(ok(2), (x) => x * 3);
      expect(result).toEqual(ok(6));
    });

    it("should pass through err without calling fn", () => {
      const result = mapResult(err("fail"), (_x: number) => _x * 3);
      expect(result).toEqual(err("fail"));
    });

    it("should handle type transformation", () => {
      const result = mapResult(ok(42), (x) => String(x));
      if (result.ok) {
        expect(result.value).toBe("42");
      }
    });
  });

  describe("flatMap()", () => {
    it("should chain ok results", () => {
      const result = flatMap(ok(10), (x) => ok(x + 5));
      expect(result).toEqual(ok(15));
    });

    it("should short-circuit on first err", () => {
      const result = flatMap(err("fail"), (_x: number) => ok(_x + 5));
      expect(result).toEqual(err("fail"));
    });

    it("should propagate err from inner function", () => {
      const result = flatMap(ok(10), (_x) => err("inner fail"));
      expect(result).toEqual(err("inner fail"));
    });

    it("should support chaining multiple flatMaps", () => {
      const result = flatMap(
        flatMap(ok(1), (x) => ok(x + 1)),
        (x) => ok(x * 10),
      );
      expect(result).toEqual(ok(20));
    });
  });
});
