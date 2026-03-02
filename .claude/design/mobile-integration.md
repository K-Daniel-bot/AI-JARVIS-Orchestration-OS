# 모바일 디바이스 통합 설계

> version: 1.0.0
> last_updated: 2026-03-02

---

## 1. 개요

JARVIS OS는 데스크톱(Windows/macOS)에서 사용자의 스마트폰(iOS/Android)을 원격 제어한다.
Companion App(React Native)을 통해 연락처, 전화, 문자, 카카오톡 등 모든 앱에 접근 가능하다.

**핵심 원칙:**
- ASK 모드 (제안 모드) 기본 — 모든 모바일 작업은 반드시 사용자 확인 후 실행
- E2E 암호화 — 데스크톱 ↔ 스마트폰 간 모든 통신 암호화
- 1회성 Capability Token — 모바일 액션마다 개별 토큰 발급/소비
- 금융앱 접근 차단 — 뱅킹/증권/간편결제 앱은 자동화 대상에서 영구 제외

---

## 2. 아키텍처

```
┌─────────────────────────────────┐     WebSocket      ┌──────────────────────────┐
│  JARVIS OS (데스크톱)            │ ◄════════════════► │  JARVIS Companion        │
│                                 │   (TLS 1.3 +       │  (React Native)          │
│  Orchestrator → Executor        │    AES-256-GCM)     │                          │
│       ↓                         │                     │  ContactsBridge          │
│  MobileActionBridge             │                     │  TelephonyBridge         │
│  (packages/executor/src/        │                     │  SmsBridge               │
│   mobile-bridge.ts)             │                     │  AccessibilityBridge     │
│                                 │                     │  KakaoTalkBridge         │
└─────────────────────────────────┘                     │  NotificationBridge      │
                                                        │  AppControlBridge        │
                                                        └──────────────────────────┘
```

### 2.1 연결 우선순위

1. **로컬 WiFi** (동일 네트워크) — 최저 지연, mDNS/Bonjour 자동 탐색
2. **릴레이 서버** (외부 네트워크) — TURN 서버 경유, E2E 암호화 유지

### 2.2 통신 프로토콜

```typescript
// WebSocket 메시지 포맷
interface MobileMessage {
  msg_id: string;          // uuid v4
  type: 'command' | 'response' | 'event' | 'ack';
  action: string;          // MOBILE_CALL_DIAL 등
  params: Record<string, unknown>;
  capability_token: string; // cap_yyyymmdd_seq
  timestamp: string;       // ISO 8601
  encrypted: true;         // 항상 true
}

// ACK 응답
interface MobileAck {
  msg_id: string;
  ref_msg_id: string;      // 원본 메시지 참조
  type: 'ack';
  status: 'received' | 'executing' | 'completed' | 'failed';
  result?: unknown;
  error?: { code: string; message: string };
}
```

### 2.3 재연결 전략

| 시도 | 대기 시간 | 방식 |
|------|-----------|------|
| 1회 | 즉시 | 동일 연결 |
| 2회 | 1초 | 동일 연결 |
| 3회 | 3초 | WiFi → 릴레이 전환 |
| 4회 | 10초 | 릴레이 재연결 |
| 5회+ | 30초 | 사용자에게 연결 안내 UI |

---

## 3. 페어링 흐름

```
[1] 데스크톱: QR 코드 생성 (세션 ID + ECDH 공개키 + 타임스탬프)
    │
    ▼
[2] 스마트폰: QR 스캔 → ECDH 키 교환 → 공유 비밀 생성
    │
    ▼
[3] 스마트폰: 생체인증 요구 (Face ID / 지문)
    │
    ├── 성공 → [4]
    └── 실패 → 페어링 중단
    │
    ▼
[4] 양방향 핸드셰이크 완료
    - 세션 토큰 발급 (12시간 TTL)
    - AES-256-GCM 대칭키 설정
    - WebSocket 연결 확립
    │
    ▼
[5] 상태: MOBILE_DEVICE_CONNECTED
```

### 페어링 보안 요구사항

- QR 코드는 **60초 TTL** (만료 후 재생성 필요)
- ECDH curve: **P-256**
- 세션 토큰은 디바이스 고유 ID에 바인딩
- 동시 페어링 디바이스: **최대 1대** (추가 페어링 시 기존 세션 해제)
- 페어링 이력은 감사 로그에 기록

---

## 4. Native Bridge 인터페이스

