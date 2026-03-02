# JARVIS OS 멀티 모델 아키텍처 분석 보고서

> 작성일: 2026-03-02
> 목적: Claude 단일 기반 → Claude + Codex + Gemini 멀티 프로바이더 전환 가능성 분석

---

## 1. 현재 아키텍처 (AS-IS)

현재 `workflow.md`에 정의된 에이전트 9종은 **모두 Claude 기반**으로 설계되어 있습니다.

```
| Agent          | 현재 모델 | 역할                    |
|----------------|-----------|-------------------------|
| Orchestrator   | Sonnet    | 흐름 제어, 환경 구성      |
| Spec Agent     | Haiku     | 요구사항/스펙 분석         |
| Policy/Risk    | Haiku     | 계약서/정책 판정           |
| Planner        | Sonnet    | 작업 계획 수립            |
| Codegen        | Opus      | 코드 구현                 |
| Review         | Sonnet    | 정적 검토                 |
| Test/Build     | Haiku     | 검증                     |
| OS Executor    | Sonnet    | OS 조작 (유일한 실행자)    |
| Rollback       | Haiku     | 복구                     |
```

---

## 2. 멀티 모델 아키텍처 (TO-BE) — 제안

### 2.1 사용 가능한 모델 풀 (2026년 3월 기준)

#### Anthropic Claude

| 모델 | Input $/1M | Output $/1M | Context | 강점 |
|------|-----------|------------|---------|------|
| **Opus 4.6** | $5.00 | $25.00 | 200K (1M beta) | 최고 추론, extended thinking, 복잡한 다단계 작업 |
| **Sonnet 4.6** | $3.00 | $15.00 | 200K (1M beta) | 최적 밸런스, 에이전틱 코딩, 멀티에이전트 리드 |
| **Haiku 4.5** | $1.00 | $5.00 | 200K | 빠른 실행, Sonnet 4 수준의 90% 코딩 성능, 병렬 서브에이전트 |

**특수 기능**: Extended Thinking (도구 호출 사이 사고), Batch API (50% 할인), Prompt Caching (입력 90% 절감), 계층적 오케스트레이션 설계

#### OpenAI (Codex 포함)

| 모델 | Input $/1M | Output $/1M | Context | 강점 |
|------|-----------|------------|---------|------|
| **o3** | $10.00 | $40.00 | 200K | 최고 추론, 에이전틱 도구 활용, 멀티모달 |
| **o4-mini** | $1.10 | $4.40 | 200K | o3 대비 90% 저렴, 수학/코딩/비전 |
| **GPT-5** | $1.25 | $10.00 | 400K | 하이브리드 라우팅, 멀티모달 추론 |
| **GPT-4o-mini** | $0.15 | $0.60 | 128K | 초저가 멀티모달, 경량 작업 |
| **GPT-5.3-Codex** | $1.75 | $14.00 | - | 최신 코딩 전문 에이전트, 장기 기술 작업 |
| **GPT-5.1-Codex-Mini** | $0.25 | $2.00 | - | 코드 생성 서브태스크에 극도로 저렴 |

**특수 기능**: Codex 라인은 자율 소프트웨어 엔지니어링 특화, PR 생성/버그 수정 자동화

#### Google Gemini

| 모델 | Input $/1M | Output $/1M | Context | 강점 |
|------|-----------|------------|---------|------|
| **Gemini 2.5 Pro** | $1.25 | $10.00 | 1M (2M 예정) | 최고 추론, 코딩, 멀티모달, 에이전틱 워크플로 |
| **Gemini 2.5 Flash** | $0.30 | $2.50 | 1M | 하이브리드 추론, 248 tok/s, thinking 예산 제어 |
| **Gemini 2.5 Flash-Lite** | $0.10 | $0.40 | 1M | 초저지연, 분류/라우팅 특화 |

**특수 기능**: 1M 토큰 컨텍스트 (전체 코드베이스 처리 가능), 네이티브 멀티모달 (텍스트/이미지/비디오/오디오), 무료 티어 제공, thinking 예산 제어

---

### 2.2 제안 모델 배치 (역할별 최적 모델)

