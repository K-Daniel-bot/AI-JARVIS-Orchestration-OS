# JARVIS OS 구현 로드맵

> 참고: `.claude/reports/claude-only-architecture.md` 및 `.claude/reports/multi-model-architecture-report.md` 상세 분석 참조

---

## 로드맵 개요

JARVIS OS 구현은 4단계로 진행합니다. 각 Phase는 독립적으로 동작하며 누적됩니다.

```
Phase 0 (MVP)            2-3주    Sonnet + Haiku
        ↓
Phase 1 (보안 강화)       1주     + Opus
        ↓
Phase 2 (비용 최적화)     2주     + Batch API + Caching
        ↓
Phase 3 (멀티모달)       선택     + Gemini (필요시)
```

---

## Phase 0: 최소 동작 시스템 (2-3주)

**목표**: 완전히 동작하는 5개 에이전트 핵심 팀 완성

### 구성

| 에이전트 | 모델 |
|----------|------|
| Orchestrator | Sonnet 4.6 |
| Spec Agent | Haiku 4.5 |
| Policy/Risk Agent | Sonnet 4.6 |
| Planner | Sonnet 4.6 |
| Codegen | Sonnet 4.6 |
| OS Executor | Sonnet 4.6 |

### 주요 구현 항목

**1. 기반 인프라 (1주)**

- Claude SDK 통합 (Anthropic Python SDK)
- XState v5 상태 머신 구현
- 감사 로그 시스템 (SQLite)
- Capability Token 엔진
- 정책 엔진 (JSON 기반 규칙)

**2. 핵심 에이전트 구현 (2주)**

- **Orchestrator**
  - 복잡도 분류기 (Complexity Classifier)
  - 에이전트 라우팅 로직
  - Task DAG 생성
  - 모델 배정 전략 (MODEL_ASSIGNMENT.json)
- **Spec Agent**
  - 요구사항 파싱
  - 스펙 문서 생성
  - 의도 분석
- **Policy/Risk Agent**
  - Risk Score 계산 (5가지 차원)
  - 정책 판정 (Allow/Deny/NeedApproval)
  - Capability Token 발급
- **Planner**
  - 작업 분해 (WBS)
  - 의존성 그래프 생성
  - 예상 비용 계산
- **Codegen**
  - 코드 생성 (단순 구현 위주)
  - 파일 생성/수정
  - 임시 에러 처리
- **Executor**
  - Tool/Function Call 처리
  - OS 추상화 API 호출
  - 결과 로깅
  - Capability Token 소비

**3. 검증 및 테스트 (최종 1주)**

- 통합 테스트 (5개 에이전트 워크플로우)
- 감사 로그 검증
- 기본 시나리오 (hello.txt 수정)
- 에러 복구 테스트

### Phase 0 출력물

- [x] 동작하는 에이전트 팀 (CLI 기반)
- [x] 감사 로그 기록 (hello.txt 수정 기록)
- [x] Policy Enforcement 게이트 (L1 승인)
- [x] Capability Token 시스템
- [x] .claude/workflow.md + .claude/claude.md

**월 예상 비용: $800 ~ $1,200**

---

## Phase 1: 보안 강화 및 Review 분리 (1주)

**목표**: Opus 기반 깊은 보안 검증 + Review 에이전트 분리

### 추가 구현

**1. Policy/Risk Agent 업그레이드**

- Model: Sonnet -> Opus 4.6
- Extended Thinking 활용 (복잡한 정책 분석)
- 미묘한 보안 이슈 포착
  - Async 버그, dispose 누락, race condition
- "다른 모델이 놓치는 것" 포착 능력 추가
- Risk Score 정확도 향상

**2. Review Agent 분리 (Code Quality)**

- Model: Sonnet 4.6
- 정적 분석 (Linting, 타입 검사)
- 코드 품질 메트릭
- 아키텍처 일관성 검증
- Performance 안티패턴 감지

**3. 테스트 자동화 개선**

- Test Agent (Haiku 4.5)로 테스트 케이스 생성
- 커버리지 목표 설정 (>80%)
- 회귀 테스트 자동화

### Phase 1 효과

- 보안 결함 80% 감소
- 코드 품질 평가 자동화
- 2주 내 Review/Recovery 분리로 안정성 급상승
- 실수 가능 작업 감소

**월 예상 비용: $1,000 ~ $1,500 (+$200~300)**

---

## Phase 2: 비용 최적화 (2주)

