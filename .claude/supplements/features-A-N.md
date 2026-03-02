# JARVIS OS 보완 기능 섹션 A~N 참조 문서

> **이 문서는 보완/확장 설계 참고 문서입니다. 핵심 에이전트 설계는 agents/ 디렉토리를 참조하세요.**
>
> A~E 섹션(아키텍처, 보안, 거버넌스, 실행기, UI/UX)의 핵심 내용은 design/ 문서에
> 보안/아키텍처/UI 심화로 이미 포함되어 있으므로, 이 문서에서는 참조 링크만 제공합니다.
> F, G, H, I, J, K, L, M, N 섹션의 상세 내용을 아래에 기록합니다.

---

## 기존 섹션 참조 (A~E)

| 섹션 | 항목 수 | 주요 내용 | 참조 |
|------|---------|----------|------|
| A. 아키텍처 | 5개 | Health Monitor, 통신 프로토콜, Degradation, Multi-Run, State Resume | design/architecture |
| B. 보안 | 6개 | Clipboard, Screen Capture, Process Integrity, Prompt Injection, Network DLP, USB | design/security |
| C. 거버넌스 | 5개 | Conflict Resolution, Policy Expiration, Delegation Chain, Abuse Prevention, Learning 검증 | design/policy |
| D. 실행기 | 5개 | Action DAG, Dry-Run, 리소스 모니터링, Multi-Window, Undo Stack | design/executor |
| E. UI/UX | 6개 | 접근성, 알림 우선순위, 다국어, 모바일, 온보딩, 대시보드 | design/ui |

---

# F. 음성/대화 인터페이스 보완

## F-1. 음성 인증 상세 명세

### 등록 흐름

```
Voiceprint 등록:
─────────────────

1. 사용자에게 5개 문장 읽기 요청 (다양한 음소 포함)
2. 각 문장을 2회 반복 녹음
3. Voiceprint 특징 추출 (스펙트로그램 기반)
4. 로컬 Vault에 암호화 저장 (서버 전송 금지)
5. 검증 테스트 1회 수행

매칭 파라미터:
- 유사도 임계값: 85% (조정 가능)
- 위양성률 목표: < 1%
- 위음성률 목표: < 5%
- 스푸핑 방어: 활성 감지 (녹음 재생 차단)
```

### 인증 흐름

```
음성 입력 수신
     │
     ▼
┌──────────────────┐
│ 활성 감지 (Liveness)│ ── 녹음 재생? ──> 거부
│ - 랜덤 챌린지 문장 │
│ - 배경 노이즈 분석 │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Voiceprint 매칭  │ ── 불일치? ──> 비밀번호 폴백
└────────┬─────────┘
         │ 일치
         ▼
인증 성공 → 세션 시작
```

---

## F-2. 다중 턴 대화 관리

### 대화 컨텍스트 모델

```typescript
interface ConversationContext {
  sessionId: string;
  turns: ConversationTurn[];
  activeIntent?: string;
  pendingClarifications: string[];
  referencedRuns: string[];        // 이전 Run 참조
  referencedFiles: string[];       // 언급된 파일
}

interface ConversationTurn {
  turnId: string;
  speaker: "USER" | "JARVIS";
  content: string;
  timestamp: string;
  intent?: string;
  entities?: Record<string, string>;
  linkedRunId?: string;
}
```

### 대화 패턴 처리

```
1. 요청 수정 (Mid-conversation correction)
   User: "React 컴포넌트 만들어줘"
   JARVIS: [계획 생성 중...]
   User: "아 잠깐, Vue로 해줘"
   → 현재 진행 중단 + 요청 수정 반영 + 재시작

2. 요청 취소 (Cancellation)
   User: "됐어, 취소해"
   → Gate 대기 중이면 즉시 취소
   → 실행 중이면 중단 + 롤백 제안

3. 이전 결과 참조 (Back-reference)
   User: "아까 만든 그 파일 수정해줘"
   → ConversationContext에서 referencedFiles 검색
   → 모호하면 "어떤 파일을 말씀하시나요?" 확인

4. 추가 요청 (Follow-up)
   User: "거기에 테스트도 추가해줘"
   → 이전 Run의 context를 이어받아 새 Run 시작
```

