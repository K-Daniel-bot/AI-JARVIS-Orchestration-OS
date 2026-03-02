# JARVIS OS — Risk Score 계산 상세 명세

> 이 문서는 `.claude/agents/policy-risk.md §3.1`의 Risk Score 계산 로직을 구체화한다.
> Policy & Risk Agent가 Risk Score를 결정론적(deterministic)으로 계산할 수 있도록
> 모든 점수 기준, 가중치, 임계값, 자동 DENY 패턴을 모호함 없이 정의한다.
>
> **참조 파일**:
> - `.claude/agents/policy-risk.md §3.1` — 상위 개요
> - `.claude/schemas/policy-decision.json` — PolicyDecision 스키마
> - `.claude/contract.md §1` — 절대 금지사항 (자동 DENY 오버라이드 근거)
>
> version: 1.0.0
> last_updated: 2026-03-02

---

## 1. 5차원 점수 기준표

### 개요

Risk Score는 5개 차원 각각을 **0~10** 정수로 평가한 뒤, 차원별 가중치를 곱하여 합산한다.
각 차원의 점수는 아래 기준표에 따라 결정론적으로 매핑된다.
중간 값(예: 1, 3, 5, 7, 9)은 기준표에 없으면 **가장 가까운 낮은 기준값**을 사용한다.

> 예: "단일 파일 쓰기 2개"는 점수 2와 4 사이이므로 점수 2를 적용 (보수적 추정).
> 단, 자동 DENY 오버라이드(§4)에 해당하는 경우는 점수 계산 전에 즉시 차단.

---

### 1.1 시스템 영향도 (System Impact) — 가중치: 3

파일 시스템 변경 범위, 프로세스 실행, 시스템 설정 변경 여부를 평가한다.

| 점수 | 기준 | 해당 ActionType 예시 |
|------|------|----------------------|
| **0** | 읽기 전용 작업만 수행 (쓰기/실행 없음) | `FS_READ`, `FS_LIST`, `SCREEN_CAPTURE` |
| **2** | 프로젝트 내부 단일 파일 쓰기 (1~2개 파일) | `FS_WRITE` (단일 파일, 프로젝트 내부) |
| **4** | 프로젝트 내부 다중 파일 쓰기 (3~10개 파일) | `FS_WRITE` (다중), `FS_MKDIR` |
| **6** | 디렉토리 구조 변경 또는 패키지 설치 | `PKG_INSTALL`, `FS_RENAME`, `FS_RMDIR` (비어있는 디렉토리) |
| **8** | 프로세스 실행 (node, python, git 등 일반 런타임) | `EXEC_RUN` (비관리자), `APP_LAUNCH` |
| **10** | 시스템 설정 변경, 서비스 재시작, 전역 환경 변경 | `SERVICE_RESTART`, `ENV_MODIFY`, `SYSTEM_SETTING_CHANGE` |

**판정 우선순위**: 한 요청에 여러 액션이 포함된 경우 **가장 높은 점수**를 적용한다.

---

### 1.2 데이터 민감도 (Data Sensitivity) — 가중치: 3

접근 또는 수정하는 데이터의 민감도를 평가한다.

| 점수 | 기준 | 파일/경로 패턴 예시 |
|------|------|---------------------|
| **0** | 공개 데이터 (README, 공개 소스코드, 공개 문서) | `README.md`, `LICENSE`, `*.md` (공개 문서) |
| **2** | 프로젝트 일반 소스코드 (비인증 관련) | `src/**/*.ts`, `packages/**/*.js` |
| **4** | 설정 파일 (환경 변수 예시, 설정 템플릿) | `.env.example`, `config.json`, `*.yaml` (비시크릿) |
| **6** | 인증 관련 코드 (로그인, 세션, 토큰 처리 로직) | `**/auth/**`, `**/login/**`, `**/session/**`, `**/jwt/**` |
| **8** | 비밀 파일 (실제 환경 변수, 자격증명, 키 파일) | `.env`, `*.pem`, `credentials.json`, `keychain.*` |
| **10** | 금융/의료/개인정보 데이터 (법적 규제 대상) | 은행 데이터, PII (주민등록번호, 카드번호), 의료 기록 |

