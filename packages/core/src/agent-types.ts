// 에이전트 타입 정의 — 9개 에이전트의 설정, 모델, 역할, 복잡도를 정의한다
// @jarvis/shared의 AgentName, TrustMode 타입과 연동됨

import type { AgentName } from '@jarvis/shared';

// ────────────────────────────────────────────────────────────
// Claude 모델 타입
// ────────────────────────────────────────────────────────────

/** Claude 모델 식별자 — 에이전트별 모델 배정에 사용 */
export type ClaudeModel =
  | 'claude-opus-4-6'
  | 'claude-sonnet-4-6'
  | 'claude-haiku-4-5-20251001';

// ────────────────────────────────────────────────────────────
// 복잡도 레벨 — Orchestrator가 에이전트 팀 구성 기준으로 사용
// ────────────────────────────────────────────────────────────

/** 작업 복잡도 레벨 — 에이전트 팀 호출 기준 분류 */
export enum ComplexityLevel {
  /** 파일 1개, LOW risk → 단일 에이전트로 처리 가능 */
  L1_SIMPLE = 'L1_SIMPLE',
  /** 파일 2~5개, 패키지 설치 없음 → Codegen + Review 팀 */
  L2_MODERATE = 'L2_MODERATE',
  /** 파일 5개 초과, 네트워크 필요 → 전체 에이전트 팀 */
  L3_COMPLEX = 'L3_COMPLEX',
  /** 외부 서비스 연동, 권한 상승 필요 → 전체 팀 + 추가 Gate */
  L4_DANGEROUS = 'L4_DANGEROUS',
}

// ────────────────────────────────────────────────────────────
// 에이전트 권한 모드 — 에이전트별 도구 접근 수준
// ────────────────────────────────────────────────────────────

/** 에이전트 권한 모드 — 도구 접근 수준을 제한한다 */
export type PermissionMode = 'read-only' | 'write' | 'execute';

// ────────────────────────────────────────────────────────────
// 에이전트 설정 인터페이스
// ────────────────────────────────────────────────────────────

/** 에이전트 설정 — 각 에이전트의 모델, 역할, 도구, 권한 정의 */
export interface AgentConfig {
  /** 에이전트 이름 (9개 중 하나) */
  readonly name: AgentName;
  /** 사용할 Claude 모델 */
  readonly model: ClaudeModel;
  /** 에이전트의 역할 설명 */
  readonly role: string;
  /** 에이전트가 사용할 수 있는 도구 목록 */
  readonly tools: readonly string[];
  /** 에이전트 권한 모드 — 도구 접근 수준 */
  readonly permissionMode: PermissionMode;
  /** 최대 턴 수 — 무한 루프 방지 */
  readonly maxTurns: number;
}

// ────────────────────────────────────────────────────────────
// 모델 배정 매핑 — 9개 에이전트별 Claude 모델 할당
// ────────────────────────────────────────────────────────────

/**
 * 에이전트별 Claude 모델 배정 맵
 * - Opus: 고복잡도 판단이 필요한 오케스트레이터, 정책 에이전트
 * - Sonnet: 코드 생성, 검토, 실행 에이전트
 * - Haiku: 빠른 분석, 테스트, 롤백 에이전트
 */
export const MODEL_ASSIGNMENT: Record<AgentName, ClaudeModel> = {
  orchestrator: 'claude-opus-4-6',
  'spec-agent': 'claude-haiku-4-5-20251001',
  'policy-risk': 'claude-opus-4-6',
  planner: 'claude-sonnet-4-6',
  codegen: 'claude-sonnet-4-6',
  review: 'claude-sonnet-4-6',
  'test-build': 'claude-haiku-4-5-20251001',
  executor: 'claude-sonnet-4-6',
  rollback: 'claude-haiku-4-5-20251001',
};

// ────────────────────────────────────────────────────────────
// 에이전트 전체 설정 배열 — AGENT_CONFIGS
// ────────────────────────────────────────────────────────────

/**
 * 9개 에이전트 전체 설정 배열
 * 각 에이전트의 모델, 역할, 도구, 권한 모드, 최대 턴 수를 정의한다
 */
