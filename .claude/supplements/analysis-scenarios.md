# JARVIS OS 심층 분석 보고서 + OPENCLAW 실전 시나리오

> **이 문서는 보완/확장 설계 참고 문서입니다. 핵심 에이전트 설계는 agents/ 디렉토리를 참조하세요.**
>
> AC 섹션은 현재 설계의 갭 분석과 개선 제안을 포함하며,
> AD 섹션은 실제 외부 서비스 연동 시나리오(OPENCLAW 스타일)를 다룹니다.

---

# AC. 심층 분석 보고서

## AC-1. 누락 기능 분석 (8가지)

현재 설계에서 아직 정의되지 않았거나 불충분한 기능들입니다.

### 1. 에이전트 간 통신 프로토콜 상세 정의

```
현재 상태:
  - contract.md: "에이전트 간 직접 통신 금지, Orchestrator 경유"만 명시
  - 구체적인 메시지 포맷, 전송 방식, 에러 핸들링 미정의

필요한 정의:
  - 메시지 봉투 (envelope) 스키마
  - 메시지 라우팅 규칙
  - 재시도/타임아웃 프로토콜
  - 메시지 순서 보장 방식
  - 메시지 크기 제한
  - 압축/배치 전략

제안:
  interface AgentMessage {
    messageId: string;
    from: AgentId;
    to: AgentId;
    via: 'ORCHESTRATOR';       // 항상 Orchestrator 경유
    type: 'REQUEST' | 'RESPONSE' | 'EVENT' | 'ERROR';
    payload: Record<string, any>;
    metadata: {
      runId: string;
      timestamp: string;
      ttl: number;
      priority: 'NORMAL' | 'HIGH' | 'CRITICAL';
      correlationId: string;   // 요청-응답 매칭
    };
  }
```

### 2. 프롬프트 엔지니어링 전략

```
현재 상태:
  - 각 에이전트 Bundle에 역할/규칙만 서술형으로 정의
  - 실제 system prompt 템플릿 미작성
  - 프롬프트 최적화 전략 없음

필요한 정의:
  - 에이전트별 system prompt 템플릿
  - Few-shot 예시 세트
  - 프롬프트 버전 관리 방식
  - A/B 테스트 인프라
  - 프롬프트 주입 방어가 적용된 구조

제안:
  roadmap.md에 "에이전트별 프롬프트 구조"가 간략히 있지만,
  실제 구현을 위해 `prompts/` 디렉토리 분리 필요:
  prompts/
  ├── orchestrator.system.md
  ├── spec-agent.system.md
  ├── policy-risk.system.md
  ├── codegen.system.md
  ├── review.system.md
  ├── test-build.system.md
  ├── executor.system.md
  ├── rollback.system.md
  └── _shared/
      ├── contract-injection.md
      └── few-shot-examples/
```

### 3. 에이전트 상태 관리 상세

```
현재 상태:
  - XState v5 상태 머신 정의는 있으나 "Run 수준"만 정의
  - 개별 에이전트의 내부 상태 관리 미정의

필요한 정의:
  - 에이전트별 라이프사이클 (IDLE → ACTIVE → BUSY → COOLDOWN)
  - 에이전트 풀링/재사용 전략
  - 에이전트 초기화/종료 프로토콜
  - 에이전트 간 상태 공유 범위
```

### 4. 테스트 전략 (실제 구현 수준)

```
현재 상태:
  - G 섹션에서 테스트 카테고리/시나리오 정의
  - 실제 테스트 코드 구조나 모킹 전략 미정의

필요한 정의:
  - 에이전트 유닛 테스트 (AI 응답 모킹 방법)
  - 통합 테스트 (에이전트 체인 검증)
  - E2E 테스트 (실제 OS 조작 포함)
  - 성능 테스트 (토큰/시간 벤치마크)
  - 회귀 테스트 (모델 업데이트 시)
```

### 5. 모니터링 및 알림 인프라

