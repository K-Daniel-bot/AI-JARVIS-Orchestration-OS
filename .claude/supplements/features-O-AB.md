# JARVIS OS 확장 기능 섹션 O~AB + 보완 1~14 참조 문서

> **이 문서는 보완/확장 설계 참고 문서입니다. 핵심 에이전트 설계는 agents/ 디렉토리를 참조하세요.**
>
> O~AB 섹션은 JARVIS OS의 고급 확장 기능을 다루며, 보완 1~14는
> 핵심 시스템의 엣지 케이스와 운영 안정성을 보강합니다.

---

# O. 컨텍스트 인식 우선순위 시스템

## O-1. 작업 우선순위 컨텍스트 모델

```typescript
interface TaskPriorityContext {
  taskId: string;
  priority: 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW' | 'BACKGROUND';
  contextSignals: {
    userUrgency: number;       // 사용자 발화 긴급도 분석 (0~100)
    deadlineProximity: number; // 마감일 근접도 (0~100)
    dependencyBlocking: number; // 다른 작업 차단 여부 (0~100)
    resourceAvailability: number; // 리소스 가용성 (0~100)
  };
  schedulingPolicy: {
    preemptive: boolean;       // 현재 작업 중단 가능 여부
    maxWaitTime: number;       // 최대 대기 시간 (ms)
    batchable: boolean;        // Batch API 대상 여부
  };
}
```

## O-2. 동적 우선순위 재계산

```
우선순위 결정 흐름:
──────────────────

1. 사용자 요청 수신
   │
   ▼
2. 긴급도 신호 분석
   - 발화 패턴: "지금 당장", "급해", "ASAP" → CRITICAL 가중치
   - 컨텍스트: 빌드 실패 중, 배포 대기 중 → HIGH 가중치
   - 시간: 업무 시간 외 → 우선순위 하향 가능
   │
   ▼
3. 기존 작업 큐와 비교
   - 현재 실행 중 작업의 우선순위
   - 대기 중 작업 큐 길이
   - 예상 완료 시간
   │
   ▼
4. 스케줄링 결정
   - CRITICAL: 현재 작업 일시정지 + 즉시 실행
   - HIGH: 현재 작업 완료 후 즉시 실행
   - NORMAL: 큐 순서대로
   - LOW/BACKGROUND: 유휴 시간에 실행
```

## O-3. 우선순위 에이징 (Aging)

```
대기 시간에 따른 우선순위 자동 상승:

BACKGROUND → 30분 대기 → LOW
LOW        → 20분 대기 → NORMAL
NORMAL     → 15분 대기 → HIGH

규칙:
- HIGH → CRITICAL 자동 승급 없음 (수동만)
- 에이징은 사용자가 비활성화 가능
- 최대 대기 시간 초과 시 알림
```

---

# P. 자연어 정책 피드백 시스템

## P-1. 자연어 → 정책 변환

```typescript
interface NLPolicyConversion {
  userInput: string;           // "npm install은 항상 물어봐줘"
  parsedIntent: {
    action: string;            // "package.install"
    condition: string;         // "always"
    gateType: 'CONFIRM' | 'REVIEW' | 'BLOCK';
  };
  generatedPolicy: {
    scope: string;             // "*"
    action: string;            // "package.install"
    decision: 'GATE';
    gateMessage: string;       // "패키지 설치 확인"
    confidence: number;        // 변환 신뢰도 (0~1)
  };
  requiresConfirmation: boolean; // 정책 적용 전 사용자 확인 필요
}
```

## P-2. 정책 피드백 패턴

```
사용자 자연어 입력 예시:
──────────────────────

1. 차단 요청
   "시스템 파일은 절대 건드리지 마"
   → BLOCK { file.* WHERE path MATCHES "C:/Windows/**" }

2. 게이트 요청
   "새 패키지 설치할 때는 꼭 물어봐"
   → GATE { package.install → CONFIRM("패키지 설치 확인") }

3. 허용 확대
   "~/projects 폴더는 자유롭게 수정해도 돼"
   → ALLOW { file.write IN ~/projects/** }

4. 조건부 정책
   "테스트 파일은 자동으로 만들어도 되는데, 소스 코드는 확인해줘"
   → ALLOW { file.write WHERE path MATCHES "**/*.test.*" }
   → GATE  { file.write WHERE path MATCHES "**/src/**" }

5. 시간 제한 정책
   "오늘만 npm install 자동으로 해도 돼"
   → ALLOW { package.install } TTL=24h
```

## P-3. 정책 변환 안전 장치

```
변환 신뢰도 기준:
─────────────────
- 90%+ : 자동 적용 제안 (사용자 확인 1회)
- 70-89%: 해석 결과 표시 + 사용자 확인 필수
- 50-69%: "이런 뜻인가요?" + 대안 2~3개 제시
- <50%  : "구체적으로 설명해주세요" 재질문

안전 규칙:
- 정책 확대 방향(더 많이 허용)은 항상 사용자 확인 필수
- 정책 축소 방향(더 많이 차단)은 자동 적용 가능
- Contract 위반 정책은 생성 자체 거부
```

---

# Q. 주변 환경 인식 (Ambient Awareness)

## Q-1. 환경 인식 상태 모델

```typescript
interface AmbientAwarenessState {
  system: {
    cpuUsage: number;
    memoryUsage: number;
    diskSpace: { total: number; available: number };
    networkStatus: 'ONLINE' | 'OFFLINE' | 'DEGRADED';
    batteryLevel?: number;      // 노트북인 경우
    activeProcesses: string[];
  };
  workspace: {
    openFiles: string[];
    gitStatus: {
      branch: string;
      uncommittedChanges: number;
      aheadBehind: { ahead: number; behind: number };
    };
    runningServers: { port: number; name: string }[];
    recentErrors: { file: string; message: string; timestamp: string }[];
  };
  user: {
    activeWindow: string;
    idleTime: number;           // ms
    focusedApp: string;
    recentClipboard?: string;   // 마스킹 적용
  };
  temporal: {
    localTime: string;
    workHours: boolean;
    dayOfWeek: string;
    scheduledTasks: { time: string; task: string }[];
  };
}
```

## Q-2. 환경 기반 자동 조정

```
환경 조건 → 시스템 대응:
─────────────────────────

CPU > 90%        → 에이전트 동시 실행 수 감소, Batch 우선
메모리 < 10%     → 불필요 캐시 정리, 경고 알림
디스크 < 5%      → 새 파일 생성 차단, 아카이빙 가속
배터리 < 20%     → Economy 모드 자동 전환
네트워크 불안정  → 오프라인 우선 모드
사용자 유휴 30분 → 백그라운드 작업 실행
업무 시간 외     → 알림 최소화 (DND 자동)
```