### 4.1 ContactsBridge — 연락처

```typescript
interface ContactsBridge {
  search(query: string): Promise<Contact[]>;
  getById(contactId: string): Promise<Contact>;
  getGroups(): Promise<ContactGroup[]>;
}

interface Contact {
  id: string;
  name: string;
  phoneNumbers: { label: string; number: string }[];
  email?: string;
  organization?: string;
  group?: string;
  thumbnail?: string; // base64 (저해상도)
}
```

- iOS: CNContactStore API
- Android: ContactsContract ContentProvider

### 4.2 TelephonyBridge — 전화

```typescript
interface TelephonyBridge {
  dial(phoneNumber: string): Promise<CallSession>;
  endCall(sessionId: string): Promise<void>;
  getCallStatus(sessionId: string): Promise<CallStatus>;
  onCallStateChange(callback: (state: CallState) => void): void;
}

type CallState = 'DIALING' | 'RINGING' | 'CONNECTED' | 'ENDED' | 'FAILED';

interface CallSession {
  sessionId: string;
  phoneNumber: string; // 마스킹된 번호
  state: CallState;
  startedAt: string;
}
```

- iOS: CallKit (CXCallController)
- Android: TelecomManager (CALL_PHONE 권한)

### 4.3 SmsBridge — 문자

```typescript
interface SmsBridge {
  send(to: string, body: string): Promise<SmsResult>;
  readRecent(count: number): Promise<SmsMessage[]>;
  readConversation(contactId: string, count: number): Promise<SmsMessage[]>;
}

interface SmsMessage {
  id: string;
  from: string; // 마스킹
  to: string;   // 마스킹
  body: string;
  timestamp: string;
  isRead: boolean;
}
```

- iOS: MFMessageComposeViewController (사용자 확인 필수)
- Android: SmsManager (SEND_SMS 권한)

### 4.4 KakaoTalkBridge — 카카오톡 (Accessibility API)

```typescript
interface KakaoTalkBridge {
  getChatRooms(): Promise<ChatRoom[]>;
  readMessages(roomId: string, count: number): Promise<ChatMessage[]>;
  sendMessage(roomId: string, text: string): Promise<void>;
  searchChat(query: string): Promise<ChatRoom[]>;
}

interface ChatRoom {
  id: string;
  name: string;
  lastMessage: string; // 마스킹
  lastMessageAt: string;
  unreadCount: number;
  participants: string[];
}
```

**Accessibility API 접근 경로:**
- Android: AccessibilityService → 카카오톡 UI 요소 탐색/조작
- iOS: 미지원 (iOS는 Accessibility API로 타 앱 제어 불가)
  - iOS 대안: 카카오톡 공유 API + URL Scheme (`kakaotalk://`)
  - 읽기 기능은 iOS에서 제한적

### 4.5 NotificationBridge — 알림

```typescript
interface NotificationBridge {
  getRecent(count: number): Promise<AppNotification[]>;
  getByApp(packageName: string, count: number): Promise<AppNotification[]>;
  dismiss(notificationId: string): Promise<void>;
  onNewNotification(callback: (n: AppNotification) => void): void;
}
```

- Android: NotificationListenerService
- iOS: UNUserNotificationCenter (자체 앱 알림만, 타 앱 알림 접근 제한)

### 4.6 AppControlBridge — 앱 제어

```typescript
interface AppControlBridge {
  launch(packageName: string): Promise<void>;
  getCurrentApp(): Promise<AppInfo>;
  listInstalled(): Promise<AppInfo[]>;
  performAction(action: AccessibilityAction): Promise<void>;
}

interface AccessibilityAction {
  targetApp: string;
  actionType: 'tap' | 'scroll' | 'type' | 'back' | 'home';
  selector?: { id?: string; text?: string; className?: string };
  value?: string; // type 액션 시 입력값
}
```

- Android: AccessibilityService (전체 앱 제어 가능)
- iOS: 제한적 (URL Scheme 기반 앱 실행만 가능)

---

## 5. 보안 모델

### 5.1 암호화

| 구간 | 방식 |
|------|------|
| 전송 계층 | TLS 1.3 (WebSocket Secure) |
| 메시지 계층 | AES-256-GCM (ECDH 파생 키) |
| 저장 데이터 | 디바이스 Keychain/Keystore |

### 5.2 차단 앱 목록 (수정 불가)