**목표**: Batch API + Prompt Caching으로 50% 이상 비용 절감

### 구현

**1. Batch API 통합**

- 작업 우선순위 분류
  - Realtime (즉시): 10% (사용자 요청)
  - Batch (24h): 90% (스케줄/백그라운드)
- Batch 큐 관리
- 배치 작업 모니터링
- 결과 후처리

```python
@dataclass
class Task:
    priority: Literal["realtime", "batch"]

if task.priority == "batch":
    # Batch API 50% 할인 적용
    cost *= 0.5
```

**2. Prompt Caching 활용**

- 캐시 키 전략 설계
  - 코드베이스 = 캐시 키
  - 정책 문서 = 캐시 키
  - 테스트 케이스 = 캐시 키
- 캐시 TTL 설정
- 캐시 히트율 모니터링
- 캐시 주기 최적화

> 효과 예시: 5개 에이전트가 같은 코드 분석 시
> - 미적용: 입력 비용 5회 = $5
> - 적용: 입력 1회 + 4회(90% 할인) = $1.40
> - **절감: 72%**

**3. 모니터링 대시보드**

- 에이전트별 비용 추적
- 모델별 사용량 분석
- Batch API 절감액 시각화
- Caching 히트율 추적
- 월별 비용 추이

### Phase 2 효과

- 월 비용 50% 절감 (1,000 -> 500달러 기준)
- Batch API + Caching의 장점 극대화
- 대규모 운영 준비 (월 1000+ 에이전트 실행 가능)

**최종 월 비용: $300 ~ $800 (50% 절감)**

---

## Phase 3: 멀티모달 확장 (선택사항)

**목표**: Gemini 기반 Vision/Voice 에이전트 추가 (JARVIS 비전 확장)

### 필요한 경우

- 블렌더 VFX 조작 (Vision)
- 음성 명령 인식 (Voice)
- 대규모 코드베이스 (1M 컨텍스트)

> 선택사항: Phase 0~2 완성 후 평가

### 추가 에이전트

**1. Vision Agent (Gemini 2.5 Pro)**

- 블렌더 화면 분석
- 이미지 생성 및 변환
- UI 요소 인식
- VFX 모니터링

**2. Voice Agent (Gemini 2.5 Flash)**

- 음성 명령 인식
- 음성 응답 생성
- 음성 문서 분석
- 실시간 음성 처리

**3. Large Codebase Agent (Gemini 2.5 Pro)**

- 1M 토큰으로 전체 프로젝트 분석
- 의존성 그래프 생성
- 아키텍처 제안
- 성능 병목 분석

### Phase 3 비용

```
기존: $300~800/월 (Claude만)
추가: +$200~300/월 (Gemini)
─────────────────────────
합계: $500~1,100/월 (여전히 저렴)
```

---

## Phase별 비용 및 일정 요약

| Phase | 기간 | 에이전트 | 월 비용 | 누적 개발시간 |
|-------|------|----------|---------|---------------|
| 0: MVP | 2-3주 | 5개 | $800~1,200 | 2-3주 |
| 1: 보안 | +1주 | +2개 (Review) | $1,000~1,500 (+$200) | 3-4주 |
| 2: 최적화 | +2주 | (변화없음) | $300~800 (-50%) | 5-6주 |
| 3: 멀티모달 (선택) | +2주 (선택) | +3개 (Vision) | $500~1,100 (+$200) | 7-8주 (선택사항) |

---

## 각 Phase의 핵심 체크리스트

### Phase 0 완료 기준

- [ ] 5개 에이전트가 독립적으로 동작 (각각 테스트)
- [ ] Orchestrator가 에이전트 팀 호출 및 상태 관리 가능
- [ ] 감사 로그가 모든 작업 기록 (누구/뭐/결과/시간)
- [ ] Policy/Risk 게이트가 승인 로직으로 동작
- [ ] Capability Token이 1회성으로 소비됨
- [ ] hello.txt 수정 워크플로우 완전 자동화
- [ ] 롤백 테스트 성공 (실패 시 원상복구)

### Phase 1 완료 기준

- [ ] Opus 기반 Policy/Risk가 미묘한 보안 이슈 포착
- [ ] Review Agent가 코드 품질 메트릭 제공
- [ ] 테스트 에이전트가 테스트 케이스 자동 생성
- [ ] 통합 워크플로우 (Spec -> Policy -> Plan -> Code -> Review -> Test)
- [ ] 월 에러율 < 1% (보안 검증)

