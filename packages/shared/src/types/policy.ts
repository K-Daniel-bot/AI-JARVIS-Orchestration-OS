// 정책 판정 관련 타입 — policy-decision.json 스키마 기반

// 정책 판정 결과 상태
export type PolicyStatus = "ALLOW" | "DENY" | "APPROVAL_REQUIRED" | "CONSTRAINED_ALLOW";

// 위험도 레벨
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";

// 요청 의도 유형
export type RequestIntent =
  | "CODE_IMPLEMENTATION"
  | "FILE_OPERATION"
  | "APP_LAUNCH"
  | "WEB_ACCESS"
  | "SYSTEM_CONFIG"
  | "PACKAGE_INSTALL"
  | "NETWORK_REQUEST"
  | "PROCESS_MANAGEMENT"
  | "MOBILE_ACTION"
  | "COMPOSITE_ACTION";

// 게이트 타입
export type GateType =
  | "GATE_PLAN"
  | "GATE_APPLY_CHANGES"
  | "GATE_DEPLOY"
  | "GATE_WEB_PRECHECK"
  | "GATE_DOWNLOAD"
  | "GATE_DESTRUCTIVE"
  | "GATE_PHONE_CONFIRM"
  | "GATE_SMS_CONFIRM"
  | "GATE_APP_ACCESS"
  | "GATE_MESSENGER_READ";

// 게이트 레벨
export type GateLevel = "L1" | "L2" | "L3";

// 정책 판정 요청 주체
export interface PolicySubject {
  readonly userId: string;
  readonly role: import("./agent.js").UserRole;
  readonly device: string;
  readonly sessionId: string;
}

// 정책 판정 요청
export interface PolicyRequest {
  readonly rawInput: string;
  readonly intent: RequestIntent;
  readonly targets: readonly string[];
  readonly requiresWebAccess: boolean;
  readonly requiresLogin: boolean;
}

// 정책 판정 결과
export interface PolicyOutcome {
  readonly status: PolicyStatus;
  readonly riskScore: number;
  readonly riskLevel: RiskLevel;
  readonly requiresGates: readonly GateType[];
  readonly reasonCodes: readonly string[];
  readonly humanExplanation: string;
}

// 파일 시스템 제약
export interface FsConstraints {
  readonly readAllow: readonly string[];
  readonly writeAllow: readonly string[];
  readonly writeDeny: readonly string[];
}

// 실행 제약
export interface ExecConstraints {
  readonly allow: readonly string[];
  readonly deny: readonly string[];
}

// 네트워크 제약
export interface NetworkConstraints {
  readonly allowDomains: readonly string[];
  readonly denyDomains: readonly string[];
  readonly default: "ALLOW" | "DENY";
}

// 전체 제약 조건
export interface PolicyConstraints {
  readonly fs: FsConstraints;
  readonly exec: ExecConstraints;
  readonly network: NetworkConstraints;
}

// 정책 판정 전체 구조
export interface PolicyDecision {
  readonly decisionId: string;
  readonly timestamp: string;
  readonly subject: PolicySubject;
  readonly request: PolicyRequest;
  readonly outcome: PolicyOutcome;
  readonly constraints: PolicyConstraints;
  readonly requiredCapabilities: readonly CapabilityGrant[];
}

// Capability 토큰 부여 정보
export interface CapabilityGrant {
  readonly cap: CapabilityType;
  readonly scope: string | readonly string[];
  readonly ttlSeconds: number;
  readonly maxUses: number;
}

// Capability 유형
export type CapabilityType =
  | "fs.read"
  | "fs.write"
  | "exec.run"
  | "app.launch"
  | "network.access"
  | "clipboard.read"
  | "clipboard.write"
  | "browser.navigate"
  | "browser.download"
  | "process.kill"
  | "mobile.contact.read"
  | "mobile.call.dial"
  | "mobile.sms.send"
  | "mobile.sms.read"
  | "mobile.messenger.send"
  | "mobile.messenger.read"
  | "mobile.app.control"
  | "mobile.notification.read";

// Capability 토큰 상태
export type CapabilityTokenStatus = "ACTIVE" | "CONSUMED" | "EXPIRED" | "REVOKED";

// Capability 토큰 전체 구조
export interface CapabilityToken {
  readonly tokenId: string;
  readonly issuedAt: string;
  readonly issuedBy: string;
  readonly approvedBy: string;
  readonly grant: CapabilityGrant;
  readonly context: {
    readonly sessionId: string;
    readonly runId: string;
    readonly policyDecisionId: string;
    readonly trustMode: import("./agent.js").TrustMode;
  };
  readonly status: CapabilityTokenStatus;
  readonly consumedAt: string | null;
  readonly consumedByAction: string | null;
  readonly revokedReason: string | null;
}
