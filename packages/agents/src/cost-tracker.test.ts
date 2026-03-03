// 비용 추적기 테스트 — calculateCost 함수 및 CostTracker 클래스 단위 테스트
import { describe, it, expect, beforeEach } from "vitest";
import {
  calculateCost,
  CostTracker,
  MODEL_PRICING,
} from "./cost-tracker.js";

// ─────────────────────────────────────────────
// calculateCost 함수 테스트
// ─────────────────────────────────────────────
describe("calculateCost", () => {
  // Opus 모델 비용 계산
  describe("Opus 모델 단가 계산", () => {
    it("입력/출력 토큰에 Opus 단가($5/$25)를 올바르게 적용한다", () => {
      // Arrange
      const model = "claude-opus-4-6";
      const inputTokens = 1_000_000; // 1M
      const outputTokens = 1_000_000; // 1M

      // Act
      const cost = calculateCost(model, inputTokens, outputTokens, 0, 0, false);

      // Assert: 입력 $5 + 출력 $25 = $30
      expect(cost).toBeCloseTo(30.0, 6);
    });

    it("Opus 입력만 있을 때 $5/1M 단가가 적용된다", () => {
      // Arrange & Act
      const cost = calculateCost("claude-opus-4-6", 500_000, 0, 0, 0, false);

      // Assert: 0.5M * $5 = $2.5
      expect(cost).toBeCloseTo(2.5, 6);
    });
  });

  // Sonnet 모델 비용 계산
  describe("Sonnet 모델 단가 계산", () => {
    it("입력/출력 토큰에 Sonnet 단가($3/$15)를 올바르게 적용한다", () => {
      // Arrange
      const model = "claude-sonnet-4-6";

      // Act
      const cost = calculateCost(model, 1_000_000, 1_000_000, 0, 0, false);

      // Assert: 입력 $3 + 출력 $15 = $18
      expect(cost).toBeCloseTo(18.0, 6);
    });

    it("Sonnet 소량 토큰의 비용이 올바르게 계산된다", () => {
      // Arrange & Act
      // 입력 2000 토큰, 출력 500 토큰
      // 입력: 2000/1M * $3 = $0.006
      // 출력: 500/1M * $15 = $0.0075
      const cost = calculateCost("claude-sonnet-4-6", 2000, 500, 0, 0, false);

      // Assert
      expect(cost).toBeCloseTo(0.0135, 6);
    });
  });

  // Haiku 모델 비용 계산
  describe("Haiku 모델 단가 계산", () => {
    it("입력/출력 토큰에 Haiku 단가($1/$5)를 올바르게 적용한다", () => {
      // Arrange
      const model = "claude-haiku-4-5";

      // Act
      const cost = calculateCost(model, 1_000_000, 1_000_000, 0, 0, false);

      // Assert: 입력 $1 + 출력 $5 = $6
      expect(cost).toBeCloseTo(6.0, 6);
    });
  });

  // 알 수 없는 모델 — 기본값(Sonnet 단가) 적용
  describe("알 수 없는 모델 기본값 처리", () => {
    it("MODEL_PRICING에 없는 모델은 Sonnet 단가를 기본값으로 적용한다", () => {
      // Arrange
      const unknownModel = "claude-unknown-model";

      // Act — 미등록 모델
      const unknownCost = calculateCost(unknownModel, 1_000_000, 1_000_000, 0, 0, false);
      // Act — Sonnet 기준 비교
      const sonnetCost = calculateCost("claude-sonnet-4-6", 1_000_000, 1_000_000, 0, 0, false);

      // Assert: 미등록 모델은 Sonnet 단가와 동일해야 함
      expect(unknownCost).toBeCloseTo(sonnetCost, 6);
    });

    it("빈 문자열 모델명도 기본값(Sonnet 단가)을 적용한다", () => {
      // Arrange & Act
      const cost = calculateCost("", 1_000_000, 0, 0, 0, false);

      // Assert: 빈 문자열 → Sonnet 입력 단가 $3
      expect(cost).toBeCloseTo(3.0, 6);
    });
  });

  // 캐시 생성 토큰: 입력 단가의 125%
  describe("캐시 생성 토큰 비용 (125% 가산)", () => {
    it("캐시 생성 토큰은 입력 단가의 125%가 적용된다", () => {
      // Arrange
      const model = "claude-sonnet-4-6"; // input: $3/1M
      const cacheCreationTokens = 1_000_000;

      // Act — cacheCreationTokens가 inputTokens를 전부 차지
      const cost = calculateCost(model, 1_000_000, 0, cacheCreationTokens, 0, false);

      // Assert
      // 일반 입력 = max(0, 1M - 1M - 0) = 0 → $0
      // 캐시 생성 = 1M/1M * $3 * 1.25 = $3.75
      expect(cost).toBeCloseTo(3.75, 6);
    });

    it("캐시 생성 토큰은 일반 입력 토큰보다 비싸다", () => {
      // Arrange
      const model = "claude-sonnet-4-6";
      const tokens = 1_000_000;

      // Act
      const regularCost = calculateCost(model, tokens, 0, 0, 0, false);
      const cacheCost = calculateCost(model, tokens, 0, tokens, 0, false);

      // Assert: 캐시 생성 비용 > 일반 입력 비용
      expect(cacheCost).toBeGreaterThan(regularCost);
    });
  });

  // 캐시 읽기 토큰: 입력 단가의 10% (90% 할인)
  describe("캐시 읽기 토큰 비용 (10%, 90% 할인)", () => {
    it("캐시 읽기 토큰은 입력 단가의 10%만 과금된다", () => {
      // Arrange
      const model = "claude-sonnet-4-6"; // input: $3/1M
      const cacheReadTokens = 1_000_000;

      // Act — cacheReadTokens가 inputTokens를 전부 차지
      const cost = calculateCost(model, 1_000_000, 0, 0, cacheReadTokens, false);

      // Assert
      // 일반 입력 = max(0, 1M - 0 - 1M) = 0 → $0
      // 캐시 읽기 = 1M/1M * $3 * 0.10 = $0.30
      expect(cost).toBeCloseTo(0.30, 6);
    });

    it("캐시 읽기 토큰은 일반 입력 토큰보다 훨씬 저렴하다", () => {
      // Arrange
      const model = "claude-sonnet-4-6";
      const tokens = 1_000_000;

      // Act
      const regularCost = calculateCost(model, tokens, 0, 0, 0, false);
      const cacheReadCost = calculateCost(model, tokens, 0, 0, tokens, false);

      // Assert: 캐시 읽기 비용이 일반 입력의 10%
      expect(cacheReadCost).toBeCloseTo(regularCost * 0.10, 6);
    });
  });

  // Batch API: 총 비용 50% 할인
  describe("Batch API 50% 할인", () => {
    it("isBatch=true 시 최종 비용이 절반으로 줄어든다", () => {
      // Arrange
      const model = "claude-sonnet-4-6";

      // Act
      const normalCost = calculateCost(model, 1_000_000, 1_000_000, 0, 0, false);
      const batchCost = calculateCost(model, 1_000_000, 1_000_000, 0, 0, true);

      // Assert: 배치 비용 = 일반 비용의 50%
      expect(batchCost).toBeCloseTo(normalCost * 0.50, 6);
    });

    it("Opus 모델에 Batch 할인을 적용하면 $15가 된다", () => {
      // Arrange
      const model = "claude-opus-4-6";

      // Act
      // 정상: 입력$5 + 출력$25 = $30, 배치 50% → $15
      const cost = calculateCost(model, 1_000_000, 1_000_000, 0, 0, true);

      // Assert
      expect(cost).toBeCloseTo(15.0, 6);
    });
  });

  // 0 토큰: 비용 0 반환
  describe("0 토큰 입력 처리", () => {
    it("모든 토큰이 0이면 비용 0을 반환한다", () => {
      // Arrange & Act
      const cost = calculateCost("claude-sonnet-4-6", 0, 0, 0, 0, false);

      // Assert
      expect(cost).toBe(0);
    });

    it("배치 여부와 관계없이 0 토큰은 비용 0을 반환한다", () => {
      // Arrange & Act
      const costBatch = calculateCost("claude-opus-4-6", 0, 0, 0, 0, true);

      // Assert
      expect(costBatch).toBe(0);
    });
  });

  // 캐시 + 배치 조합: 두 할인 모두 적용
  describe("캐시 읽기 + Batch 조합 할인", () => {
    it("캐시 읽기 토큰과 배치 할인이 동시에 적용된다", () => {
      // Arrange
      const model = "claude-sonnet-4-6"; // input: $3/1M, output: $15/1M
      // 입력 2M 중 1M은 캐시 읽기, 출력 1M
      const inputTokens = 2_000_000;
      const outputTokens = 1_000_000;
      const cacheReadTokens = 1_000_000;

      // Act
      const cost = calculateCost(model, inputTokens, outputTokens, 0, cacheReadTokens, true);

      // 수동 계산:
      // 일반 입력 = max(0, 2M - 0 - 1M) = 1M → 1 * $3 = $3
      // 캐시 읽기 = 1M/1M * $3 * 0.10 = $0.30
      // 출력 = 1M/1M * $15 = $15
      // 소계 = $3 + $0.30 + $15 = $18.30
      // 배치 50% → $18.30 * 0.50 = $9.15
      // Assert
      expect(cost).toBeCloseTo(9.15, 6);
    });

    it("캐시 생성 + 배치 조합도 올바르게 계산된다", () => {
      // Arrange
      const model = "claude-haiku-4-5"; // input: $1/1M, output: $5/1M
      const cacheCreationTokens = 1_000_000;
      const outputTokens = 1_000_000;

      // Act
      const cost = calculateCost(model, 1_000_000, outputTokens, cacheCreationTokens, 0, true);

      // 수동 계산:
      // 일반 입력 = max(0, 1M - 1M - 0) = 0 → $0
      // 캐시 생성 = 1M/1M * $1 * 1.25 = $1.25
      // 출력 = 1M/1M * $5 = $5
      // 소계 = $6.25
      // 배치 50% → $6.25 * 0.50 = $3.125
      // Assert
      expect(cost).toBeCloseTo(3.125, 6);
    });
  });

  // MODEL_PRICING 상수 검증
  describe("MODEL_PRICING 상수", () => {
    it("Opus 모델 단가가 올바르게 정의되어 있다", () => {
      expect(MODEL_PRICING["claude-opus-4-6"]).toEqual({ input: 5.00, output: 25.00 });
    });

    it("Sonnet 모델 단가가 올바르게 정의되어 있다", () => {
      expect(MODEL_PRICING["claude-sonnet-4-6"]).toEqual({ input: 3.00, output: 15.00 });
    });

    it("Haiku 모델 단가가 올바르게 정의되어 있다", () => {
      expect(MODEL_PRICING["claude-haiku-4-5"]).toEqual({ input: 1.00, output: 5.00 });
    });
  });
});

