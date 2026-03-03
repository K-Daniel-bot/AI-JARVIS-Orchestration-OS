---
globs: "**/*.test.ts,**/*.spec.ts"
description: "테스트 코드 표준 및 패턴"
---
# 테스트 표준

## 테스트 구조

- describe/it 블록에 명확하고 읽기 쉬운 이름 사용
- 테스트명은 동작 설명: "should reject invalid capability token"
- Arrange-Act-Assert 패턴
- 테스트당 하나의 assertion (집중된 테스트 선호)

## 모킹

- 외부 서비스 mock (Claude API, OS 호출, SQLite)
- 테스트 가능한 코드를 위해 의존성 주입 사용
- 단위 테스트에서 실제 API 호출 금지
- vitest.mock()으로 모듈 모킹

## 커버리지

- 목표: 80% statement coverage (Phase 1+)
- 핵심 경로 (policy engine, capability token, audit log): 95%+ 필수
- vitest --coverage로 커버리지 리포트 생성

## 테스트 카테고리

- Unit: 격리된 함수/클래스 테스트 (빠름, I/O 없음)
- Integration: 멀티모듈 테스트 (in-memory SQLite 사용 가능)
- E2E: 전체 파이프라인 테스트 (Spec → Policy → Plan → Code → Review → Test)
- Security: injection, traversal, secrets 노출 대상 테스트

## 에이전트별 테스트 요구사항

- 각 에이전트 구현체 테스트 필수 항목:
  - Happy path (정상 입력 → 기대 출력)
  - Error handling (잘못된 입력 → graceful error)
  - Boundary conditions (엣지 케이스)
  - Schema validation (출력이 JSON 스키마 준수)
  - Contract compliance (금지 행동 미수행)