## Q-3. 프라이버시 보호

```
수집 데이터의 프라이버시 규칙:
──────────────────────────────

- 모든 환경 데이터는 로컬 전용 (서버 전송 금지)
- 클립보드 내용은 패턴 매칭만 (원문 저장 금지)
- 활성 창 정보는 타이틀만 (내용 캡처 금지)
- 프로세스 목록은 이름만 (인자/경로 제외)
- 사용자가 수집 항목별 on/off 제어 가능
- 30분마다 임시 데이터 자동 삭제
```

---

# R. 작업 체이닝 (Task Chaining)

## R-1. 작업 체인 정의

```json
{
  "chainId": "chain_daily_deploy",
  "name": "일일 배포 체인",
  "trigger": {
    "type": "SCHEDULE",
    "cron": "0 9 * * 1-5",
    "condition": "git.uncommitted == 0"
  },
  "steps": [
    {
      "stepId": "pull",
      "action": "git.pull",
      "onSuccess": "test",
      "onFailure": "notify_conflict"
    },
    {
      "stepId": "test",
      "action": "test.run",
      "args": { "suite": "unit" },
      "onSuccess": "build",
      "onFailure": "notify_test_fail"
    },
    {
      "stepId": "build",
      "action": "build.run",
      "onSuccess": "deploy_gate",
      "onFailure": "notify_build_fail"
    },
    {
      "stepId": "deploy_gate",
      "action": "gate.require",
      "gateType": "GATE_RUN_DEPLOY",
      "onApprove": "deploy",
      "onReject": "cancel"
    },
    {
      "stepId": "deploy",
      "action": "deploy.run",
      "onSuccess": "notify_success",
      "onFailure": "rollback"
    }
  ],
  "errorPolicy": {
    "maxRetries": 2,
    "retryDelay": 5000,
    "fallbackChain": "chain_rollback"
  }
}
```

## R-2. 체인 트리거 유형

| 트리거 | 설명 | 예시 |
|--------|------|------|
| `SCHEDULE` | 크론 스케줄 | 매일 오전 9시 |
| `EVENT` | 시스템 이벤트 | Git push 감지 |
| `COMPLETION` | 다른 체인 완료 | 빌드 체인 성공 후 |
| `MANUAL` | 사용자 명령 | "배포 체인 실행해줘" |
| `CONDITION` | 조건 충족 | CPU < 30% && 유휴 시간 > 10분 |

## R-3. 체인 안전 장치

```
- 체인 내 모든 Gate는 개별 승인 필요 (자동 스킵 불가)
- 체인 실행 중 사용자 개입으로 일시정지 가능
- 단계별 롤백 포인트 자동 생성
- 체인 총 실행 시간 제한 (기본 30분, 사용자 설정 가능)
- 무한 루프 방지: 동일 체인 재실행 쿨다운 5분
- 체인 실패 시 전체 롤백 또는 부분 완료 선택
```

---

# S. 크로스 디바이스 핸드오프

## S-1. 핸드오프 상태 모델

```typescript
interface HandoffState {
  handoffId: string;
  sourceDevice: {
    deviceId: string;
    platform: 'WINDOWS' | 'MAC' | 'LINUX';
    hostname: string;
    lastActiveAt: string;
  };
  targetDevice: {
    deviceId: string;
    platform: 'WINDOWS' | 'MAC' | 'LINUX';
    hostname: string;
  };
  transferData: {
    runState: RunState;          // 현재 실행 상태 전체
    pendingGates: GateState[];   // 미결 Gate 목록
    activeCapabilities: string[]; // 활성 Capability (재발급 필요)
    conversationHistory: ConversationTurn[]; // 최근 대화
    workspaceSnapshot: {
      openFiles: string[];
      gitBranch: string;
      unsavedChanges: boolean;
    };
  };
  security: {
    requireReauth: boolean;     // 재인증 필요 여부
    scopeDowngrade: boolean;    // 권한 축소 필요 여부
    transferEncryption: 'AES-256-GCM';
    transferToken: string;      // 일회성 전송 토큰
  };
  status: 'INITIATING' | 'TRANSFERRING' | 'VERIFYING' | 'COMPLETED' | 'FAILED';
}
```

## S-2. 핸드오프 흐름

```
소스 디바이스 (데스크톱)          타겟 디바이스 (노트북)
       │                              │
       │  1. "노트북으로 이어할래"       │
       │──────────────────────────────>│
       │                              │
       │  2. 상태 스냅샷 생성           │
       │  3. 암호화 + 전송 토큰 발급    │
       │                              │
       │  4. 핸드오프 데이터 전송        │
       │══════════════════════════════>│
       │                              │
       │                   5. 재인증 (생체/비밀번호)
       │                   6. 상태 복원
       │                   7. Capability 재발급
       │                   8. 권한 재평가
       │                              │
       │  9. 소스 세션 종료             │
       │  (Capability 무효화)          │
       │                              │
       │ 10. 핸드오프 완료 확인         │
       │<═════════════════════════════ │
```

## S-3. 핸드오프 보안 규칙

```
- 핸드오프 시 모든 Capability Token 재발급 (기존 토큰 무효화)
- 모바일 디바이스로 핸드오프 시 자동 권한 축소 (SUGGEST 모드)
- 전송 데이터는 AES-256-GCM 암호화
- 전송 토큰 유효시간: 5분 (초과 시 재시작)
- 핸드오프 실패 시 소스 디바이스 세션 유지
- 동시 2개 디바이스 활성 세션 금지
- 핸드오프 이력은 감사 로그에 기록
```

---

# T. 설명 가능성 보고서 (Explainability Reports)

## T-1. 보고서 생성 엔진

```typescript
interface ReportGenerator {
  generateRunReport(runId: string): Promise<RunReport>;
  generatePolicyReport(period: DateRange): Promise<PolicyReport>;
  generateSecurityAudit(period: DateRange): Promise<SecurityAuditReport>;
  generateCostReport(period: DateRange): Promise<CostReport>;
}

interface ReportConfig {
  format: 'MARKDOWN' | 'HTML' | 'JSON';
  detail: 'SUMMARY' | 'STANDARD' | 'DETAILED';
  audience: 'USER' | 'ADMIN' | 'AUDITOR';
  includeEvidence: boolean;
  includeRecommendations: boolean;
  language: string;             // 'ko' | 'en' | 'ja'
}
```

## T-2. 보고서 유형

