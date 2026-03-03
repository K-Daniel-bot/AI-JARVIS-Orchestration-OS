// 라우트 핸들러 통합 테스트 — 각 라우트 모듈의 핸들러를 mock req/res로 직접 호출하여 검증
//
// 실제 HTTP 서버를 시작하지 않고, Express Router에 등록된 핸들러를 추출하여
// mock Request / mock Response 객체로 단위 테스트한다.

import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Request, Response } from "express";

// -----------------------------------------------------------------------
// 외부 의존성 전체 모킹 — 모든 import 전에 선언 (호이스팅 보장)
// -----------------------------------------------------------------------

// jarvisRuntime 모킹
vi.mock("../runtime/jarvis-runtime.js", () => ({
  jarvisRuntime: {
    getActiveRun: vi.fn(),
    getCurrentState: vi.fn(),
    getContext: vi.fn(),
    getPendingGatesCount: vi.fn(),
    getAuditStore: vi.fn(),
    startRun: vi.fn(),
    initialize: vi.fn(),
    shutdown: vi.fn(),
    stopActiveRun: vi.fn(),
    emergencyStop: vi.fn(),
  },
}));

// sseEmitter 모킹
vi.mock("../sse/event-emitter.js", () => ({
  sseEmitter: {
    broadcast: vi.fn(),
    addClient: vi.fn(),
    sendToSession: vi.fn(),
    connectionCount: 0,
  },
}));

// gateResolver 모킹
vi.mock("../runtime/gate-resolver.js", () => ({
  gateResolver: {
    createGateId: vi.fn(() => "gate_mocktest"),
    waitForGate: vi.fn(),
    resolveGate: vi.fn(),
    pendingCount: 0,
    getPendingGateIds: vi.fn(() => []),
    rejectAll: vi.fn(),
  },
}));

// -----------------------------------------------------------------------
// 모킹된 의존성 가져오기
// -----------------------------------------------------------------------
import { jarvisRuntime } from "../runtime/jarvis-runtime.js";
import { sseEmitter } from "../sse/event-emitter.js";
import { gateResolver } from "../runtime/gate-resolver.js";

// -----------------------------------------------------------------------
// Mock Request / Response 팩토리
// -----------------------------------------------------------------------

interface MockRequestOptions {
  params?: Record<string, string>;
  query?: Record<string, string>;
  body?: unknown;
  headers?: Record<string, string>;
}

interface MockResponseResult {
  res: Response;
  statusCode: number;
  jsonPayload: unknown;
  // json() 이 호출되었는지 여부
  jsonCalled: boolean;
  // status() 체이닝 설정
  setStatus: (code: number) => void;
}

function createMockRequest(opts: MockRequestOptions = {}): Request {
  return {
    params: opts.params ?? {},
    query: opts.query ?? {},
    body: opts.body ?? {},
    headers: opts.headers ?? {},
  } as unknown as Request;
}

function createMockResponse(): MockResponseResult {
  const state: MockResponseResult = {
    res: null as unknown as Response,
    statusCode: 200,
    jsonPayload: undefined,
    jsonCalled: false,
    setStatus: () => {},
  };

  const res = {
    status: vi.fn((code: number) => {
      state.statusCode = code;
      return res; // 체이닝 지원
    }),
    json: vi.fn((payload: unknown) => {
      state.jsonPayload = payload;
      state.jsonCalled = true;
      return res;
    }),
  } as unknown as Response;

  state.res = res;
  state.setStatus = (code: number) => {
    state.statusCode = code;
  };

  return state;
}

// -----------------------------------------------------------------------
// ISO 형식 검증 헬퍼
// -----------------------------------------------------------------------
function isIsoTimestamp(value: unknown): boolean {
  if (typeof value !== "string") return false;
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(value);
}

// -----------------------------------------------------------------------
// 테스트 전 공통 초기화
// -----------------------------------------------------------------------
beforeEach(() => {
  vi.clearAllMocks();

  // jarvisRuntime 기본 반환값 설정
  vi.mocked(jarvisRuntime.getActiveRun).mockReturnValue(null);
  vi.mocked(jarvisRuntime.getCurrentState).mockReturnValue("IDLE");
  vi.mocked(jarvisRuntime.getContext).mockReturnValue(null);
  vi.mocked(jarvisRuntime.getPendingGatesCount).mockReturnValue(0);
  vi.mocked(jarvisRuntime.getAuditStore).mockReturnValue(null);
  vi.mocked(jarvisRuntime.startRun).mockReturnValue("run_abc12345def0");
});

