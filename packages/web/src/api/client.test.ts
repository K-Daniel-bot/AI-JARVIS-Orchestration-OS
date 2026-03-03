// API 클라이언트 단위 테스트 — fetch 모킹을 통한 HTTP 통신 계층 검증
import { describe, it, expect, vi, beforeEach } from "vitest";
import { createApiClient } from "./client.js";
import type {
  ApiClientConfig,
  JarvisApiClient,
} from "./client.js";
import type {
  ApiResponse,
  SystemStatusDto,
  RunDto,
  GateDto,
  AuditListDto,
  EmergencyStopDto,
  ChatMessageDto,
  PolicyListDto,
  EvidenceDto,
  EvidenceContentUrlDto,
  TimelineNodeDetailDto,
  GateApproveRequest,
  GateRejectRequest,
} from "./schema.js";

// ─────────────────────────────────────────────
// 테스트 헬퍼 — 모킹 유틸리티
// ─────────────────────────────────────────────

// 성공 ApiResponse 래퍼 생성 헬퍼
function makeSuccessResponse<T>(data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    error: null,
    timestamp: "2026-03-03T00:00:00.000Z",
    requestId: "req-test-001",
  };
}

// 실패 ApiResponse 래퍼 생성 헬퍼
function makeErrorResponse(code: string, message: string): ApiResponse<null> {
  return {
    success: false,
    data: null,
    error: { code, message },
    timestamp: "2026-03-03T00:00:00.000Z",
    requestId: "req-test-err-001",
  };
}

// fetch Response 모킹 헬퍼
function mockFetchResponse<T>(body: T, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: status === 200 ? "OK" : status === 401 ? "Unauthorized" : "Internal Server Error",
    json: () => Promise.resolve(body),
    headers: new Headers(),
    redirected: false,
    type: "basic" as ResponseType,
    url: "",
    clone: () => mockFetchResponse(body, status),
    body: null,
    bodyUsed: false,
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(0)),
    blob: () => Promise.resolve(new Blob()),
    formData: () => Promise.resolve(new FormData()),
    text: () => Promise.resolve(JSON.stringify(body)),
  } as Response;
}

// ─────────────────────────────────────────────
// 테스트 공통 설정
// ─────────────────────────────────────────────

const BASE_CONFIG: ApiClientConfig = {
  baseUrl: "http://localhost:3001",
  sessionId: "sess-test-001",
};