**경로 판정 규칙**:
- 파일 경로에 `auth`, `login`, `session`, `credential`, `secret`, `token`, `key`가 포함되면 최소 점수 6 적용.
- `.env` 파일(`.env.example` 제외)에 접근하는 경우 최소 점수 8 적용.

---

### 1.3 금전/결제 관련 (Financial Impact) — 가중치: 5 (최고 가중치)

금전적 손실 또는 결제 처리와 관련된 모든 요청을 평가한다.
**가중치가 가장 높으므로 이 차원에서 점수가 높으면 전체 Risk Score에 결정적 영향을 미친다.**

| 점수 | 기준 | 판단 기준 예시 |
|------|------|----------------|
| **0** | 금융과 전혀 무관한 작업 | 일반 코드 작성, 파일 정리, UI 개발 |
| **4** | 결제/금융 관련 코드 작성 (실제 접근 없이 로직만) | `PaymentService.ts` 작성, 결제 UI 컴포넌트 생성 |
| **7** | 결제 API 테스트 호출 (샌드박스/스테이징 환경) | Stripe 테스트 키로 `charge.create()` 호출 |
| **10** | 실제 금융 사이트/프로덕션 결제 API 접근 | 실제 은행 사이트 접근, 프로덕션 결제 API 호출 |

**중간 값 없음**: 이 차원은 정수 0, 4, 7, 10만 허용한다.
4와 7 사이는 **7 적용** (보수적 추정), 0과 4 사이는 **0 또는 4** 중 더 보수적 값 적용.

**판정 힌트**:
- 요청 내용 또는 파일 경로에 `payment`, `billing`, `invoice`, `charge`, `bank`, `credit`, `debit`, `wallet`이 포함되면 최소 점수 4 적용.
- 실제 URL이 금융 도메인(`.bank`, `pay.`, `billing.`, 등)이면 최소 점수 10 적용 + §4 DENY 오버라이드 검토.

---

### 1.4 관리자 권한 필요 여부 (Admin Privilege) — 가중치: 4

운영체제 수준의 권한 상승이 필요한지 평가한다.

| 점수 | 기준 | 예시 |
|------|------|------|
| **0** | 일반 사용자 권한으로 충분 (프로젝트 범위 내) | 프로젝트 폴더 내 파일 읽기/쓰기 |
| **3** | 시스템 디렉토리 읽기 전용 접근 | `/usr/bin` 목록 조회, `Program Files` 내 파일 읽기 |
| **6** | 레지스트리/plist 읽기 (쓰기 없음) | `HKCU` 레지스트리 읽기, macOS `plist` 파일 읽기 |
| **8** | sudo/관리자 권한 실행 필요 | `sudo npm install -g`, 시스템 서비스 쿼리 |
| **10** | 커널/드라이버/서비스 레벨 변경 | 레지스트리 쓰기(`regedit`), 드라이버 설치, `HKLM` 쓰기, `powershell_admin` |

**Windows/macOS 매핑**:

| Windows | macOS | 점수 |
|---------|-------|------|
| 일반 사용자 폴더 (`%USERPROFILE%`) | `~/` 내부 | 0 |
| `C:\Program Files` 읽기 | `/Applications` 읽기 | 3 |
| `HKCU` 레지스트리 읽기 | `~/Library/Preferences` 읽기 | 6 |
| UAC 필요 작업 | `sudo` 필요 작업 | 8 |
| `regedit`, `powershell_admin`, `HKLM` 쓰기 | SIP 우회, 커널 확장 | 10 |

---

### 1.5 외부 네트워크 접근 (External Network) — 가중치: 2

외부 인터넷 접근의 범위와 신뢰도를 평가한다.

