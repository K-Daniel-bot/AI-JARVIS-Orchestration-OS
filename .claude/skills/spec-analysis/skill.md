---
name: spec-analysis
description: "요구사항 분석 및 명세 작성. 사용자 요청을 구조화된 SPEC.md로 변환에 사용."
user-invocable: true
---

# Spec Analysis

## 사용 시점
- 새로운 기능 요청 분석
- 사용자 요청을 형식화된 요구사항으로 변환
- 버그 리포트의 근본 원인 규명
- 모호한 요청의 명확화

## 절차

1. 요청 읽기 및 의도 파악
   - 사용자 요청 또는 버그 리포트 분석
   - 숨겨진 요구사항 식별
   - 외부 리소스/API 필요 여부 판별

2. 모호성 식별 및 명확화
   - 불명확한 부분 질문
   - 우선순위 확인
   - 제약조건/경계 정의

3. 의도 분류
   - 타입: feature / bug fix / refactoring / documentation
   - 영역: core / policy-engine / agents / web / executor
   - 복잡도: L1 (단순) / L2 (보통) / L3 (복잡) / L4 (위험)

4. SPEC.md 생성
   - 요약 (1-3문장)
   - 상세 요구사항 (번호 목록)
   - 제약조건/경계
   - 성공 기준 (테스트 가능)
   - 추정 위험도 (낮음/보통/높음)

5. 외부 리소스 식별
   - 필요한 패키지 나열
   - API 호출 필요 여부
   - 권한/토큰 요구사항
