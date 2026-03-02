// 인메모리 토큰 저장소 — Map 기반 CapabilityToken 관리

import type { CapabilityToken, CapabilityTokenStatus, Result, JarvisError } from "@jarvis/shared";
import { ok, err, createError } from "@jarvis/shared";

// 토큰 저장소 인터페이스
export interface TokenStore {
  readonly get: (tokenId: string) => Result<CapabilityToken, JarvisError>;
  readonly set: (token: CapabilityToken) => Result<void, JarvisError>;
  readonly updateStatus: (
    tokenId: string,
    status: CapabilityTokenStatus,
    metadata?: {
      readonly consumedAt?: string;
      readonly consumedByAction?: string;
      readonly revokedReason?: string;
    },
  ) => Result<CapabilityToken, JarvisError>;
  readonly delete: (tokenId: string) => Result<void, JarvisError>;
  readonly listBySession: (sessionId: string) => readonly CapabilityToken[];
  readonly listByStatus: (status: CapabilityTokenStatus) => readonly CapabilityToken[];
  readonly clear: () => void;
  readonly size: () => number;
}

// 인메모리 Map 기반 토큰 저장소 생성
export function createTokenStore(): TokenStore {
  const tokens = new Map<string, CapabilityToken>();

  function get(tokenId: string): Result<CapabilityToken, JarvisError> {
    const token = tokens.get(tokenId);
    if (!token) {
      return err(createError(
        "VALIDATION_FAILED",
        `토큰을 찾을 수 없습니다: ${tokenId}`,
        { context: { tokenId } },
      ));
    }
    return ok(token);
  }

  function set(token: CapabilityToken): Result<void, JarvisError> {
    if (tokens.has(token.tokenId)) {
      return err(createError(
        "VALIDATION_FAILED",
        `이미 존재하는 토큰 ID입니다: ${token.tokenId}`,
        { context: { tokenId: token.tokenId } },
      ));
    }
    tokens.set(token.tokenId, token);
    return ok(undefined);
  }

  function updateStatus(
    tokenId: string,
    status: CapabilityTokenStatus,
    metadata?: {
      readonly consumedAt?: string;
      readonly consumedByAction?: string;
      readonly revokedReason?: string;
    },
  ): Result<CapabilityToken, JarvisError> {
    const existing = tokens.get(tokenId);
    if (!existing) {
      return err(createError(
        "VALIDATION_FAILED",
        `토큰을 찾을 수 없습니다: ${tokenId}`,
        { context: { tokenId } },
      ));
    }

    const updated: CapabilityToken = {
      ...existing,
      status,
      consumedAt: metadata?.consumedAt ?? existing.consumedAt,
      consumedByAction: metadata?.consumedByAction ?? existing.consumedByAction,
      revokedReason: metadata?.revokedReason ?? existing.revokedReason,
    };

    tokens.set(tokenId, updated);
    return ok(updated);
  }

  function deleteToken(tokenId: string): Result<void, JarvisError> {
    if (!tokens.has(tokenId)) {
      return err(createError(
        "VALIDATION_FAILED",
        `토큰을 찾을 수 없습니다: ${tokenId}`,
        { context: { tokenId } },
      ));
    }
    tokens.delete(tokenId);
    return ok(undefined);
  }

  function listBySession(sessionId: string): readonly CapabilityToken[] {
    const result: CapabilityToken[] = [];
    for (const token of tokens.values()) {
      if (token.context.sessionId === sessionId) {
        result.push(token);
      }
    }
    return result;
  }

  function listByStatus(status: CapabilityTokenStatus): readonly CapabilityToken[] {
    const result: CapabilityToken[] = [];
    for (const token of tokens.values()) {
      if (token.status === status) {
        result.push(token);
      }
    }
    return result;
  }

  function clear(): void {
    tokens.clear();
  }

  function size(): number {
    return tokens.size;
  }

  return {
    get,
    set,
    updateStatus,
    delete: deleteToken,
    listBySession,
    listByStatus,
    clear,
    size,
  };
}
