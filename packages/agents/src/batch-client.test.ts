// batch-client.ts 단위 테스트 — createBatch, getBatchStatus, getBatchResults, cancelBatch
import { describe, it, expect, vi, beforeEach } from "vitest";

// Anthropic SDK 모킹 — 실제 API 호출 금지
vi.mock("@anthropic-ai/sdk", () => {
  // MockAnthropic 기본 클래스 모의 — messages.batches 하위 메서드 포함
  const MockAnthropic = vi.fn().mockImplementation(() => ({
    messages: {
      batches: {
        create: vi.fn(),
        retrieve: vi.fn(),
        results: vi.fn(),
        cancel: vi.fn(),
      },
    },
  }));

  return { default: MockAnthropic };
});

import Anthropic from "@anthropic-ai/sdk";
import {
  createBatch,
  getBatchStatus,
  getBatchResults,
  cancelBatch,
} from "./batch-client.js";
import type { BatchRequest } from "./batch-client.js";

// ─── 테스트용 공통 픽스처 ─────────────────────────────────────────────────────

// 테스트용 배치 요청 항목 빌더
function buildBatchRequest(customId = "req-1"): BatchRequest {
  return {
    customId,
    options: {
      model: "claude-haiku-4-5-20251001",
      systemPrompt: "테스트 시스템 프롬프트",
      userMessage: "테스트 사용자 메시지",
    },
  };
}

// 테스트용 thinking 옵션 포함 배치 요청 빌더
function buildThinkingBatchRequest(customId = "req-think-1"): BatchRequest {
  return {
    customId,
    options: {
      model: "claude-sonnet-4-6",
      systemPrompt: "사고 시스템 프롬프트",
      userMessage: "사고가 필요한 복잡한 질문",
      thinking: { type: "enabled", budgetTokens: 8000 },
    },
  };
}

