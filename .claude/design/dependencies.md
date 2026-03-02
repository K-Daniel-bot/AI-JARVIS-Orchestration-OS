# npm 패키지 의존성 목록

> JARVIS OS 전체 패키지의 **정확한 버전 고정 목록**.
> 모든 버전은 `^` 또는 `~` 없이 정확히 고정한다 (재현성 보장).
>
> 관련 규칙: `.claude/rules/security.md` — "package.json에 정확한 버전 고정 필수"
> 관련 규칙: `.claude/CLAUDE.md` Tech Stack

---

## 프로덕션 의존성 (dependencies)

### 코어 / 런타임

---

#### zod

| 항목 | 내용 |
|------|------|
| **버전** | `3.24.1` |
| **라이선스** | MIT |
| **용도** | 런타임 스키마 검증. 에이전트 입출력, API 요청/응답, 감사 로그 항목의 타입 안전성 보장 |
| **사용 패키지** | core, policy-engine, audit, agents, executor, web |
| **선택 이유** | TypeScript-first 설계, 뛰어난 에러 메시지, `z.infer<T>`로 컴파일 타임 타입 자동 추출 |
| **대안** | `yup` (유사 기능이나 TypeScript 지원 미흡), `joi` (런타임 전용, 타입 추출 불가) |
| **보안 주의** | `z.string().url()` 사용 시 프로토콜 화이트리스트 추가 권장 |

```json
"zod": "3.24.1"
```

---

#### xstate

| 항목 | 내용 |
|------|------|
| **버전** | `5.19.2` |
| **라이선스** | MIT |
| **용도** | JARVIS OS 전체 상태 머신 구현. IDLE → SPEC → POLICY → PLAN → CODE → REVIEW → TEST → COMPLETED 흐름 제어 |
| **사용 패키지** | core, web |
| **선택 이유** | XState v5는 Actor Model 기반으로 9개 에이전트의 비동기 생명주기 관리에 최적. TypeScript 완전 지원 |
| **대안** | `redux` (Actor Model 없음), `zustand` (상태 머신 비지원), `robot3` (생태계 소규모) |
| **마이그레이션 주의** | v4 → v5 API 변경 사항 다수. `createMachine` → `setup().createMachine()` |

```json
"xstate": "5.19.2"
```

---

#### better-sqlite3

| 항목 | 내용 |
|------|------|
| **버전** | `11.7.0` |
| **라이선스** | MIT |
| **용도** | 불변 감사 로그 저장 (append-only). 해시 체인 무결성 검증. 동기 API로 로그 손실 없는 원자적 쓰기 보장 |
| **사용 패키지** | audit |
| **선택 이유** | 동기 API (비동기 오버헤드 없음), 임베디드 DB (배포 간소), 높은 쓰기 성능 |
| **대안** | `sqlite3` (콜백 기반, 사용 불편), `@libsql/client` (Turso 전용), PostgreSQL (과도한 외부 의존성) |
| **보안 주의** | SQL 쿼리 반드시 파라미터화. `db.prepare("INSERT ... VALUES (?)").run(value)` 형식 사용 |

```json
"better-sqlite3": "11.7.0"
```

---

#### minimatch

| 항목 | 내용 |
|------|------|
| **버전** | `10.0.1` |
| **라이선스** | ISC |
| **용도** | PolicyDecision의 `fs.write_allow` / `fs.write_deny` Glob 패턴 매칭. 파일 경로 허용/차단 범위 검증 |
| **사용 패키지** | policy-engine, executor |
| **선택 이유** | Node.js 표준 Glob 구현체. `**/*.ts`, `/project/**` 등 정책 규칙 패턴 처리에 필수 |
| **대안** | `micromatch` (더 빠르나 API 차이), `picomatch` (micromatch 내부 사용 라이브러리) |

```json
"minimatch": "10.0.1"
```

---

#### @anthropic-ai/sdk

| 항목 | 내용 |
|------|------|
| **버전** | `0.39.0` |
| **라이선스** | MIT |
| **용도** | Claude API (Opus 4.6 / Sonnet 4.6 / Haiku 4.5) 호출. 9개 에이전트의 AI 추론 요청/응답 처리 |
| **사용 패키지** | agents, core |
| **선택 이유** | Anthropic 공식 SDK. Streaming, Tool Use, Extended Thinking 지원 |
| **대안** | `axios` 직접 사용 (유지관리 부담), `litellm` (Phase 3 멀티모달 확장 시 고려) |
| **보안 주의** | API 키 반드시 환경변수 (`ANTHROPIC_API_KEY`)로 관리. 코드 하드코딩 절대 금지 |

```json
"@anthropic-ai/sdk": "0.39.0"
```

---

### 프론트엔드 (React 생태계)

