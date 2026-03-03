// 감사 로그 쿼리 빌더 단위 테스트 — SQLite mock 사용
import { describe, it, expect, vi } from "vitest";
import type { AuditEntry } from "@jarvis/shared";
import {
  queryByRunId,
  queryBySessionId,
  queryByTimeRange,
  queryByRiskLevel,
  queryLatest,
} from "./audit-query.js";

// 테스트용 최소 AuditEntry 생성 헬퍼
function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  const base: AuditEntry = {
    auditId: "audit-test-1",
    timestamp: "2026-03-01T00:00:00.000Z",
    logLevel: "FULL",
    who: {
      userId: "user-1",
      role: "Admin",
      sessionId: "session-1",
    },
    what: {
      rawInput: "test input",
      aiInterpretation: "test interpretation",
      intent: "test intent",
    },
    policy: {
      policyDecisionId: "policy-1",
      riskScore: 20,
      riskLevel: "LOW",
      status: "ALLOW",
    },
    capability: {
      tokenIds: [],
      scopesGranted: [],
    },
    execution: {
      runId: "run-1",
      actionsPerformed: [],
      rollbackPerformed: false,
      rollbackReason: null,
    },
    result: {
      status: "COMPLETED",
      outputSummary: "완료",
      artifacts: [],
    },
    evidence: {
      screenshots: [],
      terminalLogs: [],
      previousActionId: null,
    },
    redactions: {
      applied: [],
      patternsMatched: 0,
    },
    integrity: {
      hash: "abc123",
      previousHash: "000",
    },
    ...overrides,
  };
  return base;
}

// SQLite DB 행 형식으로 변환 (integrity 필드 분리)
function makeRow(entry: AuditEntry): { entry_json: string; hash: string; previous_hash: string } {
  const { integrity, ...rest } = entry;
  return {
    entry_json: JSON.stringify(rest),
    hash: integrity.hash,
    previous_hash: integrity.previousHash,
  };
}

// better-sqlite3 Database mock 생성 헬퍼
function makeMockDb(rows: { entry_json: string; hash: string; previous_hash: string }[]) {
  const stmt = {
    all: vi.fn().mockReturnValue(rows),
  };
  const db = {
    prepare: vi.fn().mockReturnValue(stmt),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { db: db as any, stmt };
}

// 예외를 던지는 DB mock 생성 헬퍼
function makeErrorDb(message: string) {
  const db = {
    prepare: vi.fn().mockImplementation(() => {
      throw new Error(message);
    }),
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return db as any;
}

describe("queryByRunId()", () => {
  it("should return ok with matching entries", () => {
    // Arrange
    const entry = makeEntry({ execution: { runId: "run-abc", actionsPerformed: [], rollbackPerformed: false, rollbackReason: null } });
    const { db, stmt } = makeMockDb([makeRow(entry)]);

    // Act
    const result = queryByRunId(db, "run-abc");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.execution.runId).toBe("run-abc");
    }
    expect(stmt.all).toHaveBeenCalledWith("run-abc");
  });

  it("should return ok with empty array when no matches", () => {
    // Arrange
    const { db } = makeMockDb([]);

    // Act
    const result = queryByRunId(db, "run-nonexistent");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(0);
    }
  });

  it("should return err when db.prepare throws", () => {
    // Arrange
    const db = makeErrorDb("DB connection failed");

    // Act
    const result = queryByRunId(db, "run-abc");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toContain("runId 조회 실패");
    }
  });

  it("should preserve integrity fields from row", () => {
    // Arrange
    const entry = makeEntry();
    const row = makeRow(entry);
    row.hash = "custom_hash_value";
    row.previous_hash = "custom_prev_hash";
    const { db } = makeMockDb([row]);

    // Act
    const result = queryByRunId(db, "run-1");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]?.integrity.hash).toBe("custom_hash_value");
      expect(result.value[0]?.integrity.previousHash).toBe("custom_prev_hash");
    }
  });
});

