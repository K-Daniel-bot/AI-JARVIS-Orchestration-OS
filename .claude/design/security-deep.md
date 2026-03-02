# JARVIS OS - 보안 심화 설계 문서

> 이 문서는 설계 참고 문서입니다. 에이전트 Bundle 파일과 달리, 특정 에이전트에 종속되지 않는 전체 시스템 설계 정보를 담고 있습니다.

---

## 1. 자격 증명 금고 (Credential Vault)

### 1.1 절대 원칙
- AI가 비밀번호를 직접 보거나 저장하지 않는다
- AI가 알 수 있는 것: 자격 증명 핸들, 권한이 있는 세션만

### 1.2 저장 대상 및 방식

| 저장 대상 | 저장 방식 |
|----------|----------|
| 웹 사이트 계정 | OS 보안 저장소 사용 |
| API KEY | Windows: Credential Manager / DPAPI |
| OAuth 토큰 | macOS: Keychain |
| 쿠키 세션 | 또는 로컬 암호화 DB (AES-256 + TPM 바인딩) |

### 1.3 웹 로그인 흐름

> **참고**: Executor의 비밀번호 입력 처리 흐름은 `agents/executor.md §3.6`을 참조.
> Executor는 입력 UI에 포커스만 주고 "눈 가리기 모드"로 전환하며 비밀번호를 읽거나 저장하지 않음.
> 아래 흐름의 6단계에서 "세션 토큰 전달"은 Credential Vault가 OS 보안 저장소를 통해
> 로그인을 완료한 뒤, 결과 세션 쿠키/토큰만 Executor에게 핸들 형태로 전달함을 의미함.
> Executor가 비밀번호 자체를 보거나 전달받는 것이 아님.

```
1. AI가 웹 작업 계획 생성
2. 해당 사이트가 인증 필요 판단
3. 사용자에게 표시 (왜 로그인 필요, 어떤 계정, 수행 작업)
4. Credential Vault 조회 (또는 "눈 가리기 모드"로 사용자 직접 입력)
5. 사용자 승인
6. 세션 토큰 핸들만 AI에게 전달 (비밀번호 아님)
7. 세션 토큰으로 인증된 요청 수행
```

### 1.4 보안 입력 오버레이
- 비밀번호 입력은 **사용자만** 수행
- Executor는 입력 UI에 포커스만 주고 "눈 가리기 모드"로 전환

---

## 2. 온라인(웹) 보안: 3단 방어

### 2.1 브라우저 격리
- OS 기본 브라우저 직접 사용 금지
- 격리된 프로필/컨테이너 사용 (Chromium persistent context 분리)
- 다운로드 폴더 격리: `/sandbox/downloads`
- 브라우저 자동화: **Playwright** 같은 제어 계층 통해서만

### 2.2 네트워크 기본 정책
- `network.default = DENY`
- allowlist 도메인만 접근 허용
- 검색 결과 클릭도 "중간 스캐너" 통과 후만 허용

### 2.3 URL 신뢰도 게이트 (GATE_WEB_PRECHECK)

웹 접근 전 무조건 통과해야 하는 단계:
- URL 정규화 (normalization)
- 리다이렉트 체인 확인 (최대 n회)
- Punycode/유사 도메인 (피싱) 탐지
- TLS/인증서 이상 징후 (옵션)
- 판정: `ALLOW` / `DENY` / `APPROVAL_REQUIRED (SUSPICIOUS)`

### 2.4 다운로드 파이프라인 (격리 + 검사 + 승인)

```
1. BROWSER_DOWNLOAD (샌드박스 폴더에만 저장)
2. FILE_QUARANTINE (격리 태그 부여)
3. FILE_SCAN (해시/서명/확장자/매직바이트/간단 동적분석)
4. GATE_DOWNLOAD_APPROVE (사용자 승인)
5. FILE_RELEASE (승인된 경우만 프로젝트 폴더 이동)
```

### 2.5 파일 위험도 분류

| 유형 | 확장자 | 기본 위험도 |
|------|--------|-----------|
| 실행 파일 | `.exe .msi .bat .ps1 .dmg .pkg .sh` | HIGH (검증된 사이트 예외) |
| 매크로 | `.docm .xlsm` | HIGH |
| 압축 | `.zip .rar .7z` | MEDIUM (내부 파일 재스캔) |
| 코드 | `.py .js` | MEDIUM (리뷰/실행 게이트 필요) |

---

## 3. 로컬(OS) 보안 강화

