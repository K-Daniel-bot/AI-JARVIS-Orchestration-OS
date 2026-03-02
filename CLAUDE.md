# JARVIS Orchestration Agent OS

## Project Overview
AI JARVIS Orchestration Agent OS — 데스크톱(Windows/macOS)을 직접 조작하는 9-에이전트 AI 시스템.
정책 기반 게이트, Capability Token 일회성 권한, 불변 감사 로그로 안전하게 동작한다.

**Phase**: 0 (Foundation MVP) — 설계 문서 완료, 구현 시작 단계.

## Tech Stack
- TypeScript (strict mode), React, Tailwind CSS, Framer Motion
- XState v5 (state machine)
- pnpm + Turborepo (monorepo)
- Claude API (Opus 4.6 / Sonnet 4.6 / Haiku 4.5)
- SQLite (audit log), Vitest (test), Playwright (E2E)

## Monorepo Structure
```
packages/
  core/           — XState 상태 머신, 에이전트 타입, 메시지 버스
  policy-engine/  — PolicyDecision, Risk Score, Capability Token 엔진
  audit/          — Immutable append-only 감사 로그 (SQLite)
  agents/         — 에이전트 구현체 (9 에이전트)
  executor/       — Action API, OS 추상화, Enforcement Hook
  web/            — React 대시보드 (3-panel layout, Gate UI)
  cli/            — CLI 진입점
  shared/         — 공유 타입, 스키마, 유틸리티
```

## Critical Commands
```bash
pnpm install                         # 전체 의존성 설치
pnpm build                           # 전체 빌드 (turbo)
pnpm test                            # 전체 테스트 (vitest)
pnpm lint                            # ESLint + TypeScript strict
pnpm dev                             # 개발 서버 시작
pnpm typecheck                       # TypeScript 컴파일러 체크만
turbo run build --filter=core        # 특정 패키지 빌드
turbo run test --filter=policy-engine # 특정 패키지 테스트
```

## Code Style
- 2-space indentation (절대 4-space 아님)
- Named exports only (default export 금지)
- 모든 public 함수에 명시적 return type
- camelCase (변수/함수), PascalCase (타입/컴포넌트), SCREAMING_SNAKE_CASE (상수)
- `any` 타입 사용 금지 — `unknown` + type narrowing 사용
- Zod로 런타임 검증, TypeScript로 컴파일 타임 검증
- Error handling: `Result<T, E>` 패턴 (비즈니스 로직에서 throw 금지)
- 각 패키지 index.ts barrel export

## Testing Standards
- Vitest로 단위/통합 테스트
- 테스트 파일: `*.test.ts` (소스와 같은 디렉토리에 배치)
- 최소 80% coverage 목표 (Phase 1+)
- 외부 서비스 mock 필수 (실제 API 호출 금지)
- Arrange-Act-Assert 패턴

## Git Workflow
- Branch: `feat/`, `fix/`, `refactor/`, `test/`, `docs/`
- Conventional commits: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- 커밋 전 필수: typecheck, lint, test 통과 확인
- PR 필수 (main 브랜치 직접 푸시 금지)

## Architecture Principles
1. **Single Execution Path** — Executor 에이전트만 OS 조작
2. **One-Time Capability** — 토큰은 1회 사용 후 즉시 무효화
3. **Mandatory Gate** — 위험 작업은 반드시 사용자 승인 필요
4. **Policy-First** — 계약서(contract.md) 규칙이 모든 AI 판단보다 우선
5. **Immutable Audit** — Append-only 로그, 해시 체인 무결성

## Agent System (9 Agents)
| Agent        | Model      | Role                        |
|-------------|------------|------------------------------|
| orchestrator | Opus 4.6  | 흐름 제어, 복잡도 분류       |
| spec-agent   | Haiku 4.5 | 의도 분석, 요구사항 명세     |
| policy-risk  | Opus 4.6  | 정책 판정, 위험도, Capability |
| planner      | Sonnet 4.6| 작업 분해(WBS), Task DAG     |
| codegen      | Sonnet 4.6| 코드 생성, ChangeSet          |
| review       | Sonnet 4.6| 보안 검토, 코드 품질          |
| test-build   | Haiku 4.5 | 테스트 실행, 빌드 검증        |
| executor     | Sonnet 4.6| OS 조작, Action API           |
| rollback     | Haiku 4.5 | 롤백, Postmortem              |

## State Machine Flow
```
IDLE → SPEC_ANALYSIS → POLICY_CHECK → PLANNING
  → [Gate L1: 계획 승인]
  → CODE_GENERATION → CODE_REVIEW
  → [Gate L2: 변경 승인]
  → TESTING → DEPLOYMENT
  → [Gate L3: 실행/배포 승인]
  → COMPLETED / ROLLED_BACK
```

## Key Design Docs
- `.claude/contract.md` — 모든 에이전트 절대 규칙
- `.claude/workflow.md` — 시스템 설계 인덱스
- `.claude/schemas/` — JSON 스키마 (state-machine, action-api, capability-token, policy-decision, audit-log)
- `.claude/design/` — 아키텍처, 보안, UI/UX 상세 설계
- `.claude/roadmap.md` — Phase 0~3 구현 로드맵

## When to Use Which Agent
- 요구사항 분석: @spec-agent
- 보안/정책 질문: @policy-risk
- 아키텍처 계획: @planner
- 코드 구현: @codegen
- 코드 리뷰: @review
- 테스트/빌드: @test-build
- OS 조작: @executor (반드시 orchestrator 경유)
- 에러 복구: @rollback
- 멀티스텝 오케스트레이션: @orchestrator