### Phase 2 완료 기준

- [ ] Batch API 통합 (50% 할인 적용)
- [ ] Prompt Caching 운영 (캐시 히트율 > 70%)
- [ ] 비용 모니터링 대시보드 (월별 추이)
- [ ] 월 비용 50% 이상 절감 확인
- [ ] 대규모 운영 테스트 (월 1000+ 작업)

### Phase 3 완료 기준 (선택사항)

- [ ] Gemini Vision이 블렌더 화면 분석 가능
- [ ] Gemini Voice가 음성 명령 인식/응답
- [ ] 1M 컨텍스트로 대형 프로젝트 분석
- [ ] 통합된 멀티모달 워크플로우
- [ ] 각 모달리티별 벤치마크 (정확도/속도)

---

## 구현 팁

### Anthropic Claude 최적화

**1. Extended Thinking (Opus만)**

- 복잡한 정책/보안 판정에만 사용
- 간단한 작업에는 비활성화 (비용 절감)
- thinking_budget 설정: 10,000~50,000 tokens

**2. Prompt Caching 효율화**

- workflow.md는 캐시 가능 토큰으로 변환
- 정책 문서도 캐시 (매주 업데이트)
- 사용자별 프로필도 캐시
- 캐시 TTL = 5분 (자주 업데이트할 경우)

**3. Batch API 활용**

- 매시간 Batch 작업 큐 실행
- 우선순위: Realtime 10% / Batch 90%
- Batch 완료 후 비동기 콜백 (Notion 업데이트)
- 실시간 응답 필요 시에만 Express API 사용

**4. .claude/claude.md (150줄 제한)**

- 핵심 신원만 기술
- 복잡한 규칙은 정책 문서로 분리
- 모델 주의: 긴 claude.md = 성능 저하
- 보이스 가이드보다 짧게 간결하게

### 에이전트별 프롬프트 구조

```
각 에이전트의 system prompt 템플릿:

You are {Agent Name} for JARVIS OS

Your role:
- {역할 설명}

Your constraints:
- {금지사항}
- Always log to audit trail
- Never exceed Capability Token scope
- Fail safely: return error, don't guess

Your tools:
- {사용 가능한 도구}

Your output format:
{구조화된 JSON}
```

---

## 예상 타임라인

| 주차 | 작업 내용 |
|------|----------|
| **Week 1-2** | 기반 인프라 구축: Claude SDK 통합, XState 상태 머신, 감사 로그 시스템, 정책 엔진 |
| **Week 3-4** | Orchestrator + Spec Agent: 복잡도 분류기, 에이전트 라우팅, 요구사항 분석 |
| **Week 5-6** | Policy/Risk + Planner + Codegen + Executor: 정책 판정 엔진, 작업 계획 분해, 코드 생성, OS 추상화 API |
| **Week 7** | 통합 테스트 + Phase 0 완료: 엔드-투-엔드 워크플로우, 감사 로그 검증, 배포 준비 |
| **Week 8** | Phase 1 (Opus + Review): Policy/Risk 업그레이드, Review Agent 분리, 보안 검증 강화 |
| **Week 9-10** | Phase 2 (Batch API + Caching): Batch API 통합, Prompt Caching 운영, 비용 모니터링 |
| **Week 11+** | Phase 3 (선택사항): Gemini 통합, 멀티모달 에이전트, 성능 최적화 |

---

## 단일 vs 멀티 모델 비교

> 더 자세한 분석은 `.claude/reports/multi-model-architecture-report.md` 참조

| 구분 | Claude 단일 | 멀티 모델 (Gemini+Codex) |
|------|-------------|--------------------------|
| 구현 복잡도 | 매우 낮음 | 높음 |
| 초기 개발시간 | 2-3주 | 5-6주 |
| 통합 난이도 | 쉬움 | 어려움 |
| API 키 관리 | 1개 | 3-4개 |
| 월 기본 비용 | $800~1,200 | $400~1,200 |
| 최적화 후 비용 | $300~800 (-50%) | $400~700 |
| 성능 차이 | 거의 없음 | 3~5% (대형 작업) |
| 벤더 락인 | 중간 | 낮음 (유연) |
| 추천 상황 | MVP/중소규모 | 대규모/특수 작업 |

> **권장**: Phase 0-2는 Claude 단일로 진행. Phase 3에서 필요시만 Gemini 추가