// -----------------------------------------------------------------------
// system.ts — GET /api/system/status
// -----------------------------------------------------------------------
describe("systemRouter — GET /status", () => {
  // 라우트 핸들러를 테스트마다 동적으로 가져와야 모킹이 적용됨
  async function callStatusHandler(): Promise<MockResponseResult> {
    const { systemRouter } = await import("./system.js");
    const mock = createMockResponse();
    const req = createMockRequest();

    // Express Router 내부 레이어에서 핸들러를 추출하여 직접 호출
    // Router는 내부적으로 stack[] 배열에 Layer 객체로 핸들러를 저장한다
    const router = systemRouter as unknown as {
      stack: Array<{ route: { stack: Array<{ handle: (req: Request, res: Response) => void }> } } | undefined>;
    };
    const layer = router.stack.find((l) => l?.route !== undefined);
    const handler = layer?.route?.stack[0]?.handle;

    if (!handler) throw new Error("핸들러를 찾을 수 없음");
    handler(req, mock.res);

    return mock;
  }

  it("should return success: true in response body", async () => {
    // Arrange — jarvisRuntime 기본 반환값 사용

    // Act
    const mock = await callStatusHandler();

    // Assert
    expect(mock.jsonCalled).toBe(true);
    const body = mock.jsonPayload as Record<string, unknown>;
    expect(body["success"]).toBe(true);
  });

  it("should include currentState from jarvisRuntime", async () => {
    // Arrange
    vi.mocked(jarvisRuntime.getCurrentState).mockReturnValue("PLANNING");

    // Act
    const mock = await callStatusHandler();

    // Assert
    const body = mock.jsonPayload as { data: { currentState: string } };
    expect(body.data.currentState).toBe("PLANNING");
  });

  it("should set activeRunId to null when no active run", async () => {
    // Arrange
    vi.mocked(jarvisRuntime.getActiveRun).mockReturnValue(null);

    // Act
    const mock = await callStatusHandler();

    // Assert
    const body = mock.jsonPayload as { data: { activeRunId: null } };
    expect(body.data.activeRunId).toBeNull();
  });

  it("should reflect activeRunId when a run is active", async () => {
    // Arrange
    vi.mocked(jarvisRuntime.getActiveRun).mockReturnValue({
      runId: "run_activetest001",
      sessionId: "sess_001",
      trustMode: "semi-auto",
      startedAt: new Date().toISOString(),
      actor: {} as never,
    });

    // Act
    const mock = await callStatusHandler();

    // Assert
    const body = mock.jsonPayload as { data: { activeRunId: string } };
    expect(body.data.activeRunId).toBe("run_activetest001");
  });

  it("should include 9 agentHealth entries", async () => {
    // Arrange & Act
    const mock = await callStatusHandler();

    // Assert
    const body = mock.jsonPayload as { data: { agentHealth: unknown[] } };
    expect(body.data.agentHealth).toHaveLength(9);
  });

  it("should include pendingGates count from jarvisRuntime", async () => {
    // Arrange
    vi.mocked(jarvisRuntime.getPendingGatesCount).mockReturnValue(3);

    // Act
    const mock = await callStatusHandler();

    // Assert
    const body = mock.jsonPayload as { data: { pendingGates: number } };
    expect(body.data.pendingGates).toBe(3);
  });

  it("should include a valid ISO timestamp in response", async () => {
    // Arrange & Act
    const mock = await callStatusHandler();

    // Assert
    const body = mock.jsonPayload as { timestamp: string };
    expect(isIsoTimestamp(body.timestamp)).toBe(true);
  });

  it("should include requestId in response", async () => {
    // Arrange & Act
    const mock = await callStatusHandler();

    // Assert
    const body = mock.jsonPayload as { requestId: string };
    expect(typeof body.requestId).toBe("string");
    expect(body.requestId.length).toBeGreaterThan(0);
  });
});

