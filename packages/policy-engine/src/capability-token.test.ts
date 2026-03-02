// Capability Token 생명주기 단위 테스트 — 발급, 검증, 소비, 폐기 검증

import { describe, it, expect, beforeEach } from 'vitest';
import {
  createTokenStore,
  issueToken,
  validateToken,
  consumeToken,
  revokeToken,
  revokeAllBySession,
  expireStaleTokens,
  type TokenStore,
} from './capability-token.js';
import { isOk, isErr } from '@jarvis/shared';
import type { CapabilityGrant, CapabilityContext } from '@jarvis/shared';

// ─────────────────────────────────────────
// 테스트 픽스처
// ─────────────────────────────────────────

/** 기본 grant 생성 헬퍼 */
function makeGrant(overrides: Partial<CapabilityGrant> = {}): CapabilityGrant {
  return {
    cap: 'fs.read',
    scope: '/workspace/**',
    ttl_seconds: 900,
    max_uses: 1,
    ...overrides,
  };
}

/** 기본 context 생성 헬퍼 */
function makeContext(overrides: Partial<CapabilityContext> = {}): CapabilityContext {
  return {
    session_id: 'session_001',
    run_id: 'run_001',
    policy_decision_id: 'pd_001',
    trust_mode: 'semi-auto',
    ...overrides,
  };
}

// ─────────────────────────────────────────
// createTokenStore 테스트
// ─────────────────────────────────────────

describe('createTokenStore', () => {
  it('새 저장소를 생성하면 토큰 조회 시 undefined를 반환해야 한다', () => {
    // Arrange
    const store = createTokenStore();

    // Act
    const result = store.get('nonexistent');

    // Assert
    expect(result).toBeUndefined();
  });

  it('저장 후 동일 ID로 조회하면 동일한 토큰을 반환해야 한다', () => {
    // Arrange
    const store = createTokenStore();
    const token = issueToken({
      grant: makeGrant(),
      context: makeContext(),
      approvedBy: 'user_001',
    });

    // Act
    store.save(token);
    const retrieved = store.get(token.token_id);

    // Assert
    expect(retrieved).toEqual(token);
  });

  it('getByRunId는 해당 runId에 속한 토큰만 반환해야 한다', () => {
    // Arrange
    const store = createTokenStore();
    const token1 = issueToken({ grant: makeGrant(), context: makeContext({ run_id: 'run_A' }), approvedBy: 'user' });
    const token2 = issueToken({ grant: makeGrant(), context: makeContext({ run_id: 'run_A' }), approvedBy: 'user' });
    const token3 = issueToken({ grant: makeGrant(), context: makeContext({ run_id: 'run_B' }), approvedBy: 'user' });
    store.save(token1);
    store.save(token2);
    store.save(token3);

    // Act
    const result = store.getByRunId('run_A');

    // Assert
    expect(result).toHaveLength(2);
    expect(result.map((t) => t.token_id)).toContain(token1.token_id);
    expect(result.map((t) => t.token_id)).toContain(token2.token_id);
  });

  it('getBySessionId는 해당 sessionId에 속한 토큰만 반환해야 한다', () => {
    // Arrange
    const store = createTokenStore();
    const token1 = issueToken({ grant: makeGrant(), context: makeContext({ session_id: 'sess_X' }), approvedBy: 'user' });
    const token2 = issueToken({ grant: makeGrant(), context: makeContext({ session_id: 'sess_Y' }), approvedBy: 'user' });
    store.save(token1);
    store.save(token2);

    // Act
    const result = store.getBySessionId('sess_X');

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]?.token_id).toBe(token1.token_id);
  });
});

// ─────────────────────────────────────────
// issueToken 테스트
// ─────────────────────────────────────────

