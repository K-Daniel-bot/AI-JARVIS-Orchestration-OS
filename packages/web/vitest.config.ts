// vitest 테스트 설정 — web 패키지 (Node 환경, API 레이어 전용)
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