// -----------------------------------------------------------------------
// gates.ts — GET/POST /api/gates/:gateId
// -----------------------------------------------------------------------
describe("gatesRouter", () => {
  // gateStore는 모듈 내 인메모리 Map이므로, 테스트마다 registerGate로 게이트를 등록

  describe("GET /:gateId", () => {
    it("should return 404 when gate does not exist", async () => {
      // Arrange
      const { gatesRouter } = await import("./gates.js");
      const router = gatesRouter as unknown as {
        stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (req: Request, res: Response) => void }> } }>;
      };

      // GET /:gateId 핸들러 추출
      const layer = router.stack.find(
        (l) => l.route?.methods["get"] && l.route.path === "/:gateId",
      );
      const handler = layer?.route?.stack[0]?.handle;
      if (!handler) throw new Error("GET /:gateId 핸들러를 찾을 수 없음");

      const req = createMockRequest({ params: { gateId: "gate_nonexistent" } });
      const mock = createMockResponse();

      // Act
      handler(req, mock.res);

      // Assert
      expect(mock.res.status).toHaveBeenCalledWith(404);
    });

    it("should return 404 error body with NOT_FOUND code when gate missing", async () => {
      // Arrange
      const { gatesRouter } = await import("./gates.js");
      const router = gatesRouter as unknown as {
        stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (req: Request, res: Response) => void }> } }>;
      };
      const layer = router.stack.find(
        (l) => l.route?.methods["get"] && l.route.path === "/:gateId",
      );
      const handler = layer?.route?.stack[0]?.handle;
      if (!handler) throw new Error("GET /:gateId 핸들러를 찾을 수 없음");

      const req = createMockRequest({ params: { gateId: "gate_missing_xyz" } });
      const mock = createMockResponse();

      // Act
      handler(req, mock.res);

      // Assert
      const body = mock.jsonPayload as { success: boolean; error: { code: string } };
      expect(body.success).toBe(false);
      expect(body.error.code).toBe("NOT_FOUND");
    });
  });

  describe("POST /:gateId/approve", () => {
    it("should return 404 when approving a non-existent gate", async () => {
      // Arrange
      const { gatesRouter } = await import("./gates.js");
      const router = gatesRouter as unknown as {
        stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (req: Request, res: Response) => void }> } }>;
      };

      // POST /:gateId/approve 핸들러 추출
      const layer = router.stack.find(
        (l) => l.route?.methods["post"] && l.route.path === "/:gateId/approve",
      );
      const handler = layer?.route?.stack[0]?.handle;
      if (!handler) throw new Error("POST /:gateId/approve 핸들러를 찾을 수 없음");

      const req = createMockRequest({
        params: { gateId: "gate_no_such_gate" },
        body: { action: "APPROVE" },
      });
      const mock = createMockResponse();

      // Act
      handler(req, mock.res);

      // Assert
      expect(mock.res.status).toHaveBeenCalledWith(404);
    });

    it("should return success and call gateResolver.resolveGate when gate exists", async () => {
      // Arrange — 먼저 게이트를 스토어에 등록
      const { gatesRouter, registerGate } = await import("./gates.js");
      const testGateId = "gate_approvetest1";
      registerGate({
        gateId: testGateId,
        gateLevel: "L1",
        runId: "run_test001",
        status: "PENDING",
        what: "테스트 게이트",
        why: "단위 테스트용",
        riskScore: 20,
        riskLevel: "LOW",
        createdAt: new Date().toISOString(),
      });

      const router = gatesRouter as unknown as {
        stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (req: Request, res: Response) => void }> } }>;
      };
      const layer = router.stack.find(
        (l) => l.route?.methods["post"] && l.route.path === "/:gateId/approve",
      );
      const handler = layer?.route?.stack[0]?.handle;
      if (!handler) throw new Error("POST /:gateId/approve 핸들러를 찾을 수 없음");

      const req = createMockRequest({
        params: { gateId: testGateId },
        body: { action: "APPROVE" },
      });
      const mock = createMockResponse();

      // Act
      handler(req, mock.res);

      // Assert — 성공 응답
      const body = mock.jsonPayload as { success: boolean; data: { status: string } };
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("APPROVED");
    });

    it("should call gateResolver.resolveGate with APPROVE action", async () => {
      // Arrange
      const { gatesRouter, registerGate } = await import("./gates.js");
      const testGateId = "gate_resolvetest1";
      registerGate({
        gateId: testGateId,
        status: "PENDING",
        gateLevel: "L1",
        runId: "run_resolve",
        what: "리졸브 테스트",
        why: "검증용",
        riskScore: 10,
        riskLevel: "LOW",
        createdAt: new Date().toISOString(),
      });

      const router = gatesRouter as unknown as {
        stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (req: Request, res: Response) => void }> } }>;
      };
      const layer = router.stack.find(
        (l) => l.route?.methods["post"] && l.route.path === "/:gateId/approve",
      );
      const handler = layer?.route?.stack[0]?.handle;
      if (!handler) throw new Error("POST /:gateId/approve 핸들러를 찾을 수 없음");

      const req = createMockRequest({
        params: { gateId: testGateId },
        body: { action: "APPROVE" },
      });
      const mock = createMockResponse();

      // Act
      handler(req, mock.res);

      // Assert
      expect(gateResolver.resolveGate).toHaveBeenCalledWith(
        testGateId,
        expect.objectContaining({ action: "APPROVE" }),
      );
    });

    it("should broadcast GATE_RESOLVED event via sseEmitter on approve", async () => {
      // Arrange
      const { gatesRouter, registerGate } = await import("./gates.js");
      const testGateId = "gate_ssetest1";
      registerGate({
        gateId: testGateId,
        status: "PENDING",
        gateLevel: "L1",
        runId: "run_sse001",
        what: "SSE 테스트 게이트",
        why: "SSE 검증용",
        riskScore: 5,
        riskLevel: "LOW",
        createdAt: new Date().toISOString(),
      });

      const router = gatesRouter as unknown as {
        stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (req: Request, res: Response) => void }> } }>;
      };
      const layer = router.stack.find(
        (l) => l.route?.methods["post"] && l.route.path === "/:gateId/approve",
      );
      const handler = layer?.route?.stack[0]?.handle;
      if (!handler) throw new Error("POST /:gateId/approve 핸들러를 찾을 수 없음");

      const req = createMockRequest({
        params: { gateId: testGateId },
        body: { action: "APPROVE" },
      });
      const mock = createMockResponse();

      // Act
      handler(req, mock.res);

      // Assert
      expect(sseEmitter.broadcast).toHaveBeenCalledWith(
        "GATE_RESOLVED",
        expect.objectContaining({ gateId: testGateId }),
      );
    });
  });

  describe("POST /:gateId/reject", () => {
    it("should return 404 when rejecting a non-existent gate", async () => {
      // Arrange
      const { gatesRouter } = await import("./gates.js");
      const router = gatesRouter as unknown as {
        stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (req: Request, res: Response) => void }> } }>;
      };
      const layer = router.stack.find(
        (l) => l.route?.methods["post"] && l.route.path === "/:gateId/reject",
      );
      const handler = layer?.route?.stack[0]?.handle;
      if (!handler) throw new Error("POST /:gateId/reject 핸들러를 찾을 수 없음");

      const req = createMockRequest({
        params: { gateId: "gate_reject_missing" },
        body: { reason: "테스트 거부" },
      });
      const mock = createMockResponse();

      // Act
      handler(req, mock.res);

      // Assert
      expect(mock.res.status).toHaveBeenCalledWith(404);
    });

    it("should return success with REJECTED status when gate exists", async () => {
      // Arrange
      const { gatesRouter, registerGate } = await import("./gates.js");
      const testGateId = "gate_rejecttest1";
      registerGate({
        gateId: testGateId,
        status: "PENDING",
        gateLevel: "L2",
        runId: "run_reject001",
        what: "거부 테스트",
        why: "검증용",
        riskScore: 70,
        riskLevel: "HIGH",
        createdAt: new Date().toISOString(),
      });

      const router = gatesRouter as unknown as {
        stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (req: Request, res: Response) => void }> } }>;
      };
      const layer = router.stack.find(
        (l) => l.route?.methods["post"] && l.route.path === "/:gateId/reject",
      );
      const handler = layer?.route?.stack[0]?.handle;
      if (!handler) throw new Error("POST /:gateId/reject 핸들러를 찾을 수 없음");

      const req = createMockRequest({
        params: { gateId: testGateId },
        body: { reason: "위험도가 너무 높음" },
      });
      const mock = createMockResponse();

      // Act
      handler(req, mock.res);

      // Assert
      const body = mock.jsonPayload as { success: boolean; data: { status: string } };
      expect(body.success).toBe(true);
      expect(body.data.status).toBe("REJECTED");
    });

    it("should call gateResolver.resolveGate with REJECT action", async () => {
      // Arrange
      const { gatesRouter, registerGate } = await import("./gates.js");
      const testGateId = "gate_rejectresolvt";
      registerGate({
        gateId: testGateId,
        status: "PENDING",
        gateLevel: "L1",
        runId: "run_rjct002",
        what: "거부 리졸브 테스트",
        why: "검증",
        riskScore: 80,
        riskLevel: "CRITICAL",
        createdAt: new Date().toISOString(),
      });

      const router = gatesRouter as unknown as {
        stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (req: Request, res: Response) => void }> } }>;
      };
      const layer = router.stack.find(
        (l) => l.route?.methods["post"] && l.route.path === "/:gateId/reject",
      );
      const handler = layer?.route?.stack[0]?.handle;
      if (!handler) throw new Error("POST /:gateId/reject 핸들러를 찾을 수 없음");

      const req = createMockRequest({
        params: { gateId: testGateId },
        body: { reason: "정책 위반" },
      });
      const mock = createMockResponse();

      // Act
      handler(req, mock.res);

      // Assert
      expect(gateResolver.resolveGate).toHaveBeenCalledWith(
        testGateId,
        expect.objectContaining({ action: "REJECT", reason: "정책 위반" }),
      );
    });

    it("should broadcast GATE_RESOLVED event via sseEmitter on reject", async () => {
      // Arrange
      const { gatesRouter, registerGate } = await import("./gates.js");
      const testGateId = "gate_rejectsset1";
      registerGate({
        gateId: testGateId,
        status: "PENDING",
        gateLevel: "L3",
        runId: "run_rjctsse",
        what: "SSE 거부 테스트",
        why: "SSE 검증",
        riskScore: 90,
        riskLevel: "CRITICAL",
        createdAt: new Date().toISOString(),
      });

      const router = gatesRouter as unknown as {
        stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (req: Request, res: Response) => void }> } }>;
      };
      const layer = router.stack.find(
        (l) => l.route?.methods["post"] && l.route.path === "/:gateId/reject",
      );
      const handler = layer?.route?.stack[0]?.handle;
      if (!handler) throw new Error("POST /:gateId/reject 핸들러를 찾을 수 없음");

      const req = createMockRequest({
        params: { gateId: testGateId },
        body: { reason: "긴급 중단" },
      });
      const mock = createMockResponse();

      // Act
      handler(req, mock.res);

      // Assert
      expect(sseEmitter.broadcast).toHaveBeenCalledWith(
        "GATE_RESOLVED",
        expect.objectContaining({ gateId: testGateId }),
      );
    });
  });
});

