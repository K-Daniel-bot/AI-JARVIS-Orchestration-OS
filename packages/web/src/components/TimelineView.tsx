/**
 * TimelineView — 실행 타임라인 및 undo 포인트 표시 컴포넌트
 * 중앙 패널에 배치되어 에이전트 파이프라인 실행 흐름을 시각화한다.
 * 체크포인트(undo 포인트)를 표시하고 롤백 가능 지점을 강조한다.
 */

import React, { useState } from 'react';

// ─────────────────────────────────────────
// 타임라인 타입 정의
// ─────────────────────────────────────────

/** 타임라인 단계 상태 */
export type TimelineStepStatus =
  | 'pending'   // 미시작
  | 'running'   // 실행 중
  | 'success'   // 완료
  | 'failed'    // 실패
  | 'skipped'   // 건너뜀
  | 'gate'      // 게이트 대기 중
  | 'rollback'; // 롤백됨

/** 타임라인 단계 */
export interface TimelineStep {
  /** 단계 고유 ID */
  readonly stepId: string;
  /** 단계 순서 번호 */
  readonly order: number;
  /** 에이전트 이름 */
  readonly agentName: string;
  /** 단계 이름 */
  readonly label: string;
  /** 현재 상태 */
  readonly status: TimelineStepStatus;
  /** 시작 시각 (ISO 8601) */
  readonly startedAt?: string;
  /** 완료 시각 (ISO 8601) */
  readonly completedAt?: string;
  /** 소요 시간 (ms) */
  readonly durationMs?: number;
  /** 체크포인트 (undo 포인트) 여부 */
  readonly isCheckpoint?: boolean;
  /** 단계 세부 설명 */
  readonly description?: string;
  /** Gate 요청 정보 (gate 상태일 때) */
  readonly gateLevel?: 'L1' | 'L2' | 'L3' | 'L4';
}

/** TimelineView Props */
export interface TimelineViewProps {
  /** 타임라인 단계 배열 (순서대로) */
  readonly steps: readonly TimelineStep[];
  /** 체크포인트에서 롤백 요청 핸들러 */
  readonly onRollbackToCheckpoint?: (stepId: string) => void;
  /** 현재 실행 중인 runId */
  readonly runId?: string;
}

// ─────────────────────────────────────────
// 스타일 상수
// ─────────────────────────────────────────

/** 상태별 색상/아이콘 */
const STEP_STYLES: Record<TimelineStepStatus, {
  dot: string;
  line: string;
  label: string;
  icon: string;
}> = {
  pending: {
    dot: 'bg-bg-3 border-2 border-text-muted',
    line: 'bg-text-muted/20',
    label: 'text-text-muted',
    icon: '○',
  },
  running: {
    dot: 'bg-accent border-2 border-accent animate-pulse',
    line: 'bg-accent/30',
    label: 'text-accent',
    icon: '◎',
  },
  success: {
    dot: 'bg-ok border-2 border-ok',
    line: 'bg-ok/40',
    label: 'text-text-secondary',
    icon: '●',
  },
  failed: {
    dot: 'bg-danger border-2 border-danger',
    line: 'bg-danger/30',
    label: 'text-danger',
    icon: '◉',
  },
  skipped: {
    dot: 'bg-bg-3 border-2 border-text-muted/30',
    line: 'bg-text-muted/10',
    label: 'text-text-muted',
    icon: '◌',
  },
  gate: {
    dot: 'bg-warning border-2 border-warning animate-pulse-slow',
    line: 'bg-warning/20',
    label: 'text-warning',
    icon: '◆',
  },
  rollback: {
    dot: 'bg-text-muted border-2 border-text-muted/50',
    line: 'bg-text-muted/20',
    label: 'text-text-muted line-through',
    icon: '↩',
  },
};

// ─────────────────────────────────────────
// TimelineView 컴포넌트
// ─────────────────────────────────────────

/**
 * 에이전트 파이프라인 실행 타임라인을 수직으로 표시한다.
 * 체크포인트는 별도 표시하여 롤백 가능 지점을 명확히 한다.
 */
