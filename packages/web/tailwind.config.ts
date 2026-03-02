/**
 * Tailwind CSS 설정 — JARVIS OS Glass HUD 디자인 토큰
 * .claude/design/ui-ux.md 기반 색상, 폰트, 레이아웃 정의
 */

import type { Config } from 'tailwindcss';

// ─────────────────────────────────────────
// 디자인 토큰 상수 (ui-ux.md 기반)
// ─────────────────────────────────────────

/** JARVIS OS 전용 색상 팔레트 */
const JARVIS_COLORS = {
  // 배경 계층 — 짙은 네이비 기반
  'bg-0': '#070B14',   // 최심층 배경 (앱 전체)
  'bg-1': '#0D1421',   // 패널 배경
  'bg-2': '#131B2E',   // 카드/섹션 배경
  'bg-3': '#1A2540',   // 호버/포커스 상태

  // 글래스모피즘 오버레이
  'glass': 'rgba(255, 255, 255, 0.04)',
  'glass-border': 'rgba(255, 255, 255, 0.08)',

  // 액션 색상
  accent: '#3B82F6',       // 주요 강조 (파란색)
  'accent-hover': '#2563EB',
  'accent-muted': 'rgba(59, 130, 246, 0.15)',

  // 상태 색상
  danger: '#EF4444',        // 위험 / 거부
  'danger-muted': 'rgba(239, 68, 68, 0.15)',
  warning: '#F59E0B',       // 경고 / 게이트 대기
  'warning-muted': 'rgba(245, 158, 11, 0.15)',
  ok: '#10B981',            // 성공 / 허용
  'ok-muted': 'rgba(16, 185, 129, 0.15)',
  info: '#6366F1',          // 정보 / 실행 중

  // 텍스트 계층
  'text-primary': '#F1F5F9',   // 주요 텍스트
  'text-secondary': '#94A3B8', // 보조 텍스트
  'text-muted': '#475569',     // 비활성 텍스트
  'text-accent': '#93C5FD',    // 강조 텍스트

  // 에이전트 색상 (9개 에이전트 식별)
  'agent-orchestrator': '#A855F7', // 보라
  'agent-spec': '#06B6D4',         // 청록
  'agent-policy': '#EF4444',       // 빨강
  'agent-planner': '#3B82F6',      // 파랑
  'agent-codegen': '#10B981',      // 초록
  'agent-review': '#F59E0B',       // 노랑
  'agent-test': '#8B5CF6',         // 연보라
  'agent-executor': '#F97316',     // 주황
  'agent-rollback': '#64748B',     // 회색

  // 위험도 색상
  'risk-critical': '#EF4444',
  'risk-high': '#F97316',
  'risk-medium': '#F59E0B',
  'risk-low': '#10B981',
} as const;

/** 폰트 설정 */
const JARVIS_FONTS = {
  // UI 텍스트 — Inter (영문) + Pretendard (한글)
  sans: ['Inter', 'Pretendard', 'system-ui', 'sans-serif'],
  // 코드/로그/ID 표시
  mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
} as const;

/** 레이아웃 설정 (3-panel: 28% / 44% / 28%) */
const JARVIS_LAYOUT = {
  // 패널 너비
  'panel-left': '28%',
  'panel-center': '44%',
  'panel-right': '28%',

  // 헤더/푸터 높이
  'header-h': '48px',
  'footer-h': '32px',

  // 카드/컴포넌트 반경
  'radius-sm': '8px',
  'radius-md': '12px',
  'radius-lg': '16px',
  'radius-xl': '20px',
} as const;

// ─────────────────────────────────────────
// Tailwind 설정 객체
// ─────────────────────────────────────────

const config: Config = {
  // Tailwind가 스캔할 파일 경로
  content: [
    './src/**/*.{ts,tsx}',
    './index.html',
  ],

  theme: {
    extend: {
      // 색상 토큰 주입
      colors: JARVIS_COLORS,

      // 폰트 패밀리
      fontFamily: JARVIS_FONTS,

      // 레이아웃 너비
      width: {
        'panel-left': JARVIS_LAYOUT['panel-left'],
        'panel-center': JARVIS_LAYOUT['panel-center'],
        'panel-right': JARVIS_LAYOUT['panel-right'],
      },

      // 높이 토큰
      height: {
        header: JARVIS_LAYOUT['header-h'],
        footer: JARVIS_LAYOUT['footer-h'],
      },

      // 모서리 반경
      borderRadius: {
        jarvis: JARVIS_LAYOUT['radius-md'],
        'jarvis-lg': JARVIS_LAYOUT['radius-lg'],
        'jarvis-xl': JARVIS_LAYOUT['radius-xl'],
      },

      // 글래스모피즘 배경 블러
      backdropBlur: {
        glass: '12px',
        'glass-strong': '24px',
      },

      // 박스 섀도우 — 글로우 이펙트
      boxShadow: {
        'glow-accent': '0 0 20px rgba(59, 130, 246, 0.3)',
        'glow-danger': '0 0 20px rgba(239, 68, 68, 0.3)',
        'glow-ok': '0 0 20px rgba(16, 185, 129, 0.3)',
        'glow-warning': '0 0 20px rgba(245, 158, 11, 0.3)',
        glass: '0 4px 24px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.06)',
        panel: '0 8px 32px rgba(0, 0, 0, 0.6)',
      },

      // 애니메이션 설정 (Framer Motion과 병행)
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'gate-appear': 'gateAppear 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
      },

      // 키프레임
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(20px)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        gateAppear: {
          '0%': { transform: 'scale(0.9)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },

      // 그리드 레이아웃 (3-panel)
      gridTemplateColumns: {
        'jarvis-3panel': '28% 44% 28%',
      },
    },
  },

  plugins: [],
};

export default config;