---

## F-3. 선제적 제안 엔진

### 제안 트리거 조건

```
패턴 기반 제안:
──────────────

1. 반복 작업 감지
   - "매일 오전 9시에 git pull을 하시네요. 자동화할까요?"
   - 조건: 같은 작업이 3일 연속 감지

2. 최적화 제안
   - "이 프로젝트에 사용되지 않는 의존성이 5개 있습니다."
   - 조건: 주간 스캔 결과

3. 보안 제안
   - "이 API Key가 코드에 하드코딩되어 있습니다."
   - 조건: Review Agent 결과

4. 유지보수 제안
   - "node_modules가 2GB를 초과했습니다. 정리할까요?"
   - 조건: 디스크 모니터링 결과
```

### 제안 빈도 규칙

```
- 1시간에 최대 3개
- 같은 제안은 3일 내 재표시 금지
- 사용자가 "이 유형 제안 그만" → 해당 카테고리 비활성화
- DND 모드에서는 제안 완전 비활성화
```

---

# G. 테스트/품질 보완

## G-1. 에이전트 통합 테스트 프레임워크

### 테스트 카테고리

| 카테고리 | 검증 대상 |
|---------|----------|
| 에이전트 핸드오프 테스트 | Spec → Policy → Planner 체인 데이터 전달 정확성, 메시지 포맷 검증 |
| 정책 판정 정확도 테스트 | 위험 요청 100개 DENY 정확도, 안전 요청 100개 ALLOW 정확도, FP/FN 비율 |
| Gate 흐름 테스트 | 승인 → Capability 발급, 거부 → 완전 차단, 타임아웃 → 안전 종료 |
| Recovery 테스트 | 의도적 에러 주입 → 롤백, 중간 실패 → 부분 롤백 |
| End-to-End 시나리오 테스트 | "코드 구현해줘" 전체 흐름, 모든 Gate 자동 승인/거부 테스트 모드 |

### 테스트 실행 구조

```
/.ai-test/
 ├─ scenarios/
 │   ├─ code_implementation.test.json
 │   ├─ web_access.test.json
 │   ├─ destructive_ops.test.json
 │   └─ policy_edge_cases.test.json
 ├─ fixtures/
 │   ├─ mock_policies.json
 │   ├─ mock_requests.json
 │   └─ expected_outcomes.json
 └─ reports/
     └─ integration_test_report.md
```

---

## G-2. 카오스 엔지니어링 / 결함 주입

```
┌─────────────────────────┬──────────────────────────────────┐
│ 장애 주입               │ 예상 동작                         │
├─────────────────────────┼──────────────────────────────────┤
│ 에이전트 응답 10초 지연  │ timeout → 재시도 → 대체          │
│ 에이전트 완전 무응답     │ Health Monitor → 재시작          │
│ 네트워크 50% 패킷 손실  │ 재시도 → Degraded Mode           │
│ 디스크 공간 부족 시뮬    │ 새 파일 차단 + 경고              │
│ 정책 파일 손상           │ 백업 정책 로드 + 경고             │
│ Gate 무한 대기           │ 타임아웃 → 자동 거부 + 알림      │
│ Executor 무한 루프       │ Budget 초과 → 자동 중단          │
│ 동시 10개 요청           │ 큐잉 + 우선순위 처리             │
└─────────────────────────┴──────────────────────────────────┘
```

---

## G-3. 정책 시뮬레이션 샌드박스

```
새 정책 제안
     │
     ▼
┌──────────────────┐
│ 과거 요청 데이터  │ (최근 N개 요청의 익명화된 로그)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 기존 정책으로     │ → 결과 A (기존 허용/차단 수)
│ 시뮬레이션        │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 새 정책으로       │ → 결과 B (새 허용/차단 수)
│ 시뮬레이션        │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ 차이 분석         │
│ "이 정책을 적용하면:               │
│  - 추가로 차단되는 요청: 3개       │
│  - 새로 허용되는 요청: 0개         │
│  - 영향받는 카테고리: 패키지 설치" │
└──────────────────┘
```

---

## G-4. 성능 벤치마크 도구

