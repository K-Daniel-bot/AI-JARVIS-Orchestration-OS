# JARVIS OS — 환경변수 명세서

> 이 문서는 JARVIS OS 전체 런타임에서 사용하는 환경변수를 정의합니다.
> 모든 패키지는 이 명세를 기준으로 환경변수를 읽고 검증해야 합니다.
> 민감 변수는 `.env` 파일에 보관하며, `.env`는 절대 git에 커밋하지 않습니다.

---

## 파일 구조

```
프로젝트 루트/
├── .env                  # 실제 값 (git 제외 — .gitignore 필수)
├── .env.example          # 빈 예시 파일 (git 포함)
└── packages/shared/src/env.ts   # Zod 스키마로 런타임 검증
```

---

## 1. ANTHROPIC_API_KEY

| 항목 | 내용 |
|------|------|
| **용도** | Claude API (Opus 4.6 / Sonnet 4.6 / Haiku 4.5) 호출 인증 |
| **필수 여부** | 필수 (단, `JARVIS_STUB_MODE=true` 시 생략 가능) |
| **기본값** | 없음 |
| **형식** | `sk-ant-api03-...` (Anthropic API 키 형식) |
| **검증 규칙** | `JARVIS_STUB_MODE=false`일 때 비어있으면 즉시 기동 실패 |
| **보안 고려사항** | 로그/감사 로그에 절대 출력 금지. 메모리에 평문 보관 최소화. OS Credential Manager에 저장 권장. 에이전트 간 메시지에 포함 금지 |

```bash
# .env.example
ANTHROPIC_API_KEY=sk-ant-api03-YOUR_KEY_HERE
```

---

## 2. JARVIS_OS_ENV

| 항목 | 내용 |
|------|------|
| **용도** | 런타임 환경 구분. 로그 상세도, 감사 로그 레벨, 게이트 동작 방식에 영향 |
| **필수 여부** | 선택 |
| **기본값** | `development` |
| **허용 값** | `development` \| `staging` \| `production` |
| **검증 규칙** | Zod enum으로 허용 값 외 입력 시 기동 실패 |
| **보안 고려사항** | `production` 모드에서는 stack trace 노출 금지, 디버그 엔드포인트 비활성화 |

### 환경별 동작 차이

| 동작 | development | staging | production |
|------|-------------|---------|------------|
| 로그 상세도 | `debug` 이상 | `info` 이상 | `warn` 이상 |
| 감사 로그 레벨 | `SUMMARY` 허용 | `SUMMARY` 허용 | `FULL` 강제 |
| 스텁 API 허용 | O | O | X (강제 실패) |
| 스택 트레이스 노출 | O | X | X |
| Gate UI 강제 표시 | X (auto skip 가능) | O | O |

```bash
JARVIS_OS_ENV=development
```

---

## 3. JARVIS_DB_PATH

| 항목 | 내용 |
|------|------|
| **용도** | SQLite 감사 로그 데이터베이스 파일 경로 |
| **필수 여부** | 선택 |
| **기본값** | `./data/audit.db` (프로젝트 루트 기준 상대 경로) |
| **형식** | 절대 경로 또는 프로젝트 루트 기준 상대 경로 |
| **검증 규칙** | 경로의 상위 디렉토리가 존재해야 함. 존재하지 않으면 자동 생성 시도. 쓰기 권한 없으면 기동 실패 |
| **보안 고려사항** | OS 시스템 디렉토리 경로 금지 (`/Windows/**`, `/System/**`). 경로 정규화 후 허용 범위 검증(Path traversal 방어). 감사 DB 파일은 다른 프로세스 쓰기 잠금 필요 |

```bash
JARVIS_DB_PATH=./data/audit.db
# 또는 절대 경로
JARVIS_DB_PATH=/home/user/jarvis-data/audit.db
```

---

## 4. JARVIS_LOG_LEVEL

| 항목 | 내용 |
|------|------|
| **용도** | 런타임 로그 출력 수준 결정 |
| **필수 여부** | 선택 |
| **기본값** | `info` |
| **허용 값** | `debug` \| `info` \| `warn` \| `error` |
| **검증 규칙** | Zod enum으로 허용 값 외 입력 시 `info`로 폴백 후 경고 출력 |
| **보안 고려사항** | `debug` 레벨은 토큰/시크릿 마스킹 강도 최대로 설정. `production` 환경에서 `debug` 설정 시 경고 출력. 로그에 민감 정보(API key, 비밀번호, 토큰) 출력 금지 — redaction 파이프라인 필수 통과 |

### 레벨별 출력 범위

| 레벨 | 출력 내용 |
|------|----------|
| `debug` | 에이전트 내부 처리 흐름, 메시지 페이로드 (마스킹 적용), 성능 지표 |
| `info` | 상태 전이, Gate 이벤트, 에이전트 시작/완료 |
| `warn` | 재시도, 폴백, 비정상 패턴 탐지 |
| `error` | 에이전트 실패, 정책 위반, 복구 불가 상태 |

