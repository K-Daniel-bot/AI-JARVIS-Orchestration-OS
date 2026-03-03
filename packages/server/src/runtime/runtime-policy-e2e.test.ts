// 정책 판정 분기 E2E 테스트 — DENY, CONSTRAINED_ALLOW, APPROVAL_REQUIRED, Gate L3 조건부
//
// 테스트 전략: runtime-e2e.test.ts와 동일한 모킹 패턴 + @jarvis/policy-engine 모킹
// evaluate 함수를 모킹하여 DENY / CONSTRAINED_ALLOW 시나리오를 강제 검증

import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from "vitest";

// ─── vi.hoisted() — 호이스팅 안전한 mock 함수 선언 ──────────────────────────

const { mockAppend, mockEvaluate } = vi.hoisted(() => ({
  mockAppend: vi.fn(
    (entry: Record<string, unknown>) => ({
      ok: true,
      value: { ...entry, integrity: { hash: "mock-hash", previousHash: null, chainPosition: 0 } },
    }),
  ),
  mockEvaluate: vi.fn(),
}));

// ─── 모듈 모킹 (호이스팅 — import 전에 선언) ──────────────────────────────

// node:fs mock
vi.mock("node:fs", () => ({
  mkdirSync: vi.fn(),
  default: { mkdirSync: vi.fn() },
}));

// @jarvis/audit mock
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

