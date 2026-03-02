/**
 * AgentStatusBar — 9개 에이전트의 실시간 건강 상태 인디케이터
 * 상단 헤더에 배치되어 각 에이전트의 활성/유휴/오류 상태를 표시한다.
 */

import React from 'react';
import type { AgentName } from '@jarvis/shared';

// ─────────────────────────────────────────
// 에이전트 상태 타입
// ─────────────────────────────────────────

/** 에이전트 건강 상태 — UI 표시용 */
export type AgentDisplayStatus = 'idle' | 'active' | 'error' | 'offline';

/** 에이전트 상태 항목 */
export interface AgentStatusItem {
  readonly name: AgentName;
  readonly displayName: string;
  readonly status: AgentDisplayStatus;
  /** 현재 진행 중인 작업 (active 상태일 때) */
  readonly currentActivity?: string;
}

/** AgentStatusBar 컴포넌트 Props */
export interface AgentStatusBarProps {
  /** 에이전트 상태 목록 */
  readonly agents: readonly AgentStatusItem[];
  /** 압축 표시 모드 (헤더 공간 절약) */
  readonly compact?: boolean;
}

// ─────────────────────────────────────────
// 기본 에이전트 상태 데이터
// ─────────────────────────────────────────

/** 에이전트 표시 이름 매핑 */
const AGENT_DISPLAY_NAMES: Record<AgentName, string> = {
  orchestrator: 'Orch',
  'spec-agent': 'Spec',
  'policy-risk': 'Policy',
  planner: 'Plan',
  codegen: 'Code',
  review: 'Review',
  'test-build': 'Test',
  executor: 'Exec',
  rollback: 'Roll',
};

/** 상태별 색상 CSS 클래스 */
const STATUS_COLORS: Record<AgentDisplayStatus, string> = {
  idle: 'bg-text-muted',
  active: 'bg-ok',
  error: 'bg-danger',
  offline: 'bg-bg-3',
};

/** 상태별 글로우 효과 */
const STATUS_GLOW: Record<AgentDisplayStatus, string> = {
  idle: '',
  active: 'shadow-glow-ok',
  error: 'shadow-glow-danger',
  offline: '',
};

/** 상태별 pulse 애니메이션 */
const STATUS_ANIMATE: Record<AgentDisplayStatus, string> = {
  idle: '',
  active: 'animate-pulse-slow',
  error: 'animate-pulse',
  offline: '',
};

// ─────────────────────────────────────────
// AgentStatusBar 컴포넌트
// ─────────────────────────────────────────

/**
 * 9개 에이전트의 실시간 상태를 상단 바에 표시한다.
 * 각 인디케이터는 색상 도트 + 짧은 이름으로 구성된다.
 */
export const AgentStatusBar = React.memo(function AgentStatusBar({
  agents,
  compact = false,
}: AgentStatusBarProps): React.JSX.Element {
  return (
    <div
      className={`flex items-center gap-2 ${compact ? 'gap-1' : 'gap-3'}`}
      role="status"
      aria-label="에이전트 상태 인디케이터"
    >
      {agents.map((agent) => (
        <AgentIndicator
          key={agent.name}
          agent={agent}
          compact={compact}
        />
      ))}
    </div>
  );
});

// ─────────────────────────────────────────
// AgentIndicator 서브컴포넌트
// ─────────────────────────────────────────

/** 개별 에이전트 상태 인디케이터 */
const AgentIndicator = React.memo(function AgentIndicator({
  agent,
  compact,
}: {
  readonly agent: AgentStatusItem;
  readonly compact: boolean;
}): React.JSX.Element {
  const displayName = AGENT_DISPLAY_NAMES[agent.name] ?? agent.name;
  const colorClass = STATUS_COLORS[agent.status];
  const glowClass = STATUS_GLOW[agent.status];
  const animateClass = STATUS_ANIMATE[agent.status];

  // 툴팁 텍스트 생성
  const tooltipText =
    agent.status === 'active' && agent.currentActivity !== undefined
      ? `${agent.name}: ${agent.currentActivity}`
      : `${agent.name}: ${agent.status}`;

  return (
    <div
      className="relative group flex items-center gap-1.5 cursor-default"
      title={tooltipText}
      aria-label={tooltipText}
    >
      {/* 상태 도트 */}
      <div
        className={[
          'rounded-full',
          compact ? 'w-1.5 h-1.5' : 'w-2 h-2',
          colorClass,
          glowClass,
          animateClass,
        ]
          .filter(Boolean)
          .join(' ')}
        aria-hidden="true"
      />

      {/* 에이전트 약칭 (압축 모드에서만 표시) */}
      {!compact && (
        <span className="text-xs text-text-muted font-mono select-none">
          {displayName}
        </span>
      )}

      {/* 호버 툴팁 */}
      <div
        className={[
          'absolute bottom-full left-1/2 -translate-x-1/2 mb-2',
          'px-2 py-1 rounded text-xs font-mono whitespace-nowrap',
          'bg-bg-2 border border-glass-border text-text-secondary',
          'opacity-0 group-hover:opacity-100 transition-opacity duration-150',
          'pointer-events-none z-50',
        ].join(' ')}
        role="tooltip"
      >
        <span className="font-semibold text-text-primary">{agent.name}</span>
        <span className="mx-1 text-text-muted">·</span>
        <span
          className={
            agent.status === 'active'
              ? 'text-ok'
              : agent.status === 'error'
                ? 'text-danger'
                : 'text-text-muted'
          }
        >
          {agent.status}
        </span>
        {agent.currentActivity !== undefined && (
          <div className="text-text-muted mt-0.5 max-w-48 truncate">
            {agent.currentActivity}
          </div>
        )}
      </div>
    </div>
  );
});

// ─────────────────────────────────────────
// 기본 에이전트 목록 (초기 상태)
// ─────────────────────────────────────────

/** 9개 에이전트 초기 상태 배열 (모두 idle) */
export const DEFAULT_AGENT_STATUSES: readonly AgentStatusItem[] = [
  { name: 'orchestrator', displayName: 'Orchestrator', status: 'idle' },
  { name: 'spec-agent', displayName: 'Spec Agent', status: 'idle' },
  { name: 'policy-risk', displayName: 'Policy Risk', status: 'idle' },
  { name: 'planner', displayName: 'Planner', status: 'idle' },
  { name: 'codegen', displayName: 'Codegen', status: 'idle' },
  { name: 'review', displayName: 'Review', status: 'idle' },
  { name: 'test-build', displayName: 'Test Build', status: 'idle' },
  { name: 'executor', displayName: 'Executor', status: 'idle' },
  { name: 'rollback', displayName: 'Rollback', status: 'idle' },
] as const;
