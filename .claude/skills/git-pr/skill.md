---
name: git-pr
description: "풀 리퀘스트 생성 워크플로우. 브랜치 확인→변경 요약→PR 생성→리뷰 요청까지 처리."
user-invocable: true
---

# 풀 리퀘스트 생성

## 사용 시점
- 기능 구현 완료 후 main 브랜치에 머지 요청
- 버그 수정 완료 후 리뷰 요청
- 리팩토링 완료 후 승인 요청

## 절차

1. 브랜치 상태 확인
   - `git branch` — 현재 브랜치 확인 (main이면 중단)
   - `git status` — 미커밋 변경 없음 확인
   - `git log main..HEAD --oneline` — 포함될 커밋 목록 확인

2. 사전 검증 (전체 파이프라인)
   - `pnpm typecheck` 통과
   - `pnpm lint` 통과
   - `pnpm test` 통과
   - 하나라도 실패 시 PR 생성 중단

3. 원격 푸시
   - `git push -u origin <브랜치명>`
   - 푸시 실패 시 원인 분석 (충돌, 권한 등)

4. PR 본문 작성
   ```markdown
   ## 요약
   - 변경 내용 1-3줄 요약

   ## 변경 사항
   - 추가/수정/삭제된 파일 목록
   - 주요 변경 포인트 설명

   ## 테스트 계획
   - [ ] 단위 테스트 통과
   - [ ] 통합 테스트 통과
   - [ ] 수동 검증 항목 (해당 시)

   ## 관련 이슈
   - Fixes #이슈번호 (해당 시)

   ## 체크리스트
   - [ ] typecheck 통과
   - [ ] lint 통과
   - [ ] test 통과
   - [ ] secrets 미포함 확인
   - [ ] 코드 리뷰 요청
   ```

5. PR 생성
   - `gh pr create --title "<타입>(<범위>): <제목>" --body "본문"`
   - PR 제목: 커밋 메시지와 동일한 형식
   - 라벨 추가 (feat, fix, refactor 등)

6. 리뷰 요청
   - PR URL 기록
   - /code-review 스킬로 셀프 리뷰 수행
   - 리뷰어 지정 (해당 시)
