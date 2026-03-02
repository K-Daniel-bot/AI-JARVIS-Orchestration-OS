/**
 * JARVIS OS 공유 타입 정의
 * 5개 JSON 스키마(policy-decision, capability-token, action-api, audit-log, state-machine)를
 * 기반으로 한 핵심 인터페이스를 정의한다.
 * UserRole, RiskLevel, PolicyStatus, AuditResultStatus는 types/audit.ts에서 정의되므로
 * 이 파일에서는 해당 타입들을 import하여 사용하며 재export하지 않는다.
 * (index.ts에서 types/audit.ts로부터 직접 export함)
 */

// audit.ts에서 정의된 공통 타입 import (이 파일 내부에서만 사용)
import type {
  UserRole,
  RiskLevel,
  PolicyStatus,
} from './types/audit.js';

// ─────────────────────────────────────────
// 기본 열거 타입 (Primitive Union Types)
// ─────────────────────────────────────────

/** 신뢰 모드 — 에이전트 자율 실행 수준 */
export type TrustMode = 'observe' | 'suggest' | 'semi-auto' | 'full-auto';

/** 토큰 상태 — Capability Token의 생명주기 상태 */
export type TokenStatus = 'ACTIVE' | 'CONSUMED' | 'EXPIRED' | 'REVOKED';

/**
 * 액션 타입 — Executor가 수행할 수 있는 38가지 OS/앱/모바일 액션 유형
 * 파일시스템, 프로세스, 앱/윈도우, 웹/브라우저, 모바일 카테고리로 구성된다.
 */
export type ActionType =
  // 파일시스템 액션
  | 'FS_READ'
  | 'FS_WRITE'
  | 'FS_LIST'
  | 'FS_MOVE'
  | 'FS_DELETE'
  // 프로세스/명령 액션
  | 'EXEC_RUN'
  | 'PROCESS_KILL'
  // 앱/윈도우 액션
  | 'APP_LAUNCH'
  | 'APP_FOCUS'
  | 'WINDOW_CLICK'
  | 'WINDOW_TYPE'
  | 'WINDOW_SHORTCUT'
  // 웹/브라우저 액션
  | 'BROWSER_OPEN_URL'
  | 'BROWSER_CLICK'
  | 'BROWSER_TYPE'
  | 'BROWSER_DOWNLOAD'
  | 'BROWSER_UPLOAD'
  | 'BROWSER_LOGIN_REQUEST'
  | 'BROWSER_FETCH'
  // 모바일/연락처 액션
  | 'MOBILE_CONTACT_SEARCH'
  | 'MOBILE_CONTACT_READ'
  // 모바일/전화 액션
  | 'MOBILE_CALL_DIAL'
  | 'MOBILE_CALL_END'
  | 'MOBILE_CALL_STATUS'
  // 모바일/문자 액션
  | 'MOBILE_SMS_SEND'
  | 'MOBILE_SMS_READ'
  // 모바일/메신저 액션
  | 'MOBILE_MESSENGER_SEND'
  | 'MOBILE_MESSENGER_READ'
  // 모바일/앱제어 액션
  | 'MOBILE_APP_LAUNCH'
  | 'MOBILE_APP_FOCUS'
  | 'MOBILE_APP_ACTION'
  // 모바일/알림 액션
  | 'MOBILE_NOTIFICATION_READ'
  | 'MOBILE_NOTIFICATION_DISMISS'
  // 모바일/시스템 액션
  | 'MOBILE_DEVICE_STATUS'
  | 'MOBILE_CLIPBOARD_SYNC';

/** 에이전트 이름 — 9개 에이전트 식별자 */
export type AgentName =
  | 'orchestrator'
  | 'spec-agent'
  | 'policy-risk'
  | 'planner'
  | 'codegen'
  | 'review'
  | 'test-build'
  | 'executor'
  | 'rollback';