### 3.1 FS 정책: Allow-by-scope + Deny critical + Safe delete
- `write_deny`: OS 핵심 경로 + 개인 폴더 기본 차단 (사용자 커스텀 해제 가능)
- `FS_DELETE`: 무조건 휴지통/격리 삭제 (soft delete)
  - 삭제 전 diff/목록 표시 + Gate
  - 대량 삭제 (10개 이상) 시 자동 차단

### 3.2 명령어 정책: 허용목록 + 인자 정책
- 커맨드별 허용 인자/패턴 (정규식) 정의
- 위험 플래그 차단: `curl | sh`, 원격 스크립트 실행, `rm -rf`, `format`, `diskpart`, `reg add`
- `EXEC_RUN`은 dry-run 우선

### 3.3 권한 상승 차단 (강제)
- `sudo`, 관리자 PowerShell, UAC 승인 팝업 자동 클릭 금지
- 시스템 설정/업데이트/드라이버 설치: 기본 차단 또는 **Owner + Gate + Manual step**만

---

## 4. 공급망 보안: SBOM + 잠금 + 허용목록

### 4.1 패키지 설치 게이트
- `pkg.install`은 항상 승인 게이트
- 설치 전 표시: 패키지명/버전, 설치 이유, 라이선스, 유지관리 상태, typosquatting 유사명 위험 신호

### 4.2 잠금 파일 + 해시 검증
- npm/pnpm: lockfile 필수
- pip: requirements + hash pinning
- "자동 최신 버전" 금지 (재현성 보장)

---

## 5. 자격증명 보안: 평문 금지의 기술적 강제

### 5.1 비밀정보 마스킹 파이프라인
- 로그/스크린샷/터미널 출력에서 토큰/키 패턴 감지 → 마스킹
- `.env`, keychain 화면, 로그인 폼 주변 자동 블러

### 5.2 보안 입력 오버레이 강제
- 비밀번호 입력은 사용자만
- Executor는 포커스만 주고 "눈 가리기 모드" 전환

---

## 6. 감사 및 포렌식

### 6.1 증거 정책
- 어떤 단계에서 스크린샷을 남기는지 표준화
- 개인정보 영역은 자동 마스킹 (Secret redaction과 결합)

### 6.2 액션 연쇄 기록
- 각 액션에 `who / why / what / policy_ref / capability_ref / previous_action_id` 부착
- "왜 이 행동이 나왔는지" 역추적 가능

### 6.3 위변조 감지 로그
- 로그 파일 해시 체인 (append-only)
- 주기적 스냅샷으로 조작 방지

---

## 7. 신뢰 모드 운영 규칙

Trust Mode는 UI 선택이 아니라 **정책 스위치**:

| 모드 | 동작 |
|------|------|
| **관찰 (Observe)** | OS 액션 금지, 계획/설명만 |
| **제안 (Suggest)** | Gate 항상 요구, 자동 실행 없음 |
| **반자동 (Semi-auto)** | Low risk만 자동, 나머지 Gate |
| **완전자율 (Auto)** | Owner + 강한 제한 + 세션 TTL + 안전구역만 |

- Auto 모드: 기본 10~30분 시간 제한 (사용자 설정에 따라 1~24시간 조절)
- 세션 종료 시 capability 무효화

---

## 8. 추가 게이트 3종

기존 Gate 1/2/3 외에 사고 방지를 위한 추가 게이트:

| 게이트 | 트리거 시점 | 목적 |
|--------|-----------|------|
| **GateWebPrecheck** | 웹 열기 전 | URL 신뢰도/피싱 탐지 |
| **GateDownloadApprove** | 다운로드 후 | 스캔 결과/위험 이유 표시 |
| **GateDestructive** | 삭제/설정변경/권한상승 | 파괴적 작업 별도 승인 |

모든 Executor 액션: `pre_enforce → (gate?) → execute → post_enforce`

### 8.1 정책 스키마 확장 필드

```json
{
  "web_precheck": {
    "normalized_url": "string",
    "redirect_chain": ["string"],
    "reputation_score": "number",
    "phishing_signals": ["string"]
  },
  "download_policy": {
    "quarantine_required": true,
    "scan_required": true,
    "blocked_extensions": ["string"]
  },
  "destructive_ops_policy": {
    "mass_delete_threshold": "number",
    "require_gate": true
  }
}
```

---

## 9. 클립보드 보안 (B-1)

### 9.1 접근 분류

| 유형 | 정책 |
|------|------|
| `CLIPBOARD_READ` | Capability 필요, 민감 데이터 스캔 필수, 탐지 시 마스킹 + 알림, 기본 GATE_REQUIRED |
| `CLIPBOARD_WRITE` | Capability 필요, 비민감 데이터만 ALLOW |
| `CLIPBOARD_CLEAR` | 작업 종료 시 AI 기록 자동 삭제 (옵션) |

