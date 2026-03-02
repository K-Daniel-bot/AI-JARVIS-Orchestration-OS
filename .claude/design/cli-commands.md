# JARVIS OS — CLI 커맨드 명세

> 이 문서는 JARVIS OS의 **Command-Line Interface (CLI)** 전체 커맨드를 정의합니다.
> CLI는 사용자와 시스템의 유일한 진입점이며, 모든 작업은 CLI를 통해 시작됩니다.
> version: 1.0.0
> last_updated: 2026-03-02

---

## 개요

```
JARVIS OS CLI 구조:

jarvis <command> [options] [arguments]

주요 커맨드:
├─ run         사용자 요청 실행 (메인 진입점)
├─ status      현재 상태 조회
├─ stop        비상 중단
├─ audit       감시 로그 조회
├─ rollback    작업 롤백
├─ mobile      모바일 관리
├─ policy      정책 관리
├─ token       Capability Token 관리
└─ version     버전 정보
```

---

## 1. `jarvis run` — 사용자 요청 실행

### 용도
메인 커맨드. 사용자의 자연어 요청을 받아 전체 에이전트 파이프라인 시작.

### 문법

```bash
jarvis run <request> [options]
```

### 인자

| 인자 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `request` | string | ✅ | 사용자 요청 (음성/텍스트) |

### 옵션

| 옵션 | 단축 | 타입 | 기본값 | 설명 |
|------|------|------|--------|------|
| `--mode` | `-m` | enum | suggest | 신뢰 모드: `observe`/`suggest`/`semi-auto`/`auto` |
| `--timeout` | `-t` | number | 300 | 타임아웃 (초) |
| `--no-approve` | | flag | false | Gate 자동 승인 금지 (suggest/semi-auto에서 무시됨) |
| `--log-level` | | enum | info | 로그 레벨: `debug`/`info`/`warn`/`error` |
| `--session-id` | `-s` | string | 신규 | 특정 세션 ID로 실행 (진행 중인 세션 계속) |
| `--dry-run` | | flag | false | 시뮬레이션만 (실제 실행 안 함) |

### 예시

```bash
# 기본 실행 (suggest 모드)
$ jarvis run "hello.txt 파일에 'Hello JARVIS' 내용을 작성해줘"

# Auto 모드로 자동 실행
$ jarvis run "README.md 파일 수정" --mode auto

# 시뮬레이션만
$ jarvis run "파일 삭제" --dry-run

# 디버그 로그 포함
$ jarvis run "..." --log-level debug

# 기존 세션 계속
$ jarvis run "다음 단계 진행" --session-id session_user001_20260302_0001
```

### 출력

```json
{
  "run_id": "run_20260302_0001",
  "session_id": "session_user001_20260302_0001",
  "status": "PENDING_APPROVAL",
  "message": "Gate #1: 계획/범위를 확인 후 승인하세요",
  "plan_summary": "hello.txt 파일에 'Hello JARVIS' 내용을 작성합니다",
  "risk_level": "LOW",
  "approval_required": true
}
```

---

## 2. `jarvis status` — 현재 상태 조회

### 용도
현재 실행 중인 작업의 상태, 진행 단계, 대기 중인 Gate 표시.

### 문법

```bash
jarvis status [session-id] [options]
```

### 인자

| 인자 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `session-id` | string | ❌ | 특정 세션 ID (생략 시 최근 세션) |

### 옵션

| 옵션 | 타입 | 설명 |
|------|------|------|
| `--watch` `-w` | flag | 실시간 감시 (변경 시 자동 갱신) |
| `--json` | flag | JSON 포맷 출력 |
| `--verbose` `-v` | flag | 상세 정보 포함 |

### 예시

```bash
$ jarvis status
$ jarvis status session_user001_20260302_0001 --watch
$ jarvis status --json
```

### 출력 (텍스트)

```
┌─────────────────────────────────────────────────────────┐
│ JARVIS OS — 작업 상태                                   │
├─────────────────────────────────────────────────────────┤
│ Run ID:       run_20260302_0001                         │
│ Session ID:   session_user001_20260302_0001             │
│ Status:       AWAITING_USER_INPUT (⏸️ Gate #1)         │
│ Progress:     40% (Spec ✅ Policy ✅ Planning ✅)      │
│ Mode:         suggest                                   │
│ Risk Level:   🟢 LOW (6/100)                           │
├─────────────────────────────────────────────────────────┤
│ 다음 단계: Gate #1 승인                                 │
│ 승인 예정자: 사용자                                     │
│ 타임아웃:     5분 22초 남음                             │
├─────────────────────────────────────────────────────────┤
│ Capability Token:                                       │
│  - cap_20260302_0001 (fs.write) TTL: 4분 58초 남음     │
│    Scope: /project/hello.txt                           │
│    Status: ACTIVE (1/1 사용)                            │
└─────────────────────────────────────────────────────────┘
```