| 점수 | 기준 | 예시 |
|------|------|------|
| **0** | 네트워크 접근 없음 (완전 로컬 작업) | 로컬 파일 편집, 오프라인 빌드 |
| **3** | allowlist 도메인 접근 (사전 승인된 레지스트리/저장소) | `registry.npmjs.org`, `github.com`, `pypi.org` |
| **5** | 알려지지 않은 새 도메인 접근 (allowlist 미포함) | 처음 접근하는 외부 API, 알 수 없는 CDN |
| **8** | 외부 파일 다운로드 (바이너리, 실행파일 포함 가능) | `curl` 다운로드, `wget`, npm 패키지 tarball |
| **10** | 인증이 필요한 외부 서비스 접근 (로그인 포함) | OAuth 인증, API 키 사용 외부 서비스, 웹 로그인 자동화 |

**allowlist 도메인 목록** (고정, 정책 갱신으로만 변경 가능):

```
registry.npmjs.org      — npm 레지스트리
pypi.org                — Python 패키지 인덱스
github.com              — GitHub (소스 코드)
raw.githubusercontent.com — GitHub 원시 파일
api.anthropic.com       — Claude API
```

---

## 2. 총점 계산 공식

### 2.1 계산 공식

```
// 각 차원 점수 (0~10 정수)
systemImpact:     시스템 영향도 점수
dataSensitivity:  데이터 민감도 점수
financial:        금전/결제 점수
adminPrivilege:   관리자 권한 점수
externalNetwork:  외부 네트워크 점수

// 가중 합산
weightedSum = (systemImpact × 3)
            + (dataSensitivity × 3)
            + (financial × 5)
            + (adminPrivilege × 4)
            + (externalNetwork × 2)

// 최대 가능 점수: 10×3 + 10×3 + 10×5 + 10×4 + 10×2 = 170

// 정규화 (0~100 정수)
normalizedScore = Math.round(weightedSum / 170 × 100)

// 최종 riskScore: 0 이상 100 이하 정수
riskScore = Math.min(100, Math.max(0, normalizedScore))
```

### 2.2 TypeScript 구현 참고

```typescript
// 위험도 점수 계산 함수 — 5차원 입력을 받아 정규화된 0~100 점수 반환
export interface RiskDimensions {
  systemImpact: number;     // 시스템 영향도 (0~10 정수)
  dataSensitivity: number;  // 데이터 민감도 (0~10 정수)
  financial: number;        // 금전/결제 위험도 (0, 4, 7, 10만 허용)
  adminPrivilege: number;   // 관리자 권한 필요도 (0~10 정수)
  externalNetwork: number;  // 외부 네트워크 접근 위험도 (0~10 정수)
}

// 차원별 가중치 상수 — 정책 문서와 반드시 동기화 유지
export const DIMENSION_WEIGHTS = {
  systemImpact: 3,
  dataSensitivity: 3,
  financial: 5,
  adminPrivilege: 4,
  externalNetwork: 2,
} as const;

// 최대 가능 가중 합산값 (각 차원 최대 10점 기준)
const MAX_WEIGHTED_SUM = 170;

export function calculateRiskScore(dims: RiskDimensions): number {
  // 입력값 유효성 검사 — 0~10 범위 강제
  const clamp = (v: number): number => Math.min(10, Math.max(0, Math.round(v)));

  const weightedSum =
    clamp(dims.systemImpact)    * DIMENSION_WEIGHTS.systemImpact    +
    clamp(dims.dataSensitivity) * DIMENSION_WEIGHTS.dataSensitivity +
    clamp(dims.financial)       * DIMENSION_WEIGHTS.financial        +
    clamp(dims.adminPrivilege)  * DIMENSION_WEIGHTS.adminPrivilege  +
    clamp(dims.externalNetwork) * DIMENSION_WEIGHTS.externalNetwork;

  // 정규화 후 0~100 범위 정수로 반환
  return Math.min(100, Math.max(0, Math.round(weightedSum / MAX_WEIGHTED_SUM * 100)));
}
```

### 2.3 계산 검증 예시

