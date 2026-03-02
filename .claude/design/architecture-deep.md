# JARVIS OS - 아키텍처 심화 설계 문서

> 이 문서는 설계 참고 문서입니다. 에이전트 Bundle 파일과 달리, 특정 에이전트에 종속되지 않는 전체 시스템 설계 정보를 담고 있습니다.

---

## 1. 에이전트 팀 토폴로지

### 1.1 핵심 원칙
- **Orchestrator**가 유일한 "흐름 제어 주체"
- 모든 OS 조작은 **Executor** 단일 경로로만 수행
- 정책 판단은 **Policy/Risk**가 단독 책임 (SoR: Source of Record)
- 에이전트팀 작업 환경: Claude CLI 터미널
- 에이전트팀은 병렬로 Task 의존성을 설정, 각자 분리된 Task에서 작업

### 1.2 복잡도 기반 호출 전략
- 사용자 요청 시 프로젝트 복잡도 분석 후 에이전트팀 호출 여부 판단
- 복잡도 낮은 경우: 단일 에이전트로 진행 (토큰 절약)
- 복잡도 높은 경우: 에이전트팀 풀 호출

---

## 2. 오케스트레이터 역할

Orchestrator는 **Execution Engine이 아니라 Environment Composer**.

### 2.1 하는 일

| 역할 | 설명 |
|------|------|
| 복잡도 평가 | Complexity Classifier |
| 실행 전략 선택 | Single-Agent vs Agent-Team |
| 작업 환경 구성 | Environment Bundle 생성 |
| 문서/정책/워크플로우 생성 | SPEC, PLAN, POLICY 등 |
| Task DAG 생성 | Claude CLI 병렬 실행용 |
| 모델 배치 전략 | 에이전트별 최적 모델 할당 |
| Budget 분배 | 토큰/시간/액션 예산 |
| Gate 지점 설계 | 승인 필요 지점 결정 |

### 2.2 절대 하지 않는 일
- 코드 작성, OS 조작, 패키지 설치, 테스트 실행 (전부 하위 에이전트)

---

## 3. 복잡도 분류기 (Complexity Classifier)

에이전트팀 호출 여부를 판단하는 엔진. 토큰 낭비 방지의 핵심.

- 낮은 복잡도 → 단일 에이전트 처리
- 높은 복잡도 → 에이전트팀 풀 호출 + Task DAG 생성

---

## 4. 환경 번들 (Environment Bundle)

Orchestrator가 하위 에이전트에게 제공하는 작업 환경:

```
/.ai-run/
├─ SPEC.md              # 요구사항 명세
├─ PLAN.json            # 실행 계획
├─ POLICY.json          # 적용 정책
├─ TEST_STRATEGY.md     # 테스트 전략
├─ TASK_GRAPH.json      # Task 의존성 그래프
├─ BUDGET.json          # 토큰/시간/액션 예산
├─ MODEL_ASSIGNMENT.json # 에이전트별 모델 할당
```

---

## 5. 모델 배치 전략

에이전트마다 모델을 다르게 배치하여 토큰을 최적화한다.

| Agent | Model | 근거 |
|-------|-------|------|
| Spec | Haiku | 요구사항 정리는 경량 모델 충분 |
| Policy | Haiku | 규칙 기반 판단 |
| Planner | Sonnet | 복잡도 높은 계획 수립 |
| Codegen | Opus | 코드 품질이 가장 중요 |
| Review | Sonnet | 코드 리뷰/분석 |
| Test | Haiku | 테스트 실행/검증은 경량 |

> claude.md는 150줄 제한 (Bootloader 역할만). 긴 claude.md = attention 분산 + 노이즈 증가 + 성능 저하

---

## 6. 에이전트 상태 감시 시스템 (A-1)

9개 에이전트 중 하나라도 멈추면 전체 파이프라인이 교착 상태에 빠진다.

### 6.1 설정

```json
{
  "agent_health": {
    "check_interval_ms": 5000,
    "timeout_ms": 30000,
    "max_retries": 3,
    "escalation": "ORCHESTRATOR"
  }
}
```

### 6.2 에이전트 상태 모델

```typescript
type AgentHealthStatus = "HEALTHY" | "DEGRADED" | "UNRESPONSIVE" | "CRASHED";

interface AgentHealthState {
  agentId: string;
  agentType: string;
  status: AgentHealthStatus;
  lastHeartbeatAt: string;
  currentTaskId?: string;
  cpuUsage?: number;
  memoryUsageMB?: number;
  consecutiveFailures: number;
  lastError?: string;
}
```

