// API 스키마 단위 테스트 — DTO 인터페이스 구조 및 타입 유니온 검증
import { describe, it, expect } from "vitest";
import type {
  ApiResponse,
  ApiError,
  SystemStatusDto,
  AgentHealthDto,
  RunDto,
  RunStatus,
  TimelineNodeDto,
  TimelineNodeType,
  TimelineNodeStatus,
  TimelineNodeDetailDto,
  ImpactSummaryDto,
  CapabilityUsedDto,
  PolicyDecisionSummaryDto,
  GateDto,
  GateStatus,
  GateAction,
  GateScopeDto,
  GateResolutionDto,
  GateApproveRequest,
  GateRejectRequest,
  AuditEntryDto,
  AuditQueryParams,
  AuditListDto,
  EvidenceDto,
  EvidenceType,
  EvidenceContentUrlDto,
  PolicySummaryDto,
  PolicyListDto,
  ChatMessageDto,
  SendMessageRequest,
  StartRunRequest,
  EmergencyStopRequest,
  EmergencyStopDto,
  SseEvent,
  SseEventType,
  SseRunCreatedPayload,
  SseGateOpenedPayload,
} from "./schema.js";

// ─────────────────────────────────────────────
// ApiResponse / ApiError 공통 래퍼 테스트
// ─────────────────────────────────────────────

