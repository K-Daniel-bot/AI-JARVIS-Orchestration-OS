// 기본 정책 규칙 — 파일 시스템, 실행, 네트워크 접근 제어 규칙 정의

import type { RequestIntent, CapabilityType, GateType } from "@jarvis/shared";

// 규칙 액션 유형
export type RuleAction = "ALLOW" | "DENY" | "GATE_REQUIRED";

// 단일 정책 규칙 정의
export interface PolicyRule {
  readonly id: string;
  readonly description: string;
  readonly category: "fs" | "exec" | "network" | "auth" | "destructive";
  readonly patterns: readonly string[];
  readonly action: RuleAction;
  readonly riskWeight: number;
  readonly appliesTo: readonly RequestIntent[];
  readonly requiredGate?: GateType;
  readonly requiredCapability?: CapabilityType;
}

// 파일 시스템 쓰기 거부 규칙 — 시스템 핵심 경로 보호
export const FS_WRITE_DENY_RULES: readonly PolicyRule[] = [
  {
    id: "fs.write_deny.windows_system",
    description: "Windows 시스템 디렉토리 쓰기 금지",
    category: "fs",
    patterns: ["/Windows/**", "C:\\Windows\\**"],
    action: "DENY",
    riskWeight: 100,
    appliesTo: ["FILE_OPERATION", "CODE_IMPLEMENTATION", "SYSTEM_CONFIG"],
  },
  {
    id: "fs.write_deny.macos_system",
    description: "macOS 시스템 디렉토리 쓰기 금지",
    category: "fs",
    patterns: ["/System/**", "/usr/**", "/bin/**", "/sbin/**"],
    action: "DENY",
    riskWeight: 100,
    appliesTo: ["FILE_OPERATION", "CODE_IMPLEMENTATION", "SYSTEM_CONFIG"],
  },
  {
    id: "fs.write_deny.registry",
    description: "레지스트리 관련 파일 쓰기 금지",
    category: "fs",
    patterns: ["**/*.reg", "**/regedit*"],
    action: "DENY",
    riskWeight: 90,
    appliesTo: ["FILE_OPERATION", "SYSTEM_CONFIG"],
  },
  {
    id: "fs.write_deny.env_secrets",
    description: "환경 변수 및 비밀 파일 쓰기 게이트 필요",
    category: "fs",
    patterns: ["**/.env", "**/.env.*", "**/credentials*", "**/*.pem", "**/*.key"],
    action: "GATE_REQUIRED",
    riskWeight: 70,
    appliesTo: ["FILE_OPERATION", "CODE_IMPLEMENTATION"],
    requiredGate: "GATE_APPLY_CHANGES",
    requiredCapability: "fs.write",
  },
] as const;

// 실행 거부 규칙 — 위험한 명령어 차단
export const EXEC_DENY_RULES: readonly PolicyRule[] = [
  {
    id: "exec.deny.sudo",
    description: "sudo 명령 실행 금지",
    category: "exec",
    patterns: ["sudo", "sudo *"],
    action: "DENY",
    riskWeight: 95,
    appliesTo: ["PROCESS_MANAGEMENT", "SYSTEM_CONFIG", "APP_LAUNCH"],
  },
  {
    id: "exec.deny.regedit",
    description: "레지스트리 편집기 실행 금지",
    category: "exec",
    patterns: ["regedit", "regedit.exe", "reg *"],
    action: "DENY",
    riskWeight: 95,
    appliesTo: ["APP_LAUNCH", "SYSTEM_CONFIG"],
  },
  {
    id: "exec.deny.format",
    description: "디스크 포맷 명령 금지",
    category: "exec",
    patterns: ["format *", "mkfs *", "diskpart *"],
    action: "DENY",
    riskWeight: 100,
    appliesTo: ["PROCESS_MANAGEMENT", "SYSTEM_CONFIG"],
  },
  {
    id: "exec.deny.rm_rf",
    description: "재귀적 강제 삭제 금지",
    category: "destructive",
    patterns: ["rm -rf /**", "rm -rf /", "del /s /q *"],
    action: "DENY",
    riskWeight: 100,
    appliesTo: ["FILE_OPERATION", "PROCESS_MANAGEMENT"],
  },
  {
    id: "exec.deny.shutdown",
    description: "시스템 종료/재시작 게이트 필요",
    category: "exec",
    patterns: ["shutdown *", "reboot", "halt"],
    action: "GATE_REQUIRED",
    riskWeight: 80,
    appliesTo: ["PROCESS_MANAGEMENT", "SYSTEM_CONFIG"],
    requiredGate: "GATE_DESTRUCTIVE",
    requiredCapability: "exec.run",
  },
] as const;