### 6.3 감시 흐름

```
Orchestrator → 5초마다 heartbeat → 각 에이전트
  응답 O → HEALTHY
  응답 X → 30초 대기 후 재시도 → 3회 실패?
    N → DEGRADED
    Y → UNRESPONSIVE → 자동 복구 전략 실행
```

### 6.4 자동 복구 전략 (4단계)

| Level | 전략 |
|-------|------|
| 1 | 에이전트 재시작 (같은 모델, 같은 컨텍스트) |
| 2 | 대체 에이전트 스폰 (컨텍스트 전달) |
| 3 | 해당 단계 스킵 + 사용자 알림 + Gate 전환 |
| 4 | 전체 Run 일시 정지 + Emergency Hold |

### 6.5 교착 상태 탐지
- 조건: 에이전트 A/B가 상호 대기, 30초 이상 양쪽 진행 없음
- 해결: 순환 의존 감지 → 우선순위 낮은 에이전트 강제 중단 → 사용자에게 보고

### 6.6 무한 루프 탐지
- 조건: Codegen → Review → Planner 루프 N회 반복 / 같은 에러 3회 연속
- 해결: 루프 카운터 (max_loop: 5) 초과 시 자동 중단 → 수동 개입 Gate 생성

---

## 7. 에이전트 간 통신 프로토콜 (A-2)

### 7.1 통신 아키텍처

```
Agent A (Producer) → Message Queue → Agent B (Consumer)
                     ↑
              Orchestrator = Queue Manager
              (라우팅, 순서, 타임아웃 관리)
```

방식: Message Queue (비동기, 순서 보장)

### 7.2 메시지 표준 포맷

```json
{
  "message_id": "msg_20260301_0042",
  "from_agent": "SPEC_AGENT",
  "to_agent": "POLICY_AGENT",
  "message_type": "HANDOFF",
  "timestamp": "2026-03-01T18:02:00+09:00",
  "run_id": "run_20260301_0007",
  "payload": {
    "artifact_type": "SPEC",
    "artifact_ref": "/.ai-run/SPEC.md",
    "summary": "사용자 요청: React 컴포넌트 구현",
    "metadata": {
      "risk_hints": ["NETWORK_ACCESS_POSSIBLE"],
      "estimated_complexity": "MEDIUM"
    }
  },
  "timeout_ms": 60000,
  "retry_policy": {
    "max_retries": 2,
    "backoff_ms": 5000
  }
}
```

### 7.3 에러 전파 규약

```
1. 실패 에이전트 → Orchestrator로 ERROR 메시지 전송
2. Orchestrator → 의존 에이전트들에게 UPSTREAM_FAILURE 알림
3. 의존 에이전트들은 대기 상태 전환 (작업 낭비 방지)
4. Orchestrator가 복구/대체/중단 결정
```

에러 코드: `AGENT_TIMEOUT` | `VALIDATION_FAILED` | `RESOURCE_EXHAUSTED` | `INTERNAL_ERROR`

---

## 8. 우아한 성능 저하 전략 (A-3)

### 8.1 장애 시나리오별 대응

| 장애 시나리오 | 대응 전략 |
|-------------|----------|
| Claude API 다운 | 캐시된 정책으로 제한적 운영, 관찰/제안 모드 자동 전환 |
| 네트워크 완전 끊김 | 오프라인 모드, 로컬 캐시 정책만, 웹 기능 전면 비활성화 |
| 특정 에이전트 모델 장애 | 대체 모델 폴백 (Opus → Sonnet → Haiku + 품질 경고) |
| Credential Vault 접근 불가 | 모든 인증 필요 작업 차단, 인증 불필요 작업만 허용 |
| 디스크 공간 부족 | 새 파일 생성 차단, 로그/Evidence 압축 시도 |

### 8.2 폴백 모드 체인

```
정상 운영 (Full Mode)
    ↓ 장애 발생
제한 운영 (Degraded Mode) - 일부 에이전트 비활성화, 기본 정책만
    ↓ 추가 장애
최소 운영 (Minimal Mode) - Orchestrator + Policy만, 관찰/제안 강제
    ↓ 전면 장애
비상 정지 (Emergency Mode) - 모든 실행 중단, 스냅샷 저장, 수동 복구 안내
```