// SDK 모킹 핼퍼 — Anthropic 인스턴스 mock 메서드 접근
function getMockBatches(client: Anthropic): {
  mockCreate: ReturnType<typeof vi.fn>;
  mockRetrieve: ReturnType<typeof vi.fn>;
  mockResults: ReturnType<typeof vi.fn>;
  mockCancel: ReturnType<typeof vi.fn>;
} {
  const batches = (client as unknown as {
    messages: {
      batches: {
        create: ReturnType<typeof vi.fn>;
        retrieve: ReturnType<typeof vi.fn>;
        results: ReturnType<typeof vi.fn>;
        cancel: ReturnType<typeof vi.fn>;
      };
    };
  }).messages.batches;

  return {
    mockCreate: batches.create,
    mockRetrieve: batches.retrieve,
    mockResults: batches.results,
    mockCancel: batches.cancel,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. createBatch 테스트
// ═══════════════════════════════════════════════════════════════════════════════

describe("createBatch", () => {
  let mockClient: Anthropic;
  let mockCreate: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    // 각 테스트 전 Anthropic 클라이언트 목 초기화
    vi.clearAllMocks();
    mockClient = new Anthropic({ apiKey: "sk-ant-test-key" });
    ({ mockCreate } = getMockBatches(mockClient));
  });

  it("빈 배열 요청: VALIDATION_FAILED 에러 반환", async () => {
    // Arrange — 빈 배열 요청
    const emptyRequests: readonly BatchRequest[] = [];

    // Act
    const result = await createBatch(mockClient, emptyRequests);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
      expect(result.error.message).toContain("비어있");
    }
    // API 호출 없음
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it("정상 요청: batch ID 문자열 반환", async () => {
    // Arrange — API가 batch ID를 반환하도록 설정
    const expectedBatchId = "msgbatch_test_001";
    mockCreate.mockResolvedValue({ id: expectedBatchId });

    const requests = [buildBatchRequest("req-1"), buildBatchRequest("req-2")];

    // Act
    const result = await createBatch(mockClient, requests);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(expectedBatchId);
    }
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("정상 요청: API 호출에 요청 배열 전달됨", async () => {
    // Arrange
    mockCreate.mockResolvedValue({ id: "msgbatch_param_check_001" });
    const requests = [buildBatchRequest("my-custom-id")];

    // Act
    await createBatch(mockClient, requests);

    // Assert — API 호출에 custom_id가 올바르게 매핑됨
    const callArg = mockCreate.mock.calls[0]?.[0] as {
      requests: Array<{ custom_id: string }>;
    };
    expect(callArg.requests[0]?.custom_id).toBe("my-custom-id");
  });

  it("API 에러 시: UPSTREAM_FAILURE 에러 반환", async () => {
    // Arrange — API 에러 발생
    mockCreate.mockRejectedValue(new Error("Batch API 연결 오류"));

    const requests = [buildBatchRequest()];

    // Act
    const result = await createBatch(mockClient, requests);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UPSTREAM_FAILURE");
      expect(result.error.message).toContain("배치 생성 실패");
    }
  });

  it("API 에러 메시지: 원인 오류 메시지 포함", async () => {
    // Arrange — 명확한 에러 메시지 포함
    const errorMsg = "Rate limit exceeded for batch API";
    mockCreate.mockRejectedValue(new Error(errorMsg));

    const requests = [buildBatchRequest()];

    // Act
    const result = await createBatch(mockClient, requests);

    // Assert — 원본 에러 메시지가 결과에 포함됨
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain(errorMsg);
    }
  });

  it("thinking 옵션 포함 요청: 정상 처리됨", async () => {
    // Arrange — thinking 옵션이 있는 요청
    mockCreate.mockResolvedValue({ id: "msgbatch_thinking_001" });
    const requests = [buildThinkingBatchRequest()];

    // Act
    const result = await createBatch(mockClient, requests);

    // Assert — thinking 옵션이 있어도 성공적으로 배치 생성
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe("msgbatch_thinking_001");
    }
    expect(mockCreate).toHaveBeenCalledOnce();
  });

  it("thinking 옵션 포함 요청: API 파라미터에 thinking 필드 전달됨", async () => {
    // Arrange
    mockCreate.mockResolvedValue({ id: "msgbatch_think_param_001" });
    const requests = [buildThinkingBatchRequest()];

    // Act
    await createBatch(mockClient, requests);

    // Assert — thinking 파라미터가 API 호출에 포함됨
    const callArg = mockCreate.mock.calls[0]?.[0] as {
      requests: Array<{ params: Record<string, unknown> }>;
    };
    const params = callArg.requests[0]?.params;
    expect(params?.["thinking"]).toBeDefined();
    expect((params?.["thinking"] as { type: string }).type).toBe("enabled");
  });

  it("temperature 있는 요청: thinking 없을 때 temperature 전달됨", async () => {
    // Arrange — temperature 옵션 포함 요청
    mockCreate.mockResolvedValue({ id: "msgbatch_temp_001" });
    const requests: readonly BatchRequest[] = [
      {
        customId: "req-temp",
        options: {
          model: "claude-haiku-4-5-20251001",
          systemPrompt: "시스템",
          userMessage: "메시지",
          temperature: 0.7,
        },
      },
    ];

    // Act
    await createBatch(mockClient, requests);

    // Assert
    const callArg = mockCreate.mock.calls[0]?.[0] as {
      requests: Array<{ params: Record<string, unknown> }>;
    };
    const params = callArg.requests[0]?.params;
    expect(params?.["temperature"]).toBe(0.7);
  });

  it("thinking 있는 요청: temperature 제외됨", async () => {
    // Arrange — thinking + temperature 동시 설정 (thinking 우선)
    mockCreate.mockResolvedValue({ id: "msgbatch_no_temp_001" });
    const requests: readonly BatchRequest[] = [
      {
        customId: "req-no-temp",
        options: {
          model: "claude-sonnet-4-6",
          systemPrompt: "시스템",
          userMessage: "메시지",
          temperature: 0.5,
          thinking: { type: "adaptive" },
        },
      },
    ];

    // Act
    await createBatch(mockClient, requests);

    // Assert — thinking 활성 시 temperature 제외
    const callArg = mockCreate.mock.calls[0]?.[0] as {
      requests: Array<{ params: Record<string, unknown> }>;
    };
    const params = callArg.requests[0]?.params;
    expect(params?.["temperature"]).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. getBatchStatus 테스트
// ═══════════════════════════════════════════════════════════════════════════════

describe("getBatchStatus", () => {
  let mockClient: Anthropic;
  let mockRetrieve: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = new Anthropic({ apiKey: "sk-ant-test-key" });
    ({ mockRetrieve } = getMockBatches(mockClient));
  });

  it("정상 조회: BatchStatus 반환", async () => {
    // Arrange — API가 배치 상태 반환
    const batchId = "msgbatch_status_001";
    mockRetrieve.mockResolvedValue({
      id: batchId,
      processing_status: "in_progress",
      request_counts: {
        processing: 10,
        succeeded: 5,
        errored: 1,
        expired: 0,
        canceled: 0,
      },
    });

    // Act
    const result = await getBatchStatus(mockClient, batchId);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.batchId).toBe(batchId);
      expect(result.value.processingStatus).toBe("in_progress");
      expect(result.value.requestCounts.processing).toBe(10);
      expect(result.value.requestCounts.succeeded).toBe(5);
      expect(result.value.requestCounts.errored).toBe(1);
      expect(result.value.requestCounts.expired).toBe(0);
      expect(result.value.requestCounts.canceled).toBe(0);
    }
  });

  it("ended 상태 조회: processingStatus가 ended로 반환됨", async () => {
    // Arrange — 완료된 배치
    const batchId = "msgbatch_ended_001";
    mockRetrieve.mockResolvedValue({
      id: batchId,
      processing_status: "ended",
      request_counts: {
        processing: 0,
        succeeded: 100,
        errored: 2,
        expired: 1,
        canceled: 0,
      },
    });

    // Act
    const result = await getBatchStatus(mockClient, batchId);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.processingStatus).toBe("ended");
    }
  });

  it("canceling 상태 조회: processingStatus가 canceling으로 반환됨", async () => {
    // Arrange — 취소 중인 배치
    const batchId = "msgbatch_canceling_001";
    mockRetrieve.mockResolvedValue({
      id: batchId,
      processing_status: "canceling",
      request_counts: {
        processing: 3,
        succeeded: 7,
        errored: 0,
        expired: 0,
        canceled: 5,
      },
    });

    // Act
    const result = await getBatchStatus(mockClient, batchId);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.processingStatus).toBe("canceling");
      expect(result.value.requestCounts.canceled).toBe(5);
    }
  });

  it("올바른 batchId로 API 호출됨", async () => {
    // Arrange
    const batchId = "msgbatch_id_check_001";
    mockRetrieve.mockResolvedValue({
      id: batchId,
      processing_status: "in_progress",
      request_counts: {
        processing: 1,
        succeeded: 0,
        errored: 0,
        expired: 0,
        canceled: 0,
      },
    });

    // Act
    await getBatchStatus(mockClient, batchId);

    // Assert — 전달받은 batchId로 API 호출됨
    expect(mockRetrieve).toHaveBeenCalledWith(batchId);
  });

  it("API 에러 시: UPSTREAM_FAILURE 에러 반환", async () => {
    // Arrange — API 에러 발생
    mockRetrieve.mockRejectedValue(new Error("배치를 찾을 수 없습니다"));

    // Act
    const result = await getBatchStatus(mockClient, "non-existent-batch");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UPSTREAM_FAILURE");
      expect(result.error.message).toContain("배치 상태 조회 실패");
    }
  });

  it("API 에러 메시지: 원인 오류 메시지 포함", async () => {
    // Arrange
    const errorMsg = "Batch not found: msgbatch_404";
    mockRetrieve.mockRejectedValue(new Error(errorMsg));

    // Act
    const result = await getBatchStatus(mockClient, "msgbatch_404");

    // Assert — 원본 에러 메시지가 결과에 포함됨
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain(errorMsg);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 3. getBatchResults 테스트
// ═══════════════════════════════════════════════════════════════════════════════

describe("getBatchResults", () => {
  let mockClient: Anthropic;
  let mockResults: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = new Anthropic({ apiKey: "sk-ant-test-key" });
    ({ mockResults } = getMockBatches(mockClient));
  });

  it("succeeded 결과: BatchResult 배열에 response 포함", async () => {
    // Arrange — 성공한 배치 결과
    mockResults.mockResolvedValue(
      (async function* () {
        yield {
          custom_id: "req-1",
          result: {
            type: "succeeded",
            message: {
              content: [{ type: "text", text: "배치 응답 텍스트" }],
              model: "claude-haiku-4-5-20251001",
              usage: { input_tokens: 15, output_tokens: 25 },
              stop_reason: "end_turn",
            },
          },
        };
      })(),
    );

    // Act
    const result = await getBatchResults(mockClient, "msgbatch_success_001");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      const item = result.value[0];
      expect(item?.customId).toBe("req-1");
      expect(item?.status).toBe("succeeded");
      expect(item?.response).toBeDefined();
      expect(item?.response?.content).toBe("배치 응답 텍스트");
      expect(item?.response?.model).toBe("claude-haiku-4-5-20251001");
      expect(item?.response?.inputTokens).toBe(15);
      expect(item?.response?.outputTokens).toBe(25);
      expect(item?.response?.stopReason).toBe("end_turn");
    }
  });

  it("errored 결과: status=errored, error 필드 포함", async () => {
    // Arrange — 오류 발생한 배치 결과
    mockResults.mockResolvedValue(
      (async function* () {
        yield {
          custom_id: "req-err-1",
          result: {
            type: "errored",
            error: {
              type: "server_error",
              message: "모델 내부 오류 발생",
            },
          },
        };
      })(),
    );

    // Act
    const result = await getBatchResults(mockClient, "msgbatch_errored_001");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      const item = result.value[0];
      expect(item?.customId).toBe("req-err-1");
      expect(item?.status).toBe("errored");
      expect(item?.error).toBeDefined();
      expect(item?.response).toBeUndefined();
    }
  });

  it("errored 결과: error 필드에 원본 메시지 포함", async () => {
    // Arrange
    const errorMessage = "모델 처리 용량 초과";
    mockResults.mockResolvedValue(
      (async function* () {
        yield {
          custom_id: "req-err-2",
          result: {
            type: "errored",
            error: {
              type: "overloaded_error",
              message: errorMessage,
            },
          },
        };
      })(),
    );

    // Act
    const result = await getBatchResults(mockClient, "msgbatch_errored_msg_001");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      const item = result.value[0];
      expect(item?.error).toContain(errorMessage);
    }
  });

  it("expired 결과: status=expired 반환", async () => {
    // Arrange — 만료된 배치 결과
    mockResults.mockResolvedValue(
      (async function* () {
        yield {
          custom_id: "req-exp-1",
          result: {
            type: "expired",
          },
        };
      })(),
    );

    // Act
    const result = await getBatchResults(mockClient, "msgbatch_expired_001");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(1);
      const item = result.value[0];
      expect(item?.customId).toBe("req-exp-1");
      expect(item?.status).toBe("expired");
      expect(item?.response).toBeUndefined();
      expect(item?.error).toBeUndefined();
    }
  });

  it("혼합 결과: succeeded + errored + expired 모두 올바르게 파싱", async () => {
    // Arrange — succeeded, errored, expired 결과 혼합
    mockResults.mockResolvedValue(
      (async function* () {
        // succeeded 항목
        yield {
          custom_id: "req-mix-success",
          result: {
            type: "succeeded",
            message: {
              content: [{ type: "text", text: "성공 응답" }],
              model: "claude-haiku-4-5-20251001",
              usage: { input_tokens: 10, output_tokens: 20 },
              stop_reason: "end_turn",
            },
          },
        };
        // errored 항목
        yield {
          custom_id: "req-mix-error",
          result: {
            type: "errored",
            error: {
              type: "server_error",
              message: "처리 실패",
            },
          },
        };
        // expired 항목
        yield {
          custom_id: "req-mix-expired",
          result: {
            type: "expired",
          },
        };
      })(),
    );

    // Act
    const result = await getBatchResults(mockClient, "msgbatch_mixed_001");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(3);

      // succeeded 검증
      const successItem = result.value.find((r) => r.customId === "req-mix-success");
      expect(successItem?.status).toBe("succeeded");
      expect(successItem?.response?.content).toBe("성공 응답");

      // errored 검증
      const errorItem = result.value.find((r) => r.customId === "req-mix-error");
      expect(errorItem?.status).toBe("errored");
      expect(errorItem?.error).toBeDefined();

      // expired 검증
      const expiredItem = result.value.find((r) => r.customId === "req-mix-expired");
      expect(expiredItem?.status).toBe("expired");
      expect(expiredItem?.response).toBeUndefined();
      expect(expiredItem?.error).toBeUndefined();
    }
  });

  it("혼합 결과: succeeded 항목 수 정확히 파악", async () => {
    // Arrange — 성공 2개, 오류 1개, 만료 1개
    mockResults.mockResolvedValue(
      (async function* () {
        yield {
          custom_id: "s1",
          result: {
            type: "succeeded",
            message: {
              content: [{ type: "text", text: "응답1" }],
              model: "claude-haiku-4-5-20251001",
              usage: { input_tokens: 5, output_tokens: 10 },
              stop_reason: "end_turn",
            },
          },
        };
        yield {
          custom_id: "s2",
          result: {
            type: "succeeded",
            message: {
              content: [{ type: "text", text: "응답2" }],
              model: "claude-haiku-4-5-20251001",
              usage: { input_tokens: 5, output_tokens: 10 },
              stop_reason: "end_turn",
            },
          },
        };
        yield {
          custom_id: "e1",
          result: {
            type: "errored",
            error: { type: "server_error", message: "오류" },
          },
        };
        yield {
          custom_id: "x1",
          result: { type: "expired" },
        };
      })(),
    );

    // Act
    const result = await getBatchResults(mockClient, "msgbatch_count_001");

    // Assert — 전체 4개 중 성공 2개만 response 필드 보유
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(4);
      const succeededCount = result.value.filter((r) => r.status === "succeeded").length;
      const erroredCount = result.value.filter((r) => r.status === "errored").length;
      const expiredCount = result.value.filter((r) => r.status === "expired").length;
      expect(succeededCount).toBe(2);
      expect(erroredCount).toBe(1);
      expect(expiredCount).toBe(1);
    }
  });

  it("succeeded 결과에 text 블록 없음: response 미포함", async () => {
    // Arrange — content에 text 블록이 없는 succeeded 결과
    mockResults.mockResolvedValue(
      (async function* () {
        yield {
          custom_id: "req-no-text",
          result: {
            type: "succeeded",
            message: {
              content: [],
              model: "claude-haiku-4-5-20251001",
              usage: { input_tokens: 5, output_tokens: 0 },
              stop_reason: "end_turn",
            },
          },
        };
      })(),
    );

    // Act
    const result = await getBatchResults(mockClient, "msgbatch_no_text_001");

    // Assert — text 블록 없으면 response가 undefined
    expect(result.ok).toBe(true);
    if (result.ok) {
      const item = result.value[0];
      expect(item?.status).toBe("succeeded");
      expect(item?.response).toBeUndefined();
    }
  });

  it("빈 결과: 빈 배열 반환", async () => {
    // Arrange — 결과가 없는 배치
    mockResults.mockResolvedValue(
      (async function* () {
        // 아무것도 yield하지 않음
      })(),
    );

    // Act
    const result = await getBatchResults(mockClient, "msgbatch_empty_001");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(0);
    }
  });

  it("API 에러 시: UPSTREAM_FAILURE 에러 반환", async () => {
    // Arrange — results() 자체가 에러 발생
    mockResults.mockRejectedValue(new Error("배치 결과 조회 불가"));

    // Act
    const result = await getBatchResults(mockClient, "msgbatch_fail_001");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UPSTREAM_FAILURE");
      expect(result.error.message).toContain("배치 결과 조회 실패");
    }
  });

  it("API 에러 메시지: 원인 오류 메시지 포함", async () => {
    // Arrange
    const errorMsg = "Batch results unavailable: expired batch";
    mockResults.mockRejectedValue(new Error(errorMsg));

    // Act
    const result = await getBatchResults(mockClient, "msgbatch_err_msg_001");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain(errorMsg);
    }
  });

  it("올바른 batchId로 results API 호출됨", async () => {
    // Arrange
    const batchId = "msgbatch_id_verify_001";
    mockResults.mockResolvedValue(
      (async function* () {
        // 빈 결과
      })(),
    );

    // Act
    await getBatchResults(mockClient, batchId);

    // Assert — 전달받은 batchId로 API 호출됨
    expect(mockResults).toHaveBeenCalledWith(batchId);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// 4. cancelBatch 테스트
// ═══════════════════════════════════════════════════════════════════════════════

describe("cancelBatch", () => {
  let mockClient: Anthropic;
  let mockCancel: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockClient = new Anthropic({ apiKey: "sk-ant-test-key" });
    ({ mockCancel } = getMockBatches(mockClient));
  });

  it("정상 취소: ok(undefined) 반환", async () => {
    // Arrange — 취소 성공
    mockCancel.mockResolvedValue(undefined);

    // Act
    const result = await cancelBatch(mockClient, "msgbatch_cancel_001");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeUndefined();
    }
  });

  it("정상 취소: API가 객체 반환해도 ok(undefined)", async () => {
    // Arrange — API가 취소된 배치 객체를 반환 (SDK가 자체 정리)
    mockCancel.mockResolvedValue({ id: "msgbatch_cancel_002", processing_status: "canceling" });

    // Act
    const result = await cancelBatch(mockClient, "msgbatch_cancel_002");

    // Assert — 반환값은 항상 undefined
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBeUndefined();
    }
  });

  it("올바른 batchId로 cancel API 호출됨", async () => {
    // Arrange
    const batchId = "msgbatch_id_cancel_check";
    mockCancel.mockResolvedValue(undefined);

    // Act
    await cancelBatch(mockClient, batchId);

    // Assert — 전달받은 batchId로 API 호출됨
    expect(mockCancel).toHaveBeenCalledWith(batchId);
  });

  it("API 에러 시: UPSTREAM_FAILURE 에러 반환", async () => {
    // Arrange — 취소 중 에러 발생
    mockCancel.mockRejectedValue(new Error("배치를 취소할 수 없습니다"));

    // Act
    const result = await cancelBatch(mockClient, "msgbatch_cancel_fail");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UPSTREAM_FAILURE");
      expect(result.error.message).toContain("배치 취소 실패");
    }
  });

  it("API 에러 메시지: 원인 오류 메시지 포함", async () => {
    // Arrange
    const errorMsg = "Cannot cancel batch in ended state";
    mockCancel.mockRejectedValue(new Error(errorMsg));

    // Act
    const result = await cancelBatch(mockClient, "msgbatch_ended_cancel");

    // Assert — 원본 에러 메시지가 결과에 포함됨
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.message).toContain(errorMsg);
    }
  });

  it("비 Error 객체 예외: UPSTREAM_FAILURE 에러 반환", async () => {
    // Arrange — Error 인스턴스가 아닌 예외 (문자열 throw)
    mockCancel.mockRejectedValue("unexpected string error");

    // Act
    const result = await cancelBatch(mockClient, "msgbatch_non_error");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("UPSTREAM_FAILURE");
      expect(result.error.message).toContain("unexpected string error");
    }
  });
});