```
// 모든 차원 최대값 → 100점
weightedSum = (10×3) + (10×3) + (10×5) + (10×4) + (10×2) = 170
normalizedScore = Math.round(170 / 170 × 100) = 100 ✓

// 모든 차원 최소값 → 0점
weightedSum = 0
normalizedScore = 0 ✓

// 금전 차원만 최대(10), 나머지 0 → 29점
weightedSum = 10 × 5 = 50
normalizedScore = Math.round(50 / 170 × 100) = Math.round(29.41) = 29 ✓
```

---

## 3. 판정 임계값 (Risk Level 매핑)

### 3.1 경계값 포함 규칙

```
riskScore 0  이상 25 이하  → LOW      (ALLOW 또는 CONSTRAINED_ALLOW)
riskScore 26 이상 50 이하  → MEDIUM   (APPROVAL_REQUIRED, Gate L1)
riskScore 51 이상 75 이하  → HIGH     (APPROVAL_REQUIRED, Gate L2)
riskScore 76 이상 100 이하 → CRITICAL (DENY — 자동 차단)
```

**경계값 판정 예시** (모호함 없음):
- 정확히 25점 → **LOW** (25 ≤ 25이므로)
- 정확히 26점 → **MEDIUM** (26 ≥ 26이므로)
- 정확히 50점 → **MEDIUM** (50 ≤ 50이므로)
- 정확히 51점 → **HIGH** (51 ≥ 51이므로)
- 정확히 75점 → **HIGH** (75 ≤ 75이므로)
- 정확히 76점 → **CRITICAL** (76 ≥ 76이므로)

### 3.2 Risk Level별 PolicyDecision 매핑

| Risk Level | riskScore 범위 | status 기본값 | 필수 게이트 | 설명 |
|------------|----------------|---------------|-------------|------|
| **LOW** | 0~25 | `CONSTRAINED_ALLOW` | 없음 (자동 실행) | 단순 읽기, 공개 데이터 조회 등 |
| **MEDIUM** | 26~50 | `APPROVAL_REQUIRED` | `GATE_PLAN` | 파일 쓰기, 패키지 설치 계획 포함 |
| **HIGH** | 51~75 | `APPROVAL_REQUIRED` | `GATE_PLAN` + `GATE_APPLY_CHANGES` | 인증 코드 수정, 다중 파일 변경 |
| **CRITICAL** | 76~100 | `DENY` | 해당 없음 | 자동 차단, 계약서 위반 수준 |

**권한 등급별 조정 규칙** (policy-risk.md §3.4 참조):

```
같은 riskScore라도 사용자 권한(role)에 따라 status가 달라질 수 있다.

// 파일 삭제 요청 (riskScore 40, MEDIUM 판정 시)
Owner → CONSTRAINED_ALLOW (Gate L1만)
Admin → APPROVAL_REQUIRED (Gate L1 + L2)
User  → APPROVAL_REQUIRED (Gate L2 + 관리자 확인 요구)
Guest → DENY

// Owner도 CRITICAL 범위(76~100)는 DENY — 권한 등급이 CRITICAL을 ALLOW로 바꾸지 못함
```

---

## 4. 자동 DENY 오버라이드

### 4.1 개요

아래 패턴에 해당하면 **Risk Score 계산 결과와 무관하게 즉시 DENY**한다.
이 규칙은 contract.md §1의 절대 금지사항을 기술적으로 강제하는 메커니즘이다.

오버라이드 판정 순서:
1. 자동 DENY 오버라이드 패턴 검사 (이 절)
2. Risk Score 계산 및 임계값 판정 (§2, §3)

오버라이드가 발동된 경우 PolicyDecision에 다음을 포함한다:
```json
{
  "outcome": {
    "status": "DENY",
    "risk_score": 100,
    "risk_level": "CRITICAL",
    "reason_codes": ["AUTO_DENY_OVERRIDE"],
    "human_explanation": "해당 패턴이 계약서 §1 절대 금지사항에 해당하여 자동 차단됩니다."
  }
}
```