### 출력 (JSON)

```json
{
  "run_id": "run_20260302_0001",
  "session_id": "session_user001_20260302_0001",
  "status": "AWAITING_USER_INPUT",
  "current_step": 4,
  "total_steps": 8,
  "progress_percent": 40,
  "steps": [
    { "id": 1, "name": "SPEC_ANALYSIS", "status": "COMPLETED" },
    { "id": 2, "name": "POLICY_CHECK", "status": "COMPLETED" },
    { "id": 3, "name": "PLANNING", "status": "COMPLETED" },
    { "id": 4, "name": "GATE_PLAN_APPROVAL", "status": "PENDING" },
    { "id": 5, "name": "CODE_GENERATION", "status": "PENDING" }
  ],
  "mode": "suggest",
  "risk_level": "LOW",
  "risk_score": 6,
  "timeout_remaining_seconds": 322
}
```

---

## 3. `jarvis stop` — 비상 중단

### 용도
진행 중인 작업을 즉시 중단하고 롤백 실행.

### 문법

```bash
jarvis stop [session-id] [options]
```

### 인자

| 인자 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `session-id` | string | ❌ | 특정 세션 ID (생략 시 현재 세션) |

### 옵션

| 옵션 | 타입 | 설명 |
|------|------|------|
| `--force` `-f` | flag | 확인 없이 즉시 중단 |
| `--reason` `-r` | string | 중단 사유 (감시 로그 기록용) |

### 예시

```bash
$ jarvis stop                                    # 현재 세션 중단 (확인 필요)
$ jarvis stop --force                           # 즉시 중단
$ jarvis stop session_xyz --reason "사용자 요청"  # 특정 세션 + 사유
```

### 동작 순서

```
1. 모든 진행 중인 액션 즉시 중단
2. 발급된 모든 Capability Token 무효화
3. 변경사항 롤백 (git checkout / 백업 복원)
4. 감시 로그 기록: EMERGENCY_STOP
5. 사용자 알림
```

### 출력

```
✅ 비상 중단 완료

중단된 세션: session_xyz
중단 사유: 사용자 요청
롤백 상태: SUCCESSFUL (3개 파일 복구)
무효화된 토큰: 1개
감시 로그: aud_20260302_0042 (EMERGENCY_STOP)

세부 내용: jarvis audit --run run_xyz
```

---

## 4. `jarvis audit` — 감시 로그 조회

### 용도
감시 로그(audit trail)를 조회하고 필터링.

### 문법

```bash
jarvis audit [options]
```

### 옵션

| 옵션 | 타입 | 설명 |
|------|------|------|
| `--run` | string | 특정 Run ID로 필터 |
| `--session` | string | 특정 세션 ID로 필터 |
| `--agent` | string | 특정 에이전트로 필터 (예: codegen-001) |
| `--since` | string | 시간 범위 (ISO 8601, 예: 2026-03-02T10:00:00Z) |
| `--until` | string | 시간 범위 끝 |
| `--policy-violations` | flag | 정책 위반만 필터 |
| `--errors` | flag | 에러 항목만 필터 |
| `--limit` | number | 최대 출력 항목 수 (기본: 50) |
| `--format` | enum | 출력 포맷: `text`/`json`/`csv` (기본: text) |
| `--export` | string | 파일로 저장 (예: audit.json) |

### 예시

```bash
# 최근 50개 항목
$ jarvis audit

# 특정 Run 전체
$ jarvis audit --run run_20260302_0001

# 정책 위반만
$ jarvis audit --policy-violations

# 시간 범위 조회
$ jarvis audit --since 2026-03-02T09:00:00Z --until 2026-03-02T12:00:00Z

# JSON 형식 + 파일 저장
$ jarvis audit --json --export audit.json

# Codegen 에이전트의 모든 작업
$ jarvis audit --agent codegen-001 --limit 100
```

### 출력 (텍스트)

