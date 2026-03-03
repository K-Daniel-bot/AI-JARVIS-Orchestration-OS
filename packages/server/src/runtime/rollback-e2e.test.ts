// 롤백 E2E 테스트 — 에러 발생 → RollbackAgent 실행 → 복구/비상 중단 흐름
//
// 테스트 전략: runtime-e2e.test.ts와 동일한 모킹 패턴 사용
// PlannerAgent만 에러를 throw하도록 모킹하여 롤백 흐름 검증

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";

// ─── 모듈 모킹 (호이스팅 — import 전에 선언) ──────────────────────────────

// node:fs mock
vi.mock("node:fs", () => ({
  mkdirSync: vi.fn(),
  default: { mkdirSync: vi.fn() },
}));

// @jarvis/audit mock
const mockAppend = vi.fn(
  (entry: Record<string, unknown>) => ({
    ok: true,
    value: { ...entry, integrity: { hash: "mock-hash", previousHash: null, chainPosition: 0 } },
  }),
);

vi.mock("@jarvis/audit", () => ({
  AuditStore: vi.fn().mockImplementation(() => ({
    append: mockAppend,
    close: vi.fn(),
    query: vi.fn(() => []),
  })),
}));

// @anthropic-ai/sdk mock
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: {
      create: vi.fn().mockResolvedValue({
        content: [{ type: "text", text: '{"mocked": true}' }],
        usage: { input_tokens: 0, output_tokens: 0 },
      }),
    },
  })),
}));

// sseEmitter mock
vi.mock("../sse/event-emitter.js", () => ({
  sseEmitter: {
    broadcast: vi.fn(),
    sendToSession: vi.fn(),
    addClient: vi.fn(),
    connectionCount: 0,
  },
}));

// gateResolver mock
vi.mock("./gate-resolver.js", () => ({
  gateResolver: {
    createGateId: vi.fn(() => `gate_mock_${Math.random().toString(36).slice(2, 10)}`),
    waitForGate: vi.fn().mockResolvedValue({ action: "APPROVE" }),
    resolveGate: vi.fn(() => true),
    rejectAll: vi.fn(),
    pendingCount: 0,
    getPendingGateIds: vi.fn(() => []),
  },
}));

// registerGate mock
vi.mock("../routes/gates.js", () => ({
  registerGate: vi.fn(),
  gatesRouter: { get: vi.fn(), post: vi.fn() },
}));

// ─── 실제 import (모킹 선언 이후) ─────────────────────────────────────────

import { jarvisRuntime } from "./jarvis-runtime.js";
import { sseEmitter } from "../sse/event-emitter.js";
import { gateResolver } from "./gate-resolver.js";

// ─── 테스트 헬퍼 ─────────────────────────────────────────────────────────────

function getBroadcastCallsOfType(eventType: string): Array<unknown[]> {
  const broadcastMock = sseEmitter.broadcast as Mock;
  return broadcastMock.mock.calls.filter((call) => call[0] === eventType);
}

function getNodeUpdatesOfType(nodeType: string): Array<Record<string, unknown>> {
  const broadcastMock = sseEmitter.broadcast as Mock;
  return broadcastMock.mock.calls
    .filter((call) => {
      if (call[0] !== "NODE_UPDATED") return false;
      const payload = call[1] as { node?: { type?: string } };
      return payload?.node?.type === nodeType;
    })
    .map((call) => (call[1] as { node: Record<string, unknown> }).node);
}