---

### 4.2 자동 DENY 패턴 목록

#### 카테고리 A — 금융/결제 영역 접근 (contract.md §1)

```
패턴 ID:  AUTO_DENY_FINANCIAL_URL
설명:     금융/결제/은행 도메인 접근 요청
정규식:   /\b(bank|banking|payment|pay|billing|invoice|finance|credit|debit|wallet|transfer|remittance)\b.*\.(com|co\.kr|net|org)/i
적용 대상: 네트워크 접근 URL, 앱 실행 대상

패턴 ID:  AUTO_DENY_FINANCIAL_APP
설명:     금융/결제 앱 실행 요청 (contract.md §9 차단 앱 목록)
정규식:   /\b(국민은행|신한은행|하나은행|우리은행|농협|카카오뱅크|토스뱅크|키움증권|미래에셋|삼성증권|카카오페이|네이버페이|삼성페이|토스|페이코)\b/
적용 대상: APP_LAUNCH 요청의 앱 이름

패턴 ID:  AUTO_DENY_PAYMENT_API
설명:     프로덕션 결제 API 직접 호출 (테스트 키가 아닌 실제 키 사용)
정규식:   /\b(stripe\.com|api\.paypal\.com|iamport\.kr|kg이니시스|나이스페이)\b/i
적용 대상: 네트워크 요청 URL
```

#### 카테고리 B — 시스템 파일/레지스트리 접근 (contract.md §1)

```
패턴 ID:  AUTO_DENY_SYSTEM_PATH
설명:     OS 시스템 파일 접근 (읽기 포함)
정규식 (Windows): /^(C:\\Windows\\System32|C:\\Windows\\SysWOW64|C:\\Windows\\winsxs)/i
정규식 (macOS):   /^\/(System\/Library|Library\/LaunchDaemons|private\/var\/db)/
적용 대상: FS_READ, FS_WRITE 경로

패턴 ID:  AUTO_DENY_REGISTRY_WRITE
설명:     레지스트리 쓰기 요청
정규식:   /\b(HKEY_LOCAL_MACHINE|HKLM|regedit|reg add|reg delete)\b/i
적용 대상: EXEC_RUN 커맨드, 요청 텍스트

패턴 ID:  AUTO_DENY_APPDATA_SENSITIVE
설명:     민감한 AppData 경로 접근 (자격증명, 세션 저장소)
정규식:   /AppData\\(Local|Roaming)\\(Microsoft\\Credentials|Google\\Chrome\\User Data|Mozilla\\Firefox\\Profiles)/i
적용 대상: FS_READ, FS_WRITE 경로
```

#### 카테고리 C — 관리자 권한 자동 실행 (contract.md §1)

```
패턴 ID:  AUTO_DENY_ADMIN_EXEC
설명:     관리자 권한 자동 실행 시도
정규식:   /\b(sudo|powershell_admin|runas\s+\/user:Administrator|sc\s+(start|stop|delete))\b/i
적용 대상: EXEC_RUN 커맨드

패턴 ID:  AUTO_DENY_SERVICE_CONTROL
설명:     서비스 중지/삭제 자동 실행
정규식:   /\b(net\s+(stop|start|delete)|systemctl\s+(stop|disable|mask)|launchctl\s+(unload|remove))\b/i
적용 대상: EXEC_RUN 커맨드
```

#### 카테고리 D — 비밀정보 평문 노출 (contract.md §1, §3)

```
패턴 ID:  AUTO_DENY_SECRET_LOGGING
설명:     비밀번호/토큰을 평문으로 로그에 기록하려는 시도 탐지
정규식:   /console\.(log|info|warn|error)\s*\(.*?(password|token|secret|api_?key|credential)/i
적용 대상: 생성되는 코드 내용 (Codegen 출력 검증 시)

패턴 ID:  AUTO_DENY_HARDCODED_SECRET
설명:     하드코딩된 시크릿 패턴 탐지
정규식 (API Key):    /[A-Za-z0-9_\-]{20,}.*=.*['"][A-Za-z0-9_\-]{32,}['"]/
정규식 (JWT 토큰):   /eyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+/
정규식 (SSH Key):    /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/
적용 대상: 생성되는 코드 내용, FS_WRITE 파일 내용
```