```
┌────────────────────────────┬─────────────────┬──────────────┐
│ 지표                       │ 목표값           │ 측정 방법     │
├────────────────────────────┼─────────────────┼──────────────┤
│ 요청→SPEC 생성 시간         │ < 3초           │ 타이머       │
│ 정책 판정 시간              │ < 1초           │ 타이머       │
│ 계획 생성 시간              │ < 5초           │ 타이머       │
│ Gate 렌더링 시간            │ < 200ms         │ 프론트 측정  │
│ 전체 코드 구현 흐름         │ < 5분 (소규모)  │ E2E          │
│ 에이전트 간 메시지 지연      │ < 500ms         │ 타이머       │
│ Emergency Stop 반응 시간    │ < 1초           │ E2E          │
│ 상태 체크포인트 저장 시간    │ < 2초           │ 타이머       │
└────────────────────────────┴─────────────────┴──────────────┘
```

---

# H. 데이터/저장 인프라 보완

## H-1. 감사 로그 순환 및 보관

| 단계 | 기간 | 처리 | 위치 |
|------|------|------|------|
| 활성 로그 | 최근 7일 | 원본 유지, 빠른 검색 인덱스 | `/.ai-logs/active/` |
| 아카이브 | 7~90일 | gzip 압축, 요약 레벨 인덱스 | `/.ai-logs/archive/` |
| 장기 보관 | 90일~1년 | 고압축 + 해시 체인만 보존 | `/.ai-logs/cold/` |
| 삭제 | 1년 후 | 자동 삭제 (알림 후), 해시 체인 최종 스냅샷 보존 | - |

**용량 관리**: 최대 전체의 5% 또는 10GB 중 작은 값. 80% 도달 시 자동 아카이빙 가속, 95% 도달 시 자동 삭제.

## H-2. 환경 번들 버전 관리

```
/.ai-run/
 ├─ bundles/
 │   ├─ run_001/
 │   │   ├─ SPEC.md
 │   │   ├─ PLAN.json
 │   │   ├─ POLICY.json
 │   │   └─ bundle_manifest.json
 │   └─ templates/
 │       ├─ react_project.bundle.json
 │       └─ python_project.bundle.json
 └─ bundle_index.json
```

## H-3. 오프라인 우선 데이터 전략

**항상 로컬 캐시**: 정책 파일, 사용자 프로필, 최근 10개 Run 상태, Credential Vault, 에이전트 설정

**네트워크 필요**: Claude API 호출, 웹 접근, 패키지 다운로드, URL 신뢰도 검사

```
네트워크 끊김 감지 → 오프라인 모드
  가능: 로컬 파일 조작, 캐시된 정책, 앱 실행/조작, Audit 로그
  불가: AI 추론, 웹 접근, 패키지 설치, URL 검사
네트워크 복구 시: 오프라인 로그 동기화 → 대기 작업 재개 → 정책 업데이트 확인
```

---

# I. 확장성 보완

## I-1. 플러그인 / 확장 아키텍처

```
/.ai-plugins/
 ├─ registry.json              (설치된 플러그인 목록)
 ├─ slack-notifier/
 │   ├─ manifest.json          (메타데이터, 권한 요청, 버전)
 │   ├─ plugin.js              (실행 코드)
 │   └─ policy.json            (이 플러그인에 적용되는 정책)
 └─ custom-review-agent/
     ├─ manifest.json
     └─ agent.py
```

**플러그인 보안**: manifest 분석 → 사용자 Gate(권한 목록 + 보안 점수) → 실행 시 전용 Capability만 발급, 다른 에이전트/플러그인 접근 불가, 네트워크/파일은 manifest 선언 범위만.

## I-2. 다중 OS 추상화 레이어

```
┌─────────────────────────────────────────┐
│          Action API (통합 인터페이스)      │
├─────────────────────────────────────────┤
│         OS Abstraction Layer            │
├──────────┬──────────┬──────────────────┤
│ Windows  │  macOS   │  Linux           │
│ Win32 API│ AppKit   │  X11/Wayland     │
│ COM/DCOM │ AppleScr.│  D-Bus           │
│ PowerShell│ osascript│ systemctl       │
│ Cred.Mgr │ Keychain │  Secret Service  │
└──────────┴──────────┴──────────────────┘
```