```
뱅킹: 국민은행, 신한은행, 하나은행, 우리은행, 농협, 카카오뱅크, 토스뱅크, ...
증권: 키움증권, 미래에셋, 삼성증권, NH투자, 한국투자, ...
결제: 카카오페이, 네이버페이, 삼성페이, 토스, 페이코, ...
기타: 공인인증, OTP 앱, 보안카드 앱
```

이 목록의 앱에 대해서는:
- MOBILE_APP_LAUNCH 거부
- MOBILE_APP_ACTION 거부
- Accessibility 접근 차단
- 사용자가 해제 요청해도 거부 (contract.md §1 위반)

### 5.3 데이터 마스킹 규칙

| 데이터 | 마스킹 규칙 | 예시 |
|--------|------------|------|
| 전화번호 | 중간 4자리 | 010-****-5678 |
| 메시지 내용 | 감사 로그에서 전체 마스킹 | [REDACTED_SMS_BODY] |
| 연락처 이름 | 로그에서 성만 표시 | 홍** |
| 카카오톡 내용 | 감사 로그에서 전체 마스킹 | [REDACTED_CHAT] |

### 5.4 세션 관리

- 세션 TTL: 12시간 (재페어링 없이 연장 가능)
- 비활성 타임아웃: 30분 (WebSocket 자동 해제)
- 디바이스 분실 대응: 데스크톱에서 원격 세션 무효화
- 동시 세션: 1디바이스만 허용

---

## 6. "홍길동 전화 걸어줘" ASK 모드 워크플로우

### 6.1 전체 흐름 (9단계)

```
사용자: "홍길동 전화 걸어줘"
     │
     ▼
[1] Orchestrator: USER_REQUEST 수신 → SPEC_ANALYSIS 전이
     │
     ▼
[2] Spec Agent: 의도 분석
     - intent: PHONE_CALL
     - target: "홍길동" (사람 이름)
     - action: MOBILE_CALL_DIAL
     - precondition: MOBILE_DEVICE_CONNECTED
     → SPEC_COMPLETE → POLICY_CHECK 전이
     │
     ▼
[3] Policy/Risk Agent: 5차원 위험도 평가
     ┌──────────────────────────────┐
     │ 가역성:    5/20 (끊기 가능)   │
     │ 범위:      5/20 (단일 연락처)  │
     │ 민감도:   15/20 (전화번호)     │
     │ 외부성:   15/20 (외부 통신)    │
     │ 권한:      5/20 (일반 전화)    │
     │ ─────────────────────────── │
     │ 총점:     45/100              │
     │ 판정:     CONSTRAINED_ALLOW   │
     │ 필수 Gate: GATE_PHONE_CONFIRM │
     └──────────────────────────────┘
     → PLANNING 전이
     │
     ▼
[4] Planner Agent: 실행 계획 수립
     Step A: MOBILE_CONTACT_SEARCH("홍길동")
     Step B: GATE_PHONE_CONFIRM (사용자 확인)
     Step C: MOBILE_CALL_DIAL(선택된 연락처)
     → NO_CODE_NEEDED → MOBILE_ACTION_EXECUTION 전이
     │
     ▼
[5] Executor: 연락처 검색 실행
     - MobileActionBridge → Companion App
     - ContactsBridge.search("홍길동")
     │
     ├─ 시나리오 A: 결과 1개
     │  "홍길동 (010-1234-5678)"
     │  → [6]으로 진행
     │
     ├─ 시나리오 B: 결과 여러 개
     │  "홍길동 (직장) 010-1234-5678"
     │  "홍길동 (학교) 010-9876-5432"
     │  → UI 선택 다이얼로그 표시 → 사용자 선택 → [6]
     │
     └─ 시나리오 C: 결과 0개
        "홍길동을 찾을 수 없습니다"
        → COMPLETED (안내 메시지)
     │
     ▼
[6] GATE_PHONE_CONFIRM (UI 레이어)
     ┌──────────────────────────────────┐
     │  전화 확인                        │
     │                                  │
     │  이 사용자가 맞나요?               │
     │  이름: 홍길동                      │
     │  번호: 010-1234-5678              │
     │  소속: 직장                        │
     │                                  │
     │  [전화 걸기]    [취소]             │
     └──────────────────────────────────┘
     │
     ├── 승인 → [7]
     └── 거부 → DENIED (사유: "사용자 취소")
     │
     ▼
[7] Capability Token 발급
     {
       cap: "mobile.call.dial",
       scope: "+82-10-1234-5678",
       ttl_seconds: 120,
       max_uses: 1
     }
     │
     ▼
[8] Executor: 전화 걸기 실행
     - MobileActionBridge → Companion App → TelephonyBridge
     - TelephonyBridge.dial("+82-10-1234-5678")
     - 상태 모니터링: DIALING → RINGING → CONNECTED
     - Token 즉시 소비 → status: CONSUMED
     │
     ▼
[9] 감사 로그 기록 + COMPLETED
     {
       who: "user_001",
       what: "홍길동(010-****-5678)에게 전화 걸기",
       policy_ref: "pd_20260302_001",
       capability_ref: "cap_20260302_001",
       action: "MOBILE_CALL_DIAL",
       result: "SUCCESS",
       timestamp: "2026-03-02T14:30:00Z"
     }
```