| 보고서 | 생성 시점 | 포함 내용 |
|--------|----------|----------|
| **Run 보고서** | 각 Run 완료 후 | 요청→결과 전체 흐름, 각 단계 이유, 정책 적용 근거, 비용 |
| **정책 보고서** | 주간/월간 | 정책 적용 통계, 차단/허용 분포, 오탐지율, 정책 개선 제안 |
| **보안 감사** | 월간 | 보안 이벤트 요약, 위험도 추이, 취약점 발견, 대응 현황 |
| **비용 보고서** | 주간/월간 | 에이전트별 토큰 사용량, 모델별 비용, 최적화 제안, 추이 |
| **사용자 활동** | 요청 시 | 작업 이력, 승인 패턴, 선호도 분석, 만족도 추이 |

## T-3. "왜 이렇게 했나?" 추적 (Why-Chain)

```
각 액션에 대한 추적 가능한 근거 체인:

사용자 요청: "React 컴포넌트 만들어줘"
  │
  ├─ Spec 판단: intent=CODE_GEN, scope=~/project/src
  │   └─ 근거: "React", "컴포넌트" 키워드 → 코드 생성 의도
  │
  ├─ Policy 판정: ALLOW (Risk: LOW, Score: 15)
  │   └─ 근거: scope 내 파일 생성, 패키지 설치 없음
  │   └─ 적용 정책: safe-web-project.rule_3
  │
  ├─ Plan 결정: 3단계 (파일 생성 → 코드 작성 → 테스트)
  │   └─ 근거: 단일 컴포넌트, 테스트 파일 포함 관례
  │
  └─ Codegen 선택: React + TypeScript + Vitest
      └─ 근거: 프로젝트 tsconfig.json 감지, 기존 테스트 패턴 참조
```

---

# U. 프라이버시 및 데이터 주권

## U-1. 데이터 분류 체계

| 분류 | 예시 | 저장 위치 | AI 접근 |
|------|------|----------|---------|
| **PUBLIC** | 오픈소스 코드, 공개 문서 | 어디든 허용 | 전체 허용 |
| **INTERNAL** | 프로젝트 소스 코드, 설정 | 로컬 전용 | 작업 범위 내 허용 |
| **CONFIDENTIAL** | API Key, 환경변수, 인증정보 | Vault 전용 | 핸들만 허용 (값 접근 불가) |
| **RESTRICTED** | 개인정보, 금융정보, 의료정보 | Vault + 암호화 | 완전 차단 |

## U-2. 데이터 흐름 제어

```
데이터 유출 방지 파이프라인:
──────────────────────────

모든 외부 전송 전:
  1. 데이터 분류 태그 확인
  2. CONFIDENTIAL/RESTRICTED → 즉시 차단
  3. INTERNAL → DLP 스캔 (패턴 매칭)
  4. 민감 데이터 패턴 발견 → 차단 + 알림
  5. 정상 → 전송 허용

Claude API 전송 시:
  - 소스 코드: 허용 (API 계약상 학습 미사용)
  - API Key/비밀: 마스킹 후 전송
  - 개인정보: 익명화 후 전송 또는 차단
  - 클립보드/스크린샷: 자동 redaction 후 전송
```

## U-3. 데이터 보존 및 삭제 정책

```
┌──────────────────┬────────────┬──────────────────┐
│ 데이터 유형       │ 보존 기간   │ 삭제 방식         │
├──────────────────┼────────────┼──────────────────┤
│ 세션 임시 데이터  │ 세션 종료 시 │ 즉시 삭제         │
│ 대화 이력        │ 90일        │ 자동 삭제         │
│ 감사 로그        │ 1년         │ 해시 보존 후 삭제  │
│ 정책 파일        │ 무기한      │ 수동 삭제만       │
│ Vault 데이터     │ 무기한      │ 사용자 명시 삭제   │
│ 학습 데이터      │ 90일 미사용  │ 자동 아카이브     │
│ 캐시             │ 7일        │ LRU 삭제          │
└──────────────────┴────────────┴──────────────────┘
```

## U-4. 사용자 데이터 권리

```
사용자가 언제든 행사할 수 있는 권리:

1. 열람권: 모든 저장 데이터 조회 (UI 또는 CLI)
2. 삭제권: 선택적 또는 전체 데이터 삭제
3. 이동권: 데이터 내보내기 (JSON/CSV)
4. 수정권: 학습된 선호도/패턴 수정
5. 거부권: 특정 데이터 수집 거부
6. 초기화권: 전체 프로필/학습 데이터 초기화

$ jarvis data list              # 저장 데이터 목록
$ jarvis data export --format json  # 전체 내보내기
$ jarvis data delete --type memory  # 학습 메모리 삭제
$ jarvis data reset             # 전체 초기화
```

---

# V. 에이전트 합성 (Agent Composition)

## V-1. 에이전트 합성 패턴

```
기본 패턴: 에이전트 조합으로 복합 능력 생성
─────────────────────────────────────────

1. Pipeline 패턴 (순차)
   Spec → Policy → Planner → Codegen → Review → Test

2. Fan-Out 패턴 (병렬)
   Planner → [Codegen-1, Codegen-2, Codegen-3] → Merger

3. Consensus 패턴 (합의)
   [Review-A, Review-B, Review-C] → VotingEngine → Result

4. Escalation 패턴 (상향)
   Haiku(1차) → 실패 → Sonnet(2차) → 실패 → Opus(3차)

5. Specialist 패턴 (전문화)
   Router → {
     "frontend": Codegen-React,
     "backend": Codegen-Node,
     "database": Codegen-SQL,
     "infra": Codegen-Docker
   }
```

## V-2. 동적 에이전트 팀 구성

```typescript
interface DynamicTeamConfig {
  taskType: string;
  complexity: 'L1' | 'L2' | 'L3' | 'L4';
  requiredCapabilities: string[];
  teamComposition: {
    lead: AgentId;
    members: AgentId[];
    observers: AgentId[];      // 감시 역할
  };
  communicationPattern: 'PIPELINE' | 'FAN_OUT' | 'CONSENSUS' | 'HYBRID';
  budgetAllocation: Record<AgentId, number>; // 토큰 예산 비율
}
```

## V-3. 에이전트 합성 규칙

```
- 최소 팀: Lead(1) + Worker(1) (L1 단순 작업)
- 최대 팀: Lead(1) + Workers(5) + Observers(3) (L4 위험 작업)
- 모든 팀에 Observer 최소 1개 (감시/감사)
- Lead 에이전트만 Orchestrator에게 결과 보고
- Worker 간 직접 통신 금지 (Lead 경유)
- 합의가 필요한 경우 과반수 + 1 필수
```

---

# W. 지능형 에러 복구 (Intelligent Error Recovery)

## W-1. 에러 분류 체계