## I-3. 다중 사용자 협업 모드

- **격리 리소스**: 프로필/정책/Vault (완전 분리), Workspace (사용자별 scope), 대화 이력
- **공유 리소스**: 시스템 정책, Audit Log (접근 제한), Agent 팀 (시간 분할)
- **충돌 관리**: 충돌 감지 → 알림 → 선착순 잠금 → 머지 전략 제안

## I-4. AI 모델 핫스왑 및 폴백

```
에이전트별 모델 폴백 체인:
Codegen:  Opus → Sonnet → Haiku (품질 경고)
Review:   Sonnet → Opus → Haiku
Planner:  Sonnet → Opus → Haiku
Spec:     Haiku → Sonnet → (사용자에게 직접 명세 요청)
Policy:   Haiku → Sonnet → (fail-safe: default DENY)
Test:     Haiku → Sonnet → (수동 테스트 안내)
```

**동적 선택 기준**: 작업 복잡도, 비용 예산, 응답 시간 요구, 모델 상태

---

# J. 구현 기반 및 MVP 전략

## J-1. 모노레포 스캐폴딩 구조

```
jarvis-os/
├── packages/
│   ├── core/                    # 공유 커널
│   │   ├── state-machine/       # XState 기반 RunState 엔진
│   │   ├── policy-engine/       # PolicyDecision 평가기
│   │   ├── action-api/          # Action 스키마 & 직렬화
│   │   ├── capability-token/    # 토큰 발급 / 검증
│   │   ├── event-bus/           # 에이전트 간 통신 버스
│   │   └── types/               # 공용 TypeScript 타입
│   ├── agents/                  # 9개 에이전트 패키지
│   ├── ui/                      # React 프론트엔드
│   ├── cli/                     # 터미널 인터페이스
│   └── shared/                  # 유틸리티
├── turbo.json                   # Turborepo 설정
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

**빌드 도구**: pnpm(패키지), Turborepo(모노레포), tsup(번들러), Vitest(테스트), Biome(린터)

## J-2. 상태 머신 엔진 (XState v5)

### 핵심 상태 전이 규칙

```
FROM                → TO                    조건
──────────────────────────────────────────────────────────
inputReceived       → specDrafting           항상
specDrafting        → policyEvaluation       Spec 생성 성공
policyEvaluation    → blocked                Risk = BLOCKED
policyEvaluation    → gateApproval           Risk >= MEDIUM
policyEvaluation    → planning               Risk = LOW & allowed
gateApproval        → planning               사용자 승인
gateApproval        → blocked                사용자 거부 or 타임아웃
planning            → planReview             Plan 생성 성공
planReview          → codeGeneration         리뷰 통과
codeGeneration      → codeReview             코드 생성 성공
codeReview          → testing                리뷰 통과
testing             → executionGate          테스트 통과
executing           → verifying              실행 완료
verifying           → done                   검증 통과
*any*               → errorRecovery          에러 발생
```

### 상태 영속화

| 시점 | 저장 위치 | 내용 |
|------|----------|------|
| 상태 전이 시 | SQLite (로컬) | 전체 context 스냅샷 |
| Gate 응답 시 | SQLite + 메모리 | gateResponses 업데이트 |
| Executor 액션 단위 | SQLite (WAL 모드) | 개별 액션 결과 |
| 세션 종료 시 | JSON 파일 | 전체 Run 상태 직렬화 |
| 앱 재시작 시 | SQLite → 메모리 | 마지막 스냅샷 복원 |

## J-3. CLI 인터페이스 MVP

```
jarvis <command> [options]

Commands:
  jarvis run <instruction>       # 자연어 명령 실행
  jarvis plan <instruction>      # Plan만 생성 (실행 안 함)
  jarvis approve <run-id>        # 대기 중인 Gate 승인
  jarvis reject <run-id>         # Gate 거부
  jarvis status [run-id]         # 현재/특정 Run 상태
  jarvis history                 # 실행 이력
  jarvis rollback <run-id>       # 수동 롤백
  jarvis config                  # 설정 (Trust Mode 등)
  jarvis policy list             # 활성 정책 목록
  jarvis policy test <action>    # 정책 시뮬레이션
