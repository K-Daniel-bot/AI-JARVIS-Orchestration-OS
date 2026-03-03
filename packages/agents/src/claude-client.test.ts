// claude-client.ts 단위 테스트 — callClaude, parseJsonResponse, createAnthropicClient
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { z } from "zod";

// Anthropic SDK 모킹 — 실제 API 호출 금지
vi.mock("@anthropic-ai/sdk", () => {
  // APIError 모의 클래스 — status 필드 포함
  class MockAPIError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
      super(message);
      this.name = "APIError";
      this.status = status;
    }
  }

  // APIConnectionError 모의 클래스
  class MockAPIConnectionError extends Error {
    constructor(message: string) {
      super(message);
      this.name = "APIConnectionError";
    }
  }

  // Anthropic 기본 클래스 모의
  const MockAnthropic = vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn(),
    },
  }));

  // 정적 에러 클래스 첨부
  Object.assign(MockAnthropic, {
    APIError: MockAPIError,
    APIConnectionError: MockAPIConnectionError,
  });

  return { default: MockAnthropic };
});

import Anthropic from "@anthropic-ai/sdk";
import { callClaude, parseJsonResponse, createAnthropicClient } from "./claude-client.js";

// 테스트용 기본 설정
const BASE_OPTIONS = {
  model: "claude-haiku-4-5-20251001",
  systemPrompt: "테스트 시스템 프롬프트",
  userMessage: "테스트 사용자 메시지",
};

// 정상 텍스트 응답 빌더
function buildSuccessResponse(text: string): Anthropic.Message {
  return {
    id: "msg_test_001",
    type: "message",
    role: "assistant",
    content: [{ type: "text", text }],
    model: "claude-haiku-4-5-20251001",
    stop_reason: "end_turn",
    stop_sequence: null,
    usage: { input_tokens: 10, output_tokens: 20 },
  } as unknown as Anthropic.Message;
}

// ─── callClaude 테스트 ───────────────────────────────────────────────────────

describe("callClaude", () => {
  let mockClient: Anthropic;
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // 각 테스트 전 Anthropic 클라이언트 목 초기화
    vi.useFakeTimers();
    mockCreate = vi.fn();
    mockClient = {
      messages: { create: mockCreate },
    } as unknown as Anthropic;
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it("정상 응답: 텍스트 블록이 있을 때 ClaudeResponse ok 반환", async () => {
    // Arrange
    const responseText = "안녕하세요, 테스트 응답입니다.";
    mockCreate.mockResolvedValue(buildSuccessResponse(responseText));

    // Act
    const result = await callClaude(mockClient, BASE_OPTIONS);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.content).toBe(responseText);
      expect(result.value.model).toBe("claude-haiku-4-5-20251001");
      expect(result.value.inputTokens).toBe(10);
      expect(result.value.outputTokens).toBe(20);
      expect(result.value.stopReason).toBe("end_turn");
    }
  });

  it("텍스트 블록 없음: INTERNAL_ERROR 반환", async () => {
    // Arrange — 텍스트 블록이 없는 응답 (tool_use 블록만 존재)
    mockCreate.mockResolvedValue({
      id: "msg_test_002",
      type: "message",
      role: "assistant",
      content: [],
      model: "claude-haiku-4-5-20251001",
      stop_reason: "end_turn",
      stop_sequence: null,
      usage: { input_tokens: 5, output_tokens: 0 },
    });

    // Act
    const result = await callClaude(mockClient, BASE_OPTIONS);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("INTERNAL_ERROR");
      expect(result.error.message).toContain("텍스트 블록");
    }
  });

  it("APIError 429: 재시도 후 성공", async () => {
    // Arrange — 첫 번째 호출은 429, 두 번째 호출은 성공
    const api429Error = new (Anthropic as unknown as { APIError: new (status: number, msg: string) => Error }).APIError(429, "Rate limit exceeded");
    mockCreate
      .mockRejectedValueOnce(api429Error)
      .mockResolvedValueOnce(buildSuccessResponse("재시도 성공"));

    // Act
    const resultPromise = callClaude(mockClient, BASE_OPTIONS);
    // 지수 백오프 타이머 진행
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    // Assert
    expect(result.ok).toBe(true);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("APIConnectionError: 재시도 후 성공", async () => {
    // Arrange — 연결 에러 후 성공
    const connError = new (Anthropic as unknown as { APIConnectionError: new (msg: string) => Error }).APIConnectionError("Connection refused");
    mockCreate
      .mockRejectedValueOnce(connError)
      .mockResolvedValueOnce(buildSuccessResponse("연결 재시도 성공"));

    // Act
    const resultPromise = callClaude(mockClient, BASE_OPTIONS);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    // Assert
    expect(result.ok).toBe(true);
    expect(mockCreate).toHaveBeenCalledTimes(2);
  });

  it("비재시도 APIError (400): 즉시 UPSTREAM_FAILURE 반환", async () => {
    // Arrange — 재시도 불가능한 400 에러
    const api400Error = new (Anthropic as unknown as { APIError: new (status: number, msg: string) => Error }).APIError(400, "Bad request");
    mockCreate.mockRejectedValue(api400Error);

    // Act
    const resultPromise = callClaude(mockClient, BASE_OPTIONS);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UPSTREAM_FAILURE");
    }
    // 재시도 없이 1회만 호출
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });

  it("APIError 429 3회 연속: MAX_RETRIES 초과 후 UPSTREAM_FAILURE 반환", async () => {
    // Arrange — 모든 재시도에서 429
    const api429Error = new (Anthropic as unknown as { APIError: new (status: number, msg: string) => Error }).APIError(429, "Rate limit exceeded");
    mockCreate.mockRejectedValue(api429Error);

    // Act
    const resultPromise = callClaude(mockClient, BASE_OPTIONS);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UPSTREAM_FAILURE");
      expect(result.error.message).toContain("Claude API 호출 실패");
    }
    // MAX_RETRIES(3)회 시도
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });

  it("APIConnectionError 3회 연속: UPSTREAM_FAILURE 반환", async () => {
    // Arrange
    const connError = new (Anthropic as unknown as { APIConnectionError: new (msg: string) => Error }).APIConnectionError("Persistent connection error");
    mockCreate.mockRejectedValue(connError);

    // Act
    const resultPromise = callClaude(mockClient, BASE_OPTIONS);
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UPSTREAM_FAILURE");
    }
    expect(mockCreate).toHaveBeenCalledTimes(3);
  });
});