/** 에이전트 메시지 유형 — 에이전트 간 통신 메시지 종류 */
export type MessageType =
  | 'HANDOFF'
  | 'REQUEST'
  | 'RESPONSE'
  | 'ERROR'
  | 'HEARTBEAT';

/** 아티팩트 유형 — 에이전트가 생성하는 산출물 종류 */
export type ArtifactType =
  | 'SPEC'
  | 'POLICY_DECISION'
  | 'PLAN'
  | 'CHANGESET'
  | 'REVIEW'
  | 'TEST_REPORT'
  | 'EXECUTION_TRACE'
  | 'ROLLBACK_LOG';

/** 에이전트 건강 상태 — 에이전트 실행 상태 모니터링 */
export type AgentHealthStatus =
  | 'HEALTHY'
  | 'DEGRADED'
  | 'UNRESPONSIVE'
  | 'CRASHED';

/** 실행 런 상태 — ExecutionTrace의 전체 실행 결과 */
export type RunStatus =
  | 'SUCCESS'
  | 'PARTIAL_SUCCESS'
  | 'FAILED'
  | 'ABORTED';

/** 로그 수준 — 감사 로그 기록 상세도 */
export type LogLevel = 'FULL' | 'SUMMARY';

// ─────────────────────────────────────────
// PolicyDecision 관련 인터페이스
// ─────────────────────────────────────────

/** 정책 판정 주체 — 요청을 보낸 사용자/세션 정보 */
export interface PolicySubject {
  readonly user_id: string;
  readonly role: UserRole;
  readonly device: string;
  readonly session_id: string;
}

/** 정책 판정 요청 — 사용자의 원본 요청 내용 */
export interface PolicyRequest {
  readonly raw_input: string;
  readonly intent: string;
  readonly targets: readonly string[];
  readonly requires_web_access: boolean;
  readonly requires_login: boolean;
}

/** 정책 제약 조건 — 판정 결과로 부과되는 접근 제한 */
export interface PolicyConstraints {
  readonly fs: {
    readonly read_allow: readonly string[];
    readonly write_allow: readonly string[];
    readonly write_deny: readonly string[];
  };
  readonly exec: {
    readonly allow: readonly string[];
    readonly deny: readonly string[];
  };
  readonly network: {
    readonly allow_domains: readonly string[];
    readonly deny_domains: readonly string[];
    readonly default_policy: string;
  };
}

/** 정책 판정 결과 — 허용/거부 여부와 위험도 평가 */
export interface PolicyOutcome {
  readonly status: PolicyStatus;
  /** 위험 점수: 0~100 범위 */
  readonly risk_score: number;
  readonly risk_level: RiskLevel;
  readonly requires_gates: readonly string[];
  readonly reason_codes: readonly string[];
  /** 사용자에게 보여줄 판정 이유 */
  readonly human_explanation: string;
}

/** Capability 부여 정보 — 토큰에 포함될 권한 범위 */
export interface CapabilityGrant {
  readonly cap: string;
  readonly scope: string | readonly string[];
  readonly ttl_seconds: number;
  readonly max_uses: number;
}

/**
 * PolicyDecision — 정책 판정 전체 결과.
 * policy-risk 에이전트가 생성하며 이후 모든 에이전트가 참조한다.
 */
export interface PolicyDecision {
  /** 판정 식별자 패턴: pd_{date}_{seq} */
  readonly decision_id: string;
  readonly timestamp: string;
  readonly subject: PolicySubject;
  readonly request: PolicyRequest;
  readonly outcome: PolicyOutcome;
  readonly constraints: PolicyConstraints;
  readonly required_capabilities: readonly CapabilityGrant[];
  readonly audit: {
    readonly log_level: LogLevel;
    readonly redactions: readonly string[];
  };
}

// ─────────────────────────────────────────
// CapabilityToken 관련 인터페이스
// ─────────────────────────────────────────

