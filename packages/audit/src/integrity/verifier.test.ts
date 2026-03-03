// 해시 체인 무결성 검증기 단위 테스트
import { describe, it, expect } from "vitest";
import { verifyChain } from "./verifier.js";
import type { AuditRow } from "./verifier.js";
import { computeAuditHash, GENESIS_HASH } from "@jarvis/shared";

// 테스트용 유효한 AuditRow 체인 생성 헬퍼
function buildValidChain(count: number): AuditRow[] {
  const rows: AuditRow[] = [];
  let prevHash = GENESIS_HASH;

  for (let i = 0; i < count; i++) {
    const entryJson = JSON.stringify({ id: `entry-${i}`, seq: i });
    const hash = computeAuditHash(entryJson, prevHash);
    rows.push({
      audit_id: `audit-${i}`,
      timestamp: new Date(Date.now() + i * 1000).toISOString(),
      entry_json: entryJson,
      hash,
      previous_hash: prevHash,
    });
    prevHash = hash;
  }

  return rows;
}

describe("verifyChain()", () => {
  describe("빈 체인", () => {
    it("should return ok(true) for empty chain", () => {
      // Act
      const result = verifyChain([]);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });
  });

  describe("유효한 체인", () => {
    it("should return ok(true) for single valid entry", () => {
      // Arrange
      const rows = buildValidChain(1);

      // Act
      const result = verifyChain(rows);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });

    it("should return ok(true) for multi-entry valid chain", () => {
      // Arrange
      const rows = buildValidChain(5);

      // Act
      const result = verifyChain(rows);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });

    it("should return ok(true) for chain with 10 entries", () => {
      // Arrange
      const rows = buildValidChain(10);

      // Act
      const result = verifyChain(rows);

      // Assert
      expect(result.ok).toBe(true);
    });
  });

  describe("변조된 체인 — 첫 번째 엔트리 previous_hash 오류", () => {
    it("should return err when first entry previous_hash is not GENESIS_HASH", () => {
      // Arrange
      const rows = buildValidChain(3);
      // 첫 번째 엔트리의 previous_hash를 임의 값으로 변조
      const tampered: AuditRow[] = [
        { ...rows[0]!, previous_hash: "not_genesis_hash" },
        ...rows.slice(1),
      ];

      // Act
      const result = verifyChain(tampered);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("AUDIT_INTEGRITY_VIOLATION");
      }
    });
  });

  describe("변조된 체인 — 해시 체인 연결 끊김", () => {
    it("should return err when middle entry previous_hash is broken", () => {
      // Arrange
      const rows = buildValidChain(4);
      // 두 번째 엔트리(인덱스 1)의 previous_hash를 잘못된 값으로 변조
      const tampered: AuditRow[] = [
        rows[0]!,
        { ...rows[1]!, previous_hash: "wrong_previous_hash" },
        rows[2]!,
        rows[3]!,
      ];

      // Act
      const result = verifyChain(tampered);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("AUDIT_INTEGRITY_VIOLATION");
      }
    });

    it("should return err when last entry previous_hash is broken", () => {
      // Arrange
      const rows = buildValidChain(3);
      const lastIdx = rows.length - 1;
      const tampered: AuditRow[] = [
        ...rows.slice(0, lastIdx),
        { ...rows[lastIdx]!, previous_hash: "corrupted_prev_hash" },
      ];

      // Act
      const result = verifyChain(tampered);

      // Assert
      expect(result.ok).toBe(false);
    });
  });

  describe("변조된 체인 — 해시 값 불일치", () => {
    it("should return err when entry hash is tampered", () => {
      // Arrange
      const rows = buildValidChain(3);
      // 첫 번째 엔트리의 hash를 임의 값으로 변조
      const tampered: AuditRow[] = [
        { ...rows[0]!, hash: "0000000000000000000000000000000000000000000000000000000000000000" },
        ...rows.slice(1),
      ];

      // Act
      const result = verifyChain(tampered);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("AUDIT_INTEGRITY_VIOLATION");
      }
    });

    it("should return err when entry_json content is tampered", () => {
      // Arrange
      const rows = buildValidChain(3);
      // 두 번째 엔트리의 entry_json을 변조 (hash는 원본 기준이므로 불일치)
      const tampered: AuditRow[] = [
        rows[0]!,
        { ...rows[1]!, entry_json: '{"id":"tampered","seq":999}' },
        rows[2]!,
      ];

      // Act
      const result = verifyChain(tampered);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("AUDIT_INTEGRITY_VIOLATION");
      }
    });
  });

  describe("에러 메시지 내용 확인", () => {
    it("should include audit_id in error context when chain is broken", () => {
      // Arrange
      const rows = buildValidChain(2);
      const tampered: AuditRow[] = [
        { ...rows[0]!, previous_hash: "invalid" },
        rows[1]!,
      ];

      // Act
      const result = verifyChain(tampered);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.message).toContain("audit-0");
      }
    });
  });
});
