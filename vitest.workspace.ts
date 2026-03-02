// Vitest 워크스페이스 — 모든 패키지의 테스트를 통합 실행
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/*/vitest.config.ts',
]);
