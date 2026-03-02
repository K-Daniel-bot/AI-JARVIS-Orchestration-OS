// 해시 체인 단위 테스트 — verifyEntry, verifyChain, computeHash 검증
import { describe, it, expect } from 'vitest';
import {
  computeHash,
  verifyEntry,
  verifyChain,
  serializeEntryForHashing,
  GENESIS_HASH,
} from './hash-chain.js';
import type { AuditEntry } from '@jarvis/shared';

// 테스트용 최소 AuditEntry 팩토리
function makeEntry(
  overrides: Partial<AuditEntry> = {}
): AuditEntry {
  const base: Omit<AuditEntry, 'integrity'> = {
    audit_id: 'aud_test_00000001',
    timestamp: '2026-03-01T12:00:00.000Z',
    log_level: 'FULL',
    who: {
      user_id: 'user_001',
      role: 'Owner',
      session_id: 'sess_001',
    },
    what: {
      raw_input: '테스트 요청',
      ai_interpretation: '테스트 해석',
      intent: 'TEST',
    },
    policy: {
      policy_decision_id: 'pd_001',
      risk_score: 10,
      risk_level: 'LOW',
      status: 'ALLOW',
    },
    capability: {
      token_ids: [],
      scopes_granted: [],
    },
    execution: {
      run_id: 'run_001',
      actions_performed: [],
      rollback_performed: false,
      rollback_reason: null,
    },
    result: {
      status: 'COMPLETED',
      output_summary: '테스트 완료',
      artifacts: [],
    },
    evidence: {
      screenshots: [],
      terminal_logs: [],
      previous_action_id: null,
    },
    redactions: {
      applied: [],
      patterns_matched: 0,
    },
    ...overrides,
  };

  const serialized = serializeEntryForHashing(base);
  const hash = computeHash(serialized, GENESIS_HASH);

  return {
    ...base,
    integrity: {
      hash,
      previous_hash: GENESIS_HASH,
    },
    ...overrides,
  };
}