describe("queryBySessionId()", () => {
  it("should return ok with matching entries", () => {
    // Arrange
    const entry = makeEntry({ who: { userId: "user-1", role: "Admin", sessionId: "session-xyz" } });
    const { db, stmt } = makeMockDb([makeRow(entry)]);

    // Act
    const result = queryBySessionId(db, "session-xyz");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.who.sessionId).toBe("session-xyz");
    }
    expect(stmt.all).toHaveBeenCalledWith("session-xyz");
  });

  it("should return ok with empty array when no matches", () => {
    // Arrange
    const { db } = makeMockDb([]);

    // Act
    const result = queryBySessionId(db, "session-missing");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(0);
    }
  });

  it("should return err when db throws", () => {
    // Arrange
    const db = makeErrorDb("stmt error");

    // Act
    const result = queryBySessionId(db, "session-xyz");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toContain("sessionId 조회 실패");
    }
  });

  it("should return multiple entries for same session", () => {
    // Arrange
    const entry1 = makeEntry({ auditId: "audit-1", who: { userId: "user-1", role: "Admin", sessionId: "session-multi" } });
    const entry2 = makeEntry({ auditId: "audit-2", who: { userId: "user-1", role: "Admin", sessionId: "session-multi" } });
    const { db } = makeMockDb([makeRow(entry1), makeRow(entry2)]);

    // Act
    const result = queryBySessionId(db, "session-multi");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
    }
  });
});

describe("queryByTimeRange()", () => {
  it("should return ok with entries in range", () => {
    // Arrange
    const entry = makeEntry({ timestamp: "2026-03-01T12:00:00.000Z" });
    const { db, stmt } = makeMockDb([makeRow(entry)]);

    // Act
    const result = queryByTimeRange(db, "2026-03-01T00:00:00.000Z", "2026-03-01T23:59:59.999Z");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
    }
    expect(stmt.all).toHaveBeenCalledWith(
      "2026-03-01T00:00:00.000Z",
      "2026-03-01T23:59:59.999Z",
    );
  });

  it("should return ok with empty array when no entries in range", () => {
    // Arrange
    const { db } = makeMockDb([]);

    // Act
    const result = queryByTimeRange(db, "2020-01-01T00:00:00.000Z", "2020-01-02T00:00:00.000Z");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(0);
    }
  });

  it("should return err when db throws", () => {
    // Arrange
    const db = makeErrorDb("time range error");

    // Act
    const result = queryByTimeRange(db, "from", "to");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toContain("시간 범위 조회 실패");
    }
  });
});

describe("queryByRiskLevel()", () => {
  it("should return ok with HIGH risk entries", () => {
    // Arrange
    const entry = makeEntry({
      policy: { policyDecisionId: "p-1", riskScore: 80, riskLevel: "HIGH", status: "ALLOW" },
    });
    const { db, stmt } = makeMockDb([makeRow(entry)]);

    // Act
    const result = queryByRiskLevel(db, "HIGH");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      expect(result.value[0]?.policy.riskLevel).toBe("HIGH");
    }
    expect(stmt.all).toHaveBeenCalledWith("HIGH");
  });

  it("should return ok with CRITICAL risk entries", () => {
    // Arrange
    const entry = makeEntry({
      policy: { policyDecisionId: "p-2", riskScore: 95, riskLevel: "CRITICAL", status: "DENY" },
    });
    const { db } = makeMockDb([makeRow(entry)]);

    // Act
    const result = queryByRiskLevel(db, "CRITICAL");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]?.policy.riskLevel).toBe("CRITICAL");
    }
  });

  it("should return ok with empty array for LOW when none exist", () => {
    // Arrange
    const { db } = makeMockDb([]);

    // Act
    const result = queryByRiskLevel(db, "LOW");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(0);
    }
  });

  it("should return err when db throws", () => {
    // Arrange
    const db = makeErrorDb("risk level error");

    // Act
    const result = queryByRiskLevel(db, "HIGH");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toContain("riskLevel 조회 실패");
    }
  });
});

describe("queryLatest()", () => {
  it("should return ok with N latest entries", () => {
    // Arrange
    const entries = [
      makeEntry({ auditId: "audit-3", timestamp: "2026-03-01T03:00:00.000Z" }),
      makeEntry({ auditId: "audit-2", timestamp: "2026-03-01T02:00:00.000Z" }),
      makeEntry({ auditId: "audit-1", timestamp: "2026-03-01T01:00:00.000Z" }),
    ];
    const { db, stmt } = makeMockDb(entries.map(makeRow));

    // Act
    const result = queryLatest(db, 3);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(3);
    }
    expect(stmt.all).toHaveBeenCalledWith(3);
  });

  it("should return ok with empty array when no entries exist", () => {
    // Arrange
    const { db } = makeMockDb([]);

    // Act
    const result = queryLatest(db, 10);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(0);
    }
  });

  it("should return err when db throws", () => {
    // Arrange
    const db = makeErrorDb("latest query error");

    // Act
    const result = queryLatest(db, 5);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toContain("최신 로그 조회 실패");
    }
  });

  it("should pass limit value to stmt.all", () => {
    // Arrange
    const { db, stmt } = makeMockDb([]);

    // Act
    queryLatest(db, 50);

    // Assert
    expect(stmt.all).toHaveBeenCalledWith(50);
  });
});
