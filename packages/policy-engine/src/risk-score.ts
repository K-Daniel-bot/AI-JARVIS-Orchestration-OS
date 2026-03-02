// 위험도 점수 계산 모듈 — 5차원 가중 평균으로 0~100 Risk Score 산출

import type { PolicyRequest, RiskLevel } from '@jarvis/shared';

// ─────────────────────────────────────────
// 위험도 차원 및 상수 정의
// ─────────────────────────────────────────

/** 위험도 5차원 정의 — 각 차원은 0~100 점수 */
export interface RiskDimensions {
  /** 시스템 파일/레지스트리 등 OS 핵심 영역 영향도 (가중치: 3) */
  readonly systemImpact: number;
  /** 민감 데이터(자격증명, 비밀키) 접근 여부 (가중치: 3) */
  readonly dataSensitivity: number;
  /** 금융/결제/은행 연관 작업 여부 (가중치: 5) */
  readonly financial: number;
  /** 관리자/루트 권한 필요 여부 (가중치: 4) */
  readonly adminPrivilege: number;
  /** 외부 네트워크 접근 여부 (가중치: 2) */
  readonly externalNetwork: number;
}

/** 차원별 가중치 상수 — 총합 17 */
const RISK_WEIGHTS: Readonly<Record<keyof RiskDimensions, number>> = {
  systemImpact: 3,
  dataSensitivity: 3,
  financial: 5,
  adminPrivilege: 4,
  externalNetwork: 2,
} as const;

/** 가중치 총합 (3 + 3 + 5 + 4 + 2 = 17) */
const TOTAL_WEIGHT = 17;

// ─────────────────────────────────────────
// 위험 패턴 정의
// ─────────────────────────────────────────

/** 금융/결제 관련 키워드 패턴 */
const FINANCIAL_PATTERNS: readonly RegExp[] = [
  /billing/i,
  /payment/i,
  /\bbank\b/i,
  /stock/i,
  /invest/i,
  /wallet/i,
  /credit/i,
  /debit/i,
  /finance/i,
  /trading/i,
] as const;

/** 시스템 파일 경로 패턴 */
const SYSTEM_PATH_PATTERNS: readonly RegExp[] = [
  /^\/Windows\//i,
  /^\/System\//i,
  /AppData[/\\]/i,
  /^C:[/\\]Windows[/\\]/i,
  /^C:[/\\]System[/\\]/i,
  /\/etc\/passwd/i,
  /\/etc\/shadow/i,
  /\/proc\//i,
  /\/sys\//i,
] as const;

/** 관리자 권한 관련 키워드 패턴 */
const ADMIN_PATTERNS: readonly RegExp[] = [
  /\bsudo\b/i,
  /\bregedit\b/i,
  /powershell_admin/i,
  /runas\s+\/user:administrator/i,
  /net\s+user/i,
  /chmod\s+[0-7]*7/,
  /chown\s+root/i,
] as const;

/** 외부 네트워크 관련 패턴 */
const EXTERNAL_NETWORK_PATTERNS: readonly RegExp[] = [
  /https?:\/\//i,
  /\bdownload\b/i,
  /\bupload\b/i,
  /\bwebhook\b/i,
  /\bcurl\b/i,
  /\bwget\b/i,
] as const;

/** 민감 데이터 관련 패턴 */
const SENSITIVE_DATA_PATTERNS: readonly RegExp[] = [
  /\.env(?:\.|$)/i,
  /credentials/i,
  /secrets/i,
  /\bpassword\b/i,
  /\bpasswd\b/i,
  /private[-_]?key/i,
  /api[-_]?key/i,
  /access[-_]?token/i,
  /auth[-_]?token/i,
  /\.pem$/i,
  /\.key$/i,
  /\.pfx$/i,
  /\.p12$/i,
] as const;

// ─────────────────────────────────────────
// 내부 유틸리티 함수
// ─────────────────────────────────────────

/** 문자열이 패턴 배열 중 하나라도 일치하는지 확인한다 */
function matchesAny(value: string, patterns: readonly RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(value));
}