// -----------------------------------------------------------------------
// chat.ts — GET /api/chat, POST /api/chat
// -----------------------------------------------------------------------
describe("chatRouter", () => {
  // 핸들러 추출 헬퍼
  async function getChatRouterHandlers() {
    const { chatRouter } = await import("./chat.js");
    const router = chatRouter as unknown as {
      stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (req: Request, res: Response) => void }> } }>;
    };
    return router.stack;
  }

  describe("GET /", () => {
    it("should return success: true with message list", async () => {
      // Arrange
      const stack = await getChatRouterHandlers();
      const layer = stack.find((l) => l.route?.methods["get"] && l.route.path === "/");
      const handler = layer?.route?.stack[0]?.handle;
      if (!handler) throw new Error("GET / 핸들러를 찾을 수 없음");

      const req = createMockRequest();
      const mock = createMockResponse();

      // Act
      handler(req, mock.res);

      // Assert
      const body = mock.jsonPayload as { success: boolean; data: unknown[] };
      expect(body.success).toBe(true);
      expect(Array.isArray(body.data)).toBe(true);
    });

    it("should return all messages when no runId query is given", async () => {
      // Arrange
      const stack = await getChatRouterHandlers();
      const layer = stack.find((l) => l.route?.methods["get"] && l.route.path === "/");
      const handler = layer?.route?.stack[0]?.handle;
      if (!handler) throw new Error("GET / 핸들러를 찾을 수 없음");

      const req = createMockRequest({ query: {} });
      const mock = createMockResponse();

      // Act
      handler(req, mock.res);

      // Assert
      expect(mock.jsonCalled).toBe(true);
    });

    it("should filter messages by runId when query param is provided", async () => {
      // Arrange — 먼저 POST로 메시지를 하나 추가하여 runId가 부여된 상태를 만듦
      const stack = await getChatRouterHandlers();
      const getLayer = stack.find((l) => l.route?.methods["get"] && l.route.path === "/");
      const getHandler = getLayer?.route?.stack[0]?.handle;
      if (!getHandler) throw new Error("GET / 핸들러를 찾을 수 없음");

      const req = createMockRequest({ query: { runId: "run_notexist999" } });
      const mock = createMockResponse();

      // Act
      getHandler(req, mock.res);

      // Assert — 존재하지 않는 runId면 빈 배열 반환
      const body = mock.jsonPayload as { data: unknown[] };
      expect(body.data).toEqual([]);
    });
  });

  describe("POST /", () => {
    it("should return 400 when content is empty string", async () => {
      // Arrange
      const stack = await getChatRouterHandlers();
      const layer = stack.find((l) => l.route?.methods["post"] && l.route.path === "/");
      const handler = layer?.route?.stack[0]?.handle;
      if (!handler) throw new Error("POST / 핸들러를 찾을 수 없음");

      const req = createMockRequest({ body: { content: "", trustMode: "semi-auto" } });
      const mock = createMockResponse();

      // Act
      handler(req, mock.res);

      // Assert
      expect(mock.res.status).toHaveBeenCalledWith(400);
    });

    it("should return 400 with VALIDATION_FAILED code when content is whitespace", async () => {
      // Arrange
      const stack = await getChatRouterHandlers();
      const layer = stack.find((l) => l.route?.methods["post"] && l.route.path === "/");
      const handler = layer?.route?.stack[0]?.handle;
      if (!handler) throw new Error("POST / 핸들러를 찾을 수 없음");

      const req = createMockRequest({ body: { content: "   ", trustMode: "semi-auto" } });
      const mock = createMockResponse();

      // Act
      handler(req, mock.res);

      // Assert
      const body = mock.jsonPayload as { error: { code: string } };
      expect(body.error.code).toBe("VALIDATION_FAILED");
    });

    it("should return 400 when content is missing", async () => {
      // Arrange
      const stack = await getChatRouterHandlers();
      const layer = stack.find((l) => l.route?.methods["post"] && l.route.path === "/");
      const handler = layer?.route?.stack[0]?.handle;
      if (!handler) throw new Error("POST / 핸들러를 찾을 수 없음");

      const req = createMockRequest({ body: { trustMode: "semi-auto" } });
      const mock = createMockResponse();

      // Act
      handler(req, mock.res);

      // Assert
      expect(mock.res.status).toHaveBeenCalledWith(400);
    });

    it("should return success with USER role message when content is valid", async () => {
      // Arrange
      const stack = await getChatRouterHandlers();
      const layer = stack.find((l) => l.route?.methods["post"] && l.route.path === "/");
      const handler = layer?.route?.stack[0]?.handle;
      if (!handler) throw new Error("POST / 핸들러를 찾을 수 없음");

      const req = createMockRequest({
        body: { content: "GitHub PR 요약해줘", trustMode: "semi-auto" },
        headers: { "x-session-id": "sess_testchat001" },
      });
      const mock = createMockResponse();

      // Act
      handler(req, mock.res);

      // Assert
      const body = mock.jsonPayload as { success: boolean; data: { role: string } };
      expect(body.success).toBe(true);
      expect(body.data.role).toBe("USER");
    });

    it("should store trimmed content in message", async () => {
      // Arrange
      const stack = await getChatRouterHandlers();
      const layer = stack.find((l) => l.route?.methods["post"] && l.route.path === "/");
      const handler = layer?.route?.stack[0]?.handle;
      if (!handler) throw new Error("POST / 핸들러를 찾을 수 없음");

      const req = createMockRequest({
        body: { content: "  공백 포함 메시지  ", trustMode: "observe" },
        headers: { "x-session-id": "sess_trim001" },
      });
      const mock = createMockResponse();

      // Act
      handler(req, mock.res);

      // Assert
      const body = mock.jsonPayload as { data: { content: string } };
      expect(body.data.content).toBe("공백 포함 메시지");
    });

    it("should call jarvisRuntime.startRun with correct args", async () => {
      // Arrange
      const stack = await getChatRouterHandlers();
      const layer = stack.find((l) => l.route?.methods["post"] && l.route.path === "/");
      const handler = layer?.route?.stack[0]?.handle;
      if (!handler) throw new Error("POST / 핸들러를 찾을 수 없음");

      const req = createMockRequest({
        body: { content: "파이프라인 시작 테스트", trustMode: "full-auto" },
        headers: { "x-session-id": "sess_start001" },
      });
      const mock = createMockResponse();

      // Act
      handler(req, mock.res);

      // Assert
      expect(jarvisRuntime.startRun).toHaveBeenCalledWith(
        "파이프라인 시작 테스트",
        "sess_start001",
        "full-auto",
      );
    });

    it("should broadcast CHAT_MESSAGE_ADDED event via sseEmitter", async () => {
      // Arrange
      const stack = await getChatRouterHandlers();
      const layer = stack.find((l) => l.route?.methods["post"] && l.route.path === "/");
      const handler = layer?.route?.stack[0]?.handle;
      if (!handler) throw new Error("POST / 핸들러를 찾을 수 없음");

      const req = createMockRequest({
        body: { content: "SSE 브로드캐스트 테스트", trustMode: "suggest" },
        headers: { "x-session-id": "sess_sse001" },
      });
      const mock = createMockResponse();

      // Act
      handler(req, mock.res);

      // Assert
      expect(sseEmitter.broadcast).toHaveBeenCalledWith(
        "CHAT_MESSAGE_ADDED",
        expect.objectContaining({ message: expect.objectContaining({ role: "USER" }) }),
      );
    });

    it("should return success even when startRun throws an error", async () => {
      // Arrange — startRun이 예외를 던지는 경우도 메시지는 저장되어야 함
      vi.mocked(jarvisRuntime.startRun).mockImplementation(() => {
        throw new Error("파이프라인 시작 실패 시뮬레이션");
      });

      const stack = await getChatRouterHandlers();
      const layer = stack.find((l) => l.route?.methods["post"] && l.route.path === "/");
      const handler = layer?.route?.stack[0]?.handle;
      if (!handler) throw new Error("POST / 핸들러를 찾을 수 없음");

      const req = createMockRequest({
        body: { content: "에러 복구 테스트", trustMode: "semi-auto" },
        headers: { "x-session-id": "sess_errhndl" },
      });
      const mock = createMockResponse();

      // Act — startRun 실패해도 HTTP 200 응답이어야 함
      handler(req, mock.res);

      // Assert
      const body = mock.jsonPayload as { success: boolean };
      expect(body.success).toBe(true);
    });

    it("should set contextBadge to OBSERVE_ONLY when trustMode is observe", async () => {
      // Arrange
      vi.mocked(jarvisRuntime.startRun).mockReturnValue("run_observe001");

      const stack = await getChatRouterHandlers();
      const layer = stack.find((l) => l.route?.methods["post"] && l.route.path === "/");
      const handler = layer?.route?.stack[0]?.handle;
      if (!handler) throw new Error("POST / 핸들러를 찾을 수 없음");

      const req = createMockRequest({
        body: { content: "관찰 모드 테스트", trustMode: "observe" },
        headers: { "x-session-id": "sess_obs001" },
      });
      const mock = createMockResponse();

      // Act
      handler(req, mock.res);

      // Assert
      const body = mock.jsonPayload as { data: { contextBadge: string } };
      expect(body.data.contextBadge).toBe("OBSERVE_ONLY");
    });
  });
});

