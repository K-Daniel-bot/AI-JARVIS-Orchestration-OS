# JARVIS OS — 에이전트 간 메시지 통신 프로토콜

> 이 문서는 9개 에이전트 사이의 모든 메시지 통신 규격을 정의합니다.
> 모든 에이전트는 이 프로토콜을 준수해야 하며, 임의 형식의 통신은 금지됩니다.
> 참조: `.claude/design/architecture-deep.md` §7

---

## 1. 통신 아키텍처 개요

```
에이전트 A (Producer) → MessageBus (Queue) → 에이전트 B (Consumer)
                              ↑
                   Orchestrator = Queue Manager
                   (라우팅, 우선순위, 타임아웃 관리)
```

### 핵심 원칙

- **Orchestrator 경유 필수**: 에이전트 간 직접 통신 금지 (contract.md §5)
- **비동기 큐 방식**: 순서 보장, 손실 방지
- **Zod 런타임 검증**: 모든 메시지 수신 시 페이로드 스키마 검증 필수
- **감사 로그 연동**: 모든 메시지 송수신은 AuditEntry로 기록

---

## 2. 에이전트 ID 타입 정의

```typescript
/**
 * 에이전트 식별자 형식 — kebab-case (lowercase-with-hyphens)
 *
 * 표준화 규칙 (api-endpoints.md와 통일):
 * - 로그 기록 시 반드시 kebab-case 사용
 * - 메시지 버스 라우팅 시 kebab-case 유지
 * - 환경변수, 설정 파일도 kebab-case
 *
 * 잘못된 예: 'ORCHESTRATOR', 'Spec_Agent', 'SpecAgent'
 * 올바른 예: 'orchestrator', 'spec-agent', 'policy-risk'
 */
type AgentId =
  | 'orchestrator'
  | 'spec-agent'
  | 'policy-risk'
  | 'planner'
  | 'codegen'
  | 'review'
  | 'test-build'
  | 'executor'
  | 'rollback';

// 브로드캐스트 대상 (전체 에이전트)
type MessageTarget = AgentId | 'BROADCAST';

// 런타임 식별자 타입 (브랜드 타입으로 오용 방지)
type RunId = string & { readonly __brand: 'RunId' };
type SessionId = string & { readonly __brand: 'SessionId' };
```

---

## 3. 메시지 타입 열거

```typescript
// 에이전트 간 교환되는 메시지의 종류를 정의한다
type MessageType =
  | 'HANDOFF'           // 에이전트 작업 결과 전달 (파이프라인 진행)
  | 'ERROR'             // 에러 보고 (실패 에이전트 → Orchestrator)
  | 'UPSTREAM_FAILURE'  // 상위 에이전트 실패 알림 (Orchestrator → 의존 에이전트)
  | 'HEARTBEAT'         // 건강 체크 요청 (Orchestrator → 각 에이전트, 5초 주기)
  | 'HEARTBEAT_ACK'     // 건강 체크 응답 (에이전트 → Orchestrator)
  | 'GATE_REQUEST'      // Gate 승인 요청 (에이전트 → Orchestrator → UI)
  | 'GATE_RESPONSE'     // Gate 승인/거부 응답 (UI → Orchestrator → 에이전트)
  | 'ABORT'             // 비상 중단 명령 (Orchestrator → 전체, BROADCAST 가능)
  | 'STATUS_QUERY'      // 상태 조회 요청 (Orchestrator → 에이전트)
  | 'STATUS_RESPONSE';  // 상태 조회 응답 (에이전트 → Orchestrator)
```

---

## 4. AgentMessage 기본 스키마

### 4.1 TypeScript 인터페이스

```typescript
// 에이전트 간 모든 메시지의 공통 기본 구조
interface AgentMessage {
  // 메시지 고유 식별자 — msg_{날짜}_{순번} 형식
  messageId: string;

  // 발신 에이전트 ID
  fromAgent: AgentId;

  // 수신 에이전트 ID 또는 'BROADCAST'
  toAgent: MessageTarget;

  // 메시지 종류
  messageType: MessageType;

  // 메시지 생성 시각 (ISO 8601, 시간대 포함)
  timestamp: string;

  // 이 메시지가 속한 실행 Run ID
  runId: RunId;

  // 현재 세션 ID (세션 TTL 검증에 사용)
  sessionId: SessionId;

  // 메시지 종류별 페이로드 (§5에서 상세 정의)
  payload: MessagePayload;

  // 응답 대기 최대 시간(ms). 기본값: 60000 (1분)
  timeoutMs: number;

  // 재시도 정책
  retryPolicy: RetryPolicy;
}

// 재시도 정책 정의
interface RetryPolicy {
  // 최대 재시도 횟수. 기본값: 2
  maxRetries: number;

  // 재시도 간 초기 대기 시간(ms). 기본값: 5000. 지수 백오프 적용
  // 실제 대기 = backoffMs * (2 ^ 재시도 횟수)
  backoffMs: number;
}
```

