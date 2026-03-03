# JARVIS 프론트엔드 레이아웃 설계

> Excalidraw 다이어그램: https://excalidraw.com/#json=ZLE-DThKIKhcPN2vcqZe6,U-aoxzSfvq4J2nBqcMdoqA

## 📐 3-Panel Layout 구조

```
┌────────────────────────────────────────────────────────────┐
│ MODE: Semi-auto  │  RISK: 42(MED)  │  STEP: Review  [STOP] │
├───────────────┬─────────────────────────┬──────────────────┤
│               │                         │                  │
│   Chat        │   Execution Timeline    │  Safety Panel    │
│   Panel       │   (6 Steps)             │  (4 Tabs)        │
│ (28%)         │   (44%)                 │  (28%)           │
│               │                         │                  │
│  - 대화       │  ✅ SPEC                │ [Approval] Tab   │
│  - 음성       │  ✅ POLICY              │ [Policy] Tab     │
│  - 빠른액션   │  ✅ PLAN                │ [Evidence] Tab   │
│               │  ✅ CODE                │ [Audit] Tab      │
│               │  ⏸️  REVIEW             │                  │
│               │  ⏳ TEST                │ Gate Card        │
│               │                         │ Risk / Buttons   │
├───────────────┴─────────────────────────┴──────────────────┤
│ Evidence Strip: [diff] [hash] [scan] [policy]              │
└────────────────────────────────────────────────────────────┘
```

---

## 1️⃣ 좌측 패널 (Chat Panel — 28%)

### 레이아웃
```
┌─────────────────────────────┐
│ User Profile: 홍길동님 (Dev) │
├─────────────────────────────┤
│ user: "Optimize React..."   │
│ [This may trigger: Semi-auto]│
│                             │
│ JARVIS: "I'll analyze..."   │
│ [Read-only action context]  │
│                             │
│ user: "What's the risk?"    │
│ JARVIS: "MED — 3 reasons"   │
├─────────────────────────────┤
│ 🎤 Voice Input Area         │
│ [Transcript: "opt..."]      │
├─────────────────────────────┤
│ Quick Actions:              │
│ [계획만] [시뮬만] [실행]     │
└─────────────────────────────┘
```

### 특징
- **ChatGPT 스타일** 메시지 버블
- **메시지 배지**: 각 메시지에 "will/won't execute" 표시
- **음성 입력**: 트랜스크립트 수정 가능
- **빠른 액션 버튼**: 모드 선택

---

## 2️⃣ 중앙 패널 (Timeline Panel — 44%)

### 각 Step 상태 표시
```
✅ 1. SPEC
   - Analyzed requirements
   - Status: Complete

✅ 2. POLICY
   - Risk: MED, Approved
   - Risk Score: 42/100

✅ 3. PLAN
   - 12 files, 4 steps
   - 예상 시간: 5분

✅ 4. CODE
   - ChangeSet 생성 완료
   - Lines changed: 142

⏸️  5. REVIEW ← 승인 대기 (클릭 시 우측 Gate 활성화)
   - Waiting for approval
   - Gate: GATE_APPLY_CHANGES

⏳ 6. TEST
   - Running...
   - 진행률: 45%
```

### 각 Step 클릭 시 Drawer (오른쪽에서 슬라이드)
```
┌─────────────────────────┐
│ Details for REVIEW Step │
├─────────────────────────┤
│ Why this step?          │
│ • 코드 품질 검증 필수   │
│ • 보안 규칙 확인        │
│                         │
│ Capabilities used:      │
│ • code.read             │
│ • code.review           │
│ • policy.evaluate       │
│                         │
│ Expected impact:        │
│ • 6 files modified      │
│ • No network access     │
│ • No privilege required │
│                         │
│ Evidence:               │
│ • diff.txt              │
│ • policy-decision.json  │
└─────────────────────────┘
```

---

## 3️⃣ 우측 패널 (Safety Panel — 28%)

### Tab 구조 (4개 탭)

#### **[Approval] 탭 (기본 활성)**
```
┌──────────────────────────────┐
│ [GATE #2] REVIEW CHANGES     │
│ ⏲️  03:45 remaining          │
├──────────────────────────────┤
│ Risk Level: HIGH             │
│ Risk Score: 75/100           │
│ Tags: [HIGH] [REVIEW] [WAIT] │
├──────────────────────────────┤
│ Why needed?                  │
│ • Files: 12 modified         │
│ • Dangerous API detected     │
│ • Scope not narrowed         │
├──────────────────────────────┤
│ Scope Summary:               │
│ • Path: /src/components/**   │
│ • Actions: write, delete     │
│ • Network: No                │
├──────────────────────────────┤
│ [Edit scope] [Reject]        │
│ [Approve once]               │
│ [Approve always (for scope)] │
└──────────────────────────────┘
```