```
┌─────────────────────────────────────────────────────────────────────────┐
│ JARVIS OS — 감시 로그 (최근 50개)                                       │
├─────────────────────────────────────────────────────────────────────────┤
│ aud_20260302_0042  [10:01:00] spec-agent        ✅ SPEC_ANALYSIS      │
│ aud_20260302_0043  [10:01:05] policy-agent      ✅ POLICY_CHECK       │
│ aud_20260302_0044  [10:01:10] planner-agent     ✅ PLANNING           │
│ aud_20260302_0045  [10:01:20] codegen-agent     ✅ CODE_GENERATION    │
│ aud_20260302_0046  [10:01:25] review-agent      ✅ CODE_REVIEW        │
│ aud_20260302_0047  [10:01:30] executor-agent    ✅ APPLY_CHANGES      │
│ aud_20260302_0048  [10:01:35] test-agent        ✅ TESTING            │
├─────────────────────────────────────────────────────────────────────────┤
│ 총 7개 항목 | 정책 위반: 0개 | 에러: 0개
└─────────────────────────────────────────────────────────────────────────┘
```

### 출력 (JSON)

```json
{
  "entries": [
    {
      "audit_id": "aud_20260302_0042",
      "timestamp": "2026-03-02T10:01:00Z",
      "agent_id": "spec-agent",
      "what": {
        "intent": "FILE_OPERATION",
        "summary": "hello.txt 작성"
      },
      "result": "COMPLETED"
    }
  ],
  "total_count": 7,
  "policy_violations": 0,
  "errors": 0
}
```

---

## 5. `jarvis rollback` — 작업 롤백

### 용도
특정 Run을 이전 상태로 복구.

### 문법

```bash
jarvis rollback <run-id> [options]
```

### 인자

| 인자 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `run-id` | string | ✅ | 롤백할 Run ID |

### 옵션

| 옵션 | 타입 | 설명 |
|------|------|------|
| `--checkpoint` | string | 특정 체크포인트로 복구 (생략 시 최근) |
| `--force` `-f` | flag | 확인 없이 즉시 롤백 |
| `--preserve-logs` | flag | 감시 로그 보존 (기본값: 보존) |

### 예시

```bash
$ jarvis rollback run_20260302_0001
$ jarvis rollback run_20260302_0001 --force
$ jarvis rollback run_20260302_0001 --checkpoint cp_20260302_0003
```

### 출력

```
✅ 롤백 완료

Run ID:          run_20260302_0001
복구된 체크포인트: cp_20260302_0003 (10:01:30)
복구된 파일:      3개
무효화된 토큰:    1개
상태:            SUCCESS

복구 항목:
  ✅ /project/hello.txt (복원)
  ✅ /project/README.md (삭제)
  ✅ 데이터베이스 (이전 상태)

Postmortem: reports/postmortem_run_20260302_0001.md
```

---

## 6. `jarvis mobile` — 모바일 관리

### 용도
Companion App 페어링, 세션 관리, 연결 상태 제어.

### 문법

```bash
jarvis mobile <subcommand> [options]
```

### Subcommands

#### 6.1 `jarvis mobile pair` — 페어링

```bash
jarvis mobile pair [options]

옵션:
  --device-name      문자열     모바일 기기명
  --qr-code-path     경로       QR 코드 이미지 파일
  --timeout          숫자       페어링 타임아웃 (기본: 300초)
```

#### 6.2 `jarvis mobile list` — 연결된 기기 목록

```bash
jarvis mobile list

출력:
Connected Devices (최대 1개):
  - Device: iPhone 15 Pro
    Session ID: mob_session_abc123
    Connected: 2026-03-02 10:00:00 UTC
    Last Activity: 2026-03-02 10:15:30 UTC
    Status: ACTIVE
```

#### 6.3 `jarvis mobile revoke` — 세션 무효화

```bash
jarvis mobile revoke <device-id> [options]

옵션:
  --reason     문자열     무효화 사유
  --force      플래그     확인 없이 즉시

예시:
$ jarvis mobile revoke device_abc123 --reason "기기 분실"
```

#### 6.4 `jarvis mobile blocked-apps` — 차단 앱 관리

```bash
jarvis mobile blocked-apps [options]

옵션:
  --list                  모든 차단 앱 표시
  --add <app-name>        앱 추가 (영구 차단)
  --remove <app-name>     앱 제거 (불가능 — 영구 차단)
  --reset                 기본값으로 초기화
```

---

## 7. `jarvis policy` — 정책 관리

### 용도
정책 업데이트, 검증, 조회.

### 문법