// ─── parseJsonResponse 테스트 ────────────────────────────────────────────────

describe("parseJsonResponse", () => {
  // 테스트용 Zod 스키마
  const TestSchema = z.object({
    name: z.string(),
    value: z.number(),
  });

  it("정상 JSON 문자열: 파싱 성공 + 스키마 검증 통과", () => {
    // Arrange
    const content = '{"name": "테스트", "value": 42}';

    // Act
    const result = parseJsonResponse(content, TestSchema);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("테스트");
      expect(result.value.value).toBe(42);
    }
  });

  it("```json 코드 블록 감싸인 경우: 블록에서 JSON 추출 성공", () => {
    // Arrange
    const content = `다음은 응답입니다:\n\`\`\`json\n{"name": "코드블록", "value": 100}\n\`\`\``;

    // Act
    const result = parseJsonResponse(content, TestSchema);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("코드블록");
      expect(result.value.value).toBe(100);
    }
  });

  it("``` (언어 없는) 코드 블록: JSON 추출 성공", () => {
    // Arrange
    const content = "```\n{\"name\": \"노언어블록\", \"value\": 7}\n```";

    // Act
    const result = parseJsonResponse(content, TestSchema);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.name).toBe("노언어블록");
    }
  });

  it("잘못된 JSON: VALIDATION_FAILED + 파싱 에러 메시지", () => {
    // Arrange
    const content = "이것은 { 잘못된 JSON입니다 }}}";

    // Act
    const result = parseJsonResponse(content, TestSchema);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
      expect(result.error.message).toContain("JSON 파싱 실패");
    }
  });

  it("Zod 스키마 불일치: VALIDATION_FAILED + 스키마 검증 에러", () => {
    // Arrange — name 필드가 없는 JSON
    const content = '{"notName": "잘못된 필드", "value": 10}';

    // Act
    const result = parseJsonResponse(content, TestSchema);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
      expect(result.error.message).toContain("스키마 검증 실패");
    }
  });

  it("Zod 타입 불일치: value가 string이면 VALIDATION_FAILED", () => {
    // Arrange — value 필드 타입이 잘못됨
    const content = '{"name": "테스트", "value": "숫자여야함"}';

    // Act
    const result = parseJsonResponse(content, TestSchema);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
    }
  });
});

// ─── createAnthropicClient 테스트 ────────────────────────────────────────────

describe("createAnthropicClient", () => {
  const ORIGINAL_ENV = process.env["ANTHROPIC_API_KEY"];

  afterEach(() => {
    // 환경변수 복원
    if (ORIGINAL_ENV === undefined) {
      delete process.env["ANTHROPIC_API_KEY"];
    } else {
      process.env["ANTHROPIC_API_KEY"] = ORIGINAL_ENV;
    }
  });

  it("API 키 없을 때: throw Error", () => {
    // Arrange
    delete process.env["ANTHROPIC_API_KEY"];

    // Act & Assert
    expect(() => createAnthropicClient()).toThrow(
      "ANTHROPIC_API_KEY 환경변수가 설정되지 않았거나 기본값입니다",
    );
  });

  it("기본값 플레이스홀더 키일 때: throw Error", () => {
    // Arrange
    process.env["ANTHROPIC_API_KEY"] = "sk-ant-v2-YOUR-API-KEY-HERE";

    // Act & Assert
    expect(() => createAnthropicClient()).toThrow(
      "ANTHROPIC_API_KEY 환경변수가 설정되지 않았거나 기본값입니다",
    );
  });

  it("유효한 API 키: Anthropic 인스턴스 반환", () => {
    // Arrange
    process.env["ANTHROPIC_API_KEY"] = "sk-ant-v2-real-api-key-12345";

    // Act
    const client = createAnthropicClient();

    // Assert — Anthropic 생성자가 호출되었는지 확인
    expect(client).toBeDefined();
  });
});