/** 문자열 배열 중 하나라도 패턴 배열 중 하나와 일치하는지 확인한다 */
function anyMatchesAny(
  values: readonly string[],
  patterns: readonly RegExp[],
): boolean {
  return values.some((value) => matchesAny(value, patterns));
}

/** 숫자를 0~100 범위로 클램핑한다 */
function clamp(value: number): number {
  return Math.max(0, Math.min(100, value));
}

// ─────────────────────────────────────────
// 공개 함수
// ─────────────────────────────────────────

/**
 * 5차원 위험도 점수를 가중 평균으로 합산하여 최종 Risk Score를 계산한다.
 * 수식: Σ(차원점수 × 가중치) / 총가중치 — 결과 범위 0~100
 */
export function calculateRiskScore(dimensions: RiskDimensions): number {
  const weightedSum =
    dimensions.systemImpact * RISK_WEIGHTS.systemImpact +
    dimensions.dataSensitivity * RISK_WEIGHTS.dataSensitivity +
    dimensions.financial * RISK_WEIGHTS.financial +
    dimensions.adminPrivilege * RISK_WEIGHTS.adminPrivilege +
    dimensions.externalNetwork * RISK_WEIGHTS.externalNetwork;

  return clamp(Math.round(weightedSum / TOTAL_WEIGHT));
}

/**
 * Risk Score(0~100)를 위험 수준으로 분류한다.
 *  0~25:   LOW      — 자동 실행 가능
 *  26~50:  MEDIUM   — 제약 허용, Gate L1 필요
 *  51~75:  HIGH     — 사용자 승인 필수, Gate L2
 *  76~100: CRITICAL — 자동 거부
 */
export function classifyRiskLevel(score: number): RiskLevel {
  if (score <= 25) return 'LOW';
  if (score <= 50) return 'MEDIUM';
  if (score <= 75) return 'HIGH';
  return 'CRITICAL';
}

/**
 * PolicyRequest와 대상 경로 목록을 분석하여 5차원 위험도를 산출한다.
 * 각 차원은 독립적으로 패턴 매칭 결과를 기반으로 점수가 결정된다.
 */
export function assessDimensions(
  request: PolicyRequest,
  targets: readonly string[],
): RiskDimensions {
  // 분석 대상 텍스트 통합 (요청 원문 + intent + 대상 경로 전체)
  const allTexts: readonly string[] = [
    request.raw_input,
    request.intent,
    ...targets,
  ];

  // ─── 금융 차원 평가 ───
  // 금융 패턴 감지 시 즉시 최고점 부여
  const financial = anyMatchesAny(allTexts, FINANCIAL_PATTERNS) ? 100 : 0;

  // ─── 시스템 파일 차원 평가 ───
  // 시스템 경로 패턴 감지 시 즉시 최고점 부여
  const systemImpact = anyMatchesAny(allTexts, SYSTEM_PATH_PATTERNS) ? 100 : 0;

  // ─── 관리자 권한 차원 평가 ───
  // 관리자 명령 패턴 감지 시 즉시 최고점 부여
  const adminPrivilege = anyMatchesAny(allTexts, ADMIN_PATTERNS) ? 100 : 0;

  // ─── 외부 네트워크 차원 평가 ───
  // requires_web_access 플래그와 패턴 매칭 결과를 누적
  let externalNetwork = 0;
  if (request.requires_web_access) {
    externalNetwork += 50;
  }
  if (anyMatchesAny(allTexts, EXTERNAL_NETWORK_PATTERNS)) {
    externalNetwork += 40;
  }
  externalNetwork = clamp(externalNetwork);

  // ─── 민감 데이터 차원 평가 ───
  // 민감 파일/키워드 감지 및 로그인 요구 여부에 따라 누적
  let dataSensitivity = 0;
  if (anyMatchesAny(allTexts, SENSITIVE_DATA_PATTERNS)) {
    dataSensitivity += 80;
  }
  if (request.requires_login) {
    dataSensitivity += 30;
  }
  dataSensitivity = clamp(dataSensitivity);

  return {
    systemImpact,
    dataSensitivity,
    financial,
    adminPrivilege,
    externalNetwork,
  };
}