### 6.2 에러 시나리오

| 상황 | 처리 |
|------|------|
| 디바이스 미연결 | "스마트폰이 연결되어 있지 않습니다. 페어링을 확인해주세요." |
| 연락처 없음 | "홍길동을 연락처에서 찾을 수 없습니다." |
| 전화 걸기 실패 | "전화 연결에 실패했습니다. (사유: 네트워크 오류)" → ERROR_RECOVERY |
| 통화 중 연결 끊김 | WebSocket 재연결 시도 → 실패 시 사용자 안내 |
| Token 만료 | "승인 시간이 초과되었습니다. 다시 요청해주세요." |

### 6.3 추가 워크플로우 예시

**"김철수에게 문자 보내줘: 회의 10분 늦을게요"**
→ Spec: SMS_SEND + target:"김철수" + body:"회의 10분 늦을게요"
→ Policy: risk 50 (메시지 내용 전송) → GATE_SMS_CONFIRM
→ UI: "김철수(010-xxxx-xxxx)에게 '회의 10분 늦을게요' 전송할까요?"

**"카카오톡 프로젝트 그룹방 열어줘"**
→ Spec: MESSENGER_READ + target:"프로젝트 그룹방"
→ Policy: risk 55 (메신저 대화 접근) → GATE_MESSENGER_READ
→ UI: "카카오톡 '프로젝트 그룹방' 대화를 열까요? (개인정보 포함 가능)"

---

## 7. iOS vs Android 기능 차이

| 기능 | Android | iOS |
|------|---------|-----|
| 연락처 읽기 | ContactsContract (전체) | CNContactStore (전체) |
| 전화 걸기 | TelecomManager (자동) | CallKit (자동) |
| 문자 전송 | SmsManager (자동) | MFMessageComposeViewController (UI 확인 필수) |
| 카카오톡 접근 | AccessibilityService (전체) | URL Scheme (제한적, 읽기 불가) |
| 알림 읽기 | NotificationListenerService (전체) | 자체 앱 알림만 |
| 앱 제어 | AccessibilityService (전체) | URL Scheme (실행만) |

**iOS 제약 대응:**
- 카카오톡 메시지 읽기: iOS에서는 불가 → 사용자에게 "iOS에서는 카카오톡 메시지 읽기가 지원되지 않습니다" 안내
- 문자 전송: iOS에서는 MessageUI 프레임워크 사용 → 사용자가 최종 전송 버튼을 탭해야 함
- 앱 제어: iOS에서는 URL Scheme 기반 앱 실행만 가능 → "이 기능은 Android에서만 완전 지원됩니다" 안내

---

## 8. 오프라인/연결 끊김 처리

### 8.1 연결 상태 머신

```
DISCONNECTED → PAIRING → CONNECTING → CONNECTED → ACTIVE
                                          ↓
                                    RECONNECTING → CONNECTED (성공)
                                          ↓
                                    DISCONNECTED (5회 실패)
```

### 8.2 큐잉 전략

연결 끊김 시 모바일 액션은 큐에 저장하지 않음 (보안 원칙):
- 전화/문자/메신저 명령은 실시간 사용자 확인 필수
- 연결 복구 후 자동 재실행 금지
- 사용자에게 재요청 안내

### 8.3 배터리/네트워크 최적화

- Companion App: 포그라운드 서비스 (Android) / 백그라운드 모드 (iOS)
- 하트비트 간격: 30초 (활성) / 5분 (유휴)
- 저전력 모드 감지 시: 하트비트 10분으로 변경 + 사용자 안내
