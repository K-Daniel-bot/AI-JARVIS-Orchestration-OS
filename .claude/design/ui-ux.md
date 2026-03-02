# JARVIS OS - UI/UX 설계 문서

> 이 문서는 설계 참고 문서입니다. 에이전트 Bundle 파일과 달리, 특정 에이전트에 종속되지 않는 전체 시스템 설계 정보를 담고 있습니다.

---

## 1. 레이아웃 컨셉: 3패널 + 상단 상태바

핵심 원칙: "자유 대화형"과 "통제/감사/승인 UI"를 **한 화면에 공존**시킨다.

### 1.1 최상단 상태/안전 바 (Sticky Top Bar)

항상 고정 표시 항목:

| 항목 | 설명 |
|------|------|
| 현재 모드 | `Observe / Suggest / Semi-auto / Auto` |
| Risk Level | `LOW/MED/HIGH` + 점수 |
| 현재 실행 단계 | `Planning / Executing / Waiting Approval` |
| Capability TTL | 남은 시간 카운트다운 |
| Emergency Stop | 항상 노출되는 긴급 정지 버튼 |
| 제어 대상 | `Windows / macOS / Browser Sandbox` |
| Subject Badge | `Owner · Windows · sess_abc · Local` |

> UX 원칙: 사용자는 "지금 AI가 위험한 상태인지"를 1초 내에 파악할 수 있어야 한다.

### 1.2 좌측 패널: 채팅/음성 (Conversation Panel)

- 기본 ChatGPT 스타일 대화
- 모든 메시지에 **작업 컨텍스트 배지** 부착
  - `This message will not execute actions (Observe Mode)`
  - `This message may trigger actions (Semi-auto)`
- 음성 입력: transcript 확정 전 수정 가능
- 상단에 **Profile Pill** 표시: `User: 홍길동님 · Role: Dev · Mode: Semi-auto`

### 1.3 중앙 패널: 계획 및 타임라인 (Execution Timeline Panel)

제품의 핵심 차별점이 되는 영역.

- Step-by-step 타임라인 (Plan → Actions)
- 각 Step 펼치기: Reason / Policy refs / Capability / Impact
- 표기 규칙:
  - ✅ 실행됨 | ⏸️ 대기(승인 필요) | ⛔ 차단됨 | 🧪 시뮬레이션만 | ⏳ 진행중

### 1.4 우측 패널: 안전/승인/증거 (Safety & Approval Panel)

4개 탭으로 구성:

| 탭 | 핵심 기능 |
|----|----------|
| **승인** | Gate 카드, 승인 버튼 3종 (Approve once / Always / Reject), Edit scope |
| **정책** | 적용 중 정책, 제안된 정책, 정책 diff |
| **증거** | 스크린샷/로그/해시/스캔 결과, 롤백 제안 |
| **감사** | Append-only 로그 뷰어 (필터: time/agent/action/risk) |

### 1.5 하단 증거 스트립

- `EvidenceChip` (screenshot/log/hash)으로 구성된 가로 스트립

### 1.6 텍스트 와이어프레임

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

---

## 2. UI 컴포넌트 목록 (React 기준)

### 2.1 앱 셸
- `AppShell` > `TopStatusBar` + `ThreePaneLayout` + `BottomEvidenceStrip` + `GlobalOverlays`
- 오버레이: `EmergencyStopOverlay`, `SecureInputOverlay`, `ScopeEditorModal`, `DiffViewerModal`, `UrlPrecheckDetailsModal`, `ScanReportModal`

### 2.2 상단 상태바
- `ModeBadge`, `RiskBadge`, `StepBadge`, `TTLCountdown`, `TargetDeviceBadge`, `StopButton`, `ConnectionIndicator`

### 2.3 채팅 패널
- `ChatHeader` > `SessionContextPills` + `ExecutionArmedToggle`
- `MessageList` > `MessageBubble` + `MessageMeta` + `InlineCitations`
- `VoiceInputBar` > `VoiceWaveform` + `TranscriptDraftEditor` + `SendButton`
- `PromptComposer` > `QuickActions` ("계획만", "시뮬레이션만", "실행")

### 2.4 타임라인 패널
- `TimelineHeader` > `RunSelector` + `FilterChips`
- `TimelineList` > `TimelineNode` (NodeStatusIcon + NodeTitle + NodeSummary + NodeActions)
  - `WhyButton`, `ViewDetailsButton`, `ViewEvidenceButton`