describe('issueToken', () => {
  it('발급된 토큰은 ACTIVE 상태여야 한다', () => {
    // Arrange & Act
    const token = issueToken({
      grant: makeGrant(),
      context: makeContext(),
      approvedBy: 'user_001',
    });

    // Assert
    expect(token.status).toBe('ACTIVE');
  });

  it('발급된 토큰은 cap_ 접두사를 가진 ID여야 한다', () => {
    // Arrange & Act
    const token = issueToken({
      grant: makeGrant(),
      context: makeContext(),
      approvedBy: 'user_001',
    });

    // Assert
    expect(token.token_id).toMatch(/^cap_/);
  });

  it('발급된 토큰의 issued_by는 policy-risk-agent여야 한다', () => {
    // Arrange & Act
    const token = issueToken({
      grant: makeGrant(),
      context: makeContext(),
      approvedBy: 'user_001',
    });

    // Assert
    expect(token.issued_by).toBe('policy-risk-agent');
  });

  it('발급된 토큰에 consumed_at이 없어야 한다 (미소비 상태)', () => {
    // Arrange & Act
    const token = issueToken({
      grant: makeGrant(),
      context: makeContext(),
      approvedBy: 'user_001',
    });

    // Assert
    expect(token.consumed_at).toBeUndefined();
  });
});

// ─────────────────────────────────────────
// validateToken 테스트
// ─────────────────────────────────────────

describe('validateToken', () => {
  it('유효한 토큰의 검증은 성공해야 한다', () => {
    // Arrange
    const token = issueToken({
      grant: makeGrant({ cap: 'fs.read', scope: '/workspace/**' }),
      context: makeContext(),
      approvedBy: 'user',
    });

    // Act
    const result = validateToken(token, 'fs.read', '/workspace/src/index.ts');

    // Assert
    expect(isOk(result)).toBe(true);
  });

  it('CONSUMED 상태 토큰 검증은 실패해야 한다', () => {
    // Arrange
    const token = issueToken({ grant: makeGrant(), context: makeContext(), approvedBy: 'user' });
    const consumedToken = { ...token, status: 'CONSUMED' as const, consumed_at: new Date().toISOString() };

    // Act
    const result = validateToken(consumedToken, 'fs.read', '/workspace/a.ts');

    // Assert
    expect(isErr(result)).toBe(true);
  });

  it('REVOKED 상태 토큰 검증은 실패해야 한다', () => {
    // Arrange
    const token = issueToken({ grant: makeGrant(), context: makeContext(), approvedBy: 'user' });
    const revokedToken = { ...token, status: 'REVOKED' as const };

    // Act
    const result = validateToken(revokedToken, 'fs.read', '/workspace/a.ts');

    // Assert
    expect(isErr(result)).toBe(true);
  });

  it('만료된 토큰 검증은 실패해야 한다', () => {
    // Arrange — TTL 1초짜리 토큰 발급
    const token = issueToken({
      grant: makeGrant({ ttl_seconds: 1 }),
      context: makeContext(),
      approvedBy: 'user',
    });
    // 2초 후 시점으로 검증
    const futureDate = new Date(new Date(token.issued_at).getTime() + 2000);

    // Act
    const result = validateToken(token, 'fs.read', '/workspace/a.ts', futureDate);

    // Assert
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('TOKEN_EXPIRED');
    }
  });

  it('scope 불일치 시 검증은 실패해야 한다', () => {
    // Arrange
    const token = issueToken({
      grant: makeGrant({ scope: '/workspace/**' }),
      context: makeContext(),
      approvedBy: 'user',
    });

    // Act — scope 범위 밖 경로
    const result = validateToken(token, 'fs.read', '/etc/passwd');

    // Assert
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('TOKEN_SCOPE_MISMATCH');
    }
  });

  it('cap 불일치 시 검증은 실패해야 한다', () => {
    // Arrange
    const token = issueToken({
      grant: makeGrant({ cap: 'fs.read' }),
      context: makeContext(),
      approvedBy: 'user',
    });

    // Act — 다른 cap 타입으로 사용 시도
    const result = validateToken(token, 'exec.run', '/workspace/**');

    // Assert
    expect(isErr(result)).toBe(true);
    if (isErr(result)) {
      expect(result.error.code).toBe('TOKEN_SCOPE_MISMATCH');
    }
  });

  it('배열 scope의 경우 하나라도 일치하면 검증은 성공해야 한다', () => {
    // Arrange
    const token = issueToken({
      grant: makeGrant({ scope: ['/workspace/**', '/tmp/**'] }),
      context: makeContext(),
      approvedBy: 'user',
    });

    // Act
    const result = validateToken(token, 'fs.read', '/tmp/output.txt');

    // Assert
    expect(isOk(result)).toBe(true);
  });
});