```
┌─────────────────────────────────────────────────────┐
│                  Model Router Layer                   │
│              Gemini 2.5 Flash-Lite ($0.10/$0.40)     │
│         작업 분류, 복잡도 추정, 에이전트 라우팅          │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────┐
│              Orchestrator / Planner                    │
│            Claude Opus 4.6 ($5/$25)                   │
│    계획 분해, 승인 게이트, 상태 관리, 환경 구성          │
└──────────────────────┬──────────────────────────────┘
                       │
    ┌─────────┬────────┼────────┬──────────┬──────────┐
    │         │        │        │          │          │
┌───┴───┐ ┌──┴──┐ ┌───┴──┐ ┌──┴───┐ ┌───┴───┐ ┌───┴──────┐
│Codegen│ │Spec │ │Policy│ │Review│ │OS Exec│ │Multimodal│
│       │ │     │ │/Risk │ │      │ │       │ │          │
└───────┘ └─────┘ └──────┘ └──────┘ └───────┘ └──────────┘
```

#### 상세 모델 배정표

| 에이전트 | 1차 모델 | 대체(Fallback) 모델 | 선정 근거 |
|---------|---------|-------------------|----------|
| **Router/Classifier** | Gemini 2.5 Flash-Lite ($0.10/$0.40) | GPT-4o-mini ($0.15/$0.60) | 초저지연 분류 특화, 1M 컨텍스트, 최저 비용 |
| **Orchestrator** | Claude Opus 4.6 ($5/$25) | Gemini 2.5 Pro ($1.25/$10) | 최강 다단계 계획, Extended Thinking, 컨텍스트 압축 |
| **Spec Agent** | Gemini 2.5 Flash ($0.30/$2.50) | Claude Haiku 4.5 ($1/$5) | 1M 컨텍스트로 전체 문서 한 번에 분석, thinking 제어로 비용 최적화 |
| **Policy/Risk** | Claude Opus 4.6 ($5/$25) | o3 ($10/$40) | 보안은 최고 추론 필요, 미묘한 이슈 포착. "다른 모델이 놓치는 async 버그, dispose 누락 포착" |
| **Planner** | Claude Sonnet 4.6 ($3/$15) | Gemini 2.5 Pro ($1.25/$10) | 계획 수립 + 에이전트 조율 밸런스 최적 |
| **Codegen** | Claude Sonnet 4.6 ($3/$15) | GPT-5.3-Codex ($1.75/$14) | 에이전틱 코딩 벤치마크 리드, 반복 워크플로 |
| **Codegen Sub-tasks** | GPT-5.1-Codex-Mini ($0.25/$2) | Claude Haiku 4.5 ($1/$5) | 병렬 코드 생성 서브태스크에 극도로 저렴 |
| **Review** | Claude Sonnet 4.6 ($3/$15) | Gemini 2.5 Pro ($1.25/$10) | 코드 리뷰에 높은 추론 + 적절한 비용 |
| **Test/Build** | Claude Haiku 4.5 ($1/$5) | o4-mini ($1.10/$4.40) | 테스트 실행/빌드는 빠른 모델로 충분 |
| **OS Executor** | Claude Sonnet 4.6 ($3/$15) | o4-mini ($1.10/$4.40) | 네이티브 Computer Use/Tool Calling |
| **Rollback/Recovery** | Claude Haiku 4.5 ($1/$5) | GPT-4o-mini ($0.15/$0.60) | 정형화된 복구 패턴, 고성능 불필요 |
| **Multimodal (Vision)** | Gemini 2.5 Pro ($1.25/$10) | GPT-4o ($2.50/$10) | 1M 컨텍스트로 3시간 비디오 처리, 최강 멀티모달 |
| **Multimodal (Voice)** | Gemini 2.5 Flash ($0.30/$2.50) | GPT-4o ($2.50/$10) | 네이티브 오디오 처리 + thinking 기능 |

---

## 3. 장단점 분석

### 3.1 멀티 모델의 장점

| # | 장점 | 상세 |
|---|------|------|
| 1 | **비용 최적화** | 단일 프리미엄 모델 대비 **4.4~10.8배 비용 절감**. 간단한 작업에 Flash-Lite($0.10), 코드 서브태스크에 Codex-Mini($0.25) 사용 |
| 2 | **Best-of-Breed** | 각 프로바이더의 최고 강점 활용: Claude=오케스트레이션/코드/보안, Gemini=멀티모달/대용량컨텍스트, Codex=자율코딩 |
| 3 | **회복탄력성** | 단일 프로바이더 장애 시 자동 Fallback. 2025년에 Claude, OpenAI 모두 장애 경험 있음 |
| 4 | **컨텍스트 윈도우 유연성** | Gemini 2.5 Pro의 1M(→2M) 토큰으로 전체 코드베이스 분석 가능. Claude 200K로는 대형 프로젝트 한계 |
| 5 | **미래 대비** | 새 모델 출시 시 설정만 변경하면 교체 가능. 2025-2026 분기별 2~3개 신규 모델 출시 중 |
| 6 | **멀티모달 확장** | JARVIS OS의 비전 목표(블렌더 조작, 음성 인터페이스 등)에 Gemini의 네이티브 멀티모달이 필수적 |