### 4.2 JSON 예시 (HANDOFF 메시지)

```json
{
  "messageId": "msg_20260302_0042",
  "fromAgent": "SPEC_AGENT",
  "toAgent": "POLICY_RISK",
  "messageType": "HANDOFF",
  "timestamp": "2026-03-02T09:00:00+09:00",
  "runId": "run_20260302_0007",
  "sessionId": "sess_20260302_0001",
  "payload": {
    "artifactType": "SPEC",
    "artifactRef": "/.ai-run/run_20260302_0007/SPEC.md",
    "summary": "사용자 요청: React 컴포넌트 구현",
    "metadata": {
      "riskHints": ["NETWORK_ACCESS_POSSIBLE"],
      "estimatedComplexity": "MEDIUM"
    }
  },
  "timeoutMs": 60000,
  "retryPolicy": {
    "maxRetries": 2,
    "backoffMs": 5000
  }
}
```

---

## 5. MessagePayload 타입별 상세 정의

```typescript
// 모든 페이로드 타입의 유니온 — MessageType과 1:1 대응
type MessagePayload =
  | HandoffPayload
  | ErrorPayload
  | UpstreamFailurePayload
  | HeartbeatPayload
  | HeartbeatAckPayload
  | GateRequestPayload
  | GateResponsePayload
  | AbortPayload
  | StatusQueryPayload
  | StatusResponsePayload;
```

### 5.1 HANDOFF — 작업 결과 전달

```typescript
// 파이프라인의 다음 에이전트에게 산출물을 전달할 때 사용한다
interface HandoffPayload {
  // 전달되는 산출물 종류
  artifactType: 'SPEC' | 'PLAN' | 'POLICY_DECISION' | 'CHANGESET' | 'REVIEW_RESULT' | 'TEST_RESULT';

  // 산출물 파일 경로 (Environment Bundle 내 상대 경로 또는 절대 경로)
  artifactRef: string;

  // 산출물 요약 (다음 에이전트가 빠르게 파악할 수 있는 1~3줄 설명)
  summary: string;

  // 추가 메타데이터
  metadata: {
    // 위험 신호 힌트 (Policy Agent가 참고할 항목)
    riskHints?: string[];
    // 추정 복잡도
    estimatedComplexity?: 'LOW' | 'MEDIUM' | 'HIGH';
    // 이전 단계에서 소비한 토큰 수
    tokensUsed?: number;
  };
}
```

### 5.2 ERROR — 에러 보고

```typescript
// 에이전트 내부에서 복구 불가한 에러가 발생했을 때 Orchestrator에 보고한다
interface ErrorPayload {
  // 에러 코드 (error-catalog.md에 정의된 코드만 허용)
  errorCode:
    | 'AGENT_TIMEOUT'
    | 'VALIDATION_FAILED'
    | 'RESOURCE_EXHAUSTED'
    | 'INTERNAL_ERROR'
    | 'POLICY_DENIED'
    | 'TOKEN_INVALID'
    | 'TOKEN_EXPIRED'
    | 'TOKEN_SCOPE_MISMATCH'
    | 'HASH_MISMATCH'
    | 'DB_ERROR';

  // 내부 디버그 메시지 (사용자에게 미노출)
  internalMessage: string;

  // 사용자에게 표시할 안전한 메시지
  userMessage: string;

  // 에러 발생 당시 XState 상태명
  occurredInState: string;

  // 이미 시도한 재시도 횟수
  retriesAttempted: number;

  // 재시도 가능 여부
  retryable: boolean;

  // OS 조작 차단 여부
  blocksOsActions: boolean;
}
```

### 5.3 UPSTREAM_FAILURE — 상위 에이전트 실패 알림