```typescript
type ErrorCategory =
  | 'TRANSIENT'        // 일시적 (네트워크, API 타임아웃)
  | 'RESOURCE'         // 리소스 부족 (메모리, 디스크)
  | 'PERMISSION'       // 권한 부족 (Capability 만료)
  | 'LOGIC'            // 로직 에러 (잘못된 계획/코드)
  | 'EXTERNAL'         // 외부 시스템 장애
  | 'SAFETY'           // 안전 위반 감지
  | 'USER_CANCEL';     // 사용자 취소

interface ErrorRecoveryStrategy {
  category: ErrorCategory;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  strategies: RecoveryAction[];
  maxAttempts: number;
  escalationPath: AgentId[];
}
```

## W-2. 복구 전략 매트릭스

```
┌──────────────┬────────────────┬─────────────────┬──────────────┐
│ 에러 유형     │ 1차 복구        │ 2차 복구         │ 3차 복구      │
├──────────────┼────────────────┼─────────────────┼──────────────┤
│ TRANSIENT    │ 지수 백오프     │ 대체 엔드포인트  │ 오프라인 큐   │
│              │ (1s, 2s, 4s)   │                 │              │
│ RESOURCE     │ 캐시 정리       │ 작업 분할       │ 일시정지     │
│              │ + GC 트리거     │ (chunk 처리)    │ + 알림       │
│ PERMISSION   │ Token 재발급    │ Policy 재평가   │ 사용자 Gate  │
│ LOGIC        │ 대안 전략 시도  │ 에이전트 교체    │ 사용자 개입  │
│ EXTERNAL     │ 재시도 (3회)    │ Fallback 서비스 │ 작업 큐잉    │
│ SAFETY       │ 즉시 중단       │ 롤백 실행       │ 잠금 + 알림  │
│ USER_CANCEL  │ 안전 중단       │ 롤백 제안       │ 상태 보존    │
└──────────────┴────────────────┴─────────────────┴──────────────┘
```

## W-3. 자동 복구 플레이북

```
에러 발생 → 분류 → 복구 전략 선택 → 실행 → 검증

자동 복구 가능 조건:
- TRANSIENT 에러: 항상 자동 재시도
- RESOURCE 에러 (LOW 심각도): 자동 정리 + 재시도
- PERMISSION 에러 (Token 만료): 자동 재발급

수동 개입 필요:
- LOGIC 에러: 계획 자체가 잘못됨 → 사용자 확인
- SAFETY 에러: 안전 위반 → 반드시 사용자 검토
- 3회 연속 실패: 자동 에스컬레이션
```

---

# X. 음성 UX 심화

## X-1. 음성 명령 문법

```
인식 가능한 음성 명령 패턴:
──────────────────────────

1. 직접 명령
   "파일 만들어줘" / "코드 수정해줘" / "테스트 실행해줘"

2. 컨텍스트 참조
   "아까 그 파일" / "방금 만든 것" / "이전 결과"

3. 승인/거부
   "승인" / "허가" / "거부" / "취소" / "그만"

4. 모드 전환
   "관찰 모드로" / "자동 모드 해제" / "긴급 정지"

5. 질문
   "왜 그렇게 했어?" / "현재 상태 알려줘" / "비용 얼마야?"

6. 수정
   "아니, 그거 말고" / "다시 해줘" / "Vue로 바꿔줘"
```

## X-2. 음성 피드백 규칙

```
JARVIS 음성 응답 규칙:
─────────────────────

1. 간결성: 최대 2문장 (상세는 UI로)
2. 확인 반복: 위험 작업은 "~을/를 실행합니다. 맞으시죠?"
3. 진행 상황: "3단계 중 2단계 완료했습니다"
4. 에러: "문제가 발생했습니다. 화면을 확인해주세요"
5. Gate: "승인이 필요합니다. '승인' 또는 '거부'를 말씀해주세요"

금지:
- 기술 용어 나열 (UI에서 표시)
- 코드 읽기 (화면으로 표시)
- 5초 이상 연속 발화
```

## X-3. 소음 환경 대응

```
소음 레벨별 대응:
─────────────────

조용 (< 40dB):  일반 음성 인식, 일반 응답
보통 (40-60dB): 노이즈 캔슬링 강화, 확인 반복 증가
시끄러움 (> 60dB): 핵심 키워드만 인식, 화면 확인 유도
매우 시끄러움:    음성 비활성화 제안, 텍스트 전환
```

---

# Y. 컴플라이언스 및 감사 확장

## Y-1. 규정 준수 프레임워크

```
지원 규정:
──────────

1. GDPR (유럽 개인정보보호)
   - 데이터 최소화 원칙 적용
   - 처리 근거 기록 (감사 로그)
   - 삭제 요청 72시간 내 처리

2. CCPA (캘리포니아 소비자 보호)
   - 데이터 판매 금지 (기본)
   - 수집 데이터 목록 제공

3. 개인정보보호법 (한국)
   - 개인정보 처리 방침 준수
   - 민감 정보 암호화 저장
   - 동의 기반 수집

4. SOC 2 Type II (기업 보안)
   - 접근 통제 (Capability Token)
   - 변경 관리 (Gate 시스템)
   - 모니터링 (감사 로그)
```

## Y-2. 감사 보고서 자동 생성

```
주간 감사 보고서 항목:
─────────────────────

1. 실행 요약
   - 총 Run 수, 성공/실패/차단
   - Gate 승인/거부 비율
   - 에이전트별 실행 통계

2. 보안 이벤트
   - HIGH/CRITICAL 이벤트 목록
   - 정책 위반 시도
   - 비정상 패턴 감지

3. 정책 변경 이력
   - 신규/수정/삭제 정책
   - 자동 학습 정책

4. 비용 분석
   - 에이전트별/모델별 토큰 사용량
   - 예산 대비 사용률

5. 권고사항
   - 정책 개선 제안
   - 보안 강화 필요 항목
```

---

# Z. 성능 최적화 심화

## Z-1. 에이전트 응답 시간 최적화

```
┌────────────────────────┬────────────┬──────────────────────┐
│ 최적화 기법             │ 적용 대상   │ 예상 효과             │
├────────────────────────┼────────────┼──────────────────────┤
│ Speculative Execution  │ Planner    │ 예측 실행으로 1~2초 단축│
│ (투기적 실행)           │            │                      │
│ Parallel Fan-Out       │ Codegen    │ 병렬 생성으로 50% 단축 │
│ Prompt Caching         │ 모든 에이전트│ 반복 작업 80%+ 단축   │
│ Response Streaming     │ UI 렌더링   │ 체감 지연 50% 감소    │
│ Model Downgrade        │ LOW risk   │ 비용 60% 감소         │
│ Context Pruning        │ 장기 세션   │ 토큰 사용 40% 감소    │
│ Batch Aggregation      │ 백그라운드  │ 비용 50% 감소         │
└────────────────────────┴────────────┴──────────────────────┘
```