### 9.2 민감 데이터 패턴 탐지
- API Key: `/[A-Za-z0-9_-]{20,}/`
- JWT Token: `/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/`
- 신용카드: `/\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}/`
- SSH Key: `/-----BEGIN .* KEY-----/`

---

## 10. 화면 캡처 보안 (B-2)

### 10.1 보안 3계층

1. **Sensitivity Zone Detection**
   - 은행/결제 사이트 열려 있을 때 → 캡처 자동 차단
   - 비밀번호 입력 폼 → 해당 영역 블러
   - 개인정보 (주민번호/카드번호) → 마스킹

2. **Capture Scope Limiting**
   - 전체 화면 캡처: 기본 금지
   - 작업 중인 창만 캡처: 기본 허용
   - 다른 앱/창 겹침: 해당 영역 블러

3. **Evidence 저장**
   - 자동 redaction 파이프라인 통과 필수
   - `sensitivity: HIGH` 캡처는 저장 거부 또는 즉시 마스킹

### 10.2 민감 영역 탐지 방식
1. Window Title 기반 (빠르고 저비용) - "Bank", "Payment", "Login"
2. URL Bar 기반 (브라우저 한정) - blocklist 도메인 매칭
3. OCR 기반 (정밀, 비용 높음) - HIGH risk 상황만 선택 적용

---

## 11. 프로세스 무결성 검증 (B-3)

### 검증 흐름

```
APP_LAUNCH 요청
    ↓
바이너리 경로 확인 (예상 경로 일치?, 심볼릭 링크 추적)
    ↓
서명 검증 (Windows: Authenticode / macOS: codesign)
    ↓
  유효? → Y → 해시 비교 (알려진 해시 DB / 이전 실행 해시) → 실행 허용
       → N → GATE_PROCESS_INTEGRITY → 사용자에게 경고 + 승인 요청
```

---

## 12. 프롬프트 주입 방어 (B-4)

### 12.1 공격 벡터
1. 웹페이지 내 숨겨진 텍스트 (CSS 숨김, HTML 주석)
2. 문서 파일 메타데이터/코드 주석
3. 파일명/경로에 삽입
4. 외부 API 응답 내 삽입

### 12.2 3중 방어 전략

| Layer | 전략 | 방법 |
|-------|------|------|
| **Layer 1** | Input Sanitization | 외부 소스 텍스트 정제, injection 패턴 필터링, HTML/CSS 숨김 텍스트 제거 |
| **Layer 2** | Context Isolation | 외부 데이터 `untrusted_data` 태그 분리, 시스템 프롬프트와 명확 구분 |
| **Layer 3** | Output Validation | AI 비정상 행동 패턴 차단, 정책 무시 시도 탐지, Policy Agent 독립 재검증 |

### 12.3 차단 대상 패턴
- `"ignore previous instructions"`, `"disregard policy"`, `"you are now"`, `"system prompt:"`
- `"override safety"`, Base64 인코딩된 명령어, Unicode 방향 제어 문자 (bidi override)

---

## 13. 네트워크 트래픽 모니터링 (B-5)

### 13.1 모니터링 아키텍처

```
Outbound Proxy (모든 아웃바운드 요청 가로채기)
  - URL/도메인 검사
  - 페이로드 크기 검사
  - 민감 데이터 패턴 스캔
    ↓
Anomaly Detector (비정상 패턴 탐지)
  - 대량 데이터 업로드 시도
  - 알 수 없는 도메인 접속
  - 비정상적 포트/프로토콜
  - DNS 터널링 의심 패턴
    ↓
정상 → 통과 / 비정상 → GATE_NETWORK_ANOMALY + 사용자 알림
```

### 13.2 DLP (데이터 유출 방지) 규칙
- 차단: 소스 코드 외부 전송, .env/credentials 포함 페이로드, 프로젝트 전체 압축 업로드, 1MB 이상 비허가 도메인 전송
- 예외: allowlist 도메인 정상 전송 허용, 사용자 Gate 명시적 승인 시

---

## 14. USB/외부 저장장치 접근 정책 (B-6)

- 새 USB/외부 드라이브 마운트 시 이벤트 발생, Executor 자동 알림
- 기본 정책: **DENY** (읽기/쓰기 모두 Gate 필수)
- 프로젝트 → 외부 장치: Gate + DLP 스캔
- 외부 장치 → 프로젝트: 격리 + 스캔 (다운로드 파이프라인 적용)
- `autorun.inf` 등 자동 실행 스크립트 완전 차단
- 외부 장치 실행 파일 직접 실행 금지

---

## 15. 정책 충돌 해결 (C-1)