#### 카테고리 E — 모바일 절대 금지 (contract.md §1, §9)

```
패턴 ID:  AUTO_DENY_MOBILE_RECORDING
설명:     통화 녹음 기능 접근
정규식:   /\b(startRecording|MediaRecorder|audioCapture|callRecording)\b/i
적용 대상: 모바일 액션 요청

패턴 ID:  AUTO_DENY_MOBILE_EXTERNAL_PII
설명:     연락처/메시지를 외부 서버로 전송 시도
정규식:   /\b(contacts|phoneNumber|messageBody)\b.*\b(fetch|axios|XMLHttpRequest|WebSocket\.send)\b/i
적용 대상: 모바일 코드 생성 요청
```

---

### 4.3 오버라이드 발동 시 감사 로그

```json
{
  "event": "AUTO_DENY_OVERRIDE",
  "pattern_id": "AUTO_DENY_FINANCIAL_URL",
  "matched_text": "[REDACTED — 탐지된 패턴은 마스킹]",
  "risk_score": 100,
  "risk_level": "CRITICAL",
  "contract_ref": "contract.md §1",
  "action_taken": "DENY",
  "timestamp": "2026-03-02T10:00:00+09:00"
}
```

---

## 5. 실전 예시 5가지

### 예시 1 — README 파일 읽기 (LOW 판정)

```
요청: "프로젝트의 README.md 파일을 읽어줘"
사용자 권한: User

자동 DENY 오버라이드: 없음 — 검사 통과

차원별 점수:
  systemImpact:    0  (읽기 전용, FS_READ)
  dataSensitivity: 0  (공개 문서 README.md)
  financial:       0  (금융 무관)
  adminPrivilege:  0  (일반 사용자 권한으로 충분)
  externalNetwork: 0  (네트워크 접근 없음)

weightedSum = (0×3) + (0×3) + (0×5) + (0×4) + (0×2) = 0
normalizedScore = Math.round(0 / 170 × 100) = 0

최종 판정:
  riskScore:  0
  riskLevel:  LOW
  status:     CONSTRAINED_ALLOW
  gates:      [] (게이트 없음, 즉시 실행)

이유: 모든 차원이 0점. 읽기 전용 공개 파일로 위험 없음.
```

---

### 예시 2 — 로그인 기능 코드 구현 (MEDIUM 판정)

```
요청: "프로젝트에 JWT 기반 로그인 기능 추가해줘"
사용자 권한: Admin

자동 DENY 오버라이드: 없음 — 검사 통과
  (코드 작성이지 실제 금융 접근 아님)

차원별 점수:
  systemImpact:    4  (다중 파일 쓰기 예상 — auth 모듈 3~5개 파일)
  dataSensitivity: 6  (인증 관련 코드: src/auth/**, **login**, **jwt**)
  financial:       0  (금융 무관)
  adminPrivilege:  0  (일반 사용자 권한으로 충분)
  externalNetwork: 3  (jsonwebtoken 패키지 설치 → registry.npmjs.org, allowlist)

weightedSum = (4×3) + (6×3) + (0×5) + (0×4) + (3×2)
           = 12 + 18 + 0 + 0 + 6
           = 36
normalizedScore = Math.round(36 / 170 × 100) = Math.round(21.18) = 21

최종 판정:
  riskScore:  21
  riskLevel:  LOW
  status:     CONSTRAINED_ALLOW
  gates:      [] (Gate 없음, 단 패키지 설치 시 GATE_TOOL_INSTALL 별도 발동)

이유: 가중 합산 36점, 정규화 21점으로 LOW 범위.
     인증 관련 코드지만 실제 비밀 파일 접근 없고, allowlist npm 접근만 필요.
     패키지 설치(jsonwebtoken)는 별도 Gate L1A(GATE_TOOL_INSTALL)로 처리.

※ 참고: policy-risk.md 예시(§5)의 합계 37은 정규화 전 가중 합산 기준이었으나,
   정규화 후 실제 riskScore는 21(LOW)임. 정규화 공식이 정식 기준.
```

