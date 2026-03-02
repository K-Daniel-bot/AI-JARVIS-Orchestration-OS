# JARVIS OS — 에러 코드 카탈로그

> 이 문서는 JARVIS OS 전체 시스템에서 발생하는 에러 코드를 표준화합니다.
> 모든 에이전트와 패키지는 이 카탈로그에 정의된 에러 코드만 사용해야 합니다.
> 에러 발생 시 반드시 감사 로그에 기록하고, 사용자에게는 안전한 메시지만 노출합니다.

---

## 에러 코드 체계

```
에러 코드 형식: SCREAMING_SNAKE_CASE
에러 발생 시 필수 기록:
  - 에러 코드
  - 발생 에이전트 ID
  - 발생 상태 (XState 상태명)
  - run_id, session_id
  - 타임스탬프 (ISO 8601)
  - 에러 상세 (스택 트레이스는 debug 레벨만, 사용자에게 미노출)
```

---

## 1. AGENT_TIMEOUT

| 항목 | 내용 |
|------|------|
| **코드** | `AGENT_TIMEOUT` |
| **HTTP 유사 분류** | 504 Gateway Timeout |
| **설명** | 에이전트가 지정된 시간 내에 응답하지 않음. 기본 타임아웃: 60초 |
| **감사 로그 레벨** | `warn` (1~2회), `error` (3회 이상 연속) |

### 발생 원인

- Claude API 응답 지연 (네트워크/서버 부하)
- 에이전트 내부 무한 루프 또는 교착 상태
- 컨텍스트 크기 과다로 인한 처리 지연
- 하위 에이전트가 상위 에이전트 응답을 무한 대기 (순환 의존)

### 복구 전략

```
1단계 (즉시): 동일 에이전트 재시작 (최대 2회 재시도, backoff: 5초)
2단계 (30초 후): 대체 에이전트 스폰 + 컨텍스트 전달
3단계 (60초 후): 해당 단계 스킵 + 사용자 알림 + Gate 전환
4단계 (지속): 전체 Run 일시 정지 → Emergency Hold → 수동 개입
```

### 감사 로그 기록 예시

```json
{
  "error_code": "AGENT_TIMEOUT",
  "agent_id": "codegen-001",
  "state": "CODE_GENERATION",
  "timeout_ms": 60000,
  "retry_count": 2,
  "action_taken": "AGENT_RESTART"
}
```

### 사용자 표시 메시지

```
"코드 생성이 예상보다 오래 걸리고 있습니다. 잠시 후 재시도합니다."
```

---

## 2. VALIDATION_FAILED

| 항목 | 내용 |
|------|------|
| **코드** | `VALIDATION_FAILED` |
| **HTTP 유사 분류** | 422 Unprocessable Entity |
| **설명** | 입력 또는 출력 데이터가 Zod 스키마 검증을 통과하지 못함 |
| **감사 로그 레벨** | `warn` |

### 발생 원인

- 에이전트 출력이 예상 JSON 스키마와 불일치
- 사용자 입력 파라미터 형식 오류 (타입 불일치, 필수 필드 누락)
- 에이전트 간 메시지 페이로드 스키마 위반 (architecture-deep.md 7.2절)
- Capability Token 발급 시 required_capabilities 필드 누락
- PolicyDecision 출력 필드 타입 오류

### 복구 전략

```
1. 검증 실패 필드 목록 + 기대값 vs 실제값 기록
2. 에이전트에게 재생성 요청 (최대 2회, 실패 이유 피드백 포함)
3. 2회 모두 실패 시 → Planner에게 PLAN 수정 피드백
4. 외부 입력(사용자 요청) 검증 실패 시 → AWAITING_USER_INPUT 상태 전환
```

### 감사 로그 기록 예시

```json
{
  "error_code": "VALIDATION_FAILED",
  "agent_id": "policy-risk-001",
  "state": "POLICY_CHECK",
  "failed_fields": ["outcome.risk_score", "required_capabilities[0].ttl_seconds"],
  "schema_ref": "schemas/policy-decision.json",
  "retry_count": 1
}
```

### 사용자 표시 메시지

```
"입력 형식이 올바르지 않습니다. 요청 내용을 확인 후 다시 시도해주세요."
```

---

## 3. RESOURCE_EXHAUSTED

