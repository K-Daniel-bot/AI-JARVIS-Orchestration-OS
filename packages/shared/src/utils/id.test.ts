// ID 생성 유틸리티 단위 테스트
import { describe, it, expect } from "vitest";
import {
  generateAuditId,
  generatePolicyDecisionId,
  generateCapabilityTokenId,
  generateRunId,
  generateMessageId,
  generateActionId,
  generateSessionId,
} from "./id.js";

// 오늘 날짜 접두사 (YYYYMMDD)
function todayPrefix(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

describe("ID 생성 유틸리티", () => {
  describe("generateAuditId()", () => {
    it("should start with aud_ prefix", () => {
      expect(generateAuditId()).toMatch(/^aud_/);
    });

    it("should contain today's date", () => {
      expect(generateAuditId()).toContain(todayPrefix());
    });

    it("should match format aud_YYYYMMDD_8hexchars", () => {
      expect(generateAuditId()).toMatch(/^aud_\d{8}_[a-f0-9]{8}$/);
    });

    it("should generate unique IDs", () => {
      const ids = new Set(Array.from({ length: 100 }, () => generateAuditId()));
      expect(ids.size).toBe(100);
    });
  });

  describe("generatePolicyDecisionId()", () => {
    it("should match format pd_YYYYMMDD_8hexchars", () => {
      expect(generatePolicyDecisionId()).toMatch(/^pd_\d{8}_[a-f0-9]{8}$/);
    });
  });

  describe("generateCapabilityTokenId()", () => {
    it("should match format cap_YYYYMMDD_8hexchars", () => {
      expect(generateCapabilityTokenId()).toMatch(/^cap_\d{8}_[a-f0-9]{8}$/);
    });
  });

  describe("generateRunId()", () => {
    it("should match format run_YYYYMMDD_8hexchars", () => {
      expect(generateRunId()).toMatch(/^run_\d{8}_[a-f0-9]{8}$/);
    });
  });

  describe("generateMessageId()", () => {
    it("should match format msg_YYYYMMDD_8hexchars", () => {
      expect(generateMessageId()).toMatch(/^msg_\d{8}_[a-f0-9]{8}$/);
    });
  });

  describe("generateActionId()", () => {
    it("should match format act_YYYYMMDD_8hexchars", () => {
      expect(generateActionId()).toMatch(/^act_\d{8}_[a-f0-9]{8}$/);
    });
  });

  describe("generateSessionId()", () => {
    it("should start with sess_ prefix", () => {
      expect(generateSessionId()).toMatch(/^sess_/);
    });

    it("should contain a UUID after prefix", () => {
      expect(generateSessionId()).toMatch(
        /^sess_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/,
      );
    });

    it("should generate unique session IDs", () => {
      const ids = new Set(Array.from({ length: 50 }, () => generateSessionId()));
      expect(ids.size).toBe(50);
    });
  });
});
