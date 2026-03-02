// Vitest 설정 — @jarvis/policy-engine 패키지 단위 테스트 환경
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 테스트 환경: Node.js
    environment: 'node',
    // 커버리지 리포트 설정
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules', 'dist'],
      // 정책 엔진 핵심 경로는 95% 이상 커버리지 필수
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
    // 전역 expect 등 자동 주입
    globals: false,
  },
});