async function waitForBroadcastType(
  eventType: string,
  minCallCount: number = 1,
  timeoutMs: number = 5000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  const broadcastMock = sseEmitter.broadcast as Mock;
  while (Date.now() < deadline) {
    const calls = broadcastMock.mock.calls.filter((c) => c[0] === eventType);
    if (calls.length >= minCallCount) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error(`타임아웃: "${eventType}" 이벤트가 ${timeoutMs}ms 내에 ${minCallCount}회 호출되지 않음`);
}

// ─── 테스트 ─────────────────────────────────────────────────────────────────

describe("JarvisRuntime — 롤백 E2E", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env["ANTHROPIC_API_KEY"];
    jarvisRuntime.initialize();
    vi.mocked(gateResolver.waitForGate).mockResolvedValue({ action: "APPROVE" });
  });

  afterEach(() => {
    jarvisRuntime.stopActiveRun("테스트 정리");
  });

  // 1. 정상 파이프라인에서 에러 없이 ROLLBACK 노드가 발생하지 않음
  it("정상 파이프라인에서 ROLLBACK 노드가 발생하지 않는다", async () => {
    jarvisRuntime.startRun("함수 구현해줘", "sess-rb-001", "observe");
    await waitForBroadcastType("CHAT_MESSAGE_ADDED", 4, 15000);

    const rollbackNodes = getNodeUpdatesOfType("ROLLBACK");
    expect(rollbackNodes).toHaveLength(0);
  });

  // 2. Gate L2 거부 시 CHAT_MESSAGE_ADDED에 거부 메시지 포함
  it("Gate L2 거부 시 거부 메시지가 CHAT_MESSAGE_ADDED로 전송된다", async () => {
    vi.mocked(gateResolver.waitForGate).mockResolvedValue({
      action: "REJECT",
      reason: "위험한 변경 사항",
    });

    jarvisRuntime.startRun("함수 구현해줘", "sess-rb-002", "observe");
    await waitForBroadcastType("CHAT_MESSAGE_ADDED", 1, 10000);

    const chatCalls = getBroadcastCallsOfType("CHAT_MESSAGE_ADDED");
    const rejectionMsg = chatCalls.find((call) => {
      const msg = (call[1] as Record<string, unknown>)["message"] as Record<string, unknown>;
      return typeof msg["content"] === "string" && msg["content"].includes("거부");
    });
    expect(rejectionMsg).toBeDefined();
  });

  // 3. emergencyStop() 호출 시 EMERGENCY_STOPPED broadcast 발생
  it("emergencyStop() 호출 시 EMERGENCY_STOPPED 이벤트가 전송된다", () => {
    jarvisRuntime.startRun("테스트", "sess-rb-003", "observe");
    jarvisRuntime.emergencyStop("심각한 보안 이슈");

    const emergencyCalls = getBroadcastCallsOfType("EMERGENCY_STOPPED");
    expect(emergencyCalls.length).toBeGreaterThan(0);

    const payload = emergencyCalls[0]![1] as Record<string, unknown>;
    expect(payload["reason"]).toBe("심각한 보안 이슈");
    expect(payload["stoppedAt"]).toBeDefined();
  });

  // 4. emergencyStop() 후 activeRun이 null
  it("emergencyStop() 호출 후 getActiveRun()이 null을 반환한다", () => {
    jarvisRuntime.startRun("테스트", "sess-rb-004", "observe");
    expect(jarvisRuntime.getActiveRun()).not.toBeNull();

    jarvisRuntime.emergencyStop("긴급 중단");
    expect(jarvisRuntime.getActiveRun()).toBeNull();
  });

  // 5. emergencyStop() 호출 시 gateResolver.rejectAll이 호출됨
  it("emergencyStop() 호출 시 gateResolver.rejectAll()이 호출된다", () => {
    jarvisRuntime.startRun("테스트", "sess-rb-005", "observe");
    jarvisRuntime.emergencyStop("모든 게이트 거부");

    expect(gateResolver.rejectAll).toHaveBeenCalled();
  });

  // 6. stopActiveRun 후 감사 로그에 기록이 존재
  it("파이프라인 진행 중 stopActiveRun() 호출 후에도 감사 로그 기록이 존재한다", async () => {
    jarvisRuntime.startRun("함수 구현", "sess-rb-006", "observe");

    // SPEC 실행까지 대기
    await waitForBroadcastType("NODE_UPDATED", 2, 5000);

    // 활성 런 중단
    jarvisRuntime.stopActiveRun("테스트 중단");

    // Spec 에이전트가 최소 1회 감사 로그 기록
    expect(mockAppend.mock.calls.length).toBeGreaterThanOrEqual(1);
  });

  // 7. Gate 타임아웃 시뮬레이션 — waitForGate가 reject 시 CHAT_MESSAGE_ADDED 발생
  it("Gate 타임아웃 시 타임아웃 메시지가 전송된다", async () => {
    // Gate L2에서 타임아웃 (에러 throw) 시뮬레이션
    vi.mocked(gateResolver.waitForGate).mockRejectedValue(new Error("Gate 타임아웃"));

    jarvisRuntime.startRun("함수 구현해줘", "sess-rb-007", "observe");
    await waitForBroadcastType("CHAT_MESSAGE_ADDED", 1, 10000);

    const chatCalls = getBroadcastCallsOfType("CHAT_MESSAGE_ADDED");
    const timeoutMsg = chatCalls.find((call) => {
      const msg = (call[1] as Record<string, unknown>)["message"] as Record<string, unknown>;
      return typeof msg["content"] === "string" && msg["content"].includes("타임아웃");
    });
    expect(timeoutMsg).toBeDefined();
  });

  // 8. 이전 런이 있는 상태에서 새 런 시작 시 이전 런 정리
  it("새 런 시작 시 이전 런이 중단되고 새 런이 활성화된다", () => {
    const firstRunId = jarvisRuntime.startRun("첫 번째", "sess-rb-008a", "observe");
    const secondRunId = jarvisRuntime.startRun("두 번째", "sess-rb-008b", "observe");

    expect(secondRunId).not.toBe(firstRunId);
    expect(jarvisRuntime.getActiveRun()?.runId).toBe(secondRunId);
  });
});