export const AGENT_CONFIGS: readonly AgentConfig[] = [
  {
    name: 'orchestrator',
    model: 'claude-opus-4-6',
    role: '전체 흐름 제어 — 복잡도 분류, 에이전트 팀 구성, 상태 머신 전이 결정',
    tools: [
      'read_state_machine',
      'send_agent_message',
      'update_context',
      'emit_event',
      'read_audit_log',
    ],
    permissionMode: 'read-only',
    maxTurns: 20,
  },
  {
    name: 'spec-agent',
    model: 'claude-haiku-4-5-20251001',
    role: '사용자 의도 분석 — 요구사항 명세(SPEC.md) 생성, 모호성 탐지',
    tools: [
      'read_context',
      'write_spec',
      'request_clarification',
    ],
    permissionMode: 'read-only',
    maxTurns: 10,
  },
  {
    name: 'policy-risk',
    model: 'claude-opus-4-6',
    role: '정책 판정, 위험도 계산, Capability Token 발급 결정',
    tools: [
      'read_policy',
      'read_spec',
      'evaluate_risk',
      'issue_capability_token',
      'write_policy_decision',
    ],
    permissionMode: 'read-only',
    maxTurns: 10,
  },
  {
    name: 'planner',
    model: 'claude-sonnet-4-6',
    role: '작업 분해(WBS), Task DAG 생성, 실행 계획(PLAN.json) 작성',
    tools: [
      'read_spec',
      'read_policy_decision',
      'write_plan',
      'read_context',
    ],
    permissionMode: 'read-only',
    maxTurns: 15,
  },
  {
    name: 'codegen',
    model: 'claude-sonnet-4-6',
    role: '코드 생성/수정 — ChangeSet 생성, patch 단위 변경안 작성',
    tools: [
      'read_plan',
      'read_file',
      'write_file',
      'read_spec',
      'read_policy_decision',
    ],
    permissionMode: 'write',
    maxTurns: 30,
  },
  {
    name: 'review',
    model: 'claude-sonnet-4-6',
    role: '보안 검토, 정적 분석, 코드 품질 검사 — ChangeSet 최종 승인/거부',
    tools: [
      'read_changeset',
      'read_spec',
      'read_policy_decision',
      'write_review_result',
    ],
    permissionMode: 'read-only',
    maxTurns: 15,
  },
  {
    name: 'test-build',
    model: 'claude-haiku-4-5-20251001',
    role: '테스트 실행, 빌드 검증 — 결과 리포트 생성',
    tools: [
      'run_tests',
      'run_build',
      'read_test_results',
      'write_test_report',
    ],
    permissionMode: 'execute',
    maxTurns: 20,
  },
  {
    name: 'executor',
    model: 'claude-sonnet-4-6',
    role: 'OS 조작 유일 주체 — Action API 실행, Capability Token 소비, Enforcement Hook 준수',
    tools: [
      'fs_read',
      'fs_write',
      'fs_list',
      'fs_move',
      'fs_delete',
      'exec_run',
      'process_kill',
      'app_launch',
      'app_focus',
      'window_click',
      'window_type',
      'window_shortcut',
      'browser_open_url',
      'browser_click',
      'browser_type',
      'browser_download',
      'browser_upload',
      'browser_login_request',
      'mobile_contact_search',
      'mobile_contact_read',
      'mobile_call_dial',
      'mobile_call_end',
      'mobile_call_status',
      'mobile_sms_send',
      'mobile_sms_read',
      'mobile_messenger_send',
      'mobile_messenger_read',
      'mobile_app_launch',
      'mobile_app_focus',
      'mobile_app_action',
      'mobile_notification_read',
      'mobile_notification_dismiss',
      'mobile_device_status',
      'mobile_clipboard_sync',
      'consume_capability_token',
      'write_audit_log',
    ],
    permissionMode: 'execute',
    maxTurns: 25,
  },
  {
    name: 'rollback',
    model: 'claude-haiku-4-5-20251001',
    role: '롤백 실행, Postmortem 작성 — 에러 복구, Capability 전체 무효화',
    tools: [
      'read_checkpoint',
      'restore_checkpoint',
      'revoke_all_capabilities',
      'write_postmortem',
      'write_audit_log',
    ],
    permissionMode: 'execute',
    maxTurns: 15,
  },
] as const;

// ────────────────────────────────────────────────────────────
// 복잡도 레벨별 에이전트 팀 구성 매핑
// ────────────────────────────────────────────────────────────

/** 복잡도 레벨별 필요 에이전트 팀 구성 */
export const COMPLEXITY_AGENT_TEAMS: Record<ComplexityLevel, readonly AgentName[]> = {
  [ComplexityLevel.L1_SIMPLE]: ['spec-agent', 'policy-risk', 'codegen'],
  [ComplexityLevel.L2_MODERATE]: ['spec-agent', 'policy-risk', 'planner', 'codegen', 'review'],
  [ComplexityLevel.L3_COMPLEX]: [
    'spec-agent',
    'policy-risk',
    'planner',
    'codegen',
    'review',
    'test-build',
    'executor',
  ],
  [ComplexityLevel.L4_DANGEROUS]: [
    'spec-agent',
    'policy-risk',
    'planner',
    'codegen',
    'review',
    'test-build',
    'executor',
    'rollback',
  ],
};

// ────────────────────────────────────────────────────────────
// 에이전트 설정 조회 유틸리티
// ────────────────────────────────────────────────────────────

/**
 * 에이전트 이름으로 설정을 조회한다
 * 존재하지 않는 에이전트 이름 요청 시 undefined 반환
 */
export function getAgentConfig(name: AgentName): AgentConfig | undefined {
  return AGENT_CONFIGS.find((config) => config.name === name);
}

/**
 * 복잡도 레벨에 해당하는 에이전트 팀 설정 배열을 반환한다
 */
export function getTeamConfigs(level: ComplexityLevel): readonly AgentConfig[] {
  const teamNames = COMPLEXITY_AGENT_TEAMS[level];
  return AGENT_CONFIGS.filter((config) =>
    (teamNames as readonly string[]).includes(config.name),
  );
}
