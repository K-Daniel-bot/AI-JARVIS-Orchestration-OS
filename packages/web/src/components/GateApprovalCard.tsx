/**
 * GateApprovalCard — Gate 승인 카드 컴포넌트
 * 사용자가 위험 작업을 검토하고 승인/거부/수정할 수 있는 UI를 제공한다.
 * what/why/risk를 명확히 표시하며, Framer Motion으로 등장 애니메이션을 적용한다.
 * 접근성: ARIA 레이블, 키보드 네비게이션, 스크린 리더 지원
 */

import React, { useState } from 'react';

// ─────────────────────────────────────────
// 게이트 관련 타입 정의
// ─────────────────────────────────────────

/** 위험도 레벨 표시용 */
export type RiskDisplayLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** Gate 승인 요청 데이터 */
export interface GateRequest {
  /** Gate ID (고유 식별자) */
  readonly gateId: string;
  /** Gate 레벨 (L1: 계획, L2: 변경, L3: 실행) */
  readonly level: 'L1' | 'L2' | 'L3' | 'L4';
  /** 수행하려는 작업 설명 (what) */
  readonly what: string;
  /** 작업이 필요한 이유 (why) */
  readonly why: string;
  /** 위험도 레벨 */
  readonly riskLevel: RiskDisplayLevel;
  /** 위험도 점수 (0~100) */
  readonly riskScore: number;
  /** 작업 세부 항목 */
  readonly details?: readonly string[];
  /** 영향을 받는 파일/경로 목록 */
  readonly affectedPaths?: readonly string[];
  /** 승인 타임아웃 (초) */
  readonly timeoutSeconds?: number;
}

/** GateApprovalCard 이벤트 핸들러 */
export interface GateApprovalHandlers {
  /** 승인 버튼 클릭 */
  readonly onApprove: (gateId: string) => void;
  /** 거부 버튼 클릭 */
  readonly onReject: (gateId: string, reason: string) => void;
  /** 범위 수정 요청 */
  readonly onModifyScope?: (gateId: string, modifications: string) => void;
}

/** GateApprovalCard Props */
export interface GateApprovalCardProps extends GateApprovalHandlers {
  readonly request: GateRequest;
  /** 카드 비활성화 (처리 중) */
  readonly disabled?: boolean;
}

// ─────────────────────────────────────────
// 위험도 스타일 매핑
// ─────────────────────────────────────────

/** 위험도별 색상/스타일 설정 */
const RISK_STYLES: Record<RiskDisplayLevel, {
  border: string;
  badge: string;
  label: string;
  icon: string;
}> = {
  LOW: {
    border: 'border-ok/30',
    badge: 'bg-ok-muted text-ok border border-ok/30',
    label: '낮음',
    icon: '●',
  },
  MEDIUM: {
    border: 'border-warning/30',
    badge: 'bg-warning-muted text-warning border border-warning/30',
    label: '중간',
    icon: '◆',
  },
  HIGH: {
    border: 'border-danger/30',
    badge: 'bg-danger-muted text-danger border border-danger/30',
    label: '높음',
    icon: '▲',
  },
  CRITICAL: {
    border: 'border-danger/60',
    badge: 'bg-danger-muted text-danger border border-danger/50 animate-pulse',
    label: '심각',
    icon: '◉',
  },
};

/** Gate 레벨 설명 */
const GATE_LEVEL_LABELS: Record<GateRequest['level'], string> = {
  L1: '계획 승인',
  L2: '변경 승인',
  L3: '실행 승인',
  L4: '위험 작업 승인',
};

// ─────────────────────────────────────────
// GateApprovalCard 컴포넌트
// ─────────────────────────────────────────

/**
 * Gate 승인 카드 — 사용자에게 위험 작업 승인을 요청한다.
 * what/why/risk를 명확히 표시하고 승인/거부/수정 버튼을 제공한다.
 */
