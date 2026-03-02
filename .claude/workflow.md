# AI JARVIS 오케스트레이션 에이전트 OS — 설계 인덱스

> **이 파일은 인덱스입니다.** 상세 설계는 하위 디렉토리에 분리되어 있습니다.
> 각 에이전트는 자신의 Bundle 파일만 읽으면 100% 필요한 정보를 얻을 수 있습니다.

---

## 프로젝트 개요

AI JARVIS Orchestration Agent OS는 컴퓨터(Windows/macOS)를 직접 조작하는 AI 에이전트 시스템입니다.

**핵심 원칙:**

- 사용자 안전 최우선 (계약서 기반 정책 레이어)
- 모든 OS 조작은 Executor 에이전트 단일 경로
- Capability Token 일회성 권한 시스템
- 불변 감사 로그 (append-only)
- 7+ 승인 게이트 (사용자 통제)

**정책 레이어 3단:**

1. Policy Source — 계약서/금지목록 로드
2. Decision — 허용/거부/승인 필요 판정
3. Enforcement — OS 조작 직전 강제 차단

---

## 파일 구조 맵

### 공통 계약 (모든 에이전트가 참조)

- `contract.md` — 절대 금지사항, Capability 규칙, 감사 로그, 신뢰 모드, 에이전트 간 프로토콜

### 에이전트 Bundle (Self-Contained, 각 에이전트에 1:1 매핑)

| 파일                       | 에이전트     | 모델       | 역할                                    |
| -------------------------- | ------------ | ---------- | --------------------------------------- |
| `agents/orchestrator.md` | Orchestrator | Opus 4.6   | 흐름 제어, 복잡도 분류, 모델 배정       |
| `agents/spec-agent.md`   | Spec Agent   | Haiku 4.5  | 의도 분석, 요구사항 명세                |
| `agents/policy-risk.md`  | Policy/Risk  | Opus 4.6   | 정책 판정, 위험도 평가, Capability 발급 |
| `agents/planner.md`      | Planner      | Sonnet 4.6 | 작업 분해(WBS), Task DAG, 예산 계산     |
| `agents/codegen.md`      | Codegen      | Sonnet 4.6 | 코드 생성/수정, ChangeSet 생성          |
| `agents/review.md`       | Review       | Sonnet 4.6 | 보안 검토, 코드 품질 평가               |
| `agents/test-build.md`   | Test/Build   | Haiku 4.5  | 테스트 실행, 빌드 검증, 실패 분석       |
| `agents/executor.md`     | Executor     | Sonnet 4.6 | OS 조작 유일 주체, Action API           |
| `agents/rollback.md`     | Rollback     | Haiku 4.5  | 롤백 실행, Postmortem 생성              |

### 스키마 (JSON 표준 정의)

| 파일                              | 내용                                      |
| --------------------------------- | ----------------------------------------- |
| `schemas/policy-decision.json`  | PolicyDecision 스키마                     |
| `schemas/action-api.json`       | Action 객체 + 액션 유형 + EnforcementHook |
| `schemas/capability-token.json` | Capability Token 발급/소비/검증           |
| `schemas/audit-log.json`        | AuditEntry (불변 감사 로그)               |
| `schemas/state-machine.json`    | XState v5 상태 정의 + 전이 규칙           |

### 설계 참고 문서 (전체 시스템 설계)

| 파일                            | 내용                                                                           |
| ------------------------------- | ------------------------------------------------------------------------------ |
| `design/ui-ux.md`             | 3패널 레이아웃, 게이트 와이어프레임, 디자인 토큰, 접근성, 원격 조작 애니메이션 |
| `design/security-deep.md`     | 자격증명 금고, 웹 보안, 공급망 보안, 프롬프트 주입 방어, DLP                   |
| `design/architecture-deep.md` | 에이전트 통신 프로토콜, 상태 감시, 성능 저하 전략, 체크포인트                  |
| `design/test-scenarios.md`    | Phase 0 통합 테스트 시나리오 5종 (Happy Path, DENY, Gate, 롤백, 비상 중단)     |
| `design/dependencies.md`      | npm 패키지 전체 목록 (버전 고정, 라이선스, 선택 이유, 대안 비교)               |

### 에이전트 System Prompt 템플릿

