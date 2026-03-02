/**
 * JARVIS OS 대시보드 — 3패널 레이아웃 메인 앱 셸
 * 좌측(28%): 대화/음성 패널 — 사용자 입력 및 에이전트 대화
 * 중앙(44%): 타임라인/실행 패널 — 파이프라인 실행 흐름
 * 우측(28%): 승인/정책/감사 패널 — Gate 승인 및 감사 로그
 */

import React, { useState, useCallback } from 'react';
import type { AgentStatusItem } from './components/AgentStatusBar.js';
import type { GateRequest } from './components/GateApprovalCard.js';
import type { AuditLogEntry } from './components/AuditLogPanel.js';
import type { TimelineStep } from './components/TimelineView.js';
import { AgentStatusBar, DEFAULT_AGENT_STATUSES } from './components/AgentStatusBar.js';
import { GateApprovalCard } from './components/GateApprovalCard.js';
import { AuditLogPanel } from './components/AuditLogPanel.js';
import { TimelineView } from './components/TimelineView.js';

// ─────────────────────────────────────────
// 앱 상태 타입
// ─────────────────────────────────────────

/** 전체 앱 실행 상태 */
type AppRunStatus = 'idle' | 'running' | 'gate_waiting' | 'completed' | 'error';

/** 대화 메시지 타입 */
interface ConversationMessage {
  readonly id: string;
  readonly role: 'user' | 'assistant' | 'system';
  readonly content: string;
  readonly timestamp: string;
}

// ─────────────────────────────────────────
// 샘플 초기 데이터
// ─────────────────────────────────────────

/** 샘플 타임라인 단계 (Phase 0 데모용) */
const SAMPLE_TIMELINE_STEPS: readonly TimelineStep[] = [
  {
    stepId: 'step-spec',
    order: 1,
    agentName: 'spec-agent',
    label: '명세 분석',
    status: 'success',
    startedAt: new Date(Date.now() - 12000).toISOString(),
    completedAt: new Date(Date.now() - 10000).toISOString(),
    durationMs: 1240,
    isCheckpoint: false,
    description: '사용자 의도를 분석하고 SPEC.md를 생성했습니다.',
  },
  {
    stepId: 'step-policy',
    order: 2,
    agentName: 'policy-risk',
    label: '정책 판정',
    status: 'success',
    startedAt: new Date(Date.now() - 10000).toISOString(),
    completedAt: new Date(Date.now() - 8000).toISOString(),
    durationMs: 2100,
    isCheckpoint: true,
    description: '위험도 MEDIUM으로 판정. 조건부 허용.',
  },
  {
    stepId: 'step-plan',
    order: 3,
    agentName: 'planner',
    label: '실행 계획 수립',
    status: 'gate',
    startedAt: new Date(Date.now() - 8000).toISOString(),
    gateLevel: 'L1',
    description: 'Gate L1: 계획 승인 대기 중',
  },
  {
    stepId: 'step-codegen',
    order: 4,
    agentName: 'codegen',
    label: '코드 생성',
    status: 'pending',
  },
  {
    stepId: 'step-review',
    order: 5,
    agentName: 'review',
    label: '코드 검토',
    status: 'pending',
  },
  {
    stepId: 'step-test',
    order: 6,
    agentName: 'test-build',
    label: '테스트/빌드',
    status: 'pending',
  },
] as const;

/** 샘플 감사 로그 (Phase 0 데모용) */
const SAMPLE_AUDIT_ENTRIES: readonly AuditLogEntry[] = [
  {
    auditId: 'aud_20260302_aaa111222333',
    timestamp: new Date(Date.now() - 10000).toISOString(),
    agentName: 'policy-risk',
    actionType: 'POLICY_EVALUATION',
    status: 'SUCCESS',
    riskLevel: 'MEDIUM',
    description: '정책 판정 완료 — 조건부 허용 (위험도 MEDIUM)',
    durationMs: 2100,
  },
  {
    auditId: 'aud_20260302_bbb444555666',
    timestamp: new Date(Date.now() - 12000).toISOString(),
    agentName: 'spec-agent',
    actionType: 'SPEC_GENERATION',
    status: 'SUCCESS',
    riskLevel: 'LOW',
    description: '요구사항 명세(SPEC.md) 생성 완료',
    durationMs: 1240,
  },
] as const;

/** 샘플 Gate 요청 (Phase 0 데모용) */
const SAMPLE_GATE_REQUEST: GateRequest = {
  gateId: 'gate_l1_demo',
  level: 'L1',
  what: 'src/auth/login.ts 파일을 생성하고 JWT 인증 모듈을 구현합니다.',
  why: '사용자가 "로그인 API를 구현해달라"고 요청했으며, Spec Agent가 JWT 토큰 기반 인증이 필요하다고 분석했습니다.',
  riskLevel: 'MEDIUM',
  riskScore: 45,
  affectedPaths: ['src/auth/login.ts', 'src/routes/index.ts', 'package.json'],
  details: [
    '새 파일 생성: src/auth/login.ts',
    'jsonwebtoken 패키지 의존성 추가',
    '라우터 등록: src/routes/index.ts 수정',
  ],
  timeoutSeconds: 300,
};