| 항목 | 내용 |
|------|------|
| **코드** | `RESOURCE_EXHAUSTED` |
| **HTTP 유사 분류** | 429 Too Many Requests / 503 Service Unavailable |
| **설명** | 토큰 예산, 시간 예산, API Rate Limit 등 리소스 한도 초과 |
| **감사 로그 레벨** | `warn` (80% 도달), `error` (100% 초과) |

### 발생 원인

- `JARVIS_MAX_TOKENS_PER_RUN` 한도 초과
- Claude API Rate Limit 도달 (분당 요청 수 초과)
- `BUDGET.json`의 에이전트별 토큰 할당 초과
- 디스크 공간 부족으로 감사 로그 기록 불가
- 메모리 한도 초과 (Node.js 힙 소진)

### 복구 전략

```
토큰 초과:
  - 80% 도달 → 사용자 경고 + 현재 단계 완료 후 중단 여부 확인
  - 100% 도달 → 현재 단계 완료 후 Run 중단 + 요약 보고

API Rate Limit:
  - Exponential backoff: 1초 → 2초 → 4초 → 8초 (최대 4회)
  - 4회 실패 시 → AGENT_TIMEOUT 에러로 에스컬레이션

디스크/메모리 부족:
  - 즉시 신규 작업 중단
  - 감사 로그 압축 시도
  - 사용자에게 리소스 확보 요청 + Emergency Hold
```

### 감사 로그 기록 예시

```json
{
  "error_code": "RESOURCE_EXHAUSTED",
  "resource_type": "TOKEN_BUDGET",
  "used": 95000,
  "limit": 100000,
  "percentage": 95,
  "action_taken": "USER_WARNING_SENT"
}
```

### 사용자 표시 메시지

```
"이번 실행의 토큰 예산 95%를 사용했습니다. 현재 단계 완료 후 중단됩니다."
```

---

## 4. INTERNAL_ERROR

| 항목 | 내용 |
|------|------|
| **코드** | `INTERNAL_ERROR` |
| **HTTP 유사 분류** | 500 Internal Server Error |
| **설명** | 예상치 못한 내부 오류. 다른 에러 코드에 해당하지 않는 모든 예기치 않은 실패 |
| **감사 로그 레벨** | `error` |

### 발생 원인

- TypeScript 런타임 예외 (uncaught exception)
- XState 상태 머신 정의 오류 (잘못된 상태 전이)
- 의존성 패키지 내부 오류
- OS 파일 시스템 예기치 않은 오류
- JSON 파싱 실패 (손상된 checkpoint 파일 등)

### 복구 전략

```
1. 스택 트레이스를 감사 로그에 기록 (사용자에게는 미노출)
2. 현재 Run 상태 스냅샷 저장 (체크포인트)
3. ERROR_RECOVERY 상태 전이 → Rollback Agent 호출
4. Rollback 실패 시 → EMERGENCY_STOP 상태 전이
5. 개발 환경: 스택 트레이스를 콘솔에 출력
6. 프로덕션 환경: 에러 ID만 표시, 내부 세부사항 숨김
```

### 감사 로그 기록 예시

```json
{
  "error_code": "INTERNAL_ERROR",
  "error_id": "err_20260302_0042",
  "agent_id": "executor-001",
  "state": "APPLY_CHANGES",
  "stack_trace_ref": "logs/err_20260302_0042.trace",
  "checkpoint_saved": true,
  "rollback_initiated": true
}
```

### 사용자 표시 메시지

```
"예기치 않은 오류가 발생했습니다 (오류 ID: err_20260302_0042). 이전 상태로 복구를 시도합니다."
```

---

## 5. POLICY_DENIED

| 항목 | 내용 |
|------|------|
| **코드** | `POLICY_DENIED` |
| **HTTP 유사 분류** | 403 Forbidden |
| **설명** | Policy/Risk Agent의 정책 판정 결과 `DENY`. 계약서 규칙 위반 또는 명시적 차단 목록 매칭 |
| **감사 로그 레벨** | `warn` (일반 거부), `error` (계약서 위반 시도) |

### 발생 원인

- 계약서(contract.md) §1 절대 금지사항 위반 시도
  - OS 시스템 파일 접근 시도
  - 금융/결제 영역 자동화 시도
  - 관리자 권한 자동 실행 시도