---

## 9. 다중 실행 동시 실행 정책 (A-4)

### 9.1 새 요청 수신 시 처리

```
1. 현재 Run 상태 확인
   - Gate 대기 중 → 새 Run 큐에 추가 (충돌 낮음)
   - 실행 중 → 충돌 분석 수행
   - 완료 직전 → 새 Run 즉시 시작

2. 충돌 분석
   - 같은 파일/앱/리소스 건드리는가?
   - YES → 큐잉 (Run A 완료 후 시작)
   - NO → 병렬 실행 허용 (scope 격리 필수)

3. 우선순위
   - 사용자 명시적 지정 가능
   - 기본: FIFO
   - Emergency → 현재 Run 일시 정지 후 우선 처리
```

### 9.2 실행 큐 상태 모델

```typescript
type RunQueueEntry = {
  runId: string;
  priority: "NORMAL" | "HIGH" | "EMERGENCY";
  status: "QUEUED" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
  conflictsWith?: string[];
  queuedAt: string;
  estimatedStartAt?: string;
};
```

---

## 10. 상태 저장 및 재개 (A-5)

### 10.1 체크포인트 저장 시점
1. 각 상태 전이 완료 시 (SPEC_DRAFTED, POLICY_DECIDED, ...)
2. Gate 승인/거부 직후
3. 파일 변경 적용 직후
4. 테스트 완료 직후
5. 주기적 (30초마다)

### 10.2 저장 내용
- RunState 전체 스냅샷
- 현재 활성 에이전트 목록 + 각 에이전트 진행 상태
- Gate 큐 상태, Evidence 목록
- Environment Bundle 참조
- Capability 목록 + TTL 남은 시간

### 10.3 저장 구조

```
/.ai-run/
 ├─ checkpoints/
 │   ├─ cp_001_spec_drafted.json
 │   ├─ cp_002_policy_decided.json
 │   ├─ cp_003_gate1_approved.json
 │   └─ cp_latest.json (심볼릭 링크)
 └─ resume_manifest.json
```

### 10.4 재개 흐름

```
시스템 시작 → resume_manifest.json 확인
  존재하지 않음 → 새 세션 시작
  존재함 → 마지막 체크포인트 로드 → 사용자에게 표시:
    "이전 세션이 중단되었습니다. 마지막 상태: Gate #2 승인 대기"
    [이어서 진행] [처음부터 다시] [취소]
```

### 10.5 TTL 처리
- 만료된 Capability → 재발급 요청 (새 Gate)
- 유효한 Capability → 남은 TTL로 계속 사용
- 세션 TTL → 새로 시작 (보안 원칙)

---

## 11. 액션 의존성 그래프 (D-1)

### 11.1 의존성 그래프 스키마

```json
{
  "action_graph": {
    "run_id": "run_20260301_0007",
    "nodes": [
      { "action_id": "act_001", "type": "FS_READ", "depends_on": [] },
      { "action_id": "act_002", "type": "FS_READ", "depends_on": [] },
      { "action_id": "act_003", "type": "EXEC_RUN", "depends_on": ["act_001", "act_002"] },
      { "action_id": "act_004", "type": "FS_WRITE", "depends_on": ["act_003"] }
    ],
    "parallel_groups": [["act_001", "act_002"]]
  }
}
```

### 11.2 실행 전략

```
act_001 ──┐
          ├──▶ act_003 ──▶ act_004
act_002 ──┘

- 의존성 없는 액션 → 병렬 실행
- 의존성 있는 액션 → 선행 완료 후 실행
- 선행 액션 실패 → 의존 액션 자동 취소
```

---

## 12. 드라이런 모드 (D-2)

모든 Action Type에 대해 "실행하지 않고 결과를 미리 보여주는" dry-run 표준화.

### 12.1 드라이런 결과 포맷

```json
{
  "dry_run_result": {
    "action_id": "act_001",
    "type": "FS_DELETE",
    "simulated": true,
    "would_affect": {
      "files_deleted": ["/project/tmp/a.log", "/project/tmp/b.log"],
      "total_size_freed_bytes": 524288,
      "reversible": true
    },
    "risk_assessment": { "score": 35, "level": "MEDIUM", "reasons": ["MASS_DELETE_THRESHOLD"] },
    "side_effects": ["tmp 폴더가 비게 됩니다", "실행 중인 프로세스에 영향 없음"]
  }
}
```

