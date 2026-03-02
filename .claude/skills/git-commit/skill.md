---
name: git-commit
description: "커밋 생성 워크플로우. 변경 확인→검증→스테이징→커밋 메시지 작성→커밋까지 전 과정 처리."
user-invocable: true
---

# 커밋 생성

## 사용 시점
- 코드 변경 후 커밋 생성
- 기능 구현 완료 후 기록
- 버그 수정 후 기록

## 절차

1. 변경 상태 확인
   - `git status`로 변경/추가/삭제 파일 확인
   - `git diff`로 변경 내용 상세 검토
   - 의도하지 않은 변경 없는지 확인

2. 사전 검증
   - `pnpm typecheck` — 타입 에러 없음 확인
   - `pnpm lint` — 린트 에러 없음 확인
   - `pnpm test` — 테스트 통과 확인
   - 하나라도 실패 시 커밋 중단, 원인 수정 후 재시도

3. 보안 검사
   - 스테이징 파일에 secrets 포함 여부 확인
   - `.env`, 토큰, API 키, 비밀번호 하드코딩 검사
   - 발견 시 해당 파일 unstage 후 `.gitignore`에 추가

4. 스테이징
   - 관련 파일만 선택적으로 `git add` (전체 add 금지)
   - 무관한 파일이 섞이지 않도록 확인
   - 하나의 커밋 = 하나의 논리적 변경 원칙

5. 커밋 메시지 작성
   - `.claude/rules/git-workflow.md` 형식 준수
   - 형식: `<타입>(<범위>): <제목>`
   - 타입: feat, fix, refactor, test, docs, chore
   - 범위: core, policy-engine, audit, agents, executor, web, cli, shared
   - 제목: 50자 이내, 명령형, 한글 허용
   - 본문: 왜 변경했는지 설명 (선택)

6. 커밋 실행
   - `git commit -m "메시지"`
   - 커밋 후 `git log --oneline -5`로 확인
   - 커밋 해시 기록