- 정책 차단 목록(blocklist)에 등록된 도메인/앱/경로 접근
- risk_score가 신뢰 모드의 자동 실행 임계값 초과
- 사용자 역할(role)이 요청 작업에 대한 권한 부족

### 복구 전략

```
계약서 위반:
  - 즉시 DENY, 재시도 불가
  - 감사 로그에 위반 규칙 코드 기록
  - 사용자에게 거부 이유 + 대안 제안

일반 정책 거부:
  - 사용자에게 거부 이유 표시
  - 범위 축소 후 재요청 가능 여부 안내
  - GATE_PLAN_APPROVAL로 에스컬레이션 가능 (사용자가 명시적 승인)
```

### 감사 로그 기록 예시

```json
{
  "error_code": "POLICY_DENIED",
  "policy_decision_id": "pd_20260302_0015",
  "risk_score": 92,
  "risk_level": "CRITICAL",
  "denial_reason_codes": ["CONTRACT_VIOLATION", "FINANCIAL_DOMAIN_ACCESS"],
  "human_explanation": "금융 영역 자동화는 계약서에 의해 금지됩니다",
  "retry_allowed": false
}
```

### 사용자 표시 메시지

```
"이 작업은 정책에 의해 허용되지 않습니다: 금융 영역 자동화는 금지되어 있습니다."
```

---

## 6. TOKEN_INVALID

| 항목 | 내용 |
|------|------|
| **코드** | `TOKEN_INVALID` |
| **HTTP 유사 분류** | 401 Unauthorized |
| **설명** | Capability Token의 상태가 `ACTIVE`가 아님. 이미 소비(CONSUMED), 취소(REVOKED), 또는 존재하지 않는 토큰 사용 시도 |
| **감사 로그 레벨** | `error` |

### 발생 원인

- 이미 소비된(CONSUMED) 토큰 재사용 시도 (1회성 원칙 위반)
- 취소된(REVOKED) 토큰 사용 시도 (비상 중단 후 잔여 토큰 등)
- 존재하지 않는 token_id 참조
- 토큰 무결성 검증 실패 (토큰 데이터 변조 감지)

### 복구 전략

```
소비된 토큰 재사용:
  - 즉시 거부 + 감사 로그 기록
  - 새 Capability Token 발급 요청 → Policy Agent → Gate (필요 시)

취소된 토큰:
  - 즉시 거부 + 취소 사유 조회
  - 비상 중단 후라면 새 세션 시작 안내

변조 감지:
  - 즉시 거부 + SECURITY_ALERT 레벨 로그
  - 해당 에이전트 격리 + Orchestrator 알림
```

### 감사 로그 기록 예시

```json
{
  "error_code": "TOKEN_INVALID",
  "token_id": "cap_20260302_0007",
  "token_status": "CONSUMED",
  "consumed_at": "2026-03-02T09:15:00+09:00",
  "consumed_by_action": "act_042",
  "attempted_by_agent": "executor-001",
  "security_alert": false
}
```

### 사용자 표시 메시지

```
"권한 토큰이 이미 사용되었습니다. 작업을 다시 승인해주세요."
```

---

## 7. TOKEN_EXPIRED

| 항목 | 내용 |
|------|------|
| **코드** | `TOKEN_EXPIRED` |
| **HTTP 유사 분류** | 401 Unauthorized |
| **설명** | Capability Token의 TTL(유효시간)이 만료됨 |
| **감사 로그 레벨** | `warn` |

### 발생 원인

- 토큰 발급 후 `ttl_seconds` 경과
- 사용자가 Gate 승인 후 오랜 시간 경과 후 실행 재개
- 체크포인트에서 Run 재개 시 이전 토큰 TTL 만료
- 세션 TTL 만료로 인한 전체 Capability 무효화

### 복구 전략

```
일반 TTL 만료:
  - 사용자에게 만료 알림
  - 동일 scope로 새 토큰 재발급 요청
  - 위험도에 따라 자동 재발급 (LOW risk) 또는 Gate 재표시 (MEDIUM+)

세션 만료로 인한 일괄 만료:
  - 모든 진행 중인 작업 일시 중단
  - 체크포인트 저장
  - 사용자에게 세션 재인증 요청
  - 재인증 후 이전 상태에서 재개 여부 확인
```

### 감사 로그 기록 예시