### 3.2 멀티 모델의 단점

| # | 단점 | 상세 | 완화 방안 |
|---|------|------|----------|
| 1 | **복잡성 증가** | 3개 프로바이더의 API 키, Rate Limit, 에러 핸들링, 응답 포맷 관리 | LiteLLM 통합 레이어 사용 |
| 2 | **일관성 문제** | 모델마다 출력 스타일, 도구 호출 포맷이 다름 | 응답 정규화 레이어 + 구조화 출력(JSON Schema) 강제 |
| 3 | **테스트 부담** | 모든 모델-에이전트 조합에 대한 검증 필요 | 에이전트별 계약(Contract) 테스트 + 모델별 벤치마크 스위트 |
| 4 | **데이터 레지던시** | 프로바이더마다 데이터 처리 정책 상이 | 민감 데이터는 Claude만 사용 (Anthropic의 강한 프라이버시 정책) |
| 5 | **디버깅 어려움** | 멀티 모델 경계에서 이슈 추적 난이도 상승 | 통합 로깅 + 트레이싱 (OpenTelemetry) |
| 6 | **라우팅 오버헤드** | Router 레이어가 추가 추론 단계 | Flash-Lite 초저지연(~50ms)으로 최소화 |
| 7 | **프롬프트 관리** | 모델별로 최적화된 프롬프트가 필요 | 에이전트별 프롬프트 템플릿 + 모델별 어댑터 패턴 |

---

## 4. Claude 모델별 적합성 상세

### Claude Opus 4.6 — "깊은 사고가 필요한 곳"

```
적합: Orchestrator, Policy/Risk Agent
이유:
- Extended Thinking으로 도구 호출 사이에 깊은 추론
- 컨텍스트 압축(Context Compaction)으로 장기 세션 유지
- 다른 모델이 놓치는 보안 취약점, 비동기 버그 포착
- Opus 4.6은 이전 대비 67% 가격 인하 ($15→$5 input)
주의: 단순 작업에 쓰면 토큰 낭비. 반드시 고복잡도 작업에만 배정
```

### Claude Sonnet 4.6 — "만능 리더"

```
적합: Planner, Codegen, Review, OS Executor
이유:
- Anthropic 공식 추천 "시작 모델"
- 에이전틱 코딩 벤치마크 최상위
- "복잡한 코드베이스를 독립적으로 작업할 만큼 충분히 스마트"
- 반복 워크플로에서도 품질 저하 없음
- Opus 대비 40% 저렴하면서 대부분 작업에 충분
```

### Claude Haiku 4.5 — "빠른 병렬 실행자"

```
적합: Test/Build, Rollback, 병렬 서브태스크
이유:
- Sonnet 4.5 에이전틱 코딩 성능의 90% 달성
- Sonnet이 계획, Haiku N개가 병렬 실행하는 패턴에 최적화
- $1/$5로 대량 병렬 처리 시 비용 효율적
주의: 8K max output 제한으로 대형 코드 생성에는 부적합
```

---

## 5. Codex 모델별 적합성 상세

### GPT-5.3-Codex — "자율 코딩 에이전트"

```
적합: Codegen의 Fallback, 대규모 리팩토링
이유:
- 최신 Codex 네이티브 에이전트
- 장기 기술 작업(Long-horizon)에 특화
- PR 생성, 버그 수정 자동화
가격: $1.75/$14.00
```

### GPT-5.1-Codex-Mini — "가성비 코드 생성"

```
적합: Codegen Sub-tasks (파일 편집, 테스트 작성, 단순 리팩토링)
이유:
- $0.25/$2.00으로 극도로 저렴
- 순수 코드 생성 작업에 최적
- Sonnet이 계획 → Codex-Mini N개가 병렬 구현하는 패턴
주의: 복잡한 아키텍처 결정이 필요한 작업에는 부적합
```

### o4-mini — "추론 + 코딩 밸런스"

```
적합: OS Executor Fallback, Test/Build Fallback
이유:
- o3 대비 90% 저렴
- 멀티모달(화면 해석) + 추론 동시 지원
- 코딩 + 비전 결합 작업에 효과적
가격: $1.10/$4.40
```

---

## 6. Gemini 모델별 적합성 상세

