// vitest 설정 — packages/agents 단위/통합 테스트 환경 정의
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // 테스트 환경: Node.js (브라우저 API 불필요)
    environment: 'node',
    // 테스트 파일 패턴
    include: ['src/**/*.test.ts'],
    // 커버리지 설정
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/index.ts'],
      // 핵심 에이전트 모듈 커버리지 임계값
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
    // 전역 API 자동 주입 비활성화 — 명시적 import 사용
    globals: false,
  },
});