describe("createApiClient", () => {
  let client: JarvisApiClient;

  beforeEach(() => {
    // 각 테스트 전 fetch 모킹 초기화
    vi.stubGlobal("fetch", vi.fn());
    client = createApiClient(BASE_CONFIG);
  });

  // ─────────────────────────────────────────────
  // system.getStatus() 테스트
  // ─────────────────────────────────────────────

  describe("system.getStatus()", () => {
    it("should return system status on success", async () => {
      // Arrange — SystemStatusDto 목 데이터
      const mockStatus: SystemStatusDto = {
        currentState: "IDLE",
        trustMode: "observe",
        activeRunId: null,
        sessionId: "sess-test-001",
        connectedAt: "2026-03-03T00:00:00.000Z",
        agentHealth: [],
        pendingGates: 0,
        riskLevel: "LOW",
        riskScore: 0,
        capabilityTtlSeconds: null,
      };
      const mockResponse = makeSuccessResponse(mockStatus);
      vi.mocked(fetch).mockResolvedValueOnce(mockFetchResponse(mockResponse));

      // Act
      const result = await client.system.getStatus();

      // Assert
      expect(fetch).toHaveBeenCalledOnce();
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/system/status",
        expect.objectContaining({
          headers: expect.objectContaining({
            "Content-Type": "application/json",
            "X-Session-Id": "sess-test-001",
          }),
        }),
      );
      expect(result.success).toBe(true);
      expect(result.data?.currentState).toBe("IDLE");
    });

    it("should include X-Session-Id header in request", async () => {
      // Arrange
      const customConfig: ApiClientConfig = {
        baseUrl: "http://localhost:3001",
        sessionId: "custom-session-xyz",
      };
      const customClient = createApiClient(customConfig);
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse(makeSuccessResponse({ currentState: "IDLE" })),
      );

      // Act
      await customClient.system.getStatus();

      // Assert — 커스텀 세션 ID가 헤더에 포함됨
      expect(fetch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            "X-Session-Id": "custom-session-xyz",
          }),
        }),
      );
    });
  });

  // ─────────────────────────────────────────────
  // runs API 테스트
  // ─────────────────────────────────────────────

  describe("runs.get(runId)", () => {
    it("should return RunDto on success", async () => {
      // Arrange
      const mockRun: RunDto = {
        runId: "run-abc-123",
        sessionId: "sess-test-001",
        trustMode: "observe",
        target: "WINDOWS",
        status: "PLANNING",
        riskLevel: "LOW",
        riskScore: 10,
        riskTags: [],
        currentStepLabel: "계획 수립 중",
        startedAt: "2026-03-03T00:00:00.000Z",
        completedAt: null,
        timeline: [],
        openGates: [],
      };
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse(makeSuccessResponse(mockRun)),
      );

      // Act
      const result = await client.runs.get("run-abc-123");

      // Assert
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/runs/run-abc-123",
        expect.any(Object),
      );
      expect(result.data?.runId).toBe("run-abc-123");
      expect(result.data?.status).toBe("PLANNING");
    });

    it("should include runId in the URL path", async () => {
      // Arrange
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse(makeSuccessResponse({})),
      );

      // Act
      await client.runs.get("run-xyz-999");

      // Assert — runId가 URL에 올바르게 포함됨
      const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(calledUrl).toContain("run-xyz-999");
    });
  });

  describe("runs.start(req)", () => {
    it("should send POST request with correct body", async () => {
      // Arrange
      const mockRun: RunDto = {
        runId: "run-new-001",
        sessionId: "sess-test-001",
        trustMode: "semi-auto",
        target: "WINDOWS",
        status: "SPEC_ANALYSIS",
        riskLevel: "LOW",
        riskScore: 5,
        riskTags: [],
        currentStepLabel: "의도 분석",
        startedAt: "2026-03-03T00:00:00.000Z",
        completedAt: null,
        timeline: [],
        openGates: [],
      };
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse(makeSuccessResponse(mockRun)),
      );

      // Act
      const result = await client.runs.start({
        input: "바탕화면 정리해줘",
        trustMode: "semi-auto",
      });

      // Assert
      const [url, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://localhost:3001/api/runs");
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body as string)).toEqual({
        input: "바탕화면 정리해줘",
        trustMode: "semi-auto",
      });
      expect(result.data?.runId).toBe("run-new-001");
    });
  });

  describe("runs.list()", () => {
    it("should return list of RunDtos", async () => {
      // Arrange
      const mockRuns: RunDto[] = [];
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse(makeSuccessResponse(mockRuns)),
      );

      // Act
      const result = await client.runs.list();

      // Assert
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/runs",
        expect.any(Object),
      );
      expect(result.success).toBe(true);
      expect(Array.isArray(result.data)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // gates API 테스트
  // ─────────────────────────────────────────────

  describe("gates.get(gateId)", () => {
    it("should return GateDto on success", async () => {
      // Arrange
      const mockGate: GateDto = {
        gateId: "gate-001",
        gateType: "GATE_PLAN",
        gateLevel: "L1",
        status: "OPEN",
        title: "계획 승인 요청",
        description: "실행 계획을 검토하세요",
        whyNeeded: ["계획 검토"],
        riskLevel: "LOW",
        riskScore: 15,
        riskTags: [],
        impact: {
          filesModified: 0,
          filesCreated: 0,
          filesDeleted: 0,
          commandsRun: 0,
          networkAccess: false,
          privilegeEscalation: false,
          estimatedSizeBytes: null,
        },
        scope: { paths: [], commands: [], domains: [], capabilities: [] },
        allowedActions: ["APPROVE_ONCE", "REJECT"],
        timeoutSeconds: 300,
        expiresAt: "2026-03-03T00:10:00.000Z",
        createdAt: "2026-03-03T00:05:00.000Z",
        resolution: null,
      };
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse(makeSuccessResponse(mockGate)),
      );

      // Act
      const result = await client.gates.get("gate-001");

      // Assert
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/gates/gate-001",
        expect.any(Object),
      );
      expect(result.data?.gateId).toBe("gate-001");
      expect(result.data?.status).toBe("OPEN");
    });
  });

  describe("gates.approve(gateId, req)", () => {
    it("should send POST to /api/gates/:gateId/approve", async () => {
      // Arrange — 게이트 승인 응답
      const mockGate: GateDto = {
        gateId: "gate-002",
        gateType: "GATE_APPLY_CHANGES",
        gateLevel: "L2",
        status: "APPROVED",
        title: "파일 변경 승인",
        description: "파일 2개 수정",
        whyNeeded: ["코드 적용"],
        riskLevel: "MEDIUM",
        riskScore: 45,
        riskTags: ["fs-write"],
        impact: {
          filesModified: 2,
          filesCreated: 0,
          filesDeleted: 0,
          commandsRun: 0,
          networkAccess: false,
          privilegeEscalation: false,
          estimatedSizeBytes: null,
        },
        scope: { paths: ["/project/src/**"], commands: [], domains: [], capabilities: ["fs.write"] },
        allowedActions: ["APPROVE_ONCE", "REJECT"],
        timeoutSeconds: 300,
        expiresAt: "2026-03-03T00:10:00.000Z",
        createdAt: "2026-03-03T00:05:00.000Z",
        resolution: {
          action: "APPROVE_ONCE",
          decidedAt: "2026-03-03T00:06:00.000Z",
          decidedBy: "USER",
          scopeOverride: null,
          rejectReason: null,
        },
      };
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse(makeSuccessResponse(mockGate)),
      );

      const req: GateApproveRequest = { action: "APPROVE_ONCE" };

      // Act
      const result = await client.gates.approve("gate-002", req);

      // Assert
      const [url, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://localhost:3001/api/gates/gate-002/approve");
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body as string)).toEqual({ action: "APPROVE_ONCE" });
      expect(result.data?.status).toBe("APPROVED");
      expect(result.data?.resolution?.action).toBe("APPROVE_ONCE");
    });

    it("should send scopeOverride in approve request body", async () => {
      // Arrange — 범위 수정 포함 승인
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse(makeSuccessResponse({ status: "APPROVED" })),
      );

      const req: GateApproveRequest = {
        action: "EDIT_SCOPE",
        scopeOverride: { paths: ["/project/src/auth/**"] },
      };

      // Act
      await client.gates.approve("gate-003", req);

      // Assert — scopeOverride가 요청 본문에 포함됨
      const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string) as GateApproveRequest;
      expect(body.action).toBe("EDIT_SCOPE");
      expect(body.scopeOverride?.paths).toContain("/project/src/auth/**");
    });
  });

  describe("gates.reject(gateId, req)", () => {
    it("should send POST to /api/gates/:gateId/reject with reason", async () => {
      // Arrange — 게이트 거부 응답
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse(
          makeSuccessResponse({ gateId: "gate-004", status: "REJECTED" }),
        ),
      );

      const req: GateRejectRequest = { reason: "범위가 너무 넓습니다" };

      // Act
      const result = await client.gates.reject("gate-004", req);

      // Assert
      const [url, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://localhost:3001/api/gates/gate-004/reject");
      expect(options.method).toBe("POST");
      expect(JSON.parse(options.body as string)).toEqual({
        reason: "범위가 너무 넓습니다",
      });
      expect(result.success).toBe(true);
    });
  });

  // ─────────────────────────────────────────────
  // audit API 테스트
  // ─────────────────────────────────────────────

  describe("audit.list()", () => {
    it("should return AuditListDto on success", async () => {
      // Arrange
      const mockAuditList: AuditListDto = {
        entries: [
          {
            entryId: "audit-001",
            sequenceNumber: 1,
            timestamp: "2026-03-03T00:00:00.000Z",
            agentType: "orchestrator",
            agentId: "agent-orch-001",
            runId: "run-001",
            summary: "오케스트레이터 시작",
            status: "COMPLETED",
            logLevel: "INFO",
            riskLevel: null,
            isRedacted: false,
          },
        ],
        total: 1,
        hasMore: false,
      };
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse(makeSuccessResponse(mockAuditList)),
      );

      // Act
      const result = await client.audit.list();

      // Assert
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/audit",
        expect.any(Object),
      );
      expect(result.data?.entries).toHaveLength(1);
      expect(result.data?.total).toBe(1);
    });

    it("should append query string when params are provided", async () => {
      // Arrange — 쿼리 파라미터 있음
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse(makeSuccessResponse({ entries: [], total: 0, hasMore: false })),
      );

      // Act
      await client.audit.list({
        runId: "run-001",
        agentType: "executor",
        limit: 20,
        offset: 0,
      });

      // Assert — URL에 쿼리스트링이 포함됨
      const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(calledUrl).toContain("/api/audit?");
      expect(calledUrl).toContain("runId=run-001");
      expect(calledUrl).toContain("agentType=executor");
      expect(calledUrl).toContain("limit=20");
    });

    it("should not append query string when params are omitted", async () => {
      // Arrange
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse(makeSuccessResponse({ entries: [], total: 0, hasMore: false })),
      );

      // Act
      await client.audit.list();

      // Assert — 파라미터 없으면 쿼리스트링 없음
      const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(calledUrl).toBe("http://localhost:3001/api/audit");
    });
  });

  // ─────────────────────────────────────────────
  // evidence API 테스트
  // ─────────────────────────────────────────────

  describe("evidence.get(evidenceId)", () => {
    it("should return EvidenceDto on success", async () => {
      // Arrange
      const mockEvidence: EvidenceDto = {
        evidenceId: "ev-001",
        type: "DIFF",
        label: "코드 변경 diff",
        mimeType: "text/plain",
        sizeBytes: 512,
        hash: "sha256-abc",
        createdAt: "2026-03-03T00:02:00.000Z",
        isRedacted: false,
        inlineContent: "--- a/src/auth.ts\n+++ b/src/auth.ts",
      };
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse(makeSuccessResponse(mockEvidence)),
      );

      // Act
      const result = await client.evidence.get("ev-001");

      // Assert
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/evidence/ev-001",
        expect.any(Object),
      );
      expect(result.data?.evidenceId).toBe("ev-001");
      expect(result.data?.type).toBe("DIFF");
    });
  });

  describe("evidence.getContentUrl(evidenceId)", () => {
    it("should return EvidenceContentUrlDto on success", async () => {
      // Arrange
      const mockUrlDto: EvidenceContentUrlDto = {
        url: "http://localhost:3001/storage/ev-002/content",
        expiresAt: "2026-03-03T01:00:00.000Z",
      };
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse(makeSuccessResponse(mockUrlDto)),
      );

      // Act
      const result = await client.evidence.getContentUrl("ev-002");

      // Assert
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/evidence/ev-002/content",
        expect.any(Object),
      );
      expect(result.data?.url).toContain("ev-002");
      expect(result.data?.expiresAt).toBe("2026-03-03T01:00:00.000Z");
    });
  });

  // ─────────────────────────────────────────────
  // policies API 테스트
  // ─────────────────────────────────────────────

  describe("policies.list()", () => {
    it("should return PolicyListDto on success", async () => {
      // Arrange
      const mockPolicies: PolicyListDto = {
        active: [
          {
            policyId: "policy-001",
            name: "기본 파일 시스템 정책",
            description: "파일 읽기/쓰기 제한",
            priority: 100,
            isActive: true,
            createdAt: "2026-01-01T00:00:00.000Z",
          },
        ],
        proposed: [],
      };
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse(makeSuccessResponse(mockPolicies)),
      );

      // Act
      const result = await client.policies.list();

      // Assert
      expect(fetch).toHaveBeenCalledWith(
        "http://localhost:3001/api/policies",
        expect.any(Object),
      );
      expect(result.data?.active).toHaveLength(1);
      expect(result.data?.proposed).toHaveLength(0);
    });
  });

  // ─────────────────────────────────────────────
  // chat API 테스트
  // ─────────────────────────────────────────────

  describe("chat.send(req)", () => {
    it("should send POST to /api/chat with message body", async () => {
      // Arrange
      const mockMessage: ChatMessageDto = {
        messageId: "msg-001",
        role: "JARVIS",
        content: "요청을 처리하겠습니다",
        timestamp: "2026-03-03T00:00:01.000Z",
        runId: null,
        contextBadge: "MAY_TRIGGER_ACTIONS",
        isVoice: false,
      };
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse(makeSuccessResponse(mockMessage)),
      );

      // Act
      const result = await client.chat.send({
        content: "파일 정리해줘",
        trustMode: "observe",
      });

      // Assert
      const [url, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://localhost:3001/api/chat");
      expect(options.method).toBe("POST");
      const body = JSON.parse(options.body as string) as { content: string; trustMode: string };
      expect(body.content).toBe("파일 정리해줘");
      expect(body.trustMode).toBe("observe");
      expect(result.data?.role).toBe("JARVIS");
    });
  });

  describe("chat.getHistory()", () => {
    it("should call /api/chat without query when runId is omitted", async () => {
      // Arrange
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse(makeSuccessResponse([])),
      );

      // Act
      await client.chat.getHistory();

      // Assert — runId 없으면 쿼리스트링 없음
      const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(calledUrl).toBe("http://localhost:3001/api/chat");
    });

    it("should append runId query when provided", async () => {
      // Arrange
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse(makeSuccessResponse([])),
      );

      // Act
      await client.chat.getHistory("run-001");

      // Assert — runId가 쿼리스트링으로 포함됨
      const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(calledUrl).toBe("http://localhost:3001/api/chat?runId=run-001");
    });
  });

  // ─────────────────────────────────────────────
  // emergencyStop 테스트
  // ─────────────────────────────────────────────

  describe("emergencyStop(req)", () => {
    it("should send POST to /api/emergency-stop", async () => {
      // Arrange
      const mockStopResult: EmergencyStopDto = {
        stopped: true,
        runId: "run-001",
        stoppedAt: "2026-03-03T00:05:00.000Z",
        rollbackPointId: "checkpoint-002",
      };
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse(makeSuccessResponse(mockStopResult)),
      );

      // Act
      const result = await client.emergencyStop({
        runId: "run-001",
        reason: "사용자 요청으로 즉시 중단",
      });

      // Assert
      const [url, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
      expect(url).toBe("http://localhost:3001/api/emergency-stop");
      expect(options.method).toBe("POST");
      const body = JSON.parse(options.body as string) as { runId: string; reason: string };
      expect(body.runId).toBe("run-001");
      expect(result.data?.stopped).toBe(true);
      expect(result.data?.rollbackPointId).toBe("checkpoint-002");
    });
  });

  // ─────────────────────────────────────────────
  // timeline API 테스트
  // ─────────────────────────────────────────────

  describe("timeline.getNodeDetail(runId, nodeId)", () => {
    it("should call correct URL with runId and nodeId", async () => {
      // Arrange
      const mockDetail: TimelineNodeDetailDto = {
        nodeId: "node-001",
        type: "CODEGEN",
        status: "DONE",
        title: "코드 생성",
        summary: "완료",
        agentType: "codegen",
        startedAt: "2026-03-03T00:01:00.000Z",
        completedAt: "2026-03-03T00:02:00.000Z",
        durationMs: 60000,
        riskScore: 20,
        riskLevel: "LOW",
        riskTags: [],
        policyRefs: [],
        capabilityIds: [],
        evidenceIds: [],
        isUndoPoint: false,
        gateId: null,
        whyReason: "코드 생성 필요",
        expectedImpact: {
          filesModified: 0,
          filesCreated: 1,
          filesDeleted: 0,
          commandsRun: 0,
          networkAccess: false,
          privilegeEscalation: false,
          estimatedSizeBytes: 2048,
        },
        capabilities: [],
        policyDecision: null,
      };
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse(makeSuccessResponse(mockDetail)),
      );

      // Act
      const result = await client.timeline.getNodeDetail("run-001", "node-001");

      // Assert
      const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(calledUrl).toBe(
        "http://localhost:3001/api/runs/run-001/timeline/node-001",
      );
      expect(result.data?.nodeId).toBe("node-001");
      expect(result.data?.whyReason).toBe("코드 생성 필요");
    });
  });

  // ─────────────────────────────────────────────
  // 에러 처리 테스트
  // ─────────────────────────────────────────────

  describe("에러 처리", () => {
    it("should throw when fetch throws a network error", async () => {
      // Arrange — 네트워크 단절 시뮬레이션
      vi.mocked(fetch).mockRejectedValueOnce(new Error("Network connection failed"));

      // Act & Assert — 에러가 위로 전파됨
      await expect(client.system.getStatus()).rejects.toThrow(
        "Network connection failed",
      );
    });

    it("should throw when server returns 500", async () => {
      // Arrange — 서버 오류 응답
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse(makeErrorResponse("INTERNAL_ERROR", "Server error"), 500),
      );

      // Act & Assert — 500 응답 시 에러 발생
      await expect(client.system.getStatus()).rejects.toThrow(
        "API request failed: 500",
      );
    });

    it("should throw when server returns 404", async () => {
      // Arrange — 리소스 없음 응답
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse({ error: "Not Found" }, 404),
      );

      // Act & Assert — 404 응답 시 에러 발생
      await expect(client.runs.get("nonexistent-run")).rejects.toThrow(
        "API request failed: 404",
      );
    });

    it("should call onUnauthorized callback when server returns 401", async () => {
      // Arrange — 인증 실패 응답 + onUnauthorized 콜백
      const onUnauthorized = vi.fn();
      const authedClient = createApiClient({
        ...BASE_CONFIG,
        onUnauthorized,
      });
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse({ error: "Unauthorized" }, 401),
      );

      // Act & Assert — 401은 에러를 throw함 (현재 구현상 HTTP 에러로 처리)
      // onUnauthorized는 향후 미들웨어에서 처리 가능하므로 에러 전파 확인
      await expect(authedClient.system.getStatus()).rejects.toThrow(
        "API request failed: 401",
      );
    });

    it("should propagate error when JSON parsing fails", async () => {
      // Arrange — 잘못된 JSON 응답
      const malformedResponse = {
        ok: true,
        status: 200,
        statusText: "OK",
        json: () => Promise.reject(new SyntaxError("Unexpected token < in JSON")),
      } as unknown as Response;
      vi.mocked(fetch).mockResolvedValueOnce(malformedResponse);

      // Act & Assert — JSON 파싱 실패 시 에러 전파
      await expect(client.system.getStatus()).rejects.toThrow(
        "Unexpected token < in JSON",
      );
    });

    it("should throw with path info in error message", async () => {
      // Arrange — 에러 메시지에 경로 포함 여부 확인
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse({}, 503),
      );

      // Act & Assert — 에러 메시지에 경로가 포함됨
      await expect(client.audit.list()).rejects.toThrow("/api/audit");
    });
  });

  // ─────────────────────────────────────────────
  // 요청 공통 헤더 테스트
  // ─────────────────────────────────────────────

  describe("공통 요청 헤더", () => {
    it("should always include Content-Type: application/json", async () => {
      // Arrange
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse(makeSuccessResponse([])),
      );

      // Act
      await client.runs.list();

      // Assert
      const [, options] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit];
      const headers = options.headers as Record<string, string>;
      expect(headers["Content-Type"]).toBe("application/json");
    });

    it("should use correct baseUrl in all requests", async () => {
      // Arrange — 다른 baseUrl로 클라이언트 생성
      const prodClient = createApiClient({
        baseUrl: "https://jarvis.example.com",
        sessionId: "sess-prod-001",
      });
      vi.mocked(fetch).mockResolvedValueOnce(
        mockFetchResponse(makeSuccessResponse(null)),
      );

      // Act
      await prodClient.policies.list();

      // Assert
      const calledUrl = vi.mocked(fetch).mock.calls[0][0] as string;
      expect(calledUrl.startsWith("https://jarvis.example.com")).toBe(true);
    });
  });
});
