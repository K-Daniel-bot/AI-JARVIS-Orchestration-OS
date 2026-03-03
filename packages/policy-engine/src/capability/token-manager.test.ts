// Capability Token 관리자 단위 테스트

import { describe, it, expect, beforeEach, vi } from "vitest";
import { createTokenManager } from "./token-manager.js";
import type { TokenManager, TokenIssueContext } from "./token-manager.js";
import type { CapabilityGrant } from "@jarvis/shared";

// 테스트용 기본 grant 픽스처
function makeGrant(overrides?: Partial<CapabilityGrant>): CapabilityGrant {
  return {
    cap: "fs.write",
    scope: ["/project/src"],
    ttlSeconds: 900,
    maxUses: 1,
    ...overrides,
  };
}

// 테스트용 기본 context 픽스처
function makeContext(overrides?: Partial<TokenIssueContext>): TokenIssueContext {
  return {
    sessionId: "session-001",
    runId: "run-001",
    policyDecisionId: "pd-001",
    trustMode: "semi-auto",
    issuedBy: "policy-risk",
    approvedBy: "user-001",
    ...overrides,
  };
}

describe("createTokenManager", () => {
  let manager: TokenManager;

  beforeEach(() => {
    manager = createTokenManager();
  });

  describe("issueToken", () => {
    it("유효한 grant로 토큰을 발급해야 한다", () => {
      // Arrange
      const grant = makeGrant();
      const context = makeContext();

      // Act
      const result = manager.issueToken(grant, context);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.tokenId).toBeTruthy();
        expect(result.value.status).toBe("ACTIVE");
        expect(result.value.grant.cap).toBe("fs.write");
        expect(result.value.context.sessionId).toBe("session-001");
        expect(result.value.consumedAt).toBeNull();
        expect(result.value.revokedReason).toBeNull();
      }
    });

    it("TTL이 0 이하이면 에러를 반환해야 한다", () => {
      // Arrange
      const grant = makeGrant({ ttlSeconds: 0 });
      const context = makeContext();

      // Act
      const result = manager.issueToken(grant, context);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("TTL이 음수이면 에러를 반환해야 한다", () => {
      // Arrange
      const grant = makeGrant({ ttlSeconds: -1 });
      const context = makeContext();

      // Act
      const result = manager.issueToken(grant, context);

      // Assert
      expect(result.ok).toBe(false);
    });

    it("maxUses가 0 이하이면 에러를 반환해야 한다", () => {
      // Arrange
      const grant = makeGrant({ maxUses: 0 });
      const context = makeContext();

      // Act
      const result = manager.issueToken(grant, context);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("발급된 토큰은 getToken으로 조회 가능해야 한다", () => {
      // Arrange
      const grant = makeGrant();
      const context = makeContext();
      const issueResult = manager.issueToken(grant, context);
      expect(issueResult.ok).toBe(true);
      if (!issueResult.ok) return;

      // Act
      const getResult = manager.getToken(issueResult.value.tokenId);

      // Assert
      expect(getResult.ok).toBe(true);
      if (getResult.ok) {
        expect(getResult.value.tokenId).toBe(issueResult.value.tokenId);
      }
    });

    it("여러 토큰을 각각 고유한 ID로 발급해야 한다", () => {
      // Arrange
      const grant = makeGrant();
      const context = makeContext();

      // Act
      const result1 = manager.issueToken(grant, context);
      const result2 = manager.issueToken(grant, context);

      // Assert
      expect(result1.ok).toBe(true);
      expect(result2.ok).toBe(true);
      if (result1.ok && result2.ok) {
        expect(result1.value.tokenId).not.toBe(result2.value.tokenId);
      }
    });
  });

  describe("validateToken", () => {
    it("유효한 ACTIVE 토큰은 true를 반환해야 한다", () => {
      // Arrange
      const grant = makeGrant({ scope: ["/project/src"] });
      const context = makeContext();
      const issueResult = manager.issueToken(grant, context);
      expect(issueResult.ok).toBe(true);
      if (!issueResult.ok) return;

      // Act
      const result = manager.validateToken(issueResult.value.tokenId, {
        cap: "fs.write",
        target: "/project/src/index.ts",
      });

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });

    it("존재하지 않는 토큰 ID 검증 시 에러를 반환해야 한다", () => {
      // Arrange & Act
      const result = manager.validateToken("non_existent_token", {
        cap: "fs.write",
        target: "/project/src",
      });

      // Assert
      expect(result.ok).toBe(false);
    });

    it("CONSUMED 토큰은 CAPABILITY_CONSUMED 에러를 반환해야 한다", () => {
      // Arrange
      const grant = makeGrant();
      const context = makeContext();
      const issueResult = manager.issueToken(grant, context);
      expect(issueResult.ok).toBe(true);
      if (!issueResult.ok) return;

      manager.consumeToken(issueResult.value.tokenId);

      // Act
      const result = manager.validateToken(issueResult.value.tokenId, {
        cap: "fs.write",
        target: "/project/src/index.ts",
      });

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("CAPABILITY_CONSUMED");
      }
    });

    it("REVOKED 토큰은 CAPABILITY_REVOKED 에러를 반환해야 한다", () => {
      // Arrange
      const grant = makeGrant();
      const context = makeContext();
      const issueResult = manager.issueToken(grant, context);
      expect(issueResult.ok).toBe(true);
      if (!issueResult.ok) return;

      manager.revokeToken(issueResult.value.tokenId, "보안 정책 위반");

      // Act
      const result = manager.validateToken(issueResult.value.tokenId, {
        cap: "fs.write",
        target: "/project/src/index.ts",
      });

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("CAPABILITY_REVOKED");
      }
    });

    it("만료된 토큰은 CAPABILITY_EXPIRED 에러를 반환해야 한다", () => {
      // Arrange — TTL이 매우 짧은 토큰 발급 후 시간 조작
      const grant = makeGrant({ ttlSeconds: 1 });
      const context = makeContext();
      const issueResult = manager.issueToken(grant, context);
      expect(issueResult.ok).toBe(true);
      if (!issueResult.ok) return;

      // 과거에 발급된 것처럼 issuedAt을 조작하기 위해 Date.now를 모킹
      const pastDate = new Date(Date.now() - 5000).toISOString();
      vi.spyOn(Date.prototype, "getTime").mockReturnValue(
        new Date(pastDate).getTime(),
      );

      // 만료된 토큰을 직접 저장소에 주입하는 대신, 새로운 매니저로 테스트
      const expiredManager = createTokenManager();
      const mockGrant = makeGrant({ ttlSeconds: 1 });
      // issuedAt을 과거로 설정한 토큰 발급
      vi.restoreAllMocks();

      // Date를 과거로 고정
      const fixedPast = Date.now() - 10000;
      vi.setSystemTime(fixedPast);
      const expiredIssue = expiredManager.issueToken(mockGrant, makeContext());
      vi.useRealTimers();

      expect(expiredIssue.ok).toBe(true);
      if (!expiredIssue.ok) return;

      // Act — 현재 시각으로 검증하면 만료됨
      const result = expiredManager.validateToken(expiredIssue.value.tokenId, {
        cap: "fs.write",
        target: "/project/src/index.ts",
      });

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("CAPABILITY_EXPIRED");
      }
    });

    it("Capability 유형 불일치 시 CAPABILITY_SCOPE_MISMATCH 에러를 반환해야 한다", () => {
      // Arrange
      const grant = makeGrant({ cap: "fs.write" });
      const context = makeContext();
      const issueResult = manager.issueToken(grant, context);
      expect(issueResult.ok).toBe(true);
      if (!issueResult.ok) return;

      // Act — exec.run 유형으로 검증
      const result = manager.validateToken(issueResult.value.tokenId, {
        cap: "exec.run",
        target: "/project/src",
      });

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("CAPABILITY_SCOPE_MISMATCH");
      }
    });

    it("스코프 범위 밖의 대상은 CAPABILITY_SCOPE_MISMATCH 에러를 반환해야 한다", () => {
      // Arrange
      const grant = makeGrant({ scope: ["/project/src"] });
      const context = makeContext();
      const issueResult = manager.issueToken(grant, context);
      expect(issueResult.ok).toBe(true);
      if (!issueResult.ok) return;

      // Act — 스코프 밖 경로로 검증
      const result = manager.validateToken(issueResult.value.tokenId, {
        cap: "fs.write",
        target: "/etc/passwd",
      });

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("CAPABILITY_SCOPE_MISMATCH");
      }
    });

    it("스코프와 접두사만 일치하고 경로 경계가 아닌 대상은 거부해야 한다", () => {
      // Arrange — /project 스코프에서 /project-backup은 매칭되면 안 됨
      const grant = makeGrant({ scope: ["/project"] });
      const context = makeContext();
      const issueResult = manager.issueToken(grant, context);
      expect(issueResult.ok).toBe(true);
      if (!issueResult.ok) return;

      // Act — /project-backup은 /project의 하위가 아님
      const result = manager.validateToken(issueResult.value.tokenId, {
        cap: "fs.write",
        target: "/project-backup/data.txt",
      });

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("CAPABILITY_SCOPE_MISMATCH");
      }
    });

    it("스코프와 정확히 일치하는 경로는 허용해야 한다", () => {
      // Arrange
      const grant = makeGrant({ scope: ["/project/src"] });
      const context = makeContext();
      const issueResult = manager.issueToken(grant, context);
      expect(issueResult.ok).toBe(true);
      if (!issueResult.ok) return;

      // Act — 정확히 일치
      const result = manager.validateToken(issueResult.value.tokenId, {
        cap: "fs.write",
        target: "/project/src",
      });

      // Assert
      expect(result.ok).toBe(true);
    });

    it("와일드카드(*) 스코프는 모든 대상에 매칭되어야 한다", () => {
      // Arrange
      const grant = makeGrant({ scope: ["*"] });
      const context = makeContext();
      const issueResult = manager.issueToken(grant, context);
      expect(issueResult.ok).toBe(true);
      if (!issueResult.ok) return;

      // Act
      const result = manager.validateToken(issueResult.value.tokenId, {
        cap: "fs.write",
        target: "/anywhere/path/file.txt",
      });

      // Assert
      expect(result.ok).toBe(true);
    });
  });

  describe("consumeToken", () => {
    it("ACTIVE 토큰을 성공적으로 소비해야 한다", () => {
      // Arrange
      const grant = makeGrant();
      const context = makeContext();
      const issueResult = manager.issueToken(grant, context);
      expect(issueResult.ok).toBe(true);
      if (!issueResult.ok) return;

      // Act
      const consumeResult = manager.consumeToken(
        issueResult.value.tokenId,
        "action-001",
      );

      // Assert
      expect(consumeResult.ok).toBe(true);

      // 소비 후 토큰 상태 확인
      const getResult = manager.getToken(issueResult.value.tokenId);
      expect(getResult.ok).toBe(true);
      if (getResult.ok) {
        expect(getResult.value.status).toBe("CONSUMED");
        expect(getResult.value.consumedByAction).toBe("action-001");
        expect(getResult.value.consumedAt).toBeTruthy();
      }
    });

    it("이미 소비된 토큰은 재소비 불가하여 에러를 반환해야 한다", () => {
      // Arrange
      const grant = makeGrant();
      const context = makeContext();
      const issueResult = manager.issueToken(grant, context);
      expect(issueResult.ok).toBe(true);
      if (!issueResult.ok) return;

      manager.consumeToken(issueResult.value.tokenId);

      // Act
      const result = manager.consumeToken(issueResult.value.tokenId);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("CAPABILITY_CONSUMED");
      }
    });

    it("actionId 없이도 소비할 수 있어야 한다", () => {
      // Arrange
      const grant = makeGrant();
      const context = makeContext();
      const issueResult = manager.issueToken(grant, context);
      expect(issueResult.ok).toBe(true);
      if (!issueResult.ok) return;

      // Act
      const result = manager.consumeToken(issueResult.value.tokenId);

      // Assert
      expect(result.ok).toBe(true);
    });

    it("존재하지 않는 토큰 소비 시 에러를 반환해야 한다", () => {
      // Arrange & Act
      const result = manager.consumeToken("non_existent_token");

      // Assert
      expect(result.ok).toBe(false);
    });
  });

  describe("revokeToken", () => {
    it("ACTIVE 토큰을 사유와 함께 취소해야 한다", () => {
      // Arrange
      const grant = makeGrant();
      const context = makeContext();
      const issueResult = manager.issueToken(grant, context);
      expect(issueResult.ok).toBe(true);
      if (!issueResult.ok) return;

      // Act
      const revokeResult = manager.revokeToken(
        issueResult.value.tokenId,
        "사용자 요청으로 취소",
      );

      // Assert
      expect(revokeResult.ok).toBe(true);

      const getResult = manager.getToken(issueResult.value.tokenId);
      expect(getResult.ok).toBe(true);
      if (getResult.ok) {
        expect(getResult.value.status).toBe("REVOKED");
        expect(getResult.value.revokedReason).toBe("사용자 요청으로 취소");
      }
    });

    it("이미 소비된 토큰은 취소 불가하여 에러를 반환해야 한다", () => {
      // Arrange
      const grant = makeGrant();
      const context = makeContext();
      const issueResult = manager.issueToken(grant, context);
      expect(issueResult.ok).toBe(true);
      if (!issueResult.ok) return;

      manager.consumeToken(issueResult.value.tokenId);

      // Act
      const result = manager.revokeToken(issueResult.value.tokenId, "사유");

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("이미 취소된 토큰은 재취소 불가하여 에러를 반환해야 한다", () => {
      // Arrange
      const grant = makeGrant();
      const context = makeContext();
      const issueResult = manager.issueToken(grant, context);
      expect(issueResult.ok).toBe(true);
      if (!issueResult.ok) return;

      manager.revokeToken(issueResult.value.tokenId, "첫 번째 취소");

      // Act
      const result = manager.revokeToken(issueResult.value.tokenId, "두 번째 취소");

      // Assert
      expect(result.ok).toBe(false);
    });

    it("존재하지 않는 토큰 취소 시 에러를 반환해야 한다", () => {
      // Arrange & Act
      const result = manager.revokeToken("non_existent_token", "사유");

      // Assert
      expect(result.ok).toBe(false);
    });
  });

  describe("listSessionTokens", () => {
    it("세션별 발급된 토큰을 모두 반환해야 한다", () => {
      // Arrange
      const grant = makeGrant();
      const sessionAContext = makeContext({ sessionId: "session-A" });
      const sessionBContext = makeContext({ sessionId: "session-B" });

      manager.issueToken(grant, sessionAContext);
      manager.issueToken(grant, sessionAContext);
      manager.issueToken(grant, sessionBContext);

      // Act
      const result = manager.listSessionTokens("session-A");

      // Assert
      expect(result.length).toBe(2);
      expect(result.every((t) => t.context.sessionId === "session-A")).toBe(true);
    });

    it("해당 세션 토큰이 없으면 빈 배열을 반환해야 한다", () => {
      // Arrange & Act
      const result = manager.listSessionTokens("non_existent_session");

      // Assert
      expect(result).toHaveLength(0);
    });
  });

  describe("cleanupExpired", () => {
    it("만료된 ACTIVE 토큰을 EXPIRED 상태로 업데이트하고 수를 반환해야 한다", () => {
      // Arrange — 과거에 발급된 것처럼 시간을 조작
      vi.setSystemTime(Date.now() - 10000);
      const grant = makeGrant({ ttlSeconds: 1 });
      const context = makeContext();
      manager.issueToken(grant, context);
      manager.issueToken(grant, context);
      vi.useRealTimers();

      // Act — 현재 시각으로 정리
      const cleaned = manager.cleanupExpired();

      // Assert
      expect(cleaned).toBe(2);
    });

    it("만료되지 않은 토큰은 정리하지 않아야 한다", () => {
      // Arrange
      const grant = makeGrant({ ttlSeconds: 900 });
      const context = makeContext();
      manager.issueToken(grant, context);

      // Act
      const cleaned = manager.cleanupExpired();

      // Assert
      expect(cleaned).toBe(0);
    });

    it("이미 소비된 토큰은 정리 대상에 포함되지 않아야 한다", () => {
      // Arrange — 과거에 발급
      vi.setSystemTime(Date.now() - 10000);
      const grant = makeGrant({ ttlSeconds: 1 });
      const context = makeContext();
      const issueResult = manager.issueToken(grant, context);
      vi.useRealTimers();

      expect(issueResult.ok).toBe(true);
      if (!issueResult.ok) return;

      // 소비 처리 (상태를 CONSUMED로 변경)
      manager.consumeToken(issueResult.value.tokenId);

      // Act
      const cleaned = manager.cleanupExpired();

      // Assert — CONSUMED 상태는 listByStatus("ACTIVE")에 포함되지 않음
      expect(cleaned).toBe(0);
    });
  });
});