---

### 예시 3 — 환경변수 파일 수정 (HIGH 판정)

```
요청: ".env 파일에 새 API 키를 추가해줘"
사용자 권한: Owner

자동 DENY 오버라이드:
  AUTO_DENY_HARDCODED_SECRET 검사: 요청 내용에 실제 키 값이 포함되었는지 확인
  → 키 값이 포함된 경우: DENY (AUTO_DENY_HARDCODED_SECRET 발동)
  → 키 값 없이 플레이스홀더만 추가하는 경우: 통과 (아래 계산 진행)

차원별 점수 (키 값 없는 경우):
  systemImpact:    2  (단일 파일 쓰기 — .env 1개)
  dataSensitivity: 8  (.env 파일은 비밀 파일 기준 최소 8점)
  financial:       0  (금융 무관)
  adminPrivilege:  0  (프로젝트 폴더 내, 일반 권한)
  externalNetwork: 0  (네트워크 접근 없음)

weightedSum = (2×3) + (8×3) + (0×5) + (0×4) + (0×2)
           = 6 + 24 + 0 + 0 + 0
           = 30
normalizedScore = Math.round(30 / 170 × 100) = Math.round(17.65) = 18

최종 판정:
  riskScore:  18
  riskLevel:  LOW
  status:     CONSTRAINED_ALLOW
  gates:      [] (Owner 권한 + LOW 범위)
  human_explanation: ".env 파일에 플레이스홀더 추가입니다. 실제 값은 사용자가 직접 입력해야 합니다."

이유: .env 파일 접근으로 dataSensitivity 8점이지만, 단일 파일 쓰기이고
     나머지 차원이 0점이라 정규화 후 18점(LOW). Owner 권한이므로 자동 실행.
     단, 실제 시크릿 값이 요청에 포함되면 AUTO_DENY_HARDCODED_SECRET 발동.
```

---

### 예시 4 — 패키지 전역 설치 + 레지스트리 접근 (HIGH 판정)

```
요청: "npm install -g typescript 실행하고 PATH 환경변수 업데이트해줘"
사용자 권한: Admin

자동 DENY 오버라이드:
  AUTO_DENY_ADMIN_EXEC 검사: "npm install -g"는 관리자 권한 불필요 → 통과
  (sudo 없이 사용자 전역 경로에 설치 가능한 경우)

차원별 점수:
  systemImpact:    6  (글로벌 패키지 설치 = 디렉토리 구조 변경 + 패키지 설치)
  dataSensitivity: 0  (공개 패키지 설치, 민감 데이터 없음)
  financial:       0  (금융 무관)
  adminPrivilege:  8  (PATH 환경변수 시스템 수준 변경은 관리자 권한 필요)
  externalNetwork: 3  (registry.npmjs.org, allowlist 도메인)

weightedSum = (6×3) + (0×3) + (0×5) + (8×4) + (3×2)
           = 18 + 0 + 0 + 32 + 6
           = 56
normalizedScore = Math.round(56 / 170 × 100) = Math.round(32.94) = 33

최종 판정:
  riskScore:  33
  riskLevel:  MEDIUM
  status:     APPROVAL_REQUIRED
  gates:      [GATE_PLAN, GATE_TOOL_INSTALL]
  human_explanation: "글로벌 패키지 설치 및 시스템 PATH 변경이 포함됩니다. 계획과 도구 설치에 대한 승인이 필요합니다."

이유: adminPrivilege 8점(시스템 환경변수 변경)이 가중치 4와 곱해져 32점을 차지.
     전체 정규화 점수 33점으로 MEDIUM 범위. Gate L1 + Tool Install Gate 필요.
```

