---
globs: "**"
description: "모든 파일 작업 시 자동 적용되는 Git 워크플로우 규칙"
---

# Git 워크플로우 규칙

## 브랜치 네이밍
```
feat/<설명>       — 새 기능
fix/<설명>        — 버그 수정
refactor/<설명>   — 리팩토링
test/<설명>       — 테스트 추가/수정
docs/<설명>       — 문서 변경
chore/<설명>      — 설정, 의존성, 빌드 등
```
- 설명은 영문 소문자, 하이픈 구분 (예: `feat/xstate-state-machine`)
- main 브랜치에 직접 커밋 금지

## 커밋 메시지 형식
```
<타입>(<범위>): <제목>

<본문 — 선택>

<꼬리말 — 선택>
```

### 타입
- `feat`: 새 기능
- `fix`: 버그 수정
- `refactor`: 동작 변경 없는 코드 개선
- `test`: 테스트 추가/수정
- `docs`: 문서 변경
- `chore`: 설정, 의존성, 빌드

### 범위 (해당 패키지명)
- `core`, `policy-engine`, `audit`, `agents`, `executor`, `web`, `cli`, `shared`

### 규칙
- 제목: 50자 이내, 마침표 없음, 명령형 (예: "추가", "수정", "제거")
- 본문: 72자 줄바꿈, **왜** 변경했는지 설명
- 꼬리말: `Fixes #이슈번호`, `BREAKING CHANGE:` 등
- 제목은 한글 허용 (예: `feat(core): XState 상태 머신 초기 구현`)

### 예시
```
feat(core): XState 상태 머신 초기 구현

15개 상태와 전이 규칙을 XState v5로 정의.
IDLE → SPEC_ANALYSIS → POLICY_CHECK 흐름 구현.

Fixes #12
```

## 커밋 전 필수 확인
1. `pnpm typecheck` 통과
2. `pnpm lint` 통과
3. `pnpm test` 통과
4. 스테이징된 파일에 secrets(.env, 토큰, 비밀번호) 없음 확인

## PR 규칙
- PR 제목: 커밋 메시지와 동일한 형식
- PR 본문: 변경 요약 + 테스트 계획 필수
- 리뷰어 1명 이상 승인 필수 (자동 머지 금지)
- CI 통과 필수 (typecheck + lint + test)

## 금지 사항
- `git push --force` (main 브랜치)
- `git reset --hard` (공유 브랜치)
- `.env`, 자격증명 파일 커밋
- 대용량 바이너리 커밋 (10MB 초과)
