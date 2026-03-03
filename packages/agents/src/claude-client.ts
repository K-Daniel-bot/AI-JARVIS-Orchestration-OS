// Claude API 클라이언트 래퍼 — 재시도, JSON 파싱, Zod 검증 통합
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Result, JarvisError } from "@jarvis/shared";
import { ok, err, createError } from "@jarvis/shared";

// Claude API 호출 옵션
export interface ClaudeCallOptions {
  readonly model: string;
  readonly systemPrompt: string;
  readonly userMessage: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
}

// Claude API 응답 구조
export interface ClaudeResponse {
  readonly content: string;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly stopReason: string | null;
}

// 재시도 가능한 HTTP 상태 코드
const RETRYABLE_STATUS_CODES = new Set([429, 500, 529]);

// 기본 설정
const DEFAULT_MAX_TOKENS = 4096;
const DEFAULT_TEMPERATURE = 0.2;
const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

// Anthropic 클라이언트 팩토리 — 환경변수에서 API 키 로드
export function createAnthropicClient(): Anthropic {
  const apiKey = process.env["ANTHROPIC_API_KEY"];
  if (!apiKey || apiKey === "sk-ant-v2-YOUR-API-KEY-HERE") {
    throw new Error("ANTHROPIC_API_KEY 환경변수가 설정되지 않았거나 기본값입니다");
  }
  return new Anthropic({ apiKey });
}

// Claude API 호출 — 지수 백오프 재시도 (429/500/529)
export async function callClaude(
  client: Anthropic,
  options: ClaudeCallOptions,
): Promise<Result<ClaudeResponse, JarvisError>> {
  const {
    model,
    systemPrompt,
    userMessage,
    maxTokens = DEFAULT_MAX_TOKENS,
    temperature = DEFAULT_TEMPERATURE,
  } = options;

  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: systemPrompt,
        messages: [{ role: "user", content: userMessage }],
      });

      // 텍스트 블록 추출
      const textBlock = response.content.find(
        (block): block is Anthropic.TextBlock => block.type === "text",
      );

      if (!textBlock) {
        return err(
          createError("INTERNAL_ERROR", "Claude 응답에 텍스트 블록이 없습니다", {
            context: { model, stopReason: response.stop_reason },
          }),
        );
      }

      return ok({
        content: textBlock.text,
        model: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        stopReason: response.stop_reason,
      });
    } catch (error: unknown) {
      lastError = error;

      // API 상태 에러 — 재시도 가능한 코드인지 확인
      if (
        error instanceof Anthropic.APIError &&
        typeof error.status === "number" &&
        RETRYABLE_STATUS_CODES.has(error.status)
      ) {
        if (attempt < MAX_RETRIES - 1) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          await sleep(delay);
          continue;
        }
      }

      // 연결 에러 — 재시도
      if (error instanceof Anthropic.APIConnectionError) {
        if (attempt < MAX_RETRIES - 1) {
          const delay = BASE_DELAY_MS * Math.pow(2, attempt);
          await sleep(delay);
          continue;
        }
      }

      // 재시도 불가능한 에러 — 즉시 반환
      break;
    }
  }

  // 모든 재시도 실패
  const errorMessage = lastError instanceof Error
    ? lastError.message
    : String(lastError);

  return err(
    createError("UPSTREAM_FAILURE", `Claude API 호출 실패: ${errorMessage}`, {
      context: { model, attempts: MAX_RETRIES },
    }),
  );
}

// Claude 응답에서 JSON 추출 + Zod 검증
export function parseJsonResponse<T>(
  content: string,
  schema: z.ZodType<T>,
): Result<T, JarvisError> {
  // ```json 코드 블록에서 JSON 추출
  const jsonBlockMatch = content.match(/```(?:json)?\s*\n([\s\S]*?)\n```/);
  const jsonStr = jsonBlockMatch !== null ? (jsonBlockMatch[1] ?? content.trim()) : content.trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonStr);
  } catch {
    return err(
      createError("VALIDATION_FAILED", "Claude 응답 JSON 파싱 실패", {
        context: { rawContent: content.slice(0, 200) },
      }),
    );
  }

  // Zod 스키마 검증
  const result = schema.safeParse(parsed);
  if (!result.success) {
    return err(
      createError("VALIDATION_FAILED", `Claude 응답 스키마 검증 실패: ${result.error.message}`, {
        context: { issues: result.error.issues as unknown[] },
      }),
    );
  }

  return ok(result.data);
}

// 비동기 대기 유틸리티
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
