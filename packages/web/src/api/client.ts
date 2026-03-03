// 대시보드 API 클라이언트 — 백엔드와의 HTTP/SSE 통신 담당
import type {
  ApiResponse,
  SystemStatusDto,
  RunDto,
  StartRunRequest,
  TimelineNodeDetailDto,
  GateApproveRequest,
  GateRejectRequest,
  GateDto,
  AuditListDto,
  AuditQueryParams,
  EvidenceDto,
  EvidenceContentUrlDto,
  PolicyListDto,
  ChatMessageDto,
  SendMessageRequest,
  EmergencyStopRequest,
  EmergencyStopDto,
  SseEvent,
} from "./schema.js";

// API 클라이언트 설정
export interface ApiClientConfig {
  readonly baseUrl: string;
  readonly sessionId: string;
  readonly onUnauthorized?: () => void;
}

// 전체 API 클라이언트 인터페이스
export interface JarvisApiClient {
  // 시스템
  readonly system: SystemApi;
  // 실행
  readonly runs: RunApi;
  // 타임라인
  readonly timeline: TimelineApi;
  // 게이트
  readonly gates: GateApi;
  // 감사 로그
  readonly audit: AuditApi;
  // 증거
  readonly evidence: EvidenceApi;
  // 정책
  readonly policies: PolicyApi;
  // 채팅
  readonly chat: ChatApi;
  // 비상 정지
  readonly emergencyStop: (req: EmergencyStopRequest) => Promise<ApiResponse<EmergencyStopDto>>;
  // SSE 이벤트 구독
  readonly subscribe: (onEvent: (event: SseEvent) => void) => () => void;
}

// 시스템 API
export interface SystemApi {
  getStatus(): Promise<ApiResponse<SystemStatusDto>>;
}

// 실행 API
export interface RunApi {
  start(req: StartRunRequest): Promise<ApiResponse<RunDto>>;
  get(runId: string): Promise<ApiResponse<RunDto>>;
  list(): Promise<ApiResponse<readonly RunDto[]>>;
}

// 타임라인 API
export interface TimelineApi {
  getNodeDetail(runId: string, nodeId: string): Promise<ApiResponse<TimelineNodeDetailDto>>;
}

// 게이트 API
export interface GateApi {
  get(gateId: string): Promise<ApiResponse<GateDto>>;
  approve(gateId: string, req: GateApproveRequest): Promise<ApiResponse<GateDto>>;
  reject(gateId: string, req: GateRejectRequest): Promise<ApiResponse<GateDto>>;
}

// 감사 로그 API
export interface AuditApi {
  list(params?: AuditQueryParams): Promise<ApiResponse<AuditListDto>>;
}

// 증거 API
export interface EvidenceApi {
  get(evidenceId: string): Promise<ApiResponse<EvidenceDto>>;
  getContentUrl(evidenceId: string): Promise<ApiResponse<EvidenceContentUrlDto>>;
}

// 정책 API
export interface PolicyApi {
  list(): Promise<ApiResponse<PolicyListDto>>;
}

// 채팅 API
export interface ChatApi {
  getHistory(runId?: string): Promise<ApiResponse<readonly ChatMessageDto[]>>;
  send(req: SendMessageRequest): Promise<ApiResponse<ChatMessageDto>>;
}

// ─────────────────────────────────────────────
// 구현체 (fetch 기반)
// ─────────────────────────────────────────────

// fetch 헬퍼 — 공통 헤더 + 에러 처리
async function apiFetch<T>(
  baseUrl: string,
  sessionId: string,
  path: string,
  options?: RequestInit,
): Promise<ApiResponse<T>> {
  const url = `${baseUrl}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-Session-Id": sessionId,
      ...(options?.headers ?? {}),
    },
  });

  const json = (await response.json()) as ApiResponse<T>;
  return json;
}

// API 클라이언트 생성
export function createApiClient(config: ApiClientConfig): JarvisApiClient {
  const { baseUrl, sessionId } = config;
  const fetch_ = <T>(path: string, options?: RequestInit) =>
    apiFetch<T>(baseUrl, sessionId, path, options);

  return {
    system: {
      getStatus: () => fetch_<SystemStatusDto>("/api/system/status"),
    },

    runs: {
      start: (req) =>
        fetch_<RunDto>("/api/runs", {
          method: "POST",
          body: JSON.stringify(req),
        }),
      get: (runId) => fetch_<RunDto>(`/api/runs/${runId}`),
      list: () => fetch_<readonly RunDto[]>("/api/runs"),
    },

    timeline: {
      getNodeDetail: (runId, nodeId) =>
        fetch_<TimelineNodeDetailDto>(`/api/runs/${runId}/timeline/${nodeId}`),
    },

    gates: {
      get: (gateId) => fetch_<GateDto>(`/api/gates/${gateId}`),
      approve: (gateId, req) =>
        fetch_<GateDto>(`/api/gates/${gateId}/approve`, {
          method: "POST",
          body: JSON.stringify(req),
        }),
      reject: (gateId, req) =>
        fetch_<GateDto>(`/api/gates/${gateId}/reject`, {
          method: "POST",
          body: JSON.stringify(req),
        }),
    },

    audit: {
      list: (params) => {
        const query = params
          ? "?" + new URLSearchParams(params as Record<string, string>).toString()
          : "";
        return fetch_<AuditListDto>(`/api/audit${query}`);
      },
    },

    evidence: {
      get: (evidenceId) => fetch_<EvidenceDto>(`/api/evidence/${evidenceId}`),
      getContentUrl: (evidenceId) =>
        fetch_<EvidenceContentUrlDto>(`/api/evidence/${evidenceId}/content`),
    },

    policies: {
      list: () => fetch_<PolicyListDto>("/api/policies"),
    },

    chat: {
      getHistory: (runId) => {
        const query = runId ? `?runId=${runId}` : "";
        return fetch_<readonly ChatMessageDto[]>(`/api/chat${query}`);
      },
      send: (req) =>
        fetch_<ChatMessageDto>("/api/chat", {
          method: "POST",
          body: JSON.stringify(req),
        }),
    },

    emergencyStop: (req) =>
      fetch_<EmergencyStopDto>("/api/emergency-stop", {
        method: "POST",
        body: JSON.stringify(req),
      }),

    // SSE 이벤트 구독 — 연결 해제 함수 반환
    subscribe: (onEvent) => {
      const es = new EventSource(`${baseUrl}/api/events?sessionId=${sessionId}`);

      es.onmessage = (e) => {
        const event = JSON.parse(e.data as string) as SseEvent;
        onEvent(event);
      };

      // 연결 해제 함수
      return () => {
        es.close();
      };
    },
  };
}