```json
{
  "error_code": "TOKEN_EXPIRED",
  "token_id": "cap_20260302_0008",
  "issued_at": "2026-03-02T09:00:00+09:00",
  "ttl_seconds": 900,
  "expired_at": "2026-03-02T09:15:00+09:00",
  "attempted_at": "2026-03-02T09:20:00+09:00",
  "reissue_requested": true
}
```

### 사용자 표시 메시지

```
"작업 권한이 만료되었습니다. 계속 진행하려면 다시 승인해주세요."
```

---

## 8. TOKEN_SCOPE_MISMATCH

| 항목 | 내용 |
|------|------|
| **코드** | `TOKEN_SCOPE_MISMATCH` |
| **HTTP 유사 분류** | 403 Forbidden |
| **설명** | Capability Token의 `scope`와 실제 실행하려는 액션의 범위가 불일치. 토큰이 허용하는 범위를 벗어난 액션 시도 |
| **감사 로그 레벨** | `error` |

### 발생 원인

- 토큰 scope: `/project/src/**` → 실제 액션: `/project/config/.env` 접근 시도
- 토큰 cap: `fs.read` → 실제 액션: `fs.write` 시도
- 토큰 scope: `github.com` → 실제 액션: `external-api.com` 접근 시도
- 모바일 토큰 scope: `+82-10-*` → 실제 전화번호: 해외 번호 시도
- Codegen Agent가 Executor 전용 토큰 사용 시도 (에이전트 역할 위반)

### 복구 전략

```
1. 즉시 거부 + 감사 로그 기록 (scope 불일치 상세 포함)
2. 의도적 위반 여부 판단:
   - 에이전트 버그(범위 계산 오류): 자동 재계획 (scope 수정)
   - 반복 위반 (동일 에이전트 3회 이상): 에이전트 격리 + Orchestrator 알림
3. 새 scope로 토큰 재발급 요청 (사용자 승인 필요)
```

### 감사 로그 기록 예시

```json
{
  "error_code": "TOKEN_SCOPE_MISMATCH",
  "token_id": "cap_20260302_0009",
  "token_cap": "fs.read",
  "token_scope": "/project/src/**",
  "action_cap": "fs.write",
  "action_scope": "/project/config/.env",
  "mismatch_type": "CAP_MISMATCH",
  "agent_id": "codegen-001",
  "repeat_violation_count": 1
}
```

### 사용자 표시 메시지

```
"허용된 범위를 벗어난 작업이 차단되었습니다. 더 넓은 권한이 필요하면 다시 승인해주세요."
```

---

## 9. HASH_MISMATCH

| 항목 | 내용 |
|------|------|
| **코드** | `HASH_MISMATCH` |
| **HTTP 유사 분류** | 409 Conflict (무결성 충돌) |
| **설명** | 감사 로그의 해시 체인 무결성 검증 실패. append-only 로그의 이전 항목 해시와 현재 항목의 `previous_hash` 불일치 |
| **감사 로그 레벨** | `error` (즉시 보안 알림) |

### 발생 원인

- 감사 로그 파일 외부 직접 수정 (위변조)
- DB 손상 (디스크 오류, 비정상 종료)
- 체크포인트 파일 손상 후 불완전한 복구
- 동시 쓰기 경쟁 조건(race condition) — 잠금 실패

### 복구 전략

```
즉시 대응:
  1. 모든 진행 중인 Run 즉시 일시 중단
  2. 불일치 발생 지점(entry index) 기록
  3. 보안 알림 — 사용자에게 즉시 통보

원인 분석:
  - 외부 수정 의심 → 법적 증거 보전, 관리자 알림
  - DB 손상 의심 → 가장 최근 정상 체크포인트로 롤백

복구:
  - 손상 전 마지막 정상 해시 체인 지점으로 복구
  - 손상 구간을 별도 파일로 보존 (증거)
  - 복구 후 전체 체인 재검증
  - 정상 확인 후 Run 재개 (사용자 승인 필요)
```

### 감사 로그 기록 예시

```json
{
  "error_code": "HASH_MISMATCH",
  "expected_previous_hash": "sha256:abc123...",
  "actual_previous_hash": "sha256:def456...",
  "entry_index": 1042,
  "audit_db_path": "./data/audit.db",
  "corruption_suspected": true,
  "runs_suspended": ["run_20260302_0007"],
  "security_alert_sent": true
}
```