| 파일                          | 에이전트     | 모델       |
| ----------------------------- | ------------ | ---------- |
| `prompts/orchestrator.md`   | Orchestrator | Opus 4.6   |
| `prompts/spec-agent.md`     | Spec Agent   | Haiku 4.5  |
| `prompts/policy-risk.md`    | Policy/Risk  | Opus 4.6   |
| `prompts/planner.md`        | Planner      | Sonnet 4.6 |
| `prompts/codegen.md`        | Codegen      | Sonnet 4.6 |
| `prompts/review.md`         | Review       | Sonnet 4.6 |
| `prompts/test-build.md`     | Test/Build   | Haiku 4.5  |
| `prompts/executor.md`       | Executor     | Sonnet 4.6 |
| `prompts/rollback.md`       | Rollback     | Haiku 4.5  |

### 보완/확장 문서

| 파일                                  | 내용                                                      |
| ------------------------------------- | --------------------------------------------------------- |
| `supplements/features-A-N.md`       | 보완 기능 A~N (음성 인터페이스, 테스트 프레임워크 등)     |
| `supplements/features-O-AB.md`      | 확장 기능 O~AB + 보완 1~14 (데이터 주권, 가역 시스템 등) |
| `supplements/analysis-scenarios.md` | 심층 분석 보고서 + OPENCLAW 실전 시나리오 3종             |

### 구현 로드맵

| 파일           | 내용                                         |
| -------------- | -------------------------------------------- |
| `roadmap.md` | Phase 0~3 구현 로드맵, 비용/일정, 체크리스트 |

### 분석 보고서

| 파일                                           | 내용                                   |
| ---------------------------------------------- | -------------------------------------- |
| `reports/claude-only-architecture.md`        | Claude 단일 아키텍처 상세 분석         |
| `reports/multi-model-architecture-report.md` | Claude + Codex + Gemini 멀티 모델 분석 |

---

## 핵심 워크플로우 (상태 머신)

```
IDLE → SPEC_ANALYSIS → POLICY_CHECK → PLANNING
  → [Gate L1: 계획/범위 승인]
  → [Gate L1A: 도구/패키지/네트워크 승인] (pkg.install 포함 시)
  → CODE_GENERATION → CODE_REVIEW
  → [Gate L2: 변경 적용 승인]
  → TESTING → DEPLOYMENT
  → [Gate L3: 실행/배포 승인]
  → COMPLETED / ROLLED_BACK
```

**추가 게이트:** Web Precheck, Download Approve, Destructive Op, Safety Hold

---

## 에이전트 라우팅 규칙 (요약)

- 코드 구현 포함 → `Spec → Policy → Planner → Codegen → Review → Test`
- Plan에 `pkg.install` 포함 → Gate L1A 승인 필요
- Codegen이 `secrets` 사용 → Policy에서 deny
- 테스트 실패 → `Test → Planner(수정) → Codegen(패치) → Review → Test`
- OS 조작 필요 → `Executor`만 수행

---

## 복잡도 분류기 (에이전트팀 호출 기준)

| 레벨    | 기준                            | 실행 방식        |
| ------- | ------------------------------- | ---------------- |
| L1 단순 | 파일 1개 수정, 위험도 LOW       | 단일 에이전트    |
| L2 보통 | 파일 2~5개, 패키지 설치 없음    | Codegen + Review |
| L3 복잡 | 파일 5+, 패키지/네트워크 필요   | 전체 에이전트팀  |
| L4 위험 | 외부 서비스, 권한 상승, 다중 앱 | 전체 + 추가 Gate |

---

## 기술 스택

- **AI**: Claude API (Opus 4.6 / Sonnet 4.6 / Haiku 4.5)
- **상태 관리**: XState v5
- **패키지 관리**: pnpm + Turborepo
- **언어**: TypeScript (strict mode)
- **프론트엔드**: React + Tailwind CSS + Framer Motion
- **데이터**: SQLite (감사 로그)
- **API 추상화**: LiteLLM (Phase 3 멀티모델 확장 시)

---

## 빠른 참조

- **에이전트 구현 시**: 해당 `agents/{name}.md` + `contract.md` 읽기
- **스키마 확인 시**: `schemas/{name}.json` 참조
- **UI 구현 시**: `design/ui-ux.md` 참조
- **보안 구현 시**: `design/security-deep.md` + `agents/policy-risk.md` 참조
- **로드맵 확인 시**: `roadmap.md` 참조
- **실전 시나리오 참고**: `supplements/analysis-scenarios.md` 참조