// ─────────────────────────────────────────
// consumeToken 테스트
// ─────────────────────────────────────────

describe('consumeToken', () => {
  let store: TokenStore;

  beforeEach(() => {
    store = createTokenStore();
  });

  it('ACTIVE 토큰 소비는 성공하고 CONSUMED 상태로 변해야 한다', () => {
    // Arrange
    const token = issueToken({ grant: makeGrant(), context: makeContext(), approvedBy: 'user' });
    store.save(token);

    // Act
    const result = consumeToken(store, token.token_id, 'act_001');

    // Assert
    expect(isOk(result)).toBe(true);
    const updated = store.get(token.token_id);
    expect(updated?.status).toBe('CONSUMED');
    expect(updated?.consumed_by_action).toBe('act_001');
    expect(updated?.consumed_at).toBeDefined();
  });

  it('존재하지 않는 토큰 소비는 실패해야 한다', () => {
    // Act
    const result = consumeToken(store, 'cap_nonexistent', 'act_001');

    // Assert
    expect(isErr(result)).toBe(true);
  });

  it('이미 CONSUMED된 토큰을 다시 소비하면 실패해야 한다', () => {
    // Arrange
    const token = issueToken({ grant: makeGrant(), context: makeContext(), approvedBy: 'user' });
    store.save(token);
    consumeToken(store, token.token_id, 'act_001');

    // Act — 이미 소비된 토큰 재소비 시도
    const result = consumeToken(store, token.token_id, 'act_002');

    // Assert
    expect(isErr(result)).toBe(true);
  });

  it('소비 후 토큰에 consumed_by_action이 기록되어야 한다', () => {
    // Arrange
    const token = issueToken({ grant: makeGrant(), context: makeContext(), approvedBy: 'user' });
    store.save(token);

    // Act
    consumeToken(store, token.token_id, 'act_XYZ');

    // Assert
    const updated = store.get(token.token_id);
    expect(updated?.consumed_by_action).toBe('act_XYZ');
  });
});

// ─────────────────────────────────────────
// revokeToken 테스트
// ─────────────────────────────────────────

describe('revokeToken', () => {
  let store: TokenStore;

  beforeEach(() => {
    store = createTokenStore();
  });

  it('ACTIVE 토큰 폐기는 성공하고 REVOKED 상태가 되어야 한다', () => {
    // Arrange
    const token = issueToken({ grant: makeGrant(), context: makeContext(), approvedBy: 'user' });
    store.save(token);

    // Act
    const result = revokeToken(store, token.token_id, 'ADMIN_REVOKE');

    // Assert
    expect(isOk(result)).toBe(true);
    expect(store.get(token.token_id)?.status).toBe('REVOKED');
  });

  it('이미 폐기된 토큰을 다시 폐기해도 성공해야 한다 (멱등성)', () => {
    // Arrange
    const token = issueToken({ grant: makeGrant(), context: makeContext(), approvedBy: 'user' });
    store.save(token);
    revokeToken(store, token.token_id, 'FIRST_REVOKE');

    // Act — 동일 토큰 재폐기
    const result = revokeToken(store, token.token_id, 'SECOND_REVOKE');

    // Assert — 에러 없이 성공
    expect(isOk(result)).toBe(true);
  });

  it('존재하지 않는 토큰 폐기는 실패해야 한다', () => {
    // Act
    const result = revokeToken(store, 'cap_nonexistent', 'REASON');

    // Assert
    expect(isErr(result)).toBe(true);
  });
});