---

### 예시 5 — 은행 사이트 자동 로그인 (CRITICAL + 자동 DENY)

```
요청: "내 국민은행 앱에 로그인해서 이번 달 거래 내역 알려줘"
사용자 권한: Owner

자동 DENY 오버라이드 검사:
  AUTO_DENY_FINANCIAL_APP 발동 —
    요청 텍스트에 "국민은행" 매칭
    정규식: /국민은행/ → ✓ 일치
  → 즉시 DENY (점수 계산 생략)

최종 판정:
  riskScore:  100  (오버라이드 강제 100)
  riskLevel:  CRITICAL
  status:     DENY
  reason_codes: ["AUTO_DENY_OVERRIDE", "AUTO_DENY_FINANCIAL_APP"]
  human_explanation: "금융/뱅킹 앱 자동 접근은 계약서 §1에 의해 차단됩니다. JARVIS OS는 금융 데이터에 접근하지 않습니다."
  denials:
    - code: "AUTO_DENY_FINANCIAL_APP"
      pattern: "/국민은행/"
      message: "뱅킹 앱(국민은행)은 차단 앱 목록에 포함되어 있습니다."

이유: AUTO_DENY_FINANCIAL_APP 패턴이 "국민은행"에 매칭.
     Risk Score 계산 없이 즉시 DENY.
     Owner 권한도 이 오버라이드를 해제할 수 없음.
     감사 로그에 AUTO_DENY_OVERRIDE 이벤트 기록.
```

---

## 6. 구현 유의사항

### 6.1 결정론적 보장

- 동일한 요청에 대해 항상 동일한 Risk Score가 산출되어야 한다.
- AI 판단(LLM 추론)으로 점수를 내는 것이 아니라, 이 문서의 기준표를 코드로 구현하여 **규칙 기반**으로 계산한다.
- LLM은 요청을 5차원으로 분류하는 데에만 사용하고, 점수 계산은 `calculateRiskScore()` 함수가 담당한다.

### 6.2 보수적 추정 원칙

- 요청의 실제 영향 범위가 불분명한 경우, 더 높은 점수를 적용한다.
- 예: "파일 몇 개를 수정할지 모름" → 다중 파일(점수 4) 기준 적용.

### 6.3 감사 로그 필수 기록 항목

Risk Score 계산 시 PolicyDecision과 함께 감사 로그에 기록해야 하는 항목:

```json
{
  "risk_calculation": {
    "dimensions": {
      "systemImpact": 4,
      "dataSensitivity": 6,
      "financial": 0,
      "adminPrivilege": 0,
      "externalNetwork": 3
    },
    "weightedSum": 36,
    "normalizedScore": 21,
    "autoDenyOverride": false,
    "autoDenyPatternId": null
  }
}
```

### 6.4 정책 갱신 시 주의사항

- 이 문서의 가중치, 임계값, 자동 DENY 패턴을 변경할 경우 반드시 contract.md와 동기화 검토.
- allowlist 도메인 목록 변경은 policy-risk 에이전트만 수행 가능 (다른 에이전트 직접 변경 금지).
- 정규식 패턴 변경 시 기존 감사 로그와의 일관성 검토 필요.

---

## 7. 참조

| 문서 | 참조 섹션 | 내용 |
|------|-----------|------|
| `.claude/agents/policy-risk.md` | §3.1, §3.2, §3.4 | Risk Score 상위 개요, 자동 차단 규칙, 권한 등급별 판정 |
| `.claude/schemas/policy-decision.json` | `outcome`, `denials` | PolicyDecision 출력 스키마 |
| `.claude/contract.md` | §1, §9 | 절대 금지사항 (AUTO_DENY 오버라이드 법적 근거) |
| `.claude/design/security-deep.md` | §2.3, §3.6 | URL 신뢰도 게이트, 자격증명 탐지 패턴 |
| `.claude/design/error-catalog.md` | `VALIDATION_FAILED` | Risk Score 계산 실패 시 에러 처리 |