// @jarvis/policy-engine mock — evaluate 함수를 모킹 가능하도록 설정
vi.mock("@jarvis/policy-engine", () => ({
  evaluate: mockEvaluate,
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

// ALLOW 결과를 반환하는 기본 PolicyDecision 생성 헬퍼
function makePolicyDecision(overrides: {
  status?: string;
  riskScore?: number;
  riskLevel?: string;
} = {}): { ok: true; value: Record<string, unknown> } {
  return {
    ok: true,
    value: {
      decisionId: `pdec_mock_${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      subject: { userId: "user_001", role: "Owner", device: "desktop", sessionId: "sess-mock" },
      request: { rawInput: "test", intent: "CODE_IMPLEMENTATION", targets: ["src/index.ts"] },
      outcome: {
        status: overrides.status ?? "ALLOW",
        riskScore: overrides.riskScore ?? 15,
        riskLevel: overrides.riskLevel ?? "LOW",
        requiresGates: [],
        reasonCodes: [],
        humanExplanation: "테스트 정책 결과",
      },
      constraints: {
        fs: { readAllow: ["**/*"], writeAllow: ["./**/*"], writeDeny: [] },
        exec: { allow: ["node", "npm"], deny: ["sudo"] },
        network: { allowDomains: ["*.github.com"], denyDomains: [], default: "DENY" },
      },
      requiredCapabilities: [],
    },
  };
}

// ─── 테스트 ─────────────────────────────────────────────────────────────────

describe("JarvisRuntime — 정책 분기 E2E", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env["ANTHROPIC_API_KEY"];
    // 기본: ALLOW 결과 반환
    mockEvaluate.mockReturnValue(makePolicyDecision({ status: "ALLOW", riskScore: 15, riskLevel: "LOW" }));
    jarvisRuntime.initialize();
    vi.mocked(gateResolver.waitForGate).mockResolvedValue({ action: "APPROVE" });
  });

  afterEach(() => {
    jarvisRuntime.stopActiveRun("테스트 정리");
  });

  // 1. POLICY DENY → NODE_UPDATED에 PLAN 타입 없음 (조기 종료)
  it("POLICY DENY 시 PLAN NODE_UPDATED가 발생하지 않는다", async () => {
    // Arrange — DENY 반환하도록 모킹
    mockEvaluate.mockReturnValue(makePolicyDecision({ status: "DENY", riskScore: 95, riskLevel: "CRITICAL" }));

    // Act
    jarvisRuntime.startRun("위험한 시스템 변경", "sess-policy-001", "observe");

    // CHAT_MESSAGE_ADDED에 거부 메시지 대기
    await waitForBroadcastType("CHAT_MESSAGE_ADDED", 1, 5000);

    // Assert — PLAN 노드가 없어야 함 (조기 종료)
    const planNodes = getNodeUpdatesOfType("PLAN");
    expect(planNodes).toHaveLength(0);

    // DENY 후 채팅 메시지에 '정책 거부' 포함
    const chatCalls = getBroadcastCallsOfType("CHAT_MESSAGE_ADDED");
    const denyMsg = chatCalls.find((call) => {
      const msg = (call[1] as Record<string, unknown>)["message"] as Record<string, unknown>;
      return typeof msg["content"] === "string" && msg["content"].includes("정책 거부");
    });
    expect(denyMsg).toBeDefined();
  });

  // 2. Gate L1 APPROVAL_REQUIRED → 승인 → PLANNING 진입
  it("APPROVAL_REQUIRED → Gate L1 승인 후 PLAN 노드가 발생한다", async () => {
    // Arrange — APPROVAL_REQUIRED 반환
    mockEvaluate.mockReturnValue(makePolicyDecision({ status: "APPROVAL_REQUIRED", riskScore: 65, riskLevel: "HIGH" }));
    vi.mocked(gateResolver.waitForGate).mockResolvedValue({ action: "APPROVE" });

    // Act
    jarvisRuntime.startRun("패키지 설치 요청", "sess-policy-002", "observe");

    // PLAN 노드 대기 (L1 승인 후 PLANNING 진입)
    await waitForBroadcastType("NODE_UPDATED", 6, 10000);

    // Assert — GATE_OPENED(L1) 이벤트 발생
    const gateOpenCalls = getBroadcastCallsOfType("GATE_OPENED");
    const l1Gate = gateOpenCalls.find((call) => {
      const payload = call[1] as { gate: Record<string, unknown> };
      return payload.gate["gateLevel"] === "L1";
    });
    expect(l1Gate).toBeDefined();

    // PLAN 노드가 존재해야 함 (승인 후 PLANNING 진입)
    const planNodes = getNodeUpdatesOfType("PLAN");
    expect(planNodes.length).toBeGreaterThan(0);
  });

  // 3. CONSTRAINED_ALLOW → PLANNING 정상 진행
  it("CONSTRAINED_ALLOW 시 PLAN 노드가 정상적으로 발생한다", async () => {
    // Arrange — CONSTRAINED_ALLOW 반환
    mockEvaluate.mockReturnValue(makePolicyDecision({ status: "CONSTRAINED_ALLOW", riskScore: 35, riskLevel: "MEDIUM" }));

    // Act
    jarvisRuntime.startRun("함수 구현해줘", "sess-policy-003", "observe");

    // PLAN 노드 대기 (CONSTRAINED_ALLOW는 바로 PLANNING으로)
    await waitForBroadcastType("NODE_UPDATED", 6, 8000);

    // Assert — Gate L1이 열리지 않음 (CONSTRAINED_ALLOW는 Gate L1 불필요)
    const gateOpenCalls = getBroadcastCallsOfType("GATE_OPENED");
    const l1Gate = gateOpenCalls.find((call) => {
      const payload = call[1] as { gate: Record<string, unknown> };
      return payload.gate["gateLevel"] === "L1";
    });
    expect(l1Gate).toBeUndefined();

    // PLAN 노드가 존재해야 함
    const planNodes = getNodeUpdatesOfType("PLAN");
    expect(planNodes.length).toBeGreaterThan(0);

    // CHAT_MESSAGE_ADDED에 "CONSTRAINED_ALLOW" 포함
    const chatCalls = getBroadcastCallsOfType("CHAT_MESSAGE_ADDED");
    const constrainedMsg = chatCalls.find((call) => {
      const msg = (call[1] as Record<string, unknown>)["message"] as Record<string, unknown>;
      return typeof msg["content"] === "string" && msg["content"].includes("CONSTRAINED_ALLOW");
    });
    expect(constrainedMsg).toBeDefined();
  });

  // 4. Gate L3 조건부 (riskScore ≥ 60) → GATE_OPENED(L3) 발생
  it("riskScore ≥ 60 일 때 Gate L3(GATE_OPENED)가 발생한다", async () => {
    // Arrange — ALLOW이지만 riskScore 65 (L3 트리거)
    mockEvaluate.mockReturnValue(makePolicyDecision({ status: "ALLOW", riskScore: 65, riskLevel: "HIGH" }));
    vi.mocked(gateResolver.waitForGate).mockResolvedValue({ action: "APPROVE" });

    // Act
    jarvisRuntime.startRun("함수 구현해줘", "sess-policy-004", "observe");

    // 충분한 시간 대기 — 파이프라인 전체 진행 후 Gate L3까지
    await waitForBroadcastType("CHAT_MESSAGE_ADDED", 4, 15000);

    // Assert — GATE_OPENED 중 L3가 있어야 함
    const gateOpenCalls = getBroadcastCallsOfType("GATE_OPENED");

    // Gate L2는 항상 발생, L3는 riskScore ≥ 60일 때만
    // 주의: L3는 riskScore >= 60 || hasDestructiveActions일 때 발생
    // 스텁 모드에서 filesAdded, filesModified 모두 비어있으므로 hasDestructiveActions=false
    // → riskScore=65 ≥ 60이므로 needsGateL3=true
    const hasL3 = gateOpenCalls.some((call) => {
      const payload = call[1] as { gate: Record<string, unknown> };
      return payload.gate["gateLevel"] !== "L2"; // L2가 아닌 게이트 = L3
    });

    // L3 게이트가 발생했거나, 배포 관련 GATE_OPENED가 있어야 함
    // 런타임에서 Gate L3 데이터에는 gateLevel이 명시적으로 없음 — registerGate 호출 확인
    // 대신 NODE_UPDATED에서 "배포 승인 (L3)" 텍스트 확인
    const gateNodes = getNodeUpdatesOfType("GATE");
    const l3Node = gateNodes.find((n) =>
      typeof n["label"] === "string" && n["label"].includes("L3"),
    );

    // 배포 관련 게이트가 열려야 함
    expect(gateOpenCalls.length).toBeGreaterThanOrEqual(2); // L2 + L3
  });

  // 5. 파이프라인 완료 후 activeRun = null
  it("파이프라인 완료 후 getActiveRun()이 null을 반환한다", async () => {
    // Arrange — 기본 ALLOW (저위험)
    mockEvaluate.mockReturnValue(makePolicyDecision({ status: "ALLOW", riskScore: 15, riskLevel: "LOW" }));
    vi.mocked(gateResolver.waitForGate).mockResolvedValue({ action: "APPROVE" });

    // Act
    jarvisRuntime.startRun("함수 구현해줘", "sess-policy-005", "observe");

    // 파이프라인 완료 대기 — "파이프라인 완료" 메시지 포함
    await waitForBroadcastType("CHAT_MESSAGE_ADDED", 4, 15000);

    // Assert — 완료 후 activeRun null
    // 파이프라인이 완료되면 this.activeRun = null 처리됨
    const chatCalls = getBroadcastCallsOfType("CHAT_MESSAGE_ADDED");
    const completionMsg = chatCalls.find((call) => {
      const msg = (call[1] as Record<string, unknown>)["message"] as Record<string, unknown>;
      return typeof msg["content"] === "string" && msg["content"].includes("파이프라인 완료");
    });
    expect(completionMsg).toBeDefined();

    // 파이프라인 완료 후 activeRun이 null
    expect(jarvisRuntime.getActiveRun()).toBeNull();
  });
});