// ─────────────────────────────────────────────
// CostTracker 클래스 테스트
// ─────────────────────────────────────────────
describe("CostTracker", () => {
  let tracker: CostTracker;

  // 각 테스트 전 새 인스턴스로 초기화
  beforeEach(() => {
    tracker = new CostTracker();
  });

  // record() 기본 동작
  describe("record()", () => {
    it("기록 추가 후 timestamp와 estimatedCostUsd가 포함된 CostEntry를 반환한다", () => {
      // Arrange
      const params = {
        agentId: "codegen",
        model: "claude-sonnet-4-6",
        inputTokens: 1000,
        outputTokens: 500,
      };

      // Act
      const entry = tracker.record(params);

      // Assert — 필수 필드 존재 확인
      expect(entry.agentId).toBe("codegen");
      expect(entry.model).toBe("claude-sonnet-4-6");
      expect(entry.inputTokens).toBe(1000);
      expect(entry.outputTokens).toBe(500);
      expect(typeof entry.timestamp).toBe("string");
      expect(entry.timestamp.length).toBeGreaterThan(0);
      expect(typeof entry.estimatedCostUsd).toBe("number");
      expect(entry.estimatedCostUsd).toBeGreaterThan(0);
    });

    it("estimatedCostUsd가 calculateCost 함수 결과와 일치한다", () => {
      // Arrange
      const model = "claude-opus-4-6";
      const inputTokens = 200_000;
      const outputTokens = 50_000;

      // Act
      const entry = tracker.record({
        agentId: "planner",
        model,
        inputTokens,
        outputTokens,
      });

      // Assert
      const expected = calculateCost(model, inputTokens, outputTokens, 0, 0, false);
      expect(entry.estimatedCostUsd).toBeCloseTo(expected, 6);
    });

    it("선택적 파라미터 미제공 시 기본값이 적용된다 (cacheCreation=0, cacheRead=0, isBatch=false)", () => {
      // Arrange & Act
      const entry = tracker.record({
        agentId: "spec-agent",
        model: "claude-haiku-4-5",
        inputTokens: 500,
        outputTokens: 200,
      });

      // Assert — 기본값 검증
      expect(entry.cacheCreationTokens).toBe(0);
      expect(entry.cacheReadTokens).toBe(0);
      expect(entry.isBatch).toBe(false);
    });

    it("cacheCreationTokens 명시적 제공 시 CostEntry에 올바르게 기록된다", () => {
      // Arrange & Act
      const entry = tracker.record({
        agentId: "codegen",
        model: "claude-sonnet-4-6",
        inputTokens: 1_000_000,
        outputTokens: 100_000,
        cacheCreationTokens: 800_000,
      });

      // Assert
      expect(entry.cacheCreationTokens).toBe(800_000);
      expect(entry.isBatch).toBe(false);
    });

    it("isBatch=true 제공 시 CostEntry에 반영된다", () => {
      // Arrange & Act
      const entry = tracker.record({
        agentId: "executor",
        model: "claude-sonnet-4-6",
        inputTokens: 1_000_000,
        outputTokens: 500_000,
        isBatch: true,
      });

      // Assert
      expect(entry.isBatch).toBe(true);
    });

    it("record()로 추가된 항목이 getEntries()에서 조회된다", () => {
      // Arrange & Act
      tracker.record({ agentId: "a1", model: "claude-haiku-4-5", inputTokens: 100, outputTokens: 50 });
      tracker.record({ agentId: "a2", model: "claude-haiku-4-5", inputTokens: 200, outputTokens: 80 });

      // Assert
      expect(tracker.getEntries()).toHaveLength(2);
    });
  });

  // getTotal() — 전체 요약
  describe("getTotal()", () => {
    it("모든 기록의 합계 CostSummary를 반환한다", () => {
      // Arrange
      tracker.record({ agentId: "a1", model: "claude-sonnet-4-6", inputTokens: 1_000_000, outputTokens: 500_000 });
      tracker.record({ agentId: "a2", model: "claude-haiku-4-5", inputTokens: 2_000_000, outputTokens: 1_000_000 });

      // Act
      const summary = tracker.getTotal();

      // Assert
      expect(summary.entryCount).toBe(2);
      expect(summary.totalInputTokens).toBe(3_000_000);
      expect(summary.totalOutputTokens).toBe(1_500_000);
      expect(summary.totalCostUsd).toBeGreaterThan(0);
    });

    it("totalCostUsd가 각 기록의 estimatedCostUsd 합계와 일치한다", () => {
      // Arrange
      const e1 = tracker.record({ agentId: "a1", model: "claude-opus-4-6", inputTokens: 1_000_000, outputTokens: 200_000 });
      const e2 = tracker.record({ agentId: "a2", model: "claude-sonnet-4-6", inputTokens: 500_000, outputTokens: 300_000 });

      // Act
      const summary = tracker.getTotal();

      // Assert
      expect(summary.totalCostUsd).toBeCloseTo(e1.estimatedCostUsd + e2.estimatedCostUsd, 6);
    });

    it("빈 상태에서 getTotal()은 모든 값이 0인 CostSummary를 반환한다", () => {
      // Arrange — 빈 tracker
      // Act
      const summary = tracker.getTotal();

      // Assert
      expect(summary.totalCostUsd).toBe(0);
      expect(summary.totalInputTokens).toBe(0);
      expect(summary.totalOutputTokens).toBe(0);
      expect(summary.totalCacheCreationTokens).toBe(0);
      expect(summary.totalCacheReadTokens).toBe(0);
      expect(summary.entryCount).toBe(0);
      expect(summary.batchSavingsUsd).toBe(0);
      expect(summary.cacheSavingsUsd).toBe(0);
    });
  });

  // getByAgent() — 에이전트별 필터링
  describe("getByAgent()", () => {
    it("특정 에이전트의 기록만 필터링하여 반환한다", () => {
      // Arrange
      tracker.record({ agentId: "codegen", model: "claude-sonnet-4-6", inputTokens: 1_000_000, outputTokens: 500_000 });
      tracker.record({ agentId: "planner", model: "claude-sonnet-4-6", inputTokens: 200_000, outputTokens: 100_000 });
      tracker.record({ agentId: "codegen", model: "claude-sonnet-4-6", inputTokens: 300_000, outputTokens: 150_000 });

      // Act
      const codegenSummary = tracker.getByAgent("codegen");

      // Assert — codegen 기록만 2건
      expect(codegenSummary.entryCount).toBe(2);
      expect(codegenSummary.totalInputTokens).toBe(1_300_000);
    });

    it("존재하지 않는 에이전트 ID는 빈 요약을 반환한다", () => {
      // Arrange
      tracker.record({ agentId: "codegen", model: "claude-sonnet-4-6", inputTokens: 100, outputTokens: 50 });

      // Act
      const summary = tracker.getByAgent("non-existent-agent");

      // Assert
      expect(summary.entryCount).toBe(0);
      expect(summary.totalCostUsd).toBe(0);
    });

    it("에이전트별 totalCostUsd 합계가 해당 기록의 합과 일치한다", () => {
      // Arrange
      const e1 = tracker.record({ agentId: "executor", model: "claude-sonnet-4-6", inputTokens: 500_000, outputTokens: 200_000 });
      tracker.record({ agentId: "review", model: "claude-sonnet-4-6", inputTokens: 300_000, outputTokens: 100_000 });

      // Act
      const executorSummary = tracker.getByAgent("executor");

      // Assert
      expect(executorSummary.totalCostUsd).toBeCloseTo(e1.estimatedCostUsd, 6);
    });
  });

  // getByModel() — 모델별 필터링
  describe("getByModel()", () => {
    it("특정 모델의 기록만 필터링하여 반환한다", () => {
      // Arrange
      tracker.record({ agentId: "a1", model: "claude-opus-4-6", inputTokens: 1_000_000, outputTokens: 500_000 });
      tracker.record({ agentId: "a2", model: "claude-sonnet-4-6", inputTokens: 200_000, outputTokens: 100_000 });
      tracker.record({ agentId: "a3", model: "claude-opus-4-6", inputTokens: 300_000, outputTokens: 150_000 });

      // Act
      const opusSummary = tracker.getByModel("claude-opus-4-6");

      // Assert — Opus 기록만 2건
      expect(opusSummary.entryCount).toBe(2);
      expect(opusSummary.totalInputTokens).toBe(1_300_000);
    });

    it("존재하지 않는 모델은 빈 요약을 반환한다", () => {
      // Arrange
      tracker.record({ agentId: "a1", model: "claude-sonnet-4-6", inputTokens: 100, outputTokens: 50 });

      // Act
      const summary = tracker.getByModel("claude-unknown-99");

      // Assert
      expect(summary.entryCount).toBe(0);
      expect(summary.totalCostUsd).toBe(0);
    });
  });

  // getEntries() — 전체 기록 반환
  describe("getEntries()", () => {
    it("기록 순서대로 모든 CostEntry 배열을 반환한다", () => {
      // Arrange
      tracker.record({ agentId: "a1", model: "claude-haiku-4-5", inputTokens: 100, outputTokens: 50 });
      tracker.record({ agentId: "a2", model: "claude-sonnet-4-6", inputTokens: 200, outputTokens: 80 });
      tracker.record({ agentId: "a3", model: "claude-opus-4-6", inputTokens: 300, outputTokens: 120 });

      // Act
      const entries = tracker.getEntries();

      // Assert
      expect(entries).toHaveLength(3);
      expect(entries[0].agentId).toBe("a1");
      expect(entries[1].agentId).toBe("a2");
      expect(entries[2].agentId).toBe("a3");
    });

    it("빈 상태에서 getEntries()는 빈 배열을 반환한다", () => {
      // Arrange — 초기 상태
      // Act
      const entries = tracker.getEntries();

      // Assert
      expect(entries).toHaveLength(0);
    });
  });

  // reset() — 기록 초기화
  describe("reset()", () => {
    it("reset() 후 getEntries()가 빈 배열을 반환한다", () => {
      // Arrange
      tracker.record({ agentId: "a1", model: "claude-haiku-4-5", inputTokens: 100, outputTokens: 50 });
      tracker.record({ agentId: "a2", model: "claude-sonnet-4-6", inputTokens: 200, outputTokens: 100 });

      // Act
      tracker.reset();

      // Assert
      expect(tracker.getEntries()).toHaveLength(0);
    });

    it("reset() 후 getTotal()은 모든 값이 0인 CostSummary를 반환한다", () => {
      // Arrange
      tracker.record({ agentId: "a1", model: "claude-opus-4-6", inputTokens: 1_000_000, outputTokens: 500_000 });

      // Act
      tracker.reset();
      const summary = tracker.getTotal();

      // Assert
      expect(summary.totalCostUsd).toBe(0);
      expect(summary.entryCount).toBe(0);
    });

    it("reset() 후 새 기록 추가가 정상 동작한다", () => {
      // Arrange
      tracker.record({ agentId: "a1", model: "claude-haiku-4-5", inputTokens: 100, outputTokens: 50 });
      tracker.reset();

      // Act
      tracker.record({ agentId: "a2", model: "claude-sonnet-4-6", inputTokens: 200, outputTokens: 100 });

      // Assert — reset 이후 기록이 1건만 있어야 함
      expect(tracker.getEntries()).toHaveLength(1);
      expect(tracker.getEntries()[0].agentId).toBe("a2");
    });
  });

  // batchSavingsUsd 절감액 계산
  describe("batchSavingsUsd 계산", () => {
    it("Batch 기록의 절감액은 estimatedCostUsd와 동일하다 (50% 할인이므로)", () => {
      // Arrange
      // isBatch=true이면 이미 50% 할인된 금액이 estimatedCostUsd
      // 따라서 batchSavingsUsd == estimatedCostUsd (같은 금액만큼 절감)
      const entry = tracker.record({
        agentId: "executor",
        model: "claude-sonnet-4-6",
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        isBatch: true,
      });

      // Act
      const summary = tracker.getTotal();

      // Assert
      expect(summary.batchSavingsUsd).toBeCloseTo(entry.estimatedCostUsd, 6);
    });

    it("Batch 기록 없으면 batchSavingsUsd는 0이다", () => {
      // Arrange
      tracker.record({ agentId: "a1", model: "claude-sonnet-4-6", inputTokens: 1_000_000, outputTokens: 500_000 });

      // Act
      const summary = tracker.getTotal();

      // Assert
      expect(summary.batchSavingsUsd).toBe(0);
    });

    it("Batch + 일반 혼합 시 Batch 기록의 절감액만 합산한다", () => {
      // Arrange
      const batchEntry = tracker.record({
        agentId: "a1",
        model: "claude-haiku-4-5",
        inputTokens: 1_000_000,
        outputTokens: 1_000_000,
        isBatch: true,
      });
      // 일반 기록 (절감 없음)
      tracker.record({ agentId: "a2", model: "claude-haiku-4-5", inputTokens: 500_000, outputTokens: 200_000 });

      // Act
      const summary = tracker.getTotal();

      // Assert — Batch 기록의 estimatedCostUsd만 절감액으로 합산
      expect(summary.batchSavingsUsd).toBeCloseTo(batchEntry.estimatedCostUsd, 6);
    });
  });

  // cacheSavingsUsd 절감액 계산
  describe("cacheSavingsUsd 계산", () => {
    it("캐시 읽기 토큰의 절감액이 올바르게 계산된다", () => {
      // Arrange
      const model = "claude-sonnet-4-6"; // input: $3/1M
      const cacheReadTokens = 1_000_000;

      // 원래 입력 비용: 1M/1M * $3 = $3
      // 실제 캐시 읽기 비용: 1M/1M * $3 * 0.10 = $0.30
      // 절감액 = $3 - $0.30 = $2.70
      tracker.record({
        agentId: "a1",
        model,
        inputTokens: 1_000_000,
        outputTokens: 0,
        cacheReadTokens,
      });

      // Act
      const summary = tracker.getTotal();

      // Assert
      expect(summary.cacheSavingsUsd).toBeCloseTo(2.70, 6);
    });

    it("캐시 읽기 토큰 없으면 cacheSavingsUsd는 0이다", () => {
      // Arrange
      tracker.record({
        agentId: "a1",
        model: "claude-opus-4-6",
        inputTokens: 1_000_000,
        outputTokens: 500_000,
        cacheReadTokens: 0,
      });

      // Act
      const summary = tracker.getTotal();

      // Assert
      expect(summary.cacheSavingsUsd).toBe(0);
    });

    it("여러 기록의 cacheSavingsUsd가 올바르게 합산된다", () => {
      // Arrange
      // Sonnet: 1M 캐시 읽기 → 절감 $2.70
      tracker.record({ agentId: "a1", model: "claude-sonnet-4-6", inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 1_000_000 });
      // Haiku: 1M 캐시 읽기 → 원가 $1, 실비 $0.10, 절감 $0.90
      tracker.record({ agentId: "a2", model: "claude-haiku-4-5", inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 1_000_000 });

      // Act
      const summary = tracker.getTotal();

      // Assert: $2.70 + $0.90 = $3.60
      expect(summary.cacheSavingsUsd).toBeCloseTo(3.60, 6);
    });
  });

  // totalCacheCreationTokens / totalCacheReadTokens 집계
  describe("캐시 토큰 합계 집계", () => {
    it("totalCacheCreationTokens가 모든 기록의 합계를 반환한다", () => {
      // Arrange
      tracker.record({ agentId: "a1", model: "claude-sonnet-4-6", inputTokens: 2_000_000, outputTokens: 0, cacheCreationTokens: 1_000_000 });
      tracker.record({ agentId: "a2", model: "claude-sonnet-4-6", inputTokens: 1_500_000, outputTokens: 0, cacheCreationTokens: 500_000 });

      // Act
      const summary = tracker.getTotal();

      // Assert
      expect(summary.totalCacheCreationTokens).toBe(1_500_000);
    });

    it("totalCacheReadTokens가 모든 기록의 합계를 반환한다", () => {
      // Arrange
      tracker.record({ agentId: "a1", model: "claude-haiku-4-5", inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: 800_000 });
      tracker.record({ agentId: "a2", model: "claude-haiku-4-5", inputTokens: 500_000, outputTokens: 0, cacheReadTokens: 200_000 });

      // Act
      const summary = tracker.getTotal();

      // Assert
      expect(summary.totalCacheReadTokens).toBe(1_000_000);
    });
  });
});
