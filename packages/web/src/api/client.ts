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
  ChatMessageDto,
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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getContentUrl(evidenceId: string): Promise<ApiResponse<any>>;
}

// 정책 API
export interface PolicyApi {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  list(): Promise<ApiResponse<any>>;
}

// 채팅 API
export interface ChatApi {
  getHistory(runId?: string): Promise<ApiResponse<readonly ChatMessageDto[]>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  send(req: any): Promise<ApiResponse<ChatMessageDto>>;
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

  // HTTP 상태 코드 확인
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText} at ${path}`);
  }

  const json = (await response.json()) as ApiResponse<T>;
  return json;
}

// API 클라이언트 생성
export function createApiClient(config: ApiClientConfig): JarvisApiClient {
  const { baseUrl, sessionId } = config;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const fetch_ = <T>(path: string, options?: RequestInit): any =>
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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        fetch_<any>(`/api/evidence/${evidenceId}/content`),
    },

    policies: {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      list: () => fetch_<any>("/api/policies"),
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