export function TimelineView({
  steps,
  onRollbackToCheckpoint,
  runId,
}: TimelineViewProps): React.JSX.Element {
  return (
    <div className="flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-glass-border">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-text-primary">실행 타임라인</h2>
          {runId !== undefined && (
            <span className="text-xs font-mono text-text-muted bg-bg-3 px-1.5 py-0.5 rounded truncate max-w-32">
              {runId}
            </span>
          )}
        </div>
        <span className="text-xs text-text-muted">
          {steps.filter((s) => s.status === 'success').length}/{steps.length} 완료
        </span>
      </div>

      {/* 타임라인 목록 */}
      <div className="flex-1 overflow-y-auto p-4">
        {steps.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-text-muted text-sm">
              실행 대기 중
            </div>
            <div className="text-text-muted text-xs mt-1">
              jarvis run 커맨드로 작업을 시작하세요
            </div>
          </div>
        )}

        <div className="relative">
          {steps.map((step, idx) => (
            <TimelineStepRow
              key={step.stepId}
              step={step}
              isLast={idx === steps.length - 1}
              onRollback={onRollbackToCheckpoint}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// TimelineStepRow 서브컴포넌트
// ─────────────────────────────────────────

/** 개별 타임라인 단계 행 */
const TimelineStepRow = React.memo(function TimelineStepRow({
  step,
  isLast,
  onRollback,
}: {
  readonly step: TimelineStep;
  readonly isLast: boolean;
  readonly onRollback?: (stepId: string) => void;
}): React.JSX.Element {
  const [showDetails, setShowDetails] = useState(false);
  const style = STEP_STYLES[step.status];

  // 소요 시간 포맷
  const durationStr =
    step.durationMs !== undefined
      ? step.durationMs >= 1000
        ? `${(step.durationMs / 1000).toFixed(1)}s`
        : `${step.durationMs}ms`
      : undefined;

  return (
    <div className="flex gap-3 relative">
      {/* 수직 연결선 + 도트 */}
      <div className="flex flex-col items-center">
        {/* 체크포인트 마커 (도트 위) */}
        {step.isCheckpoint === true && (
          <div
            className="text-xs font-mono text-accent-muted mb-1"
            title="체크포인트 (undo 포인트)"
            aria-label="체크포인트"
          >
            ┬
          </div>
        )}

        {/* 상태 도트 */}
        <div
          className={`w-3 h-3 rounded-full shrink-0 mt-0.5 ${style.dot}`}
          aria-hidden="true"
        />

        {/* 수직 연결선 */}
        {!isLast && (
          <div
            className={`w-0.5 flex-1 min-h-4 mt-1 ${style.line}`}
            aria-hidden="true"
          />
        )}
      </div>

      {/* 단계 내용 */}
      <div className="flex-1 pb-4">
        {/* Gate 레벨 배지 (gate 상태일 때) */}
        {step.status === 'gate' && step.gateLevel !== undefined && (
          <div className="mb-1">
            <span className="text-xs px-1.5 py-0.5 rounded bg-warning-muted text-warning border border-warning/30 font-mono">
              Gate {step.gateLevel} 승인 대기
            </span>
          </div>
        )}

        {/* 단계 헤더 */}
        <div
          className="flex items-start justify-between gap-2 cursor-pointer group"
          onClick={() => setShowDetails(!showDetails)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              setShowDetails(!showDetails);
            }
          }}
          aria-expanded={showDetails}
          aria-label={`${step.label} 상세 보기`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {/* 에이전트 이름 */}
            <span className="text-xs font-mono text-accent shrink-0">
              [{step.agentName}]
            </span>
            {/* 단계 이름 */}
            <span className={`text-sm font-medium truncate ${style.label}`}>
              {step.label}
            </span>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* 소요 시간 */}
            {durationStr !== undefined && (
              <span className="text-xs font-mono text-text-muted">
                {durationStr}
              </span>
            )}
            {/* 상태 아이콘 */}
            <span className={`text-xs ${style.label}`} aria-hidden="true">
              {STEP_STYLES[step.status].icon}
            </span>
          </div>
        </div>

        {/* 확장 상세 정보 */}
        {showDetails && (
          <div className="mt-2 space-y-1.5 animate-fade-in">
            {/* 설명 */}
            {step.description !== undefined && (
              <p className="text-xs text-text-secondary leading-relaxed">
                {step.description}
              </p>
            )}

            {/* 시작/완료 시각 */}
            {step.startedAt !== undefined && (
              <div className="text-xs font-mono text-text-muted">
                시작: {new Date(step.startedAt).toLocaleTimeString('ko-KR')}
              </div>
            )}
            {step.completedAt !== undefined && (
              <div className="text-xs font-mono text-text-muted">
                완료: {new Date(step.completedAt).toLocaleTimeString('ko-KR')}
              </div>
            )}

            {/* 체크포인트 롤백 버튼 */}
            {step.isCheckpoint === true &&
              step.status === 'success' &&
              onRollback !== undefined && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onRollback(step.stepId);
                  }}
                  className={[
                    'mt-1 px-3 py-1 rounded text-xs font-medium',
                    'bg-accent-muted text-accent',
                    'border border-accent/30',
                    'hover:bg-accent/20',
                    'focus:outline-none focus:ring-1 focus:ring-accent/50',
                    'transition-colors duration-150',
                  ].join(' ')}
                  aria-label={`${step.label} 단계로 롤백`}
                >
                  ↩ 이 지점으로 롤백
                </button>
              )}
          </div>
        )}

        {/* 체크포인트 표시줄 */}
        {step.isCheckpoint === true && (
          <div className="mt-1 flex items-center gap-1">
            <div className="h-px flex-1 bg-accent/20" />
            <span className="text-xs font-mono text-accent/50">checkpoint</span>
            <div className="h-px flex-1 bg-accent/20" />
          </div>
        )}
      </div>
    </div>
  );
});