describe('computeHash', () => {
  it('같은 입력에 대해 항상 동일한 해시를 반환해야 한다', () => {
    // Arrange
    const data = '테스트 데이터';
    const previousHash = GENESIS_HASH;

    // Act
    const hash1 = computeHash(data, previousHash);
    const hash2 = computeHash(data, previousHash);

    // Assert
    expect(hash1).toBe(hash2);
  });

  it('64자 16진수 문자열을 반환해야 한다', () => {
    // Arrange & Act
    const hash = computeHash('data', GENESIS_HASH);

    // Assert
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('데이터가 다르면 해시가 달라야 한다', () => {
    // Arrange & Act
    const hash1 = computeHash('데이터A', GENESIS_HASH);
    const hash2 = computeHash('데이터B', GENESIS_HASH);

    // Assert
    expect(hash1).not.toBe(hash2);
  });

  it('이전 해시가 다르면 결과 해시가 달라야 한다', () => {
    // Arrange & Act
    const hash1 = computeHash('동일한 데이터', GENESIS_HASH);
    const hash2 = computeHash('동일한 데이터', 'a'.repeat(64));

    // Assert
    expect(hash1).not.toBe(hash2);
  });
});

describe('verifyEntry', () => {
  it('올바른 엔트리는 검증을 통과해야 한다', () => {
    // Arrange
    const entry = makeEntry();

    // Act
    const isValid = verifyEntry(entry, GENESIS_HASH);

    // Assert
    expect(isValid).toBe(true);
  });

  it('previous_hash가 불일치하면 검증에 실패해야 한다', () => {
    // Arrange
    const entry = makeEntry();
    const wrongPreviousHash = 'a'.repeat(64);

    // Act
    const isValid = verifyEntry(entry, wrongPreviousHash);

    // Assert
    expect(isValid).toBe(false);
  });

  it('엔트리 데이터가 변조되면 검증에 실패해야 한다', () => {
    // Arrange
    const entry = makeEntry();
    const tamperedEntry: AuditEntry = {
      ...entry,
      what: {
        ...entry.what,
        raw_input: '변조된 요청',
      },
    };

    // Act
    const isValid = verifyEntry(tamperedEntry, GENESIS_HASH);

    // Assert
    expect(isValid).toBe(false);
  });

  it('integrity.hash가 변조되면 검증에 실패해야 한다', () => {
    // Arrange
    const entry = makeEntry();
    const tamperedEntry: AuditEntry = {
      ...entry,
      integrity: {
        ...entry.integrity,
        hash: 'f'.repeat(64),
      },
    };

    // Act
    const isValid = verifyEntry(tamperedEntry, GENESIS_HASH);

    // Assert
    expect(isValid).toBe(false);
  });
});

describe('verifyChain', () => {
  it('빈 배열은 유효한 체인으로 처리해야 한다', () => {
    // Act
    const result = verifyChain([]);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(true);
    }
  });

  it('단일 엔트리 체인은 유효해야 한다', () => {
    // Arrange
    const entry = makeEntry();

    // Act
    const result = verifyChain([entry]);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(true);
    }
  });

  it('순차적으로 연결된 다중 엔트리 체인은 유효해야 한다', () => {
    // Arrange — 두 번째 엔트리는 첫 번째 엔트리의 해시를 previous_hash로 가짐
    const entry1 = makeEntry({ audit_id: 'aud_test_00000001' });

    const base2: Omit<AuditEntry, 'integrity'> = {
      audit_id: 'aud_test_00000002',
      timestamp: '2026-03-01T12:01:00.000Z',
      log_level: 'FULL',
      who: { user_id: 'user_001', role: 'Owner', session_id: 'sess_001' },
      what: { raw_input: '두 번째 요청', ai_interpretation: '해석', intent: 'TEST' },
      policy: { policy_decision_id: 'pd_002', risk_score: 10, risk_level: 'LOW', status: 'ALLOW' },
      capability: { token_ids: [], scopes_granted: [] },
      execution: { run_id: 'run_002', actions_performed: [], rollback_performed: false, rollback_reason: null },
      result: { status: 'COMPLETED', output_summary: '완료', artifacts: [] },
      evidence: { screenshots: [], terminal_logs: [], previous_action_id: null },
      redactions: { applied: [], patterns_matched: 0 },
    };

    const serialized2 = serializeEntryForHashing(base2);
    const hash2 = computeHash(serialized2, entry1.integrity.hash);
    const entry2: AuditEntry = {
      ...base2,
      integrity: { hash: hash2, previous_hash: entry1.integrity.hash },
    };

    // Act
    const result = verifyChain([entry1, entry2]);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(true);
    }
  });

  it('체인 중간에 변조된 엔트리가 있으면 false를 반환해야 한다', () => {
    // Arrange
    const entry1 = makeEntry({ audit_id: 'aud_test_00000001' });

    const base2: Omit<AuditEntry, 'integrity'> = {
      audit_id: 'aud_test_00000002',
      timestamp: '2026-03-01T12:01:00.000Z',
      log_level: 'FULL',
      who: { user_id: 'user_001', role: 'Owner', session_id: 'sess_001' },
      what: { raw_input: '두 번째 요청', ai_interpretation: '해석', intent: 'TEST' },
      policy: { policy_decision_id: 'pd_002', risk_score: 10, risk_level: 'LOW', status: 'ALLOW' },
      capability: { token_ids: [], scopes_granted: [] },
      execution: { run_id: 'run_002', actions_performed: [], rollback_performed: false, rollback_reason: null },
      result: { status: 'COMPLETED', output_summary: '완료', artifacts: [] },
      evidence: { screenshots: [], terminal_logs: [], previous_action_id: null },
      redactions: { applied: [], patterns_matched: 0 },
    };

    const serialized2 = serializeEntryForHashing(base2);
    const hash2 = computeHash(serialized2, entry1.integrity.hash);
    const entry2: AuditEntry = {
      ...base2,
      integrity: { hash: hash2, previous_hash: entry1.integrity.hash },
    };

    // entry1 데이터를 변조
    const tamperedEntry1: AuditEntry = {
      ...entry1,
      what: { ...entry1.what, raw_input: '변조된 요청' },
    };

    // Act
    const result = verifyChain([tamperedEntry1, entry2]);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(false);
    }
  });
});