```typescript
// Orchestrator가 의존 에이전트들에게 상위 에이전트의 실패를 알릴 때 사용한다.
// 수신한 에이전트는 진행 중인 작업을 대기 상태로 전환하여 토큰 낭비를 방지한다.
interface UpstreamFailurePayload {
  // 실패한 에이전트 ID
  failedAgent: AgentId;

  // 실패 에이전트의 에러 코드
  errorCode: string;

  // 의존 에이전트에게 취할 행동 지시
  instruction: 'PAUSE' | 'CANCEL' | 'CONTINUE_WITH_PARTIAL';

  // 복구 예상 시간(ms). null이면 미정
  estimatedRecoveryMs: number | null;
}
```

### 5.4 HEARTBEAT — 건강 체크 요청

```typescript
// Orchestrator가 5초마다 각 에이전트에게 생존 확인 요청을 보낸다
interface HeartbeatPayload {
  // 이 heartbeat 요청의 시퀀스 번호 (응답과 매칭에 사용)
  seq: number;

  // 요청 시각 (응답 지연 계산용)
  requestedAt: string;
}
```

### 5.5 HEARTBEAT_ACK — 건강 체크 응답

```typescript
// 에이전트가 HEARTBEAT에 응답할 때 현재 건강 상태를 포함한다
// AgentHealthState 구조는 architecture-deep.md §6.2 참조
interface HeartbeatAckPayload {
  // 대응하는 HEARTBEAT의 seq 번호
  seq: number;

  // 에이전트 현재 건강 상태
  healthState: AgentHealthState;
}

// 에이전트 건강 상태 모델 (architecture-deep.md §6.2)
interface AgentHealthState {
  agentId: string;
  agentType: string;
  status: 'HEALTHY' | 'DEGRADED' | 'UNRESPONSIVE' | 'CRASHED';
  lastHeartbeatAt: string;
  currentTaskId?: string;
  cpuUsage?: number;
  memoryUsageMB?: number;
  consecutiveFailures: number;
  lastError?: string;
}
```

### 5.6 GATE_REQUEST — Gate 승인 요청

```typescript
// 에이전트가 사용자 승인이 필요한 작업을 수행하기 전에 Gate를 요청한다.
// Orchestrator는 이를 UI의 GateApprovalCard에 전달한다.
interface GateRequestPayload {
  // Gate 레벨 (L1: 계획 승인, L2: 변경 승인, L3: 실행/배포 승인)
  gateLevel: 'L1' | 'L2' | 'L3';

  // Gate 종류
  gateType:
    | 'PLAN_APPROVAL'
    | 'CHANGESET_APPROVAL'
    | 'EXECUTION_APPROVAL'
    | 'CAPABILITY_APPROVAL';

  // 사용자에게 표시할 작업 설명 (what)
  displayTitle: string;

  // 이 작업이 필요한 이유 (why)
  rationale: string;

  // Risk 정보
  riskInfo: {
    score: number;          // 0~100
    level: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    reasons: string[];
  };

  // 사용자가 검토할 산출물 참조 (PLAN.json, CHANGES.json 등)
  artifactRef?: string;

  // 이 Gate 승인 요청의 만료 시간(ms). 기본값: 600000 (10분)
  expiresInMs: number;
}
```

### 5.7 GATE_RESPONSE — Gate 승인/거부 응답

```typescript
// 사용자가 UI에서 Gate를 승인 또는 거부한 결과를 에이전트에 전달한다
interface GateResponsePayload {
  // 대응하는 GATE_REQUEST의 gateType
  gateType: string;

  // 사용자 결정
  decision: 'APPROVED' | 'REJECTED' | 'DEFERRED';

  // 사용자 결정 시각
  decidedAt: string;

  // 사용자 ID
  decidedBy: string;

  // 거부 또는 연기 사유 (decision이 REJECTED 또는 DEFERRED인 경우)
  reason?: string;

  // 승인 시 발급된 Capability Token ID 목록
  capabilityTokenIds?: string[];
}
```

### 5.8 ABORT — 비상 중단

