// GateResolver 단위 테스트 — Promise 기반 게이트 승인/거부 대기 메커니즘 검증

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { gateResolver } from "./gate-resolver.js";
import type { GateResolution } from "./gate-resolver.js";

// 각 테스트 후 싱글톤 상태를 정리하는 헬퍼
async function cleanupGateResolver(): Promise<void> {
  // 남은 대기 게이트를 모두 거부하여 초기 상태로 복원
  gateResolver.rejectAll("cleanup");
  // 비동기 reject 처리를 위해 마이크로태스크 큐 소진
  await Promise.resolve();
}

describe("gateResolver", () => {
  afterEach(async () => {
    // 실제 타이머 복원 (fake timer가 사용된 경우 대비)
    vi.useRealTimers();
    await cleanupGateResolver();
  });

  // -----------------------------------------------------------------------
  // createGateId
  // -----------------------------------------------------------------------
  describe("createGateId", () => {
    it('"gate_" 접두사로 시작하는 ID를 생성해야 한다', () => {
      // Arrange & Act
      const id = gateResolver.createGateId();

      // Assert
      expect(id.startsWith("gate_")).toBe(true);
    });

    it("생성된 ID는 접두사 포함 13자여야 한다 (gate_ + 8자)", () => {
      // Arrange & Act
      const id = gateResolver.createGateId();

      // Assert — "gate_" (5자) + UUID 앞 8자 = 13자
      expect(id).toHaveLength(13);
    });

    it("연속 호출 시 각각 고유한 ID를 반환해야 한다", () => {
      // Arrange
      const ids = new Set<string>();

      // Act
      for (let i = 0; i < 20; i++) {
        ids.add(gateResolver.createGateId());
      }

      // Assert — 20번 생성 시 모두 고유해야 함
      expect(ids.size).toBe(20);
    });
  });

  // -----------------------------------------------------------------------
  // waitForGate + resolveGate — APPROVE 해결
  // -----------------------------------------------------------------------
  describe("waitForGate + resolveGate (APPROVE)", () => {
    it("APPROVE 액션으로 해결 시 Promise가 resolve되어야 한다", async () => {
      // Arrange
      const gateId = gateResolver.createGateId();
      const resolution: GateResolution = { action: "APPROVE", reason: "사용자 승인" };

      // Act
      const waitPromise = gateResolver.waitForGate(gateId, 5000);
      gateResolver.resolveGate(gateId, resolution);
      const result = await waitPromise;

      // Assert
      expect(result.action).toBe("APPROVE");
      expect(result.reason).toBe("사용자 승인");
    });

    it("scopeOverride를 포함한 APPROVE 해결 시 해당 값을 반환해야 한다", async () => {
      // Arrange
      const gateId = gateResolver.createGateId();
      const scopeOverride = { allowedPaths: ["/project/src"] };
      const resolution: GateResolution = { action: "APPROVE", scopeOverride };

      // Act
      const waitPromise = gateResolver.waitForGate(gateId, 5000);
      gateResolver.resolveGate(gateId, resolution);
      const result = await waitPromise;

      // Assert
      expect(result.action).toBe("APPROVE");
      expect(result.scopeOverride).toEqual(scopeOverride);
    });
  });

  // -----------------------------------------------------------------------
  // waitForGate + resolveGate — REJECT 해결
  // -----------------------------------------------------------------------
  describe("waitForGate + resolveGate (REJECT)", () => {
    it("REJECT 액션으로 해결 시 Promise가 resolve(REJECT)되어야 한다", async () => {
      // Arrange
      const gateId = gateResolver.createGateId();
      const resolution: GateResolution = { action: "REJECT", reason: "정책 위반" };

      // Act
      const waitPromise = gateResolver.waitForGate(gateId, 5000);
      gateResolver.resolveGate(gateId, resolution);
      const result = await waitPromise;

      // Assert — REJECT도 resolve (reject가 아님), action으로 판별
      expect(result.action).toBe("REJECT");
      expect(result.reason).toBe("정책 위반");
    });

    it("reason 없이 REJECT 해결 시 reason은 undefined여야 한다", async () => {
      // Arrange
      const gateId = gateResolver.createGateId();
      const resolution: GateResolution = { action: "REJECT" };

      // Act
      const waitPromise = gateResolver.waitForGate(gateId, 5000);
      gateResolver.resolveGate(gateId, resolution);
      const result = await waitPromise;

      // Assert
      expect(result.action).toBe("REJECT");
      expect(result.reason).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // resolveGate — 존재하지 않는 gateId
  // -----------------------------------------------------------------------
  describe("resolveGate — 존재하지 않는 gateId", () => {
    it("존재하지 않는 gateId로 resolveGate 호출 시 false를 반환해야 한다", () => {
      // Arrange
      const nonExistentId = "gate_00000000";

      // Act
      const result = gateResolver.resolveGate(nonExistentId, { action: "APPROVE" });

      // Assert
      expect(result).toBe(false);
    });

    it("이미 해결된 gateId로 재호출 시 false를 반환해야 한다", async () => {
      // Arrange
      const gateId = gateResolver.createGateId();
      const waitPromise = gateResolver.waitForGate(gateId, 5000);
      gateResolver.resolveGate(gateId, { action: "APPROVE" });
      await waitPromise;

      // Act — 이미 해결된 게이트 재호출
      const result = gateResolver.resolveGate(gateId, { action: "REJECT" });

      // Assert
      expect(result).toBe(false);
    });

    it("성공적으로 해결된 경우 true를 반환해야 한다", async () => {
      // Arrange
      const gateId = gateResolver.createGateId();
      const waitPromise = gateResolver.waitForGate(gateId, 5000);

      // Act
      const result = gateResolver.resolveGate(gateId, { action: "APPROVE" });

      // Assert
      expect(result).toBe(true);
      await waitPromise; // cleanup
    });
  });

  // -----------------------------------------------------------------------
  // 타임아웃 자동 reject
  // -----------------------------------------------------------------------
  describe("waitForGate — 타임아웃", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    it("타임아웃 경과 시 Promise가 reject되어야 한다", async () => {
      // Arrange
      const gateId = gateResolver.createGateId();
      const waitPromise = gateResolver.waitForGate(gateId, 100);

      // Act — 100ms 타임아웃 경과
      vi.advanceTimersByTime(100);

      // Assert
      await expect(waitPromise).rejects.toThrow();
    });

    it("타임아웃 에러 메시지에 gateId가 포함되어야 한다", async () => {
      // Arrange
      const gateId = gateResolver.createGateId();
      const waitPromise = gateResolver.waitForGate(gateId, 100);

      // Act
      vi.advanceTimersByTime(100);

      // Assert
      await expect(waitPromise).rejects.toThrow(gateId);
    });

    it("타임아웃 후 해당 게이트는 pending 목록에서 제거되어야 한다", async () => {
      // Arrange
      const gateId = gateResolver.createGateId();
      const waitPromise = gateResolver.waitForGate(gateId, 100);

      // Act
      vi.advanceTimersByTime(100);

      // 에러 무시 처리 (unhandled rejection 방지)
      await waitPromise.catch(() => {});

      // Assert
      expect(gateResolver.getPendingGateIds()).not.toContain(gateId);
    });

    it("타임아웃 경과 전에는 게이트가 pending 목록에 있어야 한다", () => {
      // Arrange
      const gateId = gateResolver.createGateId();
      // waitForGate 결과를 유지하되 처리하지 않음 (afterEach에서 정리)
      gateResolver.waitForGate(gateId, 5000).catch(() => {});

      // Act — 아직 타임아웃 미경과
      vi.advanceTimersByTime(100);

      // Assert
      expect(gateResolver.getPendingGateIds()).toContain(gateId);
    });
  });

  // -----------------------------------------------------------------------
  // pendingCount / getPendingGateIds
  // -----------------------------------------------------------------------
  describe("pendingCount / getPendingGateIds", () => {
    it("초기 상태에서 pendingCount는 0이어야 한다", () => {
      // Arrange & Act & Assert
      expect(gateResolver.pendingCount).toBe(0);
    });

    it("waitForGate 호출 후 pendingCount가 1 증가해야 한다", async () => {
      // Arrange
      const gateId = gateResolver.createGateId();

      // Act
      const waitPromise = gateResolver.waitForGate(gateId, 5000);

      // Assert
      expect(gateResolver.pendingCount).toBe(1);

      // 정리
      gateResolver.resolveGate(gateId, { action: "APPROVE" });
      await waitPromise;
    });

    it("여러 게이트 대기 시 pendingCount가 정확히 반영되어야 한다", async () => {
      // Arrange
      const id1 = gateResolver.createGateId();
      const id2 = gateResolver.createGateId();
      const id3 = gateResolver.createGateId();

      // Act
      const p1 = gateResolver.waitForGate(id1, 5000);
      const p2 = gateResolver.waitForGate(id2, 5000);
      const p3 = gateResolver.waitForGate(id3, 5000);

      // Assert
      expect(gateResolver.pendingCount).toBe(3);

      // 정리
      gateResolver.resolveGate(id1, { action: "APPROVE" });
      gateResolver.resolveGate(id2, { action: "APPROVE" });
      gateResolver.resolveGate(id3, { action: "APPROVE" });
      await Promise.all([p1, p2, p3]);
    });

    it("게이트 해결 후 pendingCount가 감소해야 한다", async () => {
      // Arrange
      const id1 = gateResolver.createGateId();
      const id2 = gateResolver.createGateId();
      const p1 = gateResolver.waitForGate(id1, 5000);
      const p2 = gateResolver.waitForGate(id2, 5000);

      // Act — 하나만 해결
      gateResolver.resolveGate(id1, { action: "APPROVE" });
      await p1;

      // Assert
      expect(gateResolver.pendingCount).toBe(1);

      // 정리
      gateResolver.resolveGate(id2, { action: "APPROVE" });
      await p2;
    });

    it("getPendingGateIds는 대기 중인 게이트 ID 목록을 반환해야 한다", async () => {
      // Arrange
      const id1 = gateResolver.createGateId();
      const id2 = gateResolver.createGateId();
      const p1 = gateResolver.waitForGate(id1, 5000);
      const p2 = gateResolver.waitForGate(id2, 5000);

      // Act
      const ids = gateResolver.getPendingGateIds();

      // Assert
      expect(ids).toContain(id1);
      expect(ids).toContain(id2);

      // 정리
      gateResolver.resolveGate(id1, { action: "APPROVE" });
      gateResolver.resolveGate(id2, { action: "APPROVE" });
      await Promise.all([p1, p2]);
    });

    it("해결된 게이트는 getPendingGateIds 목록에서 제거되어야 한다", async () => {
      // Arrange
      const id1 = gateResolver.createGateId();
      const id2 = gateResolver.createGateId();
      const p1 = gateResolver.waitForGate(id1, 5000);
      const p2 = gateResolver.waitForGate(id2, 5000);

      // Act
      gateResolver.resolveGate(id1, { action: "APPROVE" });
      await p1;

      // Assert
      expect(gateResolver.getPendingGateIds()).not.toContain(id1);
      expect(gateResolver.getPendingGateIds()).toContain(id2);

      // 정리
      gateResolver.resolveGate(id2, { action: "APPROVE" });
      await p2;
    });
  });

  // -----------------------------------------------------------------------
  // rejectAll
  // -----------------------------------------------------------------------
  describe("rejectAll", () => {
    it("모든 대기 게이트를 reject해야 한다", async () => {
      // Arrange
      const id1 = gateResolver.createGateId();
      const id2 = gateResolver.createGateId();
      const p1 = gateResolver.waitForGate(id1, 5000);
      const p2 = gateResolver.waitForGate(id2, 5000);

      // Act
      gateResolver.rejectAll("긴급 중단");

      // Assert — 두 Promise 모두 reject
      await expect(p1).rejects.toThrow("긴급 중단");
      await expect(p2).rejects.toThrow("긴급 중단");
    });

    it("rejectAll 호출 후 pendingCount가 0이어야 한다", async () => {
      // Arrange
      const id1 = gateResolver.createGateId();
      const id2 = gateResolver.createGateId();
      const p1 = gateResolver.waitForGate(id1, 5000);
      const p2 = gateResolver.waitForGate(id2, 5000);

      // Act
      gateResolver.rejectAll("cleanup");
      await Promise.allSettled([p1, p2]);

      // Assert
      expect(gateResolver.pendingCount).toBe(0);
    });

    it("대기 중인 게이트가 없는 상태에서 rejectAll은 안전하게 동작해야 한다", () => {
      // Arrange & Act & Assert — 예외 없이 실행되어야 함
      expect(() => gateResolver.rejectAll("빈 상태 정리")).not.toThrow();
      expect(gateResolver.pendingCount).toBe(0);
    });

    it("rejectAll 이후 새 게이트를 정상적으로 대기할 수 있어야 한다", async () => {
      // Arrange — 기존 게이트 등록 후 일괄 거부
      const oldId = gateResolver.createGateId();
      const oldPromise = gateResolver.waitForGate(oldId, 5000);
      gateResolver.rejectAll("초기화");
      await oldPromise.catch(() => {});

      // Act — 새 게이트 등록
      const newId = gateResolver.createGateId();
      const newPromise = gateResolver.waitForGate(newId, 5000);
      gateResolver.resolveGate(newId, { action: "APPROVE" });
      const result = await newPromise;

      // Assert
      expect(result.action).toBe("APPROVE");
    });
  });
});