## Z-2. 메모리 최적화

```
컨텍스트 윈도우 관리 전략:
─────────────────────────

1. 계층적 압축
   - 최근 3턴: 원문 유지
   - 4~10턴: 요약 (핵심 정보만)
   - 10턴 이전: 한줄 요약 또는 삭제

2. 선택적 로딩
   - 에이전트별 필요 정보만 주입
   - 코드: 관련 파일만 (전체 프로젝트 X)
   - 정책: 해당 작업 관련 정책만

3. 외부 메모리
   - SQLite에 전체 기록 보관
   - 필요 시 검색하여 컨텍스트에 주입
   - Vector DB (선택적) 시맨틱 검색
```

## Z-3. 네트워크 최적화

```
API 호출 최적화:
────────────────

1. Connection Pooling
   - Claude API 연결 재사용
   - Keep-Alive 활성화

2. Request Batching
   - 독립적인 에이전트 요청 묶어서 전송
   - Batch API 활용 (50% 할인)

3. Response Caching
   - 동일 입력 → 캐시된 응답 반환
   - TTL: 5분 (Spec), 30분 (Policy 정적 판정)

4. Retry with Backoff
   - 1초 → 2초 → 4초 → 8초 (최대)
   - 429 (Rate Limit): 헤더의 retry-after 준수
   - 500/503: 자동 재시도 (최대 3회)
```

---

# AA. 소셜 및 협업 기능

## AA-1. 외부 서비스 통합

```
지원 통합 대상:
──────────────

1. 메신저 알림
   - Slack: Gate 승인 요청, 작업 완료 알림
   - Telegram: 긴급 알림, 상태 조회 봇
   - Discord: 팀 채널 알림

2. 프로젝트 관리
   - Notion: 작업 로그 자동 기록
   - Jira: 이슈 자동 생성/업데이트
   - GitHub Issues: 버그 리포트 생성

3. CI/CD
   - GitHub Actions: 트리거 연동
   - Jenkins: 빌드 상태 모니터링

4. 모니터링
   - Grafana: 대시보드 연동
   - Sentry: 에러 추적 통합
```

## AA-2. 팀 협업 모드

```typescript
interface TeamCollaboration {
  teamId: string;
  members: {
    userId: string;
    role: 'OWNER' | 'CO_OWNER' | 'REVIEWER' | 'OBSERVER';
    permissions: string[];
  }[];
  sharedResources: {
    policies: string[];        // 공유 정책
    workspaces: string[];      // 공유 작업공간
    templates: string[];       // 공유 매크로/템플릿
  };
  approvalRules: {
    gateType: string;
    requiredApprovers: number; // Multi-sig 필요 인원
    approverRoles: string[];
  }[];
  auditVisibility: 'TEAM' | 'OWNER_ONLY' | 'ALL_MEMBERS';
}
```

## AA-3. Multi-sig Gate (공동 승인)

```
다중 서명 게이트 시나리오:
────────────────────────

L4 위험 작업 (외부 서비스 + 권한 상승):
  → Gate 요구: 2/3 승인자 필요
  → Owner: 승인
  → Co-Owner: 승인
  → Reviewer: (미결)
  → 결과: 2/3 충족 → 통과

규칙:
- OWNER는 항상 1인 포함 필수
- 24시간 내 미달성 시 자동 거부
- 거부 1건이라도 있으면 즉시 차단 (옵션)
```

---

# AB. 가역 시스템 (Reversible System)

## AB-1. Undo Stack 설계

```typescript
interface UndoStack {
  runId: string;
  checkpoints: Checkpoint[];
  maxDepth: number;            // 최대 되돌리기 깊이 (기본 50)
}

interface Checkpoint {
  checkpointId: string;
  timestamp: string;
  state: 'AVAILABLE' | 'EXPIRED' | 'CONSUMED';
  actions: UndoableAction[];
  snapshotData: {
    files: FileSnapshot[];     // 파일 상태 스냅샷
    processes: ProcessSnapshot[];
    config: ConfigSnapshot[];
  };
  estimatedUndoTime: number;   // 예상 되돌리기 시간 (ms)
}

interface UndoableAction {
  actionId: string;
  type: string;
  reversible: boolean;
  reverseAction?: {
    type: string;
    args: Record<string, any>;
  };
  warning?: string;            // 비가역적 부분 경고
}
```

## AB-2. 되돌리기 가능/불가능 분류

```
┌────────────────────┬──────────┬─────────────────────────┐
│ 작업 유형           │ 가역성    │ 되돌리기 방법            │
├────────────────────┼──────────┼─────────────────────────┤
│ 파일 생성           │ 완전 가역 │ 파일 삭제               │
│ 파일 수정           │ 완전 가역 │ 이전 버전 복원           │
│ 파일 삭제           │ 완전 가역 │ 휴지통에서 복원 (soft)   │
│ Git commit         │ 완전 가역 │ git revert             │
│ 패키지 설치         │ 부분 가역 │ uninstall (부작용 가능)  │
│ 프로세스 실행       │ 부분 가역 │ 프로세스 종료 (상태 불확실)│
│ 외부 API 호출      │ 비가역    │ 되돌리기 불가            │
│ 이메일 전송         │ 비가역    │ 되돌리기 불가            │
│ DB 데이터 변경      │ 조건부   │ 트랜잭션 롤백 (가능 시)   │
│ 네트워크 전송       │ 비가역    │ 되돌리기 불가            │
└────────────────────┴──────────┴─────────────────────────┘
```

## AB-3. 비가역 작업 보호 장치

```
비가역 작업 실행 전 필수 절차:
─────────────────────────────

1. 비가역성 경고 표시
   "이 작업은 되돌릴 수 없습니다"

2. 영향 범위 표시
   "외부 API 3곳에 데이터가 전송됩니다"

3. 대안 제시
   "먼저 시뮬레이션으로 확인하시겠습니까?"

4. 확인 Gate (무조건)
   "정말 실행하시겠습니까?" [예] [아니오]

5. 쿨다운 타이머
   "5초 후 실행됩니다" (취소 가능)
```

---

# 보완 1. 비가역 작업 정밀 분류

## 보완 1-1. 비가역성 레벨 정의

| 레벨 | 정의 | 예시 | 보호 수준 |
|------|------|------|----------|
| **R0 (완전 가역)** | 100% 원상복구 가능 | 파일 생성/수정, git commit | 일반 Gate |
| **R1 (대부분 가역)** | 일부 부작용 가능 | 패키지 설치, 설정 변경 | Gate + 경고 |
| **R2 (부분 가역)** | 상당한 부작용 | 프로세스 실행, DB 변경 | Gate + 확인 2회 |
| **R3 (비가역)** | 되돌리기 불가 | 외부 API, 이메일, 삭제(물리) | Gate + 쿨다운 + 시뮬레이션 |