---

#### react

| 항목 | 내용 |
|------|------|
| **버전** | `19.0.0` |
| **라이선스** | MIT |
| **용도** | JARVIS OS 대시보드 UI 프레임워크. 3-패널 레이아웃, Gate 승인 UI, 실시간 감사 로그 뷰어 |
| **사용 패키지** | web |
| **선택 이유** | 현재 팀 기술 스택. React 19의 Server Components, Actions, use() 훅 활용 가능 |
| **대안** | `vue` (팀 기술 미보유), `svelte` (생태계 규모 작음) |
| **마이그레이션 주의** | React 19에서 `ReactDOM.render` 제거됨 → `createRoot` 사용 필수 |

```json
"react": "19.0.0"
```

---

#### react-dom

| 항목 | 내용 |
|------|------|
| **버전** | `19.0.0` |
| **라이선스** | MIT |
| **용도** | React 컴포넌트를 DOM에 렌더링. `createRoot`, `hydrateRoot` API 포함 |
| **사용 패키지** | web |
| **선택 이유** | react와 버전 동일 유지 필수 (분리 시 런타임 에러 발생) |
| **대안** | (react와 분리 불가) |

```json
"react-dom": "19.0.0"
```

---

#### framer-motion

| 항목 | 내용 |
|------|------|
| **버전** | `11.15.0` |
| **라이선스** | MIT |
| **용도** | Gate 승인/거부 애니메이션, 에이전트 상태 전환 시각화, 감사 로그 실시간 스크롤 효과 |
| **사용 패키지** | web |
| **선택 이유** | React 전용 선언적 애니메이션 API. layout animation, Presence 기반 진입/퇴장 효과 |
| **대안** | `react-spring` (더 낮은 수준의 API), `gsap` (복잡한 설정 필요) |
| **번들 최적화** | tree-shaking 지원. 사용하는 모션 컴포넌트만 import |

```json
"framer-motion": "11.15.0"
```

---

#### tailwindcss

| 항목 | 내용 |
|------|------|
| **버전** | `4.0.0` |
| **라이선스** | MIT |
| **용도** | JARVIS OS 대시보드 스타일링. 3-패널 레이아웃, 위험도별 색상 코딩, 다크 모드, 접근성 클래스 |
| **사용 패키지** | web |
| **선택 이유** | 유틸리티 우선 접근법으로 컴포넌트 파일에 스타일 집중. CSS-in-JS 런타임 오버헤드 없음 |
| **대안** | `styled-components` (런타임 CSS 생성 오버헤드), `emotion` (유사 단점) |
| **v4 주의** | `tailwind.config.js` → CSS-based config로 변경. PostCSS 플러그인 방식 동일 |

```json
"tailwindcss": "4.0.0"
```

---

## 개발 의존성 (devDependencies)

### 언어 / 타입 시스템

---

#### typescript

| 항목 | 내용 |
|------|------|
| **버전** | `5.7.3` |
| **라이선스** | Apache-2.0 |
| **용도** | 전체 코드베이스 타입 검사. strict mode 강제, 타입 안전성 보장 |
| **설정** | `tsconfig.json`: `"strict": true`, `"noImplicitAny": true`, `"strictNullChecks": true` |

```json
"typescript": "5.7.3"
```

---

### 테스트

---

#### vitest

| 항목 | 내용 |
|------|------|
| **버전** | `2.1.8` |
| **라이선스** | MIT |
| **용도** | 단위 테스트, 통합 테스트, 커버리지 측정. 외부 서비스 Mock (Claude API, SQLite, OS 호출) |
| **선택 이유** | Vite 기반으로 빠른 실행. jest 호환 API. TypeScript 네이티브 지원 |
| **설정** | `vitest.config.ts`: coverage threshold 80%, reporter: `['text', 'lcov']` |

```json
"vitest": "2.1.8"
```

---

### 린트 / 포맷

---

#### eslint

| 항목 | 내용 |
|------|------|
| **버전** | `9.18.0` |
| **라이선스** | MIT |
| **용도** | TypeScript 코드 품질 검사. `no-explicit-any`, `no-floating-promises`, `security/detect-eval-with-expression` 규칙 포함 |
| **설정** | Flat config (`eslint.config.mjs`). `@typescript-eslint/recommended-strict` 사용 |

```json
"eslint": "9.18.0"
```

---

#### prettier

| 항목 | 내용 |
|------|------|
| **버전** | `3.4.2` |
| **라이선스** | MIT |
| **용도** | 코드 포맷 일관성 강제. ESLint와 충돌 방지 (`eslint-config-prettier` 연동) |
| **설정** | `tabWidth: 2`, `singleQuote: true`, `trailingComma: "es5"` |

