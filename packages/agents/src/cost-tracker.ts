// Cost Tracker — 에이전트별/모델별 API 비용 추적
import { nowISO } from "@jarvis/shared";

// 모델별 토큰 단가 (USD per 1M tokens) — 2026-03 기준
export const MODEL_PRICING: Readonly<Record<string, { input: number; output: number }>> = {
  "claude-opus-4-6": { input: 5.00, output: 25.00 },
  "claude-sonnet-4-6": { input: 3.00, output: 15.00 },
  "claude-haiku-4-5": { input: 1.00, output: 5.00 },
  // 레거시 모델 호환
  "claude-opus-4-5": { input: 5.00, output: 25.00 },
  "claude-sonnet-4-5": { input: 3.00, output: 15.00 },
};

// Prompt Caching 할인율
const CACHE_CREATION_RATE = 1.25; // 캐시 생성: 입력 단가의 125%
const CACHE_READ_RATE = 0.10; // 캐시 읽기: 입력 단가의 10%
const BATCH_DISCOUNT = 0.50; // Batch API: 50% 할인

// 비용 기록 항목
export interface CostEntry {
  readonly timestamp: string;
  readonly agentId: string;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly cacheCreationTokens: number;
  readonly cacheReadTokens: number;
  readonly estimatedCostUsd: number;
  readonly isBatch: boolean;
}

// 비용 요약
export interface CostSummary {
  readonly totalCostUsd: number;
  readonly totalInputTokens: number;
  readonly totalOutputTokens: number;
  readonly totalCacheCreationTokens: number;
  readonly totalCacheReadTokens: number;
  readonly entryCount: number;
  readonly batchSavingsUsd: number;
  readonly cacheSavingsUsd: number;
}

// 빈 요약 생성
function emptySummary(): CostSummary {
  return {
    totalCostUsd: 0,
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCacheCreationTokens: 0,
    totalCacheReadTokens: 0,
    entryCount: 0,
    batchSavingsUsd: 0,
    cacheSavingsUsd: 0,
  };
}

// 비용 계산 — 모델 단가 + 캐시 할인 + 배치 할인 적용
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheCreationTokens: number,
  cacheReadTokens: number,
  isBatch: boolean,
): number {
  const pricing = MODEL_PRICING[model] ?? { input: 3.00, output: 15.00 }; // 기본값: Sonnet 단가

  // 일반 입력 비용 (캐시 토큰 제외)
  const regularInputTokens = Math.max(0, inputTokens - cacheCreationTokens - cacheReadTokens);
  const inputCost = (regularInputTokens / 1_000_000) * pricing.input;

  // 캐시 생성 비용
  const cacheCreateCost = (cacheCreationTokens / 1_000_000) * pricing.input * CACHE_CREATION_RATE;

  // 캐시 읽기 비용 (90% 할인)
  const cacheReadCost = (cacheReadTokens / 1_000_000) * pricing.input * CACHE_READ_RATE;

  // 출력 비용
  const outputCost = (outputTokens / 1_000_000) * pricing.output;

  // 총 비용
  let totalCost = inputCost + cacheCreateCost + cacheReadCost + outputCost;

  // Batch API 50% 할인 적용
  if (isBatch) {
    totalCost *= BATCH_DISCOUNT;
  }

  return totalCost;
}

// 인메모리 비용 추적기 — 에이전트별/모델별 집계
export class CostTracker {
  private entries: CostEntry[] = [];

  // 비용 기록 추가
  record(params: {
    agentId: string;
    model: string;
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens?: number;
    cacheReadTokens?: number;
    isBatch?: boolean;
  }): CostEntry {
    const cacheCreation = params.cacheCreationTokens ?? 0;
    const cacheRead = params.cacheReadTokens ?? 0;
    const isBatch = params.isBatch ?? false;

    const estimatedCostUsd = calculateCost(
      params.model,
      params.inputTokens,
      params.outputTokens,
      cacheCreation,
      cacheRead,
      isBatch,
    );

    const entry: CostEntry = {
      timestamp: nowISO(),
      agentId: params.agentId,
      model: params.model,
      inputTokens: params.inputTokens,
      outputTokens: params.outputTokens,
      cacheCreationTokens: cacheCreation,
      cacheReadTokens: cacheRead,
      estimatedCostUsd,
      isBatch,
    };

    this.entries.push(entry);
    return entry;
  }

  // 전체 비용 요약
  getTotal(): CostSummary {
    return this.summarize(this.entries);
  }

  // 에이전트별 비용 요약
  getByAgent(agentId: string): CostSummary {
    return this.summarize(this.entries.filter((e) => e.agentId === agentId));
  }

  // 모델별 비용 요약
  getByModel(model: string): CostSummary {
    return this.summarize(this.entries.filter((e) => e.model === model));
  }

  // 모든 기록 조회
  getEntries(): readonly CostEntry[] {
    return this.entries;
  }

  // 기록 초기화
  reset(): void {
    this.entries = [];
  }

  // 요약 계산
  private summarize(entries: readonly CostEntry[]): CostSummary {
    if (entries.length === 0) return emptySummary();

    let totalCostUsd = 0;
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let totalCacheCreationTokens = 0;
    let totalCacheReadTokens = 0;
    let batchSavingsUsd = 0;
    let cacheSavingsUsd = 0;

    for (const entry of entries) {
      totalCostUsd += entry.estimatedCostUsd;
      totalInputTokens += entry.inputTokens;
      totalOutputTokens += entry.outputTokens;
      totalCacheCreationTokens += entry.cacheCreationTokens;
      totalCacheReadTokens += entry.cacheReadTokens;

      // Batch 절감액 계산
      if (entry.isBatch) {
        batchSavingsUsd += entry.estimatedCostUsd; // 50% 할인이므로 같은 금액 절감
      }

      // Cache 절감액 계산 — 캐시 읽기 토큰의 원래 비용 대비 절감
      if (entry.cacheReadTokens > 0) {
        const pricing = MODEL_PRICING[entry.model] ?? { input: 3.00, output: 15.00 };
        const fullCost = (entry.cacheReadTokens / 1_000_000) * pricing.input;
        const cachedCost = (entry.cacheReadTokens / 1_000_000) * pricing.input * CACHE_READ_RATE;
        cacheSavingsUsd += fullCost - cachedCost;
      }
    }

    return {
      totalCostUsd,
      totalInputTokens,
      totalOutputTokens,
      totalCacheCreationTokens,
      totalCacheReadTokens,
      entryCount: entries.length,
      batchSavingsUsd,
      cacheSavingsUsd,
    };
  }
}