// 네트워크 접근 규칙
export const NETWORK_RULES: readonly PolicyRule[] = [
  {
    id: "network.gate.download",
    description: "파일 다운로드 시 게이트 필요",
    category: "network",
    patterns: ["*.exe", "*.msi", "*.dmg", "*.pkg", "*.deb", "*.rpm", "*.sh"],
    action: "GATE_REQUIRED",
    riskWeight: 60,
    appliesTo: ["WEB_ACCESS", "NETWORK_REQUEST", "PACKAGE_INSTALL"],
    requiredGate: "GATE_DOWNLOAD",
    requiredCapability: "browser.download",
  },
  {
    id: "network.gate.auth",
    description: "로그인/인증 필요 사이트 접근 시 게이트",
    category: "auth",
    patterns: ["**/login**", "**/signin**", "**/auth**", "**/oauth**"],
    action: "GATE_REQUIRED",
    riskWeight: 65,
    appliesTo: ["WEB_ACCESS"],
    requiredGate: "GATE_WEB_PRECHECK",
    requiredCapability: "browser.navigate",
  },
] as const;

// 모바일 액션 규칙
export const MOBILE_RULES: readonly PolicyRule[] = [
  {
    id: "mobile.gate.sms",
    description: "SMS 전송 시 확인 게이트 필요",
    category: "auth",
    patterns: ["sms:*", "tel:*"],
    action: "GATE_REQUIRED",
    riskWeight: 75,
    appliesTo: ["MOBILE_ACTION"],
    requiredGate: "GATE_SMS_CONFIRM",
    requiredCapability: "mobile.sms.send",
  },
  {
    id: "mobile.gate.call",
    description: "전화 발신 시 확인 게이트 필요",
    category: "auth",
    patterns: ["tel:*"],
    action: "GATE_REQUIRED",
    riskWeight: 70,
    appliesTo: ["MOBILE_ACTION"],
    requiredGate: "GATE_PHONE_CONFIRM",
    requiredCapability: "mobile.call.dial",
  },
] as const;

// 전체 기본 규칙 목록
export const DEFAULT_RULES: readonly PolicyRule[] = [
  ...FS_WRITE_DENY_RULES,
  ...EXEC_DENY_RULES,
  ...NETWORK_RULES,
  ...MOBILE_RULES,
] as const;

// 기본 파일 시스템 제약
export const DEFAULT_FS_CONSTRAINTS = {
  readAllow: ["**/*"] as readonly string[],
  writeAllow: ["./**/*"] as readonly string[],
  writeDeny: [
    "/Windows/**",
    "/System/**",
    "/usr/**",
    "/bin/**",
    "/sbin/**",
    "C:\\Windows\\**",
  ] as readonly string[],
} as const;

// 기본 실행 제약
export const DEFAULT_EXEC_CONSTRAINTS = {
  allow: ["node", "npm", "pnpm", "npx", "git", "tsc", "vitest"] as readonly string[],
  deny: [
    "sudo",
    "regedit",
    "regedit.exe",
    "format",
    "mkfs",
    "diskpart",
    "shutdown",
    "reboot",
    "halt",
    "rm -rf /",
  ] as readonly string[],
} as const;

// 기본 네트워크 제약
export const DEFAULT_NETWORK_CONSTRAINTS = {
  allowDomains: ["*.github.com", "*.npmjs.org", "*.anthropic.com"] as readonly string[],
  denyDomains: [] as readonly string[],
  default: "DENY" as const,
} as const;