```bash
jarvis policy <subcommand> [options]
```

### Subcommands

#### 7.1 `jarvis policy validate` — 정책 검증

```bash
jarvis policy validate <file> [options]

옵션:
  --format     enum     입력 포맷: markdown/json (자동 감지)

예시:
$ jarvis policy validate .claude/contract.md
$ jarvis policy validate new-rules.json
```

#### 7.2 `jarvis policy show` — 현재 정책 표시

```bash
jarvis policy show [options]

옵션:
  --section    문자열   특정 섹션만 (예: §1, §4)
  --format     enum     출력: text/json
```

#### 7.3 `jarvis policy update` — 정책 업데이트

```bash
jarvis policy update <file> [options]

옵션:
  --version    문자열   정책 버전 명시
  --reason     문자열   업데이트 사유
  --dry-run    플래그   시뮬레이션만

예시:
$ jarvis policy update new-contract.md --version "1.1.0" --reason "금지사항 추가"
```

---

## 8. `jarvis token` — Capability Token 관리

### 용도
활성 토큰 조회, 수동 발급 (디버깅용), 무효화.

### 문법

```bash
jarvis token <subcommand> [options]
```

### Subcommands

#### 8.1 `jarvis token list` — 활성 토큰 목록

```bash
jarvis token list [options]

옵션:
  --session     문자열   특정 세션 필터
  --cap         문자열   특정 Capability 필터 (예: fs.write)
  --expired     플래그   만료된 토큰도 표시

출력:
Active Tokens (3개):
  cap_20260302_0001  fs.write      TTL: 4분 58초 ⏳
    Scope: /project/hello.txt
    Status: ACTIVE

  cap_20260302_0002  exec.run      TTL: 9분 45초 ⏳
    Scope: ["npm", "python"]
    Status: ACTIVE
```

#### 8.2 `jarvis token revoke` — 토큰 수동 무효화

```bash
jarvis token revoke <token-id> [options]

옵션:
  --reason     문자열   무효화 사유
  --force      플래그   확인 없이 즉시

예시:
$ jarvis token revoke cap_20260302_0001 --reason "manual override"
```

#### 8.3 `jarvis token issue` — 토큰 수동 발급 (디버깅)

```bash
jarvis token issue <cap> <scope> [options]

옵션:
  --ttl        숫자     TTL (초, 기본: 300)
  --session    문자열   세션 ID

예시:
$ jarvis token issue fs.write /project/src --ttl 600 --session session_xyz
```

---

## 9. `jarvis version` — 버전 정보

### 용도
JARVIS OS 및 의존성 버전 확인.

### 문법

```bash
jarvis version [options]
```

### 옵션

| 옵션 | 설명 |
|------|------|
| `--verbose` `-v` | 의존성 버전 상세 표시 |
| `--check-updates` | 새 버전 확인 |

### 예시

```bash
$ jarvis version
$ jarvis version --verbose
```

### 출력

```
JARVIS OS v0.1.0

Core:
  claude-sdk:       1.0.0
  xstate:           5.9.1
  typescript:       5.7.3
  sqlite3:          5.1.6

Runtime:
  Node.js:          v20.11.0
  pnpm:             9.15.4

Components:
  orchestrator:     1.0.0
  spec-agent:       1.0.0
  policy-risk:      1.0.0
  codegen:          1.0.0
  executor:         1.0.0
  (and 4 more)
```

---

## 부록: 공통 옵션

모든 커맨드에서 사용 가능:

```bash
--help, -h              도움말 표시
--version               버전 정보
--config, -c <file>     설정 파일 지정
--log-level             로그 레벨 (debug/info/warn/error)
--quiet, -q             조용한 모드 (에러만 표시)
--json                  JSON 포맷 출력
```

---

## 부록: 설정 파일 (`.jarvis.config.json`)

```json
{
  "trust_mode": "suggest",
  "timeout_seconds": 300,
  "log_level": "info",
  "database_path": "./data/audit.db",
  "policy_file": "./.claude/contract.md",
  "capabilities": {
    "auto_approve_low_risk": false,
    "require_biometric_for_gate": false,
    "mobile_require_approval": true
  },
  "advanced": {
    "batch_api_enabled": false,
    "prompt_caching_enabled": false,
    "max_tokens_per_run": 100000
  }
}
```

---

**version**: 1.0.0
**last_updated**: 2026-03-02
**참조**: `.claude/agents/executor.md`, `.claude/design/schema.sql`