```bash
JARVIS_LOG_LEVEL=info
```

---

## 5. JARVIS_TRUST_MODE

| 항목 | 내용 |
|------|------|
| **용도** | JARVIS OS의 기본 신뢰 모드 설정. contract.md §4 정책 적용 기준 |
| **필수 여부** | 선택 |
| **기본값** | `suggest` |
| **허용 값** | `observe` \| `suggest` \| `semi-auto` \| `full-auto` |
| **검증 규칙** | Zod enum 검증. `full-auto`는 `JARVIS_OS_ENV=production`에서 허용하지 않음 (계약서 §4 규정) |
| **보안 고려사항** | `full-auto` 모드 시 `JARVIS_SESSION_TTL_MINUTES`가 반드시 설정되어야 함. 모바일 환경에서는 `full-auto` 진입 시 강제로 `suggest` 전환(계약서 §4). 환경변수로 설정된 값은 사용자 런타임 변경으로 언제든 덮어쓸 수 있음 |

### 모드별 동작 요약

| 모드 | 자동 실행 | Gate 요구 | OS 액션 허용 |
|------|----------|----------|------------|
| `observe` | 없음 | — | 금지 (계획/설명만) |
| `suggest` | 없음 | 항상 | Gate 통과 후만 |
| `semi-auto` | LOW risk만 | MEDIUM/HIGH/CRITICAL | Gate 통과 후만 |
| `full-auto` | LOW/MEDIUM | HIGH/CRITICAL | 안전구역 + 세션 TTL 제한 |

```bash
JARVIS_TRUST_MODE=suggest
```

---

## 6. JARVIS_SESSION_TTL_MINUTES

| 항목 | 내용 |
|------|------|
| **용도** | 사용자 세션 유효 시간. 만료 시 모든 Capability Token 무효화, 재인증 필요 |
| **필수 여부** | 선택 (단, `JARVIS_TRUST_MODE=full-auto`이면 필수) |
| **기본값** | `30` |
| **형식** | 양의 정수 (분 단위) |
| **허용 범위** | `1` ~ `1440` (최대 24시간) |
| **검증 규칙** | 범위 초과 시 기동 실패. `full-auto` 모드에서 미설정 시 기동 실패 |
| **보안 고려사항** | `full-auto` 모드에서 최대 60분 권장 (계약서 §4: 기본 10~30분). 세션 만료 시 진행 중인 모든 Capability 즉시 무효화. 만료 5분 전 사용자에게 경고 알림 |

```bash
JARVIS_SESSION_TTL_MINUTES=30
```

---

## 7. JARVIS_MAX_TOKENS_PER_RUN

| 항목 | 내용 |
|------|------|
| **용도** | 단일 실행(Run) 당 Claude API 토큰 소비 상한선. 예산 초과 시 `RESOURCE_EXHAUSTED` 에러 발생 |
| **필수 여부** | 선택 |
| **기본값** | `100000` |
| **형식** | 양의 정수 |
| **허용 범위** | `1000` ~ `2000000` |
| **검증 규칙** | 범위 초과 시 기동 실패. 실행 중 80% 도달 시 사용자 경고, 100% 도달 시 현재 단계 완료 후 중단 |
| **보안 고려사항** | 비용 폭주 방지를 위한 필수 안전장치. 에이전트별 개별 상한은 `BUDGET.json`에서 설정. 80% 도달 경고를 감사 로그에 기록 |

```bash
JARVIS_MAX_TOKENS_PER_RUN=100000
```

---

## 8. JARVIS_STUB_MODE

| 항목 | 내용 |
|------|------|
| **용도** | Claude API 호출 없이 스텁(Mock) 응답으로 동작. 개발/테스트 환경에서 API 비용 없이 워크플로우 검증 |
| **필수 여부** | 선택 |
| **기본값** | `false` |
| **허용 값** | `true` \| `false` |
| **검증 규칙** | `JARVIS_OS_ENV=production`에서 `true`로 설정 시 기동 실패 (프로덕션 스텁 금지) |
| **보안 고려사항** | 스텁 모드에서도 감사 로그는 정상 기록 (스텁 응답임을 명시). OS 조작(Executor 액션)은 스텁 모드에서도 dry-run으로만 동작. `ANTHROPIC_API_KEY` 없어도 기동 가능 |

### 스텁 모드 동작

```
스텁 응답 예시:
- Spec Agent → "사용자 요청: [스텁] 분석 완료"
- Policy Agent → risk_score: 10, status: ALLOW
- Planner → 단일 step 계획
- Codegen → "// [스텁] 코드 생성"
- Executor → dry-run 결과만 반환
```