```
현재 상태:
  - 감사 로그 스키마는 상세하지만
  - 실시간 모니터링, 알림 파이프라인 미정의

필요한 정의:
  - 메트릭 수집 (에이전트 응답 시간, 성공률, 토큰 사용량)
  - 알림 채널 (Slack, Telegram, Email)
  - 대시보드 데이터 소스
  - 이상 탐지 룰 엔진
```

### 6. 배포 및 업데이트 전략

```
현재 상태:
  - Phase 0~3 로드맵은 있지만
  - 실제 배포 파이프라인, 업데이트 메커니즘 미정의

필요한 정의:
  - 릴리스 프로세스 (빌드 → 테스트 → 배포)
  - 자동 업데이트 메커니즘
  - 롤백 (시스템 자체의 롤백, 아닌 작업 롤백)
  - 설정 마이그레이션
```

### 7. 국제화 (i18n) 구현 상세

```
현재 상태:
  - UI/UX 문서에서 다국어 파일 구조만 언급
  - AI 응답의 다국어 처리 미정의

필요한 정의:
  - AI 응답 언어 결정 로직
  - 정책 설명문 다국어 (Policy DSL)
  - 에러 메시지 다국어
  - Gate 메시지 다국어
```

### 8. 성능 벤치마크 기준선

```
현재 상태:
  - G-4에서 목표값은 있지만
  - 기준선(baseline) 측정 방법론 미정의

필요한 정의:
  - 벤치마크 시나리오 표준화
  - 측정 도구 선정
  - CI에서 자동 벤치마크 실행
  - 성능 회귀 자동 탐지
```

---

## AC-2. 개선 필요 영역 (10가지)

현재 정의되어 있지만 보강이 필요한 영역입니다.

### 1. Capability Token 생애주기 정밀화

```
현재: 발급 → 사용 → 무효화 기본 흐름만 정의
개선:
  - Token 갱신 메커니즘 (장기 작업 시)
  - Token 위임 시 scope 축소 검증 알고리즘
  - Token 충돌 감지 (동일 리소스에 중복 Token)
  - Token 감사 체인 최적화 (고빈도 발급 시 성능)
```

### 2. 감사 로그 성능 최적화

```
현재: append-only SQLite 기반
개선:
  - 고빈도 쓰기 성능 (WAL 모드 상세 설정)
  - 인덱스 전략 (시간, 에이전트, 위험도 복합 인덱스)
  - 아카이빙 시 쿼리 성능 유지
  - 대용량 로그 검색 최적화 (전문 검색)
  - 해시 체인 검증 성능 (100K+ 엔트리)
```

### 3. 정책 엔진 성능

```
현재: JSON 기반 규칙 매칭
개선:
  - 정책 수 증가 시 O(n) → O(log n) 검색
  - 정책 프리컴파일 (정규식 등)
  - 정책 캐싱 (자주 매칭되는 규칙)
  - 충돌 감지 시 성능 (규칙 수 N^2 문제)
```

### 4. Gate UX 응답성

```
현재: Gate 카드 레이아웃 정의
개선:
  - Gate 렌더링 시간 최적화 (200ms 미만 목표)
  - 대용량 diff 표시 성능 (1000줄+ 변경)
  - Gate 히스토리 브라우징
  - Gate 프리셋 (자주 사용하는 승인 패턴 저장)
  - 키보드 단축키 최적화
```

### 5. 에러 복구 검증

```
현재: 에러 복구 플레이북 6종 정의
개선:
  - 부분 롤백 후 데이터 일관성 검증
  - 복구 후 상태 정합성 자동 테스트
  - 복구 실패 시 2차 복구 전략
  - 복구 시간 SLA (5초 이내 기본 복구)
```

### 6. 오프라인 모드 상세

```
현재: 가능/불가능 목록만 정의
개선:
  - 오프라인 큐 관리 (우선순위, 만료)
  - 오프라인 → 온라인 전환 시 충돌 해결
  - 정책 캐시 유효성 검증
  - 부분 온라인 (일부 API만 접근 가능) 처리
```

### 7. 멀티 모델 전환 시 프롬프트 호환

