---
name: code-review
description: "코드 리뷰 수행. PR 또는 변경된 파일의 보안/품질/아키텍처 검토에 사용."
user-invocable: true
---

# Code Review

## 사용 시점
- PR 머지 전 코드 리뷰
- Codegen이 생성한 ChangeSet 검토
- Gate L2 (변경 승인) 전 품질 검증
- 아키텍처 결정 리뷰

## 절차

1. 변경 범위 파악
   - 변경된 파일 목록 확인
   - 변경 유형 분류 (신규/수정/삭제)
   - 관련 SPEC.md 또는 PLAN.json 확인

2. 보안 리뷰 (우선 검사)
   - Secrets 하드코딩 여부
   - 사용자 입력 검증 누락
   - 권한 검사 누락
   - 위험 함수 사용 (eval, exec, dynamic import)
   - `.claude/contract.md` 절대 금지사항 위반 여부

3. 타입 안전성
   - `any` 타입 사용 여부
   - null/undefined 처리 누락
   - 타입 assertion 남용 (`as` 키워드)
   - Zod 스키마 검증 누락

4. 코드 품질
   - 함수 크기 (20줄 초과 시 분리 검토)
   - 중복 코드 (DRY 위반)
   - 복잡도 (deep nesting, long chain)
   - 네이밍 명확성
   - 에러 처리 누락 (Result 패턴 미적용)

5. 아키텍처 일관성
   - 기존 패턴 준수 여부
   - 에이전트 역할 경계 위반 여부
   - 감사 로그 생성 여부 (에이전트 작업 시)
   - XState 상태 전이 규칙 준수

6. 테스트 커버리지
   - 신규 코드에 대한 테스트 존재 여부
   - 테스트 품질 (Happy path만 있는지, Edge case 포함 여부)
   - Mock 적절성

7. 리뷰 판정 출력
   ```
   APPROVE  — 모든 항목 통과, 머지 가능
   COMMENT  — 개선 제안 있으나 머지 가능
   REQUEST_CHANGES — 필수 수정 항목 존재 (목록 제시)
   BLOCK    — 보안/계약 위반, 즉시 중단
   ```
   - 각 항목: 파일:라인 + 문제 설명 + 개선 방법 제시
