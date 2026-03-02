---
name: refactoring
description: "코드 리팩토링 계획 및 실행. 기능 변경 없이 코드 구조/가독성/유지보수성 개선에 사용."
user-invocable: true
---

# Refactoring

## 사용 시점
- 중복 코드 제거 (DRY 원칙 적용)
- 함수/클래스 분리 (SRP 적용)
- 복잡한 로직 단순화
- 타입 안전성 강화 (`any` → 정확한 타입)
- 성능 개선 (알고리즘, 불필요한 재렌더 등)

## 절차

1. 대상 코드 분석
   - 대상 파일/함수 읽기
   - 문제 유형 분류:
     - Duplication: 동일 로직 여러 곳에 존재
     - God function: 너무 많은 책임을 가진 함수
     - Magic numbers: 설명 없는 리터럴 값
     - Deep nesting: 3단계 이상 중첩
     - Implicit types: `any` 또는 불명확한 타입
     - Dead code: 사용되지 않는 코드

2. 리팩토링 계획 수립
   - 변경 범위 정의 (파일 목록)
   - 단계별 순서 결정 (의존성 순서 고려)
   - 기능 동등성 보장 방법 명시
   - 각 단계의 롤백 방법 정의

3. 테스트 확인 (리팩토링 전)
   - 기존 테스트 존재 여부 확인
   - 없으면 핵심 동작에 대한 테스트 먼저 작성
   - `pnpm test` 실행하여 현재 상태 기록

4. 리팩토링 실행 (단계별)
   - 한 번에 하나의 변경만 수행
   - 각 단계 후 `pnpm typecheck` + `pnpm test` 실행
   - 기능 동등성 유지 확인
   - 테스트 실패 시 즉시 중단 및 근본 원인 분석

5. 검증
   - 최종 `pnpm build && pnpm test && pnpm lint` 실행
   - 변경된 공개 API 없음 확인
   - 성능 회귀 없음 확인
   - 변경 요약 작성 (what/why/how)