## 보완 1-2. 비가역 작업 감사 강화

```
R3 작업에 대한 추가 감사:
- 실행 전 전체 상태 스냅샷 저장
- 실행 중 실시간 로깅 (1초 간격)
- 실행 후 결과 검증 + 리포트 자동 생성
- 관련 모든 증거 영구 보존 (삭제 불가)
```

---

# 보완 2. 예산-모델 연동 최적화

## 보완 2-1. 동적 모델 선택 엔진

```typescript
interface ModelSelectionEngine {
  select(request: ModelRequest): ModelChoice;
}

interface ModelRequest {
  agent: AgentId;
  taskComplexity: 'LOW' | 'MEDIUM' | 'HIGH';
  remainingBudget: number;     // 남은 토큰 예산
  qualityRequirement: number;  // 요구 품질 (0~100)
  latencyRequirement: number;  // 최대 지연 (ms)
}

interface ModelChoice {
  model: 'OPUS' | 'SONNET' | 'HAIKU';
  reason: string;
  estimatedCost: number;
  estimatedLatency: number;
  qualityEstimate: number;
}
```

## 보완 2-2. 예산 소진 전략

```
예산 사용률별 전략:
──────────────────

0~50%:   최적 모델 사용 (품질 우선)
50~70%:  중간 모델로 다운그레이드 시작
70~85%:  Haiku 우선 + 필수 작업만 Sonnet
85~95%:  Haiku 전용 + 경고 표시
95~100%: 일시정지 + "예산 추가 또는 작업 중단" 선택
100%+:   강제 정지 (진행 중 작업 안전 종료)
```

---

# 보완 3. 다중 사용자 정책 충돌 해결

## 보완 3-1. 충돌 시나리오

```
시나리오 1: 같은 파일 동시 수정
  User A: "src/app.ts 수정해줘"
  User B: "src/app.ts 삭제해줘"
  → 충돌 감지 → 선착순 잠금 → 후발 요청 대기/거부

시나리오 2: 상충 정책
  User A (Owner): "npm install 자동 허용"
  User B (Reviewer): "모든 설치 Gate 필수"
  → 높은 권한 정책 우선 (Owner > Reviewer)
  → 충돌 보고서 생성 → Owner에게 알림

시나리오 3: 리소스 경쟁
  User A: CPU 집약 작업 실행 중
  User B: 또 다른 CPU 집약 작업 요청
  → 리소스 공정 분배 (50:50) 또는 우선순위 기반
```

## 보완 3-2. 충돌 해결 규칙

```
우선순위 체계:
1. Emergency (긴급) → 무조건 최우선
2. Owner → Co-Owner → Reviewer → Observer
3. 선착순 (동일 권한 시)
4. 자동 머지 시도 (파일 수정 충돌 시)
5. 머지 불가 → 사용자 선택 Gate
```

---

# 보완 4. Emergency Stop 후 안전 재개

## 보완 4-1. 재개 절차

```
Emergency Stop 발동
  │
  ▼
1. 모든 에이전트 즉시 정지
2. 진행 중 OS 액션 안전 종료
3. Capability Token 전체 무효화
4. 상태 스냅샷 저장
  │
  ▼
재개 프로세스:
  │
  ▼
5. 사용자 인증 (재인증 필수)
6. 중단 원인 표시 + 확인
7. 상태 복원 옵션 선택:
   a) 중단 지점에서 재개
   b) 마지막 체크포인트에서 재개
   c) 전체 롤백 후 재시작
   d) 작업 폐기
8. 새 Capability Token 발급
9. 정상 운영 재개
```

## 보완 4-2. 재개 안전 검증

```
재개 전 필수 확인:
- 중단 원인이 해결되었는지 확인
- 시스템 상태가 정상인지 확인 (Health Check)
- 롤백 포인트가 유효한지 확인
- 부분 실행된 작업의 일관성 확인
- 대기 중이던 Gate 상태 확인
```

---

# 보완 5. 에이전트 토론 비용 제한

## 보완 5-1. 토론 예산 모델

```
다중 에이전트 토론 (N-6 참조) 비용 제한:
─────────────────────────────────────

총 예산 상한: 15,000 토큰
라운드 상한: 최대 3라운드
에이전트당 라운드 상한: 2,000 토큰
시간 상한: 30초

예산 분배:
  Round 1 (제안):   각 에이전트 2,000 토큰
  Round 2 (반론):   각 에이전트 1,500 토큰
  Round 3 (수정):   각 에이전트 1,000 토큰

조기 종료 조건:
- Round 1에서 전원 합의 → 즉시 종료
- Round 2에서 80%+ 합의 → Round 3 스킵
- 예산 80% 소진 → 현재 라운드 후 강제 종료
```

## 보완 5-2. 토론 비용 대비 효과 분석

```
토론 활성화 기준:
- 작업 비용이 토론 비용의 10배 이상일 때만
- 위험도 HIGH 이상일 때
- 에이전트 간 판단 불일치 감지 시

비활성화 기준:
- LOW risk 작업
- 단순 반복 작업
- 이미 패턴 캐시에 있는 작업
```

---

# 보완 6. 작업공간 프로필 자동 감지

## 보완 6-1. 감지 대상 및 방법

```
┌──────────────────┬──────────────────────────────┬──────────────┐
│ 감지 대상         │ 감지 방법                      │ 감지 결과     │
├──────────────────┼──────────────────────────────┼──────────────┤
│ 언어             │ 파일 확장자 분포 분석           │ TypeScript   │
│ 프레임워크        │ package.json dependencies     │ React + Next │
│ 패키지 매니저     │ lock 파일 존재 여부            │ pnpm         │
│ 테스트 프레임워크  │ 설정 파일 (vitest.config 등)  │ Vitest       │
│ 빌드 도구         │ 설정 파일 (turbo.json 등)     │ Turborepo    │
│ CI/CD            │ .github/workflows 존재       │ GitHub Actions│
│ Docker           │ Dockerfile / compose 존재    │ Docker 사용   │
│ 모노레포          │ workspaces 설정, turbo.json  │ 모노레포      │
│ 린터/포매터       │ .eslintrc, biome.json 등     │ Biome        │
│ Git 설정         │ .gitignore, hooks            │ husky        │
└──────────────────┴──────────────────────────────┴──────────────┘
```

## 보완 6-2. 프로필 적용 효과