// ─────────────────────────────────────────
// App 컴포넌트
// ─────────────────────────────────────────

/**
 * JARVIS OS 대시보드 메인 컴포넌트 — 3패널 레이아웃 셸
 */
export function App(): React.JSX.Element {
  // ─── 상태 ───────────────────────────────
  const [runStatus] = useState<AppRunStatus>('gate_waiting');
  const [agentStatuses] = useState<readonly AgentStatusItem[]>(
    DEFAULT_AGENT_STATUSES.map((a) =>
      a.name === 'spec-agent' || a.name === 'policy-risk'
        ? { ...a, status: 'success' as const }
        : a.name === 'planner'
          ? { ...a, status: 'active' as const, currentActivity: 'Gate L1 대기 중' }
          : a,
    ),
  );
  const [timelineSteps] = useState<readonly TimelineStep[]>(SAMPLE_TIMELINE_STEPS);
  const [auditEntries] = useState<readonly AuditLogEntry[]>([...SAMPLE_AUDIT_ENTRIES]);
  const [activeGateRequest, setActiveGateRequest] = useState<GateRequest | null>(
    SAMPLE_GATE_REQUEST,
  );
  const [conversation] = useState<readonly ConversationMessage[]>([
    {
      id: 'msg-1',
      role: 'user',
      content: '로그인 API를 구현해줘. JWT 토큰 기반으로.',
      timestamp: new Date(Date.now() - 15000).toISOString(),
    },
    {
      id: 'msg-2',
      role: 'assistant',
      content:
        '요청을 분석했습니다. JWT 기반 인증 모듈을 구현하겠습니다. 명세 분석 → 정책 판정 완료. Gate L1 승인을 기다리고 있습니다.',
      timestamp: new Date(Date.now() - 10000).toISOString(),
    },
  ]);
  const [userInput, setUserInput] = useState('');

  // ─── 핸들러 ─────────────────────────────

  /** Gate 승인 핸들러 */
  const handleGateApprove = useCallback((gateId: string): void => {
    // Phase 0: 승인 시뮬레이션
    // Phase 1+: XState 이벤트 발행
    setActiveGateRequest(null);
    console.info(`[Gate] ${gateId} 승인됨`);
  }, []);

  /** Gate 거부 핸들러 */
  const handleGateReject = useCallback((gateId: string, reason: string): void => {
    setActiveGateRequest(null);
    console.info(`[Gate] ${gateId} 거부됨: ${reason}`);
  }, []);

  /** Gate 범위 수정 핸들러 */
  const handleGateModifyScope = useCallback((gateId: string, modifications: string): void => {
    setActiveGateRequest(null);
    console.info(`[Gate] ${gateId} 범위 수정 요청: ${modifications}`);
  }, []);

  /** 체크포인트 롤백 핸들러 */
  const handleRollbackToCheckpoint = useCallback((stepId: string): void => {
    console.info(`[Rollback] 체크포인트 ${stepId}로 롤백 요청`);
  }, []);

  /** 사용자 입력 제출 핸들러 */
  const handleInputSubmit = useCallback(
    (e: React.FormEvent): void => {
      e.preventDefault();
      if (userInput.trim().length === 0) return;
      // Phase 0: 입력 로그. Phase 1+: Orchestrator API 호출
      console.info(`[User Input] ${userInput}`);
      setUserInput('');
    },
    [userInput],
  );

  // ─── 렌더 ────────────────────────────────

  return (
    <div className="flex flex-col h-screen bg-bg-0 text-text-primary overflow-hidden">
      {/* 상단 헤더 바 */}
      <header
        className="flex items-center justify-between px-4 h-header shrink-0 border-b border-glass-border bg-bg-1/80 backdrop-blur-glass"
        role="banner"
      >
        {/* 좌측: 로고 */}
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-accent font-mono tracking-wider">
            JARVIS OS
          </span>
          <span className="text-xs text-text-muted">v0.1.0</span>

          {/* 실행 상태 표시 */}
          <div className="flex items-center gap-1.5">
            <div
              className={[
                'w-1.5 h-1.5 rounded-full',
                runStatus === 'running' || runStatus === 'gate_waiting'
                  ? 'bg-ok animate-pulse-slow'
                  : runStatus === 'error'
                    ? 'bg-danger'
                    : 'bg-text-muted',
              ].join(' ')}
              aria-hidden="true"
            />
            <span className="text-xs text-text-muted">
              {runStatus === 'idle'
                ? '대기'
                : runStatus === 'running'
                  ? '실행 중'
                  : runStatus === 'gate_waiting'
                    ? '게이트 대기'
                    : runStatus === 'completed'
                      ? '완료'
                      : '오류'}
            </span>
          </div>
        </div>

        {/* 중앙: 에이전트 상태 바 */}
        <AgentStatusBar agents={agentStatuses} compact />

        {/* 우측: 긴급 중단 버튼 */}
        <button
          type="button"
          className={[
            'px-3 py-1 rounded text-xs font-medium',
            'bg-danger-muted text-danger border border-danger/30',
            'hover:bg-danger/20',
            'focus:outline-none focus:ring-1 focus:ring-danger/50',
            'transition-colors',
          ].join(' ')}
          aria-label="긴급 중단"
          title="모든 실행 즉시 중단"
        >
          ■ 긴급 중단
        </button>
      </header>

      {/* 3패널 레이아웃 */}
      <main className="flex flex-1 overflow-hidden" role="main">
        {/* ── 좌측 패널: 대화/음성 (28%) ── */}
        <aside
          className="w-panel-left shrink-0 flex flex-col border-r border-glass-border bg-bg-1"
          aria-label="대화 패널"
        >
          {/* 패널 헤더 */}
          <div className="px-4 py-3 border-b border-glass-border">
            <h2 className="text-sm font-semibold text-text-primary">대화</h2>
          </div>

          {/* 대화 메시지 목록 */}
          <div
            className="flex-1 overflow-y-auto p-4 space-y-3"
            role="log"
            aria-label="대화 내역"
            aria-live="polite"
          >
            {conversation.map((msg) => (
              <ConversationBubble key={msg.id} message={msg} />
            ))}
          </div>

          {/* 입력창 */}
          <form
            onSubmit={handleInputSubmit}
            className="p-3 border-t border-glass-border"
          >
            <div className="flex gap-2">
              <input
                type="text"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                placeholder="요청을 입력하세요..."
                className={[
                  'flex-1 px-3 py-2 rounded text-sm',
                  'bg-bg-3 border border-glass-border',
                  'text-text-primary placeholder-text-muted',
                  'focus:outline-none focus:border-accent/50',
                  'transition-colors',
                ].join(' ')}
                aria-label="사용자 입력"
              />
              <button
                type="submit"
                disabled={userInput.trim().length === 0}
                className={[
                  'px-3 py-2 rounded text-xs font-medium',
                  'bg-accent text-bg-0',
                  'hover:bg-accent-hover',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                  'transition-colors',
                ].join(' ')}
                aria-label="입력 전송"
              >
                전송
              </button>
            </div>
          </form>
        </aside>

        {/* ── 중앙 패널: 타임라인/실행 (44%) ── */}
        <section
          className="flex-1 flex flex-col overflow-hidden border-r border-glass-border"
          aria-label="타임라인 패널"
        >
          <TimelineView
            steps={timelineSteps}
            onRollbackToCheckpoint={handleRollbackToCheckpoint}
          />
        </section>

        {/* ── 우측 패널: 승인/정책/감사 (28%) ── */}
        <aside
          className="w-panel-right shrink-0 flex flex-col bg-bg-1"
          aria-label="안전 패널"
        >
          {/* Gate 승인 카드 영역 */}
          {activeGateRequest !== null && (
            <div className="p-3 border-b border-glass-border">
              <GateApprovalCard
                request={activeGateRequest}
                onApprove={handleGateApprove}
                onReject={handleGateReject}
                onModifyScope={handleGateModifyScope}
              />
            </div>
          )}

          {/* 감사 로그 패널 */}
          <div className="flex-1 overflow-hidden">
            <AuditLogPanel
              entries={auditEntries}
              autoScroll
            />
          </div>
        </aside>
      </main>
    </div>
  );
}

// ─────────────────────────────────────────
// ConversationBubble 서브컴포넌트
// ─────────────────────────────────────────

/** 대화 메시지 말풍선 */
const ConversationBubble = React.memo(function ConversationBubble({
  message,
}: {
  readonly message: ConversationMessage;
}): React.JSX.Element {
  const isUser = message.role === 'user';
  const timeStr = new Date(message.timestamp).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div
      className={`flex flex-col gap-1 ${isUser ? 'items-end' : 'items-start'}`}
      role="article"
      aria-label={`${isUser ? '사용자' : '에이전트'} 메시지`}
    >
      <div
        className={[
          'max-w-[85%] px-3 py-2 rounded-jarvis text-sm leading-relaxed',
          isUser
            ? 'bg-accent-muted text-text-primary border border-accent/20'
            : 'bg-bg-3 text-text-secondary border border-glass-border',
        ].join(' ')}
      >
        {message.content}
      </div>
      <span className="text-xs text-text-muted">{timeStr}</span>
    </div>
  );
});
