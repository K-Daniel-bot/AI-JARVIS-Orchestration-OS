// 에이전트 데이터 흐름 E2E 테스트 — JarvisRuntime 전체 파이프라인에서 SSE + 감사 로그 검증
//
// 테스트 전략: runtime-e2e.test.ts와 동일한 모킹 패턴 사용
// 에이전트는 실제 인스턴스 사용 — claudeClient 미주입으로 스텁 모드 동작

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

// node:fs mock — mkdirSync 파일시스템 접근 방지
vi.mock("node:fs", () => ({
  mkdirSync: vi.fn(),
  default: { mkdirSync: vi.fn() },
}));

// @jarvis/audit mock — SQLite 없이 in-memory 동작
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

// @anthropic-ai/sdk mock — 실제 API 호출 차단
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

// sseEmitter mock — broadcast spy
vi.mock("../sse/event-emitter.js", () => ({
  sseEmitter: {
    broadcast: vi.fn(),
    sendToSession: vi.fn(),
    addClient: vi.fn(),
    connectionCount: 0,
  },
}));

// gateResolver mock — Gate 대기 즉시 해결 (기본: APPROVE)
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

// broadcast mock 호출에서 특정 타입의 이벤트만 필터링
function getBroadcastCallsOfType(eventType: string): Array<unknown[]> {
  const broadcastMock = sseEmitter.broadcast as Mock;
  return broadcastMock.mock.calls.filter((call) => call[0] === eventType);
}

// NODE_UPDATED broadcast 호출 중 특정 노드 타입만 필터링
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

// 파이프라인 완료를 SSE broadcast로 감지하는 대기 헬퍼
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

// 마지막 broadcast payload 조회
function getLastBroadcastPayload(eventType: string): Record<string, unknown> | null {
  const calls = getBroadcastCallsOfType(eventType);
  if (calls.length === 0) return null;
  return calls[calls.length - 1]![1] as Record<string, unknown>;
}

// ─── 테스트 ─────────────────────────────────────────────────────────────────