```bash
JARVIS_STUB_MODE=false
```

---

## 9. NODE_OPTIONS

| 항목 | 내용 |
|------|------|
| **용도** | Node.js 런타임 옵션. 주로 힙 메모리 상한 설정 |
| **필수 여부** | 선택 |
| **기본값** | `--max-old-space-size=4096` |
| **형식** | Node.js CLI 옵션 문자열 |
| **검증 규칙** | Zod로 검증하지 않음 (Node.js 자체가 처리). 프로세스 시작 전 환경변수로 설정 필요 |
| **보안 고려사항** | `--inspect`, `--inspect-brk` 옵션은 `production`에서 사용 금지 (디버거 포트 노출 위험). `--allow-*` 플래그는 최소 권한 원칙 적용 |

```bash
NODE_OPTIONS=--max-old-space-size=4096
```

---

## 10. 전체 .env.example

```bash
# ============================================================
# JARVIS OS 환경변수 설정 파일 — 예시 (.env.example)
# 이 파일을 .env로 복사 후 실제 값을 입력하세요.
# .env 파일은 절대 git에 커밋하지 마세요.
# ============================================================

# Claude API 인증 키 (필수 — https://console.anthropic.com)
ANTHROPIC_API_KEY=sk-ant-api03-YOUR_KEY_HERE

# 런타임 환경 (development | staging | production)
JARVIS_OS_ENV=development

# SQLite 감사 로그 DB 경로
JARVIS_DB_PATH=./data/audit.db

# 로그 레벨 (debug | info | warn | error)
JARVIS_LOG_LEVEL=info

# 신뢰 모드 (observe | suggest | semi-auto | full-auto)
JARVIS_TRUST_MODE=suggest

# 세션 TTL (분 단위, 1~1440)
JARVIS_SESSION_TTL_MINUTES=30

# 실행당 최대 토큰 (1000~2000000)
JARVIS_MAX_TOKENS_PER_RUN=100000

# 스텁 모드 — API 키 없이 테스트 가능 (true | false)
# production에서는 반드시 false
JARVIS_STUB_MODE=false

# Node.js 힙 메모리 옵션
NODE_OPTIONS=--max-old-space-size=4096
```

---

## 11. 런타임 검증 스키마 (packages/shared/src/env.ts 참조)

```typescript
// 환경변수 런타임 검증 스키마 — Zod 기반
import { z } from 'zod';

const envSchema = z.object({
  ANTHROPIC_API_KEY: z.string().optional(),
  JARVIS_OS_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  JARVIS_DB_PATH: z.string().default('./data/audit.db'),
  JARVIS_LOG_LEVEL: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
  JARVIS_TRUST_MODE: z.enum(['observe', 'suggest', 'semi-auto', 'full-auto']).default('suggest'),
  JARVIS_SESSION_TTL_MINUTES: z.coerce.number().int().min(1).max(1440).default(30),
  JARVIS_MAX_TOKENS_PER_RUN: z.coerce.number().int().min(1000).max(2000000).default(100000),
  JARVIS_STUB_MODE: z.enum(['true', 'false']).transform(v => v === 'true').default('false'),
  NODE_OPTIONS: z.string().default('--max-old-space-size=4096'),
}).superRefine((data, ctx) => {
  // ANTHROPIC_API_KEY 필수 검증 (스텁 모드가 아닐 때)
  if (!data.JARVIS_STUB_MODE && !data.ANTHROPIC_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'ANTHROPIC_API_KEY는 스텁 모드가 아닌 경우 필수입니다',
      path: ['ANTHROPIC_API_KEY'],
    });
  }
  // 프로덕션 환경 스텁 모드 금지
  if (data.JARVIS_OS_ENV === 'production' && data.JARVIS_STUB_MODE) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'production 환경에서는 JARVIS_STUB_MODE=true 사용 불가',
      path: ['JARVIS_STUB_MODE'],
    });
  }
  // full-auto 모드 세션 TTL 검증
  if (data.JARVIS_TRUST_MODE === 'full-auto' && data.JARVIS_SESSION_TTL_MINUTES > 60) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'full-auto 모드에서 세션 TTL은 최대 60분입니다',
      path: ['JARVIS_SESSION_TTL_MINUTES'],
    });
  }
});
```

---

## 12. 민감 변수 마스킹 규칙

| 변수 | 로그 출력 형식 |
|------|--------------|
| `ANTHROPIC_API_KEY` | `sk-ant-...****` (앞 10자 + 마스킹) |
| `JARVIS_DB_PATH` | 전체 경로 출력 허용 (민감 아님) |
| 기타 변수 | 전체 값 출력 허용 |

---

> version: 1.0.0
> last_updated: 2026-03-02
> 참조: `.claude/design/security-deep.md` §5, `.claude/contract.md` §1, §4