```
현재: MODEL_ASSIGNMENT.json으로 모델 교체 가능 설계
개선:
  - 모델별 프롬프트 어댑터 (출력 포맷 정규화)
  - 모델 전환 시 세션 연속성 유지
  - 모델별 최적 temperature/top_p 설정
  - 모델 능력 벤치마크 자동 업데이트
```

### 8. 보안 스캔 도구 통합

```
현재: 코드 리뷰, 패키지 검사 개념만 정의
개선:
  - 정적 분석 도구 통합 (ESLint, Semgrep)
  - 의존성 취약점 스캔 (npm audit, Snyk)
  - 시크릿 스캔 (git-secrets, truffleHog)
  - SAST/DAST 파이프라인 통합
```

### 9. 사용자 프로필 마이그레이션

```
현재: 프로필 구조 정의
개선:
  - 프로필 내보내기/가져오기
  - 디바이스 간 프로필 동기화
  - 프로필 스키마 버전 관리
  - 팀 프로필 상속 (조직 기본값 + 개인 오버라이드)
```

### 10. 접근성 테스트 자동화

```
현재: WCAG 2.1 AA 요구사항 정의
개선:
  - axe-core 통합 테스트
  - 키보드 네비게이션 자동 테스트
  - 스크린 리더 호환성 테스트
  - 색각 이상 시뮬레이션 테스트
  - CI에서 접근성 회귀 자동 감지
```

---

## AC-3. 구조적 개선 제안

### 제안 1: 설계 문서 분리 (완료)

```
AS-IS:
  workflow.md (12,094줄 단일 파일)
  → 에이전트가 전체를 읽어야 → 컨텍스트 낭비

TO-BE (현재 적용됨):
  workflow.md (인덱스 143줄)
  ├── contract.md
  ├── agents/*.md (9개 에이전트 Bundle)
  ├── schemas/*.json (5개 스키마)
  ├── design/*.md (3개 설계 문서)
  ├── supplements/*.md (3개 보완 문서)
  ├── reports/*.md (2개 분석 보고서)
  └── roadmap.md

효과:
  - 에이전트별 필요 문서만 로드 → 토큰 80%+ 절감
  - 각 문서 독립 갱신 가능
  - 병렬 개발 용이
```

### 제안 2: 스키마 우선 개발 (Schema-First Development)

```
현재: 문서 내 TypeScript 인터페이스로만 정의
제안: JSON Schema 파일을 SSOT(Single Source of Truth)로

workflow:
  1. schemas/*.json 먼저 정의
  2. TypeScript 타입 자동 생성 (json-schema-to-typescript)
  3. 문서에서 스키마 참조 (인라인 복사 금지)
  4. 런타임 유효성 검사 (ajv)

이점:
  - 코드와 문서의 동기화 자동 보장
  - 런타임 유효성 검사 무료
  - API 문서 자동 생성 가능
```

### 제안 3: 결정 기록 (ADR: Architecture Decision Records)

```
현재: 설계 결정의 근거가 문서에 산재
제안: ADR 디렉토리 별도 관리

adr/
├── 001-claude-only-architecture.md
├── 002-xstate-v5-state-machine.md
├── 003-capability-token-single-use.md
├── 004-policy-three-layer.md
├── 005-orchestrator-only-routing.md
└── template.md

각 ADR 포맷:
  # ADR-{번호}: {제목}
  ## 상태: 승인됨
  ## 컨텍스트: 왜 이 결정이 필요했는가
  ## 결정: 무엇을 결정했는가
  ## 근거: 왜 이것을 선택했는가
  ## 대안: 고려했지만 선택하지 않은 대안
  ## 결과: 이 결정으로 인한 영향
```

### 제안 4: 점진적 구현 가이드

```
현재: roadmap.md에 Phase별 체크리스트
제안: 각 Phase의 구현 가이드 상세화

실행 순서 (Phase 0 기준):
  1. 프로젝트 초기화 (pnpm + Turborepo)
  2. 공유 타입 정의 (packages/types)
  3. 이벤트 버스 구현 (packages/core/event-bus)
  4. 상태 머신 구현 (packages/core/state-machine)
  5. 정책 엔진 구현 (packages/core/policy-engine)
  6. Capability 엔진 (packages/core/capability-token)
  7. 감사 로그 (packages/core/audit)
  8. Orchestrator 에이전트 (packages/agents/orchestrator)
  9. Spec Agent (packages/agents/spec)
  10. Policy/Risk Agent (packages/agents/policy-risk)
  11. Planner Agent (packages/agents/planner)
  12. Codegen Agent (packages/agents/codegen)
  13. Executor Agent (packages/agents/executor)
  14. CLI 인터페이스 (packages/cli)
  15. 통합 테스트 + E2E ("hello.txt 만들어줘")
```