// ─────────────────────────────────────────
// revokeAllBySession 테스트
// ─────────────────────────────────────────

describe('revokeAllBySession', () => {
  it('세션의 모든 ACTIVE 토큰을 폐기하고 폐기 수를 반환해야 한다', () => {
    // Arrange
    const store = createTokenStore();
    const sess = 'session_REVOKE';
    const t1 = issueToken({ grant: makeGrant(), context: makeContext({ session_id: sess }), approvedBy: 'user' });
    const t2 = issueToken({ grant: makeGrant(), context: makeContext({ session_id: sess }), approvedBy: 'user' });
    const t3 = issueToken({ grant: makeGrant(), context: makeContext({ session_id: 'other' }), approvedBy: 'user' });
    store.save(t1);
    store.save(t2);
    store.save(t3);

    // Act
    const count = revokeAllBySession(store, sess);

    // Assert
    expect(count).toBe(2);
    expect(store.get(t1.token_id)?.status).toBe('REVOKED');
    expect(store.get(t2.token_id)?.status).toBe('REVOKED');
    // 다른 세션 토큰은 영향 없어야 함
    expect(store.get(t3.token_id)?.status).toBe('ACTIVE');
  });

  it('세션에 ACTIVE 토큰이 없으면 0을 반환해야 한다', () => {
    // Arrange
    const store = createTokenStore();

    // Act
    const count = revokeAllBySession(store, 'empty_session');

    // Assert
    expect(count).toBe(0);
  });

  it('이미 CONSUMED 상태인 토큰은 세션 폐기 대상에서 제외되어야 한다', () => {
    // Arrange
    const store = createTokenStore();
    const sess = 'session_MIXED';
    const t1 = issueToken({ grant: makeGrant(), context: makeContext({ session_id: sess }), approvedBy: 'user' });
    store.save(t1);
    consumeToken(store, t1.token_id, 'act_001');

    // Act
    const count = revokeAllBySession(store, sess);

    // Assert — CONSUMED 토큰은 REVOKED로 변경되지 않음
    expect(count).toBe(0);
    expect(store.get(t1.token_id)?.status).toBe('CONSUMED');
  });
});

// ─────────────────────────────────────────
// expireStaleTokens 테스트
// ─────────────────────────────────────────

describe('expireStaleTokens', () => {
  it('TTL이 지난 ACTIVE 토큰을 EXPIRED로 전환해야 한다', () => {
    // Arrange
    const store = createTokenStore();
    const token = issueToken({
      grant: makeGrant({ ttl_seconds: 10 }),
      context: makeContext({ run_id: 'run_EXP' }),
      approvedBy: 'user',
    });
    store.save(token);

    // issued_at 기준 20초 후 시점
    const future = new Date(new Date(token.issued_at).getTime() + 20000);

    // Act
    const count = expireStaleTokens(store, 'run_EXP', future);

    // Assert
    expect(count).toBe(1);
    expect(store.get(token.token_id)?.status).toBe('EXPIRED');
  });

  it('TTL이 남은 ACTIVE 토큰은 만료 처리하지 않아야 한다', () => {
    // Arrange
    const store = createTokenStore();
    const token = issueToken({
      grant: makeGrant({ ttl_seconds: 900 }),
      context: makeContext({ run_id: 'run_VALID' }),
      approvedBy: 'user',
    });
    store.save(token);

    // 현재 시점 — TTL 미만
    const now = new Date(new Date(token.issued_at).getTime() + 1000);

    // Act
    const count = expireStaleTokens(store, 'run_VALID', now);

    // Assert
    expect(count).toBe(0);
    expect(store.get(token.token_id)?.status).toBe('ACTIVE');
  });
});