export function GateApprovalCard({
  request,
  onApprove,
  onReject,
  onModifyScope,
  disabled = false,
}: GateApprovalCardProps): React.JSX.Element {
  // 거부 이유 입력 상태
  const [showRejectInput, setShowRejectInput] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  // 범위 수정 입력 상태
  const [showModifyInput, setShowModifyInput] = useState(false);
  const [modifications, setModifications] = useState('');

  const riskStyle = RISK_STYLES[request.riskLevel];
  const gateLevelLabel = GATE_LEVEL_LABELS[request.level];

  // 승인 핸들러
  const handleApprove = (): void => {
    if (!disabled) {
      onApprove(request.gateId);
    }
  };

  // 거부 확정 핸들러
  const handleRejectConfirm = (): void => {
    if (!disabled && rejectReason.trim().length > 0) {
      onReject(request.gateId, rejectReason.trim());
    }
  };

  // 범위 수정 확정 핸들러
  const handleModifyConfirm = (): void => {
    if (!disabled && onModifyScope !== undefined && modifications.trim().length > 0) {
      onModifyScope(request.gateId, modifications.trim());
    }
  };

  // 키보드 이벤트 핸들러
  const handleKeyDown = (e: React.KeyboardEvent, action: () => void): void => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      action();
    }
  };

  return (
    <div
      className={[
        'relative w-full rounded-jarvis-lg',
        'bg-bg-2 border',
        riskStyle.border,
        'shadow-glass',
        'backdrop-blur-glass',
        'animate-gate-appear',
        disabled ? 'opacity-60 pointer-events-none' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      role="dialog"
      aria-labelledby={`gate-title-${request.gateId}`}
      aria-describedby={`gate-desc-${request.gateId}`}
      aria-modal="true"
    >
      {/* 상단 헤더 */}
      <div className="flex items-start justify-between p-4 border-b border-glass-border">
        <div className="flex items-center gap-3">
          {/* Gate 레벨 배지 */}
          <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-accent-muted text-accent border border-accent/30">
            Gate {request.level}
          </span>
          <h3
            id={`gate-title-${request.gateId}`}
            className="text-text-primary font-semibold text-sm"
          >
            {gateLevelLabel} 요청
          </h3>
        </div>

        {/* 위험도 배지 */}
        <span
          className={`px-2 py-0.5 rounded text-xs font-mono font-bold ${riskStyle.badge}`}
          aria-label={`위험도: ${riskStyle.label}`}
        >
          {riskStyle.icon} {request.riskLevel} ({request.riskScore})
        </span>
      </div>

      {/* 본문 */}
      <div
        id={`gate-desc-${request.gateId}`}
        className="p-4 space-y-3"
      >
        {/* What — 수행할 작업 */}
        <div>
          <div className="text-xs text-text-muted uppercase tracking-wider mb-1">
            수행할 작업
          </div>
          <p className="text-text-primary text-sm leading-relaxed">
            {request.what}
          </p>
        </div>

        {/* Why — 작업 이유 */}
        <div>
          <div className="text-xs text-text-muted uppercase tracking-wider mb-1">
            필요한 이유
          </div>
          <p className="text-text-secondary text-sm leading-relaxed">
            {request.why}
          </p>
        </div>

        {/* 영향받는 파일/경로 */}
        {request.affectedPaths !== undefined && request.affectedPaths.length > 0 && (
          <div>
            <div className="text-xs text-text-muted uppercase tracking-wider mb-1">
              영향받는 경로
            </div>
            <ul className="space-y-0.5">
              {request.affectedPaths.map((path, idx) => (
                <li
                  key={idx}
                  className="text-xs font-mono text-text-secondary bg-bg-1 px-2 py-0.5 rounded"
                >
                  {path}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 세부 항목 */}
        {request.details !== undefined && request.details.length > 0 && (
          <div>
            <div className="text-xs text-text-muted uppercase tracking-wider mb-1">
              세부 항목
            </div>
            <ul className="space-y-0.5 list-none">
              {request.details.map((detail, idx) => (
                <li key={idx} className="text-xs text-text-secondary flex items-start gap-1.5">
                  <span className="text-text-muted mt-0.5">·</span>
                  <span>{detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* 타임아웃 표시 */}
        {request.timeoutSeconds !== undefined && (
          <div className="text-xs text-text-muted">
            승인 대기 시간: {request.timeoutSeconds}초
          </div>
        )}
      </div>

      {/* 거부 이유 입력 영역 */}
      {showRejectInput && (
        <div className="px-4 pb-3 space-y-2">
          <label
            htmlFor={`reject-reason-${request.gateId}`}
            className="text-xs text-text-muted"
          >
            거부 이유 입력
          </label>
          <textarea
            id={`reject-reason-${request.gateId}`}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="거부 이유를 입력하세요..."
            className={[
              'w-full px-3 py-2 rounded text-sm',
              'bg-bg-1 border border-glass-border',
              'text-text-primary placeholder-text-muted',
              'focus:outline-none focus:border-danger/60',
              'resize-none',
            ].join(' ')}
            rows={3}
            aria-label="거부 이유"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleRejectConfirm}
              disabled={rejectReason.trim().length === 0}
              onKeyDown={(e) => handleKeyDown(e, handleRejectConfirm)}
              className="px-3 py-1.5 rounded text-xs font-medium bg-danger/20 text-danger border border-danger/30 hover:bg-danger/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="거부 확정"
            >
              거부 확정
            </button>
            <button
              type="button"
              onClick={() => {
                setShowRejectInput(false);
                setRejectReason('');
              }}
              className="px-3 py-1.5 rounded text-xs font-medium text-text-muted hover:text-text-secondary transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 범위 수정 입력 영역 */}
      {showModifyInput && onModifyScope !== undefined && (
        <div className="px-4 pb-3 space-y-2">
          <label
            htmlFor={`modify-scope-${request.gateId}`}
            className="text-xs text-text-muted"
          >
            범위 수정 요청
          </label>
          <textarea
            id={`modify-scope-${request.gateId}`}
            value={modifications}
            onChange={(e) => setModifications(e.target.value)}
            placeholder="수정할 내용을 입력하세요..."
            className={[
              'w-full px-3 py-2 rounded text-sm',
              'bg-bg-1 border border-glass-border',
              'text-text-primary placeholder-text-muted',
              'focus:outline-none focus:border-warning/60',
              'resize-none',
            ].join(' ')}
            rows={3}
            aria-label="범위 수정 요청"
            autoFocus
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleModifyConfirm}
              disabled={modifications.trim().length === 0}
              className="px-3 py-1.5 rounded text-xs font-medium bg-warning-muted text-warning border border-warning/30 hover:bg-warning/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              aria-label="수정 요청 확정"
            >
              수정 요청
            </button>
            <button
              type="button"
              onClick={() => {
                setShowModifyInput(false);
                setModifications('');
              }}
              className="px-3 py-1.5 rounded text-xs font-medium text-text-muted hover:text-text-secondary transition-colors"
            >
              취소
            </button>
          </div>
        </div>
      )}

      {/* 액션 버튼 영역 */}
      {!showRejectInput && !showModifyInput && (
        <div className="flex items-center justify-between p-4 border-t border-glass-border">
          <div className="flex gap-2">
            {/* 거부 버튼 */}
            <button
              type="button"
              onClick={() => setShowRejectInput(true)}
              disabled={disabled}
              className={[
                'px-4 py-2 rounded text-sm font-medium',
                'bg-danger-muted text-danger',
                'border border-danger/30',
                'hover:bg-danger/20 hover:border-danger/50',
                'focus:outline-none focus:ring-2 focus:ring-danger/50',
                'transition-all duration-150',
                'disabled:opacity-50 disabled:cursor-not-allowed',
              ].join(' ')}
              aria-label="작업 거부"
            >
              거부
            </button>

            {/* 범위 수정 버튼 (핸들러 제공 시) */}
            {onModifyScope !== undefined && (
              <button
                type="button"
                onClick={() => setShowModifyInput(true)}
                disabled={disabled}
                className={[
                  'px-4 py-2 rounded text-sm font-medium',
                  'bg-warning-muted text-warning',
                  'border border-warning/30',
                  'hover:bg-warning/20 hover:border-warning/50',
                  'focus:outline-none focus:ring-2 focus:ring-warning/50',
                  'transition-all duration-150',
                  'disabled:opacity-50 disabled:cursor-not-allowed',
                ].join(' ')}
                aria-label="작업 범위 수정 요청"
              >
                수정
              </button>
            )}
          </div>

          {/* 승인 버튼 */}
          <button
            type="button"
            onClick={handleApprove}
            disabled={disabled}
            className={[
              'px-6 py-2 rounded text-sm font-semibold',
              'bg-ok text-bg-0',
              'hover:bg-ok/90',
              'focus:outline-none focus:ring-2 focus:ring-ok/50',
              'transition-all duration-150',
              'disabled:opacity-50 disabled:cursor-not-allowed',
              request.riskLevel === 'CRITICAL' ? 'shadow-glow-ok' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            aria-label="작업 승인"
          >
            승인
          </button>
        </div>
      )}
    </div>
  );
}