```
감지된 프로필이 에이전트 동작에 미치는 영향:

Codegen:
  - 감지된 언어/프레임워크에 맞는 코드 생성
  - 프로젝트 컨벤션 자동 적용 (import 순서, 네이밍 등)

Planner:
  - 감지된 빌드/테스트 도구에 맞는 계획 생성
  - 패키지 매니저에 맞는 설치 명령

Review:
  - 프로젝트 린터 규칙에 맞는 코드 검토
  - 프레임워크별 best practice 검증

Test/Build:
  - 감지된 테스트 프레임워크로 테스트 실행
  - 빌드 도구에 맞는 빌드 명령
```

---

# 보완 7. 컨텍스트 윈도우 최적화

## 보완 7-1. 토큰 예산 관리

```
에이전트별 컨텍스트 할당:
────────────────────────

200K 컨텍스트 기준:

System Prompt:     ~5K (고정)
Contract:          ~2K (고정)
Policy Bundle:     ~3K (동적 필터)
Task Context:      ~10K (현재 작업)
Code Context:      ~50K (관련 코드)
History:           ~10K (압축 이력)
Agent Memory:      ~5K (학습 패턴)
─────────────────────────────
총 사용:           ~85K
여유:             ~115K (응답 + 안전 마진)
```

## 보완 7-2. 컨텍스트 압축 전략

```
1. 점진적 요약 (Progressive Summarization)
   - 오래된 대화: 핵심 의사결정만 보존
   - 코드: 변경된 부분만 포함 (전체 파일 X)
   - 로그: 에러/경고만 보존

2. 관련성 기반 필터링
   - 현재 작업과 관련 없는 정보 제외
   - 파일: import/export 관계 기반 선택
   - 정책: 해당 action type 관련 규칙만

3. 외부 메모리 활용
   - SQLite: 전체 이력 저장
   - 필요 시 검색하여 컨텍스트 주입
   - "기억해야 할 것" 태그로 중요 정보 마킹
```

---

# 보완 8. 신뢰 모드 강등 규칙

## 보완 8-1. 자동 강등 트리거

```
┌────────────────────────────┬──────────────────┬────────────────┐
│ 트리거                      │ 강등 대상         │ 강등 후 모드    │
├────────────────────────────┼──────────────────┼────────────────┤
│ 보안 사고 발생              │ 모든 모드         │ OBSERVE        │
│ Rollback 3회/24시간        │ AUTO → SEMI_AUTO │ SEMI_AUTO      │
│ Gate 거부 5회 연속          │ SEMI_AUTO        │ SUGGEST        │
│ Policy 위반 시도 감지       │ AUTO             │ SUGGEST        │
│ 비정상 패턴 감지            │ 현재 - 1단계     │ 한 단계 아래    │
│ 세션 TTL 만료              │ AUTO             │ SUGGEST        │
│ 디바이스 변경               │ AUTO             │ SUGGEST        │
└────────────────────────────┴──────────────────┴────────────────┘
```

## 보완 8-2. 강등 복구 절차

```
강등 후 복구:
1. 원인 분석 리포트 표시
2. 사용자가 원인 확인 + 조치
3. 복구 Gate (수동 승인)
4. 한 단계씩 점진적 복구 (급격한 복구 금지)
5. 복구 후 24시간 모니터링 강화
```

---

# 보완 9. Executor 속도 제어

## 보완 9-1. 실행 속도 프로필

```
┌────────────────┬──────────────┬──────────────────────────────┐
│ 프로필          │ 속도          │ 적용 상황                     │
├────────────────┼──────────────┼──────────────────────────────┤
│ TURBO          │ 최대 속도     │ 반복 작업, 검증된 패턴         │
│ NORMAL         │ 기본 속도     │ 일반 작업                     │
│ CAREFUL        │ 50% 감속     │ 민감 작업, 첫 실행             │
│ STEP_BY_STEP   │ 단계별 확인   │ 위험 작업, 디버그 모드         │
│ SIMULATION     │ 실행 안 함    │ 시뮬레이션 모드 (Plan만 표시)  │
└────────────────┴──────────────┴──────────────────────────────┘
```

## 보완 9-2. 자동 속도 조절

```
위험도 기반 속도 자동 선택:
- Risk LOW + 패턴 캐시 있음 → TURBO
- Risk LOW + 첫 실행 → NORMAL
- Risk MEDIUM → CAREFUL
- Risk HIGH → STEP_BY_STEP
- Risk CRITICAL → SIMULATION (실행 불가, 시뮬레이션만)
```

---

# 보완 10. 크로스 플랫폼 추상화

## 보완 10-1. OS 추상화 레이어

```typescript
interface OSAbstractionLayer {
  // 파일 시스템
  fs: {
    read(path: string): Promise<Buffer>;
    write(path: string, data: Buffer): Promise<void>;
    delete(path: string): Promise<void>;
    list(path: string): Promise<FileEntry[]>;
    watch(path: string): Observable<FileEvent>;
  };
  // 프로세스
  process: {
    launch(cmd: string, args: string[]): Promise<ProcessHandle>;
    kill(pid: number): Promise<void>;
    list(): Promise<ProcessInfo[]>;
  };
  // 클립보드
  clipboard: {
    read(): Promise<string>;
    write(text: string): Promise<void>;
  };
  // 알림
  notification: {
    show(title: string, body: string): Promise<void>;
  };
  // 자격증명
  credential: {
    store(key: string, value: string): Promise<void>;
    retrieve(key: string): Promise<string>;
    delete(key: string): Promise<void>;
  };
}
```

## 보완 10-2. 플랫폼별 구현 매핑

```
┌──────────────┬──────────────────┬────────────────┬──────────────┐
│ 기능          │ Windows           │ macOS          │ Linux        │
├──────────────┼──────────────────┼────────────────┼──────────────┤
│ 파일 시스템   │ Win32 API         │ Foundation     │ POSIX        │
│ 프로세스     │ CreateProcess     │ NSTask         │ fork/exec    │
│ 클립보드     │ Win32 Clipboard   │ NSPasteboard   │ xclip/wl-copy│
│ 알림         │ Toast Notification│ NSNotification │ notify-send  │
│ 자격증명     │ Credential Manager│ Keychain       │ Secret Service│
│ 자동화       │ PowerShell + COM  │ osascript      │ D-Bus + xdotool│
│ 브라우저     │ Playwright        │ Playwright     │ Playwright   │
└──────────────┴──────────────────┴────────────────┴──────────────┘
```

---

# 보완 11. 감사 로그 검색 및 분석

## 보완 11-1. 검색 인터페이스

```
$ jarvis audit search --from 2026-03-01 --to 2026-03-07
$ jarvis audit search --agent Policy --risk HIGH
$ jarvis audit search --action file.delete
$ jarvis audit search --status DENIED --limit 50
$ jarvis audit search --query "npm install lodash"

필터 조합 가능:
$ jarvis audit search \
    --agent Executor \
    --risk HIGH \
    --from 2026-03-01 \
    --status SUCCESS \
    --format json
```