### 12.2 액션 유형별 드라이런 제공 정보

| Action Type | Dry-Run 정보 |
|-------------|-------------|
| FS_DELETE | 삭제 대상 목록, 크기, 복구 가능성 |
| FS_WRITE | 변경 diff 미리보기 |
| FS_MOVE | 이동 전/후 경로, 충돌 여부 |
| EXEC_RUN | 예상 출력, 영향 파일 |
| APP_LAUNCH | 리소스 예측, 충돌 앱 |
| BROWSER_DOWNLOAD | 파일 크기, 저장 경로, 디스크 여유 |
| PKG_INSTALL | 의존성 트리, 디스크 사용량 |

---

## 13. 리소스 모니터링 (D-3)

### 13.1 모니터링 지표

| 지표 | 임계값 |
|------|--------|
| CPU 사용률 | 90% 이상 30초 지속 시 경고 |
| 메모리 사용량 | 가용 메모리 10% 미만 시 경고 |
| 디스크 I/O | 비정상적 대량 쓰기 탐지 |
| 디스크 공간 | 여유 1GB 미만 시 경고 |
| 네트워크 대역폭 | 비정상적 대량 전송 탐지 |
| 프로세스 수 | AI 생성 프로세스 10개 이상 시 경고 |

### 13.2 자동 대응

| 수준 | 대응 |
|------|------|
| WARNING | 사용자 알림, 실행 속도 제한 (throttle) |
| CRITICAL | 신규 액션 일시 중단, Gate 생성 (계속할지 확인) |
| EMERGENCY | 모든 실행 즉시 중단, Recovery Agent 호출 |

---

## 14. 다중 창 컨텍스트 추적 (D-4)

### 14.1 컨텍스트 추적 모델

```typescript
interface WindowContext {
  windowId: string;
  appName: string;
  title: string;
  monitor: number;
  position: { x: number; y: number; w: number; h: number };
  isFocused: boolean;
  isTargetWindow: boolean;  // AI 조작 중인 창
  sensitivityLevel: "NONE" | "LOW" | "HIGH";
}

interface MultiWindowState {
  activeWindows: WindowContext[];
  focusedWindowId: string;
  aiTargetWindowId: string;
  contextSwitchLog: Array<{
    from: string;
    to: string;
    reason: string;
    timestamp: string;
  }>;
}
```

### 14.2 컨텍스트 전환 정책

| 전환 유형 | 정책 |
|----------|------|
| 작업 관련 → 작업 관련 | 자동 허용 |
| 작업 관련 → 무관한 창 | Gate 필요 |
| 일반 → 민감 (은행/결제) | 즉시 차단 |
| 어떤 전환이든 | 로그 기록 |
| 예상치 못한 전환 (팝업) | Safety Hold |

---

## 15. 되돌리기/다시실행 스택 (D-5)

Recovery Agent의 전체 롤백 외에 **개별 액션 단위 undo/redo** 지원.

### 15.1 되돌리기 가능 여부

| Action Type | Undo 가능? | 방법 |
|-------------|-----------|------|
| FS_WRITE | YES | 백업 파일 복원 |
| FS_DELETE (soft) | YES | 휴지통에서 복원 |
| FS_DELETE (hard) | NO | 불가능 |
| FS_MOVE | YES | 역방향 이동 |
| EXEC_RUN | PARTIAL | 생성된 파일만 정리 |
| APP_LAUNCH | YES | 앱 종료 |
| PKG_INSTALL | YES | uninstall 실행 |
| BROWSER_* | NO | 웹 액션 되돌릴 수 없음 |

### 15.2 UndoEntry 구조

```typescript
interface UndoEntry {
  action_id: string;
  type: string;
  undo_type: "RESTORE_BACKUP" | "REVERSE_OPERATION" | "NOT_REVERSIBLE";
  backup_ref?: string;
  reversible: boolean;
  expires_at: string;  // 기본 7일
}
```

### 15.3 부분 롤백 UI 흐름

```
1. Timeline에서 특정 액션 클릭
2. "이 시점으로 되돌리기" 선택
3. 해당 액션 이후 모든 undo 가능한 액션을 역순 실행
4. undo 불가한 액션은 경고 표시
5. 최종 확인 Gate 표시
```