// -----------------------------------------------------------------------
// audit.ts — GET /api/audit
// -----------------------------------------------------------------------
describe("auditRouter — GET /", () => {
  async function getAuditHandler() {
    const { auditRouter } = await import("./audit.js");
    const router = auditRouter as unknown as {
      stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (req: Request, res: Response) => void }> } }>;
    };
    const layer = router.stack.find((l) => l.route?.methods["get"] && l.route.path === "/");
    const handler = layer?.route?.stack[0]?.handle;
    if (!handler) throw new Error("GET / 핸들러를 찾을 수 없음");
    return handler;
  }

  it("should return empty entries when auditStore is null", async () => {
    // Arrange — getAuditStore()가 null 반환
    vi.mocked(jarvisRuntime.getAuditStore).mockReturnValue(null);
    const handler = await getAuditHandler();

    const req = createMockRequest();
    const mock = createMockResponse();

    // Act
    handler(req, mock.res);

    // Assert
    const body = mock.jsonPayload as { success: boolean; data: { entries: unknown[]; total: number; hasMore: boolean } };
    expect(body.success).toBe(true);
    expect(body.data.entries).toEqual([]);
    expect(body.data.total).toBe(0);
    expect(body.data.hasMore).toBe(false);
  });

  it("should call getLatest when no runId query param", async () => {
    // Arrange
    const mockEntries = [
      { entryId: "e1", agentId: "agt_001" },
      { entryId: "e2", agentId: "agt_002" },
    ];
    const mockStore = {
      getLatest: vi.fn(() => ({ ok: true, value: mockEntries })),
      getByRunId: vi.fn(() => ({ ok: true, value: [] })),
    };
    vi.mocked(jarvisRuntime.getAuditStore).mockReturnValue(
      mockStore as never,
    );

    const handler = await getAuditHandler();
    const req = createMockRequest();
    const mock = createMockResponse();

    // Act
    handler(req, mock.res);

    // Assert
    expect(mockStore.getLatest).toHaveBeenCalledWith(50);
    expect(mockStore.getByRunId).not.toHaveBeenCalled();
  });

  it("should call getByRunId when runId query param is provided", async () => {
    // Arrange
    const mockEntries = [{ entryId: "e_run001", agentId: "agt_spec_001" }];
    const mockStore = {
      getLatest: vi.fn(() => ({ ok: true, value: [] })),
      getByRunId: vi.fn(() => ({ ok: true, value: mockEntries })),
    };
    vi.mocked(jarvisRuntime.getAuditStore).mockReturnValue(
      mockStore as never,
    );

    const handler = await getAuditHandler();
    const req = createMockRequest({ query: { runId: "run_filter001" } });
    const mock = createMockResponse();

    // Act
    handler(req, mock.res);

    // Assert
    expect(mockStore.getByRunId).toHaveBeenCalledWith("run_filter001");
    expect(mockStore.getLatest).not.toHaveBeenCalled();
  });

  it("should return entries in response data when store has results", async () => {
    // Arrange
    const mockEntries = [
      { entryId: "e_001", agentId: "agt_spec_001", action: "SPEC_ANALYZED" },
    ];
    const mockStore = {
      getLatest: vi.fn(() => ({ ok: true, value: mockEntries })),
      getByRunId: vi.fn(() => ({ ok: true, value: [] })),
    };
    vi.mocked(jarvisRuntime.getAuditStore).mockReturnValue(
      mockStore as never,
    );

    const handler = await getAuditHandler();
    const req = createMockRequest();
    const mock = createMockResponse();

    // Act
    handler(req, mock.res);

    // Assert
    const body = mock.jsonPayload as { data: { entries: typeof mockEntries; total: number } };
    expect(body.data.entries).toEqual(mockEntries);
    expect(body.data.total).toBe(1);
  });

  it("should return empty entries when store result is not ok", async () => {
    // Arrange
    const mockStore = {
      getLatest: vi.fn(() => ({ ok: false, error: { code: "DB_ERROR", message: "쿼리 실패" } })),
      getByRunId: vi.fn(() => ({ ok: false, error: { code: "DB_ERROR", message: "쿼리 실패" } })),
    };
    vi.mocked(jarvisRuntime.getAuditStore).mockReturnValue(
      mockStore as never,
    );

    const handler = await getAuditHandler();
    const req = createMockRequest();
    const mock = createMockResponse();

    // Act
    handler(req, mock.res);

    // Assert
    const body = mock.jsonPayload as { data: { entries: unknown[]; total: number } };
    expect(body.data.entries).toEqual([]);
    expect(body.data.total).toBe(0);
  });

  it("should cap limit at 200 even if larger value is requested", async () => {
    // Arrange
    const mockStore = {
      getLatest: vi.fn(() => ({ ok: true, value: [] })),
      getByRunId: vi.fn(() => ({ ok: true, value: [] })),
    };
    vi.mocked(jarvisRuntime.getAuditStore).mockReturnValue(
      mockStore as never,
    );

    const handler = await getAuditHandler();
    // limit=999 요청 → 실제로는 200으로 제한
    const req = createMockRequest({ query: { limit: "999" } });
    const mock = createMockResponse();

    // Act
    handler(req, mock.res);

    // Assert — getLatest는 200으로 호출되어야 함
    expect(mockStore.getLatest).toHaveBeenCalledWith(200);
  });
});