- `NodeDetailsDrawer` > `PolicyRefs`, `CapabilitiesUsed`, `ExpectedImpact`, `ActionPreviewList`
- `MiniMap` (긴 플로우 스크롤 보조)

### 2.5 안전 패널 탭 구조
- 승인: `GateCard`, `GateQueueList`, `ApprovalButtons`, `RiskExplainer`, `CapabilityPreview`
- 정책: `PolicyBundleViewer`, `PolicyDiffViewer`, `ProposedPolicyList`, `PolicyVersionSwitcher`
- 증거: `EvidenceGallery`, `ScanResultCard`, `HashBadge`, `RollbackSuggestionCard`
- 감사: `AuditLogTable`, `AuditFilters`, `ExportButton`

### 2.6 공통 컴포넌트
- `GlassCard`, `GlassPanel`, `HudDivider`, `HudCorner`
- `Badge`, `Pill`, `Tooltip`, `KbdHint`
- `Spinner`, `ProgressBar`, `CodeBlock`, `JsonViewer`
- `DiffViewer` (monaco 기반), `SeverityBanner`
- `ScopeSlider` + `PathPicker` (권한 축소 UI)

---

## 3. 프론트엔드 상태 모델

### 3.1 설계 원칙
- 백엔드(Orchestrator/Policy/Executor)가 "진실", 프론트는 **event-driven projection**
- 프론트는 `Run` 단위로 상태 렌더링
- Gate는 "특별한 TimelineNode"이지만 ApprovalTab에서 분리 표시

### 3.2 핵심 도메인 타입

