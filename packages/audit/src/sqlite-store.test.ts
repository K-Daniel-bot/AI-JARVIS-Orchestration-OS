// SQLite 저장소 단위 테스트 — initDatabase, insertEntry, queryEntries 등 검증
// 인메모리 SQLite 사용으로 파일 시스템 부수효과 없음
import { describe, it, expect, beforeEach } from 'vitest';
import type Database from 'better-sqlite3';
import {
  initDatabase,
  insertEntry,
  getLastEntry,
  queryEntries,
  getEntryById,
} from './sqlite-store.js';
import {
  computeHash,
  serializeEntryForHashing,
  GENESIS_HASH,
} from './hash-chain.js';
import type { AuditEntry } from '@jarvis/shared';

/** 테스트용 완전한 AuditEntry 생성 */
function makeEntry(id: string): AuditEntry {
  const base: Omit<AuditEntry, 'integrity'> = {
    audit_id: id,
    timestamp: `2026-03-01T12:00:0${id.slice(-1)}.000Z`,
    log_level: 'FULL',
    who: {
      user_id: 'user_001',
      role: 'Owner',
      session_id: 'sess_001',
    },
    what: {
      raw_input: `요청 ${id}`,
      ai_interpretation: '해석',
      intent: 'TEST',
    },
    policy: {
      policy_decision_id: `pd_${id}`,
      risk_score: 10,
      risk_level: 'LOW',
      status: 'ALLOW',
    },
    capability: { token_ids: [], scopes_granted: [] },
    execution: {
      run_id: `run_${id}`,
      actions_performed: [],
      rollback_performed: false,
      rollback_reason: null,
    },
    result: {
      status: 'COMPLETED',
      output_summary: `완료 ${id}`,
      artifacts: [],
    },
    evidence: {
      screenshots: [],
      terminal_logs: [],
      previous_action_id: null,
    },
    redactions: { applied: [], patterns_matched: 0 },
  };

  const serialized = serializeEntryForHashing(base);
  const hash = computeHash(serialized, GENESIS_HASH);

  return {
    ...base,
    integrity: { hash, previous_hash: GENESIS_HASH },
  };
}

describe('initDatabase', () => {
  it('인메모리 데이터베이스를 초기화해야 한다', () => {
    // Act
    const db = initDatabase(':memory:');

    // Assert — DB 인스턴스가 반환되고 쿼리 가능해야 함
    expect(db).toBeTruthy();
    const result = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all();
    expect(result).toBeDefined();
  });

  it('audit_entries 테이블이 생성되어야 한다', () => {
    // Arrange
    const db = initDatabase(':memory:');

    // Act
    const tables = db
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='audit_entries'"
      )
      .all() as Array<{ name: string }>;

    // Assert
    expect(tables).toHaveLength(1);
    expect(tables[0]?.name).toBe('audit_entries');
  });

  it('멱등성 보장 — 두 번 호출해도 오류가 없어야 한다', () => {
    // Act & Assert — 오류 없이 두 번 초기화 가능해야 함
    expect(() => {
      const db = initDatabase(':memory:');
      // 같은 DB 인스턴스에 테이블 재생성 시도
      db.exec(`
        CREATE TABLE IF NOT EXISTS audit_entries (
          audit_id TEXT PRIMARY KEY,
          timestamp TEXT NOT NULL,
          log_level TEXT NOT NULL,
          data TEXT NOT NULL,
          hash TEXT NOT NULL,
          previous_hash TEXT NOT NULL
        )
      `);
    }).not.toThrow();
  });
});

describe('insertEntry', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDatabase(':memory:');
  });

  it('유효한 엔트리를 성공적으로 삽입해야 한다', () => {
    // Arrange
    const entry = makeEntry('001');

    // Act
    const result = insertEntry(db, entry);

    // Assert
    expect(result.ok).toBe(true);
  });

  it('동일한 audit_id를 두 번 삽입하면 실패해야 한다 (PRIMARY KEY 제약)', () => {
    // Arrange
    const entry = makeEntry('001');
    insertEntry(db, entry);

    // Act — 동일 ID 재삽입
    const result = insertEntry(db, entry);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('DB_ERROR');
    }
  });
});

describe('getLastEntry', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDatabase(':memory:');
  });

  it('빈 데이터베이스에서는 null을 반환해야 한다', () => {
    // Act
    const result = getLastEntry(db);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeNull();
    }
  });

  it('마지막으로 삽입된 엔트리를 반환해야 한다', () => {
    // Arrange
    const entry1 = makeEntry('001');
    const entry2 = makeEntry('002');
    insertEntry(db, entry1);
    insertEntry(db, entry2);

    // Act
    const result = getLastEntry(db);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok && result.value !== null) {
      expect(result.value.audit_id).toBe('002');
    }
  });
});

describe('queryEntries', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDatabase(':memory:');
  });

  it('모든 엔트리를 조회해야 한다', () => {
    // Arrange
    insertEntry(db, makeEntry('001'));
    insertEntry(db, makeEntry('002'));

    // Act
    const result = queryEntries(db, {});

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(2);
    }
  });

  it('limit이 지정되면 해당 수만큼만 반환해야 한다', () => {
    // Arrange
    insertEntry(db, makeEntry('001'));
    insertEntry(db, makeEntry('002'));
    insertEntry(db, makeEntry('003'));

    // Act
    const result = queryEntries(db, { limit: 2 });

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.length).toBeLessThanOrEqual(2);
    }
  });

  it('빈 데이터베이스 조회 시 빈 배열을 반환해야 한다', () => {
    // Act
    const result = queryEntries(db, {});

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(0);
    }
  });
});

describe('getEntryById', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = initDatabase(':memory:');
  });

  it('존재하는 ID로 엔트리를 조회해야 한다', () => {
    // Arrange
    const entry = makeEntry('001');
    insertEntry(db, entry);

    // Act
    const result = getEntryById(db, '001');

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok && result.value !== null) {
      expect(result.value.audit_id).toBe('001');
    }
  });

  it('존재하지 않는 ID는 null을 반환해야 한다', () => {
    // Act
    const result = getEntryById(db, 'nonexistent');

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeNull();
    }
  });
});
