---
name: build-verify
description: "빌드-테스트-린트 파이프라인 실행. 코드 변경 후 또는 PR 전 검증에 사용."
user-invocable: true
---
# 빌드 확인

## 사용 시점

- 코드 생성/수정 후
- PR 생성 전
- 의존성 변경 후
- CI/CD 검증

## 절차

1. `pnpm typecheck` 실행 (TypeScript strict 컴파일)
   - 실패 시: 에러 파싱, 파일/라인 식별, 리포트
2. `pnpm lint` 실행 (ESLint)
   - 에러 = 실패, 경고 = 기록
3. `pnpm test` 실행 (Vitest)
   - 결과 파싱 (passed/failed/skipped)
   - 실패 시: 테스트명, 에러 메시지, 파일:라인 식별
4. `pnpm test -- --coverage` 실행 (커버리지 설정 존재 시)
   - 커버리지 보고 (statements, branches, functions, lines)
   - 80% 미만 시 경고
5. TEST_REPORT 생성:
   - 빌드 상태, 린트 결과, 테스트 결과, 커버리지, 실패 분석
6. 실패 시 근본 원인 분석 및 수정 제안