```typescript
type TrustMode = "OBSERVE" | "SUGGEST" | "SEMI_AUTO" | "AUTO";
type RiskLevel = "LOW" | "MEDIUM" | "HIGH";
type NodeStatus = "PENDING" | "RUNNING" | "DONE" | "WAITING_GATE" | "DENIED" | "SIMULATED";

type TimelineNodeType =
  | "SPEC" | "POLICY" | "PLAN" | "GATE" | "CODEGEN"
  | "REVIEW" | "APPLY" | "TEST" | "RUN" | "RECOVERY"
  | "WEB_PRECHECK" | "DOWNLOAD_PIPELINE" | "DESTRUCTIVE_OP";

type GateType =
  | "GATE_PLAN_SCOPE" | "GATE_TOOL_INSTALL_NETWORK"
  | "GATE_APPLY_CHANGES" | "GATE_RUN_DEPLOY"
  | "GATE_WEB_PRECHECK" | "GATE_DOWNLOAD_APPROVE"
  | "GATE_DESTRUCTIVE" | "GATE_SAFETY_HOLD" | "GATE_POLICY_UPDATE";

type EvidenceType =
  "SCREENSHOT" | "TERMINAL_LOG" | "DIFF" | "SCAN_REPORT"
  | "HASH" | "POLICY_DECISION" | "PLAN_JSON";

interface TimelineNode {
  id: string;
  type: TimelineNodeType;
  status: NodeStatus;
  title: string;
  summary?: string;
  agent?: string;
  startedAt?: string;
  endedAt?: string;
  risk?: { score: number; level: RiskLevel; tags: string[] };
  policyRefs?: string[];
  capabilityRefs?: string[];
  gate?: { gateId: string; gateType: GateType; reason: string };
  evidenceIds: string[];
  children?: string[];
  groupId?: string;  // 그룹화 지원
}

interface GateState {
  gateId: string;
  gateType: GateType;
  status: "OPEN" | "APPROVED" | "REJECTED" | "EXPIRED";
  title: string;
  description: string;
  risk: { score: number; level: RiskLevel; tags: string[] };
  payload: Record<string, any>;
  actions: Array<"APPROVE_ONCE" | "APPROVE_ALWAYS" | "REJECT" | "EDIT_SCOPE">;
  resolution?: {
    action: string;
    decidedAt: string;
    decidedBy: "USER";
    scopeOverride?: Record<string, any>;
  };
}

interface RunState {
  runId: string;
  trustMode: TrustMode;
  target: "WINDOWS" | "MAC" | "BROWSER_SANDBOX";
  risk: { score: number; level: RiskLevel; tags: string[] };
  currentStepLabel: string;
  ttlExpiresAt?: string;
  timeline: { order: string[]; nodes: Record<string, TimelineNode> };
  gates: { openQueue: string[]; byId: Record<string, GateState> };
  evidence: { byId: Record<string, EvidenceItem>; recent: string[] };
  ui: {
    selectedNodeId?: string;
    selectedGateId?: string;
    panels: { rightTab: "APPROVAL" | "POLICY" | "EVIDENCE" | "AUDIT" };
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

### 3.3 이벤트 기반 업데이트

프론트 이벤트 스트림:
- `RUN_CREATED`, `NODE_UPDATED`, `GATE_OPENED`, `GATE_RESOLVED`
- `EVIDENCE_ADDED`, `RISK_UPDATED`, `TTL_UPDATED`
- `EXECUTOR_DISCONNECTED`, `EMERGENCY_STOPPED`

> 프론트는 이벤트를 reducer로 적용하여 `RunState` projection을 갱신한다.

---

## 4. 게이트 와이어프레임

### 4.1 공통 게이트 카드 레이아웃

```
┌─────────────────────────────────────────────┐
│ [GATE] {title}                     {timer}  │
│ Risk: {level} {score}  Tags: {tags...}      │
├─────────────────────────────────────────────┤
│ Why needed: {reasons}                       │
├─────────────────────────────────────────────┤
│ Scope / Impact Summary                      │
│ Files: {n}  Commands: {n}  Net: {yes/no}    │
├─────────────────────────────────────────────┤
│ Details (expand) ▾                          │
├─────────────────────────────────────────────┤
│ [Edit scope]  [Reject]  [Approve once]      │
│                         [Approve always]    │
└─────────────────────────────────────────────┘
```

### 4.2 게이트별 핵심 Payload

| 게이트 | 표시 항목 |
|--------|----------|
| **#1 계획/범위** | Goal, Plan steps, 파일 scope, 필요 tool, 네트워크 사용 여부, 예산 |
| **#2 변경 적용** | 수정 파일 목록, diff 요약, 위험 변경 강조, 의존성 변경 |
| **#3 실행/배포** | 실행 커맨드, 외부 통신 여부, 권한 상승 여부, 롤백 포인트 |
| **웹 사전검사** | normalized URL, redirect chain, 피싱 신호, reputation score |
| **다운로드 승인** | 파일명/크기/해시, 매직바이트 타입, 스캔 결과, 반출 경로 |
| **파괴적 작업** | 대상 목록, soft delete 여부, mass threshold 이유, 롤백 옵션 |

---

## 5. 디자인 토큰

컨셉: **Glass + Minimal HUD**

### 5.1 컬러 토큰 (역할 기반)

| 토큰 | 용도 |
|------|------|
| `--bg-0` | 앱 배경 (짙은 네이비/검정) |
| `--bg-1` | 패널 배경 (글래스) |
| `--stroke-0` | 패널 경계선 (얇은 HUD 라인) |
| `--text-0` / `--text-1` | 기본 / 약한(메타) 텍스트 |
| `--accent` | 포커스/선택/진행 (선택/포커스 전용) |
| `--danger` | High risk / STOP (STOP/Gate(HIGH)/Hold 전용) |
| `--warning` | Medium risk |
| `--ok` | Low risk |

> 규칙: 색은 "상태 표시"에만 강하게 사용, 위험은 배경이 아닌 테두리/배지/아이콘 위주

### 5.2 글로우/라인 토큰
- `--glow-soft`: 선택된 카드 외곽 (약)
- `--glow-strong`: 위험/승인 대기 (중)
- `--hud-line`: 1px, 20~40% 투명
- `--glass-blur`: 12~20px

> 글로우는 "선택/대기/위험" 상태에서만, 평상시 최대한 차분하게

### 5.3 타이포 토큰
- UI: `Inter / Pretendard` (한글 포함)
- Mono: `JetBrains Mono`
- 크기: Top bar 12~13px / 패널 제목 14~16px / 본문 13~14px

### 5.4 애니메이션 규칙 (Framer Motion)
- `ease`: `cubic-bezier(0.2, 0.8, 0.2, 1)`
- duration: hover 120ms / panel 180~240ms / gate 등장 260~320ms
- Gate 등장: slide-up 6px + fade-in
- **금지**: 지속적 깜빡임, 상시 HUD 움직임

### 5.5 레이아웃 토큰
- radius: cards 16~20px
- spacing: 패널 padding 12~16px
- grid: `28% / 44% / 28%` (대화/타임라인/통제)
- 작은 화면: `2 columns + drawer`

---

## 6. 원격 조작 액션 애니메이션

핵심 패턴: **실행은 빠르게, 표시는 이해 가능하게** (Decouple 원칙)

### 6.1 분리 설계
- Executor 실행 속도: 최대한 빠르게 (기계 속도)
- Animation 렌더링: 압축 리플레이 또는 가속 커서로 표현

### 6.2 커서 애니메이션 규칙
- 이동: Bezier / S-curve 가속 (시작 가속 → 종점 감속)
- 목표 주변 **Target Highlight** 먼저 표시
- 클릭: Click Ring(파동) 1회 + Action Label
- 타이핑: Typing sweep 애니메이션, 민감 입력은 Secure Input Overlay

### 6.3 액션 궤적 UI
- 이동 궤적 (1~2초 후 fade-out)
- 다음 목표 "예고 점"
- TimelinePanel과 연결 (Step 클릭 → 해당 궤적/스크린샷/로그 점프)

### 6.4 사용자 추적 보조 장치
1. **액션 큐 프리뷰**: 실행 직전 2~5개 액션 미리보기 카드
2. **압축 재생**: EvidenceTab에서 `Replay actions (x2, x5)` 제공
3. **위험 순간 감속**: `DESTRUCTIVE`, `DOWNLOAD`, `LOGIN`, `PRIVILEGE` 태그 시 애니메이션 시간 강제 연장

### 6.5 원격 제어 상태 타입

```typescript
interface CursorFrame {
  t: number;
  x: number;
  y: number;
  type?: "MOVE" | "CLICK" | "TYPE" | "SCROLL";
  meta?: Record<string, any>;
}