### Gemini 2.5 Pro — "대용량 멀티모달 전문가"

```
적합: UI/UX Agent, Multimodal Vision, Spec Agent(대형 문서)
이유:
- 1M 토큰 컨텍스트 = 전체 프로젝트 코드베이스 한 번에 분석
- "프론트엔드 및 UI 개발에 의미 있는 개선" 확인됨
- 네이티브 멀티모달: 텍스트/이미지/비디오(3시간)/오디오
- JARVIS OS의 블렌더 조작, 음성 인터페이스 비전에 필수
가격: $1.25/$10.00 (Claude Sonnet보다 저렴!)
```

### Gemini 2.5 Flash — "빠른 하이브리드 추론"

```
적합: Spec Agent, Voice Analysis, 중간 복잡도 작업
이유:
- 248 tok/s 출력 속도
- Thinking 예산 제어 가능 (on/off + 예산 설정)
- 1M 컨텍스트 + 네이티브 오디오 처리
- 비용 대비 성능 최적
가격: $0.30/$2.50
```

### Gemini 2.5 Flash-Lite — "초저비용 라우터"

```
적합: Model Router, Task Classifier, 간단한 분류/라우팅
이유:
- $0.10/$0.40으로 시장 최저가 수준
- 2.0 Flash 대비 1.5배 빠른 지연시간
- 1M 컨텍스트에도 초저비용
- 분류/라우팅에 최적화 설계
주의: 복잡한 추론이나 코드 생성에는 부적합
```

---

## 7. 비용 비교 분석

### 시나리오: 코드 구현 요청 1회 (중간 복잡도)

#### AS-IS (Claude 단일)
```
Orchestrator (Sonnet)  : ~3K output tokens  = $0.045
Spec (Haiku)           : ~2K output tokens  = $0.010
Policy (Haiku)         : ~1K output tokens  = $0.005
Planner (Sonnet)       : ~3K output tokens  = $0.045
Codegen (Opus)         : ~10K output tokens = $0.250
Review (Sonnet)        : ~5K output tokens  = $0.075
Test (Haiku)           : ~2K output tokens  = $0.010
────────────────────────────────────────────────
합계                                          ≈ $0.44
```

#### TO-BE (멀티 모델)
```
Router (Flash-Lite)    : ~0.5K output tokens = $0.0002
Orchestrator (Opus)    : ~3K output tokens   = $0.075
Spec (Gemini Flash)    : ~2K output tokens   = $0.005
Policy (Opus)          : ~1K output tokens   = $0.025
Planner (Sonnet)       : ~3K output tokens   = $0.045
Codegen (Sonnet)       : ~5K output tokens   = $0.075
Codegen-Sub x3 (Codex-Mini): ~5K each        = $0.030
Review (Sonnet)        : ~5K output tokens   = $0.075
Test (Haiku)           : ~2K output tokens   = $0.010
────────────────────────────────────────────────
합계                                           ≈ $0.34
```

**절감률: ~23%** (단순 작업에서는 50%+ 절감 가능)

> 핵심 절감 포인트: Codegen 서브태스크를 Opus($25/M) → Codex-Mini($2/M)로 전환

---

## 8. 통합 API 레이어 권장

### 권장: LiteLLM

```
┌────────────────────────────────────────┐
│          JARVIS Agent System           │
│  (모든 에이전트가 OpenAI 호환 API 호출)   │
└───────────────┬────────────────────────┘
                │
┌───────────────┴────────────────────────┐
│          LiteLLM Proxy Server          │
│  - 비용 추적 (에이전트별 지출 모니터링)    │
│  - 자동 Fallback (프로바이더 장애 시)     │
│  - 로드 밸런싱                          │
│  - Rate Limit 관리                     │
│  - 응답 포맷 정규화                      │
└──┬───────────┬──────────────┬──────────┘
   │           │              │
┌──┴──┐   ┌───┴───┐   ┌─────┴─────┐
│Claude│   │OpenAI │   │  Gemini   │
│ API  │   │  API  │   │   API     │
└─────┘   └───────┘   └───────────┘
```

**LiteLLM 주요 이점:**
- 100+ LLM 프로바이더 지원
- OpenAI 호환 프록시 → 에이전트 코드 변경 최소화
- 빌트인 비용 추적, 가드레일, 로깅
- Python SDK 또는 독립 프록시 서버로 배포

**대안: OpenRouter** (관리형 서비스)
- 290+ 모델, 단일 API
- 5.5% 마크업 수수료
- 자체 인프라 관리 불필요

---

## 9. 아키텍처 전환 시 고려사항