```

**CLI 기술 스택**: Commander.js, Inquirer.js, chalk + boxen, ora, cli-table3

## J-4. E2E MVP 검증 시나리오 (10가지)

| # | 시나리오 | 검증 포인트 |
|---|---------|-----------|
| 1 | "hello.txt 파일 만들어줘" | 최소 파이프라인 E2E |
| 2 | ".js를 .ts로 변환해줘" | 다중 파일 조작 |
| 3 | "npm install lodash" | 패키지 설치 Gate |
| 4 | "~/Documents 정리해줘" | 위험 경로 감지 → Gate |
| 5 | "Python 스크립트 실행해줘" | 코드 실행 Gate + 샌드박스 |
| 6 | "시스템 설정 변경해줘" | BLOCKED 정책 작동 |
| 7 | 중간에 취소 | Pause → Rollback 흐름 |
| 8 | 동일 명령 반복 | Pattern Cache 학습 |
| 9 | 네트워크 끊김 | Offline-First 동작 |
| 10 | 앱 재시작 | State Resume 검증 |

## J-5. 구현 우선순위

```
Phase 0: Foundation     → Monorepo 셋업, types, 빌드 파이프라인
Phase 1: Core Engine    → State Machine, Policy Engine, Action API
Phase 2: Agent Pipeline → 9개 에이전트 기본 구현 (stub → real)
Phase 3: CLI MVP        → 터미널 인터페이스, Gate 승인 UX
Phase 4: React UI       → 4-Panel 레이아웃, 실시간 상태 표시
Phase 5: Polish         → 보안 강화, 성능 최적화, 에러 핸들링
```

## J-6. 첫 번째 수직 슬라이스

> "hello.txt 만들어줘" 한 문장을 처음부터 끝까지 실행할 수 있는 최소 구현

**성공 기준**:
```
$ jarvis run "hello.txt 만들어줘"
  Intent 분석 완료 (1.2s) → 정책 평가: LOW risk (0.3s)
  → 실행 계획 생성 (0.8s) → hello.txt 생성 완료 (0.1s)