describe("ApiResponse 공통 래퍼", () => {
  it("should create a successful ApiResponse with data", () => {
    // Arrange & Act — 성공 응답 객체 생성
    const response: ApiResponse<{ value: number }> = {
      success: true,
      data: { value: 42 },
      error: null,
      timestamp: "2026-03-03T00:00:00.000Z",
      requestId: "req-001",
    };

    // Assert
    expect(response.success).toBe(true);
    expect(response.data).toEqual({ value: 42 });
    expect(response.error).toBeNull();
    expect(response.timestamp).toBe("2026-03-03T00:00:00.000Z");
    expect(response.requestId).toBe("req-001");
  });

  it("should create a failed ApiResponse with error", () => {
    // Arrange & Act — 실패 응답 객체 생성
    const apiError: ApiError = {
      code: "VALIDATION_FAILED",
      message: "Invalid input parameters",
      details: { field: "runId", reason: "required" },
    };
    const response: ApiResponse<null> = {
      success: false,
      data: null,
      error: apiError,
      timestamp: "2026-03-03T00:00:00.000Z",
      requestId: "req-002",
    };

    // Assert
    expect(response.success).toBe(false);
    expect(response.data).toBeNull();
    expect(response.error?.code).toBe("VALIDATION_FAILED");
    expect(response.error?.message).toBe("Invalid input parameters");
    expect(response.error?.details?.field).toBe("runId");
  });

  it("should allow ApiError without optional details field", () => {
    // Arrange & Act — details 없는 에러
    const apiError: ApiError = {
      code: "INTERNAL_ERROR",
      message: "Unexpected server error",
    };

    // Assert — details 필드는 선택사항
    expect(apiError.code).toBe("INTERNAL_ERROR");
    expect(apiError.details).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// SystemStatusDto 테스트
// ─────────────────────────────────────────────

describe("SystemStatusDto", () => {
  it("should create a valid SystemStatusDto with all fields", () => {
    // Arrange
    const agentHealth: AgentHealthDto = {
      agentType: "orchestrator",
      agentId: "agent-orch-001",
      status: "HEALTHY",
      currentTask: null,
      lastActiveAt: "2026-03-03T00:00:00.000Z",
      consecutiveFailures: 0,
    };

    // Act
    const statusDto: SystemStatusDto = {
      currentState: "IDLE",
      trustMode: "observe",
      activeRunId: null,
      sessionId: "sess-001",
      connectedAt: "2026-03-03T00:00:00.000Z",
      agentHealth: [agentHealth],
      pendingGates: 0,
      riskLevel: "LOW",
      riskScore: 10,
      capabilityTtlSeconds: null,
    };

    // Assert
    expect(statusDto.currentState).toBe("IDLE");
    expect(statusDto.trustMode).toBe("observe");
    expect(statusDto.activeRunId).toBeNull();
    expect(statusDto.agentHealth).toHaveLength(1);
    expect(statusDto.agentHealth[0].agentType).toBe("orchestrator");
    expect(statusDto.pendingGates).toBe(0);
    expect(statusDto.riskLevel).toBe("LOW");
    expect(statusDto.capabilityTtlSeconds).toBeNull();
  });

  it("should allow activeRunId and capabilityTtlSeconds as non-null", () => {
    // Arrange & Act — 활성 실행과 TTL이 있는 상태
    const statusDto: SystemStatusDto = {
      currentState: "CODE_GENERATION",
      trustMode: "semi-auto",
      activeRunId: "run-abc-123",
      sessionId: "sess-002",
      connectedAt: "2026-03-03T01:00:00.000Z",
      agentHealth: [],
      pendingGates: 1,
      riskLevel: "HIGH",
      riskScore: 75,
      capabilityTtlSeconds: 300,
    };

    // Assert
    expect(statusDto.activeRunId).toBe("run-abc-123");
    expect(statusDto.capabilityTtlSeconds).toBe(300);
    expect(statusDto.pendingGates).toBe(1);
  });
});

// ─────────────────────────────────────────────
// AgentHealthDto 테스트
// ─────────────────────────────────────────────

describe("AgentHealthDto", () => {
  it("should create a healthy agent health DTO", () => {
    // Arrange & Act
    const dto: AgentHealthDto = {
      agentType: "codegen",
      agentId: "agent-codegen-001",
      status: "HEALTHY",
      currentTask: "코드 생성 중",
      lastActiveAt: "2026-03-03T00:00:00.000Z",
      consecutiveFailures: 0,
    };

    // Assert
    expect(dto.agentType).toBe("codegen");
    expect(dto.status).toBe("HEALTHY");
    expect(dto.currentTask).toBe("코드 생성 중");
    expect(dto.consecutiveFailures).toBe(0);
  });

  it("should create a degraded agent with failures", () => {
    // Arrange & Act — 장애 상태 에이전트
    const dto: AgentHealthDto = {
      agentType: "executor",
      agentId: "agent-exec-002",
      status: "DEGRADED",
      currentTask: null,
      lastActiveAt: "2026-03-03T00:00:00.000Z",
      consecutiveFailures: 3,
    };

    // Assert
    expect(dto.status).toBe("DEGRADED");
    expect(dto.consecutiveFailures).toBe(3);
    expect(dto.currentTask).toBeNull();
  });

  it("should accept all valid AgentHealthStatus values", () => {
    // Arrange — 모든 유효 상태값 테스트
    const statuses: AgentHealthDto["status"][] = [
      "HEALTHY",
      "DEGRADED",
      "UNRESPONSIVE",
      "CRASHED",
    ];

    // Assert — 각 상태가 올바른 타입임을 확인
    expect(statuses).toHaveLength(4);
    expect(statuses).toContain("HEALTHY");
    expect(statuses).toContain("CRASHED");
  });
});

// ─────────────────────────────────────────────
// RunDto 테스트
// ─────────────────────────────────────────────

describe("RunDto", () => {
  it("should create a valid RunDto with all required fields", () => {
    // Arrange & Act
    const runDto: RunDto = {
      runId: "run-001",
      sessionId: "sess-001",
      trustMode: "observe",
      target: "WINDOWS",
      status: "SPEC_ANALYSIS",
      riskLevel: "LOW",
      riskScore: 15,
      riskTags: ["file-read"],
      currentStepLabel: "의도 분석 중",
      startedAt: "2026-03-03T00:00:00.000Z",
      completedAt: null,
      timeline: [],
      openGates: [],
    };

    // Assert
    expect(runDto.runId).toBe("run-001");
    expect(runDto.target).toBe("WINDOWS");
    expect(runDto.status).toBe("SPEC_ANALYSIS");
    expect(runDto.completedAt).toBeNull();
    expect(runDto.timeline).toHaveLength(0);
    expect(runDto.openGates).toHaveLength(0);
  });

  it("should accept all valid RunStatus values", () => {
    // Arrange — 모든 유효 RunStatus 값
    const statuses: RunStatus[] = [
      "IDLE",
      "SPEC_ANALYSIS",
      "POLICY_CHECK",
      "PLANNING",
      "GATE_L1",
      "CODE_GENERATION",
      "CODE_REVIEW",
      "GATE_L2",
      "TESTING",
      "DEPLOYMENT",
      "GATE_L3",
      "COMPLETED",
      "FAILED",
      "ROLLED_BACK",
    ];

    // Assert — 14개 상태 전부 정의됨
    expect(statuses).toHaveLength(14);
    expect(statuses).toContain("GATE_L1");
    expect(statuses).toContain("ROLLED_BACK");
  });

  it("should accept BROWSER_SANDBOX as target", () => {
    // Arrange & Act
    const runDto: RunDto = {
      runId: "run-002",
      sessionId: "sess-002",
      trustMode: "full-auto",
      target: "BROWSER_SANDBOX",
      status: "COMPLETED",
      riskLevel: "MEDIUM",
      riskScore: 40,
      riskTags: [],
      currentStepLabel: "완료",
      startedAt: "2026-03-03T00:00:00.000Z",
      completedAt: "2026-03-03T00:05:00.000Z",
      timeline: [],
      openGates: [],
    };

    // Assert
    expect(runDto.target).toBe("BROWSER_SANDBOX");
    expect(runDto.completedAt).toBe("2026-03-03T00:05:00.000Z");
  });
});

// ─────────────────────────────────────────────
// TimelineNodeDto 테스트
// ─────────────────────────────────────────────

describe("TimelineNodeDto", () => {
  it("should create a valid pending timeline node", () => {
    // Arrange & Act
    const node: TimelineNodeDto = {
      nodeId: "node-001",
      type: "SPEC",
      status: "PENDING",
      title: "의도 분석",
      summary: null,
      agentType: "spec-agent",
      startedAt: null,
      completedAt: null,
      durationMs: null,
      riskScore: null,
      riskLevel: null,
      riskTags: [],
      policyRefs: [],
      capabilityIds: [],
      evidenceIds: [],
      isUndoPoint: false,
      gateId: null,
    };

    // Assert
    expect(node.nodeId).toBe("node-001");
    expect(node.type).toBe("SPEC");
    expect(node.status).toBe("PENDING");
    expect(node.isUndoPoint).toBe(false);
    expect(node.gateId).toBeNull();
  });

  it("should create a completed timeline node with duration", () => {
    // Arrange & Act — 완료된 노드
    const node: TimelineNodeDto = {
      nodeId: "node-002",
      type: "CODEGEN",
      status: "DONE",
      title: "코드 생성",
      summary: "src/auth.ts 생성 완료",
      agentType: "codegen",
      startedAt: "2026-03-03T00:01:00.000Z",
      completedAt: "2026-03-03T00:02:30.000Z",
      durationMs: 90000,
      riskScore: 30,
      riskLevel: "LOW",
      riskTags: ["fs-write"],
      policyRefs: ["policy-001"],
      capabilityIds: ["cap-001"],
      evidenceIds: ["ev-001"],
      isUndoPoint: true,
      gateId: null,
    };

    // Assert
    expect(node.status).toBe("DONE");
    expect(node.durationMs).toBe(90000);
    expect(node.isUndoPoint).toBe(true);
    expect(node.riskTags).toContain("fs-write");
  });

  it("should accept all valid TimelineNodeType values", () => {
    // Arrange
    const types: TimelineNodeType[] = [
      "SPEC",
      "POLICY",
      "PLAN",
      "GATE",
      "CODEGEN",
      "REVIEW",
      "TEST",
      "DEPLOY",
      "ROLLBACK",
    ];

    // Assert — 9가지 노드 타입 정의됨
    expect(types).toHaveLength(9);
    expect(types).toContain("GATE");
  });

  it("should accept all valid TimelineNodeStatus values", () => {
    // Arrange
    const statuses: TimelineNodeStatus[] = [
      "PENDING",
      "RUNNING",
      "DONE",
      "WAITING_GATE",
      "DENIED",
      "FAILED",
      "SKIPPED",
    ];

    // Assert — 7가지 노드 상태 정의됨
    expect(statuses).toHaveLength(7);
    expect(statuses).toContain("WAITING_GATE");
  });
});

// ─────────────────────────────────────────────
// GateDto 테스트
// ─────────────────────────────────────────────

describe("GateDto", () => {
  it("should create a valid open GateDto", () => {
    // Arrange — 영향 요약 객체 생성
    const impact: ImpactSummaryDto = {
      filesModified: 2,
      filesCreated: 1,
      filesDeleted: 0,
      commandsRun: 3,
      networkAccess: false,
      privilegeEscalation: false,
      estimatedSizeBytes: 4096,
    };

    const scope: GateScopeDto = {
      paths: ["/project/src/**"],
      commands: ["tsc", "vitest"],
      domains: [],
      capabilities: ["fs.write", "exec.run"],
    };

    // Act
    const gate: GateDto = {
      gateId: "gate-001",
      gateType: "GATE_APPLY_CHANGES",
      gateLevel: "L2",
      status: "OPEN",
      title: "파일 변경 승인 요청",
      description: "3개 파일 수정 예정",
      whyNeeded: ["코드 생성 결과 적용", "fs.write Capability 필요"],
      riskLevel: "MEDIUM",
      riskScore: 45,
      riskTags: ["fs-write", "exec-run"],
      impact,
      scope,
      allowedActions: ["APPROVE_ONCE", "APPROVE_ALWAYS", "REJECT"],
      timeoutSeconds: 300,
      expiresAt: "2026-03-03T00:10:00.000Z",
      createdAt: "2026-03-03T00:05:00.000Z",
      resolution: null,
    };

    // Assert
    expect(gate.gateId).toBe("gate-001");
    expect(gate.gateType).toBe("GATE_APPLY_CHANGES");
    expect(gate.gateLevel).toBe("L2");
    expect(gate.status).toBe("OPEN");
    expect(gate.impact.filesModified).toBe(2);
    expect(gate.scope.capabilities).toContain("fs.write");
    expect(gate.resolution).toBeNull();
  });

  it("should create a resolved GateDto with approval", () => {
    // Arrange — 승인 완료된 게이트
    const resolution: GateResolutionDto = {
      action: "APPROVE_ONCE",
      decidedAt: "2026-03-03T00:06:00.000Z",
      decidedBy: "USER",
      scopeOverride: null,
      rejectReason: null,
    };

    const gate: GateDto = {
      gateId: "gate-002",
      gateType: "GATE_PLAN",
      gateLevel: "L1",
      status: "APPROVED",
      title: "계획 승인 요청",
      description: "실행 계획을 확인하세요",
      whyNeeded: ["계획 검토 필요"],
      riskLevel: "LOW",
      riskScore: 20,
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
      scope: {
        paths: [],
        commands: [],
        domains: [],
        capabilities: [],
      },
      allowedActions: ["APPROVE_ONCE", "REJECT"],
      timeoutSeconds: 600,
      expiresAt: "2026-03-03T00:15:00.000Z",
      createdAt: "2026-03-03T00:05:00.000Z",
      resolution,
    };

    // Assert
    expect(gate.status).toBe("APPROVED");
    expect(gate.resolution?.action).toBe("APPROVE_ONCE");
    expect(gate.resolution?.decidedBy).toBe("USER");
    expect(gate.resolution?.rejectReason).toBeNull();
  });

  it("should create a rejected GateDto with reason", () => {
    // Arrange
    const resolution: GateResolutionDto = {
      action: "REJECT",
      decidedAt: "2026-03-03T00:07:00.000Z",
      decidedBy: "USER",
      scopeOverride: null,
      rejectReason: "범위가 너무 넓습니다",
    };

    // Act
    const gate: GateDto = {
      gateId: "gate-003",
      gateType: "GATE_DEPLOY",
      gateLevel: "L3",
      status: "REJECTED",
      title: "배포 승인 요청",
      description: "프로덕션 배포",
      whyNeeded: ["배포 승인 필요"],
      riskLevel: "CRITICAL",
      riskScore: 90,
      riskTags: ["network", "production"],
      impact: {
        filesModified: 0,
        filesCreated: 0,
        filesDeleted: 0,
        commandsRun: 5,
        networkAccess: true,
        privilegeEscalation: true,
        estimatedSizeBytes: null,
      },
      scope: {
        paths: [],
        commands: ["deploy.sh"],
        domains: ["api.example.com"],
        capabilities: ["network.access"],
      },
      allowedActions: ["APPROVE_ONCE", "REJECT", "EDIT_SCOPE"],
      timeoutSeconds: 300,
      expiresAt: "2026-03-03T00:12:00.000Z",
      createdAt: "2026-03-03T00:07:00.000Z",
      resolution,
    };

    // Assert
    expect(gate.status).toBe("REJECTED");
    expect(gate.resolution?.rejectReason).toBe("범위가 너무 넓습니다");
    expect(gate.riskLevel).toBe("CRITICAL");
  });

  it("should accept all valid GateStatus values", () => {
    // Arrange
    const statuses: GateStatus[] = [
      "OPEN",
      "APPROVED",
      "REJECTED",
      "EXPIRED",
      "TIMED_OUT",
    ];

    // Assert
    expect(statuses).toHaveLength(5);
    expect(statuses).toContain("TIMED_OUT");
  });

  it("should accept all valid GateAction values", () => {
    // Arrange
    const actions: GateAction[] = [
      "APPROVE_ONCE",
      "APPROVE_ALWAYS",
      "REJECT",
      "EDIT_SCOPE",
    ];

    // Assert
    expect(actions).toHaveLength(4);
    expect(actions).toContain("APPROVE_ALWAYS");
  });
});

// ─────────────────────────────────────────────
// AuditEntryDto 테스트
// ─────────────────────────────────────────────

describe("AuditEntryDto", () => {
  it("should create a valid AuditEntryDto", () => {
    // Arrange & Act
    const entry: AuditEntryDto = {
      entryId: "audit-001",
      sequenceNumber: 1,
      timestamp: "2026-03-03T00:00:00.000Z",
      agentType: "policy-risk",
      agentId: "agent-policy-001",
      runId: "run-001",
      summary: "정책 판정 완료 — ALLOW",
      status: "COMPLETED",
      logLevel: "INFO",
      riskLevel: "LOW",
      isRedacted: false,
    };

    // Assert
    expect(entry.entryId).toBe("audit-001");
    expect(entry.sequenceNumber).toBe(1);
    expect(entry.agentType).toBe("policy-risk");
    expect(entry.status).toBe("COMPLETED");
    expect(entry.logLevel).toBe("INFO");
    expect(entry.isRedacted).toBe(false);
  });

  it("should allow redacted entry with null riskLevel", () => {
    // Arrange & Act — 마스킹된 감사 로그
    const entry: AuditEntryDto = {
      entryId: "audit-002",
      sequenceNumber: 2,
      timestamp: "2026-03-03T00:01:00.000Z",
      agentType: "executor",
      agentId: "agent-exec-001",
      runId: "run-001",
      summary: "[REDACTED]",
      status: "COMPLETED",
      logLevel: "WARN",
      riskLevel: null,
      isRedacted: true,
    };

    // Assert
    expect(entry.isRedacted).toBe(true);
    expect(entry.riskLevel).toBeNull();
    expect(entry.summary).toBe("[REDACTED]");
  });
});

// ─────────────────────────────────────────────
// AuditListDto / AuditQueryParams 테스트
// ─────────────────────────────────────────────

describe("AuditListDto", () => {
  it("should create a valid AuditListDto with entries", () => {
    // Arrange
    const entry: AuditEntryDto = {
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
    };

    // Act
    const listDto: AuditListDto = {
      entries: [entry],
      total: 100,
      hasMore: true,
    };

    // Assert
    expect(listDto.entries).toHaveLength(1);
    expect(listDto.total).toBe(100);
    expect(listDto.hasMore).toBe(true);
  });

  it("should create AuditQueryParams with optional fields", () => {
    // Arrange & Act — 부분 쿼리 파라미터
    const params: AuditQueryParams = {
      runId: "run-001",
      agentType: "executor",
      limit: 50,
      offset: 0,
    };

    // Assert — 선택 필드는 생략 가능
    expect(params.runId).toBe("run-001");
    expect(params.limit).toBe(50);
    expect(params.status).toBeUndefined();
    expect(params.from).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
// EvidenceDto 테스트
// ─────────────────────────────────────────────

describe("EvidenceDto", () => {
  it("should create a valid EvidenceDto", () => {
    // Arrange & Act
    const evidence: EvidenceDto = {
      evidenceId: "ev-001",
      type: "DIFF",
      label: "코드 변경 diff",
      mimeType: "text/plain",
      sizeBytes: 1024,
      hash: "sha256-abc123",
      createdAt: "2026-03-03T00:02:00.000Z",
      isRedacted: false,
      inlineContent: "--- a/src/auth.ts\n+++ b/src/auth.ts",
    };

    // Assert
    expect(evidence.evidenceId).toBe("ev-001");
    expect(evidence.type).toBe("DIFF");
    expect(evidence.mimeType).toBe("text/plain");
    expect(evidence.inlineContent).toContain("--- a/src/auth.ts");
  });

  it("should create EvidenceDto without optional inlineContent", () => {
    // Arrange & Act — 대용량 항목, inlineContent 없음
    const evidence: EvidenceDto = {
      evidenceId: "ev-002",
      type: "SCREENSHOT",
      label: "스크린샷",
      mimeType: "image/png",
      sizeBytes: 2097152,
      hash: "sha256-def456",
      createdAt: "2026-03-03T00:03:00.000Z",
      isRedacted: false,
    };

    // Assert
    expect(evidence.type).toBe("SCREENSHOT");
    expect(evidence.inlineContent).toBeUndefined();
  });

  it("should accept all valid EvidenceType values", () => {
    // Arrange
    const types: EvidenceType[] = [
      "SCREENSHOT",
      "TERMINAL_LOG",
      "DIFF",
      "SCAN_REPORT",
      "HASH",
      "POLICY_DECISION",
      "PLAN_JSON",
    ];

    // Assert — 7가지 증거 타입 정의됨
    expect(types).toHaveLength(7);
    expect(types).toContain("PLAN_JSON");
  });
});

// ─────────────────────────────────────────────
// ChatMessageDto 테스트
// ─────────────────────────────────────────────

describe("ChatMessageDto", () => {
  it("should create a user ChatMessageDto", () => {
    // Arrange & Act
    const message: ChatMessageDto = {
      messageId: "msg-001",
      role: "USER",
      content: "파일 정리해줘",
      timestamp: "2026-03-03T00:00:00.000Z",
      runId: null,
      contextBadge: "OBSERVE_ONLY",
      isVoice: false,
    };

    // Assert
    expect(message.role).toBe("USER");
    expect(message.content).toBe("파일 정리해줘");
    expect(message.runId).toBeNull();
    expect(message.isVoice).toBe(false);
  });

  it("should create a JARVIS ChatMessageDto with runId", () => {
    // Arrange & Act — 실행 중 JARVIS 메시지
    const message: ChatMessageDto = {
      messageId: "msg-002",
      role: "JARVIS",
      content: "파일 정리를 시작합니다",
      timestamp: "2026-03-03T00:00:01.000Z",
      runId: "run-001",
      contextBadge: "EXECUTING",
      isVoice: false,
    };

    // Assert
    expect(message.role).toBe("JARVIS");
    expect(message.runId).toBe("run-001");
    expect(message.contextBadge).toBe("EXECUTING");
  });
});

// ─────────────────────────────────────────────
// 요청 DTO 테스트
// ─────────────────────────────────────────────

describe("StartRunRequest", () => {
  it("should create a minimal StartRunRequest", () => {
    // Arrange & Act
    const req: StartRunRequest = {
      input: "바탕화면 파일 정리해줘",
      trustMode: "observe",
    };

    // Assert
    expect(req.input).toBe("바탕화면 파일 정리해줘");
    expect(req.trustMode).toBe("observe");
    expect(req.voiceTranscript).toBeUndefined();
  });
});

describe("GateApproveRequest / GateRejectRequest", () => {
  it("should create a GateApproveRequest with APPROVE_ONCE action", () => {
    // Arrange & Act
    const req: GateApproveRequest = {
      action: "APPROVE_ONCE",
    };

    // Assert
    expect(req.action).toBe("APPROVE_ONCE");
    expect(req.scopeOverride).toBeUndefined();
  });

  it("should create a GateApproveRequest with scope override", () => {
    // Arrange & Act — 범위 수정 포함 승인
    const req: GateApproveRequest = {
      action: "EDIT_SCOPE",
      scopeOverride: {
        paths: ["/project/src/auth/**"],
      },
    };

    // Assert
    expect(req.action).toBe("EDIT_SCOPE");
    expect(req.scopeOverride?.paths).toContain("/project/src/auth/**");
  });

  it("should create a GateRejectRequest with reason", () => {
    // Arrange & Act
    const req: GateRejectRequest = {
      reason: "작업 범위가 승인 기준을 초과합니다",
    };

    // Assert
    expect(req.reason).toBe("작업 범위가 승인 기준을 초과합니다");
  });
});

describe("EmergencyStopRequest / EmergencyStopDto", () => {
  it("should create a valid EmergencyStopRequest", () => {
    // Arrange & Act
    const req: EmergencyStopRequest = {
      runId: "run-001",
      reason: "예상치 못한 파일 삭제 감지",
    };

    // Assert
    expect(req.runId).toBe("run-001");
    expect(req.reason).toBe("예상치 못한 파일 삭제 감지");
  });

  it("should create a valid EmergencyStopDto", () => {
    // Arrange & Act
    const dto: EmergencyStopDto = {
      stopped: true,
      runId: "run-001",
      stoppedAt: "2026-03-03T00:05:00.000Z",
      rollbackPointId: "checkpoint-003",
    };

    // Assert
    expect(dto.stopped).toBe(true);
    expect(dto.stoppedAt).toBe("2026-03-03T00:05:00.000Z");
    expect(dto.rollbackPointId).toBe("checkpoint-003");
  });

  it("should allow null rollbackPointId when no checkpoint exists", () => {
    // Arrange & Act
    const dto: EmergencyStopDto = {
      stopped: true,
      runId: "run-002",
      stoppedAt: "2026-03-03T00:06:00.000Z",
      rollbackPointId: null,
    };

    // Assert
    expect(dto.rollbackPointId).toBeNull();
  });
});

// ─────────────────────────────────────────────
// SSE 이벤트 타입 테스트
// ─────────────────────────────────────────────

describe("SseEvent", () => {
  it("should create a valid SseEvent wrapper", () => {
    // Arrange
    const payload: SseRunCreatedPayload = {
      runId: "run-001",
      trustMode: "observe",
    };

    // Act
    const event: SseEvent<SseRunCreatedPayload> = {
      type: "RUN_CREATED",
      payload,
      timestamp: "2026-03-03T00:00:00.000Z",
      sequenceId: 1,
    };

    // Assert
    expect(event.type).toBe("RUN_CREATED");
    expect(event.payload.runId).toBe("run-001");
    expect(event.sequenceId).toBe(1);
  });

  it("should create a SseEvent with GATE_OPENED type", () => {
    // Arrange — 게이트 열림 이벤트
    const gatePayload: SseGateOpenedPayload = {
      runId: "run-001",
      gate: {
        gateId: "gate-001",
        gateType: "GATE_APPLY_CHANGES",
        gateLevel: "L2",
        status: "OPEN",
        title: "파일 변경 승인 요청",
        description: "파일 3개 수정",
        whyNeeded: ["fs.write 필요"],
        riskLevel: "MEDIUM",
        riskScore: 50,
        riskTags: ["fs-write"],
        impact: {
          filesModified: 3,
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
      },
    };

    // Act
    const event: SseEvent<SseGateOpenedPayload> = {
      type: "GATE_OPENED",
      payload: gatePayload,
      timestamp: "2026-03-03T00:05:00.000Z",
      sequenceId: 10,
    };

    // Assert
    expect(event.type).toBe("GATE_OPENED");
    expect(event.payload.gate.gateType).toBe("GATE_APPLY_CHANGES");
  });

  it("should accept all valid SseEventType values", () => {
    // Arrange
    const types: SseEventType[] = [
      "RUN_CREATED",
      "RUN_STATUS_CHANGED",
      "NODE_UPDATED",
      "GATE_OPENED",
      "GATE_RESOLVED",
      "EVIDENCE_ADDED",
      "RISK_UPDATED",
      "TTL_UPDATED",
      "AGENT_STATUS_CHANGED",
      "AUDIT_ENTRY_ADDED",
      "EMERGENCY_STOPPED",
      "EXECUTOR_DISCONNECTED",
      "CHAT_MESSAGE_ADDED",
      "SYSTEM_ERROR",
    ];

    // Assert — 14가지 SSE 이벤트 타입 정의됨
    expect(types).toHaveLength(14);
    expect(types).toContain("EMERGENCY_STOPPED");
  });
});

// ─────────────────────────────────────────────
// PolicyDecisionSummaryDto 테스트
// ─────────────────────────────────────────────

describe("PolicyDecisionSummaryDto", () => {
  it("should create a valid PolicyDecisionSummaryDto", () => {
    // Arrange & Act
    const dto: PolicyDecisionSummaryDto = {
      decisionId: "pd-001",
      status: "ALLOW",
      riskLevel: "LOW",
      riskScore: 20,
      reasoning: "모든 정책 조건 만족, 위험 낮음",
      policyIds: ["policy-default-001", "policy-fs-002"],
    };

    // Assert
    expect(dto.decisionId).toBe("pd-001");
    expect(dto.status).toBe("ALLOW");
    expect(dto.policyIds).toHaveLength(2);
  });

  it("should create a CapabilityUsedDto with consumed status", () => {
    // Arrange & Act
    const cap: CapabilityUsedDto = {
      tokenId: "cap-token-001",
      scope: "fs.write:/project/src/**",
      issuedAt: "2026-03-03T00:01:00.000Z",
      consumedAt: "2026-03-03T00:01:30.000Z",
      status: "CONSUMED",
    };

    // Assert
    expect(cap.tokenId).toBe("cap-token-001");
    expect(cap.status).toBe("CONSUMED");
    expect(cap.consumedAt).toBe("2026-03-03T00:01:30.000Z");
  });
});

// ─────────────────────────────────────────────
// TimelineNodeDetailDto 테스트 (extends TimelineNodeDto)
// ─────────────────────────────────────────────

describe("TimelineNodeDetailDto", () => {
  it("should create a valid TimelineNodeDetailDto with all extended fields", () => {
    // Arrange & Act
    const detail: TimelineNodeDetailDto = {
      // TimelineNodeDto 기본 필드
      nodeId: "node-001",
      type: "CODEGEN",
      status: "DONE",
      title: "코드 생성",
      summary: "3개 파일 생성",
      agentType: "codegen",
      startedAt: "2026-03-03T00:01:00.000Z",
      completedAt: "2026-03-03T00:02:00.000Z",
      durationMs: 60000,
      riskScore: 25,
      riskLevel: "LOW",
      riskTags: ["fs-write"],
      policyRefs: ["policy-001"],
      capabilityIds: ["cap-001"],
      evidenceIds: ["ev-001"],
      isUndoPoint: true,
      gateId: null,
      // TimelineNodeDetailDto 확장 필드
      whyReason: "인증 모듈 구현을 위해 코드 생성이 필요합니다",
      expectedImpact: {
        filesModified: 0,
        filesCreated: 3,
        filesDeleted: 0,
        commandsRun: 0,
        networkAccess: false,
        privilegeEscalation: false,
        estimatedSizeBytes: 8192,
      },
      capabilities: [
        {
          tokenId: "cap-001",
          scope: "fs.write:/project/src/**",
          issuedAt: "2026-03-03T00:01:00.000Z",
          consumedAt: "2026-03-03T00:01:30.000Z",
          status: "CONSUMED",
        },
      ],
      policyDecision: {
        decisionId: "pd-001",
        status: "ALLOW",
        riskLevel: "LOW",
        riskScore: 25,
        reasoning: "안전한 코드 생성 작업",
        policyIds: ["policy-001"],
      },
    };

    // Assert
    expect(detail.whyReason).toContain("인증 모듈");
    expect(detail.expectedImpact.filesCreated).toBe(3);
    expect(detail.capabilities).toHaveLength(1);
    expect(detail.policyDecision?.status).toBe("ALLOW");
  });
});