#### **[Policy] 탭**
```
Current Policies:
• No destructive ops on main branch
• Scope: /src only
• Max files: 20

Proposed Policies:
• Enable mobile actions (new)

Policy Diff:
[Show/Hide]
```

#### **[Evidence] 탭**
```
Screenshots: [img1] [img2]
Scan Results:
  • Virus: Negative ✅
  • Reputation: Unknown ⚠️

Hashes:
  • SHA256: abc123...
  • Download count: 1,000+

Rollback Suggestion:
  • Point: Before POLICY step
  • Time: 2 minutes ago
```

#### **[Audit] 탭**
```
Audit Log (Append-only):
[13:45:23] SPEC_ANALYSIS completed
[13:45:45] POLICY_CHECK passed (risk=42)
[13:46:10] PLANNING completed
[13:47:22] CODE_GENERATION completed
[13:48:01] REVIEW_GATE opened (awaiting=true)

Filters: [Time ▼] [Agent ▼] [Action ▼] [Risk ▼]
Export: [JSON] [CSV]
```

---

## 4️⃣ 하단 증거 스트립 (Evidence Strip)

```
┌──────────────────────────────────────────────┐
│ Evidence: [diff.txt] [hash] [scan.json] [log] │
└──────────────────────────────────────────────┘
```

각 칩 클릭 시:
- **diff.txt** → Diff Viewer (Monaco Editor)
- **hash** → SHA256 + copy button
- **scan.json** → JSON Viewer
- **log** → 전체 실행 로그 (검색 가능)

---

## 🎨 색상 토큰

| 상태 | 배경색 | 테두리 | 텍스트 | 의미 |
|------|--------|--------|--------|------|
| ✅ 완료 | `#d3f9d8` | `#22c55e` | 검정 | 성공/안전 |
| ⏸️ 대기 | `#ffd8a8` | `#f59e0b` | 검정 | 승인 필요 |
| ⏳ 진행 | `#fff3bf` | `#fcd34d` | 검정 | 처리 중 |
| ❌ 실패 | `#ffc9c9` | `#ef4444` | 검정 | 에러/위험 |
| 선택 | 흰색 | `#4a9eed` | 검정 | 포커스 |

---

## 🔄 애니메이션 규칙 (Framer Motion)

| 이벤트 | 애니메이션 | 지속시간 |
|--------|-----------|--------|
| Gate 등장 | Slide-up 6px + Fade-in | 260ms |
| Step 완료 | 배경 색상 변화 | 180ms |
| Emergency Stop | 전체 화면 빨강 오버레이 | 150ms |
| Hover on Button | 배경 밝아짐 + 그림자 | 120ms |

---

## 📱 반응형 설계

### 데스크톱 (1200px+)
- 3-panel (28% / 44% / 28%)
- 모든 기능 활성

### 태블릿 (768px ~ 1200px)
- 2-column: Chat + Timeline (우측 패널은 drawer로)
- 증거 스트립 가로 스크롤

### 모바일 (< 768px)
- Companion App (React Native) 권장
- 웹은 Chat + Gate 승인만

---

## ⌨️ 키보드 네비게이션 (WCAG 2.1 AA)

| 단축키 | 동작 |
|--------|------|
| `Tab` | Gate 버튼 간 이동 |
| `Enter` | 승인/거부 |
| `Escape` | Modal 닫기 |
| `Ctrl+/` | Emergency Stop (전역) |
| `↑↓` | Timeline 스크롤 |
| `Ctrl+A` | 모든 Gate "Approve always" |

---

## 🔐 보안 UX 장치

1. **"Why?" 버튼** — 모든 액션 옆에 부착
2. **범위 슬라이더** — 권한 범위 직관적 조절
3. **미리보기 우선** — 파괴적 작업은 diff/해시/스캔 먼저 표시
4. **Safety Hold** — 예상 외 팝업 감지 시 즉시 정지
5. **증거 마스킹** — 민감 데이터는 `[REDACTED]` 표시

---

## 📋 컴포넌트 구현 순서 (추천)

1. **AppShell** — 전체 레이아웃 (3-panel)
2. **TopStatusBar** — Mode, Risk, TTL, Stop 버튼
3. **ChatPanel** — 메시지 버블 + 입력창
4. **TimelinePanel** — Step 목록 + 상태 아이콘
5. **SafetyPanel** — 4개 탭 구조
6. **GateCard** — Gate 승인 카드
7. **EvidenceStrip** — 증거 칩

---

## 📚 참고 자료

- **설계 문서**: `.claude/design/ui-ux.md` (상세 명세)
- **타입 정의**: `packages/web/src/types/` (dashboard.ts, components.ts, api.ts)
- **컬러 팔레트**: `.claude/design/ui-ux.md` § 5 디자인 토큰
