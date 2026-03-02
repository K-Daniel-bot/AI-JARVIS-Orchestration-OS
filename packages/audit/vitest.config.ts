// Vitest 설정 — @jarvis/audit 패키지 단위 테스트 환경
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 테스트 환경: Node.js (SQLite, 파일 시스템 접근 필요)
    environment: 'node',
    // 커버리지 리포트 설정 — 핵심 경로(해시 체인, 감사 로그) 95%+ 목표
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'dist'],
      // 핵심 경로 커버리지 임계값 설정
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
    // 전역 expect 등 자동 주입 비활성화 (명시적 import 사용)
    globals: false,
  },
});