### 사용자 표시 메시지

```
"감사 로그 무결성 검증에 실패했습니다. 보안 점검이 필요합니다. 모든 실행이 일시 중단되었습니다."
```

---

## 10. DB_ERROR

| 항목 | 내용 |
|------|------|
| **코드** | `DB_ERROR` |
| **HTTP 유사 분류** | 503 Service Unavailable |
| **설명** | SQLite 감사 로그 데이터베이스 접근 또는 쓰기 실패 |
| **감사 로그 레벨** | `error` |

### 발생 원인

- DB 파일 경로 접근 불가 (권한 부족, 경로 오류)
- 디스크 공간 부족으로 쓰기 실패
- DB 파일 잠금 충돌 (다중 프로세스 동시 접근)
- SQLite 파일 손상 (비정상 종료 후)
- `JARVIS_DB_PATH`로 지정된 경로의 상위 디렉토리 미존재

### 복구 전략

```
즉시 대응:
  1. 감사 로그 기록 불가 상태에서는 어떤 OS 조작도 실행 금지
     (계약서 §3: 감사 로그 기록 필수)
  2. 메모리 내 임시 로그 버퍼에 기록 (최대 1000 entries)
  3. DB 복구 시도

복구 시도 순서:
  a. DB 파일 재연결 시도 (최대 3회, 지수 백오프: 1초 → 2초 → 4초)
  b. DB 파일 무결성 검사 (PRAGMA integrity_check)
  c. 손상 시 백업 파일에서 복원 (design/schema.sql의 audit_entries 스키마 참조)
  d. 백업 없으면 새 DB 생성 + GENESIS 레코드 삽입 + 복구 불가 구간 기록

복구 후:
  - 임시 버퍼 내용을 DB에 일괄 기록
  - 사용자에게 DB 복구 완료 + 유실 엔트리 수 보고
```

### 감사 로그 기록 예시

```json
{
  "error_code": "DB_ERROR",
  "db_path": "./data/audit.db",
  "sqlite_error_code": "SQLITE_CANTOPEN",
  "retry_count": 3,
  "buffer_entries": 42,
  "recovery_action": "FALLBACK_TO_MEMORY_BUFFER",
  "os_actions_blocked": true
}
```

### 사용자 표시 메시지

```
"감사 로그 시스템에 오류가 발생했습니다. 복구될 때까지 OS 작업이 일시 중단됩니다."
```

---

## 에러 코드 빠른 참조표

| 코드 | 분류 | 감사 레벨 | 재시도 가능 | OS 작업 차단 |
|------|------|----------|------------|------------|
| `AGENT_TIMEOUT` | 에이전트 | warn/error | O (최대 2회) | X |
| `VALIDATION_FAILED` | 데이터 | warn | O (최대 2회) | X |
| `RESOURCE_EXHAUSTED` | 예산 | warn/error | O (backoff) | X |
| `INTERNAL_ERROR` | 시스템 | error | X (Rollback) | O |
| `POLICY_DENIED` | 보안/정책 | warn/error | 조건부 | O |
| `TOKEN_INVALID` | 보안 | error | X (재발급) | O |
| `TOKEN_EXPIRED` | 보안 | warn | O (재발급) | O |
| `TOKEN_SCOPE_MISMATCH` | 보안 | error | 조건부 | O |
| `HASH_MISMATCH` | 무결성 | error | X (점검 필요) | O |
| `DB_ERROR` | 인프라 | error | O (복구 후) | O |

---

## TypeScript 에러 타입 정의 참조

```typescript
// packages/shared/src/errors.ts 참조 구조
type JarvisErrorCode =
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

interface JarvisError {
  code: JarvisErrorCode;
  message: string;          // 내부 디버그용 (사용자 미노출)
  userMessage: string;      // 사용자에게 표시할 안전한 메시지
  agentId?: string;
  runId?: string;
  retryable: boolean;
  blocksOsActions: boolean;
}

// Result<T, E> 패턴으로 반환 — throw 금지
type Result<T, E = JarvisError> =
  | { ok: true; value: T }
  | { ok: false; error: E };
```

---

> version: 1.0.0
> last_updated: 2026-03-02
> 참조: `.claude/design/architecture-deep.md` §7.3, `.claude/contract.md` §3, §7