---

# AD. OPENCLAW 스타일 실전 시나리오

> OPENCLAW: 실제 외부 서비스와 연동하는 복합 시나리오를 통해
> JARVIS OS의 전체 파이프라인을 검증합니다.

---

## AD-A. 시나리오 1: Slack 회의록 → Notion 자동 정리

### 배경

```
사용자: "오늘 Slack #team-standup 채널의 회의록을 정리해서 Notion에 올려줘"
```

### 전체 흐름

```
사용자 요청
  │
  ▼
[1] Spec Agent (Haiku 4.5)
  │ 의도 분석:
  │   - action: EXTERNAL_SERVICE_INTEGRATION
  │   - source: Slack API (채널 메시지 읽기)
  │   - transform: 회의록 정리 (요약/구조화)
  │   - target: Notion API (페이지 생성)
  │   - risk_flags: [EXTERNAL_API, DATA_TRANSFER, PII_POSSIBLE]
  │
  ▼
[2] Policy/Risk Agent (Opus 4.6)
  │ Risk Score: 55 (MEDIUM)
  │ 판정: NEED_APPROVAL
  │ 근거:
  │   - Slack 메시지 읽기: 허용 (allowlist 도메인)
  │   - PII 가능성: MEDIUM (이름, 업무 내용)
  │   - Notion 쓰기: 허용 (allowlist 도메인)
  │   - 데이터 이동: Slack → JARVIS → Notion (DLP 스캔 필요)
  │
  ▼
[3] ──── Gate L1: 계획 승인 ────
  │ 표시 내용:
  │   - 읽기 대상: Slack #team-standup (오늘 메시지)
  │   - 쓰기 대상: Notion "회의록" 데이터베이스
  │   - 데이터 흐름: Slack → 로컬 처리 → Notion
  │   - PII 처리: 자동 마스킹 적용
  │
  │ [승인] ← 사용자
  │
  ▼
[4] Planner (Sonnet 4.6)
  │ Task DAG:
  │   Step 1: Slack API 인증 (OAuth Token 사용)
  │   Step 2: #team-standup 오늘 메시지 수집
  │   Step 3: PII 스캔 + 마스킹
  │   Step 4: 회의록 구조화 (참석자, 논의사항, 결정사항, Action Items)
  │   Step 5: Notion 페이지 생성
  │   Step 6: 결과 검증
  │
  ▼
[5] Codegen (Sonnet 4.6)
  │ 생성물:
  │   - Slack API 호출 코드 (channel.history)
  │   - 메시지 파싱 + 구조화 로직
  │   - Notion API 페이지 생성 코드
  │   - PII 마스킹 필터
  │
  ▼
[6] Review (Sonnet 4.6)
  │ 검토 항목:
  │   ✅ Slack Token 하드코딩 없음 (Vault 참조)
  │   ✅ PII 마스킹 로직 정상
  │   ✅ Notion API 에러 핸들링 존재
  │   ⚠️ Rate Limit 처리 추가 권장
  │
  ▼
[7] ──── Gate L2: 변경 승인 ────
  │ 표시: 코드 diff + API 호출 목록
  │ [승인] ← 사용자
  │
  ▼
[8] Executor (Sonnet 4.6)
  │ 실행:
  │   Step 1: Vault에서 Slack OAuth Token 조회 → 세션 획득
  │   Step 2: GET slack.conversations.history → 메시지 15건 수집
  │   Step 3: PII 스캔 → 이메일 2건 마스킹 처리
  │   Step 4: 구조화:
  │     - 참석자: 김철수, 이영희, 박지민
  │     - 논의사항: 3건
  │     - 결정사항: 2건
  │     - Action Items: 4건 (담당자 배정)
  │   Step 5: POST notion.pages.create → 성공
  │   Step 6: 검증 → Notion 페이지 URL 확인
  │
  ▼
[9] 완료
  │ 결과: "회의록이 Notion에 정리되었습니다."
  │ 링크: https://notion.so/team/meeting-20260302
  │ 감사 로그: 전체 흐름 기록 완료
```

