---
name: deploy-gate
description: "배포 전 통합 검증. Gate L2/L3 체크포인트에서 변경 적용 전 사용."
user-invocable: true
---

# Deploy Gate

## 사용 시점
- ChangeSet을 코드베이스에 적용하기 전
- PR 머지 전
- Gate L2 (변경 승인) 및 Gate L3 (배포 승인) 체크포인트

## 절차

1. ChangeSet 구조 검증:
   - 모든 파일이 허용된 쓰기 범위 내
   - deny 경로 (Windows/**, System/**, AppData/**) 미포함
   - 각 파일 변경이 독립적으로 revert 가능
2. /build-verify 스킬 실행
3. /security-check 스킬 실행
4. Diff 요약 생성:
   - 추가/수정/삭제 파일 수
   - 변경 라인 수
   - 추가/제거된 의존성
5. 위험 평가:
   - 5차원 리스크 스코어링
   - 고위험 변경 식별 (인증, 네트워크, 파일 삭제)
6. 게이트 승인 요약:
   - 종합 판정: PASS / NEEDS_REVIEW / BLOCK
   - 사용자 주의 항목
   - 롤백 계획 (단계별 rollback_actions)
7. 승인 또는 거부 대기
