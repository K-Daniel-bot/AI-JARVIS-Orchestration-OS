// Capability Token 관리자 — 토큰 발급/검증/소비/만료/취소 처리

import type {
  CapabilityGrant,
  CapabilityToken,
  CapabilityType,
  Result,
  JarvisError,
} from "@jarvis/shared";
import {
  ok,
  err,
  createError,
  generateCapabilityTokenId,
  nowISO,
  isExpired,
} from "@jarvis/shared";
import type { TokenStore } from "./token-store.js";
import { createTokenStore } from "./token-store.js";

// 토큰 발급 컨텍스트
export interface TokenIssueContext {
  readonly sessionId: string;
  readonly runId: string;
  readonly policyDecisionId: string;
  readonly trustMode: "observe" | "suggest" | "semi-auto" | "full-auto";
  readonly issuedBy: string;
  readonly approvedBy: string;
}

// 토큰 검증 요청 액션
export interface TokenValidateAction {
  readonly cap: CapabilityType;
  readonly target: string;
}

// 토큰 매니저 인터페이스
export interface TokenManager {
  readonly issueToken: (grant: CapabilityGrant, context: TokenIssueContext) => Result<CapabilityToken, JarvisError>;
  readonly validateToken: (tokenId: string, action: TokenValidateAction) => Result<boolean, JarvisError>;
  readonly consumeToken: (tokenId: string, actionId?: string) => Result<void, JarvisError>;
  readonly revokeToken: (tokenId: string, reason: string) => Result<void, JarvisError>;
  readonly getToken: (tokenId: string) => Result<CapabilityToken, JarvisError>;
  readonly listSessionTokens: (sessionId: string) => readonly CapabilityToken[];
  readonly cleanupExpired: () => number;
}

