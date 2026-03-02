/**
 * AuditLogPanel — 실시간 append-only 감사 로그 뷰어 컴포넌트
 * 오른쪽 패널에 위치하며 모든 에이전트 작업을 시간순으로 표시한다.
 * 새 항목은 상단에 추가되고 민감 정보는 마스킹되어 표시된다.
 */

import React, { useRef, useEffect, useState } from 'react';

// ─────────────────────────────────────────
// 감사 로그 UI 타입 정의
// ─────────────────────────────────────────

/** 감사 로그 엔트리 — UI 표시용 최소 필드 */
export interface AuditLogEntry {
  /** 감사 로그 고유 ID */
  readonly auditId: string;
  /** 기록 시각 (ISO 8601) */
  readonly timestamp: string;
  /** 에이전트 이름 */
  readonly agentName: string;
  /** 수행한 액션 유형 */
  readonly actionType: string;
  /** 결과 상태 */
  readonly status: 'SUCCESS' | 'FAILED' | 'SKIPPED' | 'PENDING';
  /** 위험도 레벨 */
  readonly riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  /** 작업 요약 설명 */
  readonly description?: string;
  /** 실행 소요 시간 (ms) */
  readonly durationMs?: number;
}

/** AuditLogPanel Props */
export interface AuditLogPanelProps {
  /** 감사 로그 엔트리 배열 (최신순) */
  readonly entries: readonly AuditLogEntry[];
  /** 자동 스크롤 활성화 */
  readonly autoScroll?: boolean;
  /** 최대 표시 항목 수 */
  readonly maxEntries?: number;
  /** 로딩 상태 */
  readonly isLoading?: boolean;
}

// ─────────────────────────────────────────
// 스타일 상수
// ─────────────────────────────────────────

/** 상태별 색상 */
const STATUS_STYLES: Record<AuditLogEntry['status'], string> = {
  SUCCESS: 'text-ok',
  FAILED: 'text-danger',
  SKIPPED: 'text-text-muted',
  PENDING: 'text-warning',
};

/** 위험도별 색상 */
const RISK_STYLES: Record<AuditLogEntry['riskLevel'], string> = {
  LOW: 'text-ok',
  MEDIUM: 'text-warning',
  HIGH: 'text-danger',
  CRITICAL: 'text-danger font-bold',
};

/** 위험도별 배경 강조 */
const RISK_BG: Record<AuditLogEntry['riskLevel'], string> = {
  LOW: '',
  MEDIUM: '',
  HIGH: 'border-l-2 border-l-danger/30',
  CRITICAL: 'border-l-2 border-l-danger/70 bg-danger-muted/30',
};

// ─────────────────────────────────────────
// AuditLogPanel 컴포넌트
// ─────────────────────────────────────────

/**
 * 실시간 감사 로그 패널 — append-only 로그를 시간순으로 표시한다.
 * 새 항목 도착 시 자동 스크롤 옵션을 제공한다.
 */