### 핵심 검증 포인트

| # | 검증 항목 | 결과 |
|---|----------|------|
| 1 | 외부 API 접근 시 Gate 작동 | GATE_WEB_PRECHECK → Slack/Notion 도메인 허용 |
| 2 | Credential Vault 참조 | 토큰 직접 노출 없이 세션만 전달 |
| 3 | PII 마스킹 | 이메일 주소 2건 자동 마스킹 |
| 4 | DLP 스캔 | Slack → Notion 데이터 이동 시 민감 데이터 필터 |
| 5 | 감사 로그 완전성 | 모든 API 호출 + 결과 기록 |
| 6 | 에러 핸들링 | Slack Rate Limit 시 재시도, Notion 실패 시 로컬 백업 |

---

## AD-B. 시나리오 2: Telegram 봇 → 주간 보고서 자동 생성

### 배경

```
사용자: "이번 주 GitHub 커밋 내역 요약해서 Telegram으로 주간 보고서 보내줘"
```

### 전체 흐름

```
사용자 요청
  │
  ▼
[1] Spec Agent (Haiku 4.5)
  │ 의도:
  │   - source: GitHub API (커밋 내역)
  │   - transform: 주간 보고서 생성 (마크다운)
  │   - target: Telegram Bot API (메시지 전송)
  │   - period: 이번 주 (월~오늘)
  │   - risk_flags: [EXTERNAL_API, OUTBOUND_MESSAGE]
  │
  ▼
[2] Policy/Risk Agent (Opus 4.6)
  │ Risk Score: 60 (MEDIUM)
  │ 판정: NEED_APPROVAL
  │ 특별 고려:
  │   - 외부 메시지 전송 (Telegram): 비가역 작업 (R3)
  │   - GitHub 읽기: 허용 (allowlist)
  │   - 커밋 메시지에 민감 정보 가능성: LOW
  │   - 보고서에 코드 스니펫 포함 가능: DLP 스캔 필요
  │
  ▼
[3] ──── Gate L1: 계획 승인 ────
  │ 비가역 경고 표시:
  │   "Telegram 메시지 전송은 되돌릴 수 없습니다"
  │ 수신자 확인: @team_channel (Telegram)
  │ [승인] ← 사용자
  │
  ▼
[4] Planner (Sonnet 4.6)
  │ Task DAG:
  │   Step 1: GitHub API 인증
  │   Step 2: 이번 주 커밋 목록 수집 (repos/*/commits)
  │   Step 3: 커밋 분류 (기능/버그/리팩토링/문서)
  │   Step 4: 보고서 생성 (마크다운)
  │   Step 5: DLP 스캔 (코드 스니펫 검사)
  │   Step 6: 미리보기 Gate
  │   Step 7: Telegram 전송
  │
  ▼
[5] Codegen (Sonnet 4.6) + Review (Sonnet 4.6)
  │ 코드 생성 + 검토 완료
  │
  ▼
[6] Executor (Sonnet 4.6)
  │
  │ Step 1~4: GitHub 데이터 수집 + 보고서 생성
  │
  │   생성된 보고서 예시:
  │   ┌────────────────────────────────────┐
  │   │ 📋 주간 개발 보고서 (3/2 ~ 3/7)    │
  │   │                                    │
  │   │ 🔧 기능 추가: 12건                   │
  │   │   - auth: JWT 토큰 갱신 로직        │
  │   │   - dashboard: 실시간 차트          │
  │   │   ...                              │
  │   │                                    │
  │   │ 🐛 버그 수정: 5건                    │
  │   │   - #142: 로그인 페이지 크래시 수정  │
  │   │   ...                              │
  │   │                                    │
  │   │ 📊 통계                             │
  │   │   - 총 커밋: 42건                   │
  │   │   - 기여자: 4명                     │
  │   │   - 변경 파일: 87개                 │
  │   └────────────────────────────────────┘
  │
  ▼
[7] ──── Gate L2: 전송 전 미리보기 ────
  │ 비가역 작업 미리보기:
  │   - 보고서 전문 표시
  │   - 수신자: @team_channel
  │   - "전송 후 되돌릴 수 없습니다"
  │   - 5초 쿨다운 타이머
  │
  │ [전송] ← 사용자 (5초 대기 후)
  │
  ▼
[8] Executor (계속)
  │ Step 5: DLP 스캔 통과 (코드 스니펫 없음)
  │ Step 7: Telegram Bot API sendMessage → 성공
  │
  ▼
[9] 완료
  │ "주간 보고서가 Telegram @team_channel에 전송되었습니다."
  │ 감사 로그: 전송 내용 해시 + 수신 확인 기록
```

