// 인메모리 토큰 저장소 단위 테스트

import { describe, it, expect, beforeEach } from "vitest";
import { createTokenStore } from "./token-store.js";
import type { TokenStore } from "./token-store.js";
import type { CapabilityToken } from "@jarvis/shared";

// 테스트용 토큰 픽스처 생성 헬퍼
function makeTestToken(overrides?: Partial<CapabilityToken>): CapabilityToken {
  return {
    tokenId: "tok_test_001",
    issuedAt: new Date().toISOString(),
    issuedBy: "policy-risk",
    approvedBy: "user-001",
    grant: {
      cap: "fs.write",
      scope: ["/project/src"],
      ttlSeconds: 900,
      maxUses: 1,
    },
    context: {
      sessionId: "session-001",
      runId: "run-001",
      policyDecisionId: "pd-001",
      trustMode: "semi-auto",
    },
    status: "ACTIVE",
    consumedAt: null,
    consumedByAction: null,
    revokedReason: null,
    ...overrides,
  };
}

describe("createTokenStore", () => {
  let store: TokenStore;

  beforeEach(() => {
    store = createTokenStore();
  });

  describe("set / get", () => {
    it("토큰을 저장하고 조회할 수 있어야 한다", () => {
      // Arrange
      const token = makeTestToken();

      // Act
      const setResult = store.set(token);
      const getResult = store.get(token.tokenId);

      // Assert
      expect(setResult.ok).toBe(true);
      expect(getResult.ok).toBe(true);
      if (getResult.ok) {
        expect(getResult.value.tokenId).toBe(token.tokenId);
        expect(getResult.value.status).toBe("ACTIVE");
      }
    });

    it("존재하지 않는 토큰 조회 시 에러를 반환해야 한다", () => {
      // Arrange & Act
      const result = store.get("non_existent_token");

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("중복 tokenId로 set 시 에러를 반환해야 한다", () => {
      // Arrange
      const token = makeTestToken();
      store.set(token);

      // Act
      const duplicateResult = store.set(token);

      // Assert
      expect(duplicateResult.ok).toBe(false);
      if (!duplicateResult.ok) {
        expect(duplicateResult.error.code).toBe("VALIDATION_FAILED");
      }
    });
  });

  describe("updateStatus", () => {
    it("토큰 상태를 CONSUMED로 업데이트할 수 있어야 한다", () => {
      // Arrange
      const token = makeTestToken();
      store.set(token);
      const consumedAt = new Date().toISOString();

      // Act
      const result = store.updateStatus(token.tokenId, "CONSUMED", {
        consumedAt,
        consumedByAction: "action-001",
      });

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe("CONSUMED");
        expect(result.value.consumedAt).toBe(consumedAt);
        expect(result.value.consumedByAction).toBe("action-001");
      }
    });

    it("토큰 상태를 REVOKED로 업데이트하고 사유를 저장해야 한다", () => {
      // Arrange
      const token = makeTestToken();
      store.set(token);

      // Act
      const result = store.updateStatus(token.tokenId, "REVOKED", {
        revokedReason: "보안 정책 위반",
      });

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe("REVOKED");
        expect(result.value.revokedReason).toBe("보안 정책 위반");
      }
    });

    it("토큰 상태를 EXPIRED로 업데이트할 수 있어야 한다", () => {
      // Arrange
      const token = makeTestToken();
      store.set(token);

      // Act
      const result = store.updateStatus(token.tokenId, "EXPIRED");

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.status).toBe("EXPIRED");
      }
    });

    it("존재하지 않는 토큰 업데이트 시 에러를 반환해야 한다", () => {
      // Arrange & Act
      const result = store.updateStatus("non_existent", "CONSUMED");

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });
  });

  describe("delete", () => {
    it("존재하는 토큰을 삭제할 수 있어야 한다", () => {
      // Arrange
      const token = makeTestToken();
      store.set(token);

      // Act
      const deleteResult = store.delete(token.tokenId);
      const getResult = store.get(token.tokenId);

      // Assert
      expect(deleteResult.ok).toBe(true);
      expect(getResult.ok).toBe(false);
    });

    it("존재하지 않는 토큰 삭제 시 에러를 반환해야 한다", () => {
      // Arrange & Act
      const result = store.delete("non_existent");

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });
  });

  describe("listBySession", () => {
    it("같은 세션 ID의 토큰만 반환해야 한다", () => {
      // Arrange
      const token1 = makeTestToken({ tokenId: "tok_001", context: { sessionId: "session-A", runId: "run-001", policyDecisionId: "pd-001", trustMode: "semi-auto" } });
      const token2 = makeTestToken({ tokenId: "tok_002", context: { sessionId: "session-A", runId: "run-002", policyDecisionId: "pd-002", trustMode: "semi-auto" } });
      const token3 = makeTestToken({ tokenId: "tok_003", context: { sessionId: "session-B", runId: "run-003", policyDecisionId: "pd-003", trustMode: "semi-auto" } });
      store.set(token1);
      store.set(token2);
      store.set(token3);

      // Act
      const result = store.listBySession("session-A");

      // Assert
      expect(result.length).toBe(2);
      expect(result.every((t) => t.context.sessionId === "session-A")).toBe(true);
    });

    it("해당 세션 토큰이 없으면 빈 배열을 반환해야 한다", () => {
      // Arrange & Act
      const result = store.listBySession("non_existent_session");

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe("listByStatus", () => {
    it("ACTIVE 상태의 토큰만 반환해야 한다", () => {
      // Arrange
      const activeToken = makeTestToken({ tokenId: "tok_active" });
      const consumedToken = makeTestToken({ tokenId: "tok_consumed", status: "CONSUMED" });
      store.set(activeToken);
      store.set(consumedToken);

      // Act
      const result = store.listByStatus("ACTIVE");

      // Assert
      expect(result.length).toBe(1);
      expect(result[0]?.tokenId).toBe("tok_active");
    });

    it("CONSUMED 상태의 토큰만 반환해야 한다", () => {
      // Arrange
      const token1 = makeTestToken({ tokenId: "tok_001" });
      const token2 = makeTestToken({ tokenId: "tok_002", status: "CONSUMED" });
      store.set(token1);
      store.set(token2);

      // Act
      const result = store.listByStatus("CONSUMED");

      // Assert
      expect(result.length).toBe(1);
      expect(result[0]?.tokenId).toBe("tok_002");
    });
  });

  describe("size / clear", () => {
    it("토큰 저장 후 size가 증가해야 한다", () => {
      // Arrange & Act
      store.set(makeTestToken({ tokenId: "tok_001" }));
      store.set(makeTestToken({ tokenId: "tok_002" }));

      // Assert
      expect(store.size()).toBe(2);
    });

    it("clear 후 size가 0이 되어야 한다", () => {
      // Arrange
      store.set(makeTestToken({ tokenId: "tok_001" }));
      store.set(makeTestToken({ tokenId: "tok_002" }));

      // Act
      store.clear();

      // Assert
      expect(store.size()).toBe(0);
    });
  });
});
