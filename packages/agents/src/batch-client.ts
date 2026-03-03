// Batch API 클라이언트 — 비동기 일괄 처리 (50% 비용 절감)
import Anthropic from "@anthropic-ai/sdk";
import type { Result, JarvisError } from "@jarvis/shared";
import { ok, err, createError } from "@jarvis/shared";
import type { ClaudeCallOptions, ClaudeResponse } from "./claude-client.js";

// 배치 요청 항목
export interface BatchRequest {
  readonly customId: string;
  readonly options: ClaudeCallOptions;
}

// 배치 결과 항목
export interface BatchResult {
  readonly customId: string;
  readonly response?: ClaudeResponse;
  readonly status: "succeeded" | "errored" | "expired";
  readonly error?: string;
}

// 배치 상태
export interface BatchStatus {
  readonly batchId: string;
  readonly processingStatus: "in_progress" | "canceling" | "ended";
  readonly requestCounts: {
    readonly processing: number;
    readonly succeeded: number;
    readonly errored: number;
    readonly expired: number;
    readonly canceled: number;
  };
}

// Batch API 요청 파라미터 빌드 — ClaudeCallOptions → messages.create 파라미터
function buildBatchParams(options: ClaudeCallOptions): Record<string, unknown> {
  const params: Record<string, unknown> = {
    model: options.model,
    max_tokens: options.maxTokens ?? 4096,
    system: options.systemPrompt,
    messages: [{ role: "user", content: options.userMessage }],
  };
  if (options.temperature !== undefined && !options.thinking) {
    params["temperature"] = options.temperature;
  }
  if (options.thinking) {
    params["thinking"] = options.thinking.type === "adaptive"
      ? { type: "adaptive" }
      : { type: "enabled", budget_tokens: options.thinking.budgetTokens };
  }
  return params;
}

// 배치 생성 — 여러 요청을 일괄 제출하고 batch ID 반환
export async function createBatch(
  client: Anthropic,
  requests: readonly BatchRequest[],
): Promise<Result<string, JarvisError>> {
  if (requests.length === 0) {
    return err(createError("VALIDATION_FAILED", "배치 요청이 비어있습니다"));
  }

  try {
    const batchRequests = requests.map((req) => ({
      custom_id: req.customId,
      params: buildBatchParams(req.options),
    }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Batch API 파라미터 동적 구성
    const batch = await client.messages.batches.create({ requests: batchRequests as any });
    return ok(batch.id);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return err(createError("UPSTREAM_FAILURE", `배치 생성 실패: ${msg}`));
  }
}

// 배치 상태 조회
export async function getBatchStatus(
  client: Anthropic,
  batchId: string,
): Promise<Result<BatchStatus, JarvisError>> {
  try {
    const batch = await client.messages.batches.retrieve(batchId);
    return ok({
      batchId: batch.id,
      processingStatus: batch.processing_status,
      requestCounts: batch.request_counts,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return err(createError("UPSTREAM_FAILURE", `배치 상태 조회 실패: ${msg}`));
  }
}

// 배치 결과 조회 — 완료된 배치의 결과를 순회
export async function getBatchResults(
  client: Anthropic,
  batchId: string,
): Promise<Result<readonly BatchResult[], JarvisError>> {
  try {
    const results: BatchResult[] = [];

    for await (const result of await client.messages.batches.results(batchId)) {
      if (result.result.type === "succeeded") {
        const message = result.result.message;
        const textBlock = message.content.find(
          (block: { type: string }): boolean => block.type === "text",
        );
        results.push({
          customId: result.custom_id,
          status: "succeeded",
          response: textBlock ? {
            content: (textBlock as { text: string }).text,
            model: message.model,
            inputTokens: message.usage.input_tokens,
            outputTokens: message.usage.output_tokens,
            stopReason: message.stop_reason,
          } : undefined,
        });
      } else if (result.result.type === "errored") {
        results.push({
          customId: result.custom_id,
          status: "errored",
          error: "message" in result.result.error ? String(result.result.error.message) : "Unknown error",
        });
      } else {
        results.push({
          customId: result.custom_id,
          status: "expired",
        });
      }
    }

    return ok(results);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return err(createError("UPSTREAM_FAILURE", `배치 결과 조회 실패: ${msg}`));
  }
}

// 배치 취소
export async function cancelBatch(
  client: Anthropic,
  batchId: string,
): Promise<Result<void, JarvisError>> {
  try {
    await client.messages.batches.cancel(batchId);
    return ok(undefined);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return err(createError("UPSTREAM_FAILURE", `배치 취소 실패: ${msg}`));
  }
}