### 핵심 검증 포인트

| # | 검증 항목 | 결과 |
|---|----------|------|
| 1 | 비가역 작업 (R3) 보호 | 미리보기 + 쿨다운 + Gate |
| 2 | DLP 스캔 | 보고서 내 코드/시크릿 검사 |
| 3 | 외부 전송 Gate | Telegram 전송 전 내용 확인 |
| 4 | GitHub Token 보호 | Vault 참조, 로그에 미노출 |
| 5 | 데이터 분류 | 커밋 메시지 = INTERNAL, 전송 시 검증 |
| 6 | 비가역 감사 | 전송 내용 해시 영구 보존 |

---

## AD-C. 시나리오 3: API 헬스체크 + 자동 장애 대응

### 배경

```
사용자: "프로덕션 API 3개의 헬스체크해서 문제 있으면 알려주고, 간단한 건 자동 수정해줘"
```

### 전체 흐름 (조건 분기 포함)

```
사용자 요청
  │
  ▼
[1] Spec Agent
  │ 의도:
  │   - action: HEALTH_CHECK + CONDITIONAL_REMEDIATION
  │   - targets: [api-auth.prod, api-data.prod, api-notify.prod]
  │   - auto_fix: 간단한 문제만 (사용자 정의 필요)
  │   - risk_flags: [PRODUCTION, EXTERNAL_SERVICE, CONDITIONAL_EXECUTION]
  │
  ▼
[2] Policy/Risk Agent
  │ Risk Score: 75 (HIGH)
  │ 판정: NEED_APPROVAL (프로덕션 환경)
  │ 특별 정책:
  │   - 프로덕션 읽기(헬스체크): ALLOW + 모니터링
  │   - 프로덕션 쓰기(자동 수정): GATE_REQUIRED (건별)
  │   - "간단한 문제" 정의 필요 → Planner에게 위임
  │
  ▼
[3] ──── Gate L1: 계획 승인 ────
  │ 표시:
  │   - 대상: 프로덕션 API 3개
  │   - 헬스체크: 자동 실행
  │   - 자동 수정: 건별 Gate 필요 (프로덕션이므로)
  │   - Risk: HIGH (프로덕션 환경)
  │
  │ [승인] ← 사용자
  │
  ▼
[4] Planner
  │ "간단한 문제" 정의:
  │   L1 (자동 수정 가능): 서비스 재시작, 캐시 클리어, 로그 정리
  │   L2 (Gate 필요): 설정 변경, 의존성 업데이트, 스케일 조정
  │
  │ Task DAG:
  │   Step 1: 3개 API 병렬 헬스체크
  │   Step 2: 결과 분석 + 문제 분류
  │   Step 3: L1 문제 → 자동 수정 (Gate 없이) ← 단, 이것도 Gate
  │   Step 4: L2 문제 → Gate + 수동 승인
  │   Step 5: 결과 보고
  │
  ▼
[5] Executor - 헬스체크 실행
  │
  │ 결과:
  │   api-auth.prod:   ✅ 정상 (응답: 45ms)
  │   api-data.prod:   ⚠️ 느림 (응답: 3200ms, 정상: 200ms)
  │   api-notify.prod: ❌ 다운 (연결 거부)
  │
  ▼
[6] 분기 처리
  │
  ├─ api-data.prod (느림)
  │   │ 원인 분석: 캐시 만료 + 메모리 80%
  │   │ 제안: 캐시 클리어 (L1) + 메모리 모니터링
  │   │
  │   │ ──── Gate L2a: 캐시 클리어 승인 ────
  │   │ "api-data.prod 캐시를 클리어합니다"
  │   │ [승인] ← 사용자
  │   │
  │   │ 실행: 캐시 클리어 → 응답 시간 180ms로 복구
  │   │
  │
  ├─ api-notify.prod (다운)
  │   │ 원인 분석: 프로세스 크래시 (OOM Kill)
  │   │ 제안 1: 서비스 재시작 (L1)
  │   │ 제안 2: 메모리 한도 상향 (L2)
  │   │
  │   │ ──── Gate L2b: 재시작 승인 ────
  │   │ "api-notify.prod를 재시작합니다"
  │   │ 위험 경고: "프로덕션 서비스 재시작"
  │   │ [승인] ← 사용자
  │   │
  │   │ 실행: 서비스 재시작 → 정상 복구 (응답: 55ms)
  │   │
  │   │ ──── Gate L2c: 메모리 한도 변경 ────
  │   │ "메모리 한도를 512MB → 1GB로 상향합니다"
  │   │ [승인] 또는 [거부 - 나중에]
  │   │
  │
  ▼
[7] 결과 보고
  │
  │ ┌───────────────────────────────────────────────┐
  │ │ 🏥 프로덕션 API 헬스체크 결과                    │
  │ │                                               │
  │ │ api-auth.prod:   ✅ 정상 (45ms)                │
  │ │ api-data.prod:   ✅ 복구됨 (3200ms → 180ms)    │
  │ │   └─ 조치: 캐시 클리어                          │
  │ │ api-notify.prod: ✅ 복구됨 (다운 → 55ms)        │
  │ │   └─ 조치: 서비스 재시작                        │
  │ │   └─ 보류: 메모리 한도 상향 (사용자 판단 대기)    │
  │ │                                               │
  │ │ 다음 헬스체크: 1시간 후 자동 실행 (체인 등록됨)    │
  │ └───────────────────────────────────────────────┘
  │
  ▼
[8] 완료 + 후속 체인 등록
  │ - 1시간 후 자동 헬스체크 체인 등록
  │ - 감사 로그: 전체 진단 + 조치 기록
```

