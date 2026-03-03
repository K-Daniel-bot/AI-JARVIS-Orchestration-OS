// CostTracker 통합 테스트 — 에이전트 파이프라인 비용 시뮬레이션
import { describe, it, expect, beforeEach } from "vitest";
import { CostTracker, calculateCost, MODEL_PRICING } from "./cost-tracker.js";

describe("CostTracker 통합 시뮬레이션", () => {
  let tracker: CostTracker;

  beforeEach(() => {
    tracker = new CostTracker();
  });

  // 1. 에이전트 7개 순차 호출 비용 기록 → getTotal() 합산 정확
  it("7개 에이전트 순차 호출의 비용 합산이 정확하다", () => {
    // 파이프라인 시뮬레이션: orchestrator → spec → policy → planner → codegen → review → test
    const agents = [
      { agentId: "orchestrator", model: "claude-opus-4-6", input: 5000, output: 2000 },
      { agentId: "spec", model: "claude-haiku-4-5", input: 3000, output: 1500 },
      { agentId: "policy", model: "claude-opus-4-6", input: 8000, output: 3000 },
      { agentId: "planner", model: "claude-sonnet-4-6", input: 6000, output: 4000 },
      { agentId: "codegen", model: "claude-sonnet-4-6", input: 10000, output: 8000 },
      { agentId: "review", model: "claude-sonnet-4-6", input: 7000, output: 2500 },
      { agentId: "test", model: "claude-haiku-4-5", input: 2000, output: 1000 },
    ];

    let expectedTotal = 0;
    for (const agent of agents) {
      tracker.record({
        agentId: agent.agentId,
        model: agent.model,
        inputTokens: agent.input,
        outputTokens: agent.output,
      });
      expectedTotal += calculateCost(agent.model, agent.input, agent.output, 0, 0, false);
    }

    const summary = tracker.getTotal();
    expect(summary.entryCount).toBe(7);
    expect(summary.totalCostUsd).toBeCloseTo(expectedTotal, 6);
  });

  // 2. getByAgent("spec") vs getByAgent("codegen") 분리 조회
  it("에이전트별 비용 분리 조회가 정확하다", () => {
    tracker.record({ agentId: "spec", model: "claude-haiku-4-5", inputTokens: 3000, outputTokens: 1500 });
    tracker.record({ agentId: "codegen", model: "claude-sonnet-4-6", inputTokens: 10000, outputTokens: 8000 });
    tracker.record({ agentId: "spec", model: "claude-haiku-4-5", inputTokens: 2000, outputTokens: 1000 });

    const specSummary = tracker.getByAgent("spec");
    const codegenSummary = tracker.getByAgent("codegen");

    expect(specSummary.entryCount).toBe(2);
    expect(codegenSummary.entryCount).toBe(1);

    // Spec 비용: (3000+2000)/1M * $1 + (1500+1000)/1M * $5
    const expectedSpecCost =
      calculateCost("claude-haiku-4-5", 3000, 1500, 0, 0, false) +
      calculateCost("claude-haiku-4-5", 2000, 1000, 0, 0, false);
    expect(specSummary.totalCostUsd).toBeCloseTo(expectedSpecCost, 6);

    // Codegen 비용: 10000/1M * $3 + 8000/1M * $15
    const expectedCodegenCost = calculateCost("claude-sonnet-4-6", 10000, 8000, 0, 0, false);
    expect(codegenSummary.totalCostUsd).toBeCloseTo(expectedCodegenCost, 6);
  });

  // 3. getByModel("claude-opus-4-6") vs getByModel("claude-haiku-4-5") 모델별 분리
  it("모델별 비용 분리 조회가 정확하다", () => {
    tracker.record({ agentId: "orchestrator", model: "claude-opus-4-6", inputTokens: 5000, outputTokens: 2000 });
    tracker.record({ agentId: "policy", model: "claude-opus-4-6", inputTokens: 8000, outputTokens: 3000 });
    tracker.record({ agentId: "spec", model: "claude-haiku-4-5", inputTokens: 3000, outputTokens: 1500 });

    const opusSummary = tracker.getByModel("claude-opus-4-6");
    const haikuSummary = tracker.getByModel("claude-haiku-4-5");

    expect(opusSummary.entryCount).toBe(2);
    expect(haikuSummary.entryCount).toBe(1);

    // Opus 총 토큰
    expect(opusSummary.totalInputTokens).toBe(5000 + 8000);
    expect(opusSummary.totalOutputTokens).toBe(2000 + 3000);

    // Haiku 토큰
    expect(haikuSummary.totalInputTokens).toBe(3000);
    expect(haikuSummary.totalOutputTokens).toBe(1500);
  });

  // 4. Prompt Caching (cacheReadTokens > 0) → cacheSavingsUsd > 0
  it("Prompt Caching 사용 시 cacheSavingsUsd가 0보다 크다", () => {
    // 입력 토큰 10000 중 cacheReadTokens 5000 = 5000 토큰이 캐시 읽기
    tracker.record({
      agentId: "planner",
      model: "claude-sonnet-4-6",
      inputTokens: 10000,
      outputTokens: 4000,
      cacheReadTokens: 5000,
    });

    const summary = tracker.getTotal();
    expect(summary.cacheSavingsUsd).toBeGreaterThan(0);
    expect(summary.totalCacheReadTokens).toBe(5000);

    // 캐시 절감 확인: 5000 토큰 × $3/1M × (1 - 0.1) = $0.0135
    const expectedSavings = (5000 / 1_000_000) * 3.00 * 0.9;
    expect(summary.cacheSavingsUsd).toBeCloseTo(expectedSavings, 6);
  });

  // 5. Batch API (isBatch=true) → batchSavingsUsd > 0
  it("Batch API 사용 시 batchSavingsUsd가 0보다 크다", () => {
    tracker.record({
      agentId: "review",
      model: "claude-sonnet-4-6",
      inputTokens: 7000,
      outputTokens: 2500,
      isBatch: true,
    });

    const summary = tracker.getTotal();
    expect(summary.batchSavingsUsd).toBeGreaterThan(0);

    // Batch는 50% 할인 → batchSavingsUsd = 실제 비용과 같은 금액
    const actualCost = calculateCost("claude-sonnet-4-6", 7000, 2500, 0, 0, true);
    expect(summary.batchSavingsUsd).toBeCloseTo(actualCost, 6);
  });

  // 6. Opus Extended Thinking 비용 추정 ($5/$25 단가 적용)
  it("Opus 모델의 비용이 $5/$25 단가로 계산된다", () => {
    // Opus: 입력 20000 토큰, 출력 10000 토큰
    const cost = calculateCost("claude-opus-4-6", 20000, 10000, 0, 0, false);

    // 입력: 20000/1M * $5 = $0.1
    // 출력: 10000/1M * $25 = $0.25
    const expectedCost = (20000 / 1_000_000) * 5.00 + (10000 / 1_000_000) * 25.00;
    expect(cost).toBeCloseTo(expectedCost, 6);
    expect(cost).toBeCloseTo(0.35, 6);
  });

  // 7. 알 수 없는 모델명 → 기본 Sonnet 단가 적용
  it("알 수 없는 모델명은 Sonnet 기본 단가로 계산된다", () => {
    const unknownCost = calculateCost("claude-unknown-9-9", 1000, 1000, 0, 0, false);
    const sonnetCost = calculateCost("claude-sonnet-4-6", 1000, 1000, 0, 0, false);

    // 기본값이 Sonnet 단가이므로 동일
    expect(unknownCost).toBeCloseTo(sonnetCost, 6);
  });

  // 8. reset() 후 getTotal() = emptySummary
  it("reset() 후 getTotal()이 빈 요약을 반환한다", () => {
    // 먼저 몇 건 기록
    tracker.record({ agentId: "spec", model: "claude-haiku-4-5", inputTokens: 3000, outputTokens: 1500 });
    tracker.record({ agentId: "codegen", model: "claude-sonnet-4-6", inputTokens: 10000, outputTokens: 8000 });

    expect(tracker.getTotal().entryCount).toBe(2);

    // reset
    tracker.reset();

    const summary = tracker.getTotal();
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