// -----------------------------------------------------------------------
// emergency.ts — POST /api/emergency-stop
// -----------------------------------------------------------------------
describe("emergencyRouter — POST /", () => {
  async function getEmergencyHandler() {
    const { emergencyRouter } = await import("./emergency.js");
    const router = emergencyRouter as unknown as {
      stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (req: Request, res: Response) => void }> } }>;
    };
    const layer = router.stack.find((l) => l.route?.methods["post"] && l.route.path === "/");
    const handler = layer?.route?.stack[0]?.handle;
    if (!handler) throw new Error("POST / 핸들러를 찾을 수 없음");
    return handler;
  }

  it("should return success: true on valid emergency stop", async () => {
    // Arrange
    const handler = await getEmergencyHandler();
    const req = createMockRequest({
      body: { runId: "run_stop001", reason: "사용자 긴급 중단" },
    });
    const mock = createMockResponse();

    // Act
    handler(req, mock.res);

    // Assert
    const body = mock.jsonPayload as { success: boolean };
    expect(body.success).toBe(true);
  });

  it("should return stopped: true in response data", async () => {
    // Arrange
    const handler = await getEmergencyHandler();
    const req = createMockRequest({
      body: { runId: "run_stop002", reason: "즉시 중단 필요" },
    });
    const mock = createMockResponse();

    // Act
    handler(req, mock.res);

    // Assert
    const body = mock.jsonPayload as { data: { stopped: boolean } };
    expect(body.data.stopped).toBe(true);
  });

  it("should reflect the provided runId in response data", async () => {
    // Arrange
    const handler = await getEmergencyHandler();
    const req = createMockRequest({
      body: { runId: "run_emergtest001", reason: "테스트 중단" },
    });
    const mock = createMockResponse();

    // Act
    handler(req, mock.res);

    // Assert
    const body = mock.jsonPayload as { data: { runId: string } };
    expect(body.data.runId).toBe("run_emergtest001");
  });

  it("should broadcast EMERGENCY_STOPPED event via sseEmitter", async () => {
    // Arrange
    const handler = await getEmergencyHandler();
    const req = createMockRequest({
      body: { runId: "run_emergsse", reason: "SSE 긴급 중단 테스트" },
    });
    const mock = createMockResponse();

    // Act
    handler(req, mock.res);

    // Assert
    expect(sseEmitter.broadcast).toHaveBeenCalledWith(
      "EMERGENCY_STOPPED",
      expect.objectContaining({
        runId: "run_emergsse",
        reason: "SSE 긴급 중단 테스트",
      }),
    );
  });

  it("should include stoppedAt ISO timestamp in response data", async () => {
    // Arrange
    const handler = await getEmergencyHandler();
    const req = createMockRequest({
      body: { runId: "run_ts001", reason: "타임스탬프 테스트" },
    });
    const mock = createMockResponse();

    // Act
    handler(req, mock.res);

    // Assert
    const body = mock.jsonPayload as { data: { stoppedAt: string } };
    expect(isIsoTimestamp(body.data.stoppedAt)).toBe(true);
  });

  it("should return runId as unknown when body has no runId", async () => {
    // Arrange
    const handler = await getEmergencyHandler();
    const req = createMockRequest({
      body: { reason: "runId 없는 긴급 중단" },
    });
    const mock = createMockResponse();

    // Act
    handler(req, mock.res);

    // Assert — runId가 없으면 "unknown" 반환
    const body = mock.jsonPayload as { data: { runId: string } };
    expect(body.data.runId).toBe("unknown");
  });

  it("should set rollbackPointId to null in response data", async () => {
    // Arrange
    const handler = await getEmergencyHandler();
    const req = createMockRequest({
      body: { runId: "run_rp001", reason: "롤백포인트 없음 테스트" },
    });
    const mock = createMockResponse();

    // Act
    handler(req, mock.res);

    // Assert
    const body = mock.jsonPayload as { data: { rollbackPointId: null } };
    expect(body.data.rollbackPointId).toBeNull();
  });
});

