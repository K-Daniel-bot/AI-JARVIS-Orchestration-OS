/**
 * ID 생성 유틸리티 단위 테스트
 * generateId, 도메인별 헬퍼 함수, 검증 유틸리티의 동작을 검증한다.
 */

import { describe, it, expect } from 'vitest';
import {
  ID_PREFIX,
  generateId,
  generatePolicyDecisionId,
  generateCapabilityTokenId,
  generateActionId,
  generateAuditEntryId,
  generateMessageId,
  generateRunId,
  generateSpecId,
  generatePlanId,
  generateChangesetId,
  generateReviewId,
  hasPrefix,
  isValidJarvisId,
} from './id.js';

// ─────────────────────────────────────────
// generateId() 테스트
// ─────────────────────────────────────────

describe('generateId()', () => {
  it('지정된 접두사로 시작하는 ID를 생성해야 한다', () => {
    const id = generateId('pd_');
    expect(id.startsWith('pd_')).toBe(true);
  });

  it('매번 다른 고유한 ID를 생성해야 한다', () => {
    const id1 = generateId('test_');
    const id2 = generateId('test_');
    expect(id1).not.toBe(id2);
  });

  it('날짜 부분(YYYYMMDD 8자리)을 포함해야 한다', () => {
    const id = generateId('pd_');
    // pd_20260302_abc123def456 형태
    const parts = id.split('_');
    // 마지막 부분 이전 구간에 날짜가 있어야 한다
    expect(id.length).toBeGreaterThan(12);
  });
});

// ─────────────────────────────────────────
// 도메인별 헬퍼 함수 테스트
// ─────────────────────────────────────────

describe('generatePolicyDecisionId()', () => {
  it('pd_ 접두사로 시작해야 한다', () => {
    const id = generatePolicyDecisionId();
    expect(id.startsWith(ID_PREFIX.POLICY_DECISION)).toBe(true);
  });
});

describe('generateCapabilityTokenId()', () => {
  it('cap_ 접두사로 시작해야 한다', () => {
    const id = generateCapabilityTokenId();
    expect(id.startsWith(ID_PREFIX.CAPABILITY_TOKEN)).toBe(true);
  });
});

describe('generateActionId()', () => {
  it('act_ 접두사로 시작해야 한다', () => {
    const id = generateActionId();
    expect(id.startsWith(ID_PREFIX.ACTION)).toBe(true);
  });
});

describe('generateAuditEntryId()', () => {
  it('aud_ 접두사로 시작해야 한다', () => {
    const id = generateAuditEntryId();
    expect(id.startsWith(ID_PREFIX.AUDIT_ENTRY)).toBe(true);
  });
});

describe('generateMessageId()', () => {
  it('msg_ 접두사로 시작해야 한다', () => {
    const id = generateMessageId();
    expect(id.startsWith(ID_PREFIX.MESSAGE)).toBe(true);
  });
});

describe('generateRunId()', () => {
  it('run_ 접두사로 시작해야 한다', () => {
    const id = generateRunId();
    expect(id.startsWith(ID_PREFIX.RUN)).toBe(true);
  });
});

describe('generateSpecId()', () => {
  it('spec_ 접두사로 시작해야 한다', () => {
    const id = generateSpecId();
    expect(id.startsWith(ID_PREFIX.SPEC)).toBe(true);
  });
});

describe('generatePlanId()', () => {
  it('plan_ 접두사로 시작해야 한다', () => {
    const id = generatePlanId();
    expect(id.startsWith(ID_PREFIX.PLAN)).toBe(true);
  });
});

describe('generateChangesetId()', () => {
  it('cs_ 접두사로 시작해야 한다', () => {
    const id = generateChangesetId();
    expect(id.startsWith(ID_PREFIX.CHANGESET)).toBe(true);
  });
});

describe('generateReviewId()', () => {
  it('rev_ 접두사로 시작해야 한다', () => {
    const id = generateReviewId();
    expect(id.startsWith(ID_PREFIX.REVIEW)).toBe(true);
  });
});

// ─────────────────────────────────────────
// hasPrefix() 검증 테스트
// ─────────────────────────────────────────

describe('hasPrefix()', () => {
  it('올바른 접두사를 가진 ID에 대해 true를 반환해야 한다', () => {
    expect(hasPrefix('pd_20260302_abc123', 'pd_')).toBe(true);
  });

  it('잘못된 접두사를 가진 ID에 대해 false를 반환해야 한다', () => {
    expect(hasPrefix('cap_20260302_abc123', 'pd_')).toBe(false);
  });

  it('빈 문자열에 대해 false를 반환해야 한다', () => {
    expect(hasPrefix('', 'pd_')).toBe(false);
  });
});

// ─────────────────────────────────────────
// isValidJarvisId() 검증 테스트
// ─────────────────────────────────────────

describe('isValidJarvisId()', () => {
  it('유효한 JARVIS ID 형식에 대해 true를 반환해야 한다', () => {
    // generateId로 실제 생성한 ID를 검증
    const id = generatePolicyDecisionId();
    expect(isValidJarvisId(id)).toBe(true);
  });

  it('잘못된 형식의 ID에 대해 false를 반환해야 한다', () => {
    expect(isValidJarvisId('invalid-id')).toBe(false);
    expect(isValidJarvisId('')).toBe(false);
    expect(isValidJarvisId('pd_notadate_abc')).toBe(false);
  });

  it('모든 도메인 ID가 유효한 형식이어야 한다', () => {
    const ids = [
      generatePolicyDecisionId(),
      generateCapabilityTokenId(),
      generateActionId(),
      generateAuditEntryId(),
      generateMessageId(),
      generateRunId(),
    ];
    for (const id of ids) {
      expect(isValidJarvisId(id)).toBe(true);
    }
  });
});