### 핵심 검증 포인트

| # | 검증 항목 | 결과 |
|---|----------|------|
| 1 | 프로덕션 환경 HIGH risk 판정 | Correct - 모든 조치에 Gate 적용 |
| 2 | 조건 분기 (정상/느림/다운) | 상태별 다른 복구 전략 실행 |
| 3 | L1/L2 자동 수정 분류 | Planner가 사전 정의, 모두 Gate 필수 (프로덕션) |
| 4 | 부분 승인/거부 | L2c(메모리 변경)는 거부 가능, 나머지는 진행 |
| 5 | 후속 작업 체이닝 | 1시간 후 자동 헬스체크 체인 등록 |
| 6 | 비가역 작업 경고 | 서비스 재시작 시 경고 표시 |
| 7 | 감사 추적 | 진단 결과 + 조치 내역 + 복구 결과 전체 기록 |

---

## AD-D. 시나리오 비교 요약

```
┌──────────────┬──────────────────┬──────────────────┬───────────────────┐
│ 비교 항목     │ AD-A (Slack→Notion)│ AD-B (GitHub→TG) │ AD-C (API Health)  │
├──────────────┼──────────────────┼──────────────────┼───────────────────┤
│ 복잡도       │ L3 (복잡)          │ L3 (복잡)         │ L4 (위험)          │
│ 위험도       │ MEDIUM (55)       │ MEDIUM (60)      │ HIGH (75)         │
│ 외부 API     │ Slack + Notion    │ GitHub + Telegram│ 프로덕션 API 3개   │
│ 비가역 작업  │ 없음              │ Telegram 전송    │ 서비스 재시작       │
│ Gate 수      │ 2개 (L1, L2)     │ 2개 (L1, L2)     │ 4개 (L1, L2a~c)   │
│ PII 처리     │ 이메일 마스킹     │ DLP 스캔         │ 해당 없음          │
│ 체이닝       │ 없음              │ 없음             │ 후속 헬스체크 등록  │
│ 분기 처리    │ 없음              │ 없음             │ 상태별 3-way 분기  │
│ 에이전트 수  │ 6개               │ 6개              │ 7개 (분기 포함)    │
│ 예상 비용    │ ~$0.50            │ ~$0.45           │ ~$0.80            │
│ 예상 시간    │ ~45초             │ ~60초            │ ~120초            │
└──────────────┴──────────────────┴──────────────────┴───────────────────┘
```