```typescript
// 사용자 명령 또는 시스템 판단으로 모든 에이전트를 즉시 정지시킨다.
// BROADCAST 대상으로 전송되며, 수신한 에이전트는 즉시 작업을 중단해야 한다.
// (contract.md §7 비상 중단 프로토콜)
interface AbortPayload {
  // 중단 사유
  reason: 'USER_REQUESTED' | 'POLICY_VIOLATION' | 'SECURITY_ALERT' | 'EMERGENCY_STOP';

  // 사람이 읽을 수 있는 중단 사유 설명
  explanation: string;

  // 체크포인트 저장 여부 (false이면 즉시 종료만)
  saveCheckpoint: boolean;

  // 발급된 Capability Token 무효화 여부 (기본 true)
  revokeCapabilities: boolean;
}
```

### 5.9 STATUS_QUERY — 상태 조회 요청

```typescript
// Orchestrator가 특정 에이전트의 현재 작업 진행 상태를 조회한다
interface StatusQueryPayload {
  // 조회 요청 시퀀스 번호 (응답 매칭용)
  queryId: string;

  // 조회 항목 (전부 조회 시 빈 배열 또는 생략)
  fields?: Array<'progress' | 'currentTask' | 'tokenUsage' | 'lastError'>;
}
```

### 5.10 STATUS_RESPONSE — 상태 조회 응답

```typescript
// 에이전트가 STATUS_QUERY에 응답하여 현재 진행 상태를 전달한다
interface StatusResponsePayload {
  // 대응하는 STATUS_QUERY의 queryId
  queryId: string;

  // 현재 진행률 (0~100). 알 수 없으면 null
  progress: number | null;

  // 현재 수행 중인 작업 ID
  currentTaskId?: string;

  // 현재 단계 설명 (사용자에게 표시 가능)
  currentStepDescription: string;

  // 이번 Run에서 이 에이전트가 사용한 토큰 수
  tokenUsed: number;

  // 마지막 에러 정보 (없으면 null)
  lastError?: {
    errorCode: string;
    occurredAt: string;
  } | null;
}
```

---

## 6. MessageBus 인터페이스

```typescript
// 에이전트 메시지 버스 — 에이전트 간 구조화된 메시지를 라우팅하는 핵심 인프라
interface MessageBus {
  // 메시지를 큐에 넣고 대상 에이전트에 전달한다
  // 실패 시 retryPolicy에 따라 재시도. 모든 실패는 Result로 반환 (throw 금지)
  send(message: AgentMessage): Promise<Result<void, JarvisError>>;

  // 특정 에이전트의 메시지 수신 핸들러를 등록한다
  subscribe(agentId: AgentId, handler: MessageHandler): void;

  // 에이전트의 메시지 수신 핸들러를 해제한다 (에이전트 종료 시 호출)
  unsubscribe(agentId: AgentId): void;

  // 특정 에이전트의 수신 대기 큐 크기를 반환한다
  getQueueSize(agentId: AgentId): number;

  // 특정 에이전트의 큐를 비울 때까지 대기한다 (ABORT 이후 정리용)
  drain(agentId: AgentId): Promise<void>;
}

// 메시지 수신 핸들러 타입 — 에러 발생 시 Result를 반환하거나 내부에서 처리한다
type MessageHandler = (message: AgentMessage) => Promise<void>;
```

### MessageBus 구현 메모

```
- 내부 구현: 인메모리 큐 (Phase 0~1), 외부 브로커 선택적 도입 (Phase 3)
- 메시지 순서: 에이전트별 FIFO (큐 격리)
- 최대 큐 크기: 에이전트당 100개 (초과 시 RESOURCE_EXHAUSTED 에러)
- 메시지 직렬화: JSON.stringify (순환 참조 사전 감지 필수)
- 타임아웃 처리: timeoutMs 초과 시 AGENT_TIMEOUT 에러 자동 생성
```

---

## 7. Heartbeat 프로토콜

### 7.1 동작 설정

| 항목 | 값 |
|------|-----|
| 전송 주기 | 5초 |
| 응답 타임아웃 | 30초 |
| 연속 실패 임계값 | 3회 |
| 3회 실패 시 전환 상태 | `UNRESPONSIVE` |

### 7.2 Heartbeat 흐름