/** Capability 컨텍스트 — 토큰이 발급된 세션/런 정보 */
export interface CapabilityContext {
  readonly session_id: string;
  readonly run_id: string;
  readonly policy_decision_id: string;
  readonly trust_mode: TrustMode;
}

/**
 * CapabilityToken — 일회성 권한 토큰.
 * 발급 후 단 1회만 사용 가능하며, 사용 즉시 CONSUMED 상태로 전환된다.
 */
export interface CapabilityToken {
  /** 토큰 식별자 패턴: cap_{date}_{seq} */
  readonly token_id: string;
  readonly issued_at: string;
  readonly issued_by: string;
  readonly approved_by: string;
  readonly grant: CapabilityGrant;
  readonly context: CapabilityContext;
  readonly status: TokenStatus;
  /** 토큰 소비 시각 (소비 후 설정) */
  readonly consumed_at?: string;
  /** 토큰을 소비한 액션 ID (소비 후 설정) */
  readonly consumed_by_action?: string;
  /** 토큰 폐기 이유 (폐기 시 설정) */
  readonly revoked_reason?: string;
}

// ─────────────────────────────────────────
// Action / ExecutionTrace 관련 인터페이스
// ─────────────────────────────────────────

/** 액션 실행 증거 수집 설정 */
export interface ActionEvidence {
  readonly capture_screenshot: boolean;
  readonly capture_stdout: boolean;
}

/**
 * Action — Executor가 수행하는 단일 OS 조작 단위.
 * 반드시 유효한 Capability Token이 있어야 실행된다.
 */
export interface Action {
  /** 액션 식별자 패턴: act_{seq} */
  readonly action_id: string;
  readonly type: ActionType;
  /** 액션 유형별 파라미터 (app, path, url, command 등) */
  readonly params: Record<string, unknown>;
  readonly requires_capabilities: readonly string[];
  readonly risk_tags: readonly string[];
  readonly preconditions: readonly string[];
  readonly postconditions: readonly string[];
  readonly evidence: ActionEvidence;
}

/** 단일 액션 실행 단계 결과 */
export interface ExecutionStep {
  readonly action_id: string;
  readonly status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'DENIED';
  readonly started_at: string;
  readonly ended_at: string;
  readonly evidence: {
    readonly screenshot_ref?: string;
    readonly stdout_ref?: string;
  };
  readonly error?: string;
}

/**
 * ExecutionTrace — 전체 실행 런의 추적 기록.
 * 모든 액션 단계와 결과를 포함하며 감사 로그에 연결된다.
 */
export interface ExecutionTrace {
  /** 런 식별자 패턴: run_{date}_{seq} */
  readonly run_id: string;
  readonly status: RunStatus;
  readonly steps: readonly ExecutionStep[];
  readonly redactions_applied: readonly string[];
}

// ─────────────────────────────────────────
// AgentMessage 관련 인터페이스
// ─────────────────────────────────────────

/** 에이전트 메시지 페이로드 — 산출물 참조와 메타데이터 */
export interface AgentMessagePayload {
  readonly artifact_type: ArtifactType;
  /** 산출물 경로 또는 ID 참조 */
  readonly artifact_ref: string;
  readonly summary: string;
  readonly metadata: Record<string, unknown>;
}

/** 재시도 정책 — 에이전트 통신 실패 시 재시도 설정 */
export interface RetryPolicy {
  readonly max_retries: number;
  readonly backoff_ms: number;
}

/**
 * AgentMessage — 에이전트 간 구조화된 통신 메시지.
 * 모든 에이전트 간 데이터 교환은 이 형식을 따른다.
 */
export interface AgentMessage {
  /** 메시지 식별자 패턴: msg_{date}_{seq} */
  readonly message_id: string;
  readonly from_agent: AgentName;
  readonly to_agent: AgentName;
  readonly message_type: MessageType;
  readonly timestamp: string;
  readonly run_id: string;
  readonly payload: AgentMessagePayload;
  readonly timeout_ms: number;
  readonly retry_policy: RetryPolicy;
}