총 소요 시간: 2.4s
```

---

# K. 런타임 지능 및 최적화

## K-1. 토큰 예산 최적화

### 에이전트별 비용 분석

| 에이전트 | 모델 권장 | 평균 토큰 | 비용 비중 |
|---------|----------|----------|----------|
| Orchestrator | Sonnet | ~500 in/out | 낮음 |
| Intent & Spec | Sonnet | ~1,500 in/800 out | 중간 |
| Policy & Risk | Haiku | ~800 in/300 out | 낮음 |
| Planner | Sonnet | ~2,000 in/1,500 | 높음 |
| Codegen | Opus | ~3,000 in/2,000 | 최고 |
| Review | Sonnet | ~2,000 in/500 | 중간 |
| Test & Build | Haiku | ~1,000 in/500 | 낮음 |
| Executor | 없음 (규칙 기반) | 0 | 없음 |

**단일 Run 평균 총합**: ~12,300 input / ~6,400 output

### 최적화 전략

| 전략 | 설명 | 절감 예상 |
|------|------|----------|
| Prompt Caching | 시스템 프롬프트 캐싱 | ~30% input |
| 조건부 스킵 | 단순 작업 시 Review/Codegen 스킵 | ~40% 전체 |
| 점진적 컨텍스트 | 필요한 정보만 점진 제공 | ~20% input |
| 모델 다운그레이드 | LOW risk 시 전체 Haiku | ~60% 비용 |
| 결과 캐싱 | 동일 Spec → 캐시된 Plan 재사용 | ~50% 반복 |

### 토큰 예산 인터페이스

```typescript
interface TokenBudget {
  runId: string;
  limit: {
    total: number;
    perAgent: Record<AgentId, number>;
  };
  used: {
    total: number;
    perAgent: Record<AgentId, { input: number; output: number }>;
  };
  strategy: 'optimal' | 'balanced' | 'economy';
  alerts: {
    warnAt: number;          // 80% 경고
    hardLimitAction: 'pause' | 'downgrade' | 'abort';
  };
}
```

## K-2. 상호 감시 패턴

| 감시자 | 감시 대상 | 감시 항목 |
|--------|----------|----------|
| Review Agent | Codegen Agent | 코드 품질, 보안 취약점 |
| Policy & Risk | Planner | 계획의 정책 준수 여부 |
| Test & Build | Executor | 실행 결과 정합성 |
| Recovery | 모든 에이전트 | 에러 패턴, 무한 루프 |
| Orchestrator | 전체 파이프라인 | 타임아웃, 교착 상태 |

**교착 상태 감지**: A→B→A 순환 호출(그래프 사이클 감지), Gate 무한 대기(TTL 타이머), 에이전트 무응답(Heartbeat 누락 3회), 동일 상태 반복 진입(히스토리 3회)

## K-3. 행동 패턴 캐시

```json
{
  "patternId": "pat_abc123",
  "type": "approved",
  "signature": {
    "actionType": "package_install",
    "riskRange": [0, 40],
    "pathPattern": "~/projects/**"
  },
  "statistics": {
    "occurrences": 15,
    "approvalRate": 1.0,
    "avgResponseTime": 1200
  },
  "confidence": 0.95,
  "autoApplyThreshold": 0.9,
  "expiresAt": "2025-04-15T10:30:00Z"
}
```

**안전 장치**: HIGH risk 이상은 캐시 자동 적용 불가, 30일 미사용 패턴 자동 만료, 자동 승인 연속 최대 10회, 새 경로/패키지는 항상 Gate

## K-4. 작업 공간 프로필 시스템

**자동 감지 대상**: 언어(파일 확장자), 프레임워크(package.json), 패키지 매니저(lock 파일), Docker, CI/CD, 테스트 프레임워크, 모노레포

## K-5. 에러 복구 플레이북 (6가지 장애 유형)

1. **Claude API 호출 실패**: 지수 백오프 재시도 → 모델 다운그레이드 → 오프라인 큐
2. **Executor 액션 실패**: Undo Stack 복원 → 원인 분석 → 대안 제시
3. **State Machine 비정상**: 스냅샷 저장 → 마지막 정상 상태 롤백 → 재초기화
4. **메모리/리소스 부족**: PAUSE → 불필요 프로세스 정리 → 확보 후 RESUME
5. **Capability Token 만료**: 일시정지 → 새 토큰 발급 → Policy 재평가
6. **네트워크 단절**: 로컬 전용 모드 → 오프라인 큐 → 연결 복구 시 자동 실행

---

# L. 개발자 경험 및 도구

## L-1. 에이전트 개발 SDK

```typescript
interface JarvisAgent<TInput, TOutput> {
  readonly id: AgentId;
  readonly metadata: AgentMetadata;
  execute(input: TInput, context: AgentContext): Promise<TOutput>;
  healthCheck(): Promise<HealthStatus>;
  initialize(config: AgentConfig): Promise<void>;
  dispose(): Promise<void>;
}