```
Orchestrator (5초 주기)
  │
  ├── HEARTBEAT (seq: N) → SPEC_AGENT
  ├── HEARTBEAT (seq: N) → POLICY_RISK
  ├── HEARTBEAT (seq: N) → PLANNER
  ├── HEARTBEAT (seq: N) → CODEGEN
  └── ... (나머지 에이전트)

각 에이전트
  │
  ├── 응답 O (30초 이내) → HEARTBEAT_ACK (seq: N, healthState) → Orchestrator
  │     → Orchestrator: consecutiveFailures = 0, status = HEALTHY
  │
  └── 응답 X (30초 초과) → Orchestrator: consecutiveFailures += 1
        ├── 1~2회 실패 → status = DEGRADED, 로그 warn
        └── 3회 연속 실패 → status = UNRESPONSIVE → 자동 복구 전략 실행
              (architecture-deep.md §6.4 참조)
```

### 7.3 응답 형식 (HEARTBEAT_ACK)

```json
{
  "messageId": "msg_20260302_0043",
  "fromAgent": "CODEGEN",
  "toAgent": "ORCHESTRATOR",
  "messageType": "HEARTBEAT_ACK",
  "timestamp": "2026-03-02T09:00:05+09:00",
  "runId": "run_20260302_0007",
  "sessionId": "sess_20260302_0001",
  "payload": {
    "seq": 12,
    "healthState": {
      "agentId": "codegen-001",
      "agentType": "CODEGEN",
      "status": "HEALTHY",
      "lastHeartbeatAt": "2026-03-02T09:00:05+09:00",
      "currentTaskId": "task_003",
      "cpuUsage": 32.5,
      "memoryUsageMB": 128,
      "consecutiveFailures": 0,
      "lastError": null
    }
  },
  "timeoutMs": 10000,
  "retryPolicy": { "maxRetries": 0, "backoffMs": 0 }
}
```

---

## 8. 에러 전파 흐름

### 8.1 에러 전파 규약 (architecture-deep.md §7.3)

```
① 에이전트 A 내부 에러 발생
      │
      ▼
② 에이전트 A → Orchestrator
   메시지 타입: ERROR
   페이로드: { errorCode, internalMessage, userMessage, retriesAttempted, retryable }

③ Orchestrator 수신
   │
   ├── retryable == true, retriesAttempted < maxRetries
   │     → 에이전트 A 재시작 지시 (재시도)
   │
   └── retryable == false, 또는 재시도 한도 초과
         │
         ▼
④ Orchestrator → 의존 에이전트 B, C (에이전트 A의 출력을 기다리는 에이전트들)
   메시지 타입: UPSTREAM_FAILURE
   페이로드: { failedAgent: 'A', instruction: 'PAUSE', estimatedRecoveryMs }
         │
         ▼
⑤ 에이전트 B, C → 대기 상태 전환 (작업 낭비 방지)
         │
         ▼
⑥ Orchestrator 복구 결정
   ├── 재시도 가능 → 복구 후 UPSTREAM_FAILURE(instruction: 'CONTINUE_WITH_PARTIAL')
   ├── 대체 에이전트 스폰 → 동일 컨텍스트로 새 에이전트 시작
   └── 복구 불가 → ABORT(BROADCAST) → 전체 에이전트 중단
```

### 8.2 에러 코드별 전파 동작

| 에러 코드 | Orchestrator 기본 처리 | 의존 에이전트 지시 |
|-----------|----------------------|------------------|
| `AGENT_TIMEOUT` | 재시도 (최대 2회, 5초 백오프) | PAUSE |
| `VALIDATION_FAILED` | 재생성 요청 (최대 2회) | PAUSE |
| `RESOURCE_EXHAUSTED` | 백오프 후 재시도 또는 중단 | PAUSE |
| `INTERNAL_ERROR` | Rollback Agent 호출 | CANCEL |
| `POLICY_DENIED` | 재시도 불가, 사용자 알림 | CANCEL |
| `TOKEN_INVALID` | 새 Token 발급 Gate | PAUSE |
| `TOKEN_EXPIRED` | 자동 재발급(LOW) / Gate(MEDIUM+) | PAUSE |
| `TOKEN_SCOPE_MISMATCH` | 격리 후 조사 | CANCEL |
| `HASH_MISMATCH` | 전체 Run 일시 중단 | CANCEL |
| `DB_ERROR` | DB 복구 시도, OS 작업 차단 | PAUSE |

---

## 9. 메시지 ID 및 타임스탬프 규칙

