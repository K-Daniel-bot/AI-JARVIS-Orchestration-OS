// Capability Token 생명주기 관리 — 발급, 검증, 소비, 폐기

import { minimatch } from 'minimatch';
import type {
  CapabilityToken,
  CapabilityGrant,
  CapabilityContext,
  Result,
} from '@jarvis/shared';
import {
  ok,
  err,
  JarvisError,
  ErrorCode,
  generateCapabilityTokenId,
} from '@jarvis/shared';

// ─────────────────────────────────────────
// 토큰 저장소 인터페이스 및 구현
// ─────────────────────────────────────────

/** 토큰 저장소 — Capability Token CRUD 인터페이스 */
export interface TokenStore {
  /** 토큰을 저장소에 저장한다 */
  save(token: CapabilityToken): void;
  /** 토큰 ID로 토큰을 조회한다 (없으면 undefined) */
  get(tokenId: string): CapabilityToken | undefined;
  /** 토큰을 부분 업데이트한다 */
  update(tokenId: string, updates: Partial<CapabilityToken>): void;
  /** 특정 runId에 속한 모든 토큰을 반환한다 */
  getByRunId(runId: string): CapabilityToken[];
  /** 특정 sessionId에 속한 모든 토큰을 반환한다 */
  getBySessionId(sessionId: string): CapabilityToken[];
}

/**
 * 인메모리 토큰 저장소 구현 — 테스트 및 단일 프로세스 환경에서 사용
 * 프로덕션에서는 SQLite 기반 구현체로 교체해야 한다.
 */
export function createTokenStore(): TokenStore {
  // 내부 Map — tokenId → CapabilityToken
  const store = new Map<string, CapabilityToken>();

  return {
    save(token: CapabilityToken): void {
      store.set(token.token_id, token);
    },

    get(tokenId: string): CapabilityToken | undefined {
      return store.get(tokenId);
    },

    update(tokenId: string, updates: Partial<CapabilityToken>): void {
      const existing = store.get(tokenId);
      if (existing === undefined) return;
      // readonly 인터페이스를 유지하기 위해 새 객체를 생성하여 교체
      const updated = { ...existing, ...updates } as CapabilityToken;
      store.set(tokenId, updated);
    },

    getByRunId(runId: string): CapabilityToken[] {
      const result: CapabilityToken[] = [];
      for (const token of store.values()) {
        if (token.context.run_id === runId) {
          result.push(token);
        }
      }
      return result;
    },

    getBySessionId(sessionId: string): CapabilityToken[] {
      const result: CapabilityToken[] = [];
      for (const token of store.values()) {
        if (token.context.session_id === sessionId) {
          result.push(token);
        }
      }
      return result;
    },
  };
}

// ─────────────────────────────────────────
// 토큰 발급
// ─────────────────────────────────────────

/** 토큰 발급 파라미터 */
export interface IssueTokenParams {
  /** 부여할 권한 범위 */
  readonly grant: CapabilityGrant;
  /** 토큰이 발급된 세션/런 컨텍스트 */
  readonly context: CapabilityContext;
  /** 승인한 주체 (사용자 ID 또는 'auto') */
  readonly approvedBy: string;
}

/**
 * 새 Capability Token을 발급한다.
 * 발급된 토큰은 ACTIVE 상태이며 TTL 및 사용 횟수 제한이 적용된다.
 * contract.md §2: 모든 OS 조작은 Capability Token이 부여된 경우에만 실행
 */
export function issueToken(params: IssueTokenParams): CapabilityToken {
  const token: CapabilityToken = {
    token_id: generateCapabilityTokenId(),
    issued_at: new Date().toISOString(),
    issued_by: 'policy-risk-agent',
    approved_by: params.approvedBy,
    grant: params.grant,
    context: params.context,
    status: 'ACTIVE',
  };
  return token;
}

// ─────────────────────────────────────────
// 토큰 검증
// ─────────────────────────────────────────

/**
 * 액션 실행 전 Capability Token의 유효성을 검증한다.
 *
 * 검증 순서:
 * 1. 토큰 상태가 ACTIVE인지 확인
 * 2. TTL(유효시간) 만료 여부 확인
 * 3. 이미 소비된 토큰인지 확인 (1회성 원칙)
 * 4. 액션 scope가 토큰 grant.scope와 일치하는지 확인 (minimatch 글로브)
 * 5. 액션 type이 토큰 grant.cap과 일치하는지 확인
 */