// -----------------------------------------------------------------------
// policies.ts — GET /api/policies
// -----------------------------------------------------------------------
describe("policiesRouter — GET /", () => {
  async function getPoliciesHandler() {
    const { policiesRouter } = await import("./policies.js");
    const router = policiesRouter as unknown as {
      stack: Array<{ route?: { path: string; methods: Record<string, boolean>; stack: Array<{ handle: (req: Request, res: Response) => void }> } }>;
    };
    const layer = router.stack.find((l) => l.route?.methods["get"] && l.route.path === "/");
    const handler = layer?.route?.stack[0]?.handle;
    if (!handler) throw new Error("GET / 핸들러를 찾을 수 없음");
    return handler;
  }

  it("should return success: true", async () => {
    // Arrange
    const handler = await getPoliciesHandler();
    const req = createMockRequest();
    const mock = createMockResponse();

    // Act
    handler(req, mock.res);

    // Assert
    const body = mock.jsonPayload as { success: boolean };
    expect(body.success).toBe(true);
  });

  it("should return active policies as non-empty array", async () => {
    // Arrange
    const handler = await getPoliciesHandler();
    const req = createMockRequest();
    const mock = createMockResponse();

    // Act
    handler(req, mock.res);

    // Assert
    const body = mock.jsonPayload as { data: { active: unknown[] } };
    expect(Array.isArray(body.data.active)).toBe(true);
    expect(body.data.active.length).toBeGreaterThan(0);
  });

  it("should return 3 active policies", async () => {
    // Arrange
    const handler = await getPoliciesHandler();
    const req = createMockRequest();
    const mock = createMockResponse();

    // Act
    handler(req, mock.res);

    // Assert
    const body = mock.jsonPayload as { data: { active: unknown[] } };
    expect(body.data.active).toHaveLength(3);
  });

  it("should return proposed policies as empty array", async () => {
    // Arrange
    const handler = await getPoliciesHandler();
    const req = createMockRequest();
    const mock = createMockResponse();

    // Act
    handler(req, mock.res);

    // Assert
    const body = mock.jsonPayload as { data: { proposed: unknown[] } };
    expect(Array.isArray(body.data.proposed)).toBe(true);
    expect(body.data.proposed).toEqual([]);
  });

  it("should include policyId, name, description fields in each active policy", async () => {
    // Arrange
    const handler = await getPoliciesHandler();
    const req = createMockRequest();
    const mock = createMockResponse();

    // Act
    handler(req, mock.res);

    // Assert — 각 정책에 필수 필드 존재 검증
    const body = mock.jsonPayload as {
      data: { active: Array<{ policyId: string; name: string; description: string; isActive: boolean }> };
    };
    for (const policy of body.data.active) {
      expect(typeof policy.policyId).toBe("string");
      expect(typeof policy.name).toBe("string");
      expect(typeof policy.description).toBe("string");
      expect(policy.isActive).toBe(true);
    }
  });

  it("should include createdAt ISO timestamp in each active policy", async () => {
    // Arrange
    const handler = await getPoliciesHandler();
    const req = createMockRequest();
    const mock = createMockResponse();

    // Act
    handler(req, mock.res);

    // Assert
    const body = mock.jsonPayload as {
      data: { active: Array<{ createdAt: string }> };
    };
    for (const policy of body.data.active) {
      expect(isIsoTimestamp(policy.createdAt)).toBe(true);
    }
  });

  it("should include priority field as number in each policy", async () => {
    // Arrange
    const handler = await getPoliciesHandler();
    const req = createMockRequest();
    const mock = createMockResponse();

    // Act
    handler(req, mock.res);

    // Assert
    const body = mock.jsonPayload as {
      data: { active: Array<{ priority: number }> };
    };
    for (const policy of body.data.active) {
      expect(typeof policy.priority).toBe("number");
    }
  });
});