```typescript
// 메시지 ID 생성 규칙
// 형식: msg_{YYYYMMDD}_{4자리 순번}
// 예시: msg_20260302_0001
// 생성: crypto.randomUUID() 대신 날짜+순번 조합 (추적 가능성 우선)
// 순번은 프로세스 시작 후 단조 증가 (재시작 시 리셋)

// 타임스탬프 규칙
// 형식: ISO 8601 (시간대 포함 필수)
// 예시: 2026-03-02T09:00:00+09:00
// 사용 금지: Date.now() 단독 사용 (디버깅 어려움)
```

---

## 10. Zod 검증 스키마 (런타임 검증)

```typescript
// 메시지 수신 시 반드시 이 스키마로 검증 후 처리한다
// 검증 실패 시 VALIDATION_FAILED 에러를 Orchestrator에 보고한다
import { z } from 'zod';

// 재시도 정책 스키마
const RetryPolicySchema = z.object({
  maxRetries: z.number().int().min(0).max(5),
  backoffMs: z.number().int().min(0).max(30000),
});

// AgentMessage 기본 스키마 (페이로드 제외)
const AgentMessageBaseSchema = z.object({
  messageId: z.string().regex(/^msg_\d{8}_\d{4,}$/),
  fromAgent: z.enum([
    'ORCHESTRATOR', 'SPEC_AGENT', 'POLICY_RISK', 'PLANNER',
    'CODEGEN', 'REVIEW', 'TEST_BUILD', 'EXECUTOR', 'ROLLBACK',
  ]),
  toAgent: z.union([
    z.enum([
      'ORCHESTRATOR', 'SPEC_AGENT', 'POLICY_RISK', 'PLANNER',
      'CODEGEN', 'REVIEW', 'TEST_BUILD', 'EXECUTOR', 'ROLLBACK',
    ]),
    z.literal('BROADCAST'),
  ]),
  messageType: z.enum([
    'HANDOFF', 'ERROR', 'UPSTREAM_FAILURE', 'HEARTBEAT',
    'HEARTBEAT_ACK', 'GATE_REQUEST', 'GATE_RESPONSE',
    'ABORT', 'STATUS_QUERY', 'STATUS_RESPONSE',
  ]),
  timestamp: z.string().datetime({ offset: true }),
  runId: z.string(),
  sessionId: z.string(),
  timeoutMs: z.number().int().min(1000).max(300000).default(60000),
  retryPolicy: RetryPolicySchema,
});
```

---

## 11. 보안 고려사항

```
메시지 전송 시 금지 항목:
  □ payload에 Capability Token 원문 포함 금지 (ID만 참조)
  □ payload에 비밀번호/API 키 포함 금지
  □ payload에 사용자 개인정보(전화번호, 메시지 내용) 원문 포함 금지
     → 마스킹 처리 후 참조 경로만 포함

메시지 수신 시 필수 검증:
  □ Zod 스키마 검증 (§10 참조)
  □ fromAgent가 실제 등록된 에이전트인지 확인
  □ runId가 현재 활성 Run과 일치하는지 확인
  □ sessionId TTL 유효성 확인
```

---

## 빠른 참조표

| MessageType | 발신자 | 수신자 | 응답 필요? | 타임아웃 |
|-------------|--------|--------|-----------|---------|
| `HANDOFF` | 임의 에이전트 | Orchestrator | N | 60s |
| `ERROR` | 임의 에이전트 | Orchestrator | N | 30s |
| `UPSTREAM_FAILURE` | Orchestrator | 의존 에이전트 | N | 30s |
| `HEARTBEAT` | Orchestrator | 임의 에이전트 | Y (ACK) | 30s |
| `HEARTBEAT_ACK` | 임의 에이전트 | Orchestrator | N | - |
| `GATE_REQUEST` | 임의 에이전트 | Orchestrator → UI | Y (RESPONSE) | 10분 |
| `GATE_RESPONSE` | Orchestrator | 요청 에이전트 | N | 30s |
| `ABORT` | Orchestrator | BROADCAST | N | 즉시 |
| `STATUS_QUERY` | Orchestrator | 임의 에이전트 | Y (RESPONSE) | 10s |
| `STATUS_RESPONSE` | 임의 에이전트 | Orchestrator | N | - |

---

> version: 1.0.0
> last_updated: 2026-03-02
> 참조: `.claude/design/architecture-deep.md` §7, `.claude/contract.md` §5