interface RemoteControlState {
  streamStatus: "DISCONNECTED" | "CONNECTING" | "LIVE";
  cursorVisible: boolean;
  cursorMode: "LIVE" | "REPLAY" | "SIMULATION";
  speedMultiplier: 1 | 2 | 5;
  targetHighlight?: { x: number; y: number; w: number; h: number; label?: string };
  frames?: CursorFrame[];
}
```

이벤트: `REMOTE_STREAM_CONNECTED`, `ACTION_FRAME_EMITTED`, `TARGET_HIGHLIGHT_SET`, `REPLAY_STARTED/STOPPED`

---

## 7. 사용자 프로필 인식

### 7.1 프로필 3계층 분리

| 계층 | 용도 | 예시 |
|------|------|------|
| **User Profile** | 정체/선호/업무 맥락 | 이름, 역할, 선호 UX, 기본 작업공간 |
| **Policy Profile** | 권한/금지/승인 패턴 | 결제 금지, allowlist 도메인, destructive confirm |
| **Ephemeral Task Memory** | 작업용 임시 메모리 | 런 종료 시 폐기 |

### 7.2 "항상 읽는다"의 실행 규칙
- 모든 런 시작 시 `PROFILE_LOADED` 이벤트 발생, Timeline에 노드로 표시
- 모든 Gate 화면 상단: `Acting as: 홍길동님 (Owner)` + `Workspace scope` 표시

### 7.3 안전 규칙
- 프로필은 **권한을 늘리는 방향으로 자동 진화 금지**
- 프로필 학습은 UX 최소화 방향만 허용, 정책 변화는 Policy Update Gate로 분리

### 7.4 프로필-인증 연결
- Subject = `{ user_id, role, device, session_id }`
- 로컬 로그인, 음성 생체(옵션), 원격이면 재인증/권한 축소

---

## 8. 접근성 명세 (WCAG 2.1 AA)

| 항목 | 요구사항 |
|------|---------|
| 키보드 네비게이션 | 모든 Gate 버튼 Tab+Enter, Timeline 방향키, Emergency Stop 전역 단축키, 고대비 포커스 테두리 |
| 스크린 리더 | 모든 아이콘 aria-label, Gate 상태 변경 aria-live, "Step 3, Policy, 완료됨" 형태 |
| 색각 이상 대응 | 아이콘 + 텍스트 + 색상 3중 표시 |
| 고대비 모드 | `prefers-contrast: more` 대응, 명암비 4.5:1 이상, HUD 글로우 비활성화 옵션 |
| 모션 감소 | `prefers-reduced-motion` 필수 대응, 커서 애니메이션 비활성화 옵션 |

---

## 9. 알림 우선순위 시스템

| Level | 예시 | 표시 방식 |
|-------|------|----------|
| **CRITICAL** | Safety Hold, Emergency Stop, 시스템 장애 | 전체 화면 오버레이 + 소리 + 진동 |
| **HIGH** | Gate 승인 대기, 이상 징후 | 우측 패널 상단 + 소리(옵션) |
| **MEDIUM** | 단계 완료, 정책 만료 경고 | 하단 토스트 (3초 자동 닫힘) |
| **LOW** | 통계/인사이트, 제안 정책 | 배지 카운터만 (사용자가 열어야) |

**DND 모드**: CRITICAL만 표시, HIGH 큐잉, 최대 1시간 유지 후 자동 해제

---

## 10. 다국어 지원 (i18n)

- 언어 파일: `/locales/ko.json`(기본), `en.json`, `ja.json`, `zh.json`
- 번역 대상: Gate UI, 알림/경고, Policy 설명문, 에러 메시지, 접근성 라벨
- 번역 제외: 기술 용어(Action Type, Risk Level), 코드/로그/JSON, 파일 경로

---

## 11. 모바일 동반 앱

### 11.1 기능 범위

| 가능 | 불가능 |
|------|--------|
| Gate 승인/거부 | 코드 편집 |
| Timeline 모니터링 (읽기 전용) | 원격 조작 제어 |
| Emergency Stop | 정책 수정 |
| 알림 수신 / 실행 상태 확인 | 새 요청 생성 |
| Trust Mode 변경 | |

### 11.2 모바일 보안
- 자동 권한 축소 (SUGGEST 모드)
- 생체 인증 필수 (지문/Face ID)
- "Approve always" 비활성화 (1회만 허용)
- 원격 세션 TTL: 기본 30분
- 위치 기반 제한 옵션 (집/사무실)

---

## 12. 온보딩 흐름

1. **환영 + 시스템 설명** - JARVIS OS 소개, AI 직접 조작 안내
2. **프로필 생성** - 이름/호칭, 역할 선택, 기본 작업공간 지정
3. **Trust Mode 선택** - 각 모드 예시 설명 (초보자: 제안 모드 / 숙련자: 반자동 권장)
4. **기본 정책 설정** - 금지 영역, workspace scope, allowlist 도메인
5. **데모 시뮬레이션** - 간단한 작업으로 전체 흐름 체험 (실제 변경 없음)
6. **완료** - 설정 요약 + "언제든 변경 가능" 안내

---

## 13. 대시보드 / 분석 뷰

```
┌───────────────────────┬─────────────────────────────────┐
│ 일간 요약              │ 에이전트 상태                    │
│ 총 실행/성공/실패/차단  │ 9개 에이전트 HEALTHY/RUNNING 현황 │
│ Gate 승인/거부 수       │                                 │
│                       │ 보안 이벤트                       │
│ 토큰 사용량            │ HIGH 이벤트, Safety Hold,         │
│ 오늘/이번 주/예산 대비  │ 정책 위반 시도, 최근 보안 스캔     │
│                       │                                 │
│ 위험도 분포            │ 최근 실행 이력                    │
│ LOW/MED/HIGH 바 차트   │ 시간별 작업 목록 + 상태 아이콘     │
└───────────────────────┴─────────────────────────────────┘
```

---

## 14. UX 필수 안전 장치 요약

| 장치 | 설명 |
|------|------|
| "왜 이 액션인가?" 버튼 | 모든 액션에 부착 - 요청/정책/토큰 출처 표시 |
| 범위 슬라이더 | Gate에서 `/project/**` → `/project/src/**` 직관 조절 |
| 미리보기 우선 | 삭제/업로드/다운로드/실행은 목록/미리보기/해시/스캔 먼저 |
| Safety Hold | 예상 외 UI/팝업/리다이렉트 감지 시 즉시 정지 |
| 증거 마스킹 | `redacted: true` 배지, 원본 UI 노출 금지 |
| Emergency Stop | 어디서든 1클릭 |

---

## 15. 안전 기본 규칙 (Safe Defaults)

- `network deny`, `exec deny`, `fs scoped allow`
- 실행은 항상 `ARMED` 상태에서만
- Gate 없는 destructive/network/install/login 금지
- 이상징후 감지 시 무조건 Safety Hold
- 1 device 1 active run
- rollback point 없이 실행 금지
- AUTO는 TTL 필수 + scope 축소 필수