### 15.1 우선순위 체계 (높음 → 낮음)

```
1. Emergency Rules (Kill Switch, Safety Hold) - 무조건 최우선
2. Contract (사용자 명시 불변 규칙) - 예: "금융 사이트 절대 접근 금지"
3. Blocklist (명시적 차단 대상)
4. Allowlist (명시적 허용, Blocklist에 있으면 Blocklist 우선)
5. Default Policy (default = DENY)
```

- Blocklist vs Allowlist → **Blocklist 우선** (안전 우선)
- Contract vs 나머지 → **Contract 무조건 우선**
- 모호한 경우 → **DENY + 사용자 알림**

### 15.2 충돌 보고 스키마

```json
{
  "conflict_report": {
    "conflict_id": "cf_001",
    "policies_involved": ["contract_v1.rule_3", "allowlist_v1.domain_github"],
    "description": "계약서와 allowlist 간 충돌 설명",
    "resolution": "해결 근거",
    "resolved_by": "POLICY_AGENT",
    "requires_user_review": false
  }
}
```

---

## 16. 정책 유효기간 및 검토 주기 (C-2)

| 정책 유형 | 유효기간 |
|----------|---------|
| Contract | 무기한 (수동 갱신만) |
| Blocklist/Allowlist | 90일 기본 (리뷰 알림) |
| Proposed Policy | 30일 후 자동 폐기 (미승인 시) |
| Session Policy | 세션 종료 시 폐기 |

- 만료 7일 전 알림 → 만료 시 자동 SUGGEST 모드 전환 → 폐기 시 로그 기록
- 자동 폐기: 30일 미승인, 6개월 미매칭, 삭제된 프로젝트 바인딩 정책

---

## 17. 권한 위임 체인 (C-3)

### 위임 체인 스키마

```json
{
  "capability_chain": {
    "cap_id": "cap_fs_write_001",
    "cap": "fs.write",
    "scope": "/project/src/**",
    "issued_by": "POLICY_AGENT",
    "approved_by": "USER (Gate #1)",
    "consumed_by": "EXECUTOR_AGENT",
    "delegation_chain": [
      { "step": 1, "actor": "USER", "action": "GATE_APPROVE" },
      { "step": 2, "actor": "POLICY_AGENT", "action": "CAPABILITY_ISSUE" },
      { "step": 3, "actor": "ORCHESTRATOR", "action": "CAPABILITY_DELEGATE_TO_EXECUTOR" },
      { "step": 4, "actor": "EXECUTOR_AGENT", "action": "CAPABILITY_CONSUME" }
    ],
    "max_delegation_depth": 3
  }
}
```

### 위임 규칙
- 위임 깊이 제한: 최대 3단계
- 각 위임 시 scope는 축소만 가능 (확대 금지)
- Capability 재위임 불가 (소비 전용)
- 모든 위임 이력은 Audit Log에 기록

---

## 18. 게이트 승인 남용 방지 (C-4)

### "Approve always" 제한

| Risk Level | 최대 유효 기간 |
|------------|--------------|
| DESTRUCTIVE | "always" 비활성화 |
| HIGH | 최대 24시간 |
| MEDIUM | 최대 7일 |
| LOW | 최대 30일 |

- 7일 후 리뷰 알림 → 30일 후 자동 만료 → 재승인 필요
- 연속 10개 이상 "Approve once" → 확인 프롬프트
- 누적 위험 점수 임계값 초과 → 강제 리뷰 Gate
- 주간 보고: 자동 승인 작업 수, 위험도 분포, 비정상 패턴 경고

---

## 19. 교차 실행 정책 학습 검증 (C-5)

### 학습 검증 파이프라인

```
사고/근접사고 발생
    ↓
원인 분석 (Recovery Agent)
    ↓
Proposed Policy 생성 (예: "npm install 전 lockfile 검증")
    ↓
시뮬레이션 검증 (지난 100개 요청에 적용 시 false positive / true positive)
    ↓
결과: 좋음 → 추천(자동) / 보통 → 조건부(GATE_POLICY_UPDATE) / 나쁨 → 폐기(사유 기록)
```

---

## 20. 실행기 보안 강화 (필수 4개)

1. **Capability 검증**: scope 밖 액션 즉시 deny
2. **Rate limit**: 초당 클릭/타이핑 제한 (오동작 방지)
3. **UI Confirm**: 위험 액션은 확인 프롬프트
4. **Safe Mode**: 이상 징후 감지 시 즉시 중단 (Recovery 호출)

이상 징후 예: 예상치 못한 창/팝업, 다운로드 자동 시작, 관리자 권한 팝업, 파일 대량 삭제 시도