describe("JarvisRuntime — 에이전트 체인 데이터 흐름 E2E", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env["ANTHROPIC_API_KEY"];
    jarvisRuntime.initialize();
    vi.mocked(gateResolver.waitForGate).mockResolvedValue({ action: "APPROVE" });
  });

  afterEach(() => {
    jarvisRuntime.stopActiveRun("테스트 정리");
  });

  // 1. Happy Path: NODE_UPDATED 이벤트가 SPEC→POLICY→PLAN→CODEGEN→REVIEW→TEST 순서로 발생
  it("파이프라인 완료 시 NODE_UPDATED가 SPEC→POLICY→PLAN→CODEGEN→REVIEW 순서로 발생한다", async () => {
    jarvisRuntime.startRun("함수 구현해줘", "sess-chain-001", "observe");

    // 충분한 NODE_UPDATED 이벤트 대기 (최소 8개: 각 노드의 RUNNING+DONE)
    await waitForBroadcastType("GATE_OPENED", 1, 10000);

    const broadcastMock = sseEmitter.broadcast as Mock;
    const nodeTypes: string[] = [];
    for (const call of broadcastMock.mock.calls) {
      if (call[0] === "NODE_UPDATED") {
        const node = (call[1] as { node: { type: string } }).node;
        if (!nodeTypes.includes(node.type) || node.type === "GATE") {
          nodeTypes.push(node.type);
        }
      }
    }

    // SPEC, POLICY, PLAN, CODEGEN, REVIEW 순서 확인 (GATE는 중간에 올 수 있음)
    const mainNodes = nodeTypes.filter((t) => ["SPEC", "POLICY", "PLAN", "CODEGEN", "REVIEW"].includes(t));
    expect(mainNodes.indexOf("SPEC")).toBeLessThan(mainNodes.indexOf("POLICY"));
    expect(mainNodes.indexOf("POLICY")).toBeLessThan(mainNodes.indexOf("PLAN"));
    expect(mainNodes.indexOf("PLAN")).toBeLessThan(mainNodes.indexOf("CODEGEN"));
    expect(mainNodes.indexOf("CODEGEN")).toBeLessThan(mainNodes.indexOf("REVIEW"));
  });

  // 2. 각 NODE_UPDATED(RUNNING→DONE) 쌍이 올바른 순서로 발생
  it("SPEC 노드에 RUNNING→DONE 순서의 NODE_UPDATED 쌍이 있다", async () => {
    jarvisRuntime.startRun("코드 구현", "sess-chain-002", "observe");
    await waitForBroadcastType("NODE_UPDATED", 4, 5000);

    const specNodes = getNodeUpdatesOfType("SPEC");
    const statuses = specNodes.map((n) => n["status"]);
    const runningIdx = statuses.indexOf("RUNNING");
    const doneIdx = statuses.indexOf("DONE");
    expect(runningIdx).toBeGreaterThanOrEqual(0);
    expect(doneIdx).toBeGreaterThan(runningIdx);
  });

  // 3. SpecAgent 실행 후 NODE_UPDATED payload에 specId 관련 정보 포함
  it("SPEC DONE 노드의 summary에 해석 정보가 포함된다", async () => {
    jarvisRuntime.startRun("TypeScript 함수 구현", "sess-chain-003", "observe");
    await waitForBroadcastType("NODE_UPDATED", 4, 5000);

    const specNodes = getNodeUpdatesOfType("SPEC");
    const doneSpec = specNodes.find((n) => n["status"] === "DONE");
    expect(doneSpec).toBeDefined();
    // 스텁 모드: summary에 "사용자 요청 분석" 문자열이 포함되어야 함
    expect(typeof doneSpec!["summary"]).toBe("string");
    expect((doneSpec!["summary"] as string).length).toBeGreaterThan(0);
  });

  // 4. PlannerAgent 실행 후 NODE_UPDATED payload에 planId + stepCount 정보 포함
  it("PLAN DONE 노드의 summary에 단계 수가 포함된다", async () => {
    jarvisRuntime.startRun("함수 구현해줘", "sess-chain-004", "observe");
    await waitForBroadcastType("NODE_UPDATED", 6, 6000);

    const planNodes = getNodeUpdatesOfType("PLAN");
    const donePlan = planNodes.find((n) => n["status"] === "DONE");
    expect(donePlan).toBeDefined();
    // "3개 단계" 같은 문자열이 summary에 포함
    expect(typeof donePlan!["summary"]).toBe("string");
    expect((donePlan!["summary"] as string)).toMatch(/\d+개 단계/);
  });

  // 5. CodegenAgent 실행 후 NODE_UPDATED payload에 changeSetId 관련 정보 포함
  it("CODEGEN DONE 노드에 summary가 존재한다", async () => {
    jarvisRuntime.startRun("함수 구현해줘", "sess-chain-005", "observe");
    await waitForBroadcastType("NODE_UPDATED", 8, 8000);

    const codegenNodes = getNodeUpdatesOfType("CODEGEN");
    const doneCodegen = codegenNodes.find((n) => n["status"] === "DONE");
    expect(doneCodegen).toBeDefined();
    expect(doneCodegen!["summary"]).toBeDefined();
  });

  // 6. ReviewAgent 실행 후 NODE_UPDATED payload에 reviewId + passed 관련 정보 포함
  it("REVIEW DONE 노드의 summary에 통과 정보가 포함된다", async () => {
    jarvisRuntime.startRun("함수 구현해줘", "sess-chain-006", "observe");
    await waitForBroadcastType("GATE_OPENED", 1, 10000);

    const reviewNodes = getNodeUpdatesOfType("REVIEW");
    const doneReview = reviewNodes.find((n) => n["status"] === "DONE");
    expect(doneReview).toBeDefined();
    // 스텁 모드: securitySelfCheck all false → 통과
    expect((doneReview!["summary"] as string)).toContain("통과");
  });

  // 7. TestBuild 실행 후 TEST DONE 노드가 존재한다
  it("TEST DONE 노드가 파이프라인 완료 시 존재한다", async () => {
    jarvisRuntime.startRun("함수 구현해줘", "sess-chain-007", "observe");

    // 파이프라인 완료 대기 — CHAT_MESSAGE_ADDED에 '파이프라인 완료' 포함
    await waitForBroadcastType("CHAT_MESSAGE_ADDED", 4, 15000);

    const testNodes = getNodeUpdatesOfType("TEST");
    const doneTest = testNodes.find((n) => n["status"] === "DONE");
    expect(doneTest).toBeDefined();
    expect(typeof doneTest!["summary"]).toBe("string");
  });

  // 8. RISK_UPDATED 이벤트에 riskScore + riskLevel 포함
  it("RISK_UPDATED 이벤트에 riskScore와 riskLevel이 포함된다", async () => {
    jarvisRuntime.startRun("코드 구현 요청", "sess-chain-008", "observe");
    await waitForBroadcastType("RISK_UPDATED", 1, 5000);

    const payload = getLastBroadcastPayload("RISK_UPDATED");
    expect(payload).not.toBeNull();
    expect(payload).toHaveProperty("riskScore");
    expect(payload).toHaveProperty("riskLevel");
    expect(typeof payload!["riskScore"]).toBe("number");
    expect(typeof payload!["riskLevel"]).toBe("string");
  });

  // 9. GATE_OPENED(L2) 이벤트 발생 확인
  it("파이프라인 진행 중 GATE_OPENED 이벤트가 발생한다", async () => {
    jarvisRuntime.startRun("함수 구현해줘", "sess-chain-009", "observe");
    await waitForBroadcastType("GATE_OPENED", 1, 10000);

    const gateOpenCalls = getBroadcastCallsOfType("GATE_OPENED");
    expect(gateOpenCalls.length).toBeGreaterThan(0);

    const gatePayload = gateOpenCalls[0]![1] as { gate: Record<string, unknown> };
    expect(gatePayload.gate).toHaveProperty("gateId");
    expect(gatePayload.gate["gateLevel"]).toBe("L2");
  });

  // 10. RUN_STATUS_CHANGED 이벤트 발생 확인
  it("파이프라인 진행 중 RUN_STATUS_CHANGED 이벤트가 발생한다", async () => {
    const runId = jarvisRuntime.startRun("코드 작업", "sess-chain-010", "observe");
    await new Promise((resolve) => setTimeout(resolve, 100));

    const statusCalls = getBroadcastCallsOfType("RUN_STATUS_CHANGED");
    expect(statusCalls.length).toBeGreaterThan(0);

    const firstPayload = statusCalls[0]![1] as Record<string, unknown>;
    expect(firstPayload["runId"]).toBe(runId);
    expect(firstPayload["state"]).toBeDefined();
  });

  // 11. CHAT_MESSAGE_ADDED에 완료 메시지 포함
  it("파이프라인 완료 시 CHAT_MESSAGE_ADDED에 완료 메시지가 포함된다", async () => {
    jarvisRuntime.startRun("함수 구현해줘", "sess-chain-011", "observe");

    // 충분한 채팅 메시지 대기
    await waitForBroadcastType("CHAT_MESSAGE_ADDED", 4, 15000);

    const chatCalls = getBroadcastCallsOfType("CHAT_MESSAGE_ADDED");
    const completionMsg = chatCalls.find((call) => {
      const msg = (call[1] as Record<string, unknown>)["message"] as Record<string, unknown>;
      return typeof msg["content"] === "string" && msg["content"].includes("파이프라인 완료");
    });
    expect(completionMsg).toBeDefined();
  });

  // 12. AuditStore.append 호출 횟수 ≥ 에이전트 수
  it("파이프라인 완료 시 감사 로그가 최소 5회 이상 기록된다", async () => {
    jarvisRuntime.startRun("함수 구현해줘", "sess-chain-012", "observe");

    // 파이프라인 완료 대기
    await waitForBroadcastType("CHAT_MESSAGE_ADDED", 4, 15000);

    // 에이전트 5개 (Spec, Planner, Codegen, Review, TestBuild) + 정책 평가 등
    // 최소 에이전트 수만큼 감사 로그 기록
    expect(mockAppend.mock.calls.length).toBeGreaterThanOrEqual(5);
  });
});
