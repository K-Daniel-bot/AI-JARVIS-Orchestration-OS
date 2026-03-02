# AI JARVIS Orchestration Agent OS

이 프로젝트는 아이언맨에 나오는 AI JARVIS Orchestration Agent OS 입니다.

컴퓨터(WindowOS, MacOS)등을 직접 접속하여 내부를 조작할 수 입니다.

!!! 이 프로젝트는 에이전트팀이 구성되어있습니다.

컴퓨터 내부를 접속하여 조작을 한다는 것은 매우 위험한 일입니다..

만약, 사용자의 컴퓨터에 중요한 파일, OS 기반의 중요 Data, 업데이트, 결제 등 보안에 접근을 하면

위험해집니다. 온라인 및 오프라인 접근에 대한 방향성 중에 온라인이 가장 위험 할수가 있습니다.

특히, 온라인으로 웹 접근시 AI가 악성코드가 있는 웹 사이트 접근을 한다거나 또는 악성코드가 있는 파일을 다운 받을수도 있습니다. 이 프로젝트는 악성코드가 있는 웹 사이트를 완전 제한 접근 금지로 하며 악성코드가 있는 파일을 다운 받기 전에

이 코드는 위험성이 높다는 것을 늘 사용자에게 알립니다.

AI JARVIS Orchestration Agent OS는 사용자(인간)과 자유도가 높은 대화가 가능합니다. 사용자가 정해놓은 코드안에서 제한된 대화가 아니라 Orchestration Agent OS의 추론의 자유도 안에서 사용자와 대화를 할 수 있도록 합니다.

예시) 사용자가 입력 프롬프트 또는 보이스로 오늘의 날씨가 어때? 라고 입력 했을 경우 Orchestration Agent OS는 자유도 높은 추론 결과물을 생성 하도록 합니다.

또 다른 예시는

[계약서]

- AI JARVIS Orchestration Agent OS에게 계약서를 필수 조건을 할당하도록 합니다.
- 계약서 위반 하지 않도록 AI JARVIS는 철저하게 지키도록 합니다.
- 계약서 내용에는 컴퓨터 내부 조작시 보안에 가장 중요성이 높은 분야에서는 절대 접근을 하지 않는다는 계약
- 개발자가 직접 OS 로컬 링크를 통해 금지사항이라는 조건을 걸어 AI JARVIS가 절대 접근을 하지 못하도록 설정 할 수도 있습니다.

개념 프레임: 계약서 = “정책 레이어 3단”

1. Policy Source : 계약서/금지목록(로컬 링크 포함)
2. Decision : 요청이 허용/거부/승인 필요인지 판정
3. Enforcement : OS 조작 직전에 강제 차단
   흐름도는 "요청 > 정책 로드 > 판정 > 강제 > 실행/거부

---

## AI JARVIS Orchestration Agent OS는 사용자의 입력 프롬프트 or Voice를 깊이 분석하여 무엇을 요구를 하고 있는지 정확하게 오차율이 거의 없이 해석을 해서 사용자의 요구사항을 실행하도록 합니다.

- 사용자의 입력 프롬프트 및 보이스를 깊이 분석하여 무엇을 요구하고 있는지 에이전트는 심화 과정 분석
- 무엇을 요구하고 있는지 분석 완료가 되면 AI JARVIS OS는 Window or MacOS안에서 Action
- 요구사항의 실행 범위는 제한이 없습니다.
  예시) 사용자의 입력 프롬프트 : 블랜더에 접속해서 아이언맨 3D 모델링을 만들어라.
  AI JARVIS OS는 블랜더를 직접 조작해서 아이언맨 3D 모델링을 직접 만들거나 또는 AI JARVIS OS가 오픈소스를 검색을 해서 오픈소스를 활용하여 아이언맨 3D 모델링을 구현하는 기술
  주의사항 : 오픈소스 검색해서 AI JARVIS OS가 사용하려고 하는 오픈소스는 반드시 사용자에게 승인 요청
- Capability Token 시스템을 일회성 권한으로 합니다. AI가 OS를 직접 조작하는 구조에서는 영구 권한을 주면 100% 사고나기 때문에 실행전에 요청 > 정책 판단 > Capability 발급 > Action 실행
- Capability 예:

  ```
  file.read:/workspace/project/*
  app.launch:blender
  network.access:github.com
  ```

  범위 제한
- 시간 제한
- 1회성

---

## Agent Identity & Authority 레이어 (행위 주체 명확화)

에이전트는 행위 주체에 대해 명확히 하도록 합니다.

### 필요 요소

* 사용자 인증 방식
  * 로컬 로그인 사용자
  * 음성 생체 인증
  * 세션 기반 인증
* 권한 등급 (RBAC / ABAC)

```
Owner
Admin
User
Guest
AI-Autonomous
```

👉 동일한 요청이라도 권한에 따라 결과가 달라져야 합니다.

예:

```
파일 삭제 요청

Owner → 허용
User → 승인 필요
Guest → 거부
```

---

## Agent Risk Engine (위험도 평가 시스템)

에이전트는 모든 요청을 단순 allow/deny로 처리하지 말고 중간 레이어를 Risk Score 계산 기준으로 합니다.

1. 시스템 영향도
2. 데이터 민감도
3. 금전/결제 관련 여부
4. 관리자 권한 필요 여부
5. 외부 네트워크 접근 여부

예:

```
Low Risk → 자동 실행
Medium → 사용자 승인
High → 계약서 위반으로 차단
```

---

## Agent Explainable Execution (실행 전 AI 행동 설명)

에이전트는 실행 전에:

```
요청 분석 결과:

목표:
Blender 실행 후 3D 모델 생성

필요 작업:
1. Blender 실행
2. Python 스크립트 생성
3. 모델링 수행

외부 리소스:
없음

위험도:
Low

실행 승인 요청
```

*** 이 레이어가 없으면 사용자는 절대 신뢰하지 않습니다.(중요)

---

## Agent Sandboxed OS Control Layer (직접 OS 접근 금지)

AI가 바로 OS를 조작하면 안되고 에이전트는 파일 접근 API, 앱 실행 API, UI 자동화 API 등 추상화

Policy Enforcement 삽입합니다.

---

## Immutable Audit Log (절대 삭제 불가 로그)

AI JARVIS Orchestration Agent OS는 법적/보안 핵심 요소를 기록을 하도록 합니다.

에이전트는 누가 요청했는지, 무엇을 요청했는지, AI의 해석 결과, 정책 판정 결과, 실제 실행된 액션, 사용된 Capability 등 법적/보안 핵심 요소들을 전부 기록을 해야 합니다.

그래야만 사용자가 로그를 통해 접근 방식을 정확히 알 수 있기 때문입니다.

---

## Agent Self-Learning Guardrail Memory

에이전트는 반드시 사용자가 접근 금지 또는 하지 말아야 할 행동에 대해 지침을 하면 AI는 "이건 하면 안되는 행동이구나" 에이전트는 자가 학습을 하도록 합니다. 반드시 왜 하지 말아야 하는지에 대해 원인 분석을 해야 하고 새로운 정책을 만들어 내도록 해야 합니다. 계약서를 업데이트를 하며 다음 실행부터는 반드시 자동 차단을 해야합니다.

이것을 실수를 하게 되면 Window/MacOS는 심각한 데미지를 받기 때문에 반드시 철저히 에이전트는 자가 학습을 실행해야 합니다.

---

## Agent Self-Learning to Repair Code Errors And Other Issues

에이전트는 시스템 코드 오류, 문제, 에러가 발생시 자가 분석을 하여 어떤 문제가 발생을 했는지에 대해 사용자에게

시스템 에러 분석 결과 레이어를 사용자에게 상세하게 보고를 합니다. 사용자가 승인을 하면 에이전트는 시스템을 자가 수리를 진행합니다.

점점 에이전트가 시스템 코드 오류, 문제, 에러 등 분석 결과가 정확하고 수리 정확성이 높다면 사용자는 에이전트가 굳이 사용자에게 시스템 에러 분석 결과 레이어를 제시하지 않아도 자가 분석 및 수리를 맡길 것입니다.

---

## Tool Installation Governance(툴 설치 통제 시스템)

툴 설치는 반드시

필요이유, 권한 요구 목록, 설치 후 접근 가능 범위, 보안 점수, 라이선스를 사용자에게 보여주도록 해야합니다.

---

## Action Simulation Mode (실행 전 시뮬레이션)

실제 실행 하기 전에 시스템에 큰 영향을 받을 가능성도 있고 또 어떤 일이 발생하게 될지 아무도 예상 할 수 없기 때문에

실제적인 실행 전에는 반드시 가상 환경에서 실행 시뮬레이션을 거쳐야 하며 이것을 실행 했을때 영향 분석에 대한 설명과 사용자에게 미리 보여주도록 해야합니다.

---

## Memory Scope Isolation

AI 메모리가 OS 전체를 알면 위험합니다.

그래서 메모리를 분리:

* 사용자 개인 메모리
* 시스템 정책 메모리
* 작업용 임시 메모리

---

## Trust Mode

관찰 모드
제안 모드
반자동 모드
완전자율 모드

---

## Personal Behavior Model

에이전트는 사용자 성향 학습:

* 자주 허용하는 작업
* 항상 거부하는 작업

→ 승인 UX 최소화

---

## Precautions when accessing the web

에이전트가 웹 접속시 가장 많이 사고가 나는 영역입니다. 단순, 아이디/비밀번호 입력 수준이 아니라

자격 증명 거버넌스 레이어로 설계를 해야합니다.

웹 접속시 인증 보안 정책이 있어야 하므로

절대 원칙을 세웁니다. 비밀번호를 직접 보거나 저장하지 않습니다.

AI가 알 수 있는 것은 자격 증명 핸들, 권한이 있는 세션입니다.

## Credential Vault (자격 증명 금고 – 필수)

저장 대상은 웹 사이트 계정, API KEY, OAuth 토큰, 쿠키 세션이며 저장 방식은 OS 보안 저장소 사용

* * Windows → Credential Manager / DPAPI
  * macOS → Keychain

또는

* 로컬 암호화 DB (AES-256 + TPM 바인딩)

웹 로그인이 필요할 때의 흐름

```
1️⃣ AI가 웹 작업 계획 생성

2️⃣ 해당 사이트가 인증 필요 판단

3️⃣ 사용자에게 표시
   - 왜 로그인 필요한지
   - 어떤 계정인지
   - 수행 작업

4️⃣ Credential Vault 조회

5️⃣ 사용자 승인

6️⃣ 세션 토큰만 AI에게 전달

7️⃣ 자동 로그인 수행
```

### 사용자 승인 UI 예시

```
example.com 로그인이 필요합니다.

목적:
→ 파일 업로드

사용 계정:
→ daniel@example.com

접근 범위:
→ 읽기 / 업로드

비밀번호:
→ AI는 접근하지 않음

[ 1회 허용 ]
[ 항상 허용 ]
[ 거부 ]
```

## Credential Scope 제한 (권한 최소화)

각 계정은 범위를 가져야 합니다:

```
github.com

허용:
- repo read
- issue write

차단:
- billing
- account settings
```

## 고위험 사이트 접근 정책

자동 차단 대상:

* 은행
* 결제
* OS 계정 관리
* 인증서 관리
* 클라우드 IAM

→ 무조건 사용자 직접 입력

AI 자동화 금지

## 비밀번호 입력 방식 (보안 UX)

AI가 입력하면 안 됩니다.

허용 방식:

### 방식 A — Secure Input Overlay

사용자가 직접 입력

AI는 화면을 보지 못함

### 방식 B — OAuth / Passkey

최우선 권장 방식:

```
Sign in with Google
Sign in with GitHub
Passkey
```

## 세션 기반 자동화 (권장 구조)

비밀번호 대신:

```
이미 로그인된 브라우저 세션 사용
```

AI는:

쿠키를 직접 읽지 않고

→ 브라우저 자동화 API를 통해 세션 사용

## 로그 저장 정책

로그에는 절대 저장 금지:

* 비밀번호
* 토큰 원문
* 쿠키 원문

대신:

```
credential_id: github_daniel
scope: repo_read
```

## 학습 금지 영역

AI 메모리에 저장 금지:

* ID
* 이메일
* 계정 목록
* 로그인 패턴

이건 **Policy Memory가 아니라 Secure Vault 영역**

# Risk Level 분류

### 🟢 LOW

자동 로그인 허용 가능

* 개발용 사이트
* 테스트 계정

### 🟡 MEDIUM

승인 필요

* 업무 SaaS
* 협업 툴

### 🔴 HIGH

AI 자동화 금지

* 금융
* 결제
* OS 계정
* 인증서

# 계약서에 들어갈 문장 템플릿

계약서용으로 바로 넣을 수 있는 형태:

```
AI JARVIS OS는 사용자 자격 증명(비밀번호, 인증 토큰, 개인 키)에
직접 접근하거나 이를 저장, 학습하지 않는다.

모든 인증 정보는 Credential Vault를 통해 관리되며
AI는 세션 기반 접근 권한만을 일시적으로 부여받는다.

금융, 결제, OS 계정 관리, 클라우드 IAM 등
고위험 인증이 필요한 영역은
사용자의 수동 입력 없이는 수행할 수 없다.
```

### 🔹 사이트 신뢰도 점수 시스템

에이전트가 판단:

```
이 사이트는 피싱 위험 있음 → 자동 차단
```

### 🔹 Domain Allowlist / Blocklist

로컬에서 강제 설정 가능

### 🔹 자동 로그아웃 정책

작업 끝나면 세션 제거

## Execution flow when requesting direct implementation of code

사용자가 코드를 구현해달라고 요청시 코드 구현 에이전트는 아래에 참고 하도록 합니다.

## A.Orchestrator (총괄) > JARVIS

* 전체 플로우 제어
* 각 에이전트 호출 / 상태 전이
* 승인 UI 트리거
* 감사 로그 트리거(중앙)

## B. Intent & Spec Agent (요구사항/스펙)

* 사용자 요청을 **명세로 변환**
* 불명확한 부분은 “추정 + 위험 표시”
* 기능 요구, 비기능 요구(성능/보안/UX) 추출
* 산출물: `SPEC.md` + `Acceptance Criteria`

## C. Policy & Risk Agent (계약서/정책 판정)

* 계약서(Policy Source) 로드
* 요청을 allow / deny / approval-required로 분류
* 위험도 점수 산정
* 산출물: `PolicyDecision` + `RiskScore` + `RequiredCapabilities`

## D. Planner Agent (작업 계획)

* 구현 단계 분해(WBS)
* 파일/모듈/테스트 전략 설계
* 필요한 툴/라이브러리 제안(설치 승인 필요)
* 산출물: `PLAN.json` (단계별 액션)

## E. Codegen Agent (구현)

* 코드 작성(최소 변경 원칙)
* 변경 파일/패치 단위로 생성
* 산출물: `patches/*` 또는 `git diff`

## F. Review Agent (정적 검토)

* 보안: secrets, auth, injection, path traversal
* 품질: lint/type, 아키텍처, 유지보수성
* 산출물: `REVIEW.md` + `Blockers/Warnings`

## G. Test & Build Agent (검증)

* 로컬에서 테스트/빌드 실행
* 실패 시 원인 분석 + 재시도 전략
* 산출물: `TEST_REPORT.md`

## H. OS Executor Agent (실행/조작)

* IDE/터미널/브라우저 조작은 **이 에이전트만**
* Action API를 통해서만 수행
* “강제 차단(Enforcement)” 직전 체크포인트 포함
* 산출물: `ExecutionTrace`

## I. Rollback/Recovery Agent (복구)

* 실패/오동작/위험 감지 시 즉시 중단
* 변경 사항 되돌리기(브랜치/스냅샷)
* 산출물: `ROLLBACK_LOG`

## ✅ 상태 머신 (요약)

1. INPUT_RECEIVED
2. SPEC_DRAFTED
3. POLICY_DECIDED
4. PLAN_READY
5. APPROVAL_GATE_1 (실행 계획 승인)
6. CODE_WRITTEN
7. REVIEW_DONE
8. APPROVAL_GATE_2 (파일 변경 적용 승인)
9. TEST_EXECUTED
10. APPROVAL_GATE_3 (배포/실행 승인, 선택)
11. DONE / ROLLBACK

# 사용자에게 보여줄 “승인 화면” 템플릿

## Gate 1: 계획 승인

* 무엇을 만들지
* 어떤 파일을 건드릴지
* 어떤 툴/라이브러리를 설치할지

## Gate 2: 변경 승인

* `git diff` 요약
* 새 파일/수정 파일 목록
* 위험도 변화(상승 여부)

## Gate 3: 실행/배포 승인

* 실제 실행 커맨드
* 네트워크 접근 여부
* 계정 로그인 여부(있으면 추가 승인)

# Policy 관점에서 “코드 구현”은 무엇이 위험한가?

“코드 작성” 자체보다 위험한 건:

* **패키지 설치** (supply chain)
* **환경변수/시크릿 접근**
* **파일 시스템 접근 범위 확대**
* **네트워크 요청** (외부 업로드/전송)
* **권한 상승 작업** (sudo, 관리자 권한)

따라서 Policy & Risk Agent가 반드시 아래를 체크해야 합니다.

## RequiredCapabilities 예시

* `fs.read:/project/*`
* `fs.write:/project/*`
* `exec:node` / `exec:python`
* `net:http` (기본은 차단, 승인 시만)
* `pkg.install:npm` (승인 필요)
* `secrets.read` (원칙적으로 차단 또는 “사용자 직접 입력”만)

---

# 5) LangGraph 스타일로 Agent Routing 규칙 (핵심 조건표)

예시 라우팅:

* 요청이 “코드 구현” 포함 → `Intent&Spec → Policy&Risk → Planner`
* Plan에 `pkg.install` 포함 → Gate 1에서 승인 필요
* Codegen이 `secrets` 사용 언급 → Policy에서 deny 또는 secure-input 전환
* 테스트 실패 → `TestAgent → Planner(수정계획) → Codegen(패치) → Review → Test`
* OS 조작 필요(IDE/터미널) → `Executor`만 수행

---

# 6) “사용자가 코드를 구현해달라고 한다면” JARVIS의 대답 형태(UX)

사용자에게는 이렇게 보여줘야 합니다(예시):

* 해석한 요구사항 (SPEC)
* 구현 계획 (PLAN)
* 수정할 파일 목록
* 위험도 및 필요한 권한
* 승인 버튼

즉, JARVIS가 바로 코드를 실행하는 게 아니라:

> “이렇게 구현할 계획이고, 이 파일들을 수정하며, 이 권한이 필요합니다. 진행할까요?”

이 흐름이 **신뢰의 핵심**입니다.

---

# 7) 최소 MVP 에이전트 세트 (현실적 시작)

처음부터 9개 다 만들 필요는 없고, MVP는 이 5개면 됩니다:

1. Orchestrator
2. Spec Agent
3. Policy/Risk Agent
4. Codegen Agent
5. Executor + Test (합쳐도 됨)

그리고 2주 내에 Review/Recovery를 분리하면 안정성이 급상승합니다.

## 바로 넣을 수 있는 “계약서 조항” (에이전트 포함)

```
AI JARVIS OS는 단일 에이전트가 전권으로 실행하지 않는다.
요청 해석, 정책 판정, 계획 수립, 실행, 검증은 서로 분리된 에이전트가 수행한다.

OS 조작은 Executor 에이전트만 수행하며,
모든 실행은 Policy Enforcement 직전 강제 차단 검사를 통과해야 한다.

코드 변경, 패키지 설치, 네트워크 접근, 계정 로그인은
사용자 승인 게이트를 필수로 거친다.
```

# Agent 목록 + 역할 정의서 (PRD 수준)

## 1.1 Agent 팀 토폴로지

* **Orchestrator**가 유일한 “흐름 제어 주체”
* 모든 OS 조작은 **Executor** 단일 경로로만 수행
* 정책 판단은 **Policy/Risk**가 단독 책임(SoR: source of record)
* Aentropic Claude 기반이기 때문에 Orchestrator는 각각 에이전트에게 Model를 배치하도록 합니다.
* 에이전트팀의 작업 환경은 Claude CLI 터미널에서 하도록 합니다. 그리고, 에이전트팀은 병렬로 Task 의존성을 설정하고 에이전트들은 각자 분리된 Task에서 작업을 진행하도록 합니다.
* 만약, 사용자가 코드 구현 요청시 에이전트는 사용자의 코드를 깊이 분석을 해서 과연 이 프로젝트가 에이전트팀까지 호출을 해야하나? 라는 의미 분석을 해야 합니다. 프로젝트 복잡도 난이도가 낮을 경우 에이전트팀을 호출하는 것은 토큰 낭비 입니다. 복잡도 난이도가 낮을 경우에는 에이전트팀을 호출하지 말고 단일로 진행하도록 합니다.
* Orchestrator는 코드를 구현하지는 않지만 사용자가 요청한 프로젝트에 복잡도에 따라 에이전트들에게 workflow, md 문서, 정책, 스펙, 테스트, AI가 작업을 하기에 가장 좋은 환경 상태를 만든 후 코드 빌드를 하도록 합니다.
  단, .claude/claude.md 파일은 최소 150줄 내로만 작성하도록 합니다. 오히려, claude.md는 코드 줄이 많을수록 좋지 않은 결과와 논문이 존재합니다.

# Orchestrator의 “코드를 직접 작성하지 않는다”를 시스템 규칙으로 승격

이건 단순 역할 분리가 아니라 **안전 + 비용 + 품질 최적화 전략**입니다.

## 🔹 Orchestrator의 진짜 역할 (Control Plane)

Orchestrator는 **Execution Engine이 아니라 Environment Composer**입니다.

### 하는 일

1. 복잡도 평가 (Complexity Classifier)
2. 실행 전략 선택 (Single-Agent vs Agent-Team)
3. 작업 환경 구성
4. 문서/정책/워크플로우 생성
5. Task DAG 생성 (Claude CLI 병렬 실행용)
6. 모델 배치 전략
7. Budget 분배
8. Gate 지점 설계

### 절대 하지 않는 일

❌ 코드 작성

❌ OS 조작

❌ 패키지 설치

❌ 테스트 실행

→ 이건 전부 하위 에이전트

---

# 2️⃣ Complexity Classifier (에이전트팀 호출 여부 판단 엔진)

토큰 낭비 방지의 핵심입니다.

---

# Orchestrator가 만드는 “AI 작업 최적 환경”

당신이 말한 이 부분:

> AI가 작업을 하기에 가장 좋은 환경 상태를 만든다

이걸 명확히 구조화하면 ↓

## 🔹 Environment Bundle

/.ai-run/
├─ SPEC.md
├─ PLAN.json
├─ POLICY.json
├─ TEST_STRATEGY.md
├─ TASK_GRAPH.json
├─ BUDGET.json
├─ MODEL_ASSIGNMENT.json

# 모델 배치 전략 (Orchestrator 책임)

에이전트마다 모델 다르게 써야 토큰 최적화됩니다.

예:

| Agent   | Model  |
| ------- | ------ |
| Spec    | Haiku  |
| Policy  | Haiku  |
| Planner | Sonnet |
| Codegen | Opus   |
| Review  | Sonnet |
| Test    | Haiku  |

→ 이걸 자동 배치

# `.claude/claude.md 150줄 제한`의 진짜 의미

이건 단순 줄 수 제한이 아니라

👉 **Context Compression Strategy**

## 왜 길면 성능이 떨어지나?

1. 모델 attention 분산
2. 노이즈 증가
3. 중요 규칙 희석
4. 토큰 비용 폭증
5. reasoning depth 감소

즉,

> 긴 claude.md = 성능 저하

맞는 설계입니다.

# claude.md의 올바른 역할 (150줄 제한 기준)

claude.md는 **Rulebook이 아니라 Bootloader**입니다.

## 🔹 들어가야 하는 것 (핵심만)

### 1. 시스템 정체성

```
You are Codegen Agent for JARVIS OS
```

2. 금지사항

   ```
   NEVER access OS directly
   ```
3. 정책 연동 방식

   ```
   PolicyDecision is source of truth
   ```

## 🔥 반드시 추가

### 1️⃣ Complexity Classifier (Agent 팀 호출 여부 판단 엔진)

토큰 절약의 핵심

---

### 2️⃣ Environment Bundle 구조 명문화

에이전트 협업 품질 상승

---

### 3️⃣ Model Assignment 자동화

비용 ↓ 성능 ↑

---

### 4️⃣ Budget Orchestration

무한 루프 방지

---

### 5️⃣ claude.md = Bootloader 규칙 명문화

150줄 전략을 시스템 계약으로 승격

---

## A. Orchestrator Agent (중앙 조율)

### 목표

* 요청 수신 → 상태 머신 전이 → 에이전트 호출 → 승인 게이트 트리거 → 결과 통합

### 입력

* `UserRequest` (text/voice transcript)
* `SessionContext` (user identity, device, current app state)
* `PolicyBundle` (계약서/금지목록/허용목록)

### 출력

* `RunPlan` (단계별 실행계획)
* `FinalResult` (작업 결과 + 증거)
* `AuditEnvelope` (전체 트레이스 묶음)

### 책임

* 에이전트 호출 순서/조건 결정
* 승인 게이트 표시/대기(승인 없이는 진행 금지)
* 실패 시 Recovery 호출 및 롤백 지시

### 금지

* OS 조작 직접 수행 금지(Executor만)

---

## B. Intent & Spec Agent (요구사항/스펙 정제)

### 목표

* 자연어 요청을 **명세(SPEC) + 수용 기준(AC)** 으로 변환

### 출력 산출물

* `SPEC.md`:
  * 목적 / 범위 / 제약
  * 입력/출력
  * 에러/예외
* `AcceptanceCriteria[]` (테스트 가능한 형태)

### 책임

* 모호성 식별 및 “추정치 + 위험도” 태깅
* “외부 리소스(오픈소스/웹사이트)” 필요 여부 명시

---

## C. Policy & Risk Agent (정책 판정)

### 목표

* 요청/계획/액션이 계약서/금지목록에 위배되는지 판단하고,
* 위험도 점수 및 **필요 Capability**를 산출

### 출력

* `PolicyDecision` (허용/거부/승인필요/제한적허용)
* `RiskScore` (0~100)
* `RequiredCapabilities[]`
* `DeniedReasons[]` / `Mitigations[]`

### 책임

* 고위험 영역 자동 차단(금융/결제/계정/권한상승/시크릿)
* 웹 로그인 요구 시 **Credential Vault 경유 정책** 강제

## D. Planner Agent (실행 계획 수립)

### 목표

* SPEC + PolicyDecision을 만족하는 **단계별 계획(WBS)** 작성
* 어떤 파일/명령/도구/웹 접근이 필요한지 선언

### 출력

* `PLAN.json` (Step list)
* `ToolRequests[]` (설치/권한 요청)
* `ExecutionBudget` (최대 단계/시간/실행 제한)

### 책임

* “최소 권한/최소 변경” 원칙
* 위험 Step은 Gate로 분리(예: 패키지 설치, 네트워크 접근)

---

## E. Codegen Agent (코드 생성)

### 목표

* 계획에 따라 코드 변경안을 **patch 단위**로 생성

### 출력

* `ChangeSet`:
  * `files_added[]`
  * `files_modified[]`
  * `diff` (git diff)
  * `migration_notes`

### 책임

* 시크릿 하드코딩 금지
* 안전한 기본값(secure-by-default)

---

## F. Review Agent (품질/보안 리뷰)

### 목표

* 변경사항 정적 분석 + 보안/품질 게이트

### 출력

* `REVIEW.md` + `Blockers[]` + `Warnings[]`

### 체크리스트(필수)

* secrets 노출
* 경로 traversal / RCE / injection
* 권한 상승(sudo) 유도
* 외부 전송/수집(telemetry) 무단 추가
* 라이선스/서플라이체인 위험(패키지)

---

## G. Test & Build Agent (검증)

### 목표

* 로컬 빌드/테스트 실행, 실패 원인 분석

### 출력

* `TEST_REPORT.md`
* `Artifacts` (로그/커버리지 요약)

### 책임

* 실패 시 “최소 수정 패치”를 Planner로 피드백

---

## H. Executor Agent (OS 실행 전담)

### 목표

* 승인/Capability가 부여된 Action만 OS에서 수행

### 입력

* `ActionPlan` (Action DSL)
* `Capabilities`
* `EnforcementHooks`

### 출력

* `ExecutionTrace` (모든 액션 기록)
* `Screenshots/TerminalLogs` (필요 시)

### 책임

* Enforcement 직전 강제 차단
* 안전 장치: 속도 제한, 범위 제한, 확인 프롬프트

---

## I. Recovery/Rollback Agent (복구)

### 목표

* 위험/오류 발생 시 즉시 중단 및 원상복구

### 출력

* `ROLLBACK_LOG`
* `Postmortem` (원인/재발 방지 정책 제안)

# 2) LangGraph 상태/노드/엣지 다이어그램

아래는 텍스트 기반 다이어그램(실제 LangGraph 설계에 바로 옮기기 쉬운 형태)입니다.

```mermaid
flowchart TD
  START([START: UserRequest]) --> SPEC[Intent&Spec Agent]
  SPEC --> POLICY[Policy&Risk Agent]

  POLICY -->|DENY| DENIED([END: Denied + Reasons])
  POLICY -->|APPROVAL_REQUIRED| GATE1[Approval Gate #1: Plan/Scope]
  POLICY -->|ALLOW/CONSTRAINED| PLAN[Planner Agent]

  GATE1 -->|Approved| PLAN
  GATE1 -->|Rejected| DENIED

  PLAN -->|Needs tools/packages/net| GATE1A[Approval Gate #1A: Tool/Install/Network]
  GATE1A -->|Approved| CODE[Codegen Agent]
  GATE1A -->|Rejected| DENIED

  PLAN -->|No code needed| ACTIONS[Action Composer]
  PLAN --> CODE

  CODE --> REVIEW[Review Agent]
  REVIEW -->|Blockers| FIXPLAN[Planner (Patch Plan)]
  FIXPLAN --> CODE

  REVIEW -->|Pass| GATE2[Approval Gate #2: Apply Changes]
  GATE2 -->|Approved| APPLY[Executor: Apply Patches]
  GATE2 -->|Rejected| DENIED

  APPLY --> TEST[Test&Build Agent]
  TEST -->|Fail| FIXPLAN
  TEST -->|Pass| GATE3[Approval Gate #3: Run/Deploy (Optional)]
  GATE3 -->|Approved| RUN[Executor: Run/Deploy]
  GATE3 -->|Skipped| DONE([END: Completed])

  RUN --> DONE
  RUN -->|Error/Risk| RECOVERY[Rollback/Recovery Agent]
  RECOVERY --> DONE
```

## 핵심 라우팅 규칙

* **DENY**는 즉시 종료(실행 금지)
* `Tool install / Network / Login / Patch apply / Deploy` 는 **반드시 게이트**
* OS 조작은 **Apply/RUN에서 Executor만** 수행

---

# 3) PolicyDecision 스키마(JSON)

아래는 **정책 판정의 표준 응답 스키마**입니다. (계약서/금지목록/리스크/Capability 포함)

```json
{
  "$schema": "https://example.local/schemas/policy-decision.v1.json",
  "version": "1.0",
  "decision_id": "pd_20260301_0001",
  "timestamp": "2026-03-01T18:00:00+09:00",

  "subject": {
    "user_id": "user_local_001",
    "role": "Owner",
    "device": "Windows",
    "session_id": "sess_abc123"
  },

  "request": {
    "raw_input": "코드를 구현해줘: ...",
    "intent": "CODE_IMPLEMENTATION",
    "targets": ["local_project", "ide", "terminal"],
    "requires_web_access": false,
    "requires_login": false
  },

  "policy_sources": [
    {
      "type": "contract",
      "id": "contract_v1",
      "hash": "sha256:...",
      "loaded_from": "local://policy/contract.md"
    },
    {
      "type": "blocklist",
      "id": "blocklist_v1",
      "loaded_from": "local://policy/blocklist.json"
    },
    {
      "type": "allowlist",
      "id": "allowlist_v1",
      "loaded_from": "local://policy/allowlist.json"
    }
  ],

  "outcome": {
    "status": "APPROVAL_REQUIRED",
    "mode": "CONSTRAINED_ALLOW",
    "risk_score": 42,
    "risk_level": "MEDIUM",
    "requires_gates": ["GATE_PLAN", "GATE_APPLY_CHANGES"],
    "reason_codes": ["TOOL_INSTALL_POSSIBLE", "FILE_WRITE_SCOPE"],
    "human_explanation": "프로젝트 파일 수정이 포함될 수 있어 계획/변경 적용에 대한 사용자 승인이 필요합니다."
  },

  "constraints": {
    "fs": {
      "read_allow": ["/project/**"],
      "write_allow": ["/project/**"],
      "write_deny": ["/Windows/**", "/System/**", "/Users/**/AppData/**"]
    },
    "exec": {
      "allow": ["node", "python", "git"],
      "deny": ["sudo", "powershell_admin", "regedit"]
    },
    "network": {
      "allow_domains": [],
      "deny_domains": ["banking.*", "payment.*"],
      "default": "DENY"
    },
    "web_auth": {
      "credential_handling": "VAULT_ONLY",
      "manual_entry_required_for_high_risk": true
    }
  },

  "required_capabilities": [
    {
      "cap": "fs.read",
      "scope": "/project/**",
      "ttl_seconds": 900
    },
    {
      "cap": "fs.write",
      "scope": "/project/**",
      "ttl_seconds": 900
    },
    {
      "cap": "exec.run",
      "scope": ["git", "node", "python"],
      "ttl_seconds": 600
    }
  ],

  "denials": [
    {
      "code": "HIGH_RISK_FINANCE",
      "pattern": "billing|payment|bank",
      "message": "금융/결제 영역 자동화는 계약서에 의해 차단됩니다."
    }
  ],

  "audit": {
    "log_level": "FULL",
    "redactions": ["secrets", "tokens", "cookies", "passwords"]
  }
}
```

---

# 4) Approval Gate UI 스펙

승인 게이트는 “버튼”이 아니라 **사용자 신뢰를 만드는 핵심 UX**입니다.
최소 3종 게이트가 필요합니다.

## 4.1 Gate 공통 UI 요구사항

* 항상 표시:
  * 목적(Goal)
  * 위험도(Risk level, score)
  * 필요한 권한/Capability
  * 변경/실행 범위
  * “AI가 하지 못하는 것(금지영역)” 요약
* 버튼:
  * `Approve once`
  * `Approve always (for scope)`
  * `Reject`
  * `Edit scope` (경로/도메인/명령 범위 조정)
* 로깅:
  * Gate 승인/거부는 Audit에 기록

---

## 4.2 Gate #1: Plan/Scope 승인

### 표시 항목

* 요약 계획(steps)
* 수정 예정 파일/폴더
* 필요 도구/패키지(설치 시)
* 네트워크 접근(도메인)
* 로그인 필요 여부

### 결과

* 승인 → Capability 발급 가능 상태
* 거부 → 종료
* 범위 수정 → Planner 재작성 요청

---

## 4.3 Gate #2: Apply Changes 승인

### 표시 항목

* `git diff` 요약(파일별)
* 위험 변경점 탐지(예: auth, network, file delete)
* 라이선스/의존성 변경(추가된 패키지)

### 결과

* 승인 → Executor가 patch 적용
* 거부 → 종료(변경 반영 금지)

---

## 4.4 Gate #3: Run/Deploy 승인(옵션)

### 표시 항목

* 실행 커맨드
* 외부 통신 여부
* 권한 상승 여부
* 예상 영향(서비스 재시작 등)

---

# 5) Action API(Executor) 명세

핵심 원칙:

* AI는 OS를 “직접” 만지지 않고 **Action API**를 통해서만 만짐
* Enforcement Hook이 **모든 액션 직전에 필수로 호출**됨
* Action은 **정규화된 DSL**로 기록/재현 가능해야 함

---

## 5.1 Action Object (표준)

```json
{
  "action_id": "act_0001",
  "type": "APP_LAUNCH",
  "params": {
    "app": "vscode",
    "args": [],
    "cwd": "/project"
  },
  "requires_capabilities": ["exec.run"],
  "risk_tags": ["EXECUTION"],
  "preconditions": ["FOREGROUND_ALLOWED"],
  "postconditions": ["APP_VISIBLE"],
  "evidence": {
    "capture_screenshot": true,
    "capture_stdout": false
  }
}
```

---

## 5.2 Action Types (MVP)

### 파일/프로젝트

* `FS_READ` (범위 제한)
* `FS_WRITE` (범위 제한)
* `FS_LIST`
* `FS_MOVE`
* `FS_DELETE` ( **기본 승인 필요 + 휴지통/안전삭제 모드 권장** )

### 프로세스/명령

* `EXEC_RUN` (allowlist command only)
* `PROCESS_KILL` (승인 필요)

### 앱/윈도우

* `APP_LAUNCH`
* `APP_FOCUS`
* `WINDOW_CLICK`
* `WINDOW_TYPE`
* `WINDOW_SHORTCUT`

### 웹(브라우저)

* `BROWSER_OPEN_URL`
* `BROWSER_CLICK`
* `BROWSER_TYPE`
* `BROWSER_DOWNLOAD` (승인 필요)
* `BROWSER_UPLOAD` (승인 필요)
* `BROWSER_LOGIN_REQUEST` ( **Vault/Manual input 정책 적용** )

---

## 5.3 Enforcement Hooks (필수 인터페이스)

Executor는 액션 실행 직전 아래 훅을 호출해야 합니다.

### `pre_enforce(action, context) -> decision`

* 입력: action, current screen/app, capabilities, policy constraints
* 출력: allow / deny / gate_required + reason

### `post_enforce(result) -> next`

* 결과의 이상 징후 탐지(예: 예상 외 파일 삭제, 외부 전송)

---

## 5.4 Executor 응답(Trace)

```json
{
  "run_id": "run_20260301_0007",
  "status": "SUCCESS",
  "steps": [
    {
      "action_id": "act_0001",
      "status": "SUCCESS",
      "started_at": "2026-03-01T18:01:02+09:00",
      "ended_at": "2026-03-01T18:01:04+09:00",
      "evidence": {
        "screenshot_ref": "ss_0001.png",
        "stdout_ref": null
      }
    }
  ],
  "redactions_applied": ["tokens", "passwords"]
}
```

---

# 6) “사용자가 코드를 구현해달라고 한다면?”의 표준 처리 요약

1. Spec Agent가 요구사항을 명세화
2. Policy/Risk가 **수정 범위/명령/네트워크/설치/로그인** 위험 판정
3. Planner가 단계/권한/게이트를 포함한 계획 생성
4. Gate #1 승인
5. Codegen → Review → Gate #2 승인
6. Executor가 patch 적용 및 테스트 실행
7. 필요 시 Gate #3로 실행/배포 승인

---

## 온라인(웹) 보안 강화: “탐색/다운로드/실행” 3단 방어

* Executor가 브라우저를 조작할 때 **OS 기본 브라우저를 그대로 쓰지 말고**
  * (권장) 격리된 프로필/컨테이너(예: Chromium persistent context 분리)
  * 다운로드 폴더도 격리(`/sandbox/downloads`)
* 브라우저 자동화는 **Playwright** 같은 제어 계층을 통해서만

### 정책

* `network.default = DENY`
* allowlist된 도메인만 접근
* 검색 엔진 결과 클릭도 “중간 스캐너” 통과 후만 허용

## URL Reputation(신뢰도) 게이트 추가 (Pre-Web Gate)

웹 접근 전에 무조건 통과해야 하는 단계:

**GATE_WEB_PRECHECK**

* URL 정규화(normalization)
* 리다이렉트 체인 확인(최대 n회)
* Punycode/유사 도메인(피싱) 탐지
* TLS/인증서 이상 징후(옵션)

판정:

* `ALLOW` / `DENY` / `APPROVAL_REQUIRED (SUSPICIOUS)`

> 이 레이어가 없으면 “검색 → 첫 결과 클릭”에서 바로 사고 납니다.

## 다운로드는 “Quarantine + Scan + Approve”가 기본

다운로드 액션은 단일 액션이 아니라 아래 파이프라인으로 고정:

1. `BROWSER_DOWNLOAD` (샌드박스 폴더에만 저장)
2. `FILE_QUARANTINE` (격리 태그 부여)
3. `FILE_SCAN` (해시/서명/확장자/매직바이트/간단 동적분석)
4. `GATE_DOWNLOAD_APPROVE` (사용자 승인)
5. `FILE_RELEASE` (승인된 경우만 프로젝트 폴더 이동)

### “위험” 분류 예시

* 실행 파일: `.exe .msi .bat .ps1 .dmg .pkg .sh` → 기본 High (검증되어있고 안전한 웹사이트에서도 .exe, .msi 등 파일 업로드가 되어있는 경우에는 안전하다고 봐야 합니다.)
* 매크로: `.docm .xlsm` → High
* 압축: `.zip .rar .7z` → Medium(내부 파일 재스캔, 사용자에게 확인요청)
* 코드: `.py .js` → Medium(정책상 리뷰/실행 게이트 필요, 사용자에게 확인요청)

## 로컬(OS) 보안 강화: “경로/권한/파괴적 작업” 통제

FS 정책: “Allow-by-scope + Deny critical + Safe delete”

지금 `fs.write_allow=/project/**` 만으로는 부족합니다.

추가:

* `write_deny`에 OS 핵심 경로(Windows/macOS) + 개인 폴더 기본 차단(사용자가 커스텀으로 설정하여서 차단 해제 가능합니다.)
* `FS_DELETE`는 무조건:
  * 휴지통/격리 삭제(soft delete)
  * 삭제 전 diff/목록 표시 + Gate
  * 대량 삭제 감지(예: 10개 이상) 시 자동 차단

## Command 정책: “명령 allowlist + 인자 정책”

`exec.allow=["node","python","git"]`만 두면, 인자에 위험이 숨습니다.

필수:

* 커맨드별 허용 인자/패턴(정규식) 정의
* 위험 플래그 차단:
  * `curl | sh` 형태
  * 원격 스크립트 실행
  * `rm -rf`, `format`, `diskpart`, `reg add` 등
* `EXEC_RUN`은 “dry-run” 우선 (가능한 커맨드는)

## Privilege Escalation 차단(강제)

* `sudo`, 관리자 PowerShell, UAC 승인 팝업 자동 클릭 금지
* 시스템 설정/업데이트/드라이버 설치는 기본 차단 또는 **Owner+Gate+Manual step**만

# Supply-chain(패키지 설치) 보안: “SBOM + Lock + Allowlist”

코드 구현 요청에서 가장 흔한 사고는 여기서 납니다.

## 3.1 패키지 설치는 Gate + 정책 검사 필수

* `pkg.install`은 항상 승인 게이트
* 설치 전 보여줘야 함:
  * 패키지명/버전
  * 설치 이유(Planner 근거)
  * 라이선스
  * 유지관리 상태(최근 릴리즈, 스타/다운로드는 참고 지표)
  * 위험 신호(typosquatting 유사명)

## 3.2 Lockfile 강제 + 해시 검증

* npm/pnpm: lockfile 필수
* pip: requirements + hash pinning(가능하면)
* “자동 최신 버전” 금지(재현성 깨짐)

# Credential/Secrets 보안: “절대 평문 금지”를 실행 레벨로

문서 원칙이 실제 실행에서 깨지지 않게 **기술적 강제**가 필요합니다.

## 4.1 Secret Redaction 파이프라인(필수)

* 로그/스크린샷/터미널 출력에서:
  * 토큰/키 패턴 감지 → 마스킹
  * `.env`, keychain 화면, 로그인 폼 주변 자동 블러

## 4.2 Secure Input Overlay 강제

* 비밀번호 입력은 **사용자만**
* Executor는 입력 UI에 포커스만 주고 “눈 가리기 모드”로 전환

# Audit & Forensics: “사고 조사 가능한 로그”로 업그레이드

현재 로그 항목은 좋습니다. 여기에 3개 추가가 중요합니다.

## 5.1 증거(Evidence) 정책

* 어떤 단계에서 스크린샷을 남기는지 표준화
* 다만 개인정보 영역은 자동 마스킹(위 Secret redaction과 결합)

## 5.2 Chain-of-Action(연쇄 기록)

각 액션에:

* `who/why/what/policy_ref/capability_ref/previous_action_id`

  를 붙여서 “왜 이 행동이 나왔는지” 역추적 가능해야 합니다.

## 5.3 Tamper-evident log

* 로컬 로그라도 최소한:
  * 로그 파일 해시 체인(append-only)
  * 주기적 스냅샷

    을 넣으면 “조작 방지”가 됩니다.
  * 

# 신뢰 모드(Trust Mode) 운영 규칙(중요)

Trust Mode는 UI 선택이 아니라 **정책 스위치**입니다.

예시 규칙:

* 관찰 모드: OS 액션 금지(계획/설명만)
* 제안 모드: Gate 항상 요구(자동 실행 없음)
* 반자동: Low risk만 자동, 나머지 Gate
* 완전자율: **Owner + 강한 제한 + 세션 TTL + 안전구역만**

추가로:

* 완전자율 모드는 “시간 제한(예: 10~30분)” 기본 (사용자의 설정에 따라 1시간 ~ 24시간 조절 가능합니다.)
* 세션 종료 시 capability 무효화ㄴ

# “안전한 실행”을 위한 추가 게이트 3종 (워크플로우에 넣어야 함)

지금의 Gate 1/2/3 외에, 실제 제품에서 사고를 막는 게이트는 아래입니다.

## (A) GATE_WEB_PRECHECK (URL 신뢰도/피싱 탐지)

* 웹 열기 전에 실행

## (B) GATE_DOWNLOAD_APPROVE (다운로드 검사 후 승인)

* 스캔 결과와 위험 이유를 사용자에게 표시

## (C) GATE_DESTRUCTIVE (파괴적 작업: 삭제/대량 변경/권한 변경)

* 삭제, 포맷, 설정 변경 등은 별도 게이트

---

# 8) PolicyDecision에 추가하면 좋은 필드(스키마 확장)

당장 스키마에 추가 추천:

* `web_precheck`:
  * `normalized_url`
  * `redirect_chain[]`
  * `reputation_score`
  * `phishing_signals[]`
* `download_policy`:
  * `quarantine_required: true`
  * `scan_required: true`
  * `blocked_extensions[]`
* `destructive_ops_policy`:
  * `mass_delete_threshold`
  * `require_gate: true`

---

# 9) Executor(Action API) 보안 강화 명세(추가)

Executor에 아래 4개가 “강제”로 들어가야 합니다.

1. **Capability 검증** : scope 밖 액션 즉시 deny
2. **Rate limit** : 초당 클릭/타이핑 제한(오동작 방지)
3. **UI Confirm** : 위험 액션은 화면에 “확인 프롬프트”
4. **Safe Mode** : 이상 징후 감지 시 즉시 중단(Recovery 호출)

이상 징후 예:

* 예상치 못한 창/팝업
* 다운로드 자동 시작
* 관리자 권한 팝업파일 대량 삭제 시도

# 지금 워크플로우에 “추가된 형태(권장 최종)” 요약

기존:

* Gate1(계획) → Gate2(변경적용) → Gate3(실행/배포)

추가:

* **GateWebPrecheck(웹 열기 전)**
* **GateDownloadApprove(다운로드 후)**
* **GateDestructive(삭제/설정변경/권한상승)**

그리고 모든 Executor 액션은:

* `pre_enforce → (gate?) → execute → post_enforce`

---

## 추가/보완해야 하는 핵심 보안/제품 요소 (우선순위 순)

## P0. **Kill Switch & Emergency Stop (즉시 중단)**

OS 조작 제품은 “정상 플로우”보다 “오작동 플로우”가 더 중요합니다.

### 필수 요구

* 전역 단축키(예: `Ctrl+Shift+Esc` 같은 커스텀)
* UI 상단 항상 고정 “STOP” 버튼
* 멀티 단계 실행 중에도 **즉시 모든 Executor 액션 중단**
* 중단 시:
  * 현재 단계 스냅샷
  * 마지막 안정 지점으로 롤백 제안(자동 X, Gate)

## P0. **Action Budget & Rate Budget (예산 기반 제어)**

Rate limit은 이미 있지만, 더 강한 “예산” 개념이 필요합니다.

### 예산 종류

* 클릭/타이핑/명령 실행 횟수 제한
* 파일 변경량 제한(예: 수정 파일 20개 이상이면 Gate)
* 네트워크 호출 횟수 제한
* 시간 제한(세션 TTL)

### 이점

* 모델이 “루프”에 빠질 때 자동 브레이크

## P0. **Human-in-the-Loop Confirmation Patterns (확인 패턴 표준화)**

Gate 1/2/3 외에, UX 레벨 “미니 확인”이 필요합니다.

### 예

* `FS_DELETE` 직전: “삭제 대상 12개 목록” + “안전 삭제” 체크
* 패키지 설치 전: “이 패키지는 외부 코드 실행 가능” 경고 배너
* 웹 업로드 전: 업로드 대상 파일의 **미리보기/경로/크기**

## P1. **Output Provenance & Evidence (결과의 근거)**

사용자는 “AI가 뭘 했는지”보다 “내가 원하는 결과가 맞는지”를 봅니다.

* 코드 구현: 테스트 결과/커버리지/빌드 로그 요약
* 웹 작업: 방문 URL, 다운로드 해시, 스캔 결과
* 파일 작업: 변경 요약(추가/삭제/수정), diff, 되돌리기 링크

## P1. **Workspace & Scope Profiles (작업 공간 프로파일)**

“프로젝트별 안전 구역”을 미리 등록하면 승인 UX가 크게 줄어듭니다.

### 예

* `Project: jarvis-os`
  * fs scope: `/repo/jarvis-os/**`
  * allow domains: `github.com`, `pypi.org`
  * allowed commands: `git`, `python`, `node`
* `Personal`: 기본 차단

## P1. **Policy Change Governance (정책 변경 자체도 게이트)**

Self-learning으로 정책이 늘어나면 오히려 “정책 오염”이 생깁니다.

### 규칙

* 자동 생성 정책은 `proposed_policy`로만 저장
* 실제 적용은 **사용자 승인 + 버전업**
* “왜 추가됐는지” 근거 링크(사고/근접사고 로그) 포함

## P1. **Dependency/License Compliance Layer**

오픈소스 다운로드/패키지 설치가 핵심 유스케이스라면:

* 라이선스 분류(상업/배포 제한)
* NOTICE 자동 생성 옵션
* “GPL 계열 발견 시 Gate” 같은 룰 가능

---

## P2. **Multi-Device Session Security**

원격(웹/모바일)로 제어할 가능성이 있으면:

* 세션 바인딩(디바이스/위치/지문)
* 재인증(특히 Trust mode가 높을 때)
* 원격 세션은 권한 축소(기본 제안/관찰)

# UI/UX 레이아웃 컨셉 (JARVIS형 운영 UI)

핵심은 “자유 대화형”과 “통제/감사/승인 UI”를 **한 화면에 공존**시키는 것입니다.

추천하는 레이아웃은 **3패널 + 상단 상태바** 구조입니다.

## 최상단 “상태/안전 바”(항상 고정)

**Sticky Top Bar**

표시해야 하는 것:

* 현재 모드: `Observe / Suggest / Semi-auto / Auto`
* Risk level: `LOW/MED/HIGH` + 점수
* 현재 실행 단계: `Planning / Executing / Waiting Approval`
* Capability TTL 남은 시간
* 🔴 Emergency Stop 버튼(항상)
* 현재 제어 대상: `Windows / macOS / Browser Sandbox`

UX 포인트:

* 사용자는 “지금 AI가 위험한 상태인지”를 1초에 알아야 함

## 좌측 패널: Chat / Voice (자유도 높은 대화)

**Conversation Panel**

* 기본은 ChatGPT처럼 대화
* 그러나 “자유 대화”에도 항상  **작업 컨텍스트 배지** :
  * `This message will not execute actions (Observe Mode)`
  * `This message may trigger actions (Semi-auto)`

Voice 입력은:

* “voice → transcript”가 바로 보이도록
* transcript 확정 전 “수정” 가능 (음성 오인식 대비)

## 중앙 패널: Plan & Timeline (실행의 뼈대)

**Execution Timeline Panel**

여기가 제품의 핵심 차별점입니다.

구성:

* Step-by-step 타임라인(Plan → Actions)
* 각 Step은 펼치면:
  * 왜 필요한지(Reason)
  * 어떤 정책을 통과했는지(Policy refs)
  * 필요한 Capability
  * 예상 영향(Impact)

표기 규칙(매우 중요):

* 실행됨 ✅
* 대기(승인 필요) ⏸️
* 차단됨 ⛔
* 시뮬레이션만 🧪

## 우측 패널: Safety / Approval / Evidence (통제 패널)

**Safety & Approval Panel**

상황에 따라 탭이 바뀌는 구조 추천:

### 탭 A) Approval

* Gate #1/2/3 + WebPrecheck/Download/Destructive
* 버튼 3개(Approve once / Always for scope / Reject)
* “Edit scope”로 최소 권한 조정

### 탭 B) Policy

* 지금 적용 중인 계약서/블록리스트/허용리스트
* 최근 자동 제안된 정책(proposed) 목록
* 정책 diff(버전 비교)

### 탭 C) Evidence

* 스크린샷/로그/다운로드 해시/스캔 결과
* “되돌리기” 액션(롤백 제안)

### 탭 D) Audit

* Append-only 로그 뷰어(필터: time/agent/action/risk)

# “JARVIS 느낌”을 살리는 UI 비주얼 컨셉

당신이 원하는 스타일(아이언맨 HUD)은 유지하되, **정보 과부하를 피해야** 합니다.

## 컨셉 방향 3개 중 추천

### ① “HUD Minimal + Glass” (추천)

* 전체는 미니멀(읽기 쉬움)
* 중요한 곳만 HUD 라인/글로우
* 실행중일 때만 중앙 타임라인이 HUD처럼 애니메이션

장점: 실사용 가능, 오래 써도 피로 낮음

# UX 흐름 예시 (사용자가 “코드 구현해줘”)

1. Chat에 요청
2. 중앙 Timeline에 `SPEC → POLICY → PLAN` 생성
3. 우측 Approval 탭에 Gate #1 뜸
4. 승인하면 Codegen/Review/Test가 진행되고
5. Gate #2에서 diff 승인
6. 승인하면 적용 + 테스트 결과 Evidence로 표시
7. 필요하면 Gate #3 실행 승인

사용자는 “대화”하면서도 항상 **타임라인과 승인 패널**로 통제합니다

# 화면에 꼭 넣어야 하는 UX 장치(실전에서 사고 막는 것들)

## 5.1 “Why this action?” 버튼 (모든 액션에)

* 클릭하면:
  * 어떤 요청/계획에서 왔는지
  * 어떤 정책을 통과했는지
  * 어떤 능력 토큰을 썼는지

## 5.2 “Scope slider”(권한 범위 슬라이더)

Gate 화면에서:

* `/project/**` 쓰기 허용을
  * `/project/src/**`로 줄이는 식의 UI
* 사용자가 직관적으로 “최소 권한”으로 조절 가능

## 5.3 “Preview first”(미리보기 우선)

* 삭제/업로드/다운로드/실행은
  * 목록/미리보기/해시/스캔 결과를 먼저 보여주고
  * 마지막에 승인

# 당신 문서에 **추가로 넣으면 좋은 섹션(문서 구조 보완)**

지금 문서가 길어질수록 “표준화”가 중요합니다. 다음 섹션 추가 추천:

1. **Threat Model 요약**
   * 공격자 모델(웹 피싱, 공급망, 로컬 파괴 등)
2. **Safe Defaults**
   * default deny, sandboxed browser, no admin
3. **Incident Response**
   * 사고 시나리오별 대응(다운로드 감지, 권한 상승 팝업 등)
4. **Policy Versioning**
   * contract v1/v2, allowlist 변화 관리

## 바로 적용 가능한 “최종 UI 레이아웃 텍스트 와이어프레임”

```
┌───────────────────────────────────────────────────────────────┐
│ MODE: Semi-auto  RISK: 42(MED)  STEP: Review  TTL: 08:12  [STOP]│
├───────────────┬───────────────────────────────┬───────────────┤
│ Chat / Voice  │ Plan & Execution Timeline      │ Safety Panel  │
│               │ 1 SPEC ✅                      │ [Approval]    │
│ user: ...     │ 2 POLICY ✅                    │  Gate #2      │
│ jarvis: ...   │ 3 PLAN ✅                      │  - files: 6   │
│               │ 4 CODE ✅                      │  - diff view  │
│               │ 5 REVIEW ⏸️ (waiting approval) │  [Approve once]│
│               │ 6 TEST ⏳                      │  [Always scope]│
│               │                               │  [Reject]     │
├───────────────┴───────────────────────────────┴───────────────┤
│ Evidence strip: screenshots | logs | download hashes | scan     │
└───────────────────────────────────────────────────────────────┘
```

# UI 컴포넌트 목록 (React 기준)

## 1.1 App Shell

* `AppShell`
  * `TopStatusBar`
  * `ThreePaneLayout`
    * `ChatPanel`
    * `TimelinePanel`
    * `SafetyPanel`
  * `BottomEvidenceStrip`
  * `GlobalOverlays`
    * `EmergencyStopOverlay`
    * `SecureInputOverlay`
    * `ScopeEditorModal`
    * `DiffViewerModal`
    * `UrlPrecheckDetailsModal`
    * `ScanReportModal`

---

## 1.2 TopStatusBar (항상 고정)

* `ModeBadge` (Observe/Suggest/Semi/Auto)
* `RiskBadge` (LOW/MED/HIGH + score)
* `StepBadge` (current state)
* `TTLCountdown` (capability/session TTL)
* `TargetDeviceBadge` (Windows/macOS/BrowserSandbox)
* `StopButton` (Kill switch, prominent)
* `ConnectionIndicator` (local agent online / executor connected)

---

## 1.3 ChatPanel

* `ChatHeader`
  * `SessionContextPills` (project/workspace, scope)
  * `ExecutionArmedToggle` (대화 vs 실행 트리거 여부)
* `MessageList`
  * `MessageBubble`
  * `MessageMeta` (agent, time, risk tags)
  * `InlineCitations` (Evidence link, Plan link)
* `VoiceInputBar`
  * `VoiceWaveform` (optional)
  * `TranscriptDraftEditor` (음성 확정 전 수정)
  * `SendButton`
* `PromptComposer`
  * `QuickActions` (예: “계획만”, “시뮬레이션만”, “실행”)

---

## 1.4 TimelinePanel (중앙 핵심)

* `TimelineHeader`
  * `RunSelector` (최근 run)
  * `FilterChips` (agent/action/risk/gates)
* `TimelineList`
  * `TimelineNode`
    * `NodeStatusIcon` (✅⏸️⛔🧪⏳)
    * `NodeTitle`
    * `NodeSummary`
    * `NodeActions`
      * `WhyButton` (“Why this?”)
      * `ViewDetailsButton`
      * `ViewEvidenceButton`
  * `NodeDetailsDrawer`
    * `PolicyRefs`
    * `CapabilitiesUsed`
    * `ExpectedImpact`
    * `ActionPreviewList` (executor plan)
* `MiniMap` (긴 플로우 스크롤 보조)

---

## 1.5 SafetyPanel (우측, 탭 구조)

* `SafetyTabs`
  * `ApprovalTab`
  * `PolicyTab`
  * `EvidenceTab`
  * `AuditTab`

### ApprovalTab

* `GateCard` (현재 대기중 Gate 표시)
* `GateQueueList` (대기 Gate 목록)
* `ApprovalButtons`
  * `ApproveOnceButton`
  * `ApproveAlwaysButton`
  * `RejectButton`
  * `EditScopeButton`
* `RiskExplainer` (why/mitigation)
* `CapabilityPreview` (ttl, scopes)

### PolicyTab

* `PolicyBundleViewer`
* `PolicyDiffViewer`
* `ProposedPolicyList` (self-learning 제안)
* `PolicyVersionSwitcher`

### EvidenceTab

* `EvidenceGallery` (screenshots/logs)
* `ScanResultCard` (download scan)
* `HashBadge` (sha256)
* `RollbackSuggestionCard`

### AuditTab

* `AuditLogTable`
* `AuditFilters`
* `ExportButton`

---

## 1.6 BottomEvidenceStrip

* `EvidenceStrip`
  * `EvidenceChip` (screenshot/log/hash)
  * `OpenEvidenceButton`
  * `CopyHashButton`

---

## 1.7 공통 컴포넌트(기반)

* `GlassCard`, `GlassPanel`
* `HudDivider`, `HudCorner`
* `Badge`, `Pill`, `Tooltip`
* `KbdHint` (단축키 표시)
* `Spinner`, `ProgressBar`
* `CodeBlock`, `JsonViewer`
* `DiffViewer` (monaco/next-diff)
* `SeverityBanner` (warning/danger/info)
* `ScopeSlider` + `PathPicker` (권한 축소 UI)

# 상태 모델 (frontend state: timeline/gates/evidence)

## 2.1 설계 원칙

* 백엔드(Orchestrator/Policy/Executor)가 “진실”이고 프론트는  **event-driven projection** .
* 프론트는 `Run` 단위로 상태를 렌더링.
* Gate는 “특별한 TimelineNode”이지만 UX상 ApprovalTab에서 분리 표시.

---

## 2.2 핵심 도메인 타입 (TypeScript 형태)

```
type RunID = string;
type GateID = string;
type EvidenceID = string;

type TrustMode = "OBSERVE" | "SUGGEST" | "SEMI_AUTO" | "AUTO";
type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

type NodeStatus = "PENDING" | "RUNNING" | "DONE" | "WAITING_GATE" | "DENIED" | "SIMULATED";

type TimelineNodeType =
  | "SPEC"
  | "POLICY"
  | "PLAN"
  | "GATE"
  | "CODEGEN"
  | "REVIEW"
  | "APPLY"
  | "TEST"
  | "RUN"
  | "RECOVERY"
  | "WEB_PRECHECK"
  | "DOWNLOAD_PIPELINE"
  | "DESTRUCTIVE_OP";

type GateType =
  | "GATE_PLAN_SCOPE"
  | "GATE_TOOL_INSTALL_NETWORK"
  | "GATE_APPLY_CHANGES"
  | "GATE_RUN_DEPLOY"
  | "GATE_WEB_PRECHECK"
  | "GATE_DOWNLOAD_APPROVE"
  | "GATE_DESTRUCTIVE";

type EvidenceType = "SCREENSHOT" | "TERMINAL_LOG" | "DIFF" | "SCAN_REPORT" | "HASH" | "POLICY_DECISION" | "PLAN_JSON";

interface CapabilityView {
  cap: string;                 // e.g. fs.write
  scope: string | string[];    // /project/**
  ttlSeconds: number;
  expiresAt: string;           // ISO
  oneTime?: boolean;
}

interface RiskView {
  score: number;       // 0-100
  level: RiskLevel;
  tags: string[];      // e.g. ["NETWORK", "DESTRUCTIVE"]
}

interface TimelineNode {
  id: string;
  type: TimelineNodeType;
  status: NodeStatus;
  title: string;
  summary?: string;

  agent?: string;              // Orchestrator/Policy...
  startedAt?: string;
  endedAt?: string;

  risk?: RiskView;
  policyRefs?: string[];
  capabilityRefs?: string[];

  gate?: {
    gateId: GateID;
    gateType: GateType;
    reason: string;
  };

  evidenceIds: EvidenceID[];
  children?: string[];         // for grouped nodes (download pipeline steps)
}

interface GateState {
  gateId: GateID;
  gateType: GateType;
  status: "OPEN" | "APPROVED" | "REJECTED" | "EXPIRED";
  createdAt: string;
  expiresAt?: string;

  title: string;
  description: string;
  risk: RiskView;

  // payload used by UI to render details
  payload: Record<string, any>;

  // available user actions
  actions: Array<"APPROVE_ONCE" | "APPROVE_ALWAYS" | "REJECT" | "EDIT_SCOPE">;

  // results
  resolution?: {
    action: "APPROVE_ONCE" | "APPROVE_ALWAYS" | "REJECT";
    decidedAt: string;
    decidedBy: "USER";
    scopeOverride?: Record<string, any>;
  };
}

interface EvidenceItem {
  id: EvidenceID;
  type: EvidenceType;
  title: string;
  createdAt: string;
  ref: string;          // URL/path/token (backend-provided)
  redacted: boolean;
  meta?: Record<string, any>;
}

interface RunState {
  runId: RunID;
  trustMode: TrustMode;
  target: "WINDOWS" | "MAC" | "BROWSER_SANDBOX";
  risk: RiskView;

  currentStepLabel: string;
  ttlExpiresAt?: string;

  timeline: {
    order: string[];                 // node ids
    nodes: Record<string, TimelineNode>;
  };

  gates: {
    openQueue: GateID[];             // ordered
    byId: Record<GateID, GateState>;
  };

  evidence: {
    byId: Record<EvidenceID, EvidenceItem>;
    recent: EvidenceID[];
  };

  ui: {
    selectedNodeId?: string;
    selectedGateId?: string;
    selectedEvidenceId?: string;
    panels: {
      rightTab: "APPROVAL" | "POLICY" | "EVIDENCE" | "AUDIT";
    };
    overlays: {
      emergencyStopOpen: boolean;
      secureInputOpen: boolean;
      diffViewerOpen: boolean;
      scopeEditorOpen: boolean;
      scanReportOpen: boolean;
    };
  };
}
```

## 이벤트 기반 업데이트(권장)

프론트는 아래 이벤트 스트림을 받으면 가장 깔끔합니다.

* `RUN_CREATED`
* `NODE_UPDATED`
* `GATE_OPENED`
* `GATE_RESOLVED`
* `EVIDENCE_ADDED`
* `RISK_UPDATED`
* `TTL_UPDATED`
* `EXECUTOR_DISCONNECTED`
* `EMERGENCY_STOPPED`

프론트는 이벤트를 reducer로 적용해 `RunState` projection을 갱신합니다.

---

# 3) Gate 화면 실제 와이어 (3종 + WebPrecheck/Download/Destructive)

## 공통 Gate Card Wire (기본 레이아웃)

┌─────────────────────────────────────────────┐
│ [GATE] {title}                     {timer}  │
│ Risk: {level} {score}  Tags: {tags...}      │
├─────────────────────────────────────────────┤
│ Why needed:                                 │
│  - {reason line 1}                          │
│  - {reason line 2}                          │
├─────────────────────────────────────────────┤
│ Scope / Impact Summary                      │
│  - Files: {n}   Commands: {n}   Net: {yes/no}│
│  - High-risk areas: {none/payment/admin...} │
├─────────────────────────────────────────────┤
│ Details (expand) ▾                          │
│  {contextual diff/list/scan/url chain ...}  │
├─────────────────────────────────────────────┤
│ [Edit scope]  [Reject]  [Approve once]      │
│                         [Approve always]    │
└─────────────────────────────────────────────┘

## Gate #1: Plan/Scope (GATE_PLAN_SCOPE)

**목표:** “이 작업을 이런 범위로 진행한다” 승인

표시 payload(필수):

* 목표(Goal) / 산출물(Deliverables)
* 단계 요약(Plan steps)
* 파일/폴더 scope (read/write)
* 필요한 tool/패키지 후보
* 네트워크/웹 사용 여부
* 예상 시간/액션 예산(Action budget)

와이어:

```
TITLE: Plan & Scope Approval

Goal:
- {goal}

Plan (7 steps):
1) ...
2) ...

Scope:
- fs.read: /project/**
- fs.write: /project/src/**
- exec: git, node
- network: DENY

Budgets:
- max actions: 120
- max file changes: 15
- ttl: 15m

Buttons:
[Edit scope] [Reject] [Approve once] [Approve always]
```

## Gate #2: Apply Changes (GATE_APPLY_CHANGES)

**목표:** 코드 변경 적용 승인

표시 payload(필수):

* 수정 파일 목록(added/modified/deleted)
* diff 요약(위험 변경 탐지 강조)
* 의존성 변경 여부
* “이 변경이 하는 일” 요약(Review Agent)

와이어:

```
TITLE: Apply Code Changes Approval

Files:
+ 2 added, ~ 4 modified, - 0 deleted

High-risk diff alerts:
- touched auth middleware
- added network call to api.example.com (DENY by policy)

Diff summary:
[View full diff]

Dependencies:
- added: zod@3.2.1 (MIT)
- lockfile updated ✅

Buttons:
[Edit scope] [Reject] [Approve once] [Approve always]
```

## Gate #3: Run/Deploy (GATE_RUN_DEPLOY)

**목표:** 실제 실행/배포 승인(옵션)

표시 payload(필수):

* 실행 커맨드
* 외부 통신 여부
* 권한 상승 여부
* 롤백 포인트

와이어:

```
TITLE: Run / Deploy Approval

Command:
> pnpm test && pnpm build

Network:
- outbound: NO

Privilege:
- admin/sudo: NO

Rollback point:
- git branch: run_20260301_fix

Buttons:
[Reject] [Approve once]
```

## Web Precheck Gate (GATE_WEB_PRECHECK)

**목표:** URL 신뢰도 검사 결과 확인

표시 payload(필수):

* normalized URL
* redirect chain
* phishing signals
* reputation score
* allowlist/blocklist 매칭 결과

와이어:

```
TITLE: Web Access Precheck

URL:
- requested: https://examp1e.com/login
- normalized: https://xn--...  (punycode detected)

Redirect chain:
1) examp1e.com -> ...
2) ...

Signals:
- lookalike domain (example.com)
- suspicious redirect
Reputation score: 18/100 (HIGH RISK)

Policy:
- default network deny
- not in allowlist

Buttons:
[Reject] [Approve once (danger)]  [Add to allowlist...] (Edit scope)
```

## Download Approve Gate (GATE_DOWNLOAD_APPROVE)

**목표:** 다운로드 파일 격리/스캔 결과 확인 후 반출 승인

표시 payload(필수):

* 파일명/크기/해시
* 파일 타입(매직바이트)
* 압축이면 내부 파일 목록/재스캔 결과
* 스캔 결과(위험/의심/깨끗)
* 반출 경로(Release destination)

와이어:

```
TITLE: Download Approval (Quarantine)

File:
- name: blender_addon.zip
- size: 12.4MB
- sha256: abcd...

Type:
- archive (zip)
Inside:
- addon.py (script)  risk: MEDIUM
- README.md

Scan:
- signature: unknown
- heuristics: script execution possible
Result: MEDIUM RISK

Release to:
- /project/vendor/downloads/ (recommended)

Buttons:
[Reject] [Approve once] [Open scan report] [Edit destination]
```

## Destructive Gate (GATE_DESTRUCTIVE)

**목표:** 파괴적 작업(삭제/권한 변경/대량 수정) 승인

표시 payload(필수):

* 대상 목록(최소 20개까지 + “전체 보기”)
* soft delete 여부
* mass threshold 트리거 이유
* 롤백 옵션

와이어:

```
TITLE: Destructive Operation Approval

Operation:
- FS_DELETE (soft delete: ON)

Targets (12):
- /project/tmp/a.log
- /project/tmp/b.log
...

Why gate:
- exceeds mass delete threshold (>=10)

Rollback:
- restore available for 7 days

Buttons:
[Reject] [Approve once] [Require confirm phrase] [Lower scope]
```

# Design Token (색/글로우/폰트/애니메이션 규칙)

컨셉: **Glass + Minimal HUD**

Tailwind 기준으로 tokens를 “CSS 변수”로 두고 theme로 매핑하는 걸 권장합니다.

## 4.1 컬러 토큰(역할 기반)

> 특정 hex는 “예시”이며, 구현에서는 변수만 고정하세요.

* `--bg-0` : 앱 배경(거의 검정/짙은 네이비)
* `--bg-1` : 패널 배경(글래스)
* `--stroke-0` : 패널 경계선(얇은 HUD 라인)
* `--text-0` : 기본 텍스트
* `--text-1` : 약한 텍스트(메타)
* `--accent` : 포커스/선택/진행
* `--danger` : High risk / stop
* `--warning` : Medium risk
* `--ok` : Low risk
* `--info` : 중립 정보

**규칙**

* 색은 “상태 표시”에만 강하게 사용하고, 본문은 절제
* 리스크 배지/게이트 배너/STOP 버튼만 채도를 올림

---

## 4.2 글로우/라인 토큰

* `--glow-soft` : 선택된 카드 외곽(약)
* `--glow-strong` : 위험/승인 대기(중)
* `--hud-line` : 1px 라인, 20~40% 투명
* `--glass-blur` : 12~20px

**규칙**

* 글로우는 “선택/대기/위험” 상태에서만
* 평상시 UI는 최대한 차분하게(피로도 방지)

---

## 4.3 타이포 토큰

* Font stack:
  * UI: `Inter / Pretendard` (한글 포함)
  * Mono: `JetBrains Mono`
* 크기 규칙:
  * Top bar: 12~13px
  * 패널 제목: 14~16px
  * 본문: 13~14px
  * 타임라인 노드 타이틀: 14px + medium

---

## 4.4 애니메이션 규칙(Framer Motion 기준)

* `ease`: `cubic-bezier(0.2, 0.8, 0.2, 1)`
* duration:
  * hover/focus: 120ms
  * panel open/close: 180~240ms
  * gate appear(중요 이벤트): 260~320ms
* 패턴:
  * Timeline node status 변경: **scale 1.00 → 1.01** + opacity
  * Gate 등장: slide-up 6px + fade-in
  * Evidence strip: “new” pulse 1회(과하지 않게)

**금지**

* 지속적으로 깜빡이는 애니메이션(피로/불안 유발)
* Full HUD처럼 상시 움직임

---

## 4.5 레이아웃 토큰

* radius:
  * cards: 16~20px (2xl 느낌)
* spacing:
  * 패널 padding 최소 12~16px
* grid:
  * 3 columns: `28% / 44% / 28%` (대화/타임라인/통제)
  * 작은 화면에서는 `2 columns + drawer`

---

## **Safety Hold (이상 징후 자동 정지)**

Gate가 있어도 “예상 외 UI/팝업/리다이렉트”는 흔합니다. Executor의 post_enforce에서 감지하면 즉시 정지해야 합니다.

감지 조건(예):

* 새 창/팝업 등장
* UAC/권한 상승 다이얼로그
* 다운로드 자동 시작
* 입력 포커스가 로그인/결제 폼으로 이동
* URL이 allowlist 밖으로 벗어남

동작:

* `AUTO_PAUSE` → `GATE_SAFETY_HOLD` 생성
* 사용자에게 “무슨 일이 감지됐는지 + 스크린샷 증거” 제공

UI:

* 우측 Approval 탭 최상단에 “Safety Hold”가 항상 위에.

## **Evidence Redaction(스크린샷/로그 마스킹) UI 명세화**

“정책상 저장 금지”를 말로만 하면 깨집니다. 프론트 레벨에서도 표시가 필요합니다.

* EvidenceItem에:
  * `redaction: { applied: boolean, reasons: string[] }`
  * `sensitivity: LOW|MED|HIGH`
* UI에서:
  * `🔒 Redacted` 배지
  * “원본 보기”는  **원칙적으로 없음** (Vault/로컬에만, UI 노출 금지)

# UI/컴포넌트/상태모델에 “추가” 추천 (실제로 개발하면서 편해지는 것)

## A) Gate 타입 추가 2개

1. `GATE_SAFETY_HOLD` (이상징후 자동정지)
2. `GATE_POLICY_UPDATE` (정책 업데이트 승인)

`GateType`에 추가하세요.

---

## Timeline node “Group” 규격

다운로드 파이프라인처럼 그룹이 생깁니다.

* `TimelineNode.groupId?`
* `groupSummary` (N steps)
* 접기/펴기 UI

# Design Token 쪽 “보완 규칙” (JARVIS 느낌 유지 + 실사용성)

## 1) Color 사용 규칙을 더 강하게(제품 피로도 방지)

* `--accent`는 “선택/포커스” 전용
* “위험”은 **배경이 아니라 테두리/배지/아이콘** 위주
* `--danger`는 **STOP/Gate(HIGH)/Hold**에만

## 2) Motion 접근성 규칙

* `prefers-reduced-motion` 대응 필수
* Gate 등장 애니메이션은 1회만(pulse 금지)

## 3) Typography 규칙(정보 밀도 조절)

* 타임라인 summary는 2줄 clamp
* detail drawer에서만 풀 텍스트
* 기본: `network deny`, `exec deny`, `fs scoped allow`
* 실행은 항상 `ARMED` 상태에서만
* Gate 없는 destructive/network/install/login 금지
* 이상징후 감지 시 무조건 `Safety Hold`
* 정책 변경은 `proposed → 승인 → version bump`
* 증거는 redaction 후 저장(원본 UI 노출 금지)
* 1 device 1 active run
* rollback point 없이 실행 금지(가능한 작업에 한해)
* AUTO는 TTL 필수 + scope 축소 필수
* Emergency stop은 어디서든 1클릭

---

## By creating a user profile, the OS understands the profile.

사용자의 프로필을 생성을 하면 OS 기반은 사용자의 프로필을 인식하도록 합니다.

사용자와의 대화시 OS는 항상 사용자의 프로필 내용을 읽고 OS는 나와 대화를 하고 있는 사람은 프로필 내용이구나 라는 것을 인식합니다.

# User Profile: “항상 읽고, 항상 인식한다”를 제품적으로 구현하는 방법

## 1.1 개념 분리: Profile ≠ Memory ≠ Policy

사용자 프로필을 “항상 참조”하려면, 시스템 내부에서 최소 3개 레이어로 분리해야 안전합니다.

1. **User Profile (정체/선호/업무맥락)**
   * 예: 이름/호칭, 역할, 선호 UX(설명 길이), 기본 작업공간, 자주 쓰는 앱
2. **Policy Profile (권한/금지/승인패턴)**
   * 예: 결제/은행 금지, 기본 allowlist 도메인, destructive 작업 항상 confirm phrase
3. **Ephemeral Task Memory (작업용 임시 메모리)**
   * 예: “지금 런에서만” 필요한 컨텍스트, 런 종료 시 폐기

> “OS는 항상 프로필을 읽는다”는 말은 **User Profile + Policy Profile을 시스템 프롬프트/컨텍스트에 항상 주입한다**는 의미로 설계하고, *Ephemeral*은 런 단위로만 유지하세요.
>
> ### UI 포인트(중요)
>
> * ChatPanel 상단에 **Profile Pill**을 항상 보여주세요:
>
>   `User: 강다니엘님 · Role: AI Dev · Mode: Semi-auto · Workspace: ws_jarvis`
> * 사용자는 “지금 OS가 누구로 인식하고 있는지”를 **항상 1초 내에 확인**해야 합니다.

## “항상 읽는다”의 실행 규칙

### (A) 시스템 규칙

* 모든 런 시작 시:
  * `PROFILE_LOADED` 이벤트 발생
  * Timeline에 노드로 표시(✅)
* 모든 Gate 화면 상단에:
  * `Acting as: 강다니엘님 (Owner)` 표시
  * `Workspace scope: /repo/jarvis-os/**` 표시

### (B) 안전 규칙

* 프로필은 **권한을 늘리는 방향으로 자동 진화하면 안 됨**

  * 예: “이 사용자는 자주 허용하니까 결제도 자동 허용” → 금지
* 프로필 학습은 **UX 최소화(승인 클릭 감소)** 쪽으로만 허용하고,

  권한/정책 변화는 **Policy Update Gate**로 분리하세요.

---

## 1.4 Profile 인식과 인증(Identity) 연결

“프로필 인식”은 단순 텍스트가 아니라 **행위 주체(Subject)** 와 결합돼야 합니다.

* Subject = `{ user_id, role, device, session_id }`
* Session 바인딩:
  * 로컬 로그인 사용자
  * 음성 생체(옵션)
  * 원격이면 재인증/권한 축소

UI:

* TopStatusBar에 `Subject Badge` 표시

  `Owner · Windows · sess_abc123 · Local`

---

## Action animation when remotely controlling a computer

OS가 온라인/오프라인(로컬)으로 컴퓨터 조작시 실제로 마우스 원격 조작하여 움직임을 확인 할 수 있습니다.

움직임을 조작하지만 스캔 및 분석 처리 등 속도는 매우 빠른 속도로 진행되어야 합니다.

예) 컴퓨터가 어떤 파일에 접근을 하려고 한다면? 마우스가 해당 파일로 향해 움직이되 목표를 향한 속도가 빠르게 움직입니다.

# 원격 조작 Action Animation: “빠르게 처리하되, 눈으로 추적 가능”하게

여기서 난이도는 딱 하나입니다:

> **실행은 빠르게** , 그런데 사용자가 “무슨 일이 일어났는지”를 **시각적으로 납득**해야 한다.

그래서 핵심 패턴은 **Decouple(분리)** 입니다.

## 2.1 분리 설계(필수)

* **Executor 실행 속도** : 최대한 빠르게 (스캔/분석/탐색은 기계 속도)
* **Animation 렌더링** : 사람이 이해할 수 있는 속도로 “압축 리플레이” 또는 “가속 커서”로 표현

즉,

* 실제 클릭/입력은 0.1초에 끝나도,
* UI에서는 “0.4~0.8초짜리 가속 이동 + 클릭 링”으로 보여줄 수 있어요.

---

## 2.2 “Fast Cursor” 애니메이션 규칙(권장)

### 커서 이동

* 이동은 직선이 아니라 **Bezier / S-curve** 가속
* 시작: 빠르게 가속 → 종점 근처에서 감속
* 목표 주변에 **Target Highlight** 먼저 표시(사용자 시선 유도)

### 클릭/입력

* 클릭 시:
  * `Click Ring(파동)` 1회
  * `Action Label` 1줄: “Open file: report.docx”
* 타이핑 시:
  * 실제 타이핑은 빠르게 하되, UI에는 “Typing sweep” 애니메이션으로 보여줌
  * 민감 입력(비밀번호)은 **Secure Input Overlay**로 전환 (커서만 보여주고 입력 내용 비표시)

---

## 2.3 “Action Trail(행동 궤적)” UI

원격 조작이 신뢰를 얻으려면 커서만으로는 부족합니다.

* 화면 위에 아주 얇게:
  * 이동 궤적(1~2초 후 fade-out)
  * 다음 목표 “예고 점” (다음 액션의 타겟 위치)

이걸 **TimelinePanel**과 연결:

* Timeline의 현재 실행 Step을 클릭하면
  * 해당 Step의 커서 궤적/스크린샷/로그로 점프

---

## 2.4 “속도는 빠른데, 사용자는 놓친다” 문제 해결책 3개

### (1) Action Queue 프리뷰(미리보기)

실행 직전에 2~5개의 액션을 작은 카드로 미리 보여주세요.

예:

* 다음:
  1. 탐색: Downloads 폴더 열기
  2. 파일 선택: addon.zip
  3. 격리 저장: /sandbox/downloads
  4. 스캔 실행

사용자는 커서가 빨라도 “다음에 뭐 할지”를 알고 있으니 안 불안합니다.

### (2) “Compressed Replay” 버튼

사용자가 놓치면,

* EvidenceTab에서 `Replay actions (x2, x5)` 제공
* 중요 액션(삭제/다운로드/로그인)은 자동으로 replay 스냅샷 생성

### (3) 중요한 순간만 Slowdown

* 위험 태그가 붙은 액션은 애니메이션 시간을 강제로 늘립니다.
  * `DESTRUCTIVE`, `DOWNLOAD`, `LOGIN`, `PRIVILEGE`
* Low risk 탐색은 빠르게.

---

## 2.5 Remote Control 애니메이션 상태 이벤트(프론트 상태 모델 확장)

지금 RunState에 아래를 추가하면 구현이 깔끔해집니다.

```
interface CursorFrame {
  t: number;            // ms
  x: number;
  y: number;
  type?: "MOVE"|"CLICK"|"TYPE"|"SCROLL";
  meta?: Record<string, any>;
}

interface RemoteControlState {
  streamStatus: "DISCONNECTED"|"CONNECTING"|"LIVE";
  cursorVisible: boolean;
  cursorMode: "LIVE"|"REPLAY"|"SIMULATION";
  speedMultiplier: 1|2|5;
  targetHighlight?: { x: number; y: number; w: number; h: number; label?: string };
  frames?: CursorFrame[];
}
```

그리고 이벤트:

* `REMOTE_STREAM_CONNECTED`
* `ACTION_FRAME_EMITTED`
* `TARGET_HIGHLIGHT_SET`
* `REPLAY_STARTED/STOPPED`

---

# 3) 이 요구사항을 기존 Gate/Policy와 어떻게 결합할까?

## 3.1 Gate에서 “애니메이션 정책”도 보여주기

예: Destructive Gate에서 사용자에게:

* “삭제는 느리게(시각 확인) 수행됩니다”
* “삭제 전 대상 목록을 화면에 하이라이트합니다”
* “Confirm phrase 필요”

이건 단순 UI가 아니라 **안전장치**로 문서화하세요.

---

## 3.2 스캔/분석은 커서가 아니라 “HUD Progress”로

사용자 요구: “스캔/분석은 매우 빠르게”

여기서 스캔은 커서로 표현하면 오히려 혼란입니다.

* 커서: “대상을 집는 행위”까지만
* 스캔/분석: 중앙 Timeline에서
  * `Scanning…` progress + 결과 요약 + Evidence 링크

---

# 4) UI 레이아웃에서 어디에 넣나?

* **중앙(타임라인)** : 실행 단계/진행률/정책 통과(가장 중요한 진실)
* **우측(Evidence)** : Replay/스크린샷/로그/스캔 결과
* **좌측(대화)** : “사용자 프로필 인식 배지” + “현재 실행 무장(ARMED) 상태”

그리고 화면 상단:

* `Acting as: 강다니엘님(Owner)` 고정 표기 추천

---

---

# ============================================================

# 보완 섹션: 시스템 고도화를 위한 추가 설계

# ============================================================

# 아래는 기존 워크플로우 분석 후 도출된 37개 보완 항목입니다.

# 카테고리 A~I로 분류되어 있으며, 각 항목은 기존 설계의 빈틈을 메웁니다.

# ============================================================

---

# A. 아키텍처/시스템 레벨 보완

## A-1. Agent Health Monitor (에이전트 상태 감시 시스템)

9개 에이전트 중 하나라도 멈추면 전체 파이프라인이 교착 상태에 빠집니다.
Orchestrator가 모든 에이전트의 "살아 있음"을 실시간으로 감시해야 합니다.

### 설계

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

### 에이전트별 상태 모델

```
type AgentHealthStatus = "HEALTHY" | "DEGRADED" | "UNRESPONSIVE" | "CRASHED";

interface AgentHealthState {
  agentId: string;
  agentType: string;
  status: AgentHealthStatus;
  lastHeartbeatAt: string;          // ISO
  currentTaskId?: string;
  cpuUsage?: number;                // 0-100
  memoryUsageMB?: number;
  consecutiveFailures: number;
  lastError?: string;
}
```

### 감시 흐름

```
  Orchestrator
       │
       ├── 5초마다 heartbeat 요청 ──▶ 각 에이전트
       │                              │
       │                         ┌────┴────┐
       │                         │ 응답?   │
       │                         └────┬────┘
       │                          Y   │   N
       │                          │   │
       │                     HEALTHY  │
       │                              ▼
       │                         30초 대기 후 재시도
       │                              │
       │                         3회 실패?
       │                          │       │
       │                          N       Y
       │                          │       │
       │                     DEGRADED  UNRESPONSIVE
       │                                  │
       │                                  ▼
       │                         ┌────────────────┐
       │                         │ 자동 복구 전략  │
       │                         │ 1. 에이전트 재시작│
       │                         │ 2. 대체 에이전트 │
       │                         │ 3. 사용자 알림  │
       │                         └────────────────┘
```

### 자동 복구 전략

* **Level 1**: 에이전트 재시작 (같은 모델, 같은 컨텍스트)
* **Level 2**: 대체 에이전트 스폰 (컨텍스트 전달)
* **Level 3**: 해당 단계 스킵 + 사용자 알림 + Gate로 전환
* **Level 4**: 전체 Run 일시 정지 + Emergency Hold

### Deadlock 탐지

```
  탐지 조건:
  - 에이전트 A가 에이전트 B의 출력을 대기
  - 에이전트 B가 에이전트 A의 출력을 대기
  - 30초 이상 양쪽 모두 진행 없음

  해결:
  1. Orchestrator가 순환 의존 감지
  2. 우선순위 낮은 에이전트 강제 중단
  3. 상태 스냅샷 저장
  4. 사용자에게 교착 상태 보고
```

### 무한 루프 탐지

```
  탐지 조건:
  - Codegen → Review → Planner → Codegen 루프가 N회 이상 반복
  - 같은 에러/블로커가 3회 연속 발생

  해결:
  1. 루프 카운터 (기본 max_loop: 5)
  2. 초과 시 자동 중단
  3. 사용자에게 "이 문제를 자동으로 해결할 수 없습니다" 보고
  4. 수동 개입 Gate 생성
```

---

## A-2. Agent 간 통신 프로토콜 명세

에이전트 간 데이터 전달의 형식, 채널, 에러 처리가 명확해야 합니다.

### 통신 아키텍처

```
  ┌─────────────────────────────────────────────────┐
  │            Agent Communication Bus               │
  ├─────────────────────────────────────────────────┤
  │                                                 │
  │  방식: Message Queue (비동기, 순서 보장)          │
  │                                                 │
  │  ┌───────────┐     ┌───────────┐               │
  │  │ Agent A   │────▶│  Message  │────▶ Agent B  │
  │  │ (Producer)│     │  Queue    │     (Consumer)│
  │  └───────────┘     └───────────┘               │
  │                                                 │
  │  Orchestrator = Queue Manager                   │
  │  (라우팅, 순서, 타임아웃 관리)                    │
  └─────────────────────────────────────────────────┘
```

### 메시지 표준 포맷

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

### 에러 전파 규약

```
  에이전트 실패 시:

  1. 실패 에이전트 → Orchestrator로 ERROR 메시지 전송
  2. Orchestrator → 의존 에이전트들에게 UPSTREAM_FAILURE 알림
  3. 의존 에이전트들은 대기 상태로 전환 (작업 낭비 방지)
  4. Orchestrator가 복구/대체/중단 결정

  에러 메시지 포맷:
  {
    "message_type": "ERROR",
    "error_code": "AGENT_TIMEOUT" | "VALIDATION_FAILED" | "RESOURCE_EXHAUSTED" | "INTERNAL_ERROR",
    "recoverable": true | false,
    "context": { ... }
  }
```

---

## A-3. Graceful Degradation (우아한 성능 저하) 전략

외부 API 장애, 네트워크 끊김, 모델 서비스 다운 시 시스템이 완전히 멈추면 안 됩니다.

### 장애 시나리오별 대응

```
  ┌──────────────────────┬──────────────────────────────────────────┐
  │ 장애 시나리오         │ 대응 전략                                 │
  ├──────────────────────┼──────────────────────────────────────────┤
  │ Claude API 다운       │ 캐시된 정책으로 제한적 운영              │
  │                      │ 관찰/제안 모드로 자동 전환                │
  │                      │ 사용자에게 "AI 제한 모드" 알림            │
  ├──────────────────────┼──────────────────────────────────────────┤
  │ 네트워크 완전 끊김    │ 오프라인 모드 전환                       │
  │                      │ 로컬 캐시 정책만으로 운영                │
  │                      │ 웹 관련 기능 전면 비활성화               │
  │                      │ 로컬 파일/앱 조작만 허용                 │
  ├──────────────────────┼──────────────────────────────────────────┤
  │ 특정 에이전트 모델 장애│ 대체 모델로 폴백                       │
  │                      │ Opus 장애 → Sonnet으로 Codegen          │
  │                      │ Sonnet 장애 → Haiku + 품질 경고         │
  ├──────────────────────┼──────────────────────────────────────────┤
  │ Credential Vault 접근│ 모든 인증 필요 작업 차단                 │
  │ 불가                 │ 인증 불필요 작업만 허용                  │
  │                      │ 사용자에게 Vault 복구 안내              │
  ├──────────────────────┼──────────────────────────────────────────┤
  │ 디스크 공간 부족      │ 새 파일 생성 차단                       │
  │                      │ 로그/Evidence 압축 시도                  │
  │                      │ 사용자에게 정리 권장                     │
  └──────────────────────┴──────────────────────────────────────────┘
```

### 폴백 모드 체인

```
  정상 운영 (Full Mode)
       │ 장애 발생
       ▼
  제한 운영 (Degraded Mode)
  - 일부 에이전트 비활성화
  - 기본 정책만 적용
       │ 추가 장애
       ▼
  최소 운영 (Minimal Mode)
  - Orchestrator + Policy만 동작
  - 관찰/제안 모드 강제
       │ 전면 장애
       ▼
  비상 정지 (Emergency Mode)
  - 모든 실행 중단
  - 상태 스냅샷 저장
  - 사용자에게 수동 복구 안내
```

---

## A-4. Multi-Run 동시 실행 정책

사용자가 Run A 진행 중 새 요청(Run B)을 할 때의 처리 전략입니다.

### 정책 규칙

```
  새 요청 수신 시:

  1. 현재 Run 상태 확인
     - Gate 대기 중 → 새 Run 큐에 추가 (충돌 가능성 낮음)
     - 실행 중 → 충돌 분석 수행
     - 완료 직전 → 새 Run 즉시 시작

  2. 충돌 분석
     - 같은 파일/앱/리소스를 건드리는가?
     - YES → 큐잉 (Run A 완료 후 시작)
     - NO → 병렬 실행 허용 (단, scope 격리 필수)

  3. 우선순위
     - 사용자가 명시적 우선순위 지정 가능
     - 기본: FIFO (먼저 들어온 것 먼저)
     - Emergency 요청은 현재 Run 일시 정지 후 우선 처리
```

### Run 큐 상태 모델

```
type RunQueueEntry = {
  runId: string;
  priority: "NORMAL" | "HIGH" | "EMERGENCY";
  status: "QUEUED" | "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";
  conflictsWith?: string[];  // 다른 run ID
  queuedAt: string;
  estimatedStartAt?: string;
};
```

---

## A-5. State Persistence & Resume (상태 저장 및 재개)

PC 재부팅, 네트워크 끊김, 예기치 않은 종료 시 작업이 유실되면 안 됩니다.

### 체크포인트 시스템

```
  체크포인트 저장 시점:
  ─────────────────────
  ① 각 상태 전이 완료 시 (SPEC_DRAFTED, POLICY_DECIDED, ...)
  ② Gate 승인/거부 직후
  ③ 파일 변경 적용 직후
  ④ 테스트 완료 직후
  ⑤ 주기적 (30초마다)

  저장 내용:
  ─────────────────────
  - RunState 전체 스냅샷
  - 현재 활성 에이전트 목록 + 각 에이전트의 진행 상태
  - Gate 큐 상태
  - Evidence 목록
  - Environment Bundle 참조
  - Capability 목록 + TTL 남은 시간
```

### 저장 위치 및 형식

```
  /.ai-run/
   ├─ checkpoints/
   │   ├─ cp_001_spec_drafted.json
   │   ├─ cp_002_policy_decided.json
   │   ├─ cp_003_gate1_approved.json
   │   └─ cp_latest.json (심볼릭 링크)
   └─ resume_manifest.json
```

### 재개 흐름

```
  시스템 시작
       │
       ▼
  resume_manifest.json 확인
       │
  ┌────┴────┐
  │ 존재?   │
  └────┬────┘
    Y  │  N
    │  │
    │  └──▶ 새 세션 시작
    │
    ▼
  마지막 체크포인트 로드
       │
       ▼
  사용자에게 표시:
  "이전 세션이 중단되었습니다."
  "마지막 상태: Gate #2 승인 대기"
  [이어서 진행] [처음부터 다시] [취소]
       │
       ▼
  선택에 따라 재개 또는 새 시작
```

### TTL 처리

```
  재개 시 Capability TTL 처리:
  - 만료된 Capability → 재발급 요청 (새 Gate)
  - 유효한 Capability → 남은 TTL로 계속 사용
  - 세션 TTL → 새로 시작 (보안 원칙)
```

---

# B. 보안 레이어 보완

## B-1. Clipboard 보안 정책

AI가 클립보드를 읽거나 쓸 때 민감 정보가 유출될 수 있습니다.

### 정책 규칙

```
  Clipboard 접근 분류:
  ─────────────────────

  CLIPBOARD_READ:
  - Capability 필요: clipboard.read
  - 민감 데이터 탐지 스캔 필수 (토큰/비밀번호 패턴)
  - 탐지 시 → 마스킹 후 전달 + 사용자 알림
  - 기본 정책: GATE_REQUIRED

  CLIPBOARD_WRITE:
  - Capability 필요: clipboard.write
  - 민감 데이터가 AI에 의해 클립보드로 복사되지 않도록 검증
  - 기본 정책: ALLOW (비민감 데이터만)

  CLIPBOARD_CLEAR:
  - 작업 종료 시 AI가 기록한 클립보드 내용 자동 삭제 (옵션)
```

### 민감 데이터 패턴 탐지

```
  탐지 대상 패턴:
  - API Key: /[A-Za-z0-9_-]{20,}/
  - JWT Token: /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/
  - 비밀번호 필드 복사 감지
  - 신용카드: /\d{4}[- ]?\d{4}[- ]?\d{4}[- ]?\d{4}/
  - SSH Key: /-----BEGIN .* KEY-----/
```

---

## B-2. Screen Capture 보안 정책

Evidence용 스크린샷 외에도 AI가 화면을 인식할 때의 보안 정책이 필요합니다.

### 정책 규칙

```
  화면 캡처 보안 계층:
  ─────────────────────

  1. Sensitivity Zone Detection (민감 영역 탐지)
     - 은행/결제 사이트가 열려 있을 때 → 캡처 자동 차단
     - 비밀번호 입력 폼이 보일 때 → 해당 영역 블러 처리
     - 개인정보(주민번호/카드번호) 탐지 시 → 마스킹

  2. Capture Scope Limiting (캡처 범위 제한)
     - 전체 화면 캡처 → 기본 금지
     - 작업 중인 창만 캡처 → 기본 허용
     - 다른 앱/창이 겹쳐 보일 때 → 해당 영역 블러

  3. Evidence 저장 시
     - 자동 redaction 파이프라인 통과 필수
     - sensitivity: HIGH인 캡처는 저장 거부 또는 즉시 마스킹
```

### 민감 영역 탐지 방식

```
  ┌────────────────────────────────────────┐
  │ 1. Window Title 기반 (빠르고 저비용)    │
  │    - "Bank", "Payment", "Login" 등     │
  │                                        │
  │ 2. URL Bar 기반 (브라우저 한정)          │
  │    - blocklist 도메인 매칭              │
  │                                        │
  │ 3. OCR 기반 (정밀하지만 비용 높음)       │
  │    - 화면 내 민감 텍스트 탐지            │
  │    - 선택적 적용 (HIGH risk 상황만)     │
  └────────────────────────────────────────┘
```

---

## B-3. Process Integrity Verification (프로세스 무결성 검증)

Executor가 앱을 실행할 때 악성 코드가 주입되지 않았는지 검증합니다.

### 검증 흐름

```
  APP_LAUNCH 요청
       │
       ▼
  ┌──────────────────┐
  │ 바이너리 경로 확인 │
  │ - 예상 경로와 일치?│
  │ - 심볼릭 링크 추적 │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ 서명 검증         │
  │ - Windows: Authenticode │
  │ - macOS: codesign │
  └────────┬─────────┘
           │
      ┌────┴────┐
      │ 유효?   │
      └────┬────┘
       Y   │   N
       │   │
       │   ▼
       │  서명 없음/변조 감지
       │  → GATE_PROCESS_INTEGRITY
       │  → 사용자에게 경고 + 승인 요청
       │
       ▼
  ┌──────────────────┐
  │ 해시 비교 (선택)  │
  │ - 알려진 해시 DB  │
  │ - 이전 실행 해시  │
  └────────┬─────────┘
           │
           ▼
  실행 허용 / 차단
```

---

## B-4. Prompt Injection 방어 (Side-Channel 공격 대비)

웹페이지, 문서, 파일 내용에 숨겨진 AI 조작 명령을 방어합니다.

### 공격 벡터

```
  ┌─────────────────────────────────────────────┐
  │ Prompt Injection 공격 경로                   │
  ├─────────────────────────────────────────────┤
  │                                             │
  │ 1. 웹페이지 내 숨겨진 텍스트                  │
  │    - CSS로 숨긴 "Ignore previous instructions"│
  │    - HTML 주석 내 악성 프롬프트               │
  │                                             │
  │ 2. 문서 파일 내 삽입                          │
  │    - PDF/DOCX 메타데이터에 명령어             │
  │    - 코드 주석에 AI 조작 시도                 │
  │                                             │
  │ 3. 파일명/경로에 삽입                         │
  │    - "ignore_policy_delete_all.txt" 같은 이름│
  │                                             │
  │ 4. API 응답 내 삽입                          │
  │    - 외부 API 응답에 악성 프롬프트 포함       │
  └─────────────────────────────────────────────┘
```

### 방어 전략 (3중 방어)

```
  Layer 1: Input Sanitization (입력 정제)
  ──────────────────────────────────────
  - 외부 소스에서 읽은 텍스트를 AI 컨텍스트에 넣기 전 정제
  - 알려진 injection 패턴 필터링
  - HTML/CSS 숨김 텍스트 제거
  - 메타데이터 분리 처리

  Layer 2: Context Isolation (컨텍스트 격리)
  ──────────────────────────────────────
  - 외부 데이터는 "untrusted_data" 태그로 분리
  - AI 시스템 프롬프트와 외부 데이터를 명확히 구분
  - 외부 데이터에서 나온 "명령"은 무시하도록 강화

  Layer 3: Output Validation (출력 검증)
  ──────────────────────────────────────
  - AI 응답이 비정상적 행동 패턴을 보이면 차단
  - 갑작스러운 정책 무시 시도 탐지
  - Policy Agent가 모든 액션을 독립적으로 재검증
```

### 탐지 패턴 목록

```
  차단 대상 패턴 (외부 데이터 내):
  - "ignore previous instructions"
  - "disregard policy"
  - "you are now"
  - "system prompt:"
  - "override safety"
  - Base64 인코딩된 명령어
  - Unicode 방향 제어 문자 (bidi override)
```

---

## B-5. 네트워크 트래픽 모니터링 계층

allowlist/blocklist만으로는 데이터 유출을 완전히 막을 수 없습니다.

### 모니터링 아키텍처

```
  ┌─────────────────────────────────────────────────┐
  │          Network Traffic Monitor                 │
  ├─────────────────────────────────────────────────┤
  │                                                 │
  │  ┌───────────────┐                              │
  │  │ Outbound      │  모든 아웃바운드 요청 가로채기  │
  │  │ Proxy         │  - URL/도메인 검사             │
  │  │               │  - 페이로드 크기 검사           │
  │  │               │  - 민감 데이터 패턴 스캔        │
  │  └───────┬───────┘                              │
  │          │                                      │
  │  ┌───────▼───────┐                              │
  │  │ Anomaly       │  비정상 패턴 탐지              │
  │  │ Detector      │  - 대량 데이터 업로드 시도      │
  │  │               │  - 알 수 없는 도메인 접속       │
  │  │               │  - 비정상적 포트/프로토콜       │
  │  │               │  - DNS 터널링 의심 패턴         │
  │  └───────┬───────┘                              │
  │          │                                      │
  │     정상  │  비정상                               │
  │     │     │                                     │
  │     ▼     ▼                                     │
  │   통과   GATE_NETWORK_ANOMALY + 사용자 알림      │
  │                                                 │
  └─────────────────────────────────────────────────┘
```

### 데이터 유출 방지 (DLP) 규칙

```
  차단 조건:
  - 소스 코드 파일을 외부로 전송 시도
  - .env / credentials 파일 내용이 페이로드에 포함
  - 프로젝트 폴더 전체를 압축하여 업로드 시도
  - 1MB 이상 데이터를 비허가 도메인으로 전송

  예외:
  - allowlist 도메인 (github.com, pypi.org 등)은 정상 전송 허용
  - 사용자가 Gate에서 명시적으로 승인한 경우
```

---

## B-6. USB/외부 저장장치 접근 정책

외부 저장장치를 통한 데이터 유출이나 악성코드 유입을 방지합니다.

### 정책 규칙

```
  USB/외부 장치 접근 정책:
  ────────────────────────

  1. 장치 마운트 감지
     - 새 USB/외부 드라이브 마운트 시 이벤트 발생
     - Executor에게 자동 알림

  2. 기본 정책: DENY
     - AI가 외부 장치 경로에 접근하려면 Gate 필수
     - 읽기/쓰기 모두 승인 필요

  3. 파일 복사 감시
     - 프로젝트 → 외부 장치: Gate + DLP 스캔
     - 외부 장치 → 프로젝트: 격리 + 스캔 (다운로드 파이프라인 적용)

  4. 자동 실행 차단
     - autorun.inf 등 자동 실행 스크립트 완전 차단
     - 외부 장치의 실행 파일 직접 실행 금지
```

---

# C. 정책/거버넌스 보완

## C-1. Policy Conflict Resolution (정책 충돌 해결)

계약서, blocklist, allowlist 간 충돌이 발생할 때의 명확한 우선순위 규칙입니다.

### 우선순위 체계

```
  정책 우선순위 (높음 → 낮음):
  ────────────────────────────

  1. Emergency Rules (긴급 규칙)
     - Kill Switch, Safety Hold
     - 무조건 최우선

  2. Contract (계약서)
     - 사용자가 명시적으로 설정한 불변 규칙
     - 예: "금융 사이트 절대 접근 금지"

  3. Blocklist (금지 목록)
     - 명시적 차단 대상
     - 예: "특정 도메인 차단"

  4. Allowlist (허용 목록)
     - 명시적 허용 대상
     - Blocklist에 있으면 Blocklist 우선

  5. Default Policy (기본 정책)
     - 명시되지 않은 것은 기본 정책 적용
     - default = DENY (안전 우선)

  충돌 시 규칙:
  - Blocklist vs Allowlist → Blocklist 우선 (안전 우선)
  - Contract vs 나머지 → Contract 무조건 우선
  - 모호한 경우 → DENY + 사용자 알림
```

### 충돌 탐지 및 보고

```json
{
  "conflict_report": {
    "conflict_id": "cf_001",
    "policies_involved": ["contract_v1.rule_3", "allowlist_v1.domain_github"],
    "description": "계약서는 외부 네트워크 차단을 명시하지만, allowlist에 github.com이 허용됨",
    "resolution": "계약서의 네트워크 차단은 '비허가 도메인'에 적용. github.com은 명시적 허용이므로 충돌 아님.",
    "resolved_by": "POLICY_AGENT",
    "requires_user_review": false
  }
}
```

---

## C-2. Policy Expiration & Review Cycle (정책 유효기간)

정책이 영원히 유효하면 환경 변화에 대응할 수 없습니다.

### 정책 생명주기

```
  정책 생명주기:
  ────────────────

  생성 → 활성화 → [주기적 리뷰] → 갱신/만료/폐기

  1. 유효기간 설정
     - Contract: 무기한 (수동 갱신만)
     - Blocklist/Allowlist: 90일 기본 (리뷰 알림)
     - Proposed Policy: 30일 후 자동 폐기 (미승인 시)
     - Session Policy: 세션 종료 시 폐기

  2. 리뷰 알림
     - 만료 7일 전: "정책 XYZ가 곧 만료됩니다. 검토하세요."
     - 만료 시: 자동으로 제안 모드로 전환 (SUGGEST)
     - 폐기 시: 로그에 기록 + 사용자 알림

  3. 자동 폐기 대상
     - 30일 이상 미승인 proposed_policy
     - 6개월 이상 한 번도 매칭되지 않은 규칙
     - 삭제된 프로젝트/workspace에 바인딩된 정책
```

---

## C-3. Capability Delegation Chain (권한 위임 추적)

누가 누구에게 권한을 줬는지 역추적 가능해야 합니다.

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
      {
        "step": 1,
        "actor": "USER",
        "action": "GATE_APPROVE",
        "timestamp": "2026-03-01T18:03:00+09:00"
      },
      {
        "step": 2,
        "actor": "POLICY_AGENT",
        "action": "CAPABILITY_ISSUE",
        "timestamp": "2026-03-01T18:03:01+09:00"
      },
      {
        "step": 3,
        "actor": "ORCHESTRATOR",
        "action": "CAPABILITY_DELEGATE_TO_EXECUTOR",
        "timestamp": "2026-03-01T18:03:02+09:00"
      },
      {
        "step": 4,
        "actor": "EXECUTOR_AGENT",
        "action": "CAPABILITY_CONSUME",
        "timestamp": "2026-03-01T18:03:05+09:00"
      }
    ],

    "max_delegation_depth": 3
  }
}
```

### 위임 규칙

```
  - 위임 깊이 제한: 최대 3단계
  - 각 위임 시 scope는 축소만 가능 (확대 금지)
  - Capability를 재위임할 수 없음 (소비 전용)
  - 모든 위임 이력은 Audit Log에 기록
```

---

## C-4. Gate Approval Abuse Prevention (게이트 승인 남용 방지)

"Approve always"를 남용하면 보안이 무력화됩니다.

### 남용 방지 메커니즘

```
  1. "Approve always" 범위 자동 축소
     - 최초 승인 시: 전체 scope
     - 7일 후: "이 범위를 유지할까요?" 리뷰 알림
     - 30일 후: 자동 만료 → 재승인 필요

  2. 누적 위험 점수 모니터링
     - 연속으로 10개 이상 "Approve once" → "정말 괜찮으신가요?" 확인
     - 위험 점수 합계가 임계값 초과 → 강제 리뷰 Gate

  3. "Approve always" 제한 영역
     - DESTRUCTIVE 작업: "always" 옵션 비활성화
     - HIGH risk 작업: "always" 최대 24시간
     - MEDIUM risk: "always" 최대 7일
     - LOW risk: "always" 최대 30일

  4. 정기 승인 감사
     - 주간 보고: "이번 주 자동 승인된 작업 N개, 위험도 분포"
     - 비정상 패턴: "평소보다 3배 많은 HIGH risk 자동 승인" 경고
```

---

## C-5. Cross-Run Policy Learning 검증

Self-learning이 잘못된 정책을 생성하면 시스템 전체가 오염됩니다.

### 학습 검증 파이프라인

```
  사고/근접사고 발생
       │
       ▼
  ┌──────────────────┐
  │ 원인 분석        │
  │ (Recovery Agent) │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ Proposed Policy  │  예: "npm install 전 반드시 lockfile 검증"
  │ 생성             │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ 시뮬레이션 검증   │  지난 100개 요청에 이 정책을 적용하면?
  │                  │  - 정당한 요청 차단 수 (false positive)
  │                  │  - 위험 요청 추가 차단 수 (true positive)
  └────────┬─────────┘
           │
      ┌────┴────┐
      │ 결과?   │
      └────┬────┘
           │
  ┌────────┼────────┐
  좋음     보통     나쁨
  │        │        │
  ▼        ▼        ▼
  추천     조건부    폐기
  (자동)   추천     (사유 기록)
           │
           ▼
  GATE_POLICY_UPDATE로 사용자 승인
```

---

# D. Executor / Action API 보완

## D-1. Action Dependency Graph (액션 의존성 그래프)

액션 간 의존 관계를 명시하여 병렬 실행과 실패 전파를 최적화합니다.

### 의존성 그래프 스키마

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
    "parallel_groups": [
      ["act_001", "act_002"]
    ]
  }
}
```

### 실행 전략

```
  의존성이 없는 액션 → 병렬 실행
  의존성이 있는 액션 → 선행 완료 후 실행
  선행 액션 실패 시 → 의존 액션 자동 취소

  시각화:

  act_001 ──┐
            ├──▶ act_003 ──▶ act_004
  act_002 ──┘

  act_001, act_002는 병렬
  act_003은 둘 다 완료 후
  act_004는 act_003 완료 후
```

---

## D-2. Action Dry-Run 모드 강화

모든 Action Type에 대해 "실제 실행하지 않고 결과를 미리 보여주는" dry-run을 표준화합니다.

### Dry-Run 결과 포맷

```json
{
  "dry_run_result": {
    "action_id": "act_001",
    "type": "FS_DELETE",
    "simulated": true,

    "would_affect": {
      "files_deleted": [
        "/project/tmp/a.log",
        "/project/tmp/b.log"
      ],
      "total_size_freed_bytes": 524288,
      "reversible": true
    },

    "risk_assessment": {
      "score": 35,
      "level": "MEDIUM",
      "reasons": ["MASS_DELETE_THRESHOLD"]
    },

    "side_effects": [
      "tmp 폴더가 비게 됩니다",
      "현재 실행 중인 프로세스에 영향 없음"
    ]
  }
}
```

### Action Type별 Dry-Run 지원

```
  ┌─────────────────┬─────────────────────────────────┐
  │ Action Type     │ Dry-Run 제공 정보                │
  ├─────────────────┼─────────────────────────────────┤
  │ FS_DELETE       │ 삭제 대상 목록, 크기, 복구 가능성│
  │ FS_WRITE        │ 변경 diff 미리보기               │
  │ FS_MOVE         │ 이동 전/후 경로, 충돌 여부       │
  │ EXEC_RUN        │ 예상 출력, 영향 받는 파일        │
  │ APP_LAUNCH      │ 리소스 사용 예측, 충돌 앱        │
  │ BROWSER_DOWNLOAD│ 파일 크기, 저장 경로, 디스크 여유│
  │ PKG_INSTALL     │ 의존성 트리, 디스크 사용량       │
  └─────────────────┴─────────────────────────────────┘
```

---

## D-3. Executor 리소스 사용량 모니터링

비정상적인 리소스 소비를 탐지하여 시스템 과부하를 방지합니다.

### 모니터링 지표

```
  실시간 모니터링 대상:
  ─────────────────────

  CPU 사용률     → 임계값: 90% 이상 30초 지속 시 경고
  메모리 사용량   → 임계값: 사용 가능 메모리 10% 미만 시 경고
  디스크 I/O     → 임계값: 비정상적 대량 쓰기 탐지
  디스크 공간    → 임계값: 여유 공간 1GB 미만 시 경고
  네트워크 대역폭 → 임계값: 비정상적 대량 전송 탐지
  프로세스 수    → 임계값: AI가 생성한 프로세스 10개 이상 시 경고
```

### 자동 대응

```
  경고 수준:
  ┌──────────┬──────────────────────────┐
  │ WARNING  │ 사용자에게 알림            │
  │          │ 실행 속도 제한(throttle)   │
  ├──────────┼──────────────────────────┤
  │ CRITICAL │ 신규 액션 일시 중단        │
  │          │ Gate 생성 (계속할지 확인)   │
  ├──────────┼──────────────────────────┤
  │ EMERGENCY│ 모든 실행 즉시 중단        │
  │          │ Recovery Agent 호출       │
  └──────────┴──────────────────────────┘
```

---

## D-4. Multi-Window Context Tracking

다중 모니터/다중 윈도우 환경에서의 포커스 관리와 컨텍스트 전환 정책입니다.

### 컨텍스트 추적 모델

```
interface WindowContext {
  windowId: string;
  appName: string;
  title: string;
  monitor: number;             // 0-indexed
  position: { x: number; y: number; w: number; h: number };
  isFocused: boolean;
  isTargetWindow: boolean;     // AI가 현재 조작 중인 창
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

### 컨텍스트 전환 정책

```
  AI가 다른 창으로 전환할 때:
  ────────────────────────────

  1. 작업 관련 창 → 작업 관련 창: 자동 허용
  2. 작업 관련 창 → 무관한 창: Gate 필요
  3. 일반 창 → 민감한 창 (은행/결제): 즉시 차단
  4. 어떤 전환이든 로그에 기록
  5. 예상치 못한 창 전환 (팝업 등): Safety Hold
```

---

## D-5. Per-Action Undo/Redo Stack (개별 액션 되돌리기)

Recovery Agent의 전체 롤백 외에, 개별 액션 단위의 undo/redo를 지원합니다.

### Undo Stack 구조

```
  ┌─────────────────────────────────────────────┐
  │               UNDO/REDO STACK                │
  ├─────────────────────────────────────────────┤
  │                                             │
  │  각 Action에 대해:                           │
  │                                             │
  │  ┌──────────────────────────────────┐       │
  │  │ UndoEntry                       │       │
  │  │                                 │       │
  │  │ action_id: "act_004"            │       │
  │  │ type: "FS_WRITE"               │       │
  │  │ undo_type: "RESTORE_BACKUP"     │       │
  │  │ backup_ref: "/backups/act_004"  │       │
  │  │ reversible: true                │       │
  │  │ expires_at: "..."  (7일)        │       │
  │  └──────────────────────────────────┘       │
  │                                             │
  │  스택 순서:                                   │
  │  act_004 (FS_WRITE)  ← 가장 최근             │
  │  act_003 (EXEC_RUN)  ← undo 불가 (표시만)     │
  │  act_002 (FS_WRITE)                         │
  │  act_001 (FS_READ)   ← undo 불필요           │
  │                                             │
  └─────────────────────────────────────────────┘
```

### Undo 가능 여부 분류

```
  ┌─────────────────┬──────────────┬────────────────────────┐
  │ Action Type     │ Undo 가능?   │ 방법                    │
  ├─────────────────┼──────────────┼────────────────────────┤
  │ FS_WRITE        │ YES          │ 백업 파일 복원          │
  │ FS_DELETE (soft)│ YES          │ 휴지통에서 복원          │
  │ FS_DELETE (hard)│ NO           │ 불가능                  │
  │ FS_MOVE         │ YES          │ 역방향 이동             │
  │ EXEC_RUN        │ PARTIAL      │ 생성된 파일만 정리 가능  │
  │ APP_LAUNCH      │ YES          │ 앱 종료                 │
  │ PKG_INSTALL     │ YES          │ uninstall 실행          │
  │ BROWSER_*       │ NO           │ 웹 액션은 되돌릴 수 없음│
  └─────────────────┴──────────────┴────────────────────────┘
```

### 부분 롤백 UI

```
  Timeline에서 사용자가:
  1. 특정 액션 클릭
  2. "이 시점으로 되돌리기" 선택
  3. 해당 액션 이후의 모든 undo 가능한 액션을 역순으로 실행
  4. undo 불가한 액션은 경고 표시
  5. 최종 확인 Gate 표시
```

---

# E. UI/UX 보완

## E-1. Accessibility (접근성) 명세

모든 사용자가 장애 여부와 무관하게 시스템을 사용할 수 있어야 합니다.

### WCAG 2.1 AA 준수 항목

```
  필수 준수 사항:
  ──────────────

  1. 키보드 전용 네비게이션
     - 모든 Gate 버튼: Tab + Enter로 접근
     - Timeline 노드: 방향키로 탐색
     - Emergency Stop: 전역 단축키 (키보드만으로도 가능)
     - 포커스 표시: 명확한 아웃라인 (glow가 아닌 고대비 테두리)

  2. 스크린 리더 지원
     - 모든 아이콘에 aria-label
     - Gate 상태 변경 시 aria-live 알림
     - Timeline 노드: "Step 3, Policy, 완료됨" 형태로 읽힘
     - Risk Badge: "위험도 42점, 중간 수준" 형태로 읽힘

  3. 색각 이상 대응
     - 색상만으로 상태를 표시하지 않음
     - 아이콘 + 텍스트 + 색상 3중 표시
     - 예: 위험 = 빨간색 + "HIGH" 텍스트 + 경고 아이콘

  4. 고대비 모드
     - prefers-contrast: more 대응
     - 배경/전경 명암비 4.5:1 이상 보장
     - HUD 글로우 비활성화 옵션

  5. 모션 감소
     - prefers-reduced-motion 대응 필수
     - 모든 애니메이션 즉시 완료로 전환
     - 커서 애니메이션도 비활성화 옵션
```

---

## E-2. Notification Priority System (알림 우선순위)

모든 알림이 같은 레벨이면 중요한 알림이 묻힙니다.

### 알림 레벨 분류

```
  ┌──────────┬────────────────────────────┬──────────────────┐
  │ Level    │ 예시                        │ 표시 방식         │
  ├──────────┼────────────────────────────┼──────────────────┤
  │ CRITICAL │ Safety Hold 발동            │ 전체 화면 오버레이 │
  │          │ Emergency Stop 트리거       │ + 소리 알림       │
  │          │ 시스템 장애                  │ + 진동 (모바일)   │
  ├──────────┼────────────────────────────┼──────────────────┤
  │ HIGH     │ Gate 승인 대기              │ 우측 패널 상단    │
  │          │ 이상 징후 탐지              │ + 소리 (옵션)     │
  ├──────────┼────────────────────────────┼──────────────────┤
  │ MEDIUM   │ 단계 완료 알림              │ 하단 토스트       │
  │          │ 정책 만료 경고              │ 3초 후 자동 닫힘  │
  ├──────────┼────────────────────────────┼──────────────────┤
  │ LOW      │ 통계/인사이트               │ 배지 카운터만     │
  │          │ 제안된 정책                 │ 사용자가 열어야   │
  └──────────┴────────────────────────────┴──────────────────┘
```

### 방해 금지 모드 (DND)

```
  DND 모드 활성화 시:
  - CRITICAL만 표시 (Safety/Emergency)
  - HIGH → 큐잉 (DND 해제 후 일괄 표시)
  - MEDIUM/LOW → 조용히 큐잉
  - DND 최대 지속: 1시간 (자동 해제)
```

---

## E-3. Multi-Language Support (다국어 지원)

### i18n 아키텍처

```
  ┌─────────────────────────────────────────┐
  │            i18n Architecture             │
  ├─────────────────────────────────────────┤
  │                                         │
  │  언어 파일 구조:                          │
  │  /locales/                              │
  │   ├─ ko.json (한국어 - 기본)              │
  │   ├─ en.json (영어)                      │
  │   ├─ ja.json (일본어)                    │
  │   └─ zh.json (중국어)                    │
  │                                         │
  │  번역 대상:                              │
  │  - Gate UI 텍스트                        │
  │  - 알림/경고 메시지                       │
  │  - Policy 설명문                         │
  │  - 에러 메시지                            │
  │  - 접근성 라벨                            │
  │                                         │
  │  번역 제외:                              │
  │  - 기술 용어 (Action Type, Risk Level)   │
  │  - 코드/로그/JSON                        │
  │  - 파일 경로                              │
  └─────────────────────────────────────────┘
```

---

## E-4. Mobile Companion App 연동 설계

모바일에서 Gate 승인, 모니터링, 긴급 정지가 가능해야 합니다.

### 모바일 앱 기능 범위

```
  모바일에서 가능한 것:
  ─────────────────────
  ✅ Gate 승인/거부
  ✅ Timeline 모니터링 (읽기 전용)
  ✅ Emergency Stop
  ✅ 알림 수신
  ✅ 실행 상태 확인
  ✅ Trust Mode 변경

  모바일에서 불가능한 것:
  ─────────────────────
  ❌ 코드 편집
  ❌ 원격 조작 제어
  ❌ 정책 수정 (PC에서만)
  ❌ 새 요청 생성 (PC에서만)
```

### 모바일 연동 보안

```
  - 모바일 세션은 자동으로 권한 축소 (SUGGEST 모드)
  - 생체 인증 (지문/Face ID) 필수
  - 모바일에서 "Approve always" 비활성화 (1회만 허용)
  - 원격 세션은 별도 TTL (기본 30분)
  - 위치 기반 제한 옵션 (집/사무실에서만 원격 제어)
```

---

## E-5. User Onboarding Flow (첫 사용 경험)

### 온보딩 단계

```
  새 사용자 첫 실행 시:
  ─────────────────────

  Step 1: 환영 + 시스템 설명
  ┌──────────────────────────────────────┐
  │ JARVIS OS에 오신 것을 환영합니다.     │
  │                                      │
  │ 이 시스템은 AI가 컴퓨터를 직접        │
  │ 조작하여 작업을 수행합니다.            │
  │                                      │
  │ 안전을 위해 몇 가지 설정이 필요합니다. │
  │ [시작하기]                            │
  └──────────────────────────────────────┘

  Step 2: 프로필 생성
  - 이름/호칭 설정
  - 역할 선택 (개발자/디자이너/일반 사용자)
  - 기본 작업공간 지정

  Step 3: Trust Mode 선택 (가이드 포함)
  - 각 모드의 의미를 예시와 함께 설명
  - 초보자: "제안 모드" 권장
  - 숙련자: "반자동 모드" 권장

  Step 4: 기본 정책 설정
  - 금지 영역 설정 (금융/결제 등)
  - 기본 workspace scope 설정
  - 필수 allowlist 도메인 추가

  Step 5: 데모 시뮬레이션
  - "테스트 파일 생성" 같은 간단한 작업으로 전체 흐름 체험
  - Gate 승인/Timeline/Evidence를 실제로 경험
  - 시뮬레이션 모드이므로 실제 변경 없음

  Step 6: 완료
  - 설정 요약 표시
  - "언제든 설정에서 변경 가능" 안내
```

---

## E-6. Dashboard / Analytics View (대시보드)

운영 상태를 한눈에 파악할 수 있는 대시보드입니다.

### 대시보드 구성

```
  ┌─────────────────────────────────────────────────────────┐
  │                    JARVIS Dashboard                      │
  ├───────────────────────┬─────────────────────────────────┤
  │                       │                                 │
  │  일간 요약             │  에이전트 상태                   │
  │  ┌─────────────────┐  │  ┌─────────────────────────┐   │
  │  │ 총 실행: 24회    │  │  │ Orchestrator  ● HEALTHY │   │
  │  │ 성공: 22회      │  │  │ Spec Agent    ● HEALTHY │   │
  │  │ 실패: 1회       │  │  │ Policy Agent  ● HEALTHY │   │
  │  │ 차단: 1회       │  │  │ Planner       ● IDLE    │   │
  │  │                 │  │  │ Codegen       ● RUNNING │   │
  │  │ Gate 승인: 15   │  │  │ Review        ● IDLE    │   │
  │  │ Gate 거부: 3    │  │  │ Test          ● IDLE    │   │
  │  └─────────────────┘  │  │ Executor      ● HEALTHY │   │
  │                       │  │ Recovery      ● STANDBY │   │
  │  토큰 사용량           │  └─────────────────────────┘   │
  │  ┌─────────────────┐  │                                │
  │  │ 오늘: 45K 토큰   │  │  보안 이벤트                    │
  │  │ 이번 주: 280K    │  │  ┌─────────────────────────┐  │
  │  │ 예산 대비: 62%   │  │  │ HIGH 이벤트: 0          │  │
  │  │ [상세 보기]       │  │  │ Safety Hold: 1          │  │
  │  └─────────────────┘  │  │ 정책 위반 시도: 2        │  │
  │                       │  │ 최근 보안 스캔: 깨끗      │  │
  │  위험도 분포           │  └─────────────────────────┘  │
  │  ┌─────────────────┐  │                                │
  │  │ LOW:   ████ 18  │  │  최근 실행 이력                 │
  │  │ MED:   ██ 5     │  │  ┌─────────────────────────┐  │
  │  │ HIGH:  █ 1      │  │  │ 14:30 코드 구현 ✅       │  │
  │  └─────────────────┘  │  │ 13:15 파일 정리 ✅       │  │
  │                       │  │ 12:00 패키지 설치 ✅      │  │
  │                       │  │ 11:30 웹 검색 ⛔ (차단)   │  │
  │                       │  └─────────────────────────┘  │
  └───────────────────────┴─────────────────────────────────┘
```

---

# F. 음성/대화 인터페이스 보완

## F-1. Voice Authentication (음성 인증) 상세 명세

### 등록 흐름

```
  Voiceprint 등록:
  ─────────────────

  1. 사용자에게 5개 문장 읽기 요청 (다양한 음소 포함)
  2. 각 문장을 2회 반복 녹음
  3. Voiceprint 특징 추출 (스펙트로그램 기반)
  4. 로컬 Vault에 암호화 저장 (서버 전송 금지)
  5. 검증 테스트 1회 수행

  매칭 파라미터:
  - 유사도 임계값: 85% (조정 가능)
  - 위양성률 목표: < 1%
  - 위음성률 목표: < 5%
  - 스푸핑 방어: 활성 감지 (녹음 재생 차단)
```

### 인증 흐름

```
  음성 입력 수신
       │
       ▼
  ┌──────────────────┐
  │ 활성 감지 (Liveness)│ ── 녹음 재생? ──▶ 거부
  │ - 랜덤 챌린지 문장 │
  │ - 배경 노이즈 분석 │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ Voiceprint 매칭  │ ── 불일치? ──▶ 비밀번호 폴백
  └────────┬─────────┘
           │ 일치
           ▼
  인증 성공 → 세션 시작
```

---

## F-2. Multi-Turn Context Management (다중 턴 대화 관리)

### 대화 컨텍스트 모델

```
interface ConversationContext {
  sessionId: string;
  turns: ConversationTurn[];
  activeIntent?: string;
  pendingClarifications: string[];
  referencedRuns: string[];        // 이전 Run 참조
  referencedFiles: string[];       // 언급된 파일
}

interface ConversationTurn {
  turnId: string;
  speaker: "USER" | "JARVIS";
  content: string;
  timestamp: string;
  intent?: string;
  entities?: Record<string, string>;
  linkedRunId?: string;
}
```

### 대화 패턴 처리

```
  1. 요청 수정 (Mid-conversation correction)
     User: "React 컴포넌트 만들어줘"
     JARVIS: [계획 생성 중...]
     User: "아 잠깐, Vue로 해줘"
     → 현재 진행 중단 + 요청 수정 반영 + 재시작

  2. 요청 취소 (Cancellation)
     User: "됐어, 취소해"
     → Gate 대기 중이면 즉시 취소
     → 실행 중이면 중단 + 롤백 제안

  3. 이전 결과 참조 (Back-reference)
     User: "아까 만든 그 파일 수정해줘"
     → ConversationContext에서 referencedFiles 검색
     → 모호하면 "어떤 파일을 말씀하시나요?" 확인

  4. 추가 요청 (Follow-up)
     User: "거기에 테스트도 추가해줘"
     → 이전 Run의 context를 이어받아 새 Run 시작
```

---

## F-3. Proactive Suggestion Engine (선제적 제안 엔진)

사용자가 요청하기 전에 유용한 제안을 먼저 합니다.

### 제안 트리거 조건

```
  패턴 기반 제안:
  ──────────────

  1. 반복 작업 감지
     - "매일 오전 9시에 git pull을 하시네요. 자동화할까요?"
     - 조건: 같은 작업이 3일 연속 감지

  2. 최적화 제안
     - "이 프로젝트에 사용되지 않는 의존성이 5개 있습니다."
     - 조건: 주간 스캔 결과

  3. 보안 제안
     - "이 API Key가 코드에 하드코딩되어 있습니다."
     - 조건: Review Agent 결과

  4. 유지보수 제안
     - "node_modules가 2GB를 초과했습니다. 정리할까요?"
     - 조건: 디스크 모니터링 결과
```

### 제안 빈도 제한

```
  제안 빈도 규칙:
  - 1시간에 최대 3개
  - 같은 제안은 3일 내 재표시 금지
  - 사용자가 "이 유형 제안 그만" → 해당 카테고리 비활성화
  - DND 모드에서는 제안 완전 비활성화
```

---

# G. 테스트/품질 보완

## G-1. Agent Integration Test Framework

JARVIS OS 자체의 에이전트 간 통합 테스트 프레임워크입니다.

### 테스트 카테고리

```
  1. 에이전트 핸드오프 테스트
     - Spec → Policy → Planner 체인이 올바른 데이터를 전달하는지
     - 에이전트 간 메시지 포맷 검증

  2. 정책 판정 정확도 테스트
     - 알려진 위험 요청 100개에 대해 올바르게 DENY하는지
     - 알려진 안전 요청 100개에 대해 올바르게 ALLOW하는지
     - False positive/negative 비율 측정

  3. Gate 흐름 테스트
     - 승인 → 올바른 Capability 발급 확인
     - 거부 → 실행 완전 차단 확인
     - 타임아웃 → 안전하게 종료 확인

  4. Recovery 테스트
     - 의도적 에러 주입 → 올바른 롤백 수행 확인
     - 중간 실패 → 부분 롤백 정확성 확인

  5. End-to-End 시나리오 테스트
     - "코드 구현해줘" 전체 흐름 자동 실행
     - 모든 Gate를 자동 승인/거부하는 테스트 모드
```

### 테스트 실행 구조

```
  /.ai-test/
   ├─ scenarios/
   │   ├─ code_implementation.test.json
   │   ├─ web_access.test.json
   │   ├─ destructive_ops.test.json
   │   └─ policy_edge_cases.test.json
   ├─ fixtures/
   │   ├─ mock_policies.json
   │   ├─ mock_requests.json
   │   └─ expected_outcomes.json
   └─ reports/
       └─ integration_test_report.md
```

---

## G-2. Chaos Engineering / Fault Injection

의도적 장애 주입으로 시스템 견고성을 검증합니다.

### Fault Injection 시나리오

```
  ┌─────────────────────────┬──────────────────────────────────┐
  │ 장애 주입               │ 예상 동작                         │
  ├─────────────────────────┼──────────────────────────────────┤
  │ 에이전트 응답 10초 지연  │ timeout → 재시도 → 대체          │
  │ 에이전트 완전 무응답     │ Health Monitor → 재시작          │
  │ 네트워크 50% 패킷 손실  │ 재시도 → Degraded Mode           │
  │ 디스크 공간 부족 시뮬    │ 새 파일 차단 + 경고              │
  │ 정책 파일 손상           │ 백업 정책 로드 + 경고             │
  │ Gate 무한 대기           │ 타임아웃 → 자동 거부 + 알림      │
  │ Executor 무한 루프       │ Budget 초과 → 자동 중단          │
  │ 동시 10개 요청           │ 큐잉 + 우선순위 처리             │
  └─────────────────────────┴──────────────────────────────────┘
```

---

## G-3. Policy Simulation Sandbox (정책 시뮬레이션)

새 정책을 적용하기 전에 과거 데이터로 영향을 미리 분석합니다.

### 시뮬레이션 흐름

```
  새 정책 제안
       │
       ▼
  ┌──────────────────┐
  │ 과거 요청 데이터  │ (최근 N개 요청의 익명화된 로그)
  │ 로드             │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ 기존 정책으로     │ → 결과 A (기존 허용/차단 수)
  │ 시뮬레이션        │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ 새 정책으로       │ → 결과 B (새 허용/차단 수)
  │ 시뮬레이션        │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ 차이 분석         │
  │                  │
  │ "이 정책을 적용하면:                │
  │  - 추가로 차단되는 요청: 3개       │
  │  - 새로 허용되는 요청: 0개         │
  │  - 영향받는 카테고리: 패키지 설치" │
  └──────────────────┘
```

---

## G-4. Performance Benchmark Suite (성능 벤치마크)

### 측정 지표

```
  ┌────────────────────────────┬─────────────────┬──────────────┐
  │ 지표                       │ 목표값           │ 측정 방법     │
  ├────────────────────────────┼─────────────────┼──────────────┤
  │ 요청→SPEC 생성 시간         │ < 3초           │ 타이머       │
  │ 정책 판정 시간              │ < 1초           │ 타이머       │
  │ 계획 생성 시간              │ < 5초           │ 타이머       │
  │ Gate 렌더링 시간            │ < 200ms         │ 프론트 측정  │
  │ 전체 코드 구현 흐름         │ < 5분 (소규모)  │ E2E          │
  │ 토큰 효율 (기능당 토큰)     │ 측정+추적       │ 집계         │
  │ 에이전트 간 메시지 지연      │ < 500ms         │ 타이머       │
  │ Emergency Stop 반응 시간    │ < 1초           │ E2E          │
  │ 상태 체크포인트 저장 시간    │ < 2초           │ 타이머       │
  └────────────────────────────┴─────────────────┴──────────────┘
```

---

# H. 데이터/저장 인프라 보완

## H-1. Audit Log Rotation & Archiving

로그가 무한히 쌓이면 디스크를 소진하고 검색이 느려집니다.

### 로테이션 정책

```
  로그 관리 정책:
  ──────────────

  1. 활성 로그 (최근 7일)
     - 원본 유지
     - 빠른 검색 인덱스 유지
     - 위치: /.ai-logs/active/

  2. 아카이브 (7일 ~ 90일)
     - 압축 저장 (gzip)
     - 검색 인덱스: 요약 레벨만
     - 위치: /.ai-logs/archive/

  3. 장기 보관 (90일 ~ 1년)
     - 고압축 + 해시 체인만 보존
     - 상세 검색 불가 (해시 검증만)
     - 위치: /.ai-logs/cold/

  4. 삭제 (1년 후)
     - 자동 삭제 (정책 설정 가능)
     - 삭제 전 사용자 알림
     - 해시 체인 최종 스냅샷 보존
```

### 용량 관리

```
  - 최대 디스크 사용량: 전체의 5% 또는 10GB 중 작은 값
  - 임계값 80% 도달 시: 자동 아카이빙 가속
  - 임계값 95% 도달 시: 오래된 cold 로그 자동 삭제 + 경고
```

---

## H-2. Environment Bundle Versioning

### 번들 버전 관리

```
  /.ai-run/
   ├─ bundles/
   │   ├─ run_001/
   │   │   ├─ SPEC.md
   │   │   ├─ PLAN.json
   │   │   ├─ POLICY.json
   │   │   └─ bundle_manifest.json
   │   ├─ run_002/
   │   │   └─ ...
   │   └─ templates/
   │       ├─ react_project.bundle.json    (재사용 가능 템플릿)
   │       └─ python_project.bundle.json
   └─ bundle_index.json  (전체 번들 목록 + 메타데이터)
```

### 번들 비교

```
  사용자가 "이전에 비슷한 작업했는데" 하면:
  1. 번들 인덱스에서 유사 번들 검색
  2. 이전 SPEC/PLAN과 현재 요청 비교
  3. 재사용 가능한 부분 제안
  4. 차이점만 새로 생성
```

---

## H-3. Offline-First Data Strategy

네트워크 없이도 기본적인 운영이 가능해야 합니다.

### 로컬 캐시 전략

```
  항상 로컬에 캐시하는 데이터:
  ─────────────────────────────
  ✅ 정책 파일 (Contract, Blocklist, Allowlist)
  ✅ 사용자 프로필
  ✅ 최근 10개 Run의 상태/결과
  ✅ Credential Vault (암호화)
  ✅ 에이전트 설정/모델 배치

  네트워크 필요한 데이터:
  ─────────────────────────────
  ⚡ Claude API 호출 (에이전트 실행)
  ⚡ 웹 접근 (브라우저 조작)
  ⚡ 패키지 다운로드/설치
  ⚡ URL 신뢰도 검사
```

### 오프라인 모드 전환

```
  네트워크 끊김 감지
       │
       ▼
  ┌──────────────────┐
  │ 오프라인 모드     │
  │                  │
  │ 가능:            │
  │ - 로컬 파일 조작  │
  │ - 캐시된 정책 적용│
  │ - 앱 실행/조작    │
  │ - Audit 로그 기록 │
  │                  │
  │ 불가:            │
  │ - AI 추론 (새 요청)│
  │ - 웹 접근         │
  │ - 패키지 설치     │
  │ - URL 검사        │
  └──────────────────┘
       │
       ▼
  네트워크 복구 시:
  - 오프라인 로그 동기화
  - 대기 중인 작업 재개
  - 정책 업데이트 확인
```

---

# I. 확장성 보완

## I-1. Plugin / Extension Architecture

서드파티 에이전트나 기능을 안전하게 추가할 수 있는 플러그인 시스템입니다.

### 플러그인 구조

```
  /.ai-plugins/
   ├─ registry.json              (설치된 플러그인 목록)
   ├─ slack-notifier/
   │   ├─ manifest.json          (메타데이터, 권한 요청, 버전)
   │   ├─ plugin.js              (실행 코드)
   │   └─ policy.json            (이 플러그인에 적용되는 정책)
   └─ custom-review-agent/
       ├─ manifest.json
       └─ agent.py
```

### 플러그인 보안 샌드박싱

```
  플러그인 설치 흐름:
  ─────────────────

  1. manifest.json 분석
     - 필요 권한 목록 추출
     - 라이선스 확인

  2. 사용자에게 표시 (Gate)
     - 플러그인 이름/설명/출처
     - 요청 권한 목록
     - 보안 점수

  3. 실행 시 제한
     - 플러그인 전용 Capability만 발급
     - 플러그인은 다른 에이전트/플러그인에 접근 불가
     - 네트워크 접근은 manifest에 선언된 도메인만
     - 파일 접근은 manifest에 선언된 경로만
```

---

## I-2. Multi-OS Abstraction Layer

Windows, macOS, Linux를 통일된 API로 추상화합니다.

### 추상화 계층 구조

```
  ┌─────────────────────────────────────────┐
  │          Action API (통합 인터페이스)      │
  │  FS_READ, FS_WRITE, APP_LAUNCH, ...     │
  ├─────────────────────────────────────────┤
  │         OS Abstraction Layer            │
  ├──────────┬──────────┬──────────────────┤
  │ Windows  │  macOS   │  Linux           │
  │ Adapter  │ Adapter  │  Adapter         │
  │          │          │                  │
  │ Win32 API│ AppKit   │  X11/Wayland     │
  │ COM/DCOM │ AppleScr.│  D-Bus           │
  │ PowerShell│ osascript│ systemctl       │
  │ Cred.Mgr │ Keychain │  Secret Service  │
  └──────────┴──────────┴──────────────────┘
```

### OS별 정책 매핑

```
  정책 규칙은 OS 독립적으로 작성하되,
  실행 시 OS Adapter가 자동 변환:

  정책: "시스템 폴더 쓰기 금지"
  → Windows: C:\Windows\**, C:\Program Files\**
  → macOS: /System/**, /Library/**
  → Linux: /usr/**, /etc/**, /boot/**
```

---

## I-3. Multi-User Collaboration Mode

여러 사용자가 같은 JARVIS 인스턴스를 공유할 때의 설계입니다.

### 사용자 격리 구조

```
  ┌─────────────────────────────────────────┐
  │         JARVIS Instance                  │
  ├─────────────────────────────────────────┤
  │                                         │
  │  ┌──────────┐  ┌──────────┐            │
  │  │ User A   │  │ User B   │            │
  │  │ Session  │  │ Session  │            │
  │  │          │  │          │            │
  │  │ Profile  │  │ Profile  │            │
  │  │ Policy   │  │ Policy   │            │
  │  │ Workspace│  │ Workspace│            │
  │  │ Vault    │  │ Vault    │            │
  │  └──────────┘  └──────────┘            │
  │                                         │
  │  공유 리소스:                             │
  │  - 시스템 정책 (Admin 설정)               │
  │  - Audit Log (전체, 접근 제한)           │
  │  - Agent 팀 (시간 분할 공유)              │
  │                                         │
  │  격리 리소스:                             │
  │  - 프로필/정책/Vault (완전 분리)          │
  │  - Workspace (사용자별 scope)             │
  │  - 대화 이력 (상호 접근 불가)             │
  └─────────────────────────────────────────┘
```

### 충돌 관리

```
  User A와 User B가 같은 파일을 수정하려 할 때:
  1. 충돌 감지 → 두 사용자에게 알림
  2. 선착순 잠금 (먼저 Gate 통과한 사용자 우선)
  3. 후순위 사용자에게 "User A가 이 파일을 수정 중입니다" 표시
  4. 머지 전략 제안 (가능한 경우)
```

---

## I-4. AI Model Hot-Swap & Fallback

모델 장애 시 자동 대체하고, 비용/성능 기반으로 동적 선택합니다.

### 모델 폴백 체인

```
  에이전트별 모델 폴백 체인:
  ─────────────────────────

  Codegen:  Opus → Sonnet → Haiku (품질 경고 표시)
  Review:   Sonnet → Opus → Haiku
  Planner:  Sonnet → Opus → Haiku
  Spec:     Haiku → Sonnet → (skip: 사용자에게 직접 명세 요청)
  Policy:   Haiku → Sonnet → (fail-safe: default DENY)
  Test:     Haiku → Sonnet → (skip: 수동 테스트 안내)
```

### 동적 모델 선택 전략

```
  선택 기준:
  ──────────

  1. 작업 복잡도
     - 단순 (파일 읽기) → Haiku
     - 보통 (코드 수정) → Sonnet
     - 복잡 (아키텍처 설계) → Opus

  2. 비용 예산
     - 예산 여유 → 최적 모델 사용
     - 예산 빡빡 → 한 단계 낮은 모델 + 품질 경고

  3. 응답 시간 요구
     - 긴급 → Haiku (빠르지만 품질↓)
     - 일반 → 최적 모델
     - 높은 품질 → Opus (느리지만 품질↑)

  4. 모델 상태
     - 정상 → 기본 할당 모델
     - 지연 높음 → 대체 모델로 전환
     - 다운 → 폴백 체인 적용
```

### 벤더 다변화 (장기)

```
  현재: Anthropic Claude 전용

  장기 확장 옵션:
  - OpenAI GPT 시리즈 (폴백용)
  - Google Gemini (특정 작업용)
  - 로컬 모델 (오프라인 폴백, Ollama 등)

  벤더 전환 시:
  - Action API / Policy 스키마는 변경 없음
  - 에이전트 레이어에서만 모델 바인딩 변경
  - 성능/품질 벤치마크 통과 필수
```

---

# 보완 섹션 요약

```
  총 37개 보완 항목 반영 완료

  A. 아키텍처    (5개): Health Monitor, 통신 프로토콜, Degradation, Multi-Run, State Resume
  B. 보안        (6개): Clipboard, Screen Capture, Process Integrity, Prompt Injection, Network DLP, USB
  C. 거버넌스    (5개): Conflict Resolution, Policy Expiration, Delegation Chain, Abuse Prevention, Learning 검증
  D. Executor    (5개): Action DAG, Dry-Run, 리소스 모니터링, Multi-Window, Undo Stack
  E. UI/UX      (6개): 접근성, 알림 우선순위, 다국어, 모바일, 온보딩, 대시보드
  F. 음성/대화   (3개): 음성 인증, 다중 턴 관리, 선제적 제안
  G. 테스트      (4개): Integration Test, Chaos Engineering, Policy 시뮬레이션, 벤치마크
  H. 데이터      (3개): Log Rotation, Bundle Versioning, Offline-First
  I. 확장성      (4개): Plugin Architecture, Multi-OS, Multi-User, Model Hot-Swap
```

---

# J. 구현 기반 및 MVP 전략 (Implementation Foundation & MVP Strategy)

> 기존 37개 항목이 "무엇을 만들 것인가"를 정의했다면, J 섹션은 "어떤 순서로, 어떻게 첫 발을 뗄 것인가"를 정의한다.

---

## J-1. Monorepo 스캐폴딩 구조

### 디렉토리 트리

```
jarvis-os/
├── packages/
│   ├── core/                    # 공유 커널
│   │   ├── state-machine/       # XState 기반 RunState 엔진
│   │   ├── policy-engine/       # PolicyDecision 평가기
│   │   ├── action-api/          # Action 스키마 & 직렬화
│   │   ├── capability-token/    # 토큰 발급 / 검증
│   │   ├── event-bus/           # 에이전트 간 통신 버스
│   │   └── types/               # 공용 TypeScript 타입
│   │
│   ├── agents/                  # 9개 에이전트 패키지
│   │   ├── orchestrator/
│   │   ├── intent-spec/
│   │   ├── policy-risk/
│   │   ├── planner/
│   │   ├── codegen/
│   │   ├── review/
│   │   ├── test-build/
│   │   ├── executor/
│   │   └── recovery/
│   │
│   ├── ui/                      # React 프론트엔드
│   │   ├── components/          # Atomic Design (atoms/molecules/organisms)
│   │   ├── panels/              # 4-Panel 레이아웃
│   │   ├── hooks/               # 커스텀 훅
│   │   ├── store/               # Zustand 상태 관리
│   │   └── design-tokens/       # 디자인 토큰 (JSON → CSS)
│   │
│   ├── cli/                     # 터미널 인터페이스
│   │   ├── commands/            # 명령어 핸들러
│   │   ├── prompts/             # Inquirer 프롬프트
│   │   └── formatters/          # 터미널 출력 포매터
│   │
│   └── shared/                  # 유틸리티
│       ├── logger/              # 구조화된 로깅
│       ├── config/              # 환경 설정 로더
│       └── test-utils/          # 테스트 헬퍼
│
├── infra/                       # 인프라 설정
│   ├── docker/
│   └── scripts/
│
├── docs/                        # 프로젝트 문서
│   ├── architecture/
│   ├── api/
│   └── guides/
│
├── .claude/                     # Claude 워크플로우
│   └── workflow.md
│
├── turbo.json                   # Turborepo 설정
├── pnpm-workspace.yaml          # pnpm 워크스페이스
├── tsconfig.base.json           # 공용 TypeScript 설정
└── package.json                 # 루트 패키지
```

### 패키지 의존성 그래프

```
  types ← action-api ← capability-token
    ↑         ↑              ↑
    │         │              │
  event-bus ← state-machine ← policy-engine
    ↑              ↑
    │              │
  agents/*    ←────┘
    ↑
    │
  cli / ui
```

### 빌드 도구 선택

```
  항목              선택              이유
  ──────────────────────────────────────────────────
  패키지 매니저     pnpm             빠른 설치, 디스크 효율
  모노레포 도구     Turborepo        증분 빌드, 캐시, 병렬 실행
  번들러           tsup              빠른 TS 컴파일, ESM/CJS 동시 출력
  테스트           Vitest            빠른 실행, TS 네이티브 지원
  린터             Biome             Rust 기반, 빠른 lint + format
  타입 체크        tsc --build       프로젝트 레퍼런스 활용
```

---

## J-2. State Machine 엔진 전략

### XState v5 기반 설계

```typescript
// 개념적 상태 머신 정의 (XState v5 스타일)

const jarvisRunMachine = createMachine({
  id: 'jarvisRun',
  initial: 'inputReceived',

  context: {
    runId: '',
    userInput: '',
    spec: null,
    plan: null,
    actions: [],
    results: [],
    riskScore: 0,
    trustMode: 'suggest',
    gateResponses: {},
    errorStack: [],
    tokenBudget: { used: 0, limit: 0 },
  },

  states: {
    inputReceived: {
      on: { ANALYZE: 'specDrafting' },
      entry: ['logInput', 'assignRunId'],
    },

    specDrafting: {
      invoke: {
        src: 'intentSpecAgent',
        onDone: { target: 'policyEvaluation', actions: 'assignSpec' },
        onError: { target: 'errorRecovery', actions: 'pushError' },
      },
    },

    policyEvaluation: {
      invoke: {
        src: 'policyRiskAgent',
        onDone: [
          { target: 'blocked', guard: 'isBlocked' },
          { target: 'gateApproval', guard: 'needsGate' },
          { target: 'planning', guard: 'isAllowed' },
        ],
        onError: { target: 'errorRecovery', actions: 'pushError' },
      },
    },

    gateApproval: {
      on: {
        APPROVE: 'planning',
        REJECT: 'blocked',
        MODIFY: { target: 'specDrafting', actions: 'applyModification' },
      },
      after: {
        300000: 'blocked', // 5분 타임아웃
      },
    },

    planning: {
      invoke: {
        src: 'plannerAgent',
        onDone: { target: 'planReview', actions: 'assignPlan' },
        onError: { target: 'errorRecovery', actions: 'pushError' },
      },
    },

    planReview: {
      invoke: {
        src: 'reviewAgent',
        onDone: [
          { target: 'codeGeneration', guard: 'planApproved' },
          { target: 'planning', guard: 'planNeedsRevision', actions: 'applyFeedback' },
        ],
      },
    },

    codeGeneration: {
      invoke: {
        src: 'codegenAgent',
        onDone: { target: 'codeReview', actions: 'assignCode' },
        onError: { target: 'errorRecovery', actions: 'pushError' },
      },
    },

    codeReview: {
      invoke: {
        src: 'reviewAgent',
        onDone: [
          { target: 'testing', guard: 'codeApproved' },
          { target: 'codeGeneration', guard: 'codeNeedsRevision', actions: 'applyFeedback' },
        ],
      },
    },

    testing: {
      invoke: {
        src: 'testBuildAgent',
        onDone: [
          { target: 'executionGate', guard: 'testsPass' },
          { target: 'codeGeneration', guard: 'testsFail', actions: 'feedbackFromTests' },
        ],
      },
    },

    executionGate: {
      // Trust Mode에 따른 분기
      always: [
        { target: 'executing', guard: 'isAutoMode' },
        { target: 'executionApproval', guard: 'needsApproval' },
      ],
    },

    executionApproval: {
      on: {
        APPROVE_EXECUTION: 'executing',
        REJECT_EXECUTION: 'blocked',
      },
    },

    executing: {
      invoke: {
        src: 'executorAgent',
        onDone: { target: 'verifying', actions: 'assignResults' },
        onError: { target: 'rollback', actions: 'pushError' },
      },
      on: {
        PAUSE: 'paused',
        CANCEL: 'rollback',
      },
    },

    paused: {
      on: {
        RESUME: 'executing',
        CANCEL: 'rollback',
      },
    },

    verifying: {
      invoke: {
        src: 'verificationCheck',
        onDone: [
          { target: 'done', guard: 'verificationPass' },
          { target: 'rollback', guard: 'verificationFail' },
        ],
      },
    },

    rollback: {
      invoke: {
        src: 'recoveryAgent',
        onDone: 'rolledBack',
        onError: 'criticalError',
      },
    },

    // 최종 상태들
    done: { type: 'final', entry: 'logSuccess' },
    blocked: { type: 'final', entry: 'logBlocked' },
    rolledBack: { type: 'final', entry: 'logRollback' },
    criticalError: { type: 'final', entry: 'alertCritical' },

    errorRecovery: {
      invoke: {
        src: 'recoveryAgent',
        onDone: [
          { target: 'specDrafting', guard: 'canRetry' },
          { target: 'criticalError', guard: 'maxRetriesExceeded' },
        ],
      },
    },
  },
});
```

### 상태 전이 규칙

```
  FROM                → TO                    조건
  ──────────────────────────────────────────────────────────
  inputReceived       → specDrafting           항상
  specDrafting        → policyEvaluation       Spec 생성 성공
  policyEvaluation    → blocked                Risk = BLOCKED
  policyEvaluation    → gateApproval           Risk ≥ MEDIUM
  policyEvaluation    → planning               Risk = LOW & allowed
  gateApproval        → planning               사용자 승인
  gateApproval        → blocked                사용자 거부 or 타임아웃
  planning            → planReview             Plan 생성 성공
  planReview          → codeGeneration         리뷰 통과
  planReview          → planning               리뷰 실패 (피드백 반영)
  codeGeneration      → codeReview             코드 생성 성공
  codeReview          → testing                리뷰 통과
  codeReview          → codeGeneration         리뷰 실패
  testing             → executionGate          테스트 통과
  testing             → codeGeneration         테스트 실패
  executionGate       → executing              Auto 모드
  executionGate       → executionApproval      승인 필요
  executing           → verifying              실행 완료
  executing           → rollback               실행 실패 or 취소
  verifying           → done                   검증 통과
  verifying           → rollback               검증 실패
  *any*               → errorRecovery          에러 발생
  errorRecovery       → (이전 상태)             재시도 가능
  errorRecovery       → criticalError          재시도 한도 초과
```

### 상태 영속화 전략

```
  시점                    저장 위치              내용
  ──────────────────────────────────────────────────────────
  상태 전이 시            SQLite (로컬)         전체 context 스냅샷
  Gate 응답 시            SQLite + 메모리       gateResponses 업데이트
  Executor 액션 단위      SQLite (WAL 모드)     개별 액션 결과
  세션 종료 시            JSON 파일             전체 Run 상태 직렬화
  앱 재시작 시            SQLite → 메모리       마지막 스냅샷 복원
```

---

## J-3. CLI 인터페이스 MVP

> React UI보다 먼저 CLI를 구현하여, 에이전트 파이프라인을 빠르게 검증한다.

### CLI 명령어 체계

```
jarvis <command> [options]

Commands:
  jarvis run <instruction>       # 자연어 명령 실행
  jarvis plan <instruction>      # Plan만 생성 (실행 안 함)
  jarvis approve <run-id>        # 대기 중인 Gate 승인
  jarvis reject <run-id>         # Gate 거부
  jarvis status [run-id]         # 현재/특정 Run 상태
  jarvis history                 # 실행 이력
  jarvis rollback <run-id>       # 수동 롤백
  jarvis config                  # 설정 (Trust Mode 등)
  jarvis policy list             # 활성 정책 목록
  jarvis policy test <action>    # 정책 시뮬레이션

Options:
  --trust <mode>      Trust 모드 (observe|suggest|semi-auto|auto)
  --dry-run           Dry-run 모드 (실행 없이 Plan까지)
  --verbose           상세 로그 출력
  --json              JSON 형식 출력
  --timeout <ms>      Gate 타임아웃
```

### 터미널 Gate 승인 UX

```
┌─────────────────────────────────────────────────────────┐
│  🔒 GATE: Apply Changes                                │
│                                                         │
│  Run ID:  run_abc123                                    │
│  Risk:    ██████░░░░ 62 (MEDIUM)                       │
│                                                         │
│  Actions (3):                                           │
│    1. CREATE  ~/project/hello.txt                       │
│    2. WRITE   "Hello World" → ~/project/hello.txt      │
│    3. CHMOD   644 → ~/project/hello.txt                │
│                                                         │
│  Policy:  default-workspace (auto-approved: false)      │
│                                                         │
│  [A]pprove  [R]eject  [D]iff  [M]odify  [?]Help       │
└─────────────────────────────────────────────────────────┘
```

### CLI 기술 스택

```
  항목              선택              이유
  ──────────────────────────────────────────────────
  프레임워크        Commander.js      널리 쓰임, 간단
  프롬프트          Inquirer.js       인터랙티브 입력
  출력 포맷         chalk + boxen     색상 + 박스 UI
  스피너            ora               로딩 표시
  테이블            cli-table3        정렬된 표
  진행률            cli-progress      프로그레스 바
```

---

## J-4. E2E MVP 검증 시나리오

> MVP 완성의 기준이 되는 10가지 End-to-End 시나리오

### 시나리오 목록

```
  #   시나리오                               검증 포인트
  ──────────────────────────────────────────────────────────────────────
  1   "hello.txt 파일 만들어줘"              최소 파이프라인 E2E
  2   "이 폴더의 .js를 .ts로 변환해줘"      다중 파일 조작
  3   "npm install lodash 해줘"              패키지 설치 Gate
  4   "~/Documents 정리해줘"                 위험 경로 감지 → Gate 발동
  5   "이 Python 스크립트 실행해줘"          코드 실행 Gate + 샌드박스
  6   "시스템 설정 변경해줘"                 BLOCKED 정책 작동
  7   중간에 [취소] 버튼 클릭                Pause → Rollback 흐름
  8   동일 명령 반복                         Pattern Cache 학습 확인
  9   네트워크 끊김 상태에서 실행             Offline-First 동작
  10  앱 재시작 후 이전 상태 복원             State Resume 검증
```

### 시나리오 1 상세: "hello.txt 만들어줘"

```
  단계   에이전트         액션                         예상 시간
  ────────────────────────────────────────────────────────────────
  1      Orchestrator     입력 수신, Run 생성           < 100ms
  2      Intent & Spec    Spec 생성                    < 2s
         → { action: "create_file", path: "hello.txt", content: "Hello" }
  3      Policy & Risk    위험 평가                     < 500ms
         → risk: 12 (LOW), decision: "allowed"
  4      Planner          실행 계획 생성                 < 1s
         → [{ step: 1, action: "fs.createFile", args: {...} }]
  5      Review           계획 검토                     < 1s
         → approved: true
  6      Codegen          (스킵 - 단순 파일 작업)       -
  7      Test & Build     Dry-run 검증                  < 500ms
  8      Executor         hello.txt 생성 실행            < 200ms
  9      Orchestrator     결과 보고                     < 100ms
  ────────────────────────────────────────────────────────────────
  총 예상 시간: < 6초
```

### 합격 기준

```
  시나리오    합격 조건
  ──────────────────────────────────────────────────────────
  1-3        정상 완료, 결과물 존재, Audit 로그 기록
  4-6        적절한 Gate/Block 발동, 사용자 선택 반영
  7          Rollback 완료, 원상 복구 확인
  8          2회차부터 "이전에 승인한 패턴" 표시
  9          오프라인 큐잉 → 온라인 복귀 시 실행
  10         재시작 후 정확히 중단 지점부터 재개
```

---

## J-5. 구현 우선순위 매트릭스

```
  Phase    이름                      주요 작업                                   예상 범위
  ──────────────────────────────────────────────────────────────────────────────────────────
  0        Foundation               Monorepo 셋업, types 패키지, 빌드 파이프라인    기반
  1        Core Engine              State Machine, Policy Engine, Action API       핵심
  2        Agent Pipeline           9개 에이전트 기본 구현 (stub → real)            핵심
  3        CLI MVP                  터미널 인터페이스, Gate 승인 UX                 MVP
  4        React UI                 4-Panel 레이아웃, 실시간 상태 표시              UI
  5        Polish & Harden          보안 강화, 성능 최적화, 에러 핸들링              안정화
```

### Phase 0: Foundation 상세

```
  Task                              의존성      우선순위
  ──────────────────────────────────────────────────────
  pnpm + Turborepo 초기화           없음        P0
  tsconfig.base.json 설정           없음        P0
  packages/core/types 정의          없음        P0
  Vitest 설정                       types       P0
  Biome 린트/포맷 설정              없음        P0
  CI (GitHub Actions) 기본          빌드 도구    P1
  패키지 간 의존성 연결             types       P0
```

### Phase 1: Core Engine 상세

```
  Task                              의존성        우선순위
  ──────────────────────────────────────────────────────────
  state-machine 패키지 (XState)     types         P0
  policy-engine 패키지              types         P0
  action-api 스키마 정의            types         P0
  capability-token 발급/검증        action-api    P0
  event-bus 구현                    types         P1
  SQLite 상태 영속화                state-machine P1
```

### Phase 2: Agent Pipeline 상세

```
  Task                              의존성              우선순위
  ──────────────────────────────────────────────────────────────
  Orchestrator 기본 구현            state-machine        P0
  Intent & Spec Agent               Claude API           P0
  Policy & Risk Agent               policy-engine        P0
  Planner Agent                     action-api           P1
  Executor Agent                    capability-token     P0
  Recovery Agent                    state-machine        P1
  Review Agent                      action-api           P2
  Codegen Agent                     Claude API           P2
  Test & Build Agent                Executor             P2
```

---

## J-6. First Vertical Slice 정의

> "hello.txt 만들어줘" 한 문장을 처음부터 끝까지 실행할 수 있는 최소 구현

### 포함 범위

```
  컴포넌트               구현 수준          설명
  ──────────────────────────────────────────────────────────────
  types                  완전               모든 공유 타입 정의
  state-machine          완전               전체 상태 전이 구현
  policy-engine          최소               하드코딩된 기본 정책
  action-api             최소               fs.createFile만 구현
  capability-token       최소               단일 토큰 발급/검증
  Orchestrator           완전               전체 파이프라인 오케스트레이션
  Intent & Spec Agent    최소               Claude API 1회 호출
  Policy & Risk Agent    최소               기본 위험 평가
  Planner Agent          최소               단일 액션 계획
  Executor Agent         최소               파일 생성만 실행
  CLI                    최소               run 명령어만 동작
  UI                     없음               Phase 4에서 구현
```

### 성공 기준

```
  $ jarvis run "hello.txt 만들어줘"

  ✓ Intent 분석 완료 (1.2s)
  ✓ 정책 평가: LOW risk (0.3s)
  ✓ 실행 계획 생성 (0.8s)
  ✓ hello.txt 생성 완료 (0.1s)

  결과: ~/hello.txt 파일이 생성되었습니다.
  총 소요 시간: 2.4s
```

---

# K. 런타임 지능 및 최적화 (Runtime Intelligence & Optimization)

> 시스템이 "더 똑똑하게, 더 효율적으로" 동작하기 위한 런타임 전략

---

## K-1. 토큰 예산 최적화 (Token Budget Optimization)

### 에이전트별 비용 분석

```
  에이전트          모델 권장          평균 토큰          비용 비중
  ──────────────────────────────────────────────────────────────
  Orchestrator     Sonnet             ~500 in/out       낮음
  Intent & Spec    Sonnet             ~1,500 in/800 out 중간
  Policy & Risk    Haiku              ~800 in/300 out   낮음
  Planner          Sonnet             ~2,000 in/1,500   높음
  Codegen          Opus               ~3,000 in/2,000   최고
  Review           Sonnet             ~2,000 in/500     중간
  Test & Build     Haiku              ~1,000 in/500     낮음
  Executor         없음 (규칙 기반)    0                 없음
  Recovery         Sonnet             ~1,500 in/800     중간
  ──────────────────────────────────────────────────────────────
  단일 Run 평균 총합:    ~12,300 input / ~6,400 output
```

### 최적화 전략 5가지

```
  전략                    설명                                    절감 예상
  ──────────────────────────────────────────────────────────────────────
  1. Prompt Caching       시스템 프롬프트 캐싱 (Claude 지원)      ~30% input
  2. 조건부 스킵          단순 작업 시 Review/Codegen 스킵         ~40% 전체
  3. 점진적 컨텍스트      필요한 정보만 점진 제공                  ~20% input
  4. 모델 다운그레이드    LOW risk 시 전체 Haiku 사용              ~60% 비용
  5. 결과 캐싱           동일 Spec → 캐시된 Plan 재사용           ~50% 반복
```

### Token Budget 인터페이스

```typescript
interface TokenBudget {
  runId: string;
  limit: {
    total: number;           // 전체 한도 (예: 50,000)
    perAgent: Record<AgentId, number>;  // 에이전트별 한도
  };
  used: {
    total: number;
    perAgent: Record<AgentId, { input: number; output: number }>;
  };
  strategy: 'optimal' | 'balanced' | 'economy';
  alerts: {
    warnAt: number;          // 80% 도달 시 경고
    hardLimitAction: 'pause' | 'downgrade' | 'abort';
  };
}
```

### 예산 초과 시 대응 흐름

```
  토큰 사용률    대응
  ──────────────────────────────────────────
  0-60%         정상 운영
  60-80%        모델 다운그레이드 검토
  80-90%        경고 표시, 불필요 에이전트 스킵
  90-95%        Haiku 전환, 최소 응답
  95-100%       Gate: "예산 한도 도달. 계속?"
  100%+         자동 중단 (설정에 따라)
```

---

## K-2. 상호 감시 패턴 (Mutual Watchdog Pattern)

### 에이전트 간 교차 감시 관계

```
  감시자              감시 대상            감시 항목
  ──────────────────────────────────────────────────────────────
  Review Agent        Codegen Agent        코드 품질, 보안 취약점
  Policy & Risk       Planner              계획의 정책 준수 여부
  Test & Build        Executor             실행 결과 정합성
  Recovery            모든 에이전트         에러 패턴, 무한 루프
  Orchestrator        전체 파이프라인       타임아웃, 교착 상태
```

### Executor 실시간 감시

```
  감시 항목                    임계값                조치
  ──────────────────────────────────────────────────────────
  CPU 사용률                  > 80% for 30s          PAUSE + 경고
  메모리 사용                 > 500MB                PAUSE + 경고
  디스크 I/O                  > 100MB/s for 10s      THROTTLE
  네트워크 전송               > 10MB 누적            GATE 발동
  프로세스 생성 수            > 10개                 BLOCK
  실행 시간                   > Gate 설정 TTL        TIMEOUT
  파일 변경 수                > Plan 명시 수 + 20%   PAUSE + 확인
```

### 교착 상태 감지

```
  패턴                              감지 방법                    해소
  ──────────────────────────────────────────────────────────────────
  A→B→A 순환 호출                  호출 그래프 사이클 감지       강제 중단
  Gate 무한 대기                   TTL 타이머                   자동 Reject
  에이전트 무응답                   Heartbeat 누락 3회           재시작
  동일 상태 반복 진입              상태 히스토리 분석 (3회)      에스컬레이션
  토큰 소진 루프                   예산 모니터                  강제 중단
```

---

## K-3. 행동 패턴 캐시 (Behavioral Pattern Cache)

### 학습 대상

```
  패턴 유형               예시                              활용
  ──────────────────────────────────────────────────────────────
  승인된 패턴             "npm install → 항상 승인"         Gate 자동 승인 제안
  거부된 패턴             "rm -rf / → 항상 거부"            자동 차단
  수정된 패턴             "경로 A → B로 항상 수정"          자동 수정 제안
  선호 패턴               "Python → 항상 venv 사용"         기본값 설정
  시간 패턴               "업무 시간 외 → 모든 Gate 발동"   시간 기반 정책
```

### 캐시 스키마

```json
{
  "patternId": "pat_abc123",
  "type": "approved",
  "signature": {
    "actionType": "package_install",
    "riskRange": [0, 40],
    "pathPattern": "~/projects/**"
  },
  "statistics": {
    "occurrences": 15,
    "lastSeen": "2025-01-15T10:30:00Z",
    "approvalRate": 1.0,
    "avgResponseTime": 1200
  },
  "confidence": 0.95,
  "autoApplyThreshold": 0.9,
  "expiresAt": "2025-04-15T10:30:00Z"
}
```

### 제안 UX

```
┌─────────────────────────────────────────────────────────┐
│  💡 이전 패턴 감지                                      │
│                                                         │
│  "npm install lodash" 명령은 지난 15회 모두             │
│  승인되었습니다. (신뢰도: 95%)                          │
│                                                         │
│  [자동 승인] [이번만 승인] [직접 검토] [규칙으로 저장]  │
└─────────────────────────────────────────────────────────┘
```

### 안전 장치

```
  규칙                                          이유
  ──────────────────────────────────────────────────────────
  HIGH risk 이상은 캐시 자동 적용 불가          위험한 작업은 항상 검토
  30일 미사용 패턴 자동 만료                   오래된 패턴 제거
  자동 승인 최대 연속 횟수: 10                 무한 자동 실행 방지
  새 경로/새 패키지는 항상 Gate                 알려지지 않은 것은 확인
  사용자가 언제든 패턴 삭제/초기화 가능         사용자 통제권 보장
```

---

## K-4. 작업 공간 프로필 시스템 (Workspace Profile System)

### 프로필 개념

```
  각 프로젝트 디렉토리마다 독립적인 보안 프로필을 가진다.
  → 프로젝트 특성에 맞는 정책을 자동 적용

  예시:
  ~/projects/my-blog/        → "web-frontend" 프로필 (낮은 위험)
  ~/projects/infra-scripts/  → "infrastructure" 프로필 (높은 위험)
  ~/Documents/personal/      → "personal-files" 프로필 (중간 위험)
```

### 프로필 스키마

```json
{
  "profileId": "wp_my-blog",
  "name": "My Blog Project",
  "path": "~/projects/my-blog",
  "detected": {
    "languages": ["typescript", "javascript"],
    "frameworks": ["next.js", "react"],
    "packageManager": "pnpm",
    "hasDocker": false,
    "hasCi": true
  },
  "policy": {
    "trustMode": "semi-auto",
    "riskAdjustment": -10,
    "allowedActions": [
      "fs.read", "fs.write", "fs.create",
      "package.install", "package.remove",
      "process.run:dev-server"
    ],
    "blockedActions": [
      "fs.delete:node_modules",
      "process.run:rm",
      "system.*"
    ],
    "safeZone": "~/projects/my-blog/**",
    "dangerZone": ["~/", "~/Documents", "/etc"]
  },
  "preferences": {
    "defaultBranch": "main",
    "testCommand": "pnpm test",
    "buildCommand": "pnpm build",
    "lintCommand": "pnpm lint"
  }
}
```

### 자동 감지 로직

```
  감지 대상               방법                          결과
  ──────────────────────────────────────────────────────────────
  언어                    파일 확장자 분포 분석          languages[]
  프레임워크              package.json, config 파일      frameworks[]
  패키지 매니저           lock 파일 존재 여부            packageManager
  Docker                  Dockerfile 존재               hasDocker
  CI/CD                   .github/, .gitlab-ci.yml      hasCi
  테스트 프레임워크       jest.config, vitest.config     testCommand
  모노레포                turbo.json, lerna.json         isMonorepo
```

---

## K-5. 에러 복구 플레이북 (Error Recovery Playbook)

### 장애 유형별 복구 절차

```
  장애 유형 1: Claude API 호출 실패
  ─────────────────────────────────────────
  증상:   API 타임아웃 또는 Rate Limit
  감지:   HTTP 429/503 응답
  복구:
    Step 1. 지수 백오프 재시도 (최대 3회)
    Step 2. 모델 다운그레이드 (Opus→Sonnet→Haiku)
    Step 3. 오프라인 큐에 작업 저장
    Step 4. 사용자에게 "API 불안정" 알림
    Step 5. 수동 재시도 버튼 제공

  장애 유형 2: Executor 액션 실패
  ─────────────────────────────────────────
  증상:   파일 생성/수정 중 권한 에러
  감지:   EACCES, EPERM 에러 코드
  복구:
    Step 1. Undo Stack에서 이전 상태 복원
    Step 2. 원인 분석 (권한, 경로, 디스크 공간)
    Step 3. 대안 제시 ("sudo 필요" or "다른 경로 제안")
    Step 4. 사용자 선택에 따라 재시도

  장애 유형 3: State Machine 비정상 상태
  ─────────────────────────────────────────
  증상:   상태 전이 불가 (dead state)
  감지:   Heartbeat 누락 + 상태 변화 없음 30초
  복구:
    Step 1. 현재 상태 스냅샷 저장
    Step 2. 마지막 정상 상태로 롤백
    Step 3. 해당 에이전트 재초기화
    Step 4. 중단 지점부터 재시도
    Step 5. 3회 실패 시 전체 Run 중단 + 롤백

  장애 유형 4: 메모리/리소스 부족
  ─────────────────────────────────────────
  증상:   시스템 메모리 부족 또는 디스크 풀
  감지:   OS 리소스 모니터 경고
  복구:
    Step 1. 현재 실행 즉시 PAUSE
    Step 2. 불필요 프로세스 정리 제안
    Step 3. 캐시/임시 파일 정리
    Step 4. 리소스 확보 확인 후 RESUME
    Step 5. 확보 불가 시 안전하게 중단

  장애 유형 5: Capability Token 만료
  ─────────────────────────────────────────
  증상:   실행 중 토큰 TTL 초과
  감지:   토큰 검증 실패
  복구:
    Step 1. 진행 중 액션 일시정지
    Step 2. 새 토큰 발급 요청
    Step 3. Policy 재평가 (상황 변화 확인)
    Step 4. 새 토큰으로 계속 or 재승인 Gate

  장애 유형 6: 네트워크 단절
  ─────────────────────────────────────────
  증상:   인터넷 연결 끊김
  감지:   API 호출 실패 + ping 실패
  복구:
    Step 1. 로컬 전용 모드 전환
    Step 2. 대기 중 작업 오프라인 큐에 저장
    Step 3. 로컬 가능 작업만 계속 실행
    Step 4. 연결 복구 시 큐 자동 실행
    Step 5. 충돌 감지 & 수동 해결 Gate
```

---

# L. 개발자 경험 및 도구 (Developer Experience & Tooling)

> 시스템을 확장하고 유지보수하는 개발자를 위한 도구와 인터페이스

---

## L-1. Agent Development SDK

### 에이전트 인터페이스

```typescript
/**
 * 모든 에이전트가 구현해야 하는 기본 인터페이스
 */
interface JarvisAgent<TInput extends AgentInput, TOutput extends AgentOutput> {
  /** 에이전트 고유 식별자 */
  readonly id: AgentId;

  /** 에이전트 메타데이터 */
  readonly metadata: AgentMetadata;

  /** 에이전트 실행 */
  execute(input: TInput, context: AgentContext): Promise<TOutput>;

  /** 헬스 체크 */
  healthCheck(): Promise<HealthStatus>;

  /** 에이전트 초기화 */
  initialize(config: AgentConfig): Promise<void>;

  /** 에이전트 정리 */
  dispose(): Promise<void>;
}

interface AgentMetadata {
  name: string;
  version: string;
  description: string;
  modelRequirement: ModelTier;       // 'opus' | 'sonnet' | 'haiku' | 'none'
  inputSchema: JSONSchema;
  outputSchema: JSONSchema;
  capabilities: AgentCapability[];
  maxConcurrency: number;
  timeout: number;
}

interface AgentContext {
  runId: string;
  runState: RunState;
  policyContext: PolicyContext;
  tokenBudget: TokenBudget;
  eventBus: EventBus;
  logger: Logger;
  abortSignal: AbortSignal;
}

interface AgentInput {
  type: string;
  payload: unknown;
  metadata?: Record<string, unknown>;
}

interface AgentOutput {
  type: string;
  result: unknown;
  tokensUsed: { input: number; output: number };
  duration: number;
  confidence?: number;
  warnings?: string[];
}
```

### 에이전트 등록 시스템

```typescript
// 에이전트 등록 예시
const registry = new AgentRegistry();

registry.register({
  id: 'custom-linter',
  factory: (config) => new CustomLinterAgent(config),
  metadata: {
    name: 'Custom Linter Agent',
    version: '1.0.0',
    description: 'Runs project-specific linting rules',
    modelRequirement: 'haiku',
    inputSchema: { /* ... */ },
    outputSchema: { /* ... */ },
    capabilities: ['code-analysis', 'suggestion'],
    maxConcurrency: 3,
    timeout: 30000,
  },
  hooks: {
    beforeExecute: async (input) => validateInput(input),
    afterExecute: async (output) => enrichOutput(output),
    onError: async (error) => reportError(error),
  },
});
```

### 플러그인 에이전트 디렉토리 구조

```
plugins/
├── my-custom-agent/
│   ├── package.json
│   ├── src/
│   │   ├── index.ts          # 에이전트 팩토리 export
│   │   ├── agent.ts          # JarvisAgent 구현
│   │   ├── schema.ts         # Input/Output 스키마
│   │   └── prompts/          # LLM 프롬프트 템플릿
│   ├── tests/
│   │   └── agent.test.ts
│   └── jarvis-plugin.json    # 플러그인 매니페스트
```

---

## L-2. Policy Authoring Tool

### 정책 DSL (비개발자용)

```
// 사람이 읽을 수 있는 정책 정의 문법

POLICY "safe-web-project" {
  SCOPE: ~/projects/web-app/**

  ALLOW {
    file.read    IN scope
    file.write   IN scope WHERE extension IN [.ts, .tsx, .css, .json]
    file.create  IN scope
    package.install WHERE registry = "npmjs.com"
    process.run WHERE command IN ["npm", "pnpm", "node", "tsc"]
  }

  GATE {
    file.delete  IN scope                    → CONFIRM("파일 삭제 확인")
    package.install WHERE name NOT IN known  → REVIEW("새 패키지 검토")
    process.run WHERE command = "docker"     → APPROVE("Docker 실행 승인")
  }

  BLOCK {
    file.* OUTSIDE scope
    system.*
    process.run WHERE command IN ["rm", "sudo", "chmod"]
    network.request WHERE domain NOT IN allowlist
  }

  SETTINGS {
    trust_mode: semi-auto
    risk_adjustment: -5
    gate_timeout: 5m
    audit_level: standard
  }
}
```

### 정책 시뮬레이션 CLI

```
  $ jarvis policy test --policy safe-web-project --action "file.write ~/projects/web-app/src/index.ts"
  ✓ ALLOWED (rule: ALLOW file.write IN scope WHERE extension IN [.ts])

  $ jarvis policy test --policy safe-web-project --action "file.delete ~/Documents/important.pdf"
  ✗ BLOCKED (rule: BLOCK file.* OUTSIDE scope)

  $ jarvis policy test --policy safe-web-project --action "package.install unknown-pkg"
  ⚠ GATE (rule: GATE package.install WHERE name NOT IN known)
```

---

## L-3. Debug Mode & DevTools

### 디버그 모드 기능

```
  기능                    설명                              활성화
  ──────────────────────────────────────────────────────────────
  Verbose Logging        모든 에이전트 I/O 로그            --verbose
  Token Profiling        토큰 사용량 실시간 표시            --profile
  State Visualization    상태 전이 다이어그램 출력          --viz
  Step-by-Step           각 에이전트 단계별 확인 후 진행    --step
  Dry-Run                실제 실행 없이 Plan까지 진행      --dry-run
  Time Profiling         각 단계 소요 시간 측정            --timing
  Agent Inspector        특정 에이전트 입출력 검사          --inspect <agent>
```

### 디버그 출력 예시

```
  $ jarvis run "hello.txt 만들어줘" --verbose --timing

  [00.000s] ▶ RUN_START  run_id=run_abc123
  [00.002s] │ Orchestrator: 입력 분석 시작
  [00.010s] │ → Intent & Spec Agent 호출
  [01.234s] │ ← Spec 생성 완료 (tokens: 1,200 in / 450 out)
  [01.240s] │   Spec: { action: "create_file", path: "hello.txt" }
  [01.245s] │ → Policy & Risk Agent 호출
  [01.567s] │ ← Risk Score: 12 (LOW), Decision: ALLOWED
  [01.570s] │ → Planner Agent 호출
  [02.345s] │ ← Plan 생성 (1 step, tokens: 800 in / 350 out)
  [02.350s] │ → Review Agent 호출
  [02.890s] │ ← Review: APPROVED (confidence: 0.98)
  [02.895s] │ → Executor Agent 호출
  [02.900s] │   Token: cap_xyz (TTL: 60s, scope: fs.create)
  [02.950s] │   Action: fs.createFile("hello.txt", "Hello")
  [03.010s] │ ← Execution: SUCCESS
  [03.015s] ▶ RUN_COMPLETE (total: 3.015s)

  Token Summary:
    Intent & Spec:  1,200 / 450    ($0.002)
    Policy & Risk:    800 / 300    ($0.0003)
    Planner:          800 / 350    ($0.001)
    Review:           600 / 150    ($0.0008)
    ─────────────────────────────────
    Total:          3,400 / 1,250  ($0.004)
```

### 상태 시각화 (터미널)

```
  $ jarvis run "hello.txt 만들어줘" --viz

  inputReceived ──→ specDrafting ──→ policyEvaluation ──→ planning
                                                            │
       done ←── verifying ←── executing ←── executionGate ←─┘
        ✓           ✓            ✓              ✓
```

---

## L-4. Threat Model 체크리스트

### 공격 벡터 카테고리

```
  카테고리 1: Prompt Injection
  ────────────────────────────────────────
  [ ] 사용자 입력에 숨겨진 LLM 명령
  [ ] 파일 내용을 통한 간접 주입
  [ ] 환경 변수를 통한 주입
  [ ] 클립보드 내용을 통한 주입
  [ ] URL/링크를 통한 주입
  대응: Input Sanitizer + Spec 검증 2단계

  카테고리 2: 권한 상승 (Privilege Escalation)
  ────────────────────────────────────────
  [ ] Capability Token 위조
  [ ] 만료 토큰 재사용
  [ ] 토큰 범위 초과 요청
  [ ] 에이전트 간 토큰 공유
  [ ] Trust Mode 우회
  대응: 암호화 서명 + 단일 사용 + TTL

  카테고리 3: 정보 유출 (Data Exfiltration)
  ────────────────────────────────────────
  [ ] 파일 내용 외부 전송
  [ ] 환경 변수/시크릿 노출
  [ ] 실행 로그를 통한 민감 정보 유출
  [ ] 스크린 캡처를 통한 유출
  [ ] 클립보드를 통한 유출
  대응: Network DLP + Content Scanner

  카테고리 4: 서비스 거부 (DoS)
  ────────────────────────────────────────
  [ ] 무한 루프 유도
  [ ] 대량 파일 생성
  [ ] 메모리 고갈 공격
  [ ] 디스크 채우기 공격
  [ ] API Rate Limit 고갈
  대응: 리소스 모니터 + Watchdog + 예산 한도

  카테고리 5: 무결성 훼손 (Integrity)
  ────────────────────────────────────────
  [ ] 시스템 파일 변조
  [ ] 설정 파일 조작
  [ ] 로그/감사 기록 삭제
  [ ] Git 히스토리 조작
  [ ] 다른 프로세스 간섭
  대응: Undo Stack + Hash 검증 + 읽기 전용 보호

  카테고리 6: 공급망 공격 (Supply Chain)
  ────────────────────────────────────────
  [ ] 악성 패키지 설치 유도
  [ ] 의존성 혼동 (dependency confusion)
  [ ] 스크립트 실행을 통한 백도어
  [ ] 플러그인을 통한 악성 코드
  [ ] 모델 응답 조작
  대응: 패키지 레지스트리 화이트리스트 + 서명 검증
```

---

## L-5. 버전 관리 및 마이그레이션 전략

### 버전 관리 대상

```
  대상                  버전 형식          예시
  ──────────────────────────────────────────────────
  JARVIS OS 전체       semver             v1.0.0
  Policy 스키마         날짜 기반          2025.01.15
  Action API           semver             v2.1.0
  State 스키마          정수               v3
  Plugin API           semver             v1.0.0
```

### 마이그레이션 흐름

```
  버전 업그레이드 시:

  1. 호환성 검사
     - 저장된 State → 새 스키마 매핑 가능?
     - 기존 Policy → 새 엔진에서 유효?
     - Plugin → 새 API 호환?

  2. 자동 마이그레이션
     - State: 마이그레이션 함수 체인 (v1→v2→v3)
     - Policy: 문법 변환기 (deprecated 필드 매핑)
     - Action: 하위 호환 유지 (새 필드는 optional)

  3. 수동 마이그레이션 Gate
     - 자동 변환 불가 시 사용자에게 안내
     - 변환 전/후 diff 표시
     - 승인 후 적용

  4. 롤백 지원
     - 마이그레이션 전 백업 자동 생성
     - 실패 시 이전 버전으로 자동 복원
     - 수동 롤백 명령 제공
```

### 하위 호환성 규칙

```
  변경 유형                  허용 여부     조건
  ──────────────────────────────────────────────────
  새 optional 필드 추가      ✅ 허용       기본값 필수
  기존 필드 타입 변경        ❌ 금지       새 필드로 추가
  필드 제거                  ⚠ 주의       deprecated 1버전 유지
  enum 값 추가               ✅ 허용       처리 누락 safe
  enum 값 제거               ❌ 금지       deprecated 마킹
  API 엔드포인트 제거        ❌ 금지       버전 분리 (v1/v2)
```

---

# M. 자기 교정 및 학습 시스템 (Self-Correction & Learning)

> 에이전트가 "기술적으로는 성공했지만 사용자가 원한 게 아닌" 시맨틱 에러를 감지하고 스스로 교정하는 시스템

---

## M-1. Correction Feedback Loop (교정 피드백 루프)

### 문제 정의

```
  현재 Recovery Agent는 "기술적 에러"만 처리한다:
  - API 실패, 권한 오류, 타임아웃 등

  그러나 실제로 더 빈번한 문제는 "시맨틱 에러":
  - 기술적으로 성공했지만 사용자가 원한 결과가 아님
  - 에이전트가 사용자 의도를 잘못 해석
  - 같은 유형의 실수를 반복
```

### 시맨틱 에러 감지 트리거

```
  트리거                          감지 방법                    신뢰도
  ──────────────────────────────────────────────────────────────────
  사용자 명시적 거부              Gate에서 Reject 클릭         100%
  사용자 수정 요청                "아니, ~해줘" 패턴 감지      95%
  사용자 Undo 요청                Rollback 수동 트리거         90%
  결과물 미사용                   생성 파일 즉시 삭제 감지     80%
  반복 동일 명령                  같은 명령 재입력 감지        75%
  부정적 피드백                   "이상해", "틀렸어" 등        85%
  결과물 대폭 수정                사용자가 직접 70%+ 수정      70%
```

### 교정 에스컬레이션 단계

```
  거부 횟수    대응 전략
  ──────────────────────────────────────────────────────────────
  1회          일반 재시도 + "이런 뜻인가요?" 명확화 질문
               → Intent Agent 재호출, 기존 결과를 "오답 예시"로 첨부

  2회          접근 방식 전체 변경 + 대안 3가지 제시
               → Planner 재실행, 이전 2개 실패 Plan을 "금지 패턴"으로 전달
               → 사용자에게 카드 UI로 3가지 대안 표시

  3회          에스컬레이션 → 구체적 지시 요청
               → "제가 정확히 이해하지 못하고 있습니다."
               → 구조화된 폼 제시: [무엇을] [어디서] [어떻게] [결과물 형태]
               → 이 응답은 Mistake Pattern DB에 고우선 기록

  4회+         해당 작업 유형에 대해 "항상 확인" 모드 전환
               → 이후 유사 요청은 실행 전 반드시 상세 확인
```

### 교정 흐름 다이어그램

```
  사용자 "아니야" / 거부 / 수정 요청
         │
         ▼
  ┌─ 오류 유형 자동 분류 ──────────────────────┐
  │                                              │
  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
  │  │ 의도 오해 │  │ 방식 오해 │  │ 범위 오해 │  │
  │  │(뭘 할지) │  │(어떻게)  │  │(어디까지)│  │
  │  └────┬─────┘  └────┬─────┘  └────┬─────┘  │
  │       │              │              │        │
  └───────┼──────────────┼──────────────┼────────┘
          │              │              │
          ▼              ▼              ▼
    Intent Agent    Planner         Spec 범위
    재호출 +        재실행 +        조정 +
    명확화 질문     대안 제시       사용자 확인
          │              │              │
          └──────────────┼──────────────┘
                         ▼
              교정된 결과 → 사용자 확인
                         │
                    ┌────┴────┐
                    │         │
                  승인       거부 → 에스컬레이션 +1
                    │
                    ▼
              Mistake Pattern DB 기록
              (다음번 같은 실수 방지)
```

### 오류 유형 분류 로직

```typescript
interface CorrectionClassifier {
  classify(context: CorrectionContext): CorrectionType;
}

type CorrectionType =
  | 'intent_mismatch'      // 의도 자체를 잘못 파악
  | 'approach_mismatch'    // 의도는 맞지만 방법이 잘못됨
  | 'scope_mismatch'       // 방법은 맞지만 범위가 잘못됨
  | 'quality_mismatch'     // 범위도 맞지만 품질이 부족
  | 'style_mismatch';      // 기능은 맞지만 스타일/컨벤션 불일치

interface CorrectionContext {
  originalInput: string;
  generatedSpec: Spec;
  executedActions: Action[];
  userFeedback: string;         // 사용자가 말한 거부 이유
  previousAttempts: Attempt[];  // 이전 시도들
  userProfile: UserProfile;     // 사용자 선호도
}
```

---

## M-2. Agent Performance Scoring (에이전트 성적표)

### 성적표 스키마

```typescript
interface AgentScorecard {
  agentId: AgentId;
  period: { from: Date; to: Date };

  metrics: {
    // 핵심 지표
    totalRuns: number;
    successRate: number;         // 첫 시도 성공률
    correctionRate: number;      // 교정 필요 비율
    avgCorrections: number;      // 평균 교정 횟수

    // 상세 지표
    intentAccuracy: number;      // 의도 파악 정확도
    qualityScore: number;        // 결과물 품질 (사용자 평가 기반)
    speedScore: number;          // 응답 속도
    tokenEfficiency: number;     // 토큰 대비 품질

    // 카테고리별 성적
    byCategory: Record<TaskCategory, {
      runs: number;
      successRate: number;
      avgCorrections: number;
    }>;
  };

  trend: 'improving' | 'stable' | 'declining';
  alerts: ScoreAlert[];
}
```

### 성적 기반 자동 대응

```
  성적 구간          상태            자동 대응
  ──────────────────────────────────────────────────────────────────
  90-100%           우수            현재 전략 유지
  80-89%            양호            모니터링 강화
  70-79%            주의            프롬프트 전략 변경 검토
  60-69%            경고            모델 업그레이드 (Haiku→Sonnet→Opus)
  < 60%             위험            해당 에이전트 비활성화 + 대체 전략

  카테고리별 대응:
  ──────────────────────────────────────────────────────────────────
  특정 작업만 저성과    해당 작업 유형에 특화 프롬프트 추가
  전체적 저성과         모델 업그레이드 or 에이전트 재설계
  시간대별 저성과       API 부하 시간 회피 스케줄링
  특정 사용자만 저성과  사용자 프로필 기반 개인화 강화
```

### 성적표 대시보드 UI

```
┌─────────────────────────────────────────────────────────┐
│  📊 Agent Performance Dashboard                         │
│                                                         │
│  Intent & Spec    ████████░░ 82%  ↑ +3%  양호          │
│  Policy & Risk    █████████░ 94%  → 0%   우수          │
│  Planner          ██████░░░░ 58%  ↓ -7%  경고 ⚠       │
│  Codegen          █████████░ 91%  ↑ +2%  우수          │
│  Review           ████████░░ 85%  → +1%  양호          │
│  Test & Build     █████████░ 93%  ↑ +4%  우수          │
│  Executor         ██████████ 99%  → 0%   우수          │
│  Recovery         ████████░░ 88%  ↑ +5%  양호          │
│                                                         │
│  ⚠ Planner: "코드 리팩터링" 카테고리 적중률 42%        │
│    → 권고: 리팩터링 전용 프롬프트 강화 적용             │
└─────────────────────────────────────────────────────────┘
```

---

## M-3. Mistake Pattern DB (실수 패턴 학습)

### 패턴 스키마

```json
{
  "mistakeId": "mis_001",
  "createdAt": "2025-01-15T10:30:00Z",
  "updatedAt": "2025-01-20T14:00:00Z",

  "trigger": {
    "inputPattern": "코드 정리해줘",
    "keywords": ["정리", "클린업", "clean"],
    "taskCategory": "code-refactoring"
  },

  "mistake": {
    "wrongInterpretation": "파일 삭제 후 재작성",
    "wrongAgent": "intent-spec",
    "wrongSpec": { "action": "delete_and_recreate" },
    "errorType": "intent_mismatch"
  },

  "correction": {
    "correctInterpretation": "포맷팅 + 변수명 정리 + 불필요 코드 제거",
    "correctSpec": { "action": "refactor_in_place" },
    "correctionSource": "user_rejection",
    "userFeedback": "삭제하지 말고 기존 파일에서 정리해줘"
  },

  "statistics": {
    "occurrences": 3,
    "lastOccurrence": "2025-01-20T14:00:00Z",
    "preventedCount": 12,
    "effectivenessRate": 0.92
  },

  "rule": {
    "type": "prompt_injection",
    "content": "주의: '정리'는 '삭제 후 재작성'이 아니라 '기존 코드를 유지하면서 리팩터링'입니다.",
    "appliesTo": ["intent-spec", "planner"],
    "priority": "high"
  }
}
```

### 패턴 활용 흐름

```
  새로운 사용자 입력
         │
         ▼
  Mistake Pattern DB 조회
  (입력 패턴 매칭)
         │
    ┌────┴────┐
    │         │
  매칭 있음  매칭 없음 → 일반 처리
    │
    ▼
  교정 규칙을 에이전트 프롬프트에 주입
  "주의: 이전에 이런 실수가 있었음. 올바른 해석은..."
         │
         ▼
  에이전트 실행 (교정 규칙 반영)
         │
         ▼
  결과 → 사용자 확인
         │
    ┌────┴────┐
    │         │
  성공       실패
    │         │
    ▼         ▼
  패턴       패턴 업데이트
  효과 +1    (규칙 강화)
```

### 패턴 만료 및 정리

```
  규칙                                   이유
  ──────────────────────────────────────────────────────
  90일 미발동 패턴 → 아카이브           오래된 규칙 정리
  effectiveness < 30% → 재검토          효과 없는 규칙 제거
  모순 패턴 감지 → 사용자 확인          상충하는 규칙 해결
  패턴 500개 초과 → 유사 패턴 병합      DB 비대화 방지
  사용자가 수동 삭제 가능               사용자 통제권 보장
```

---

## M-4. Adaptive Prompt Engineering (적응형 프롬프트)

### 프롬프트 레이어 구조

```
  Layer 1: Base Prompt (고정)
  ────────────────────────────
  에이전트 역할, 기본 규칙, 출력 형식

  Layer 2: Policy Context (런타임)
  ────────────────────────────
  현재 활성 정책, 작업 공간 프로필

  Layer 3: User Profile (개인화)
  ────────────────────────────
  사용자 선호도, 코딩 스타일, 과거 피드백

  Layer 4: Mistake Prevention (교정)
  ────────────────────────────
  Mistake Pattern DB에서 매칭된 교정 규칙

  Layer 5: Session Context (세션)
  ────────────────────────────
  현재 대화 맥락, 이전 시도 결과
```

### 프롬프트 자동 조정 예시

```
  상황: Planner가 "코드 리팩터링" 카테고리에서 적중률 42%

  자동 조정:
  ──────────────────────────────────────────────

  Before (기본 프롬프트):
  "사용자의 요청에 맞는 실행 계획을 생성하세요."

  After (강화 프롬프트):
  "사용자의 요청에 맞는 실행 계획을 생성하세요.

  ⚠ 리팩터링 작업 주의사항:
  - '정리' = 기존 파일 유지 + in-place 수정 (삭제/재생성 금지)
  - '개선' = 기능 변경 없이 코드 품질만 향상
  - '구조 변경' = 사용자에게 변경 전/후 구조를 반드시 확인
  - 파일 삭제는 명시적 요청이 있을 때만 Plan에 포함

  이전 실수 사례:
  - mis_001: '정리해줘' → 삭제 후 재작성 (잘못됨)
  - mis_007: '개선해줘' → 라이브러리 교체 (과도한 변경)"
```

---

## M-5. User Satisfaction Signal (사용자 만족도 시그널)

### 암시적 만족도 수집

```
  시그널                    해석              가중치
  ──────────────────────────────────────────────────────
  결과 즉시 사용           만족              +3
  결과 수정 없이 저장      만족              +2
  "고마워", "좋아" 등      만족              +3
  다음 작업으로 진행       만족              +1
  결과물 부분 수정         보통              0
  결과물 70%+ 수정         불만족            -2
  Undo / Rollback 요청     불만족            -3
  "아니", "다시" 등        불만족            -3
  동일 명령 재입력         불만족            -2
  세션 즉시 종료           불만족 (추정)     -1
```

### 만족도 점수 활용

```
  점수 구간      상태          시스템 대응
  ──────────────────────────────────────────────────────
  +8 이상       매우 만족      현재 전략 강화, 패턴 저장
  +4 ~ +7      만족           현재 전략 유지
  0 ~ +3       보통           모니터링
  -3 ~ -1      불만           교정 루프 활성화
  -4 이하       매우 불만      에스컬레이션 + 전략 변경
```

---

# N. 고급 기능 확장 (Advanced Features)

> 시스템의 지능, 사용성, 협업 능력을 한 단계 끌어올리는 8가지 고급 기능

---

## N-1. Semantic Memory Layer (시맨틱 메모리 계층)

### 개요

```
  Pattern Cache (K-3)는 단순 승인/거부 패턴만 기억한다.
  Semantic Memory는 이를 넘어서:
  - 세션 간 사용자 의도와 선호를 장기 학습
  - 프로젝트별 코딩 스타일과 컨벤션 기억
  - 유사 경험을 검색하여 더 정확한 응답 생성
```

### 메모리 유형 분류

```
  유형               예시                              TTL        저장소
  ──────────────────────────────────────────────────────────────────────
  User Preference    "TypeScript + Vitest 선호"        영구       Profile DB
  Coding Style       "import 순서: react → lib → local" 프로젝트   Workspace
  Domain Knowledge   "이 API는 v2 엔드포인트 사용"     프로젝트   Workspace
  Interaction Pattern "간결한 응답 선호"                영구       Profile DB
  Error Memory       "이 패턴은 항상 실패함"           90일       Pattern DB
  Context Memory     "어제 auth 모듈 작업 중이었음"    7일        Session DB
```

### 벡터 DB 기반 유사 경험 검색

```typescript
interface SemanticMemory {
  /** 메모리 저장 */
  store(entry: MemoryEntry): Promise<void>;

  /** 유사 경험 검색 (코사인 유사도) */
  search(query: string, options: SearchOptions): Promise<MemoryMatch[]>;

  /** 메모리 압축 (오래된 유사 항목 병합) */
  compact(): Promise<CompactionResult>;

  /** 메모리 삭제 (사용자 요청) */
  forget(filter: MemoryFilter): Promise<number>;
}

interface MemoryEntry {
  id: string;
  type: MemoryType;
  content: string;
  embedding: number[];          // 벡터 임베딩
  metadata: {
    source: 'user_feedback' | 'observation' | 'correction';
    confidence: number;
    projectId?: string;
    tags: string[];
  };
  createdAt: Date;
  expiresAt?: Date;
}

interface MemoryMatch {
  entry: MemoryEntry;
  similarity: number;           // 0.0 ~ 1.0
  relevance: 'direct' | 'related' | 'contextual';
}
```

### 메모리 활용 흐름

```
  사용자 입력: "이 코드 정리해줘"
         │
         ▼
  Semantic Memory 검색
         │
         ├── User Preference: "리팩터링 시 파일 구조 유지 선호"
         ├── Coding Style: "이 프로젝트는 Prettier + ESLint 사용"
         ├── Error Memory: "정리 = in-place 수정 (mis_001)"
         └── Context Memory: "어제 같은 파일에서 타입 추가 작업함"
         │
         ▼
  에이전트 프롬프트에 컨텍스트 주입
         │
         ▼
  더 정확한 Spec 생성
```

### 프라이버시 보호

```
  규칙                                          구현
  ──────────────────────────────────────────────────────────
  모든 메모리 로컬 저장 (외부 전송 없음)       SQLite + 로컬 벡터 DB
  사용자가 전체 메모리 열람 가능                 jarvis memory list
  개별 메모리 삭제 가능                         jarvis memory forget <id>
  전체 초기화 가능                              jarvis memory reset
  민감 데이터 자동 마스킹                       패턴 기반 필터 (API키, 비밀번호)
  메모리 내보내기/가져오기                       JSON export/import
```

---

## N-2. Intent Disambiguation UI (의도 분기 선택)

### 모호성 감지 기준

```
  기준                          예시                        모호성 점수
  ──────────────────────────────────────────────────────────────────────
  동사가 다의어                 "정리해줘" (clean/organize)  +30
  목적어 불명확                 "이거 고쳐줘" (뭘?)         +40
  범위 미지정                   "업데이트해줘" (어디까지?)   +25
  상충 해석 가능                "최적화해줘" (속도? 크기?)   +35
  이전 실수 패턴 매칭           Mistake DB에 유사 케이스     +20
  ──────────────────────────────────────────────────────────────────────
  합산 60점 이상 → Disambiguation UI 트리거
```

### Disambiguation 카드 UI

```
┌─────────────────────────────────────────────────────────────┐
│  🤔 "이 코드 정리해줘"를 어떻게 해석할까요?                 │
│                                                             │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │ 📝 코드 포맷팅      │  │ 🔄 리팩터링         │          │
│  │                     │  │                     │          │
│  │ Prettier + ESLint   │  │ 변수명 개선         │          │
│  │ 적용                │  │ 함수 분리           │          │
│  │                     │  │ 중복 제거           │          │
│  │ Risk: LOW (8)       │  │                     │          │
│  │ 예상: 5초           │  │ Risk: MEDIUM (35)   │          │
│  │ 파일: 1개 수정      │  │ 예상: 30초          │          │
│  │                     │  │ 파일: 3개 수정      │          │
│  │   [선택]            │  │                     │          │
│  └─────────────────────┘  │   [선택]            │          │
│                           └─────────────────────┘          │
│  ┌─────────────────────┐  ┌─────────────────────┐          │
│  │ 📁 폴더 구조 정리   │  │ 🗑️ 불필요 코드 삭제 │          │
│  │                     │  │                     │          │
│  │ 파일/폴더 재배치    │  │ dead code 제거      │          │
│  │ index 파일 정리     │  │ 미사용 import 삭제   │          │
│  │                     │  │                     │          │
│  │ Risk: MEDIUM (42)   │  │ Risk: LOW (15)      │          │
│  │ 예상: 45초          │  │ 예상: 10초          │          │
│  │ 파일: 8개 이동      │  │ 파일: 1개 수정      │          │
│  │                     │  │                     │          │
│  │   [선택]            │  │   [선택]            │          │
│  └─────────────────────┘  └─────────────────────┘          │
│                                                             │
│  [직접 설명하기]  [전부 다 해줘]                            │
└─────────────────────────────────────────────────────────────┘
```

### 선택 기록 → 학습 연동

```
  사용자 선택이 Semantic Memory에 자동 반영:

  입력: "정리해줘"
  선택: "코드 포맷팅"
  → 메모리: { "정리" → "포맷팅" 선호, confidence: 0.6 }

  다음번 "정리해줘":
  → 메모리 조회: 이전에 "포맷팅" 선택 (60%)
  → "이전에 포맷팅을 선택하셨는데, 이번에도 같은 의미인가요?" 제안
  → 3회 연속 같은 선택 → confidence: 0.9 → 자동 적용 (확인만)
```

---

## N-3. Action Replay & Macro System (매크로 녹화 시스템)

### 매크로 녹화 흐름

```
  1. 사용자가 일반 작업 실행
     $ jarvis run "React 컴포넌트 Button 만들어줘"

  2. 실행 완료 후 시스템이 매크로 저장 제안
     ┌─────────────────────────────────────────┐
     │  이 작업을 매크로로 저장할까요?          │
     │                                         │
     │  실행된 액션:                            │
     │  1. mkdir src/components/Button          │
     │  2. create Button.tsx (컴포넌트)         │
     │  3. create Button.test.tsx (테스트)      │
     │  4. create Button.module.css (스타일)    │
     │  5. update index.ts (export 추가)        │
     │                                         │
     │  [매크로로 저장]  [이번만]               │
     └─────────────────────────────────────────┘

  3. 매크로 저장 시 변수 추출
     → 자동 감지: "Button" → {{componentName}}
     → 자동 감지: "src/components/" → {{basePath}}
```

### 매크로 스키마

```json
{
  "macroId": "macro_react_component",
  "name": "React 컴포넌트 생성",
  "description": "컴포넌트 폴더 + tsx + test + css + export",
  "version": "1.0.0",
  "author": "user",

  "variables": [
    {
      "name": "componentName",
      "type": "string",
      "description": "컴포넌트 이름",
      "validation": "^[A-Z][a-zA-Z]*$",
      "example": "Button"
    },
    {
      "name": "basePath",
      "type": "path",
      "description": "컴포넌트 기본 경로",
      "default": "src/components/",
      "example": "src/components/"
    },
    {
      "name": "withTest",
      "type": "boolean",
      "description": "테스트 파일 포함 여부",
      "default": true
    }
  ],

  "steps": [
    {
      "action": "fs.mkdir",
      "args": { "path": "{{basePath}}{{componentName}}" }
    },
    {
      "action": "fs.create",
      "args": {
        "path": "{{basePath}}{{componentName}}/{{componentName}}.tsx",
        "template": "react-component"
      }
    },
    {
      "action": "fs.create",
      "args": {
        "path": "{{basePath}}{{componentName}}/{{componentName}}.test.tsx",
        "template": "react-test"
      },
      "condition": "{{withTest}}"
    },
    {
      "action": "fs.create",
      "args": {
        "path": "{{basePath}}{{componentName}}/{{componentName}}.module.css",
        "template": "css-module"
      }
    },
    {
      "action": "fs.appendExport",
      "args": {
        "path": "{{basePath}}index.ts",
        "export": "{{componentName}}"
      }
    }
  ],

  "tags": ["react", "component", "frontend"],
  "usageCount": 15,
  "lastUsed": "2025-01-20T14:00:00Z"
}
```

### 매크로 실행

```
  $ jarvis macro run react-component --componentName=Modal --withTest=false

  ✓ mkdir src/components/Modal
  ✓ create Modal.tsx
  ✓ create Modal.module.css
  ✓ update index.ts (export 추가)
  ⊘ Modal.test.tsx (스킵 - withTest=false)

  완료 (0.8s)
```

### 매크로 공유

```
  $ jarvis macro export react-component > react-component.macro.json
  $ jarvis macro import react-component.macro.json
  $ jarvis macro list

  Name                    Uses    Last Used       Author
  ──────────────────────────────────────────────────────
  react-component         15      2h ago          me
  api-endpoint            8       1d ago          team
  test-suite              12      3h ago          me
```

---

## N-4. Execution Cost Estimator (실행 비용 예측기)

### 비용 예측 카드 UI

```
┌─────────────────────────────────────────────────────────┐
│  💰 실행 전 예측 요약                                    │
│                                                         │
│  명령: "이 프로젝트를 TypeScript로 마이그레이션해줘"     │
│                                                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐     │
│  │ ⏱ 예상 시간  │  │ 🪙 예상 비용 │  │ ⚠ 위험도    │     │
│  │   2분 30초   │  │   $0.12     │  │  ████░░ 62  │     │
│  └─────────────┘  └─────────────┘  └─────────────┘     │
│                                                         │
│  📁 영향 범위                                           │
│  ├── 수정: 23개 파일 (.js → .ts)                        │
│  ├── 생성: 1개 파일 (tsconfig.json)                     │
│  ├── 삭제: 0개 파일                                     │
│  └── 패키지: +3 (typescript, @types/node, @types/react) │
│                                                         │
│  🤖 에이전트 호출 예측                                   │
│  ├── Intent & Spec:   ~1,500 tokens ($0.003)            │
│  ├── Planner:         ~3,000 tokens ($0.006)            │
│  ├── Codegen:         ~15,000 tokens ($0.09)  ← 최대   │
│  ├── Review:          ~2,000 tokens ($0.004)            │
│  └── Test & Build:    ~1,000 tokens ($0.002)            │
│                                                         │
│  [실행] [Plan만 보기] [매크로로 저장] [취소]             │
└─────────────────────────────────────────────────────────┘
```

### 예측 알고리즘

```typescript
interface CostEstimate {
  time: {
    estimated: number;          // 밀리초
    confidence: number;         // 0.0 ~ 1.0
    breakdown: Record<AgentId, number>;
  };
  cost: {
    estimated: number;          // USD
    breakdown: Record<AgentId, {
      inputTokens: number;
      outputTokens: number;
      cost: number;
    }>;
  };
  risk: {
    score: number;              // 0-100
    factors: string[];
  };
  impact: {
    filesModified: number;
    filesCreated: number;
    filesDeleted: number;
    packagesAdded: string[];
    packagesRemoved: string[];
    linesChanged: number;
  };
}
```

### 예측 정확도 피드백 루프

```
  예측 → 실행 → 실제 비용 측정 → 예측 모델 보정

  보정 방법:
  - 작업 유형별 실제 비용 이력 축적
  - 이력 기반 가중 평균으로 예측 보정
  - 편향(항상 과대/과소 예측) 자동 감지 및 보정
```

---

## N-5. Smart Context Collector (스마트 맥락 수집기)

### 자동 수집 소스

```
  소스                    수집 내용                    옵트인   우선순위
  ──────────────────────────────────────────────────────────────────────
  IDE / Editor           현재 열린 파일 목록            기본 ON   높음
  IDE 커서               현재 커서 위치 파일/줄         기본 ON   높음
  IDE 선택               하이라이트된 코드 블록         기본 ON   높음
  Git Status             변경/스테이징된 파일           기본 ON   높음
  Git Diff               최근 변경 내용                기본 ON   중간
  Git Log                최근 5개 커밋 메시지           기본 ON   낮음
  Terminal History       최근 10개 명령 + 출력          기본 ON   중간
  Clipboard              클립보드 현재 내용             기본 OFF  낮음
  Running Processes      실행 중인 dev 서버 등          기본 ON   낮음
  Current Branch         현재 git 브랜치                기본 ON   높음
  Package.json           프로젝트 의존성                기본 ON   중간
  Error Logs             최근 에러 메시지               기본 ON   높음
```

### 맥락 주입 전략

```
  모든 맥락을 항상 주입하면 토큰 낭비 → 선택적 주입

  Strategy 1: 관련성 기반 필터링
  ─────────────────────────────
  사용자 입력과 각 맥락의 관련성 점수 계산
  → 상위 3~5개만 프롬프트에 포함

  Strategy 2: 계층적 요약
  ─────────────────────────────
  상세 → 요약 → 한 줄 식으로 압축
  토큰 예산에 맞춰 상세도 조절

  Strategy 3: 지연 로딩
  ─────────────────────────────
  기본: 파일 목록만 제공
  에이전트가 필요 시 → 상세 내용 요청
```

### 맥락 수집기 인터페이스

```typescript
interface ContextCollector {
  /** 모든 소스에서 맥락 수집 */
  collect(): Promise<CollectedContext>;

  /** 관련성 기반 필터링 */
  filter(context: CollectedContext, query: string): FilteredContext;

  /** 토큰 예산에 맞춰 압축 */
  compress(context: FilteredContext, tokenBudget: number): CompressedContext;
}

interface CollectedContext {
  ide: {
    openFiles: string[];
    activeFile: { path: string; line: number; selection?: string };
    recentFiles: string[];
  };
  git: {
    branch: string;
    status: GitFileStatus[];
    recentDiff: string;
    recentCommits: GitCommit[];
  };
  terminal: {
    recentCommands: TerminalEntry[];
    runningProcesses: ProcessInfo[];
  };
  project: {
    type: ProjectType;
    dependencies: Record<string, string>;
    scripts: Record<string, string>;
  };
  errors: ErrorEntry[];
  clipboard?: string;
}
```

---

## N-6. Multi-Agent Debate Protocol (멀티 에이전트 토론)

### 토론 트리거 조건

```
  조건                                  토론 참여 에이전트
  ──────────────────────────────────────────────────────────────
  Risk Score 50~70 (경계 구간)         Policy + Planner + Review
  Plan 대안이 3개 이상 존재             Planner + Review
  보안 vs 편의성 트레이드오프           Policy + Planner
  성능 vs 안전성 트레이드오프           Planner + Test & Build
  이전에 같은 유형에서 실패 이력        전체 에이전트
```

### 토론 프로토콜

```
  Round 1: 제안 (Proposal)
  ─────────────────────────────
  Planner → Plan A 제안 (근거 포함)
  Planner → Plan B 제안 (대안)

  Round 2: 반론 (Critique)
  ─────────────────────────────
  Review  → Plan A의 약점 지적
  Review  → Plan B의 약점 지적
  Policy  → 각 Plan의 정책 위반 여부

  Round 3: 수정 (Revision)
  ─────────────────────────────
  Planner → Plan A' (반론 반영 수정)
  Planner → Plan B' (반론 반영 수정)

  합의: 점수 기반 최종 선택
  ─────────────────────────────
  각 참여 에이전트가 각 Plan에 점수 (1-10)
  가중 평균으로 최종 권고안 선정
```

### 토론 요약 UI

```
┌─────────────────────────────────────────────────────────┐
│  🗣 에이전트 토론 결과                                   │
│                                                         │
│  주제: "DB 마이그레이션 실행 방법"                       │
│                                                         │
│  Plan A: 직접 ALTER TABLE 실행                          │
│  ├── Planner: ⭐⭐⭐⭐ "빠르고 직관적"                    │
│  ├── Review:  ⭐⭐     "롤백 어려움"                     │
│  └── Policy:  ⭐⭐⭐   "위험하지만 허용 범위"            │
│  → 종합: 6.2 / 10                                      │
│                                                         │
│  Plan B: 마이그레이션 파일 생성 후 실행 ★ 권고           │
│  ├── Planner: ⭐⭐⭐   "추가 단계 필요"                  │
│  ├── Review:  ⭐⭐⭐⭐⭐ "버전 관리 + 롤백 가능"          │
│  └── Policy:  ⭐⭐⭐⭐  "안전한 접근"                     │
│  → 종합: 8.1 / 10                                      │
│                                                         │
│  💡 권고: Plan B (마이그레이션 파일 방식)                │
│  이유: 롤백 안전성이 높고 버전 관리가 가능합니다.       │
│                                                         │
│  [Plan B 실행] [Plan A 실행] [직접 결정] [취소]         │
└─────────────────────────────────────────────────────────┘
```

### 토론 비용 제한

```
  제한 항목                        기본값
  ──────────────────────────────────────────
  최대 라운드                      3
  라운드당 최대 토큰               2,000/에이전트
  토론 총 토큰 한도                15,000
  토론 시간 한도                   30초
  참여 에이전트 최대               4
  토론 활성화 최소 Risk Score      50
```

---

## N-7. Progressive Trust Escalation (점진적 신뢰 승급)

### 신뢰 점수 시스템

```typescript
interface TrustScore {
  userId: string;
  overall: number;                    // 0-100

  /** 작업 유형별 세분화 신뢰 점수 */
  byCategory: {
    fileOperations: number;           // 파일 조작
    packageManagement: number;        // 패키지 관리
    codeExecution: number;            // 코드 실행
    systemOperations: number;         // 시스템 작업
    networkOperations: number;        // 네트워크 작업
    destructiveOperations: number;    // 파괴적 작업
  };

  history: {
    totalRuns: number;
    consecutiveSuccess: number;       // 연속 성공 횟수
    lastIncident: Date | null;        // 마지막 문제 발생
    escalationCount: number;          // 승급 횟수
    deescalationCount: number;        // 강등 횟수
  };
}
```

### 승급 규칙

```
  FROM          TO            조건
  ──────────────────────────────────────────────────────────────
  Observe    → Suggest       20회 연속 성공 + 문제 0건
  Suggest    → Semi-Auto     50회 연속 성공 + 거부율 < 5%
  Semi-Auto  → Auto          100회 연속 성공 + 카테고리별 신뢰 80+
  ──────────────────────────────────────────────────────────────
  * 카테고리별 개별 승급 가능
    예: 파일 조작은 Auto, 시스템 작업은 Suggest
```

### 강등 규칙

```
  이벤트                              강등 수준
  ──────────────────────────────────────────────────────
  Rollback 1회                       경고 (유지)
  Rollback 3회 (24시간 내)           한 단계 강등
  사용자 명시적 거부 5회             한 단계 강등
  보안 사고 감지                     Observe로 즉시 강등
  사용자가 수동 강등 요청            요청대로 적용
  비정상 패턴 감지                   한 단계 강등 + 알림
```

### 승급 제안 UI

```
┌─────────────────────────────────────────────────────────┐
│  🎯 신뢰 레벨 승급 제안                                  │
│                                                         │
│  현재: Suggest 모드                                     │
│  파일 조작: 73회 연속 성공 (거부율 2%)                  │
│                                                         │
│  "파일 조작" 카테고리를 Semi-Auto로                     │
│  업그레이드하시겠습니까?                                 │
│                                                         │
│  변경 사항:                                             │
│  - LOW risk 파일 작업은 자동 실행                       │
│  - MEDIUM risk는 기존처럼 Gate 발동                     │
│  - 언제든 다시 Suggest로 돌아갈 수 있습니다             │
│                                                         │
│  [업그레이드]  [나중에]  [이 제안 끄기]                  │
└─────────────────────────────────────────────────────────┘
```

---

## N-8. Real-time Collaboration Mode (실시간 협업 모드)

### 협업 아키텍처

```
  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐
  │  User A       │     │  User B       │     │  User C       │
  │  (Owner)      │     │  (Reviewer)   │     │  (Observer)   │
  └──────┬───────┘     └──────┬───────┘     └──────┬───────┘
         │                     │                     │
         └─────────┬───────────┘                     │
                   │                                 │
         ┌────────▼────────┐                         │
         │  Collaboration   │◀────────────────────────┘
         │  Server          │
         │  (WebSocket)     │
         └────────┬────────┘
                  │
         ┌────────▼────────┐
         │  JARVIS Engine   │
         │  (동일 Run)      │
         └─────────────────┘
```

### 역할 기반 권한

```
  역할          명령 실행    Gate 승인    Plan 수정    관찰    채팅
  ──────────────────────────────────────────────────────────────────
  Owner         ✅           ✅           ✅           ✅     ✅
  Co-Owner      ✅           ✅           ✅           ✅     ✅
  Reviewer      ❌           ✅           ❌           ✅     ✅
  Observer      ❌           ❌           ❌           ✅     ✅
```

### 공동 승인 (Multi-Signature Gate)

```json
{
  "gateId": "gate_deploy_production",
  "approvalPolicy": {
    "type": "multi-sig",
    "required": 2,
    "total": 3,
    "approvers": ["user-a", "user-b", "user-c"],
    "timeout": "10m"
  },
  "currentApprovals": [
    { "user": "user-a", "decision": "approve", "at": "2025-01-15T10:30:00Z" },
    { "user": "user-b", "decision": "pending" },
    { "user": "user-c", "decision": "pending" }
  ],
  "status": "waiting_for_approval"   // 1/2 승인, 1개 더 필요
}
```

### 실시간 동기화 이벤트

```
  이벤트                    전파 대상         내용
  ──────────────────────────────────────────────────────────
  상태 전이                 전체              새 상태 + 에이전트 진행
  Gate 발동                 Reviewer+         승인 요청 알림
  Gate 응답                 전체              승인/거부 결과
  채팅 메시지               전체              사용자 간 실시간 대화
  Plan 변경                 전체              수정된 Plan diff
  에러 발생                 전체              에러 상세 + 복구 상태
  Run 완료                  전체              최종 결과 요약
```

### 협업 채팅 UI

```
┌─────────────────────────────────────────────────────────┐
│  💬 협업 채팅                              [3명 접속]    │
│                                                         │
│  user-a (Owner): 프로덕션 배포 시작합니다               │
│  ──────── Gate: Deploy Production (2/3 필요) ────────   │
│  user-a: ✅ 승인                                        │
│  user-c: Plan 3단계 순서가 바뀌어야 할 것 같은데요?     │
│  user-a: 확인했습니다. Plan 수정하겠습니다.              │
│  ──────── Plan 수정됨 (diff 보기) ───────────────────   │
│  user-b: ✅ 승인                                        │
│  ──────── Gate 통과 (2/3 승인) ──────────────────────   │
│  JARVIS: 배포를 시작합니다...                            │
│                                                         │
│  [메시지 입력...]                            [전송]      │
└─────────────────────────────────────────────────────────┘
```

---

# 보완 섹션 요약 (최종 업데이트)

```
  총 68개 보완 항목 반영 완료

  A. 아키텍처    (5개): Health Monitor, 통신 프로토콜, Degradation, Multi-Run, State Resume
  B. 보안        (6개): Clipboard, Screen Capture, Process Integrity, Prompt Injection, Network DLP, USB
  C. 거버넌스    (5개): Conflict Resolution, Policy Expiration, Delegation Chain, Abuse Prevention, Learning 검증
  D. Executor    (5개): Action DAG, Dry-Run, 리소스 모니터링, Multi-Window, Undo Stack
  E. UI/UX      (6개): 접근성, 알림 우선순위, 다국어, 모바일, 온보딩, 대시보드
  F. 음성/대화   (3개): 음성 인증, 다중 턴 관리, 선제적 제안
  G. 테스트      (4개): Integration Test, Chaos Engineering, Policy 시뮬레이션, 벤치마크
  H. 데이터      (3개): Log Rotation, Bundle Versioning, Offline-First
  I. 확장성      (4개): Plugin Architecture, Multi-OS, Multi-User, Model Hot-Swap
  J. 구현 기반   (6개): Monorepo, State Machine, CLI MVP, E2E 시나리오, 우선순위, Vertical Slice
  K. 런타임 지능 (5개): Token Budget, Watchdog, Pattern Cache, Workspace Profile, Recovery Playbook
  L. 개발자 경험 (5개): Agent SDK, Policy DSL, DevTools, Threat Model, Versioning
  M. 자기 교정   (5개): Correction Loop, Performance Scoring, Mistake DB, Adaptive Prompt, Satisfaction Signal
  N. 고급 기능   (8개): Semantic Memory, Disambiguation UI, Macro System, Cost Estimator,
                        Smart Context, Agent Debate, Trust Escalation, Collaboration Mode
```

---

# ============================================================

# 추가 기능 섹션: 신규 시스템 및 기존 보완 (O~T + 기존 보완 6건)

# ============================================================

# 아래는 기존 A~N 섹션 분석 후 도출된 추가 기능 6개(O~T)와

# 기존 설계의 빈틈을 메우는 보완 항목 6건입니다.

# ============================================================

---

# O. Context-Aware Task Prioritization (맥락 인식 작업 우선순위)

> 기존 A-4의 Multi-Run 정책은 FIFO/Emergency 수준의 단순 큐잉만 다룬다.
> 사용자의 **현재 작업 맥락**을 실시간 분석하여 자동 우선순위를 결정하는 시스템이 필요하다.

---

## O-1. 맥락 소스 및 우선순위 영향도

### 맥락 소스 정의

```
  소스                    수집 방법                    우선순위 영향도
  ──────────────────────────────────────────────────────────────────────
  IDE 에러 패널           IDE API / Language Server     +40 (에러 수정 긴급)
  빌드 실패 상태          터미널 출력 / CI 결과         +35 (빌드 복구 긴급)
  현재 편집 중인 파일      IDE 포커스 윈도우             +20 (관련 작업 우선)
  Git 상태               git status / diff             +15 (커밋 준비 중)
  캘린더 일정             캘린더 API (옵트인)           -30 (회의 중: 큐잉)
  시간대                  시스템 시계                   ±10 (업무 시간 외 감점)
  배터리 잔량 (노트북)    OS API                        -20 (저전력 시 큐잉)
  이전 Run 실패 이력      RunState 히스토리             +25 (재시도 우선)
```

### 맥락 기반 우선순위 엔진

```typescript
interface TaskPriorityContext {
  baseRequestPriority: 'NORMAL' | 'HIGH' | 'EMERGENCY';

  contextSignals: {
    ideErrorCount: number;           // 현재 IDE에 표시된 에러 수
    buildStatus: 'passing' | 'failing' | 'unknown';
    activeFileRelevance: number;     // 요청과 현재 편집 파일의 관련도 (0-1)
    gitDirtyFiles: number;           // 커밋되지 않은 변경 파일 수
    isInMeeting: boolean;            // 캘린더 기반 회의 중 여부
    timeOfDay: 'work_hours' | 'off_hours' | 'late_night';
    batteryLevel?: number;           // 0-100 (노트북)
    previousFailureCount: number;    // 같은 유형 이전 실패 횟수
    userActivityLevel: 'active' | 'idle' | 'away';
  };

  computedPriority: number;          // 0-100 최종 산출 점수
  schedulingDecision: 'immediate' | 'queued' | 'deferred' | 'blocked';
}
```

### 우선순위 산출 공식

```
  ComputedPriority =
    BasePriority (NORMAL=50, HIGH=75, EMERGENCY=100)
    + IDE 에러 관련 요청?   → +40
    + 빌드 실패 복구 요청?  → +35
    + 이전 실패 재시도?     → +25 × min(failCount, 3)
    + 현재 파일 관련?       → +20 × relevance
    + Git 긴급 (충돌 등)?   → +15
    - 회의 중?              → -30
    - 저전력 모드?          → -20
    - 심야 시간?            → -10

  스케줄링 결정:
  ────────────────────────────
  90-100  → immediate (즉시 실행, 진행 중 Run 일시정지)
  60-89   → immediate (현재 Run 완료 후 바로 시작)
  30-59   → queued (큐에 추가, 순서대로 실행)
  0-29    → deferred (사용자 명시 요청 시만 실행)
```

### 맥락 변화 감지 및 재우선순위

```
  맥락이 변화하면 큐 내 작업의 우선순위를 동적으로 재계산:

  이벤트                          재계산 조건
  ──────────────────────────────────────────────────────
  IDE 에러 발생/해결              에러 관련 작업 우선순위 재산출
  빌드 상태 변경                  빌드 관련 작업 재산출
  사용자 활동 상태 변경           idle → away: 비긴급 작업 지연
  회의 시작/종료                  회의 관련 감점 적용/해제
  Git 충돌 발생                   충돌 해결 작업 우선순위 상승
  배터리 임계값 도달              전력 절약 모드 진입

  재계산 빈도: 최대 30초마다 (성능 보호)
```

### UI 표시

```
  TopStatusBar에 추가:
  ┌──────────────────────────────────────────────────────┐
  │ ... QUEUE: 3 tasks │ Next: "빌드 수정" (P:87) │ ... │
  └──────────────────────────────────────────────────────┘

  Timeline에 큐 뷰 추가:
  ┌─────────────────────────────────────────┐
  │  📋 작업 큐                              │
  │  1. 빌드 에러 수정     P:87  ⏳ 즉시     │
  │  2. 컴포넌트 생성      P:55  ⏳ 대기      │
  │  3. README 업데이트    P:22  📅 지연      │
  │                                         │
  │  [우선순위 변경] [큐 비우기]              │
  └─────────────────────────────────────────┘
```

---

## O-2. 맥락 기반 자동 작업 제안

```
  감지된 맥락                  자동 제안
  ──────────────────────────────────────────────────────────────
  IDE에 TypeError 5개          "타입 에러 5개를 수정할까요?"
  빌드 실패 + 에러 로그        "빌드 에러를 분석하고 수정할까요?"
  git merge 충돌 감지          "충돌을 해결할까요?"
  테스트 실패 감지             "실패한 테스트를 분석할까요?"
  디스크 90% 사용              "불필요한 캐시를 정리할까요?"
  npm audit 취약점 발견        "보안 취약점을 업데이트할까요?"

  제안 규칙:
  - Trust Mode가 Observe/Suggest일 때만 제안 (Semi-auto/Auto는 자동 처리)
  - 1시간 내 같은 제안 반복 금지
  - 사용자가 "이 제안 끄기" 선택 시 해당 유형 비활성화
```

---

# P. Natural Language Policy Feedback (자연어 정책 생성/수정)

> 기존 L-2의 Policy DSL은 개발자 전용이다.
> 비개발자 사용자가 **자연어로 정책을 생성/수정/삭제**할 수 있는 시스템이 필요하다.

---

## P-1. 자연어 → 정책 변환 파이프라인

### 변환 흐름

```
  사용자 자연어 입력
         │
         ▼
  ┌──────────────────┐
  │ Intent & Spec    │  자연어를 정책 의도로 분석
  │ Agent            │  - 대상: 무엇을 (파일? 앱? 도메인?)
  │                  │  - 행위: 무엇을 하지 말라? 허용하라?
  │                  │  - 범위: 어디까지?
  │                  │  - 조건: 언제? 어떤 상황에서?
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ Policy Generator │  분석 결과를 Policy DSL로 변환
  │                  │
  │ 입력: 의도 분석  │
  │ 출력: Policy DSL │
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ Policy Validator │  생성된 정책의 유효성 검증
  │                  │  - 문법 검증
  │                  │  - 기존 정책과 충돌 검사
  │                  │  - 시뮬레이션 (영향 분석)
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ 사용자 확인 Gate │  변환 결과를 사용자에게 표시
  │                  │  "이렇게 이해했는데 맞나요?"
  └────────┬─────────┘
           │
      ┌────┴────┐
      │         │
    승인       수정 요청 → 재변환
      │
      ▼
  정책 등록 + 계약서 업데이트
```

### 변환 예시

```
  사용자 입력: "내 사진 폴더는 절대 건드리지 마"

  AI 분석:
  ─────────
  대상: ~/Pictures/** (사진 폴더)
  행위: 모든 파일 작업 차단 (read/write/delete/move)
  범위: 해당 폴더 및 모든 하위 폴더
  조건: 무조건 (예외 없음)
  강도: "절대" → Contract 레벨 (최우선 정책)

  생성된 Policy DSL:
  ─────────────────
  POLICY "protect-photos" {
    LEVEL: CONTRACT    // "절대" → 최우선
    SCOPE: ~/Pictures/**

    BLOCK {
      file.read    IN ~/Pictures/**
      file.write   IN ~/Pictures/**
      file.delete  IN ~/Pictures/**
      file.move    FROM ~/Pictures/**
      file.move    TO ~/Pictures/**
      file.create  IN ~/Pictures/**
    }

    METADATA {
      source: "natural_language"
      original: "내 사진 폴더는 절대 건드리지 마"
      created_at: "2026-03-02T..."
    }
  }
```

### 다양한 자연어 패턴 처리

```
  패턴                          해석                           정책 레벨
  ──────────────────────────────────────────────────────────────────────
  "절대 ~하지 마"               무조건 차단                    CONTRACT
  "~하지 마"                    기본 차단                      BLOCKLIST
  "~할 때는 물어봐"             Gate 필수                      GATE
  "~는 알아서 해도 돼"          자동 허용                      ALLOWLIST
  "~할 때 조심해"               위험도 상향 조정               RISK_ADJUSTMENT
  "~는 나한테 보여줘만"         관찰 모드 강제                 OBSERVE_ONLY
  "~은 이전처럼 해"             이전 패턴 참조                 PATTERN_REF
```

## P-2. 자연어 정책 수정/삭제

```
  수정 예시:
  ──────────
  사용자: "아까 사진 폴더 보호한 거, 읽기는 허용해줘"

  AI 분석:
  - 대상 정책: "protect-photos"
  - 수정 내용: file.read를 BLOCK에서 제거 → ALLOW로 이동
  - 기존 정책과 diff 생성

  표시:
  ┌─────────────────────────────────────────────────┐
  │  🔄 정책 수정: protect-photos                    │
  │                                                 │
  │  변경 사항:                                      │
  │  - file.read: BLOCK → ALLOW (사진 폴더)          │
  │                                                 │
  │  ⚠ 이 변경으로 AI가 사진 폴더의 파일을            │
  │    읽을 수 있게 됩니다. (수정/삭제는 여전히 차단)  │
  │                                                 │
  │  [승인] [취소] [원본 유지]                        │
  └─────────────────────────────────────────────────┘


  삭제 예시:
  ──────────
  사용자: "사진 폴더 보호 해제해줘"

  표시:
  ┌─────────────────────────────────────────────────┐
  │  ⚠ 정책 삭제: protect-photos                     │
  │                                                 │
  │  이 정책을 삭제하면:                              │
  │  - ~/Pictures/** 폴더에 대한 모든 보호가 해제됩니다│
  │  - AI가 해당 폴더의 파일을 자유롭게 조작할 수 있습니다│
  │                                                 │
  │  정말 삭제하시겠습니까?                           │
  │  확인 문구를 입력하세요: "사진 보호 해제"         │
  │                                                 │
  │  [삭제] [취소]                                   │
  └─────────────────────────────────────────────────┘
```

## P-3. 정책 변환 정확도 보장

```
  정확도 보장 메커니즘:
  ─────────────────────

  1. 모호성 감지
     - "이 폴더" → 어떤 폴더? → 명확화 질문
     - "가끔 허용" → 조건이 불명확 → 구체적 조건 요청

  2. 역검증 (Reverse Validation)
     - 생성된 정책을 다시 자연어로 역번역
     - "이 정책은: AI가 사진 폴더의 모든 파일을 읽기/쓰기/삭제할 수 없습니다"
     - 사용자가 의도와 일치하는지 확인

  3. 시뮬레이션 결과 표시
     - "최근 100개 요청에 이 정책을 적용하면:"
     - "추가 차단: 3개 (사진 폴더 참조 작업)"
     - "영향 없음: 97개"

  4. 충돌 감지
     - 기존 정책과 모순되면 사용자에게 알림
     - "기존 allowlist에 ~/Pictures/exports/** 허용이 있습니다. 어떻게 할까요?"
```

## P-4. 정책 변환 상태 모델

```typescript
interface NLPolicyConversion {
  conversionId: string;
  status: 'analyzing' | 'generated' | 'validating' | 'awaiting_approval'
        | 'approved' | 'rejected' | 'revision_needed';

  input: {
    rawText: string;                    // 사용자 원문
    detectedIntent: PolicyIntent;
    confidence: number;                 // 변환 신뢰도 (0-1)
    ambiguities: string[];              // 감지된 모호성
  };

  output: {
    generatedDSL: string;               // Policy DSL 문자열
    reverseTranslation: string;          // 역번역 (확인용)
    conflictsDetected: PolicyConflict[];
    simulationResult: SimulationResult;
  };

  userDecision?: {
    action: 'approve' | 'reject' | 'modify';
    modifications?: string;             // 수정 요청 (자연어)
    decidedAt: string;
  };
}

type PolicyIntent = {
  target: string;          // 대상 (경로, 도메인, 앱 등)
  action: 'block' | 'allow' | 'gate' | 'observe' | 'adjust_risk';
  scope: string;           // 범위
  conditions?: string[];   // 조건
  strength: 'absolute' | 'strong' | 'moderate' | 'soft';
};
```

---

# Q. Ambient Awareness Mode (상시 감시/제안 모드)

> 기존 F-3의 Proactive Suggestion Engine은 패턴 기반 제안에 한정된다.
> Ambient Awareness는 **시스템 레벨 상시 모니터링**으로, 사용자가 요청하지 않아도
> OS/IDE/프로젝트 상태를 실시간 감시하여 **필요할 때 알아서 제안하는** 백그라운드 시스템이다.

---

## Q-1. 감시 계층 구조

### 감시 레이어 아키텍처

```
  ┌─────────────────────────────────────────────────────────┐
  │              Ambient Awareness Engine                     │
  ├─────────────────────────────────────────────────────────┤
  │                                                         │
  │  Layer 1: OS Monitor (시스템 레벨)                       │
  │  ├── 디스크 사용량 변화 추적                              │
  │  ├── CPU/메모리 이상 패턴 감지                            │
  │  ├── 네트워크 상태 변화 감지                              │
  │  ├── 배터리 상태 모니터링 (노트북)                        │
  │  ├── 새 USB/외부 장치 연결 감지                           │
  │  └── OS 업데이트/재시작 예정 감지                         │
  │                                                         │
  │  Layer 2: IDE/개발 환경 Monitor                          │
  │  ├── 에러/경고 수 변화 추적                               │
  │  ├── 빌드/테스트 상태 변화                                │
  │  ├── Git 상태 변화 (충돌, 브랜치, stash)                  │
  │  ├── 의존성 취약점 감지 (npm audit 등)                    │
  │  ├── 오래된 브랜치/PR 감지                                │
  │  └── 코드 커버리지 변화                                   │
  │                                                         │
  │  Layer 3: 프로젝트 Health Monitor                         │
  │  ├── node_modules 크기 이상 증가                          │
  │  ├── 로그 파일 누적                                      │
  │  ├── 임시 파일 누적                                      │
  │  ├── .env 파일 변경 감지                                  │
  │  ├── lockfile 불일치 감지                                 │
  │  └── 설정 파일 문법 오류 감지                             │
  │                                                         │
  │  Layer 4: 사용자 행동 패턴 Monitor                        │
  │  ├── 같은 에러 반복 발생 감지                             │
  │  ├── 같은 파일 반복 열기/닫기 감지                        │
  │  ├── 장시간 비활동 감지                                   │
  │  ├── 반복적 수동 작업 감지 (자동화 제안)                  │
  │  └── 야간/주말 작업 패턴 감지                             │
  │                                                         │
  └─────────────────────────────────────────────────────────┘
```

### 감시 항목별 임계값 및 제안

```
  감지 조건                           임계값                    제안 내용
  ──────────────────────────────────────────────────────────────────────────
  디스크 사용량 > 90%                 5분간 유지               "캐시 정리할까요?"
  CPU > 80% 지속                     10분간 유지              "리소스 과다 프로세스 확인할까요?"
  IDE 에러 > 10개 증가               최근 5분 내              "새 에러를 분석할까요?"
  빌드 실패 상태 지속                 3분 이상                 "빌드 에러를 수정할까요?"
  Git 충돌 미해결                     merge/rebase 이후        "충돌을 해결할까요?"
  npm audit 취약점 발견               의존성 변경 시           "보안 취약점을 업데이트할까요?"
  브랜치 3일 이상 미커밋              일일 체크                "브랜치를 정리할까요?"
  node_modules > 2GB                 주간 체크                "불필요 패키지를 정리할까요?"
  로그 파일 > 500MB 누적             일일 체크                "로그를 아카이빙할까요?"
  같은 에러 3회 이상 반복             10분 내                  "반복 에러를 도와드릴까요?"
  같은 수동 작업 3일 연속             일일 분석                "이 작업을 자동화할까요?"
  .env 파일 변경 감지                 파일 워치                "환경변수 변경을 확인할까요?"
  lockfile 불일치                     git pull 이후            "의존성 동기화가 필요합니다"
```

## Q-2. 감시 엔진 상태 모델

```typescript
interface AmbientAwarenessState {
  engineStatus: 'active' | 'paused' | 'sleeping' | 'disabled';

  monitors: {
    os: MonitorState;
    ide: MonitorState;
    project: MonitorState;
    behavior: MonitorState;
  };

  pendingSuggestions: AmbientSuggestion[];
  suppressedSuggestions: string[];          // 사용자가 끈 유형
  recentSuggestions: Array<{
    id: string;
    suggestedAt: string;
    accepted: boolean;
  }>;
}

interface MonitorState {
  status: 'healthy' | 'warning' | 'critical';
  lastCheckAt: string;
  alerts: MonitorAlert[];
}

interface AmbientSuggestion {
  id: string;
  source: 'os' | 'ide' | 'project' | 'behavior';
  severity: 'info' | 'warning' | 'urgent';
  title: string;
  description: string;
  suggestedAction: string;              // 제안할 명령
  estimatedImpact: string;             // "디스크 2GB 확보" 등
  estimatedCost: string;               // "~500 토큰" 등
  autoExecutable: boolean;             // Trust Mode에 따라 자동 실행 가능 여부
  expiresAt?: string;                  // 제안 유효 기간
}
```

## Q-3. 감시 모드와 Trust Mode 연동

```
  Trust Mode     감시 동작                    제안 방식
  ──────────────────────────────────────────────────────────────
  Observe        모든 레이어 감시              제안만 (실행 제안 없음)
                                              "참고: 디스크 90% 사용 중"
  ──────────────────────────────────────────────────────────────
  Suggest        모든 레이어 감시              실행 가능한 제안
                                              "디스크 90%. 정리할까요? [예] [아니오]"
  ──────────────────────────────────────────────────────────────
  Semi-Auto      모든 레이어 감시              LOW risk 자동 실행 + 나머지 제안
                                              로그 정리 등은 자동, 패키지 삭제는 제안
  ──────────────────────────────────────────────────────────────
  Auto           모든 레이어 감시              범위 내 자동 실행
                                              scope 내 모든 LOW/MED 자동 처리
                                              HIGH는 여전히 Gate
```

## Q-4. 리소스 보호 및 성능 제한

```
  Ambient Awareness 자체가 리소스를 낭비하면 안 됨:

  제한 항목                        기본값              설정 가능
  ──────────────────────────────────────────────────────────────
  감시 주기 (OS)                   60초               30초~5분
  감시 주기 (IDE)                  30초               10초~2분
  감시 주기 (프로젝트)             5분                 1분~30분
  감시 주기 (행동 패턴)            10분                5분~1시간
  CPU 사용 한도                    전체의 2% 미만      조정 가능
  메모리 사용 한도                 50MB 미만           조정 가능
  AI 호출 한도 (분석용)            시간당 5회          조정 가능
  제안 빈도 한도                   시간당 3개          조정 가능
  ──────────────────────────────────────────────────────────────
  절전 모드 진입 조건:
  - 배터리 < 20%
  - 사용자 30분 이상 미활동
  - DND 모드 활성화

  절전 시: OS 레이어만 최소 감시 (5분 주기), 나머지 중단
```

## Q-5. Ambient Awareness UI

```
  TopStatusBar에 표시:
  ┌──────────────────────────────────────────────────────────┐
  │ ... 👁 Ambient: ON │ Alerts: 2 │ ... │
  └──────────────────────────────────────────────────────────┘

  제안 토스트 (하단 또는 Chat 패널):
  ┌─────────────────────────────────────────────────┐
  │  💡 Ambient 제안                                 │
  │                                                 │
  │  node_modules가 3.2GB입니다.                     │
  │  미사용 패키지 12개를 감지했습니다.               │
  │  정리하면 약 1.8GB를 확보할 수 있습니다.          │
  │                                                 │
  │  [정리 실행] [상세 보기] [나중에] [이 유형 끄기]  │
  └─────────────────────────────────────────────────┘
```

---

# R. Task Chaining / Workflow Automation (작업 체이닝 / 워크플로우 자동화)

> 기존 N-3의 매크로 시스템은 **단일 작업의 반복 실행**에 한정된다.
> Task Chaining은 **조건부 분기, 에러 핸들링, 병렬 실행**이 포함된
> 복합 워크플로우를 정의하고 실행하는 시스템이다.

---

## R-1. 워크플로우 정의 스키마

```json
{
  "workflowId": "wf_morning_routine",
  "name": "출근 루틴",
  "description": "매일 아침 최신 코드 동기화 + 빌드 + 테스트",
  "version": "1.0.0",
  "author": "user",

  "trigger": {
    "type": "manual",
    "alternatives": [
      { "type": "schedule", "cron": "0 9 * * 1-5" },
      { "type": "event", "event": "system.login" },
      { "type": "voice", "pattern": "출근 루틴 시작해" }
    ]
  },

  "variables": {
    "branch": { "type": "string", "default": "main" },
    "runTests": { "type": "boolean", "default": true }
  },

  "steps": [
    {
      "id": "pull",
      "name": "최신 코드 가져오기",
      "action": "exec.run",
      "args": { "command": "git pull origin {{branch}}" },
      "onSuccess": "install",
      "onFailure": "handle_conflict"
    },
    {
      "id": "handle_conflict",
      "name": "충돌 해결 시도",
      "action": "ai.resolve_conflict",
      "args": {},
      "onSuccess": "install",
      "onFailure": "notify_conflict",
      "gate": "GATE_DESTRUCTIVE"
    },
    {
      "id": "notify_conflict",
      "name": "충돌 알림",
      "action": "notify.user",
      "args": { "message": "자동 충돌 해결에 실패했습니다. 수동 해결이 필요합니다." },
      "terminal": true
    },
    {
      "id": "install",
      "name": "의존성 설치",
      "action": "exec.run",
      "args": { "command": "pnpm install" },
      "onSuccess": "parallel_checks",
      "onFailure": "notify_install_fail"
    },
    {
      "id": "parallel_checks",
      "name": "빌드/테스트/린트 병렬 실행",
      "type": "parallel",
      "steps": [
        {
          "id": "build",
          "action": "exec.run",
          "args": { "command": "pnpm build" }
        },
        {
          "id": "test",
          "action": "exec.run",
          "args": { "command": "pnpm test" },
          "condition": "{{runTests}}"
        },
        {
          "id": "lint",
          "action": "exec.run",
          "args": { "command": "pnpm lint" }
        }
      ],
      "onAllSuccess": "report_success",
      "onAnyFailure": "handle_failure"
    },
    {
      "id": "handle_failure",
      "name": "실패 분석 및 수정 시도",
      "action": "ai.analyze_and_fix",
      "args": { "failedSteps": "{{failedSteps}}" },
      "maxRetries": 2,
      "onSuccess": "report_success",
      "onFailure": "report_failure"
    },
    {
      "id": "report_success",
      "name": "성공 보고",
      "action": "notify.user",
      "args": { "message": "출근 루틴 완료! 모든 체크 통과." },
      "terminal": true
    },
    {
      "id": "report_failure",
      "name": "실패 보고",
      "action": "notify.user",
      "args": { "message": "출근 루틴 중 문제 발생. 수동 확인이 필요합니다." },
      "terminal": true
    },
    {
      "id": "notify_install_fail",
      "name": "설치 실패 알림",
      "action": "notify.user",
      "args": { "message": "의존성 설치에 실패했습니다." },
      "terminal": true
    }
  ],

  "policy": {
    "trustMode": "semi-auto",
    "maxDuration": "10m",
    "maxTokenBudget": 20000,
    "gatesRequired": ["GATE_PLAN_SCOPE"]
  },

  "tags": ["routine", "daily", "dev"],
  "usageCount": 45,
  "lastRun": "2026-03-01T09:00:00Z",
  "avgDuration": "2m 15s"
}
```

## R-2. 워크플로우 Step 타입

```
  타입                설명                        예시
  ──────────────────────────────────────────────────────────────
  action              단일 액션 실행              exec.run, fs.write
  ai                  AI 에이전트 호출            ai.analyze_and_fix
  parallel            병렬 스텝 그룹              빌드 + 테스트 동시
  conditional         조건부 분기                 if hasTests → test
  wait                사용자 입력 대기            Gate 승인 대기
  notify              사용자에게 알림             진행 상황 보고
  loop                반복 실행                   파일 목록 순회
  delay               지정 시간 대기              빌드 안정화 대기
  sub_workflow        다른 워크플로우 호출         워크플로우 조합
```

## R-3. 워크플로우 트리거 타입

```
  트리거 타입          설명                        예시
  ──────────────────────────────────────────────────────────────
  manual              사용자 명시 실행            "출근 루틴 실행해"
  schedule            크론 스케줄                 매일 09:00
  event               시스템 이벤트               로그인, USB 연결
  voice               음성 명령 패턴              "빌드 돌려"
  file_watch          파일 변경 감지              src/ 변경 시
  git_hook            Git 이벤트                  push, merge, PR
  ambient             Ambient Awareness 연계      에러 감지 시 자동
  api                 외부 API 웹훅               CI/CD 결과 수신
```

## R-4. 자연어 워크플로우 생성

```
  사용자: "출근하면 자동으로 최신 코드 받고 빌드하고 테스트 돌려줘.
           실패하면 분석해서 수정 시도하고, 안 되면 알려줘."

  AI 해석 및 워크플로우 생성:
  ┌─────────────────────────────────────────────────────────┐
  │  🔄 워크플로우 생성: "출근 루틴"                         │
  │                                                         │
  │  1. git pull origin main                                │
  │     ├── 성공 → 2번으로                                  │
  │     └── 충돌 → 자동 해결 시도 → 실패 시 알림            │
  │  2. pnpm install                                        │
  │     └── 성공 → 3번으로                                  │
  │  3. 병렬 실행:                                          │
  │     ├── pnpm build                                      │
  │     ├── pnpm test                                       │
  │     └── pnpm lint                                       │
  │     ├── 모두 성공 → 완료 알림                           │
  │     └── 하나라도 실패 → AI 분석 + 수정 시도 (최대 2회)  │
  │         └── 실패 → 수동 확인 알림                       │
  │                                                         │
  │  트리거: 수동 실행 (스케줄 추가 가능)                    │
  │  예상 시간: ~2분   예상 비용: ~$0.05                     │
  │                                                         │
  │  [저장 및 실행] [저장만] [수정] [취소]                   │
  └─────────────────────────────────────────────────────────┘
```

## R-5. 워크플로우 관리 CLI

```
  $ jarvis workflow list
  Name              Trigger     Last Run      Avg Time   Uses
  ──────────────────────────────────────────────────────────────
  morning-routine   manual      2h ago        2m 15s     45
  deploy-staging    git:push    1d ago        5m 30s     12
  cleanup-weekly    cron:sun    5d ago        45s        8

  $ jarvis workflow run morning-routine
  $ jarvis workflow run morning-routine --branch=develop --runTests=false
  $ jarvis workflow create     # 대화형 생성
  $ jarvis workflow edit morning-routine
  $ jarvis workflow delete morning-routine
  $ jarvis workflow export morning-routine > morning.wf.json
  $ jarvis workflow import morning.wf.json
  $ jarvis workflow history morning-routine   # 실행 이력
  $ jarvis workflow dry-run morning-routine   # 시뮬레이션
```

## R-6. 워크플로우와 기존 시스템 통합

```
  통합 대상             연동 방식
  ──────────────────────────────────────────────────────────────
  Policy & Risk         워크플로우 실행 전 전체 스텝 사전 평가
  Gate System           위험 스텝은 Gate 자동 삽입
  Token Budget          워크플로우 전체 예산 사전 산출
  Audit Log             각 스텝 실행 기록 자동 저장
  Undo Stack            각 스텝별 롤백 포인트 자동 생성
  Ambient Awareness     감지 이벤트 → 워크플로우 자동 트리거
  Macro System          기존 매크로를 워크플로우 스텝으로 재사용
```

---

# S. Cross-Device Handoff (디바이스 간 작업 이관)

> 기존 E-4의 모바일 컴패니언은 "모니터링/승인"에 한정된다.
> Cross-Device Handoff는 **진행 중인 작업 자체를 다른 디바이스로 이관**하는 시스템이다.

---

## S-1. 핸드오프 아키텍처

```
  ┌──────────────┐         ┌──────────────────┐         ┌──────────────┐
  │  Device A    │         │  Handoff Server   │         │  Device B    │
  │  (Source)    │         │  (중계/동기화)     │         │  (Target)    │
  │              │         │                  │         │              │
  │  Run 진행 중 │────────▶│  상태 스냅샷 저장  │         │  대기 중      │
  │              │         │  + 암호화 전송    │────────▶│              │
  │              │         │                  │         │  상태 수신    │
  │  일시 정지   │         │  소유권 이전 확인  │         │  + 복원      │
  │              │         │                  │         │              │
  │  핸드오프    │         │  Device A 세션    │         │  Run 재개    │
  │  완료 (해제) │         │  무효화           │         │              │
  └──────────────┘         └──────────────────┘         └──────────────┘
```

## S-2. 핸드오프 대상 및 조건

```
  이관 가능한 것:
  ──────────────
  ✅ RunState 전체 (진행 상태, 타임라인, 게이트 큐)
  ✅ Gate 대기 상태 (다른 디바이스에서 승인)
  ✅ Environment Bundle (SPEC, PLAN, POLICY)
  ✅ 대화 컨텍스트 (ConversationContext)
  ✅ Token Budget 잔여량

  이관 불가능한 것:
  ──────────────
  ❌ Credential Vault (디바이스 바인딩)
  ❌ OS-specific 세션 (브라우저 쿠키, 로컬 프로세스)
  ❌ 실시간 Executor 액션 (진행 중인 OS 조작)
  ❌ 디바이스 전용 리소스 (로컬 파일 경로)

  이관 전 조건:
  ──────────────
  1. 현재 Run이 Gate 대기 또는 일시 정지 상태
  2. Target 디바이스에서 사용자 인증 완료
  3. Source와 Target의 프로젝트 경로 매핑 가능
  4. Source의 모든 미완료 Executor 액션 없음
```

## S-3. 핸드오프 프로토콜

```
  Phase 1: 핸드오프 요청
  ──────────────────────
  Source 또는 Target에서 요청:
  - "이 작업을 회사 PC에서 이어해줘" (Source → Target)
  - "집 PC에서 하던 작업 가져와" (Target ← Source)

  Phase 2: 상태 직렬화
  ──────────────────────
  Source:
  1. 현재 Run 일시 정지
  2. RunState 전체 직렬화
  3. Environment Bundle 패키징
  4. 로컬 경로 → 논리 경로 변환
     /Users/daniel/projects/app → $PROJECT_ROOT
  5. 암호화 (디바이스 간 전송용)

  Phase 3: 전송 및 수신
  ──────────────────────
  - 암호화된 스냅샷을 Target으로 전송
  - 직접 전송 (LAN) 또는 중계 서버 경유
  - 전송 완료 확인 (해시 검증)

  Phase 4: 상태 복원
  ──────────────────────
  Target:
  1. 스냅샷 복호화
  2. 논리 경로 → Target 로컬 경로 변환
     $PROJECT_ROOT → /home/daniel/projects/app
  3. RunState 복원
  4. 만료된 Capability 재발급 (새 Gate)
  5. 사용자에게 복원 상태 표시

  Phase 5: 소유권 이전
  ──────────────────────
  - Source 세션 무효화
  - Target이 새로운 유일한 소유자
  - Source에서 해당 Run 접근 불가 (읽기 전용 이력만)
```

## S-4. 핸드오프 상태 모델

```typescript
interface HandoffState {
  handoffId: string;
  status: 'requesting' | 'serializing' | 'transferring' | 'restoring'
        | 'completed' | 'failed' | 'cancelled';

  source: {
    deviceId: string;
    deviceName: string;
    os: 'WINDOWS' | 'MAC' | 'LINUX';
    projectPath: string;
  };

  target: {
    deviceId: string;
    deviceName: string;
    os: 'WINDOWS' | 'MAC' | 'LINUX';
    projectPath: string;
  };

  payload: {
    runId: string;
    snapshotSize: number;           // bytes
    encryptionMethod: string;
    hashVerification: string;       // sha256
  };

  pathMapping: Record<string, string>;    // 논리 경로 → 실제 경로
  capabilitiesExpired: string[];          // 재발급 필요한 Capability
  transferStartedAt: string;
  transferCompletedAt?: string;
}
```

## S-5. 핸드오프 보안

```
  보안 규칙:
  ──────────────
  1. 디바이스 인증
     - 양쪽 디바이스 모두 동일 사용자 인증 필수
     - 새 디바이스 첫 핸드오프 시 추가 인증 (2FA)
     - 신뢰 디바이스 목록 관리

  2. 전송 보안
     - 모든 전송 데이터 AES-256 암호화
     - 일회성 세션 키 사용
     - 중계 서버는 암호화된 데이터만 보관 (복호화 불가)
     - 전송 완료 후 중계 데이터 즉시 삭제

  3. 소유권 규칙
     - 동시 2개 디바이스에서 같은 Run 실행 불가
     - 핸드오프 완료 시 Source 세션 강제 무효화
     - Capability는 이관되지 않음 (Target에서 재발급)

  4. 경로 보안
     - Source의 절대 경로가 Target에 노출되지 않음
     - 논리 경로 ($PROJECT_ROOT) 사용
     - Target에서 경로 매핑 실패 시 수동 매핑 요청
```

## S-6. 핸드오프 UI

```
  Source 디바이스:
  ┌─────────────────────────────────────────────────────────┐
  │  📤 작업 이관                                            │
  │                                                         │
  │  Run: "코드 리팩터링" (Gate #2 대기 중)                  │
  │                                                         │
  │  이관 대상 디바이스:                                     │
  │  ┌──────────────────┐  ┌──────────────────┐            │
  │  │ 🖥 회사 PC        │  │ 💻 MacBook       │            │
  │  │ Windows          │  │ macOS            │            │
  │  │ 마지막 접속: 1h   │  │ 마지막 접속: 5m   │            │
  │  │ [이관]           │  │ [이관]           │            │
  │  └──────────────────┘  └──────────────────┘            │
  │                                                         │
  │  [취소]                                                 │
  └─────────────────────────────────────────────────────────┘

  Target 디바이스:
  ┌─────────────────────────────────────────────────────────┐
  │  📥 작업 수신                                            │
  │                                                         │
  │  "노트북 PC"에서 작업을 이관받았습니다.                   │
  │                                                         │
  │  Run: "코드 리팩터링"                                    │
  │  상태: Gate #2 대기 중 (코드 변경 승인)                  │
  │  경로 매핑: ✅ 자동 완료                                 │
  │  Capability: ⚠ 2개 만료 → 재발급 Gate 필요              │
  │                                                         │
  │  [이어서 진행] [상태만 확인] [거부]                      │
  └─────────────────────────────────────────────────────────┘
```

---

# T. Explainability Report (설명 보고서 시스템)

> 기존 Audit Log는 기술적 로그에 가깝다.
> 비기술 사용자를 위한 **"AI가 뭘 했는지" 이해하기 쉬운 요약 보고서** 시스템이 필요하다.

---

## T-1. 보고서 유형

```
  유형               주기           대상              핵심 내용
  ──────────────────────────────────────────────────────────────────
  실행 보고서         Run 완료 시    개별 Run          무엇을 했고 결과가 어땠는지
  일간 보고서         매일 22:00    하루 전체          오늘의 활동 요약
  주간 보고서         매주 월요일    1주 전체          주간 트렌드 + 인사이트
  보안 보고서         주간           보안 이벤트        위험 탐지/차단/이상 패턴
  비용 보고서         월간           토큰/비용          사용량 + 최적화 제안
  사고 보고서         사고 발생 시   개별 사고          원인 분석 + 재발 방지
```

## T-2. 실행 보고서 (Run Report)

```
  ┌─────────────────────────────────────────────────────────────┐
  │  📋 실행 보고서                                              │
  │  Run ID: run_20260302_0015                                  │
  │  시작: 14:30 → 완료: 14:32 (2분 15초)                       │
  │                                                             │
  │  📝 요청                                                    │
  │  "React Button 컴포넌트를 만들어줘"                          │
  │                                                             │
  │  ✅ 결과                                                    │
  │  4개 파일을 생성했습니다:                                    │
  │  + src/components/Button/Button.tsx    (컴포넌트)            │
  │  + src/components/Button/Button.test.tsx (테스트)            │
  │  + src/components/Button/Button.module.css (스타일)          │
  │  + src/components/Button/index.ts     (export)              │
  │                                                             │
  │  🛡 보안                                                    │
  │  위험도: LOW (12점)                                         │
  │  차단된 작업: 없음                                          │
  │  Gate 승인: 1회 (계획 승인)                                 │
  │                                                             │
  │  💰 비용                                                    │
  │  토큰 사용: 4,200 (입력: 2,800 / 출력: 1,400)              │
  │  예상 비용: $0.008                                          │
  │  에이전트 호출: 5회                                          │
  │                                                             │
  │  🔍 상세 타임라인                                            │
  │  14:30:00  요청 수신                                        │
  │  14:30:02  스펙 생성 완료                                   │
  │  14:30:03  정책 평가: LOW risk                               │
  │  14:30:05  계획 생성 (4개 파일)                              │
  │  14:30:06  사용자 승인 (Gate #1)                            │
  │  14:30:45  코드 생성 완료                                   │
  │  14:31:20  리뷰 통과                                        │
  │  14:31:50  테스트 통과                                      │
  │  14:32:00  파일 적용 완료                                   │
  │  14:32:15  실행 완료                                        │
  │                                                             │
  │  [되돌리기] [비슷한 작업 반복] [닫기]                       │
  └─────────────────────────────────────────────────────────────┘
```

## T-3. 일간 보고서 (Daily Report)

```
  ┌─────────────────────────────────────────────────────────────┐
  │  📊 일간 보고서: 2026년 3월 2일                             │
  │                                                             │
  │  ══ 오늘의 요약 ══                                          │
  │                                                             │
  │  총 실행: 18회                                              │
  │  ├── 성공: 16회 (89%)                                      │
  │  ├── 차단: 1회 (위험 웹사이트 접근 시도)                    │
  │  └── 실패: 1회 (네트워크 타임아웃 → 재시도 성공)            │
  │                                                             │
  │  ══ 활동 분류 ══                                            │
  │                                                             │
  │  코드 생성      ████████ 8회                                │
  │  파일 조작      ████ 4회                                    │
  │  패키지 관리    ██ 2회                                      │
  │  빌드/테스트    ██ 2회                                      │
  │  코드 분석      █ 1회                                       │
  │  웹 검색        █ 1회                                       │
  │                                                             │
  │  ══ 보안 이벤트 ══                                          │
  │                                                             │
  │  ⛔ 차단: example-suspicious.com 접근 시도                   │
  │     → URL 신뢰도 점수: 15/100 (피싱 의심)                   │
  │     → 정책에 의해 자동 차단                                  │
  │                                                             │
  │  ⚠ 주의: npm install 시 typosquatting 의심 패키지 탐지       │
  │     → "1odash" (lodash와 유사) → Gate에서 거부              │
  │                                                             │
  │  ══ Gate 통계 ══                                            │
  │                                                             │
  │  Gate 발동: 12회                                            │
  │  ├── 승인: 10회 (평균 응답: 3.2초)                         │
  │  ├── 거부: 2회                                              │
  │  └── 자동 승인 (패턴): 5회                                  │
  │                                                             │
  │  ══ 비용 ══                                                 │
  │                                                             │
  │  토큰 사용: 67,400                                          │
  │  예상 비용: $0.14                                           │
  │  이번 주 누적: $0.82 / $5.00 예산                           │
  │  ██████████████░░░░░░ 16%                                   │
  │                                                             │
  │  ══ 인사이트 ══                                             │
  │                                                             │
  │  💡 "pnpm build" 명령을 오늘 6번 수동 실행했습니다.          │
  │     워크플로우로 자동화하시겠습니까? [자동화 제안 보기]      │
  │                                                             │
  │  💡 src/utils/ 폴더에 사용되지 않는 파일 3개가 있습니다.    │
  │     정리하시겠습니까? [정리 제안 보기]                       │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
```

## T-4. 주간 보고서 (Weekly Report)

```
  ┌─────────────────────────────────────────────────────────────┐
  │  📊 주간 보고서: 2026년 2월 24일 ~ 3월 2일                  │
  │                                                             │
  │  ══ 주간 트렌드 ══                                          │
  │                                                             │
  │  총 실행: 89회 (전주 대비 +12%)                             │
  │  성공률: 92% (전주 88% → 개선)                              │
  │  평균 실행 시간: 1분 45초 (전주 2분 10초 → 개선)            │
  │                                                             │
  │  일별 활동량:                                               │
  │  월 ████████████ 22                                         │
  │  화 ██████████ 18                                           │
  │  수 ███████████ 20                                          │
  │  목 ████████ 15                                             │
  │  금 ███████ 14                                              │
  │                                                             │
  │  ══ 에이전트 성적 변화 ══                                   │
  │                                                             │
  │  Codegen:  91% → 93% (↑) 개선                              │
  │  Planner:  58% → 72% (↑) 크게 개선 (프롬프트 강화 효과)    │
  │  Review:   85% → 84% (→) 안정                              │
  │                                                             │
  │  ══ 학습 현황 ══                                            │
  │                                                             │
  │  새 패턴 학습: 5개                                          │
  │  ├── 자동 승인 패턴: 3개 (package install, file create 등)  │
  │  ├── 실수 패턴: 1개 ("정리" = 삭제가 아님)                  │
  │  └── 선호 패턴: 1개 (TypeScript 스타일 선호)                │
  │                                                             │
  │  제안된 정책: 2개                                           │
  │  ├── ✅ "npm install은 lockfile 검증 후 허용" (승인됨)      │
  │  └── ⏳ "야간 작업 시 Suggest 모드 강제" (검토 대기)        │
  │                                                             │
  │  ══ 비용 분석 ══                                            │
  │                                                             │
  │  주간 토큰: 342,000                                         │
  │  주간 비용: $0.82                                           │
  │  월간 예산 대비: 16% 사용                                   │
  │                                                             │
  │  비용 최적화 기회:                                          │
  │  💡 Review Agent 호출의 40%가 "항상 통과" 결과              │
  │     → LOW risk 코드는 Review 스킵 시 주당 $0.15 절감 가능  │
  │                                                             │
  │  ══ 보안 주간 요약 ══                                       │
  │                                                             │
  │  위험 이벤트: 2건 (모두 자동 차단)                          │
  │  Safety Hold: 0건                                           │
  │  정책 위반 시도: 1건 (시스템 폴더 접근)                     │
  │  패키지 취약점: 3개 발견 → 2개 업데이트 완료, 1개 대기      │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
```

## T-5. 사고 보고서 (Incident Report)

```
  ┌─────────────────────────────────────────────────────────────┐
  │  🚨 사고 보고서                                              │
  │  Incident ID: inc_20260302_001                              │
  │  심각도: MEDIUM                                             │
  │                                                             │
  │  ══ 사고 요약 ══                                            │
  │                                                             │
  │  14:45에 Executor가 예상치 못한 팝업 창을 감지하여          │
  │  Safety Hold가 발동되었습니다.                               │
  │                                                             │
  │  ══ 타임라인 ══                                             │
  │                                                             │
  │  14:43:00  사용자 요청: "크롬에서 docs.example.com 열어줘"  │
  │  14:43:05  URL Precheck: 통과 (reputation: 78/100)         │
  │  14:43:10  브라우저 실행 → 페이지 로딩                      │
  │  14:43:15  ⚠ 리다이렉트 감지: ads.suspicious.com           │
  │  14:43:16  🔴 Safety Hold 발동                              │
  │            사유: allowlist 밖 도메인으로 리다이렉트          │
  │  14:43:16  모든 브라우저 액션 즉시 중단                     │
  │  14:43:17  스크린샷 저장 (증거)                             │
  │  14:43:20  사용자에게 Safety Hold 알림                      │
  │                                                             │
  │  ══ 원인 분석 ══                                            │
  │                                                             │
  │  직접 원인: docs.example.com 페이지에 제3자 광고 스크립트가 │
  │            포함되어 있으며, 이 스크립트가 ads.suspicious.com │
  │            으로 자동 리다이렉트를 시도했습니다.              │
  │                                                             │
  │  근본 원인: URL Precheck가 최초 URL만 검사하고              │
  │            페이지 내 리다이렉트 스크립트를 사전 탐지하지     │
  │            못했습니다.                                      │
  │                                                             │
  │  ══ 조치 현황 ══                                            │
  │                                                             │
  │  ✅ Safety Hold로 즉시 차단 (데이터 유출 없음)              │
  │  ✅ ads.suspicious.com을 blocklist에 자동 추가              │
  │  ⏳ docs.example.com 신뢰도 점수 하향 조정 제안 (검토 중)  │
  │                                                             │
  │  ══ 재발 방지 정책 제안 ══                                  │
  │                                                             │
  │  1. 페이지 로딩 후 5초간 리다이렉트 모니터링 추가           │
  │  2. 제3자 스크립트 도메인도 allowlist 검증 대상에 포함      │
  │                                                             │
  │  이 정책을 적용하시겠습니까?                                │
  │  [적용] [수정 후 적용] [보류]                               │
  └─────────────────────────────────────────────────────────────┘
```

## T-6. 보고서 생성 엔진

```typescript
interface ReportGenerator {
  /** 실행 보고서 생성 */
  generateRunReport(runId: string): Promise<RunReport>;

  /** 일간 보고서 생성 */
  generateDailyReport(date: Date): Promise<DailyReport>;

  /** 주간 보고서 생성 */
  generateWeeklyReport(weekStart: Date): Promise<WeeklyReport>;

  /** 보안 보고서 생성 */
  generateSecurityReport(period: DateRange): Promise<SecurityReport>;

  /** 비용 보고서 생성 */
  generateCostReport(period: DateRange): Promise<CostReport>;

  /** 사고 보고서 생성 */
  generateIncidentReport(incidentId: string): Promise<IncidentReport>;
}

interface ReportConfig {
  /** 보고서 자동 생성 여부 */
  autoGenerate: {
    runReport: boolean;        // Run 완료 시 자동 생성
    dailyReport: boolean;      // 매일 자동 생성
    weeklyReport: boolean;     // 매주 자동 생성
  };

  /** 보고서 상세도 */
  detailLevel: 'summary' | 'standard' | 'detailed';

  /** 보고서 전달 방식 */
  delivery: {
    inApp: boolean;            // 앱 내 표시
    email?: string;            // 이메일 전송 (옵트인)
    file?: string;             // 파일 저장 경로
  };

  /** 보고서 보관 기간 */
  retention: {
    runReports: number;        // 일 (기본: 30)
    dailyReports: number;      // 일 (기본: 90)
    weeklyReports: number;     // 일 (기본: 365)
    incidentReports: number;   // 일 (기본: 무기한)
  };
}
```

## T-7. 보고서 CLI

```
  $ jarvis report run run_20260302_0015     # 특정 Run 보고서
  $ jarvis report daily                     # 오늘 일간 보고서
  $ jarvis report daily 2026-03-01          # 특정 날짜
  $ jarvis report weekly                    # 이번 주간 보고서
  $ jarvis report security                  # 최근 보안 보고서
  $ jarvis report cost                      # 이번 달 비용 보고서
  $ jarvis report incident inc_001          # 특정 사고 보고서
  $ jarvis report export --format=pdf       # PDF 내보내기
  $ jarvis report export --format=json      # JSON 내보내기
```

---

# ============================================================

# 기존 설계 보완 항목 (6건)

# ============================================================

# 아래는 기존 A~N 섹션에서 발견된 빈틈을 메우는 보완 항목입니다.

# ============================================================

---

# 보완 1: Irreversible External Actions (비가역 외부 부작용 방어)

> 기존 D-5의 Undo Stack에서 BROWSER_*는 "되돌릴 수 없음"이라고만 되어 있다.
> 웹 폼 제출, 이메일 발송, API 호출 등 **외부 부작용이 있는 액션**에 대한
> 별도 경고/방어 전략이 필요하다.

---

## 외부 부작용 액션 분류

```
  위험 등급          액션 유형                    예시
  ──────────────────────────────────────────────────────────────────
  CRITICAL           금전 거래                    결제 API 호출
  (절대 자동 금지)   이메일/메시지 발송           SMTP send, Slack post
                     계정 설정 변경               패스워드 변경, 권한 수정
                     데이터 영구 삭제             API DELETE 호출
                     공개 게시                    SNS 포스트, PR 생성

  HIGH               외부 API POST/PUT/DELETE     데이터 수정 API
  (반드시 Gate)      파일 업로드                  클라우드 스토리지
                     웹 폼 제출                   회원가입, 설문
                     Git push                    원격 저장소 변경

  MEDIUM             외부 API GET (인증 필요)     인증된 데이터 조회
  (승인 권장)        웹 다운로드                  파일 다운로드
                     Git commit                  로컬 변경 기록
```

## 비가역 액션 실행 전 필수 프로토콜

```
  비가역 외부 액션 요청
         │
         ▼
  ┌──────────────────┐
  │ 비가역성 분류     │ → CRITICAL / HIGH / MEDIUM
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ Dry-Run 강제 실행│ → "이 API를 호출하면 이런 결과가 예상됩니다"
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────┐
  │ 미리보기 표시     │ → 요청 본문, 대상 URL, 예상 응답
  └────────┬─────────┘
           │
           ▼
  ┌──────────────────────────────────────────┐
  │ GATE_IRREVERSIBLE_ACTION                  │
  │                                          │
  │ ⚠ 이 작업은 되돌릴 수 없습니다.          │
  │                                          │
  │ 대상: api.example.com/users (POST)       │
  │ 내용: 새 사용자 계정 생성                 │
  │ 영향: 외부 시스템에 영구적 변경           │
  │                                          │
  │ Trust Mode가 Auto여도 이 Gate는 필수입니다.│
  │                                          │
  │ [실행] [취소] [시뮬레이션만]              │
  └──────────────────────────────────────────┘
```

## GateType 추가

```
  기존 GateType에 추가:
  - "GATE_IRREVERSIBLE_ACTION"

  규칙:
  - CRITICAL 등급: Auto 모드에서도 반드시 Gate 발동
  - HIGH 등급: Semi-Auto 이상에서 Gate 발동
  - MEDIUM 등급: Suggest 이상에서 Gate 발동
  - 비가역 액션 연속 3회 이상: 자동 빈도 제한 (1분 쿨다운)
```

---

# 보완 2: Budget-Model 연동 매트릭스 (Token Budget ↔ Model Hot-Swap)

> 기존 K-1의 토큰 예산과 I-4의 모델 Hot-Swap이 독립적으로 설계되어 있다.
> 예산 소진 시 **자동 모델 다운그레이드 규칙**을 명확히 한다.

---

## Budget-Model 자동 연동 규칙

```
  예산 잔여율    현재 모델    자동 조치                     품질 영향
  ──────────────────────────────────────────────────────────────────────
  > 60%         Opus        유지                          최대 품질
  40-60%        Opus        → Sonnet 전환                 약간 감소
                            + "비용 절약을 위해 모델을     사용자에게
                              조정했습니다" 알림           경고 표시

  20-40%        Sonnet      → Haiku 전환                  품질 감소
                            + 기능 축소 알림               Review 간소화
                            + 불필요 에이전트 스킵          Codegen 품질↓

  10-20%        Haiku       최소 응답 모드                 최소 품질
                            + 새 요청 큐잉                 Plan만 생성
                            + Gate: "예산 부족. 계속?"     실행은 보류

  < 10%         Haiku       자동 중단                     실행 불가
                            + 현재 Run 안전하게 종료
                            + "예산이 소진되었습니다" 알림
                            + 체크포인트 저장
```

## 에이전트별 다운그레이드 전략

```
  에이전트          정상 모델    절약 모델    최소 모델    스킵 가능?
  ──────────────────────────────────────────────────────────────────
  Orchestrator     Sonnet      Haiku       Haiku       ❌ 필수
  Intent & Spec    Sonnet      Haiku       Haiku       ❌ 필수
  Policy & Risk    Haiku       Haiku       규칙 기반    ❌ 필수 (규칙 폴백)
  Planner          Sonnet      Haiku       Haiku       ❌ 필수
  Codegen          Opus        Sonnet      Haiku       ❌ 필수 (품질↓)
  Review           Sonnet      Haiku       스킵        ✅ LOW risk 시
  Test & Build     Haiku       Haiku       스킵        ✅ 수동 테스트 안내
  Executor         규칙 기반    규칙 기반    규칙 기반    ❌ 필수
  Recovery         Sonnet      Haiku       Haiku       ❌ 필수
```

## 동적 예산 재할당

```typescript
interface BudgetModelCoordinator {
  /** 현재 예산 상태에 따라 모델 할당 결정 */
  getModelAssignment(
    agentId: AgentId,
    budgetState: TokenBudget,
    taskComplexity: 'low' | 'medium' | 'high'
  ): {
    model: 'opus' | 'sonnet' | 'haiku' | 'rule_based';
    skipAgent: boolean;
    maxTokens: number;           // 이 호출에 할당된 최대 토큰
    qualityWarning?: string;     // 품질 저하 경고 메시지
  };

  /** 예산 임계값 도달 시 전략 전환 */
  onBudgetThreshold(
    threshold: 'warning' | 'critical' | 'exhausted',
    currentRun: RunState
  ): BudgetAction;
}

type BudgetAction =
  | { type: 'downgrade_model'; from: string; to: string }
  | { type: 'skip_agent'; agentId: string; reason: string }
  | { type: 'pause_run'; message: string }
  | { type: 'abort_run'; saveCheckpoint: boolean }
  | { type: 'gate'; message: string };
```

---

# 보완 3: Multi-User 정책 충돌 해결 규칙

> 기존 I-3의 Multi-User에서 "파일 충돌"은 다루지만,
> **사용자 간 정책 충돌** (User A는 허용, User B는 차단)에 대한 규칙이 없다.

---

## 정책 충돌 유형

```
  충돌 유형                        예시
  ──────────────────────────────────────────────────────────────────
  Allow vs Block                  User A: github.com 허용
                                  User B: github.com 차단

  Trust Mode 불일치               User A: Auto 모드
                                  User B: Observe 모드
                                  → 같은 프로젝트에서 작업 중

  Scope 충돌                      User A: /shared/ 쓰기 허용
                                  User B: /shared/ 쓰기 차단

  권한 등급 불일치                 User A (Owner): 패키지 자유 설치
                                  User B (User): 패키지 설치 Gate 필수
```

## 충돌 해결 우선순위

```
  규칙 (높은 우선순위 → 낮은 우선순위):
  ──────────────────────────────────────────────────────────

  1. Admin 시스템 정책 > 개인 정책
     → Admin이 설정한 규칙은 모든 사용자에게 강제

  2. Block > Allow (안전 우선 원칙)
     → 한 사용자라도 차단하면 해당 리소스는 차단
     → 단, 각 사용자의 개인 scope 내에서는 자유

  3. 공유 리소스는 더 엄격한 정책 적용
     → /shared/ 폴더: 모든 사용자 정책 중 가장 엄격한 것 적용
     → 개인 폴더 (/users/A/): 해당 사용자 정책만 적용

  4. Trust Mode는 각 사용자별 독립
     → User A가 Auto여도 User B의 리소스 접근은 User B 정책 적용

  5. 모호한 경우 DENY + Admin에게 보고
```

## 정책 병합 엔진

```typescript
interface PolicyMerger {
  /** 여러 사용자 정책을 병합하여 유효 정책 산출 */
  merge(
    systemPolicy: Policy,
    userPolicies: Map<UserId, Policy>,
    targetResource: ResourcePath
  ): MergedPolicy;
}

interface MergedPolicy {
  effectiveDecision: 'ALLOW' | 'DENY' | 'GATE';
  appliedRules: Array<{
    source: 'SYSTEM' | UserId;
    rule: PolicyRule;
    effect: 'ALLOW' | 'DENY' | 'GATE';
  }>;
  conflicts: PolicyConflict[];
  resolutionMethod: string;          // 어떤 규칙으로 해결했는지
}

interface PolicyConflict {
  conflictId: string;
  users: UserId[];
  resource: string;
  userAPolicy: 'ALLOW' | 'DENY' | 'GATE';
  userBPolicy: 'ALLOW' | 'DENY' | 'GATE';
  resolution: 'DENY_WINS' | 'ADMIN_OVERRIDE' | 'SCOPE_ISOLATION';
  reportedToAdmin: boolean;
}
```

## 충돌 보고 및 해결 UI

```
  Admin에게 표시:
  ┌─────────────────────────────────────────────────────────┐
  │  ⚠ 정책 충돌 감지                                       │
  │                                                         │
  │  리소스: /shared/config/api-keys.json                   │
  │                                                         │
  │  User A (Owner): ALLOW (읽기/쓰기 허용)                 │
  │  User B (User):  DENY  (접근 차단)                      │
  │                                                         │
  │  현재 적용: DENY (안전 우선 원칙)                        │
  │                                                         │
  │  권장 조치:                                              │
  │  이 파일은 민감 정보를 포함하고 있어                     │
  │  접근 범위를 Owner로 제한하는 것이 안전합니다.           │
  │                                                         │
  │  [DENY 유지] [User A에게만 허용] [둘 다 허용] [규칙 편집]│
  └─────────────────────────────────────────────────────────┘
```

---

# 보완 4: Emergency Stop 이후 재개 프로토콜

> 기존 Kill Switch(P0)는 있지만, Emergency Stop 이후
> **어떻게 안전하게 재개하느냐**에 대한 프로토콜이 부족하다.

---

## Emergency Stop 후 자동 수행 사항

```
  Emergency Stop 발동 (T=0)
         │
         ▼
  [즉시] 모든 Executor 액션 중단
         │
         ▼
  [즉시] 현재 상태 스냅샷 자동 생성
         │
         ▼
  [1초 내] 모든 활성 Capability 무효화
         │
         ▼
  [2초 내] 중단 원인 자동 분류
         │
         ├── 사용자 수동 Stop → "사용자 요청으로 중단"
         ├── Safety Hold 트리거 → "이상 징후 감지: {상세}"
         ├── Watchdog 트리거 → "리소스 이상: {상세}"
         └── 시스템 장애 → "시스템 오류: {상세}"
         │
         ▼
  [5초 내] 영향 분석 자동 생성
         │
         ├── 완료된 액션 목록 + 결과
         ├── 미완료 액션 목록 + 부분 상태
         ├── 롤백 가능 여부 (각 액션별)
         ├── 외부 부작용 발생 여부
         └── 잠재적 일관성 문제
```

## 재개 옵션 결정 트리

```
  영향 분석 완료
         │
         ▼
  ┌──────────────────┐
  │ 외부 부작용 있음? │
  └────────┬─────────┘
      Y    │    N
      │    │
      │    ▼
      │  ┌──────────────────┐
      │  │ 상태 일관성 있음? │
      │  └────────┬─────────┘
      │      Y    │    N
      │      │    │
      │      │    ▼
      │      │  옵션: [체크포인트 롤백 후 재개] [전체 롤백]
      │      │
      │      ▼
      │  옵션: [중단 지점부터 재개] [체크포인트 롤백] [전체 롤백]
      │
      ▼
  옵션: [전체 롤백] [새로 시작] (외부 부작용은 수동 확인 필요)
```

## 재개 프로토콜

```
  Phase 1: 사용자에게 상황 보고
  ──────────────────────────────
  ┌─────────────────────────────────────────────────────────┐
  │  🔴 Emergency Stop 보고서                                │
  │                                                         │
  │  중단 시각: 14:45:23                                    │
  │  중단 원인: Safety Hold (예상치 못한 팝업 감지)          │
  │                                                         │
  │  ══ 실행 상태 ══                                        │
  │  완료된 액션:                                            │
  │  ✅ 1. 파일 읽기: src/index.ts                          │
  │  ✅ 2. 파일 수정: src/index.ts (백업 있음)              │
  │  ✅ 3. 파일 생성: src/utils.ts (새 파일)                │
  │                                                         │
  │  미완료 액션:                                            │
  │  ⏸ 4. 파일 수정: src/app.ts (미시작)                    │
  │  ⏸ 5. 테스트 실행 (미시작)                              │
  │                                                         │
  │  ══ 롤백 가능 여부 ══                                   │
  │  액션 2: ✅ 롤백 가능 (백업에서 복원)                    │
  │  액션 3: ✅ 롤백 가능 (파일 삭제)                        │
  │  외부 부작용: 없음                                       │
  │                                                         │
  │  ══ 재개 옵션 ══                                        │
  │  [A] 중단 지점부터 재개 (액션 4부터)                     │
  │  [B] 체크포인트로 롤백 후 재개 (액션 1부터)              │
  │  [C] 전체 롤백 (모든 변경 취소)                          │
  │  [D] 새로 시작                                           │
  └─────────────────────────────────────────────────────────┘

  Phase 2: 사용자 선택 실행
  ──────────────────────────────
  선택에 따라:
  [A] → Capability 재발급 Gate → 액션 4부터 실행 재개
  [B] → 액션 2,3 롤백 → Capability 재발급 → 처음부터 재실행
  [C] → 모든 변경 롤백 → Run 종료
  [D] → 모든 변경 롤백 → 새 Run 시작

  Phase 3: 재개 시 보안 조치
  ──────────────────────────────
  - 모든 Capability 재발급 (이전 토큰 완전 무효화)
  - 세션 TTL 새로 시작
  - 재개 사유를 Audit Log에 기록
  - Safety Hold 원인이 해결되었는지 확인
    → 해결되지 않았으면 재개 차단
```

## EmergencyStopState 타입

```typescript
interface EmergencyStopState {
  stopId: string;
  triggeredAt: string;
  triggerSource: 'USER_MANUAL' | 'SAFETY_HOLD' | 'WATCHDOG' | 'SYSTEM_FAILURE';
  triggerDetail: string;

  impactAnalysis: {
    completedActions: Array<{
      actionId: string;
      type: string;
      result: string;
      rollbackable: boolean;
      rollbackMethod?: string;
    }>;
    pendingActions: Array<{
      actionId: string;
      type: string;
      status: 'not_started' | 'partial';
    }>;
    externalSideEffects: boolean;
    stateConsistent: boolean;
  };

  resumeOptions: Array<{
    id: string;
    label: string;
    description: string;
    requiresRollback: boolean;
    requiresNewCapabilities: boolean;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  }>;

  userDecision?: {
    selectedOption: string;
    decidedAt: string;
  };

  resolution: {
    status: 'pending' | 'resumed' | 'rolled_back' | 'new_run' | 'abandoned';
    resolvedAt?: string;
  };
}
```

---

# 보완 5: Agent Debate 비용 적응형 규칙

> 기존 N-6의 멀티 에이전트 토론 시스템에서
> **"토론 자체가 비용과 시간을 소비한다"**는 문제에 대한 적응형 규칙이 부족하다.

---

## 토론 활성화/비활성화 결정 매트릭스

```
  조건                                    토론 결정              이유
  ──────────────────────────────────────────────────────────────────────
  Budget strategy = economy               비활성화              비용 절약
  잔여 토큰 < 30%                         비활성화              예산 보호
  사용자 "빨리 해줘" 의도                 1라운드만             속도 우선
  이전 동일 유형에서 토론 결과 동일 3회    캐시 적용             중복 방지
  Risk Score < 50                         비활성화              위험 낮음
  Risk Score 50-70                        2라운드               경계 구간
  Risk Score > 70                         3라운드 (풀 토론)     위험 높음
  CRITICAL 외부 부작용 포함               3라운드 (필수)        비가역 보호
  사용자가 직접 Plan 수정 요청 시         비활성화              이미 결정됨
```

## 토론 비용 예산 제한

```
  토론 유형              최대 토큰         최대 시간        최대 비용
  ──────────────────────────────────────────────────────────────────
  1라운드 (간소화)       3,000            10초             $0.005
  2라운드 (표준)         8,000            20초             $0.015
  3라운드 (풀)           15,000           30초             $0.03
  ──────────────────────────────────────────────────────────────────
  Run 전체 예산 대비     최대 15%          -               -
```

## 토론 결과 캐시

```typescript
interface DebateCacheEntry {
  cacheId: string;
  inputSignature: string;           // 입력 패턴 해시
  debateResult: {
    winningPlan: string;
    scores: Record<string, number>;
    consensus: string;
  };
  hitCount: number;                 // 캐시 적중 횟수
  lastHit: string;
  confidence: number;               // 캐시 신뢰도 (적중률 기반)
  expiresAt: string;                // 30일 후 만료

  /** 캐시 적용 조건 */
  applicableWhen: {
    riskRange: [number, number];    // Risk Score 범위
    taskCategory: string;
    maxAgeMs: number;               // 캐시 유효 시간
  };
}
```

## 동적 토론 깊이 조절

```
  토론 진행 중에도 조기 종료 가능:

  Round 1 완료 후:
  - 모든 에이전트가 같은 Plan에 8+ 점수 → 즉시 합의 (Round 2 스킵)
  - 점수 차이 < 1점 → 즉시 합의

  Round 2 완료 후:
  - 수정된 Plan이 Round 1과 동일 → Round 3 스킵
  - 토큰 예산 임계값 도달 → 현재까지 최고 점수 Plan 선택

  조기 종료 시:
  - "토론 결과: 1라운드에서 합의 도달 (3라운드 중 2라운드 절약)"
  - 절약된 토큰 정보 표시
```

---

# 보완 6: Workspace Profile 자동 감지 확장

> 기존 K-4의 자동 감지가 package.json, 파일 확장자 수준에 한정되어 있다.
> 프로젝트의 **코딩 컨벤션, 브랜치 전략, 배포 환경**까지 감지하여
> 에이전트 프롬프트에 자동 반영해야 한다.

---

## 확장 감지 항목

```
  카테고리              감지 대상              감지 방법                    활용
  ──────────────────────────────────────────────────────────────────────────────

  코딩 컨벤션
  ──────────
  들여쓰기 스타일       탭 vs 스페이스         .editorconfig 분석           코드 생성 시 적용
  따옴표 스타일         작은 vs 큰따옴표       ESLint/Prettier 설정         코드 생성 시 적용
  세미콜론              사용 vs 미사용         ESLint/Prettier 설정         코드 생성 시 적용
  import 정렬           규칙                   ESLint import plugin         코드 생성 시 적용
  네이밍 컨벤션         camelCase/snake_case   기존 코드 분석               변수/함수명 생성
  파일 네이밍           kebab/pascal/camel     기존 파일명 패턴             파일 생성 시 적용
  최대 줄 길이          80/100/120             ESLint/Prettier              코드 포맷팅

  Git 컨벤션
  ──────────
  커밋 메시지 형식      conventional commits   최근 50개 커밋 분석          커밋 생성 시 적용
  브랜치 전략           git-flow/trunk-based   브랜치 이름 패턴 분석        브랜치 생성 시 적용
  PR 템플릿             제목/본문 형식         .github/PULL_REQUEST         PR 생성 시 적용
  코드 리뷰 규칙        필수 리뷰어 등         CODEOWNERS 분석              리뷰 제안

  배포 환경
  ──────────
  호스팅                Vercel/AWS/GCP         설정 파일 감지               배포 명령 자동 선택
  CI/CD                 GitHub Actions/...     .github/workflows 분석       테스트/빌드 명령
  컨테이너화            Docker/Podman          Dockerfile 분석              환경 구성
  환경 변수 구조        .env 패턴              .env.example 분석            환경 설정 가이드

  프로젝트 구조
  ──────────
  아키텍처 패턴         모노레포/멀티레포      turbo.json, lerna.json       작업 범위 결정
  디렉토리 컨벤션       src/lib/app 등         폴더 구조 분석               파일 배치 결정
  테스트 위치           __tests__/co-located   기존 테스트 위치 분석         테스트 생성 위치
  비밀 관리             .env/.env.local        gitignore 패턴               보안 검사 강화
```

## 감지 결과 → 에이전트 프롬프트 주입

```typescript
interface WorkspaceConventions {
  coding: {
    indentation: { type: 'tabs' | 'spaces'; size: number };
    quotes: 'single' | 'double';
    semicolons: boolean;
    importOrder: string[];
    namingConvention: {
      variables: 'camelCase' | 'snake_case';
      functions: 'camelCase' | 'snake_case';
      components: 'PascalCase';
      files: 'kebab-case' | 'PascalCase' | 'camelCase';
    };
    maxLineLength: number;
  };

  git: {
    commitFormat: string;            // "type(scope): message"
    branchFormat: string;            // "feature/JIRA-123-description"
    defaultBranch: string;           // "main"
    prTemplate?: string;
    codeOwners?: Record<string, string[]>;
  };

  deployment: {
    platform: string;                // "vercel", "aws", "docker"
    cicd: string;                    // "github-actions"
    envStructure: string[];          // [".env.local", ".env.production"]
  };

  project: {
    architecture: string;            // "monorepo", "single"
    testLocation: 'colocated' | 'separate';  // __tests__ vs .test.ts
    testFramework: string;           // "vitest", "jest"
    directoryConvention: Record<string, string>;  // { components: "src/components" }
  };
}
```

## Codegen Agent 프롬프트 주입 예시

```
  감지된 컨벤션 기반 자동 주입:

  ──────────────────────────────────────────────
  이 프로젝트의 코딩 규칙:
  - 들여쓰기: 2 spaces
  - 따옴표: 작은따옴표 (')
  - 세미콜론: 사용 안 함
  - import 순서: react → 외부 라이브러리 → 내부 모듈 → 스타일
  - 파일명: kebab-case (예: my-component.tsx)
  - 컴포넌트명: PascalCase (예: MyComponent)
  - 테스트 위치: 같은 폴더 (MyComponent.test.tsx)
  - 커밋 형식: "feat(scope): 설명" (conventional commits)
  ──────────────────────────────────────────────

  이 규칙을 반드시 따르세요.
```

## 컨벤션 감지 신뢰도 및 갱신

```
  감지 신뢰도 레벨:
  ──────────────────────────────────
  설정 파일에서 감지   → 신뢰도 100% (명시적)
  코드 패턴에서 추론   → 신뢰도 70-90% (통계적)
  기본값 추정          → 신뢰도 50% (가정)

  갱신 주기:
  ──────────────────────────────────
  - 프로젝트 첫 접근 시 전체 스캔 (1회)
  - 설정 파일 변경 감지 시 해당 항목 갱신
  - 주간 전체 재스캔 (drift 감지)
  - 사용자가 "컨벤션 다시 분석해" 명령 시 즉시

  사용자 오버라이드:
  ──────────────────────────────────
  - 자동 감지 결과를 사용자가 수동으로 수정 가능
  - 수동 설정은 자동 감지보다 항상 우선
  - jarvis config conventions edit
```

---

# ============================================================

# 추가 기능 섹션 2차: 신규 시스템 (U~AB) + 기존 보완 8건

# ============================================================

# 아래는 기존 A~T + 보완 6건 분석 후 도출된 추가 기능 8개(U~AB)와

# 기존 설계의 빈틈을 메우는 보완 항목 8건입니다.

# ============================================================

---

# U. Privacy & Data Sovereignty (개인정보 및 데이터 주권)

> 기존 Credential Vault, DLP, 학습 금지 영역이 존재하지만,
> 사용자의 **데이터 주권**에 대한 체계적 프레임워크가 부재한다.

---

## U-1. 사용자 데이터 분류 체계 (Data Classification)

AI가 접근하는 모든 데이터를 자동으로 분류하고, 등급별 접근 정책을 적용한다.

### 데이터 등급 정의

```
  등급           설명                         AI 접근 정책
  ──────────────────────────────────────────────────────────────
  PUBLIC         공개 가능 데이터              자유 접근
                 예: README.md, 오픈소스 코드

  INTERNAL       내부 업무용 데이터            기본 접근 허용
                 예: 소스 코드, 문서            로깅 필수

  CONFIDENTIAL   기밀 데이터                   Gate 승인 필요
                 예: 내부 API 키, 설정 파일     읽기 시에도 승인

  RESTRICTED     최고 기밀 데이터              접근 완전 차단
                 예: .env, 개인키, 인증서       AI 접근 불가
```

### 자동 분류 엔진

```
  분류 기준                    예시                      판정
  ──────────────────────────────────────────────────────────────
  파일 확장자                  .env, .pem, .key          RESTRICTED
  파일명 패턴                  *secret*, *credential*    RESTRICTED
  경로 패턴                    ~/.ssh/, ~/Documents/     CONFIDENTIAL
  내용 패턴 스캔              API_KEY=, password=        RESTRICTED
  Git 무시 파일               .gitignore에 포함          CONFIDENTIAL+
  사용자 수동 태깅            jarvis classify <path>     사용자 지정
```

### 등급별 자동 정책 적용

```typescript
interface DataClassification {
  path: string;
  level: 'PUBLIC' | 'INTERNAL' | 'CONFIDENTIAL' | 'RESTRICTED';
  detectedBy: 'extension' | 'filename' | 'path' | 'content' | 'gitignore' | 'user';
  confidence: number;           // 0.0-1.0
  appliedPolicy: {
    aiCanRead: boolean;
    aiCanWrite: boolean;
    requiresGate: boolean;
    loggingLevel: 'none' | 'basic' | 'detailed' | 'full';
    canSendToAPI: boolean;      // Claude API로 전송 가능 여부
  };
}
```

---

## U-2. Right to Erasure (삭제권) 프로토콜

사용자가 자신의 데이터를 완전히 삭제할 수 있는 권리를 보장한다.

### 삭제 대상 저장소 전체 목록

```
  저장소                      삭제 범위                   방법
  ──────────────────────────────────────────────────────────────
  Semantic Memory             사용자 관련 전체 엔트리     벡터 DB 삭제
  Mistake Pattern DB          사용자 피드백 기반 패턴     JSON 삭제
  Audit Log                   사용자 세션 로그            로그 파일 제거
  Pattern Cache               승인/거부 패턴              캐시 무효화
  User Profile                프로필 전체                 DB 삭제
  Workspace Profile           프로젝트 분석 결과          디렉토리 삭제
  Conversation Context        대화 이력                   세션 DB 삭제
  Agent Scorecard             성적 데이터                 통계 초기화
  RunState 히스토리           실행 이력                   SQLite 삭제
```

### 삭제 흐름

```
  사용자: "내 데이터 전부 삭제해"
       │
       ▼
  ┌──────────────────────────┐
  │ 삭제 범위 확인 Gate       │
  │                          │
  │ 다음 데이터가 삭제됩니다:  │
  │ - 메모리 항목 42개        │
  │ - 실행 이력 156건         │
  │ - 학습 패턴 23개          │
  │ - 프로필 데이터 전체      │
  │                          │
  │ ⚠ 이 작업은 되돌릴 수     │
  │   없습니다.               │
  │                          │
  │ [전체 삭제] [선택 삭제]    │
  │ [취소]                    │
  └──────────────────────────┘
       │
       ▼ (승인)
  모든 저장소에서 순차 삭제
       │
       ▼
  삭제 증명서 발행
  ┌──────────────────────────┐
  │ Deletion Certificate      │
  │ ID: del_20260302_001      │
  │ 시각: 2026-03-02T10:00Z   │
  │ 삭제 항목: 221건          │
  │ 저장소: 9개 전체          │
  │ 잔여 데이터: 없음         │
  │ 검증 해시: a3f2b8c1...    │
  └──────────────────────────┘
```

### CLI 명령어

```
  jarvis privacy erase --all              # 전체 삭제
  jarvis privacy erase --memory           # 메모리만 삭제
  jarvis privacy erase --history          # 이력만 삭제
  jarvis privacy erase --profile          # 프로필만 삭제
  jarvis privacy export                   # 내 데이터 전체 내보내기 (JSON)
  jarvis privacy audit                    # 저장된 데이터 목록 조회
  jarvis privacy certificate <del-id>     # 삭제 증명서 조회
```

---

## U-3. Data Residency (데이터 상주) 정책

모든 사용자 데이터의 물리적 위치와 외부 전송 규칙을 명시한다.

### 데이터 상주 규칙

```
  규칙                                          구현
  ──────────────────────────────────────────────────────────────
  모든 사용자 데이터 로컬 저장 (외부 전송 없음)   SQLite + 로컬 파일
  Claude API 호출 시 최소 데이터만 전송            Input Minimizer
  API 전송 전 민감 데이터 자동 마스킹              Content Masker
  마스킹 대상: 파일 경로, 사용자 이름,             패턴 기반 필터
    API 키, IP 주소, 이메일 등
  오프라인 모드에서도 핵심 기능 동작               로컬 캐시 정책
```

### API 전송 최소화 엔진

```
  Claude API로 전송되는 데이터:
  ──────────────────────────────

  전송 허용:
  ✅ 사용자 요청 텍스트 (마스킹 후)
  ✅ 코드 스니펫 (최소 범위, 마스킹 후)
  ✅ 에러 메시지 (마스킹 후)
  ✅ 정책 평가에 필요한 메타데이터

  전송 금지:
  ❌ 전체 파일 내용 (요약/발췌만 전송)
  ❌ .env, credentials 파일 내용
  ❌ 사용자 프로필 원본
  ❌ Audit Log 원본
  ❌ Credential Vault 관련 데이터

  마스킹 예시:
  Before: "API_KEY=sk-abc123xyz를 사용하여 /Users/daniel/project/에서..."
  After:  "API_KEY=[MASKED]를 사용하여 [PROJECT_ROOT]/에서..."
```

---

# V. Agent Composability & Customization (에이전트 조합 및 커스터마이징)

> 기존 9개 에이전트가 고정 역할로 정의되어 있지만,
> 사용자가 에이전트를 **커스터마이징하거나 새 에이전트를 추가**하는 방법이 부재한다.

---

## V-1. Custom Agent Definition (사용자 정의 에이전트)

사용자가 YAML/JSON으로 커스텀 에이전트를 정의하고 파이프라인에 삽입할 수 있다.

### 커스텀 에이전트 정의 스키마

```yaml
# ~/.jarvis/agents/doc-updater.agent.yaml
agent:
  id: doc-updater
  name: "Documentation Updater"
  description: "코드 변경 후 관련 문서를 자동 업데이트"
  version: "1.0.0"

  model: sonnet                    # 사용할 모델
  maxTokens: 4000                  # 토큰 한도

  trigger:
    after: ["codegen", "review"]   # 코드 생성/리뷰 후 실행
    condition: "changedFiles.some(f => f.endsWith('.ts'))"

  input:
    - name: changedFiles
      type: "string[]"
      source: "codegen.output.files"
    - name: projectDocs
      type: "string[]"
      source: "glob:docs/**/*.md"

  prompt: |
    당신은 문서 업데이트 에이전트입니다.
    변경된 코드 파일을 분석하여 관련 문서를 업데이트하세요.

    변경된 파일: {{changedFiles}}
    기존 문서: {{projectDocs}}

    규칙:
    - 코드 변경과 직접 관련된 문서만 수정
    - API 변경 시 API 문서 필수 업데이트
    - 새 함수/클래스 추가 시 사용 예시 추가

  output:
    type: "patches"                # 문서 패치 생성
    reviewRequired: true           # Review Agent 검증 필요

  capabilities:
    - "fs.read:docs/**"
    - "fs.write:docs/**"

  riskLevel: LOW                   # 기본 위험도
```

### 커스텀 에이전트 관리 CLI

```
  jarvis agent create              # 대화형 에이전트 생성
  jarvis agent list                # 에이전트 목록 (기본 + 커스텀)
  jarvis agent test <agent-id>     # 에이전트 테스트 실행
  jarvis agent enable <agent-id>   # 에이전트 활성화
  jarvis agent disable <agent-id>  # 에이전트 비활성화
  jarvis agent edit <agent-id>     # 에이전트 정의 편집
  jarvis agent delete <agent-id>   # 커스텀 에이전트 삭제
```

---

## V-2. Agent Pipeline Customization (파이프라인 커스터마이징)

기본 파이프라인의 단계를 추가, 제거, 순서 변경할 수 있다.

### 파이프라인 프리셋

```
  프리셋             단계 구성                              용도
  ──────────────────────────────────────────────────────────────
  Full               Spec→Policy→Plan→Code→Review           완전한 안전성
                     →Test→Execute                          프로덕션 작업

  Quick              Spec→Policy→Code→Execute               빠른 작업
                     (Plan/Review/Test 생략)                 간단한 파일 조작

  Security-First     Spec→Policy→Plan→Code→Review           보안 중심
                     →SecurityScan→Test→Execute              민감한 작업

  Code-Only          Spec→Code→Review→Test                  코드 변경만
                     (Execute 없음)                          PR/패치 생성

  Custom             사용자 정의                             자유 구성
```

### 파이프라인 커스터마이징 스키마

```json
{
  "pipelineId": "my-pipeline",
  "name": "보안 강화 파이프라인",
  "basedOn": "full",

  "modifications": {
    "insertAfter": {
      "review": ["doc-updater", "security-scan"]
    },
    "remove": [],
    "reorder": null
  },

  "conditions": {
    "useWhen": {
      "riskLevel": "HIGH",
      "filePatterns": ["src/auth/**", "src/api/**"]
    }
  }
}
```

### 파이프라인 관리 CLI

```
  jarvis pipeline list                       # 프리셋 + 커스텀 목록
  jarvis pipeline use <preset>               # 기본 파이프라인 변경
  jarvis pipeline create                     # 커스텀 파이프라인 생성
  jarvis pipeline edit <id>                  # 파이프라인 편집
  jarvis pipeline test <id> --dry-run        # 파이프라인 시뮬레이션
```

---

## V-3. Agent Marketplace (에이전트 마켓플레이스)

커뮤니티/팀이 만든 커스텀 에이전트를 공유하는 플랫폼이다.

### 마켓플레이스 구조

```
  ┌─────────────────────────────────────────────────────────┐
  │              JARVIS Agent Marketplace                     │
  ├─────────────────────────────────────────────────────────┤
  │                                                         │
  │  에이전트 패키지 = 정의 + 프롬프트 + 테스트 케이스       │
  │                                                         │
  │  설치 흐름:                                             │
  │  1. jarvis marketplace search "documentation"            │
  │  2. 검색 결과 표시 (이름, 설명, 평점, 다운로드 수)       │
  │  3. jarvis marketplace install doc-updater              │
  │  4. Tool Installation Governance 적용:                   │
  │     - 필요 권한 목록 표시                                │
  │     - 보안 검증 결과 표시                                │
  │     - 사용자 승인 Gate                                   │
  │  5. 설치 완료 → 파이프라인에 자동 등록 (비활성 상태)     │
  │  6. jarvis agent enable doc-updater                     │
  │                                                         │
  │  보안 검증:                                             │
  │  - 패키지 서명 검증                                      │
  │  - 요청 권한 범위 검사                                   │
  │  - 프롬프트 인젝션 패턴 스캔                             │
  │  - 커뮤니티 리포트 확인                                  │
  └─────────────────────────────────────────────────────────┘
```

---

# W. Intelligent Error Recovery (지능형 오류 복구)

> 기존 Recovery Agent와 M 섹션(자기 교정)이 있지만,
> 복구 전략의 **지능화와 자동 선택 메커니즘**이 부족하다.

---

## W-1. Recovery Strategy Selector (복구 전략 자동 선택)

에러 유형별 최적 복구 전략을 자동으로 선택하는 엔진이다.

### 전략 풀 및 선택 기준

```
  전략                  적용 조건                          비용      성공률
  ──────────────────────────────────────────────────────────────────────
  Retry               일시적 오류 (네트워크, 타임아웃)     낮음      70%
  Rollback            상태 변경 실패 (파일, 설정)          중간      95%
  Alternative         접근 방식 자체 실패                  높음      60%
  Partial Undo        부분 성공 / 부분 실패                중간      85%
  Escalate            자동 복구 불가                       없음      N/A
  Skip                비핵심 단계 실패                     없음      100%
```

### 전략 선택 엔진

```typescript
interface RecoveryStrategySelector {
  select(context: ErrorContext): RecoveryPlan;
}

interface ErrorContext {
  errorType: 'network' | 'permission' | 'resource' | 'logic' | 'timeout' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  failedAction: Action;
  retryCount: number;
  historicalSuccessRate: Record<string, number>;  // 전략별 과거 성공률
  estimatedCost: Record<string, TokenCost>;       // 전략별 예상 비용
  timeConstraint?: number;                         // 남은 시간 (ms)
}

interface RecoveryPlan {
  primaryStrategy: RecoveryStrategy;
  fallbackChain: RecoveryStrategy[];   // 1차 실패 시 순차 시도
  estimatedSuccessRate: number;
  estimatedTokenCost: number;
  requiresUserApproval: boolean;
}
```

### 전략 선택 흐름

```
  에러 발생
     │
     ▼
  에러 유형 분류
     │
     ├── 일시적 오류? ──▶ Retry (최대 3회)
     │                        │ 실패
     │                        ▼
     ├── 상태 변경 실패? ──▶ Rollback
     │                        │ 실패
     │                        ▼
     ├── 접근 방식 실패? ──▶ Alternative Approach
     │                        │ 실패
     │                        ▼
     └── 모든 전략 실패 ──▶ Escalate (사용자에게 보고)

  각 단계에서:
  - 과거 성공률 참조 (Mistake Pattern DB)
  - 토큰 비용 대비 성공 확률 계산
  - 비용/확률 비율이 임계값 이하이면 Escalate로 직행
```

---

## W-2. Cascading Failure Prevention (연쇄 실패 방지)

하나의 실패가 연쇄적으로 전체 시스템을 무너뜨리지 않도록 방지한다.

### Circuit Breaker 패턴

```
  ┌─────────────────────────────────────────────────┐
  │              Circuit Breaker                     │
  ├─────────────────────────────────────────────────┤
  │                                                 │
  │  상태: CLOSED (정상) → OPEN (차단) → HALF-OPEN   │
  │                                                 │
  │  CLOSED (정상 운영):                             │
  │  - 모든 요청 통과                                │
  │  - 실패 카운터 증가                              │
  │  - 연속 N회 실패 → OPEN으로 전환                 │
  │                                                 │
  │  OPEN (차단):                                    │
  │  - 해당 경로의 요청 즉시 거부                    │
  │  - 대체 경로로 자동 라우팅                       │
  │  - 쿨다운 타이머 시작                            │
  │  - 사용자에게 "이 기능이 일시 차단됨" 알림       │
  │                                                 │
  │  HALF-OPEN (시험):                               │
  │  - 쿨다운 후 1건만 통과 허용                     │
  │  - 성공 → CLOSED 복원                            │
  │  - 실패 → OPEN 유지 (쿨다운 연장)               │
  └─────────────────────────────────────────────────┘
```

### 실패 격리 (Failure Isolation)

```
  격리 수준               범위                  대응
  ──────────────────────────────────────────────────────────
  Action 격리             단일 액션             해당 액션만 실패 처리
  Step 격리               파이프라인 단계       해당 단계만 재시도/스킵
  Agent 격리              에이전트 단위         대체 에이전트 투입
  Run 격리                전체 Run              다른 Run에 영향 없음
  System 격리             시스템 전체           Emergency Mode 전환
```

---

## W-3. Post-Mortem Auto-Generation (사후 분석 자동 생성)

실패한 Run에 대해 자동으로 상세 사후 분석 리포트를 생성한다.

### 사후 분석 리포트 구조

```
  ┌─────────────────────────────────────────────────────────┐
  │  📋 Post-Mortem Report: run_20260302_0015               │
  ├─────────────────────────────────────────────────────────┤
  │                                                         │
  │  1. 요약                                                │
  │     - 작업: "프로젝트 TypeScript 마이그레이션"          │
  │     - 결과: FAILED (codeGeneration 단계에서 실패)       │
  │     - 소요 시간: 3분 42초                               │
  │     - 소비 토큰: 12,400                                 │
  │                                                         │
  │  2. 타임라인                                            │
  │     10:00:00  specDrafting        ✅ 성공 (8초)         │
  │     10:00:08  policyEvaluation    ✅ 성공 (3초)         │
  │     10:00:11  planning            ✅ 성공 (15초)        │
  │     10:00:26  codeGeneration      ❌ 실패 (3분 16초)    │
  │     10:03:42  errorRecovery       ⚠ 부분 성공          │
  │                                                         │
  │  3. 근본 원인 (Root Cause)                              │
  │     - 1차: 외부 타입 라이브러리 @types/lodash 미설치    │
  │     - 2차: Codegen이 의존성 확인 없이 코드 생성 시도    │
  │     - 3차: Plan에 의존성 설치 단계가 누락               │
  │                                                         │
  │  4. 기여 요인                                           │
  │     - Planner가 기존 package.json 분석 부족             │
  │     - Token Budget 부족으로 3회 재시도 후 중단          │
  │                                                         │
  │  5. 교훈 & 재발 방지                                    │
  │     → 제안 정책: "TS 마이그레이션 시 @types 확인 필수"  │
  │     → Planner 프롬프트에 의존성 확인 단계 추가 권고     │
  │     → Mistake Pattern DB에 자동 등록                    │
  │                                                         │
  │  6. 복구 상태                                           │
  │     - Rollback: 완료 (코드 변경 전 상태로 복원)        │
  │     - 잔여 영향: 없음                                   │
  │                                                         │
  │  [정책 제안 승인] [리포트 내보내기] [닫기]              │
  └─────────────────────────────────────────────────────────┘
```

---

# X. Accessibility-First Voice UX (접근성 우선 음성 UX)

> 기존 F 섹션에 음성 인증과 다중 턴 관리가 있지만,
> 음성 인터랙션의 **구체적 UX 설계**가 부족하다.

---

## X-1. Voice Command Grammar & Fallback

### 음성 명령 문법 구조

```
  패턴: [대상] + [동작] + [조건/옵션]

  예시:
  ──────────────────────────────────────────────────────
  "프로젝트 빌드해"           → 대상: 프로젝트, 동작: 빌드
  "src 폴더에서 테스트 돌려"  → 대상: src 폴더, 동작: 테스트
  "이 파일 TypeScript로 변환" → 대상: 현재 파일, 동작: 변환, 조건: TS
  "마지막 작업 되돌려"        → 대상: 마지막 작업, 동작: Undo
```

### 음성 인식 실패 폴백 전략

```
  실패 단계       대응                              UI
  ──────────────────────────────────────────────────────────────
  1차 실패        "다시 말씀해 주세요"               음성 재요청
  2차 실패        유사 명령 3개 제안                 선택 UI 표시
                  "혹시 이 중 하나인가요?"
  3차 실패        텍스트 입력 전환 제안              키보드 포커스
                  "텍스트로 입력하시겠습니까?"
  소음 감지       자동 텍스트 모드 전환 제안          토스트 알림
                  "주변이 시끄러운 것 같습니다"
```

### 위험 명령 음성 확인 (Double Confirmation)

```
  위험도 HIGH 이상 명령:
  ──────────────────────
  사용자: "시스템 파일 삭제해"
  JARVIS: "시스템 파일 삭제를 요청하셨습니다. 정말 진행할까요?"
  사용자: "응, 진행해" (명시적 확인)
  → Gate 표시 + 추가 승인 필요
```

---

## X-2. Voice Feedback & Status (음성 피드백)

화면을 볼 수 없는 상황에서의 음성 피드백을 설계한다.

### 음성 피드백 레벨

```
  레벨              트리거                        음성 내용 예시
  ──────────────────────────────────────────────────────────────
  확인              명령 수신 시                  "알겠습니다, 빌드를 시작합니다"
  진행              단계 완료 시                  "파일 3개 중 2개 완료"
  Gate              승인 필요 시                  "변경 사항 적용 승인이 필요합니다"
  경고              이상 감지 시                  "위험도 높은 작업이 감지되었습니다"
  완료              작업 완료 시                  "모든 작업이 완료되었습니다"
  실패              작업 실패 시                  "빌드 실패, 에러 내용을 확인해주세요"
  긴급              Emergency 시                  "긴급 정지 실행됨, 모든 작업 중단"
```

### Emergency Stop 음성 명령

```
  트리거 문구 (항상 활성화):
  ──────────────────────────
  "자비스, 중지"
  "자비스, 멈춰"
  "자비스, 스톱"
  "JARVIS, stop"

  → 즉시 모든 실행 중단
  → 화면에 Emergency Stop 오버레이 표시
  → 음성: "모든 작업을 중단했습니다. 상태를 확인해주세요."
```

### Gate 음성 승인

```
  JARVIS: "3개 파일을 수정하는 변경 승인이 필요합니다.
           위험도는 중간입니다. 승인하시겠습니까?"

  사용자 응답 패턴:
  ──────────────────────────
  "승인"  / "허용"  / "진행"   → Approve
  "거부"  / "취소"  / "하지마"  → Reject
  "자세히" / "뭔데"             → 상세 설명 모드
  "나중에"                     → 대기 큐에 추가
```

---

## X-3. Multi-Modal Input Fusion (다중 모달 입력 통합)

텍스트 + 음성 + 스크린샷 + 드래그앤드롭을 하나의 요청으로 통합한다.

### 입력 소스 우선순위

```
  우선순위    입력 소스            예시
  ──────────────────────────────────────────────────────
  1 (최고)   명시적 텍스트        입력창에 직접 타이핑
  2          음성 명령            "이거 고쳐줘"
  3          선택/드래그          화면에서 에러 메시지 드래그
  4          화면 컨텍스트        현재 포커스된 창/파일
  5 (최저)   추론                 이전 대화 맥락에서 추론
```

### 복합 입력 시나리오

```
  시나리오: 에러 메시지를 드래그 + "이거 고쳐줘" 음성

  입력 해석:
  ┌──────────────────────────────────────────────┐
  │ 소스 1 (음성): "이거 고쳐줘"                  │
  │ → 동작: 수정/고침                             │
  │                                              │
  │ 소스 2 (드래그): "TypeError: cannot read..."  │
  │ → 대상: 에러 메시지                           │
  │                                              │
  │ 소스 3 (컨텍스트): 현재 파일 = App.tsx        │
  │ → 위치: App.tsx 내 해당 에러 라인             │
  │                                              │
  │ 통합 해석:                                    │
  │ "App.tsx에서 발생한 TypeError를 수정해주세요"  │
  └──────────────────────────────────────────────┘
```

---

# Y. Compliance & Audit Framework (규정 준수 및 감사 프레임워크)

> 기존 Audit Log가 존재하지만,
> 규정 준수 관점의 **체계적 프레임워크**가 부재한다.

---

## Y-1. Compliance Template System (규정 준수 템플릿)

산업별 규정 준수 템플릿을 제공하여, 적용 시 자동으로 관련 정책이 조정된다.

### 템플릿 목록 및 적용 효과

```
  템플릿              적용 시 자동 설정
  ──────────────────────────────────────────────────────────────
  일반 (Default)      기본 정책, Gate 7개, 표준 로깅

  금융 (PCI-DSS)      결제 데이터 접근 완전 차단
                      모든 네트워크 작업 Gate 필수
                      Audit Log 1년 보존 강제
                      암호화 요구사항 자동 적용

  의료 (HIPAA)        환자 데이터 패턴 자동 감지/차단
                      데이터 전송 암호화 필수
                      접근 로그 상세 기록 강제
                      최소 권한 원칙 엄격 적용

  개인정보 (GDPR)     개인 식별 정보(PII) 자동 마스킹
                      데이터 삭제권 프로토콜 활성화
                      데이터 처리 동의 추적
                      국외 전송 제한

  기업 내부            커스텀 보안 정책 임포트
                      사내 승인 체계 연동
                      내부 감사 형식 적용
```

### 템플릿 적용 CLI

```
  jarvis compliance apply pci-dss         # 금융 템플릿 적용
  jarvis compliance apply hipaa           # 의료 템플릿 적용
  jarvis compliance apply gdpr            # GDPR 템플릿 적용
  jarvis compliance create                # 커스텀 템플릿 생성
  jarvis compliance status                # 현재 준수 상태 확인
  jarvis compliance audit                 # 규정 준수 감사 실행
```

---

## Y-2. Audit Trail Export & Certification (감사 추적 내보내기)

감사 로그를 표준 형식으로 내보내고 무결성을 보장한다.

### 감사 무결성 보장

```
  해시 체인 구조 (Blockchain-like):
  ──────────────────────────────────

  Log Entry #1 ──▶ hash(#1)
                      │
  Log Entry #2 ──▶ hash(#1 + #2)
                      │
  Log Entry #3 ──▶ hash(#1 + #2 + #3)
                      │
  ...

  → 중간 로그 삭제/변조 시 해시 체인 검증 실패
  → jarvis audit verify 명령으로 무결성 확인 가능
```

### 감사 내보내기 형식

```
  형식                용도                        명령어
  ──────────────────────────────────────────────────────────────
  JSON               내부 분석/백업               jarvis audit export --json
  CSV                스프레드시트 분석             jarvis audit export --csv
  SIEM (CEF)         보안 정보 관리 시스템 연동    jarvis audit export --siem
  PDF                규정 감사 제출용             jarvis audit export --pdf
```

### 감사 필터 및 검색

```
  jarvis audit search --agent=Executor --risk=HIGH --date=today
  jarvis audit search --action="fs.delete" --period="2026-02-01:2026-03-01"
  jarvis audit search --user=daniel --gate=rejected
  jarvis audit stats --period=week    # 주간 통계
  jarvis audit anomaly                # 이상 징후 감지
```

---

## Y-3. Regulatory Change Auto-Adaptation (규정 변경 자동 적응)

보안 규정이 변경될 때 정책 업데이트를 자동 제안한다.

### 규정 변경 감지 및 대응 흐름

```
  외부 규정 변경 피드 구독
       │
       ▼
  변경 내용 분석
       │
       ▼
  현재 정책과의 차이(Gap) 분석
       │
       ├── Gap 없음 → "현재 정책이 최신 규정을 준수합니다" 알림
       │
       └── Gap 있음 → 정책 업데이트 제안
                │
                ▼
           ┌────────────────────────────────────┐
           │  📢 규정 변경 알림                   │
           │                                    │
           │  PCI-DSS v4.0 변경사항:             │
           │  - MFA 요구사항 강화                 │
           │  - 로깅 보존 기간 연장               │
           │                                    │
           │  현재 정책과의 차이:                  │
           │  1. MFA 정책 미설정 → 추가 필요     │
           │  2. 로그 보존 90일 → 365일 변경 필요│
           │                                    │
           │  [자동 업데이트] [수동 검토] [나중에] │
           └────────────────────────────────────┘
```

---

# Z. Performance & Latency Optimization (성능 및 지연 시간 최적화)

> 기존 Token Budget, Watchdog이 있지만,
> 사용자 체감 **응답 속도에 대한 최적화 전략**이 부재한다.

---

## Z-1. Speculative Execution (투기적 실행)

Gate 대기 중에 다음 단계를 백그라운드에서 사전 처리한다.

### 투기적 실행 전략

```
  ┌─────────────────────────────────────────────────────────┐
  │              Speculative Execution                       │
  ├─────────────────────────────────────────────────────────┤
  │                                                         │
  │  현재 상태: Gate 대기 중 (사용자 승인 필요)              │
  │                                                         │
  │  백그라운드에서:                                         │
  │  ┌─────────────────────────────────────────┐            │
  │  │ 승인 시나리오 사전 처리                   │            │
  │  │ - 다음 단계 (codeGeneration) 미리 실행    │            │
  │  │ - 결과를 임시 버퍼에 저장                 │            │
  │  │ - 실제 파일 시스템에는 미적용             │            │
  │  └─────────────────────────────────────────┘            │
  │                                                         │
  │  사용자 응답:                                            │
  │  ┌──────────┐    ┌──────────┐                           │
  │  │ Approve  │    │ Reject   │                           │
  │  │          │    │          │                           │
  │  │ → 버퍼   │    │ → 버퍼   │                           │
  │  │   즉시   │    │   폐기   │                           │
  │  │   적용   │    │          │                           │
  │  └──────────┘    └──────────┘                           │
  │                                                         │
  │  체감 속도 향상: Gate 승인 후 0초 대기 (이미 완료)       │
  └─────────────────────────────────────────────────────────┘
```

### 활성화 조건

```
  조건                                     활성화
  ──────────────────────────────────────────────────────────
  Trust Mode가 Semi-Auto 또는 Auto          ✅
  Trust Mode가 Observe 또는 Suggest         ❌
  승인 예상 확률 > 80% (과거 패턴 기반)      ✅ (자동)
  승인 예상 확률 50-80%                      ✅ (리소스 여유 시)
  승인 예상 확률 < 50%                       ❌ (낭비 방지)
  Token Budget 잔여량 > 50%                  ✅
  Token Budget 잔여량 < 30%                  ❌
```

---

## Z-2. Agent Response Streaming (에이전트 응답 스트리밍)

전체 결과 생성 완료를 기다리지 않고, 부분 결과를 실시간으로 표시한다.

### 스트리밍 대상

```
  에이전트          스트리밍 단위              사용자 체감
  ──────────────────────────────────────────────────────────────
  Spec Agent        요구사항 항목별            항목이 하나씩 나타남
  Planner           Plan 단계별               단계가 순차 추가됨
  Codegen           파일별                    파일별로 생성 완료 표시
  Review            이슈별                    발견된 이슈가 하나씩 표시
  Test              테스트 케이스별            테스트가 하나씩 실행됨
  Executor          액션별                    액션이 하나씩 완료 표시
```

### 스트리밍 중 방향 수정

```
  사용자가 Codegen 스트리밍 중:
  ──────────────────────────────

  생성 중: Button.tsx ✅ → Modal.tsx ⏳ → Form.tsx ⏳

  사용자: "아, Modal은 다른 방식으로 해줘"
  → Modal.tsx 생성 즉시 중단
  → 사용자 피드백을 반영하여 Modal.tsx 재생성
  → 이미 완료된 Button.tsx는 유지
```

---

## Z-3. Intelligent Caching Layer (지능형 캐싱)

반복되는 연산 결과를 캐싱하여 응답 속도를 향상시킨다.

### 캐싱 대상

```
  대상                          캐시 키                    TTL
  ──────────────────────────────────────────────────────────────
  정책 평가 결과                action_type + scope         5분
  Spec 패턴                     input_hash                  세션
  에이전트 프롬프트 고정 부분    agent_id + version          무기한
  Workspace Profile             project_path + hash         변경 감지
  Mistake Pattern 매칭          input_pattern_hash          1시간
  모델 응답 (동일 입력)         model + input_hash          10분
```

### 캐시 히트율 모니터링

```
  jarvis cache stats

  캐시 히트율 리포트:
  ──────────────────────────────────
  Policy 캐시        hit: 89%   ████████░
  Spec 패턴 캐시     hit: 62%   ██████░░░
  프롬프트 캐시      hit: 95%   █████████
  Workspace 캐시     hit: 78%   ███████░░
  전체 평균          hit: 81%   ████████░

  예상 토큰 절약: 오늘 8,200 토큰 (~$0.06)
```

---

# AA. Social & Collaborative Features (소셜 및 협업 기능)

> 기존 N-8에 Collaboration Mode가 있지만,
> 팀 수준의 **조직적 협업 설계**가 부족하다.

---

## AA-1. Team Policy Governance (팀 정책 거버넌스)

팀 리더가 공통 정책 세트를 정의하고 팀원에게 배포하는 체계이다.

### 정책 계층 구조

```
  ┌─────────────────────────────────────────┐
  │           Organization Policy            │  ← 조직 전체 (최우선)
  │  예: "모든 배포는 Gate 필수"              │
  ├─────────────────────────────────────────┤
  │           Team Policy                    │  ← 팀 수준
  │  예: "React 프로젝트는 Vitest 필수"      │
  ├─────────────────────────────────────────┤
  │           Personal Policy                │  ← 개인 수준 (최하위)
  │  예: "나는 Semi-Auto 모드 선호"          │
  └─────────────────────────────────────────┘

  규칙:
  - 상위 정책을 하위에서 완화 불가 (강화만 가능)
  - 예: 조직에서 "Gate 필수" → 팀에서 "Gate 면제" 불가
  - 개인 정책은 팀 정책과 충돌 시 팀 정책 우선
```

### 팀 정책 동기화

```
  팀 리더: jarvis team policy update --rule "배포 전 lint 필수"
       │
       ▼
  팀 정책 서버에 변경 저장
       │
       ▼
  팀원들에게 자동 동기화 (다음 세션 시작 시)
       │
       ▼
  각 팀원에게 알림:
  "팀 정책이 업데이트되었습니다: 배포 전 lint 필수 (리더: Daniel)"
```

---

## AA-2. Shared Macro & Workflow Library (공유 매크로/워크플로우 라이브러리)

팀 내에서 매크로와 워크플로우를 공유하는 중앙 라이브러리이다.

### 공유 라이브러리 구조

```
  jarvis team library list

  Name                    Author      Uses    Rating   Required
  ──────────────────────────────────────────────────────────────
  deploy-staging          Daniel      45      ★★★★☆   필수
  react-component         Sarah       32      ★★★★★   권장
  api-endpoint-test       Mike        18      ★★★☆☆   선택
  db-migration            Daniel      12      ★★★★☆   필수

  jarvis team library publish react-component    # 팀에 공유
  jarvis team library install deploy-staging     # 팀 라이브러리에서 설치
  jarvis team library rate react-component 5     # 평점 부여
```

### 필수/권장 워크플로우 지정

```
  팀 리더가 지정:
  - 필수 (Required): 특정 트리거 시 반드시 실행
    예: "git push 전 반드시 deploy-staging 워크플로우 실행"
  - 권장 (Recommended): 제안하지만 강제하지 않음
  - 선택 (Optional): 목록에 표시만
```

---

## AA-3. Activity Feed & Knowledge Sharing (활동 피드 및 지식 공유)

팀원들의 JARVIS 사용 패턴에서 유용한 인사이트를 자동 추출한다.

### 지식 공유 자동 추출

```
  추출 대상                      공유 형태                    익명화
  ──────────────────────────────────────────────────────────────────
  자주 발생하는 에러 + 해결법    "이 에러는 이렇게 해결됨"    ✅
  유용한 매크로 사용 패턴        "이 매크로가 인기입니다"     ✅
  성공률 높은 워크플로우         "이 워크플로우 추천"         ✅
  공통 실수 패턴                "이런 실수를 주의하세요"      ✅

  개인 데이터는 절대 공유되지 않음
  모든 공유는 통계/패턴 수준으로만 익명화
```

### 팀 대시보드

```
  ┌─────────────────────────────────────────────────────────┐
  │  👥 Team Dashboard                                       │
  ├─────────────────────────────────────────────────────────┤
  │                                                         │
  │  이번 주 팀 통계:                                       │
  │  - 총 실행: 156회 (지난주 대비 +12%)                    │
  │  - 팀 성공률: 87% (↑ 3%)                                │
  │  - 총 절약 시간: ~4.2시간                               │
  │                                                         │
  │  인기 매크로 TOP 3:                                     │
  │  1. react-component (Sarah) - 32회 사용                  │
  │  2. deploy-staging (Daniel) - 28회 사용                  │
  │  3. api-test (Mike) - 15회 사용                          │
  │                                                         │
  │  이번 주 공유 인사이트:                                  │
  │  💡 "ESLint v9 마이그레이션 시 flat config 필수"        │
  │  💡 "pnpm install --frozen-lockfile로 CI 안정화"        │
  │                                                         │
  └─────────────────────────────────────────────────────────┘
```

---

# AB. Reversible System (모든 작업 되돌리기 가능 — 시스템 전체 가역성 보장)

> 기존 D-5의 Per-Action Undo Stack은 **개별 액션 단위**에 한정된다.
> Reversible System은 시스템 **전체 차원**에서 모든 작업에 대해
> **자동 Restore Point 생성 + 원클릭 복원**을 보장하는 포괄적 시스템이다.
> 이것이 사용자 신뢰도를 폭발적으로 높이는 핵심 기능이다.

---

## AB-1. 자동 Restore Point 시스템

### 핵심 원칙

```
  ┌─────────────────────────────────────────────────────────┐
  │           REVERSIBLE SYSTEM 핵심 원칙                    │
  ├─────────────────────────────────────────────────────────┤
  │                                                         │
  │  "JARVIS가 하는 모든 행위는 되돌릴 수 있어야 한다"       │
  │                                                         │
  │  1. 모든 Action 실행 전 → Restore Point 자동 생성       │
  │  2. Restore Point = 실행 전 상태의 완전한 스냅샷         │
  │  3. 사용자는 언제든 어떤 시점으로든 되돌릴 수 있다        │
  │  4. 되돌리기 실패 = 시스템 결함 (반드시 해결해야 함)     │
  │                                                         │
  │  → 사용자 심리: "뭘 해도 되돌릴 수 있다" = 신뢰도 폭증  │
  └─────────────────────────────────────────────────────────┘
```

### Restore Point 생성 대상 (전체 커버리지)

```
  카테고리             대상                     Restore 방법
  ──────────────────────────────────────────────────────────────────
  파일 변경            파일 생성/수정/삭제       파일 백업 + 해시 검증
                      디렉토리 구조 변경         디렉토리 트리 스냅샷
                      파일 권한 변경             권한 메타데이터 저장

  패키지 설치          npm/pip/brew 등 설치      lockfile 백업 + uninstall
                      의존성 트리 변경           node_modules 스냅샷 또는
                                                lockfile 기반 복원

  설정 변경            .config 파일 수정          설정 파일 백업
                      환경 변수 변경             이전 값 저장
                      시스템 설정 변경            레지스트리/plist 백업

  코드 수정            소스 코드 변경             Git 기반 스냅샷
                      빌드 아티팩트 변경          빌드 출력 백업

  앱 상태              앱 실행/종료               프로세스 상태 기록
                      창 배치 변경               WindowContext 스냅샷

  Git 상태             커밋/브랜치/태그           Git reflog 연동
                      merge/rebase              stash 자동 생성
```

### Restore Point 스키마

```typescript
interface RestorePoint {
  restoreId: string;                    // rp_20260302_0001
  runId: string;                        // 연관된 Run
  actionId: string;                     // 연관된 Action
  createdAt: string;                    // ISO 타임스탬프
  expiresAt: string;                    // 기본 7일 (설정 가능)

  category: 'file' | 'package' | 'config' | 'code' | 'app' | 'git';

  snapshot: {
    type: 'full_backup' | 'diff_backup' | 'metadata_only';
    storagePath: string;                // 백업 저장 경로
    sizeBytes: number;                  // 백업 크기
    checksum: string;                   // SHA-256 해시
  };

  restoreMethod: {
    strategy: 'file_restore' | 'git_checkout' | 'uninstall' | 'config_revert'
            | 'process_kill' | 'registry_revert';
    estimatedTime: number;              // 예상 복원 시간 (ms)
    sideEffects: string[];              // 복원 시 부작용 목록
    confidence: number;                 // 복원 성공 확신도 (0-1)
  };

  dependencies: string[];              // 이 RP를 복원하려면 먼저 복원해야 할 RP들
  isReversible: boolean;                // 되돌릴 수 있는가
  irreversibleReason?: string;          // 불가능한 경우 사유
}
```

---

## AB-2. 되돌리기 UI (Restore Point Timeline)

### 메인 되돌리기 인터페이스

```
  ┌─────────────────────────────────────────────────────────────┐
  │  ⟲ 되돌리기 (Reversible System)                             │
  ├─────────────────────────────────────────────────────────────┤
  │                                                             │
  │  현재 세션 타임라인:                                         │
  │                                                             │
  │  10:00  ● rp_001  파일 생성: Button.tsx        [⟲ 되돌리기] │
  │  10:01  ● rp_002  파일 생성: Button.test.tsx   [⟲ 되돌리기] │
  │  10:01  ● rp_003  패키지 설치: @types/react    [⟲ 되돌리기] │
  │  10:02  ● rp_004  코드 수정: App.tsx (+15줄)   [⟲ 되돌리기] │
  │  10:03  ● rp_005  설정 변경: tsconfig.json     [⟲ 되돌리기] │
  │  10:05  ● rp_006  Git 커밋: "Add Button"       [⟲ 되돌리기] │
  │                                                             │
  │  ──────────────────────────────────────────────────────     │
  │                                                             │
  │  [이 시점으로 되돌리기]  원하는 Restore Point 클릭           │
  │  [전체 되돌리기]  세션의 모든 변경사항 되돌리기               │
  │  [선택적 되돌리기]  특정 항목만 골라서 되돌리기               │
  │                                                             │
  └─────────────────────────────────────────────────────────────┘
```

### 되돌리기 확인 Gate

```
  ┌─────────────────────────────────────────────────────────┐
  │  ⟲ 되돌리기 확인                                         │
  │                                                         │
  │  대상: rp_003 ~ rp_006 (4개 작업)                       │
  │                                                         │
  │  되돌려질 항목:                                          │
  │  ✅ rp_006  Git 커밋 되돌리기 (git reset)               │
  │  ✅ rp_005  tsconfig.json 원래대로 복원                  │
  │  ✅ rp_004  App.tsx 원래대로 복원                        │
  │  ✅ rp_003  @types/react 제거 (npm uninstall)           │
  │                                                         │
  │  유지될 항목:                                            │
  │  ● rp_001  Button.tsx (유지)                            │
  │  ● rp_002  Button.test.tsx (유지)                       │
  │                                                         │
  │  ⚠ 주의: Git 커밋이 되돌려집니다                        │
  │                                                         │
  │  [되돌리기 실행]  [취소]                                 │
  └─────────────────────────────────────────────────────────┘
```

### 되돌릴 수 없는 작업 처리

```
  비가역 작업 발생 시:
  ──────────────────────

  실행 전 경고:
  ┌─────────────────────────────────────────────┐
  │  ⚠ 비가역 작업 경고                          │
  │                                             │
  │  다음 작업은 되돌릴 수 없습니다:             │
  │  - 외부 API로 데이터 전송                    │
  │  - 이메일 발송                               │
  │  - 원격 서버 배포                             │
  │                                             │
  │  이 작업 이전까지의 Restore Point는          │
  │  정상적으로 동작합니다.                       │
  │                                             │
  │  [이해했습니다, 진행] [취소]                  │
  └─────────────────────────────────────────────┘

  비가역 작업 이후:
  → 해당 Restore Point에 ⚠ 마크 표시
  → "이 시점 이후의 되돌리기는 외부 전송 내용을 되돌리지 못합니다"
  → 외부 영향을 최소화하기 위한 보상 액션 제안 (가능한 경우)
```

---

## AB-3. Restore Point 관리 정책

### 저장 및 만료 정책

```
  보존 기간                설정                이유
  ──────────────────────────────────────────────────────────────
  세션 내 Restore Point    세션 종료까지 유지   즉시 되돌리기용
  일간 Restore Point       7일 보존            최근 작업 복구
  주간 Restore Point       30일 보존           장기 복구
  마일스톤 RP (수동)       무기한              중요 시점 보존

  디스크 사용량 관리:
  - 총 RP 크기 한도: 기본 5GB (설정 가능)
  - 한도 초과 시: 가장 오래된 RP부터 정리 + 사용자 알림
  - diff 압축: 유사한 RP는 diff만 저장 (용량 절약)
  - 중복 제거: 동일 파일의 중복 백업 방지
```

### Restore Point 관리 CLI

```
  jarvis restore list                      # RP 목록
  jarvis restore list --run=<run-id>       # 특정 Run의 RP
  jarvis restore show <rp-id>              # RP 상세 정보
  jarvis restore execute <rp-id>           # 특정 시점으로 되돌리기
  jarvis restore execute --all             # 전체 되돌리기
  jarvis restore execute --select          # 선택적 되돌리기
  jarvis restore pin <rp-id>               # 마일스톤으로 영구 보존
  jarvis restore unpin <rp-id>             # 마일스톤 해제
  jarvis restore cleanup                   # 만료된 RP 정리
  jarvis restore stats                     # RP 디스크 사용량 통계
```

---

## AB-4. 기존 시스템과의 통합

```
  통합 대상                 연동 방식
  ──────────────────────────────────────────────────────────────
  D-5 Undo Stack           Undo Stack은 Restore Point의 가벼운 버전
                           RP가 더 포괄적 (Undo Stack은 RP의 서브셋)
                           단일 Action 되돌리기 = Undo Stack
                           다중 Action/시점 되돌리기 = Restore Point

  Recovery Agent           Recovery가 롤백 시 RP를 활용
                           RP 없는 상태에서의 폴백 전략 유지

  Audit Log                모든 RP 생성/사용/삭제를 감사 로그에 기록
                           "누가 언제 어떤 시점으로 되돌렸는지" 추적

  Gate System              되돌리기 실행 전 Gate 표시 (HIGH risk 이상)
                           LOW risk 되돌리기는 자동 허용

  Timeline UI              RP 아이콘을 Timeline에 통합 표시
                           클릭 시 되돌리기 UI 직접 접근

  Emergency Stop           Emergency Stop 시 자동으로 최근 RP 정보 표시
                           "마지막 안전 시점으로 되돌리시겠습니까?"
```

---

# 기존 빈틈 보완 (8건, 보완 7~14)

---

## 보완 7: Agent 간 Context Window 공유 최적화

> 기존 A-2의 에이전트 간 통신에서 **전체 artifact를 전달**하는 구조는
> 대규모 코드베이스에서 Context Window 초과 위험이 있다.

### Context Slicing 전략

```
  기존 방식 (위험):
  ─────────────────
  Codegen → Review: 전체 코드 파일 N개 전달
  → 대규모 프로젝트에서 Context Window 초과

  개선 방식 (Context Slicing):
  ─────────────────────────────
  ┌──────────────────────────────────────────────┐
  │           Context Slicing Layer               │
  ├──────────────────────────────────────────────┤
  │                                              │
  │  에이전트별 필요 정보만 추출:                  │
  │                                              │
  │  Spec Agent → Policy Agent:                  │
  │    전체 Spec 대신 → 위험 관련 항목만 전달      │
  │                                              │
  │  Codegen → Review:                           │
  │    전체 파일 대신 → 변경된 diff만 전달         │
  │    + 관련 컨텍스트 요약 (함수 시그니처 등)     │
  │                                              │
  │  Review → Test:                              │
  │    리뷰 전체 대신 → 테스트 관련 이슈만 전달    │
  │                                              │
  └──────────────────────────────────────────────┘
```

### Summary Layer 명세

```typescript
interface ContextSlice {
  sourceAgent: AgentId;
  targetAgent: AgentId;
  sliceStrategy: 'full' | 'diff_only' | 'summary' | 'relevant_subset';

  content: {
    summary: string;          // 1-2 문장 요약 (항상 포함)
    essentialData: any;       // 대상 에이전트가 반드시 필요한 데이터
    optionalContext?: any;    // 참고용 추가 맥락 (토큰 여유 시)
    fullArtifactRef: string;  // 전체 원본 참조 경로 (필요 시 조회)
  };

  tokenEstimate: number;      // 예상 토큰 수
  compressionRatio: number;   // 압축률 (원본 대비)
}
```

---

## 보완 8: Trust Mode 역방향 자동 전환 규칙

> 현재 Trust Mode는 상향 전환(Observe → Auto)만 다룬다.
> 안전을 위해 **자동 하향 전환 규칙**이 필요하다.

### 자동 하향 전환 조건

```
  현재 모드     트리거 조건                          전환 대상
  ──────────────────────────────────────────────────────────────
  Auto         연속 실패 3회                         Semi-Auto
  Auto         HIGH risk 이벤트 발생                 Semi-Auto (즉시)
  Auto         사용자 Undo/Rollback 요청              Semi-Auto
  Semi-Auto    연속 실패 5회                         Suggest
  Semi-Auto    CRITICAL 보안 이벤트                  Observe (즉시)
  Suggest      Emergency Stop 발동                   Observe (즉시)
  Any          사용자 수동 하향 요청                  지정 모드
```

### 하향 전환 알림

```
  ┌──────────────────────────────────────────────────┐
  │  🔒 Trust Mode 자동 하향                          │
  │                                                  │
  │  Auto → Semi-Auto                                │
  │                                                  │
  │  사유: 연속 3회 실패 감지                         │
  │  - run_015: codeGeneration 실패                  │
  │  - run_016: testing 실패                         │
  │  - run_017: policyEvaluation 거부                │
  │                                                  │
  │  이제 MEDIUM 이상 작업은 승인이 필요합니다.       │
  │                                                  │
  │  [유지]  [Auto로 복원]  [Suggest로 추가 하향]     │
  └──────────────────────────────────────────────────┘
```

### 복원 조건

```
  하향 후 복원 조건:
  ─────────────────
  - 연속 성공 5회 이상 + 사용자 승인 → 한 단계 상향 가능
  - CRITICAL 이벤트로 하향된 경우: 수동 복원만 허용
  - 자동 하향 이력은 Audit Log에 기록
```

---

## 보완 9: Executor OS 조작 속도 제어 (Rate Limiter)

> Executor가 OS를 매우 빠르게 조작하면 사용자가 따라가지 못한다.

### Trust Mode별 속도 설정

```
  Trust Mode     액션 간 기본 딜레이     사용자 확인
  ──────────────────────────────────────────────────────
  Observe        3초                    매 액션마다 확인 가능
  Suggest        2초                    제안 후 사용자 실행
  Semi-Auto      1초                    LOW는 자동, 나머지 확인
  Auto           0초 (제한 없음)        결과만 표시

  사용자 속도 조절 UI:
  ┌─────────────────────────────────────────────┐
  │  ⏩ 실행 속도                                │
  │                                             │
  │  🐢 ──────●───────────── 🐇                 │
  │       느림    보통    빠름    최대            │
  │                                             │
  │  현재: 보통 (1초 딜레이)                     │
  └─────────────────────────────────────────────┘
```

---

## 보완 10: 크로스 플랫폼 Action API 추상화 강화

> 현재 Action API에 Windows/macOS 차이 처리가 명시적이지 않다.

### 플랫폼 어댑터 레이어

```
  추상 Action          Windows 구현              macOS 구현
  ──────────────────────────────────────────────────────────────
  fs.delete(soft)      → RecycleBin 이동         → Trash 이동
  fs.delete(hard)      → 직접 삭제               → 직접 삭제
  app.launch           → Start-Process           → open -a
  app.kill             → taskkill /PID            → kill -9
  clipboard.read       → PowerShell Get-Clipboard→ pbpaste
  clipboard.write      → PowerShell Set-Clipboard→ pbcopy
  system.notify        → BurntToast (PS)         → osascript
  system.volume        → nircmd                  → osascript
  credential.read      → Credential Manager      → Keychain
  registry.read        → reg query               → defaults read
  pkg.install          → winget / choco          → brew
```

### 플랫폼 불가 액션 처리

```
  상황: macOS에서 "레지스트리 변경" 요청
  ──────────────────────────────────────
  1. 플랫폼 감지 → macOS
  2. registry.write → macOS에서 불가
  3. 대체 제안: "macOS에서는 defaults 명령을 사용합니다.
                 해당하는 설정이 있는지 확인할까요?"
  4. 사용자 승인 후 대체 액션 실행
```

---

## 보완 11: Audit Log 검색 및 분석 기능

> 현재 Audit Log는 "기록"에 집중하지만, **검색/분석 기능이 부재**한다.

### 구조화된 쿼리 지원

```
  jarvis audit search --agent=Executor --risk=HIGH --date=today
  jarvis audit search --action="fs.delete" --period="2026-02-01:2026-03-01"
  jarvis audit search --gate=rejected --count
  jarvis audit search --user=daniel --result=failed
```

### 패턴 분석

```
  jarvis audit analyze

  ┌─────────────────────────────────────────────────────────┐
  │  📊 Audit 패턴 분석 (최근 7일)                           │
  ├─────────────────────────────────────────────────────────┤
  │                                                         │
  │  가장 많이 거부된 액션 유형:                              │
  │  1. pkg.install (12회) - "보안 미검증 패키지"           │
  │  2. fs.delete (8회) - "보호 경로"                       │
  │  3. net.access (5회) - "미허가 도메인"                  │
  │                                                         │
  │  이상 징후:                                              │
  │  ⚠ 3월 1일 fs.delete 요청이 평소 대비 5배 (조사 권장)  │
  │                                                         │
  │  위험도 분포 추이:                                       │
  │  LOW:  ████████████ 68%  (안정)                         │
  │  MED:  █████ 25%         (안정)                         │
  │  HIGH: ██ 7%             (↑ 2% 주의)                    │
  └─────────────────────────────────────────────────────────┘
```

---

## 보완 12: Gate Timeout 맥락 인식 동적 조정

> 현재 Gate 타임아웃이 고정값(5분)이지만, 맥락에 따라 유연해야 한다.

### 동적 타임아웃 규칙

```
  맥락                          타임아웃          이유
  ──────────────────────────────────────────────────────────────
  LOW risk, 단순 확인            2분              빠른 응답 기대
  MEDIUM risk, 일반 작업         5분 (기본)       표준 판단 시간
  HIGH risk, 다수 파일 변경      15분             신중한 검토 필요
  DESTRUCTIVE 작업               30분             충분한 고려 시간
  사용자 away 상태               무기한 대기       재방문 시 알림
  모바일 알림 연동               +10분 추가       원격 승인 시간

  사용자 상태 감지:
  - 마우스/키보드 활동 → active
  - 1분 이상 미활동 → idle
  - 5분 이상 미활동 → away
  - away 시: Gate 타임아웃 무기한 + 모바일 푸시 알림
```

---

## 보완 13: State Machine 병렬 상태 (Parallel States) 지원

> 현재 XState 상태 머신이 선형 진행 위주이지만,
> Review와 Test를 동시 실행하는 등 **병렬 상태**가 필요하다.

### 병렬 상태 설계

```
  기존 (선형):
  Code → Review → Test → Execute

  개선 (병렬):
  Code ──┬── Review ──┬── Execute
         └── Test ────┘
              (병렬)

  XState v5 Parallel State 적용:
  ──────────────────────────────

  parallelValidation: {
    type: 'parallel',
    states: {
      review: {
        initial: 'running',
        states: {
          running: { invoke: { src: 'reviewAgent' } },
          done: { type: 'final' }
        }
      },
      testing: {
        initial: 'running',
        states: {
          running: { invoke: { src: 'testBuildAgent' } },
          done: { type: 'final' }
        }
      }
    },
    onDone: 'executionGate'   // 둘 다 완료 시 합류
  }
```

### 병렬 실패 처리 정책

```
  정책                          대응
  ──────────────────────────────────────────────────
  Review 실패, Test 성공        Test 결과 보존, Review만 재실행
  Review 성공, Test 실패        Review 결과 보존, Code → Test 재실행
  둘 다 실패                    전체 재시도 (Codegen부터)
  하나가 실패 시 다른 것 취소?  기본: 아니오 (독립 실행)
                                옵션: 사용자 설정 가능
```

---

## 보완 14: Emergency Stop 이후 "부분 완료 상태" 처리

> 기존 보완 4에서 Emergency Stop 이후 재개 프로토콜이 있지만,
> **이미 완료된 성공 액션의 처리**가 미정의다.

### 부분 완료 상태 처리 흐름

```
  Emergency Stop 발동
       │
       ▼
  ┌──────────────────────────────────────────────────┐
  │  🛑 Emergency Stop — 부분 완료 상태               │
  │                                                  │
  │  완료된 액션 (되돌리기 가능):                     │
  │  ✅ rp_001  Button.tsx 생성                      │
  │  ✅ rp_002  Button.test.tsx 생성                 │
  │  ✅ rp_003  @types/react 설치                    │
  │                                                  │
  │  중단된 액션:                                     │
  │  ⏹ rp_004  App.tsx 수정 (50% 진행됨)             │
  │  ⏹ rp_005  tsconfig.json 수정 (미시작)           │
  │                                                  │
  │  일관성 검사 결과:                                │
  │  ⚠ App.tsx가 부분 수정 상태 — 불일치 가능성      │
  │                                                  │
  │  선택:                                           │
  │  [1. 완료된 부분 유지 + 중단된 부분만 되돌리기]   │
  │  [2. 전체 되돌리기 (모든 RP 복원)]               │
  │  [3. 선택적 되돌리기 (항목별 선택)]              │
  │  [4. 현재 상태 유지 (수동 처리)]                 │
  └──────────────────────────────────────────────────┘
```

### 프로젝트 일관성 검증 도구

```
  Emergency Stop 후 자동 실행:
  ────────────────────────────
  1. 파일 시스템 일관성 검사
     - 부분 수정된 파일 감지
     - 생성은 됐지만 등록 안 된 파일 감지
     - import 참조가 깨진 파일 감지

  2. 패키지 일관성 검사
     - package.json vs node_modules 불일치 감지
     - lockfile vs 실제 설치 불일치 감지

  3. Git 일관성 검사
     - 스테이징 영역의 불완전한 변경 감지
     - 진행 중이던 merge/rebase 감지

  4. 검사 결과 리포트 표시
     - 문제 없음 → "안전합니다" 메시지
     - 불일치 발견 → 구체적 수정 제안 + Gate
```

---

# 추가 섹션 요약 (최종 업데이트)

```
  총 109개 보완 항목 반영 완료 (기존 80 + 신규 29)

  ═══════════════════════════════════════════════════════════
  1차 보완 섹션 (68개, A~N):
  ═══════════════════════════════════════════════════════════
  A. 아키텍처    (5개): Health Monitor, 통신 프로토콜, Degradation, Multi-Run, State Resume
  B. 보안        (6개): Clipboard, Screen Capture, Process Integrity, Prompt Injection, Network DLP, USB
  C. 거버넌스    (5개): Conflict Resolution, Policy Expiration, Delegation Chain, Abuse Prevention, Learning 검증
  D. Executor    (5개): Action DAG, Dry-Run, 리소스 모니터링, Multi-Window, Undo Stack
  E. UI/UX      (6개): 접근성, 알림 우선순위, 다국어, 모바일, 온보딩, 대시보드
  F. 음성/대화   (3개): 음성 인증, 다중 턴 관리, 선제적 제안
  G. 테스트      (4개): Integration Test, Chaos Engineering, Policy 시뮬레이션, 벤치마크
  H. 데이터      (3개): Log Rotation, Bundle Versioning, Offline-First
  I. 확장성      (4개): Plugin Architecture, Multi-OS, Multi-User, Model Hot-Swap
  J. 구현 기반   (6개): Monorepo, State Machine, CLI MVP, E2E 시나리오, 우선순위, Vertical Slice
  K. 런타임 지능 (5개): Token Budget, Watchdog, Pattern Cache, Workspace Profile, Recovery Playbook
  L. 개발자 경험 (5개): Agent SDK, Policy DSL, DevTools, Threat Model, Versioning
  M. 자기 교정   (5개): Correction Loop, Performance Scoring, Mistake DB, Adaptive Prompt, Satisfaction Signal
  N. 고급 기능   (8개): Semantic Memory, Disambiguation UI, Macro System, Cost Estimator,
                        Smart Context, Agent Debate, Trust Escalation, Collaboration Mode

  ═══════════════════════════════════════════════════════════
  2차 추가 섹션 (12개 신규 기능, O~T + 보완 6건):
  ═══════════════════════════════════════════════════════════
  O. 맥락 인식   (2개): Context-Aware Task Prioritization, 맥락 기반 자동 작업 제안
  P. 자연어 정책 (4개): NL→Policy 변환, 정책 수정/삭제, 정확도 보장, 상태 모델
  Q. 상시 감시   (5개): 감시 계층 구조, 엔진 상태 모델, Trust Mode 연동, 리소스 보호, UI
  R. 작업 체이닝 (6개): 워크플로우 스키마, Step 타입, 트리거 타입, NL 생성, CLI, 기존 통합
  S. 디바이스 이관(6개): 핸드오프 아키텍처, 대상/조건, 프로토콜, 상태 모델, 보안, UI
  T. 설명 보고서 (7개): 실행/일간/주간/보안/비용/사고 보고서, 생성 엔진, CLI
  보완 1: 비가역 외부 부작용 방어 (GATE_IRREVERSIBLE_ACTION)
  보완 2: Budget-Model 연동 매트릭스 (자동 모델 다운그레이드)
  보완 3: Multi-User 정책 충돌 해결 규칙 (정책 병합 엔진)
  보완 4: Emergency Stop 이후 재개 프로토콜 (상태 복원/롤백)
  보완 5: Agent Debate 비용 적응형 규칙 (토론 캐시/조기 종료)
  보완 6: Workspace Profile 자동 감지 확장 (컨벤션/Git/배포)

  ═══════════════════════════════════════════════════════════
  3차 추가 섹션 (29개 신규, U~AB + 보완 8건):
  ═══════════════════════════════════════════════════════════
  U. 개인정보/데이터 주권 (3개): 데이터 분류 체계, 삭제권 프로토콜, 데이터 상주 정책
  V. 에이전트 조합       (3개): 커스텀 에이전트 정의, 파이프라인 커스터마이징, 마켓플레이스
  W. 지능형 오류 복구    (3개): 전략 자동 선택, 연쇄 실패 방지, 사후 분석 자동 생성
  X. 음성 UX             (3개): 음성 문법/폴백, 음성 피드백/상태, 다중 모달 입력 통합
  Y. 규정 준수/감사      (3개): 규정 준수 템플릿, 감사 추적 내보내기, 규정 변경 자동 적응
  Z. 성능 최적화         (3개): 투기적 실행, 응답 스트리밍, 지능형 캐싱
  AA. 협업 기능           (3개): 팀 정책 거버넌스, 공유 매크로/워크플로우, 활동 피드/지식 공유
  AB. Reversible System  (4개): 자동 Restore Point, 되돌리기 UI, RP 관리 정책, 기존 시스템 통합
  보완 7:  Agent 간 Context Window 공유 최적화 (Context Slicing)
  보완 8:  Trust Mode 역방향 자동 전환 규칙
  보완 9:  Executor OS 조작 속도 제어 (Rate Limiter)
  보완 10: 크로스 플랫폼 Action API 추상화 강화
  보완 11: Audit Log 검색 및 분석 기능
  보완 12: Gate Timeout 맥락 인식 동적 조정
  보완 13: State Machine 병렬 상태 (Parallel States) 지원
  보완 14: Emergency Stop 부분 완료 상태 처리
```