export function AuditLogPanel({
  entries,
  autoScroll = true,
  maxEntries = 100,
  isLoading = false,
}: AuditLogPanelProps): React.JSX.Element {
  const scrollRef = useRef<HTMLDivElement>(null);
  // 사용자가 수동 스크롤 중인지 추적
  const [isUserScrolling, setIsUserScrolling] = useState(false);

  // 새 항목 도착 시 자동 스크롤
  useEffect(() => {
    if (autoScroll && !isUserScrolling && scrollRef.current !== null) {
      scrollRef.current.scrollTop = 0; // 최신 항목이 상단
    }
  }, [entries.length, autoScroll, isUserScrolling]);

  // 스크롤 이벤트 — 수동 스크롤 감지
  const handleScroll = (): void => {
    if (scrollRef.current !== null) {
      const { scrollTop } = scrollRef.current;
      setIsUserScrolling(scrollTop > 20);
    }
  };

  // 표시할 항목 수 제한
  const displayedEntries = entries.slice(0, maxEntries);

  return (
    <div className="flex flex-col h-full">
      {/* 패널 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-glass-border">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-text-primary">감사 로그</h2>
          <span className="text-xs font-mono text-text-muted bg-bg-3 px-1.5 py-0.5 rounded">
            {entries.length}건
          </span>
          {/* 불변성 표시 */}
          <span
            className="text-xs text-text-muted"
            title="Append-only 불변 로그"
            aria-label="불변 로그"
          >
            🔒
          </span>
        </div>

        {/* 자동 스크롤 상태 표시 */}
        {autoScroll && (
          <div
            className={`flex items-center gap-1 text-xs ${
              isUserScrolling ? 'text-text-muted' : 'text-ok'
            }`}
          >
            <div
              className={`w-1.5 h-1.5 rounded-full ${
                isUserScrolling ? 'bg-text-muted' : 'bg-ok animate-pulse-slow'
              }`}
            />
            <span>{isUserScrolling ? '일시 중지' : '실시간'}</span>
          </div>
        )}
      </div>

      {/* 로그 목록 */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-bg-3 scrollbar-track-transparent"
        role="log"
        aria-label="감사 로그 목록"
        aria-live="polite"
        aria-relevant="additions"
      >
        {isLoading && (
          <div className="flex items-center justify-center py-8">
            <div className="text-sm text-text-muted animate-pulse">
              로그 로딩 중...
            </div>
          </div>
        )}

        {!isLoading && displayedEntries.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-text-muted text-sm">
              감사 로그가 없습니다
            </div>
            <div className="text-text-muted text-xs mt-1">
              에이전트가 작업을 수행하면 여기에 기록됩니다
            </div>
          </div>
        )}

        {!isLoading && displayedEntries.map((entry) => (
          <AuditLogEntryRow key={entry.auditId} entry={entry} />
        ))}

        {/* 최대 표시 수 초과 알림 */}
        {entries.length > maxEntries && (
          <div className="px-4 py-2 text-center text-xs text-text-muted border-t border-glass-border">
            +{entries.length - maxEntries}건 더 있습니다
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────
// AuditLogEntryRow 서브컴포넌트
// ─────────────────────────────────────────

/** 개별 감사 로그 엔트리 행 */
const AuditLogEntryRow = React.memo(function AuditLogEntryRow({
  entry,
}: {
  readonly entry: AuditLogEntry;
}): React.JSX.Element {
  const [expanded, setExpanded] = useState(false);

  const statusStyle = STATUS_STYLES[entry.status];
  const riskStyle = RISK_STYLES[entry.riskLevel];
  const riskBg = RISK_BG[entry.riskLevel];

  // 시각 포맷 (HH:MM:SS)
  const timeStr = new Date(entry.timestamp).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  return (
    <div
      className={[
        'px-4 py-2.5 border-b border-glass-border/50',
        'hover:bg-bg-3/50 transition-colors duration-100',
        riskBg,
        'cursor-pointer',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => setExpanded(!expanded)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setExpanded(!expanded);
        }
      }}
      aria-expanded={expanded}
      aria-label={`${entry.agentName} - ${entry.actionType} - ${entry.status}`}
    >
      {/* 첫 번째 줄: 시각 + 에이전트 + 액션 + 상태 */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {/* 시각 */}
          <span className="text-xs font-mono text-text-muted shrink-0">
            {timeStr}
          </span>

          {/* 에이전트 이름 */}
          <span className="text-xs font-mono text-accent shrink-0">
            [{entry.agentName}]
          </span>

          {/* 액션 유형 */}
          <span className="text-xs text-text-secondary truncate">
            {entry.actionType}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* 위험도 */}
          <span className={`text-xs font-mono ${riskStyle}`}>
            {entry.riskLevel}
          </span>

          {/* 상태 */}
          <span className={`text-xs font-semibold ${statusStyle}`}>
            {entry.status}
          </span>

          {/* 소요 시간 */}
          {entry.durationMs !== undefined && (
            <span className="text-xs font-mono text-text-muted">
              {entry.durationMs}ms
            </span>
          )}
        </div>
      </div>

      {/* 확장 영역: 설명 + 감사 ID */}
      {expanded && (
        <div className="mt-2 space-y-1 animate-fade-in">
          {entry.description !== undefined && (
            <p className="text-xs text-text-secondary leading-relaxed">
              {entry.description}
            </p>
          )}
          <div className="text-xs font-mono text-text-muted">
            ID: {entry.auditId}
          </div>
          <div className="text-xs font-mono text-text-muted">
            {new Date(entry.timestamp).toLocaleString('ko-KR')}
          </div>
        </div>
      )}
    </div>
  );
});