---

## AD-E. 시나리오에서 도출된 설계 검증 결과

### 검증 통과 항목

```
✅ 7+ 승인 게이트 시스템이 실제 시나리오에서 유효하게 작동
✅ Capability Token의 1회성 사용이 외부 API 연동에서도 적용 가능
✅ 비가역 작업(R3) 보호 장치가 Telegram/서비스 재시작에 적용
✅ DLP 스캔이 외부 전송 전 민감 데이터를 필터링
✅ Credential Vault가 API Token을 안전하게 관리
✅ 감사 로그가 외부 API 호출까지 완전히 추적
✅ 조건 분기(AD-C)가 XState v5 상태 머신으로 표현 가능
✅ 작업 체이닝(AD-C 후속)이 설계와 일관
```

### 추가 발견 사항

```
⚠️ 외부 API Rate Limit 통합 관리 필요
   → 에이전트가 아닌 Executor 레벨에서 Rate Limit 관리

⚠️ 외부 서비스 인증 다양성 (OAuth, API Key, Bot Token)
   → Vault 스키마에 인증 유형별 처리 추가 필요

⚠️ 프로덕션 환경 "자동 수정" 범위 표준화
   → L1/L2 분류 기준을 정책 DSL로 정의 필요

⚠️ 비가역 작업 후 "확인" 단계 자동화
   → 전송 성공 여부 자동 검증 + 실패 시 알림
```

---

# 부록: 설계 성숙도 평가

```
┌──────────────────────┬───────┬─────────────────────────────────┐
│ 영역                  │ 성숙도 │ 평가                             │
├──────────────────────┼───────┼─────────────────────────────────┤
│ 에이전트 역할 정의    │ ★★★★★ │ 9개 에이전트 완전 정의            │
│ 보안 설계            │ ★★★★★ │ 3중 방어, Vault, DLP 완비        │
│ 정책 시스템          │ ★★★★☆ │ 3단 정책 + DSL, 충돌 해결 필요    │
│ 상태 머신            │ ★★★★☆ │ XState v5 정의, 병렬 상태 보강    │
│ UI/UX 설계           │ ★★★★☆ │ 3패널 + 게이트 상세, 구현 필요    │
│ 스키마 정의          │ ★★★★☆ │ 5개 스키마 JSON 정의, 확장 필요   │
│ 테스트 전략          │ ★★★☆☆ │ 카테고리 정의, 구현 레벨 미흡     │
│ 프롬프트 전략        │ ★★☆☆☆ │ 개념만 정의, 실제 템플릿 없음     │
│ 에이전트 통신        │ ★★☆☆☆ │ 규칙만 정의, 프로토콜 상세 없음   │
│ 배포/운영            │ ★★☆☆☆ │ 로드맵만, 실제 파이프라인 없음    │
│ 모니터링             │ ★★☆☆☆ │ 감사 로그만, 실시간 모니터링 없음 │
│ 코드 구현            │ ★☆☆☆☆ │ 설계/스펙만, 코드 없음           │
└──────────────────────┴───────┴─────────────────────────────────┘

전체 성숙도: 설계 70% 완료 / 구현 0%
다음 단계: Phase 0 Foundation (코드 구현 시작)
```