```json
"prettier": "3.4.2"
```

---

### 빌드 / 모노레포

---

#### turbo

| 항목 | 내용 |
|------|------|
| **버전** | `2.3.3` |
| **라이선스** | MIT |
| **용도** | 모노레포 태스크 오케스트레이션. 의존성 기반 병렬 빌드, 캐싱으로 CI 속도 향상 |
| **파이프라인** | `build` → `typecheck` → `test` → `lint` 순서 강제 |

```json
"turbo": "2.3.3"
```

---

### 타입 정의 패키지

---

#### @types/better-sqlite3

| 항목 | 내용 |
|------|------|
| **버전** | `7.6.12` |
| **라이선스** | MIT |
| **용도** | `better-sqlite3`의 TypeScript 타입 정의. `Database`, `Statement`, `RunResult` 타입 |

```json
"@types/better-sqlite3": "7.6.12"
```

---

#### @types/react

| 항목 | 내용 |
|------|------|
| **버전** | `19.0.2` |
| **라이선스** | MIT |
| **용도** | React 19 TypeScript 타입. JSX 타입, Hook 타입, 이벤트 핸들러 타입 |

```json
"@types/react": "19.0.2"
```

---

#### @types/react-dom

| 항목 | 내용 |
|------|------|
| **버전** | `19.0.2` |
| **라이선스** | MIT |
| **용도** | React DOM 19 TypeScript 타입. `createRoot`, `flushSync` 타입 정의 |

```json
"@types/react-dom": "19.0.2"
```

---

### CSS 빌드 도구

---

#### postcss

| 항목 | 내용 |
|------|------|
| **버전** | `8.4.49` |
| **라이선스** | MIT |
| **용도** | Tailwind CSS 처리 파이프라인. CSS 변환, 자동 벤더 프리픽스, 최소화 |

```json
"postcss": "8.4.49"
```

---

#### autoprefixer

| 항목 | 내용 |
|------|------|
| **버전** | `10.4.20` |
| **라이선스** | MIT |
| **용도** | CSS 벤더 프리픽스 자동 추가 (PostCSS 플러그인). 크로스 브라우저 CSS 호환성 보장 |

```json
"autoprefixer": "10.4.20"
```

---

## 전체 package.json 참조 (루트 워크스페이스)

```json
{
  "private": true,
  "scripts": {
    "build":     "turbo run build",
    "test":      "turbo run test",
    "lint":      "turbo run lint",
    "dev":       "turbo run dev",
    "typecheck": "turbo run typecheck"
  },
  "devDependencies": {
    "typescript":          "5.7.3",
    "vitest":              "2.1.8",
    "eslint":              "9.18.0",
    "prettier":            "3.4.2",
    "turbo":               "2.3.3",
    "@types/better-sqlite3": "7.6.12",
    "@types/react":        "19.0.2",
    "@types/react-dom":    "19.0.2",
    "postcss":             "8.4.49",
    "autoprefixer":        "10.4.20"
  }
}
```

---

## 패키지별 의존성 매핑

| 패키지 | 프로덕션 의존성 |
|--------|---------------|
| `packages/core` | xstate, zod, @anthropic-ai/sdk |
| `packages/policy-engine` | zod, minimatch |
| `packages/audit` | better-sqlite3, zod |
| `packages/agents` | zod, @anthropic-ai/sdk |
| `packages/executor` | zod, minimatch |
| `packages/web` | react, react-dom, framer-motion, tailwindcss, xstate, zod |
| `packages/cli` | zod |
| `packages/shared` | zod |

---

## 보안 정책 준수 사항

`.claude/rules/security.md` 기준 검토:

```
□ 모든 버전이 정확히 고정됨 (^ 또는 ~ 없음)
□ 패키지명 타입스퀴팅 검사 완료
  - 검증: "minimatch" (not "minmatch", "minimacht")
  - 검증: "@anthropic-ai/sdk" (not "anthropic-sdk", "@anthropic/sdk")
  - 검증: "better-sqlite3" (not "better-sqlite", "beter-sqlite3")
□ CDN URL import 없음 (모든 패키지 npm 레지스트리 경유)
□ API 키 등 시크릿이 package.json에 포함되지 않음
□ MIT / ISC / Apache-2.0 라이선스만 사용 (GPL 라이선스 없음)
```

---

## pnpm 설정 (`pnpm-workspace.yaml`)

```yaml
packages:
  - "packages/*"
```

`.npmrc`:
```ini
shamefully-hoist=false
strict-peer-dependencies=true
auto-install-peers=true
```

---

> version: 1.0.0
> created: 2026-03-02
> phase: 0 (MVP)
> 관련 규칙: `.claude/rules/security.md` "정확한 버전 고정 필수"
