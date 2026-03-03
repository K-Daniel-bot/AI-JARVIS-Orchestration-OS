---
name: security-check
description: "보안 감사 실행. Gate L2 전 또는 온디맨드 보안 체크에 사용."
user-invocable: true
---
# 보안 검색

## 사용 시점

- Gate L2 (변경 승인) 전 보안 감사
- 새 의존성 추가 시 리뷰
- 인증/보안 관련 코드 수정 시
- 온디맨드 보안 감사 요청

## 절차

1. 대상 파일 읽기 (미지정 시 `packages/` 전체)
2. 보안 체크리스트 검사:
   - Secrets 노출 (API 키, 토큰, 비밀번호 하드코딩)
   - Path traversal (사용자 입력이 파일 경로에 사용)
   - RCE 위험 (eval, exec, child_process)
   - SQL/NoSQL injection
   - XSS (미sanitize된 사용자 입력)
   - 권한 상승 패턴
   - 무단 텔레메트리/애널리틱스
   - 패키지 라이선스 호환성
   - 인증/인가 누락
   - 에러 정보 유출
3. `.claude/contract.md` 절대 금지사항 대조
4. `pnpm lint` 정적 분석 실행
5. `npx tsc --noEmit` 타입 안전성 검증
6. 보안 리포트 생성:
   - **BLOCKERS**: 진행 전 반드시 수정
   - **WARNINGS**: 권장 수정
   - **Risk Score**: 0-100 (5차원 모델)