### 9.1 현재 설계와의 호환성

| 항목 | 호환성 | 변경 필요 |
|------|--------|----------|
| XState v5 상태 머신 | ✅ 완전 호환 | 모델 선택 로직만 추가 |
| 7+ 승인 게이트 | ✅ 완전 호환 | 변경 없음 |
| Capability Token 시스템 | ✅ 완전 호환 | 변경 없음 |
| 불변 감사 로그 | ⚠️ 확장 필요 | 사용 모델/프로바이더 필드 추가 |
| MODEL_ASSIGNMENT.json | ✅ 이미 설계됨 | 프로바이더 필드 추가 |
| Claude CLI 기반 실행 | ⚠️ 변경 필요 | LiteLLM 프록시 또는 커스텀 런타임으로 전환 |

### 9.2 단계적 전환 로드맵 (권장)

```
Phase 0: Claude 단일 (현재 설계대로 MVP 구축)
         └─ Opus/Sonnet/Haiku 계층만 사용
         └─ LiteLLM은 Claude만 래핑하여 도입

Phase 1: Router 추가 (+Gemini Flash-Lite)
         └─ 복잡도 분류기를 Flash-Lite로 교체
         └─ 비용 50%+ 절감 시작점

Phase 2: Codegen 서브태스크 확장 (+Codex-Mini)
         └─ 병렬 코드 생성 작업에 Codex-Mini 투입
         └─ Sonnet이 계획, Codex-Mini가 실행

Phase 3: 멀티모달 확장 (+Gemini 2.5 Pro)
         └─ Vision/Voice Agent에 Gemini 투입
         └─ 블렌더 조작, 음성 인터페이스 구현

Phase 4: 전체 최적화
         └─ 자동 모델 라우팅 (성능/비용 기반)
         └─ A/B 테스트로 최적 모델 배정
```

---

## 10. 최종 권장 모델 배정표

| 에이전트 | 프로바이더 | 모델 | 비용(Out/1M) | 우선순위 |
|---------|-----------|------|-------------|---------|
| Router | **Google** | Gemini 2.5 Flash-Lite | $0.40 | Phase 1 |
| Orchestrator | **Anthropic** | Claude Opus 4.6 | $25.00 | Phase 0 |
| Spec Agent | **Google** | Gemini 2.5 Flash | $2.50 | Phase 1 |
| Policy/Risk | **Anthropic** | Claude Opus 4.6 | $25.00 | Phase 0 |
| Planner | **Anthropic** | Claude Sonnet 4.6 | $15.00 | Phase 0 |
| Codegen (Lead) | **Anthropic** | Claude Sonnet 4.6 | $15.00 | Phase 0 |
| Codegen (Sub) | **OpenAI** | GPT-5.1-Codex-Mini | $2.00 | Phase 2 |
| Review | **Anthropic** | Claude Sonnet 4.6 | $15.00 | Phase 0 |
| Test/Build | **Anthropic** | Claude Haiku 4.5 | $5.00 | Phase 0 |
| OS Executor | **Anthropic** | Claude Sonnet 4.6 | $15.00 | Phase 0 |
| Rollback | **Anthropic** | Claude Haiku 4.5 | $5.00 | Phase 0 |
| Vision | **Google** | Gemini 2.5 Pro | $10.00 | Phase 3 |
| Voice | **Google** | Gemini 2.5 Flash | $2.50 | Phase 3 |

---

## 11. 결론

### 멀티 모델 전환이 가능한가? → **YES, 적극 권장**

1. **기술적으로 완전히 가능**: LiteLLM/OpenRouter를 통해 통합 API 레이어 구축 가능
2. **현재 설계와 호환**: MODEL_ASSIGNMENT.json 등 이미 모델 교체를 고려한 설계
3. **비용 절감**: 단순 작업에 Flash-Lite/Codex-Mini 사용 시 50%+ 절감
4. **성능 향상**: 각 역할에 최적화된 모델 배정으로 전체 품질 상승
5. **단, Phase 0은 Claude 단일로 시작 권장**: 먼저 동작하는 시스템을 만들고, 점진적으로 멀티 모델로 확장

### 핵심 원칙

> **"Claude를 뇌(Orchestrator/Security), Codex를 손(Code Generator), Gemini를 눈과 귀(Multimodal)로"**

---

*참고 소스: OpenAI API Pricing, Anthropic Claude Pricing, Google Gemini API Pricing, LiteLLM Docs, OpenRouter Docs, Multi-Model AI Agent Architecture Guide (2026)*