export function validateToken(
  token: CapabilityToken,
  actionType: string,
  actionScope: string,
  now: Date = new Date(),
): Result<void, JarvisError> {
  // ─── 검증 1: 토큰 상태 확인 ───
  if (token.status !== 'ACTIVE') {
    return err(
      new JarvisError({
        code: ErrorCode.TOKEN_INVALID,
        message: `Token ${token.token_id} is not active (status: ${token.status})`,
        context: { token_id: token.token_id, status: token.status },
      }),
    );
  }

  // ─── 검증 2: TTL 만료 확인 ───
  const issuedAt = new Date(token.issued_at);
  const expiresAt = new Date(issuedAt.getTime() + token.grant.ttl_seconds * 1000);
  if (now >= expiresAt) {
    return err(
      new JarvisError({
        code: ErrorCode.TOKEN_EXPIRED,
        message: `Token ${token.token_id} has expired (expired at: ${expiresAt.toISOString()})`,
        context: {
          token_id: token.token_id,
          expired_at: expiresAt.toISOString(),
          now: now.toISOString(),
        },
      }),
    );
  }

  // ─── 검증 3: 이미 소비된 토큰 확인 ───
  // consumed_at이 설정되어 있으면 이미 소비된 1회성 토큰
  if (token.consumed_at !== undefined) {
    return err(
      new JarvisError({
        code: ErrorCode.TOKEN_INVALID,
        message: `Token ${token.token_id} has already been consumed`,
        context: {
          token_id: token.token_id,
          consumed_at: token.consumed_at,
          consumed_by_action: token.consumed_by_action,
        },
      }),
    );
  }

  // ─── 검증 4: scope 글로브 매칭 ───
  const grantedScopes = Array.isArray(token.grant.scope)
    ? (token.grant.scope as readonly string[])
    : [token.grant.scope as string];

  const scopeMatched = grantedScopes.some((grantedScope) =>
    minimatch(actionScope, grantedScope, { dot: true }),
  );

  if (!scopeMatched) {
    return err(
      new JarvisError({
        code: ErrorCode.TOKEN_SCOPE_MISMATCH,
        message: `Action scope "${actionScope}" does not match token scope "${String(token.grant.scope)}"`,
        context: {
          token_id: token.token_id,
          action_scope: actionScope,
          granted_scope: token.grant.scope,
        },
      }),
    );
  }

  // ─── 검증 5: Capability 타입 일치 확인 ───
  if (token.grant.cap !== actionType) {
    return err(
      new JarvisError({
        code: ErrorCode.TOKEN_SCOPE_MISMATCH,
        message: `Action type "${actionType}" does not match token capability "${token.grant.cap}"`,
        context: {
          token_id: token.token_id,
          action_type: actionType,
          granted_cap: token.grant.cap,
        },
      }),
    );
  }

  return ok(undefined);
}

// ─────────────────────────────────────────
// 토큰 소비
// ─────────────────────────────────────────

/**
 * 토큰을 1회 소비한다. 소비 즉시 CONSUMED 상태로 전환되어 재사용이 불가능하다.
 * contract.md §2: "Token은 1회성 (사용 후 즉시 무효화)"
 */
export function consumeToken(
  store: TokenStore,
  tokenId: string,
  actionId: string,
): Result<void, JarvisError> {
  const token = store.get(tokenId);

  if (token === undefined) {
    return err(
      new JarvisError({
        code: ErrorCode.TOKEN_INVALID,
        message: `Token ${tokenId} not found in store`,
        context: { token_id: tokenId },
      }),
    );
  }

  if (token.status !== 'ACTIVE') {
    return err(
      new JarvisError({
        code: ErrorCode.TOKEN_INVALID,
        message: `Token ${tokenId} cannot be consumed (status: ${token.status})`,
        context: { token_id: tokenId, status: token.status },
      }),
    );
  }

  // 1회 사용 후 즉시 CONSUMED 상태로 전환
  store.update(tokenId, {
    status: 'CONSUMED',
    consumed_at: new Date().toISOString(),
    consumed_by_action: actionId,
  });

  return ok(undefined);
}

// ─────────────────────────────────────────
// 토큰 폐기
// ─────────────────────────────────────────

/**
 * 토큰을 명시적으로 폐기한다.
 * 관리자 조치 또는 비상 중단(contract.md §7) 시 사용된다.
 * 이미 폐기된 토큰은 멱등성 보장 — 에러 없이 성공 반환한다.
 */
export function revokeToken(
  store: TokenStore,
  tokenId: string,
  reason: string,
): Result<void, JarvisError> {
  const token = store.get(tokenId);

  if (token === undefined) {
    return err(
      new JarvisError({
        code: ErrorCode.TOKEN_INVALID,
        message: `Token ${tokenId} not found in store`,
        context: { token_id: tokenId },
      }),
    );
  }

  // 이미 폐기된 경우 멱등성 보장
  if (token.status === 'REVOKED') {
    return ok(undefined);
  }

  store.update(tokenId, {
    status: 'REVOKED',
    revoked_reason: reason,
  });

  return ok(undefined);
}

// ─────────────────────────────────────────
// 세션 일괄 폐기
// ─────────────────────────────────────────

/**
 * 세션 종료 시 해당 세션에 속한 모든 ACTIVE 토큰을 일괄 폐기한다.
 * contract.md §4: "세션 종료 시 모든 Capability 무효화"
 * 반환값: 폐기된 토큰 수
 */
export function revokeAllBySession(
  store: TokenStore,
  sessionId: string,
): number {
  const tokens = store.getBySessionId(sessionId);
  let revokedCount = 0;

  for (const token of tokens) {
    if (token.status === 'ACTIVE') {
      store.update(token.token_id, {
        status: 'REVOKED',
        revoked_reason: 'SESSION_EXPIRED',
      });
      revokedCount++;
    }
  }

  return revokedCount;
}

/**
 * 만료된 ACTIVE 토큰을 EXPIRED 상태로 전환한다.
 * 주기적으로 호출하여 만료 토큰을 정리할 수 있다.
 * 반환값: 만료 처리된 토큰 수
 */
export function expireStaleTokens(
  store: TokenStore,
  runId: string,
  now: Date = new Date(),
): number {
  const tokens = store.getByRunId(runId);
  let expiredCount = 0;

  for (const token of tokens) {
    if (token.status !== 'ACTIVE') continue;

    const issuedAt = new Date(token.issued_at);
    const expiresAt = new Date(issuedAt.getTime() + token.grant.ttl_seconds * 1000);

    if (now >= expiresAt) {
      store.update(token.token_id, { status: 'EXPIRED' });
      expiredCount++;
    }
  }

  return expiredCount;
}