interface AgentMetadata {
  name: string;
  version: string;
  description: string;
  modelRequirement: ModelTier;
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  capabilities: AgentCapability[];
  maxConcurrency: number;
  timeout: number;
}
```

## L-2. 정책 DSL (비개발자용)

```
POLICY "safe-web-project" {
  SCOPE: ~/projects/web-app/**

  ALLOW {
    file.read    IN scope
    file.write   IN scope WHERE extension IN [.ts, .tsx, .css, .json]
    package.install WHERE registry = "npmjs.com"
    process.run WHERE command IN ["npm", "pnpm", "node", "tsc"]
  }

  GATE {
    file.delete  IN scope                    → CONFIRM("파일 삭제 확인")
    package.install WHERE name NOT IN known  → REVIEW("새 패키지 검토")
  }

  BLOCK {
    file.* OUTSIDE scope
    system.*
    process.run WHERE command IN ["rm", "sudo", "chmod"]
  }
}
```

## L-3. 디버그 모드

| 기능 | 설명 | 활성화 |
|------|------|--------|
| Verbose Logging | 모든 에이전트 I/O 로그 | --verbose |
| Token Profiling | 토큰 사용량 실시간 표시 | --profile |
| State Visualization | 상태 전이 다이어그램 | --viz |
| Step-by-Step | 각 단계별 확인 후 진행 | --step |
| Dry-Run | 실제 실행 없이 Plan까지 | --dry-run |

## L-4. 위협 모델 체크리스트 (6개 카테고리)

1. **Prompt Injection**: Input Sanitizer + Spec 검증 2단계
2. **권한 상승**: 암호화 서명 + 단일 사용 + TTL
3. **정보 유출**: Network DLP + Content Scanner
4. **서비스 거부**: 리소스 모니터 + Watchdog + 예산 한도
5. **무결성 훼손**: Undo Stack + Hash 검증 + 읽기 전용 보호
6. **공급망 공격**: 패키지 레지스트리 화이트리스트 + 서명 검증

## L-5. 버전 관리 및 마이그레이션

| 대상 | 버전 형식 | 하위 호환 규칙 |
|------|----------|---------------|
| JARVIS OS | semver | 새 optional 필드만 추가 가능 |
| Policy 스키마 | 날짜 기반 | deprecated 1버전 유지 |
| Action API | semver | API 엔드포인트 제거 금지 |
| State 스키마 | 정수 | 마이그레이션 함수 체인 |
| Plugin API | semver | 하위 호환 유지 |

---

# M. 자기 교정 및 학습 시스템

## M-1. 교정 피드백 루프

### 시맨틱 에러 감지 트리거

| 트리거 | 감지 방법 | 신뢰도 |
|--------|----------|--------|
| 사용자 명시적 거부 | Gate Reject | 100% |
| 사용자 수정 요청 | "아니, ~해줘" 패턴 | 95% |
| 결과물 미사용 | 생성 파일 즉시 삭제 감지 | 80% |
| 반복 동일 명령 | 같은 명령 재입력 | 75% |
| 결과물 대폭 수정 | 사용자 직접 70%+ 수정 | 70% |

### 교정 에스컬레이션 단계

| 거부 횟수 | 대응 전략 |
|----------|----------|
| 1회 | 재시도 + "이런 뜻인가요?" 명확화 질문 |
| 2회 | 접근 방식 전체 변경 + 대안 3가지 제시 |
| 3회 | 에스컬레이션 → 구조화된 폼으로 구체적 지시 요청 |
| 4회+ | 해당 작업 유형에 대해 "항상 확인" 모드 전환 |

### 오류 유형 분류

```typescript
type CorrectionType =
  | 'intent_mismatch'      // 의도 자체를 잘못 파악
  | 'approach_mismatch'    // 의도는 맞지만 방법이 잘못됨
  | 'scope_mismatch'       // 방법은 맞지만 범위가 잘못됨
  | 'quality_mismatch'     // 범위도 맞지만 품질이 부족
  | 'style_mismatch';      // 기능은 맞지만 스타일/컨벤션 불일치
```

## M-2. 에이전트 성능 점수

```typescript
interface AgentScorecard {
  agentId: AgentId;
  period: { from: Date; to: Date };
  metrics: {
    totalRuns: number;
    successRate: number;
    correctionRate: number;
    intentAccuracy: number;
    qualityScore: number;
    tokenEfficiency: number;
    byCategory: Record<TaskCategory, { runs: number; successRate: number }>;
  };
  trend: 'improving' | 'stable' | 'declining';
}
```

**성적 기반 자동 대응**: 90%+ 유지 / 70-79% 프롬프트 전략 변경 / 60-69% 모델 업그레이드 / <60% 에이전트 비활성화

## M-3. 실수 패턴 DB

실수 패턴을 기록하고, 새 입력 시 매칭된 교정 규칙을 에이전트 프롬프트에 자동 주입.

**만료 규칙**: 90일 미발동 → 아카이브, effectiveness < 30% → 재검토, 패턴 500개 초과 → 병합

## M-4. 적응형 프롬프트 엔지니어링

```
Layer 1: Base Prompt (고정)      — 에이전트 역할, 기본 규칙
Layer 2: Policy Context (런타임)  — 현재 활성 정책
Layer 3: User Profile (개인화)   — 사용자 선호도
Layer 4: Mistake Prevention (교정) — Mistake Pattern DB 매칭 규칙
Layer 5: Session Context (세션)   — 현재 대화 맥락
```

## M-5. 사용자 만족도 시그널

**암시적 수집**: 즉시 사용(+3), 수정 없이 저장(+2), "고마워"(+3), 70%+ 수정(-2), Undo 요청(-3)

---

# N. 고급 기능 확장

## N-1. 시맨틱 메모리 계층

| 유형 | 예시 | TTL | 저장소 |
|------|------|-----|--------|
| User Preference | "TypeScript + Vitest 선호" | 영구 | Profile DB |
| Coding Style | "import 순서: react → lib → local" | 프로젝트 | Workspace |
| Domain Knowledge | "이 API는 v2 엔드포인트 사용" | 프로젝트 | Workspace |
| Error Memory | "이 패턴은 항상 실패함" | 90일 | Pattern DB |
| Context Memory | "어제 auth 모듈 작업 중이었음" | 7일 | Session DB |

```typescript
interface SemanticMemory {
  store(entry: MemoryEntry): Promise<void>;
  search(query: string, options: SearchOptions): Promise<MemoryMatch[]>;
  compact(): Promise<CompactionResult>;
  forget(filter: MemoryFilter): Promise<number>;
}
```

**프라이버시**: 모든 메모리 로컬 저장, 사용자 열람/삭제/초기화 가능, 민감 데이터 자동 마스킹

## N-2. 의도 분기 선택 UI

모호성 합산 60점 이상 시 Disambiguation UI 트리거 → 카드 형태로 해석 후보 표시 (각각 Risk, 예상 시간, 영향 파일 수 포함)

## N-3. 액션 재생 및 매크로 시스템

**매크로 녹화**: 일반 작업 실행 → 시스템이 매크로 저장 제안 → 변수 자동 추출(componentName, basePath 등)

```
$ jarvis macro run react-component --componentName=Modal --withTest=false
$ jarvis macro export react-component > react-component.macro.json
$ jarvis macro import react-component.macro.json
```

## N-4. 실행 비용 예측기

Plan 생성 후 실행 전에 예상 시간/비용/위험도/영향 범위를 카드 UI로 표시. 예측 → 실행 → 실제 비용 측정 → 예측 모델 보정 피드백 루프.

## N-5. 스마트 맥락 수집기

**자동 수집 소스**: IDE 열린 파일, 커서 위치, 선택 영역, Git Status/Diff/Log, Terminal History, Clipboard, Running Processes, Package.json, Error Logs

**맥락 주입 전략**: 관련성 기반 필터링(상위 3~5개), 계층적 요약(상세→요약→한줄), 지연 로딩(기본: 목록만, 필요 시 상세)

## N-6. 다중 에이전트 토론 프로토콜

**토론 프로토콜**: Round 1(제안) → Round 2(반론) → Round 3(수정) → 점수 기반 합의

**비용 제한**: 최대 3라운드, 라운드당 2,000토큰/에이전트, 총 15,000토큰, 30초 시간 한도

## N-7. 점진적 신뢰 승급

```
Observe → Suggest:    20회 연속 성공 + 문제 0건
Suggest → Semi-Auto:  50회 연속 성공 + 거부율 < 5%
Semi-Auto → Auto:     100회 연속 성공 + 카테고리별 신뢰 80+
```

**강등**: Rollback 3회(24h) → 한 단계, 보안 사고 → Observe 즉시

## N-8. 실시간 협업 모드

**역할**: Owner(전체 권한), Co-Owner(전체), Reviewer(Gate 승인+관찰), Observer(관찰만)

**공동 승인**: Multi-sig Gate (required: 2/3 등)

---

# 보완 섹션 총 요약

```
총 68개 보완 항목 (A~N)

A. 아키텍처    (5개)    B. 보안        (6개)    C. 거버넌스    (5개)
D. Executor    (5개)    E. UI/UX      (6개)    F. 음성/대화   (3개)
G. 테스트      (4개)    H. 데이터      (3개)    I. 확장성      (4개)
J. 구현 기반   (6개)    K. 런타임 지능 (5개)    L. 개발자 경험 (5개)
M. 자기 교정   (5개)    N. 고급 기능   (8개)
```