// 토큰 매니저 생성
export function createTokenManager(store?: TokenStore): TokenManager {
  const tokenStore = store ?? createTokenStore();

  // 토큰 발급 — 새 CapabilityToken을 생성하고 저장소에 추가
  function issueToken(
    grant: CapabilityGrant,
    context: TokenIssueContext,
  ): Result<CapabilityToken, JarvisError> {
    // 부여 정보 검증
    if (grant.ttlSeconds <= 0) {
      return err(createError(
        "VALIDATION_FAILED",
        "TTL은 양수여야 합니다",
        { context: { ttlSeconds: grant.ttlSeconds } },
      ));
    }

    if (grant.maxUses <= 0) {
      return err(createError(
        "VALIDATION_FAILED",
        "최대 사용 횟수는 양수여야 합니다",
        { context: { maxUses: grant.maxUses } },
      ));
    }

    const token: CapabilityToken = {
      tokenId: generateCapabilityTokenId(),
      issuedAt: nowISO(),
      issuedBy: context.issuedBy,
      approvedBy: context.approvedBy,
      grant,
      context: {
        sessionId: context.sessionId,
        runId: context.runId,
        policyDecisionId: context.policyDecisionId,
        trustMode: context.trustMode,
      },
      status: "ACTIVE",
      consumedAt: null,
      consumedByAction: null,
      revokedReason: null,
    };

    const storeResult = tokenStore.set(token);
    if (!storeResult.ok) {
      return err(storeResult.error);
    }

    return ok(token);
  }

  // 토큰 검증 — 토큰이 유효하고 요청된 액션에 사용 가능한지 확인
  function validateToken(
    tokenId: string,
    action: TokenValidateAction,
  ): Result<boolean, JarvisError> {
    const getResult = tokenStore.get(tokenId);
    if (!getResult.ok) {
      return err(getResult.error);
    }

    const token = getResult.value;

    // 상태 검증
    if (token.status === "CONSUMED") {
      return err(createError(
        "CAPABILITY_CONSUMED",
        `토큰이 이미 소비되었습니다: ${tokenId}`,
        { context: { tokenId } },
      ));
    }

    if (token.status === "REVOKED") {
      return err(createError(
        "CAPABILITY_REVOKED",
        `토큰이 취소되었습니다: ${tokenId}`,
        { context: { tokenId, reason: token.revokedReason ?? "unknown" } },
      ));
    }

    if (token.status === "EXPIRED") {
      return err(createError(
        "CAPABILITY_EXPIRED",
        `토큰이 만료되었습니다: ${tokenId}`,
        { context: { tokenId } },
      ));
    }

    // 만료 시간 검증
    if (isExpired(token.issuedAt, token.grant.ttlSeconds)) {
      // 저장소에서 상태를 EXPIRED로 업데이트
      tokenStore.updateStatus(tokenId, "EXPIRED");
      return err(createError(
        "CAPABILITY_EXPIRED",
        `토큰이 TTL 만료되었습니다: ${tokenId}`,
        { context: { tokenId, ttlSeconds: token.grant.ttlSeconds } },
      ));
    }

    // Capability 유형 일치 검증
    if (token.grant.cap !== action.cap) {
      return err(createError(
        "CAPABILITY_SCOPE_MISMATCH",
        `토큰 Capability 유형 불일치: 기대 ${token.grant.cap}, 요청 ${action.cap}`,
        { context: { tokenId, expected: token.grant.cap, actual: action.cap } },
      ));
    }

    // 스코프 검증 — 요청 대상이 부여된 스코프 범위 내인지 확인
    const scopes = Array.isArray(token.grant.scope)
      ? token.grant.scope
      : [token.grant.scope];
    const scopeMatch = scopes.some((s) => action.target.startsWith(s) || s === "*");
    if (!scopeMatch) {
      return err(createError(
        "CAPABILITY_SCOPE_MISMATCH",
        `요청 대상이 토큰 스코프 밖입니다: ${action.target}`,
        { context: { tokenId, target: action.target, scopes } },
      ));
    }

    return ok(true);
  }

  // 토큰 소비 — 1회성 토큰을 사용 처리
  function consumeToken(
    tokenId: string,
    actionId?: string,
  ): Result<void, JarvisError> {
    const getResult = tokenStore.get(tokenId);
    if (!getResult.ok) {
      return err(getResult.error);
    }

    const token = getResult.value;

    // 소비 가능 상태인지 확인
    if (token.status !== "ACTIVE") {
      return err(createError(
        "CAPABILITY_CONSUMED",
        `토큰 상태가 ACTIVE가 아닙니다: ${token.status}`,
        { context: { tokenId, status: token.status } },
      ));
    }

    // 만료 확인
    if (isExpired(token.issuedAt, token.grant.ttlSeconds)) {
      tokenStore.updateStatus(tokenId, "EXPIRED");
      return err(createError(
        "CAPABILITY_EXPIRED",
        `토큰이 소비 전 만료되었습니다: ${tokenId}`,
        { context: { tokenId } },
      ));
    }

    // 상태를 CONSUMED로 업데이트
    const updateResult = tokenStore.updateStatus(tokenId, "CONSUMED", {
      consumedAt: nowISO(),
      consumedByAction: actionId ?? undefined,
    });

    if (!updateResult.ok) {
      return err(updateResult.error);
    }

    return ok(undefined);
  }

  // 토큰 취소 — 사유와 함께 토큰 즉시 무효화
  function revokeToken(
    tokenId: string,
    reason: string,
  ): Result<void, JarvisError> {
    const getResult = tokenStore.get(tokenId);
    if (!getResult.ok) {
      return err(getResult.error);
    }

    const token = getResult.value;

    // 이미 소비/취소된 토큰은 다시 취소 불가
    if (token.status === "CONSUMED" || token.status === "REVOKED") {
      return err(createError(
        "VALIDATION_FAILED",
        `토큰을 취소할 수 없는 상태입니다: ${token.status}`,
        { context: { tokenId, status: token.status } },
      ));
    }

    const updateResult = tokenStore.updateStatus(tokenId, "REVOKED", {
      revokedReason: reason,
    });

    if (!updateResult.ok) {
      return err(updateResult.error);
    }

    return ok(undefined);
  }

  // 토큰 조회
  function getToken(tokenId: string): Result<CapabilityToken, JarvisError> {
    return tokenStore.get(tokenId);
  }

  // 세션별 토큰 목록 조회
  function listSessionTokens(sessionId: string): readonly CapabilityToken[] {
    return tokenStore.listBySession(sessionId);
  }

  // 만료된 토큰 정리 — 만료된 ACTIVE 토큰을 EXPIRED로 업데이트
  function cleanupExpired(): number {
    const activeTokens = tokenStore.listByStatus("ACTIVE");
    let cleaned = 0;

    for (const token of activeTokens) {
      if (isExpired(token.issuedAt, token.grant.ttlSeconds)) {
        tokenStore.updateStatus(token.tokenId, "EXPIRED");
        cleaned++;
      }
    }

    return cleaned;
  }

  return {
    issueToken,
    validateToken,
    consumeToken,
    revokeToken,
    getToken,
    listSessionTokens,
    cleanupExpired,
  };
}