## 보완 11-2. 분석 쿼리 지원

```
통계 분석:
$ jarvis audit stats --period weekly
  → 주간 실행/차단/롤백 수
  → 에이전트별 성공률
  → 위험도 분포 추이
  → 가장 빈번한 액션 유형

이상 탐지:
$ jarvis audit anomaly --period daily
  → 비정상적으로 많은 실행
  → 비정상적 시간대 활동
  → 새로운 고위험 패턴
  → 반복 실패 패턴
```

---

# 보완 12. Gate 타임아웃 동적 조절

## 보완 12-1. 타임아웃 규칙

```
┌────────────────────┬────────────────┬──────────────────────┐
│ 게이트 유형         │ 기본 타임아웃   │ 동적 조절             │
├────────────────────┼────────────────┼──────────────────────┤
│ GATE_PLAN_SCOPE    │ 30분           │ 복잡도에 비례 증가     │
│ GATE_APPLY_CHANGES │ 15분           │ 변경 파일 수에 비례    │
│ GATE_RUN_DEPLOY    │ 10분           │ 위험도에 반비례 감소   │
│ GATE_WEB_PRECHECK  │ 5분            │ 고정                 │
│ GATE_DOWNLOAD      │ 10분           │ 파일 크기에 비례      │
│ GATE_DESTRUCTIVE   │ 5분            │ 고정 (위험하므로 짧게) │
│ GATE_POLICY_UPDATE │ 60분           │ 영향 범위에 비례      │
└────────────────────┴────────────────┴──────────────────────┘
```

## 보완 12-2. 타임아웃 시 동작

```
타임아웃 발생:
1. 안전 기본값 적용 (DENY)
2. 사용자에게 만료 알림
3. 작업 일시정지 (PAUSED 상태)
4. 감사 로그에 타임아웃 기록
5. 재개 옵션 제공:
   - "Gate 다시 열기" (새 타임아웃)
   - "작업 취소"
   - "롤백"
```

---

# 보완 13. 병렬 상태 관리 (XState v5)

## 보완 13-1. 병렬 상태 설계

```
XState v5 병렬 상태 예시:
────────────────────────

parallel: {
  mainPipeline: {
    states: {
      spec: { ... },
      policy: { ... },
      planning: { ... },
      codegen: { ... },
      review: { ... },
      testing: { ... }
    }
  },
  monitoring: {
    states: {
      healthCheck: { ... },    // 에이전트 상태 감시
      budgetWatch: { ... },    // 토큰 예산 감시
      safetyWatch: { ... }     // 안전 이상 감시
    }
  },
  userInterface: {
    states: {
      idle: { ... },
      gateWaiting: { ... },    // Gate 승인 대기
      notifying: { ... }       // 알림 표시
    }
  }
}
```

## 보완 13-2. 병렬 상태 동기화

```
동기화 규칙:
- safetyWatch가 ALERT 발생 → mainPipeline 즉시 PAUSE
- budgetWatch가 DEPLETED → mainPipeline 경고 + 다운그레이드
- mainPipeline이 GATE_WAITING → userInterface 전환
- 모든 병렬 상태의 이벤트는 감사 로그에 기록
```

---

# 보완 14. 부분 완료 처리

## 보완 14-1. 부분 완료 상태 정의

```typescript
interface PartialCompletionState {
  runId: string;
  totalSteps: number;
  completedSteps: number;
  failedStep: {
    stepId: string;
    error: string;
    attemptCount: number;
  };
  completedArtifacts: {
    files: string[];           // 성공적으로 생성/수정된 파일
    actions: string[];         // 성공적으로 실행된 액션
  };
  options: PartialCompletionOption[];
}

type PartialCompletionOption =
  | 'KEEP_PARTIAL'             // 완료된 부분 유지
  | 'ROLLBACK_ALL'             // 전체 롤백
  | 'ROLLBACK_FAILED_ONLY'     // 실패 부분만 롤백
  | 'RETRY_FAILED'             // 실패 부분 재시도
  | 'SKIP_AND_CONTINUE';       // 실패 건너뛰고 계속
```

## 보완 14-2. 부분 완료 처리 흐름

```
작업 중 실패 발생
  │
  ▼
1. 실패 지점 기록
2. 완료된 부분 목록 생성
3. 사용자에게 옵션 제시:
   ┌───────────────────────────────────────┐
   │ 5단계 중 3단계까지 완료, 4단계에서 실패  │
   │                                       │
   │ 완료된 작업:                            │
   │ ✅ 1. 파일 생성 (src/Modal.tsx)         │
   │ ✅ 2. 스타일 추가 (src/Modal.css)       │
   │ ✅ 3. 테스트 작성 (src/Modal.test.tsx)  │
   │ ❌ 4. 스토리북 추가 (실패: 의존성 없음)   │
   │ ⏸ 5. index.ts 업데이트 (미실행)         │
   │                                       │
   │ [완료된 것 유지] [전체 롤백] [재시도]     │
   └───────────────────────────────────────┘
4. 사용자 선택에 따라 처리
5. 결과 감사 로그 기록
```

---

# 확장 기능 총 요약

```
총 41개 확장/보완 항목 (O~AB + 보완 1~14)

확장 기능 (O~AB):
O. 컨텍스트 인식 우선순위 (3개)
P. 자연어 정책 피드백     (3개)
Q. 주변 환경 인식         (3개)
R. 작업 체이닝            (3개)
S. 크로스 디바이스 핸드오프 (3개)
T. 설명 가능성 보고서     (3개)
U. 프라이버시/데이터 주권  (4개)
V. 에이전트 합성          (3개)
W. 지능형 에러 복구       (3개)
X. 음성 UX 심화           (3개)
Y. 컴플라이언스/감사      (2개)
Z. 성능 최적화 심화       (3개)
AA. 소셜/협업             (3개)
AB. 가역 시스템           (3개)

보완 항목 (1~14):
1. 비가역 작업 정밀 분류   5. 에이전트 토론 비용 제한
2. 예산-모델 연동          6. 작업공간 프로필 자동 감지
3. 다중 사용자 정책 충돌   7. 컨텍스트 윈도우 최적화
4. Emergency Stop 재개    8. 신뢰 모드 강등 규칙
                          9. Executor 속도 제어
                         10. 크로스 플랫폼 추상화
                         11. 감사 로그 검색/분석
                         12. Gate 타임아웃 동적 조절
                         13. 병렬 상태 관리 (XState)
                         14. 부분 완료 처리
```
