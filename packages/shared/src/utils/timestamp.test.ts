// 타임스탬프 유틸리티 단위 테스트
import { describe, it, expect, vi, afterEach } from "vitest";
import { nowISO, isExpired, elapsedMs } from "./timestamp.js";

afterEach(() => {
  vi.useRealTimers();
});

describe("nowISO()", () => {
  it("should return ISO 8601 string", () => {
    const ts = nowISO();
    expect(ts).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(ts.endsWith("Z")).toBe(true);
  });

  it("should be parseable by Date constructor", () => {
    const ts = nowISO();
    const date = new Date(ts);
    expect(date.getTime()).not.toBeNaN();
  });

  it("should reflect current time", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-02T12:00:00.000Z"));
    expect(nowISO()).toBe("2026-03-02T12:00:00.000Z");
  });
});

describe("isExpired()", () => {
  it("should return false for recently issued token", () => {
    const issuedAt = new Date().toISOString();
    expect(isExpired(issuedAt, 900)).toBe(false);
  });

  it("should return true for expired token", () => {
    const past = new Date(Date.now() - 2000).toISOString();
    expect(isExpired(past, 1)).toBe(true);
  });

  it("should handle exact expiry boundary", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-02T12:00:10.000Z"));
    // TTL 10초, 정확히 10초 전 발행
    expect(isExpired("2026-03-02T12:00:00.000Z", 10)).toBe(false);
    // TTL 9초라면 만료
    expect(isExpired("2026-03-02T12:00:00.000Z", 9)).toBe(true);
  });

  it("should handle large TTL values", () => {
    const issuedAt = new Date().toISOString();
    expect(isExpired(issuedAt, 86400)).toBe(false); // 24시간
  });

  it("should treat invalid ISO string as expired (safe default)", () => {
    expect(isExpired("invalid-date", 900)).toBe(true);
    expect(isExpired("", 900)).toBe(true);
    expect(isExpired("not-a-date", 86400)).toBe(true);
  });
});

describe("elapsedMs()", () => {
  it("should calculate elapsed time between two timestamps", () => {
    const from = "2026-03-02T12:00:00.000Z";
    const to = "2026-03-02T12:00:05.000Z";
    expect(elapsedMs(from, to)).toBe(5000);
  });

  it("should return 0 for same timestamps", () => {
    const ts = "2026-03-02T12:00:00.000Z";
    expect(elapsedMs(ts, ts)).toBe(0);
  });

  it("should return negative for reversed timestamps", () => {
    const from = "2026-03-02T12:00:10.000Z";
    const to = "2026-03-02T12:00:00.000Z";
    expect(elapsedMs(from, to)).toBe(-10000);
  });

  it("should use current time when 'to' is omitted", () => {
    const from = new Date(Date.now() - 1000).toISOString();
    const elapsed = elapsedMs(from);
    expect(elapsed).toBeGreaterThanOrEqual(900);
    expect(elapsed).toBeLessThan(2000);
  });

  it("should return NaN for invalid 'from' timestamp", () => {
    expect(elapsedMs("invalid-date")).toBeNaN();
  });

  it("should return NaN for invalid 'to' timestamp", () => {
    expect(elapsedMs("2026-03-02T12:00:00.000Z", "invalid-date")).toBeNaN();
  });
});
