// Claude API 클라이언트 래퍼 — 재시도, JSON 파싱, Zod 검증, Extended Thinking, Prompt Caching 통합
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { Result, JarvisError } from "@jarvis/shared";
import { ok, err, createError } from "@jarvis/shared";

// Extended Thinking 옵션 — adaptive (Opus 4.6/Sonnet 4.6) 또는 enabled (레거시)
export type ThinkingOption =
  | { readonly type: "adaptive" }
  | { readonly type: "enabled"; readonly budgetTokens: number };

// Claude API 호출 옵션
export interface ClaudeCallOptions {
  readonly model: string;
  readonly systemPrompt: string;
  readonly userMessage: string;
  readonly maxTokens?: number;
  readonly temperature?: number;
  // Phase 1: Extended Thinking 지원
  readonly thinking?: ThinkingOption;
  // Phase 1: Prompt Caching — system 메시지에 cache_control 적용
  readonly cacheControl?: boolean;
}

// Claude API 응답 구조
export interface ClaudeResponse {
  readonly content: string;
  readonly model: string;
  readonly inputTokens: number;
  readonly outputTokens: number;
  readonly stopReason: string | null;
  // Phase 1: Extended Thinking 응답
  readonly thinkingContent?: string;
  // Phase 2: Prompt Caching 토큰 사용량
  readonly cacheCreationInputTokens?: number;
  readonly cacheReadInputTokens?: number;
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

// system 메시지 파라미터 빌드 — cacheControl 옵션에 따라 포맷 결정
function buildSystemParam(
  systemPrompt: string,
  cacheControl: boolean,
): string | Array<{ type: "text"; text: string; cache_control?: { type: "ephemeral" } }> {
  if (!cacheControl) {
    return systemPrompt;
  }
  // Prompt Caching: cache_control 블록 포함 배열 형태로 반환
  return [
    {
      type: "text" as const,
      text: systemPrompt,
      cache_control: { type: "ephemeral" as const },
    },
  ];
}

// API 요청 파라미터 빌드
function buildCreateParams(
  options: ClaudeCallOptions,
): Record<string, unknown> {
  const {
    model,
    systemPrompt,
    userMessage,
    maxTokens = DEFAULT_MAX_TOKENS,
    temperature = DEFAULT_TEMPERATURE,
    thinking,
    cacheControl = false,
  } = options;

  const params: Record<string, unknown> = {
    model,
    messages: [{ role: "user", content: userMessage }],
    system: buildSystemParam(systemPrompt, cacheControl),
  };

  if (thinking) {
    // Extended Thinking 활성화 시 temperature 사용 불가 (API 제약)
    params["thinking"] = thinking.type === "adaptive"
      ? { type: "adaptive" }
      : { type: "enabled", budget_tokens: thinking.budgetTokens };

    // thinking 활성화 시 max_tokens 자동 조정
    if (thinking.type === "enabled") {
      params["max_tokens"] = Math.max(maxTokens, thinking.budgetTokens + 4096);
    } else {
      params["max_tokens"] = maxTokens;
    }
    // temperature 제거 — thinking과 동시 사용 불가
  } else {
    params["max_tokens"] = maxTokens;
    params["temperature"] = temperature;
  }

  return params;
}

// 응답에서 텍스트와 thinking 블록 추출
function extractResponseContent(
  response: Anthropic.Message,
): { text: string | null; thinking: string | null } {
  let text: string | null = null;
  let thinking: string | null = null;

  for (const block of response.content) {
    if (block.type === "text") {
      text = block.text;
    } else if (block.type === "thinking" && "thinking" in block) {
      thinking = (block as { type: "thinking"; thinking: string }).thinking;
    }
  }

  return { text, thinking };
}

// Claude API 호출 — 지수 백오프 재시도 (429/500/529), Extended Thinking + Prompt Caching 지원
export async function callClaude(
  client: Anthropic,
  options: ClaudeCallOptions,
): Promise<Result<ClaudeResponse, JarvisError>> {
  const params = buildCreateParams(options);

  let lastError: unknown = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API 파라미터 동적 구성
      const response = await client.messages.create(params as any);

      const { text, thinking } = extractResponseContent(response);

      if (!text) {
        return err(
          createError("INTERNAL_ERROR", "Claude 응답에 텍스트 블록이 없습니다", {
            context: { model: options.model, stopReason: response.stop_reason },
          }),
        );
      }

      // usage에서 캐시 토큰 정보 추출
      const usage = response.usage as unknown as Record<string, unknown>;

      return ok({
        content: text,
        model: response.model,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        stopReason: response.stop_reason,
        thinkingContent: thinking ?? undefined,
        cacheCreationInputTokens: typeof usage["cache_creation_input_tokens"] === "number"
          ? usage["cache_creation_input_tokens"]
          : undefined,
        cacheReadInputTokens: typeof usage["cache_read_input_tokens"] === "number"
          ? usage["cache_read_input_tokens"]
          : undefined,
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
      context: { model: options.model, attempts: MAX_RETRIES },
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
