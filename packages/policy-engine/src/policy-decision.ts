// 정책 판정 엔진 — PolicyDecision 생성 및 절대 금지 패턴 검사

import { minimatch } from 'minimatch';
import type {
  PolicyDecision,
  PolicyRequest,
  PolicySubject,
  PolicyOutcome,
  PolicyConstraints,
  CapabilityGrant,
  RiskLevel,
  PolicyStatus,
  Result,
  JarvisError,
} from '@jarvis/shared';
import { ok, generatePolicyDecisionId } from '@jarvis/shared';
import {
  assessDimensions,
  calculateRiskScore,
  classifyRiskLevel,
} from './risk-score.js';

// ─────────────────────────────────────────
// 절대 금지 패턴 (contract.md §1 기반)
// ─────────────────────────────────────────

/** 절대 거부 패턴 — 어떤 조건에서도 허용되지 않는 접근 패턴 */
export interface DenyPattern {
  /** minimatch 글로브 패턴 */
  readonly pattern: string;
  /** 거부 사유 코드 */
  readonly code: string;
  /** 사용자에게 표시할 거부 메시지 */
  readonly message?: string;
}

/**
 * 절대 금지 패턴 목록 — contract.md §1 기반
 * 이 패턴에 해당하는 요청은 위험도 계산 없이 즉시 DENY된다.
 */
const ABSOLUTE_DENY_PATTERNS: readonly DenyPattern[] = [
  // ─── 시스템 파일 접근 금지 ───
  {
    pattern: '/Windows/**',
    code: 'SYSTEM_FILE_ACCESS',
    message: 'OS 시스템 파일 접근은 허용되지 않습니다',
  },
  {
    pattern: '/System/**',
    code: 'SYSTEM_FILE_ACCESS',
    message: 'OS 시스템 파일 접근은 허용되지 않습니다',
  },
  {
    pattern: 'AppData/**',
    code: 'SYSTEM_FILE_ACCESS',
    message: 'AppData 접근은 허용되지 않습니다',
  },
  {
    pattern: 'C:/Windows/**',
    code: 'SYSTEM_FILE_ACCESS',
    message: 'OS 시스템 파일 접근은 허용되지 않습니다',
  },
  {
    pattern: 'C:/System/**',
    code: 'SYSTEM_FILE_ACCESS',
    message: 'OS 시스템 파일 접근은 허용되지 않습니다',
  },
  // ─── 금융/결제 접근 금지 ───
  {
    pattern: '*billing*',
    code: 'FINANCIAL_ACCESS',
    message: '금융/결제 영역 자동화는 허용되지 않습니다',
  },
  {
    pattern: '*payment*',
    code: 'FINANCIAL_ACCESS',
    message: '금융/결제 영역 자동화는 허용되지 않습니다',
  },
  {
    pattern: '*bank*',
    code: 'FINANCIAL_ACCESS',
    message: '금융/결제 영역 자동화는 허용되지 않습니다',
  },
  {
    pattern: '*banking*',
    code: 'FINANCIAL_ACCESS',
    message: '금융/결제 영역 자동화는 허용되지 않습니다',
  },
  {
    pattern: '*finance*',
    code: 'FINANCIAL_ACCESS',
    message: '금융/결제 영역 자동화는 허용되지 않습니다',
  },
  // ─── 관리자 권한 실행 금지 ───
  {
    pattern: 'sudo',
    code: 'ADMIN_PRIVILEGE',
    message: '관리자 권한 자동 실행은 허용되지 않습니다',
  },
  {
    pattern: 'regedit',
    code: 'ADMIN_PRIVILEGE',
    message: '레지스트리 편집은 허용되지 않습니다',
  },
  {
    pattern: 'powershell_admin',
    code: 'ADMIN_PRIVILEGE',
    message: '관리자 권한 PowerShell 실행은 허용되지 않습니다',
  },
] as const;

// ─────────────────────────────────────────
// 기본 제약 조건 설정 (secure-by-default)
// ─────────────────────────────────────────

/**
 * 기본 정책 제약 조건 — 안전 기본값(secure-by-default) 적용
 * 명시적으로 허용된 것만 허용하고 나머지는 거부한다.
 */
const DEFAULT_CONSTRAINTS: PolicyConstraints = {
  fs: {
    read_allow: [],
    write_allow: [],
    write_deny: ['/Windows/**', '/System/**', '/Users/**/AppData/**'],
  },
  exec: {
    allow: ['node', 'python', 'git', 'npm', 'pnpm', 'tsc', 'vitest'],
    deny: ['sudo', 'powershell_admin', 'regedit', 'net user', 'chmod 777'],
  },
  network: {
    allow_domains: [],
    deny_domains: ['banking.*', 'payment.*', '*.bank.*'],
    default_policy: 'DENY',
  },
} as const;

// ─────────────────────────────────────────
// 절대 거부 패턴 매칭
// ─────────────────────────────────────────

/**
 * 대상 문자열이 절대 거부 패턴에 해당하는지 확인한다.
 * minimatch 글로브 매칭을 사용하며 대소문자를 구분하지 않는다.
 */
function checkDenyPatterns(
  targets: readonly string[],
  rawInput: string,
  patterns: readonly DenyPattern[],
): DenyPattern | undefined {
  // 분석 대상: 경로 목록 + 요청 원문 단어 토큰
  const checkTargets = [
    ...targets,
    ...rawInput.toLowerCase().split(/\s+/),
  ];

  for (const target of checkTargets) {
    for (const denyPattern of patterns) {
      // minimatch는 기본 대소문자 구분 — 소문자로 통일하여 비교
      if (
        minimatch(target.toLowerCase(), denyPattern.pattern.toLowerCase(), {
          dot: true,
        })
      ) {
        return denyPattern;
      }
    }
  }

  return undefined;
}

// ─────────────────────────────────────────
// 게이트 및 Capability 결정 로직
// ─────────────────────────────────────────

/**
 * Risk Level에 따라 필요한 승인 게이트 목록을 결정한다.
 *  LOW:      게이트 없음 (자동 실행 허용)
 *  MEDIUM:   GATE_PLAN (계획 검토)
 *  HIGH:     GATE_PLAN + GATE_APPLY_CHANGES (변경 승인 필수)
 *  CRITICAL: 거부 (게이트 없음)
 */
function determineRequiredGates(riskLevel: RiskLevel): readonly string[] {
  switch (riskLevel) {
    case 'LOW':
      return [];
    case 'MEDIUM':
      return ['GATE_PLAN'];
    case 'HIGH':
      return ['GATE_PLAN', 'GATE_APPLY_CHANGES'];
    case 'CRITICAL':
      return [];
  }
}

/**
 * Risk Level에 따라 정책 상태를 결정한다.
 *  LOW:      ALLOW (자동 실행 가능)
 *  MEDIUM:   CONSTRAINED_ALLOW + Gate L1
 *  HIGH:     APPROVAL_REQUIRED + Gate L2
 *  CRITICAL: DENY
 */
function determinePolicyStatus(riskLevel: RiskLevel): PolicyStatus {
  switch (riskLevel) {
    case 'LOW':
      return 'ALLOW';
    case 'MEDIUM':
      return 'CONSTRAINED_ALLOW';
    case 'HIGH':
      return 'APPROVAL_REQUIRED';
    case 'CRITICAL':
      return 'DENY';
  }
}

/**
 * Risk Level과 요청 내용을 기반으로 필요한 Capability 목록을 생성한다.
 * DENY 상태에서는 빈 배열을 반환한다.
 */
function buildRequiredCapabilities(
  request: PolicyRequest,
  riskLevel: RiskLevel,
): readonly CapabilityGrant[] {
  if (riskLevel === 'CRITICAL') return [];

  // TTL은 위험도에 따라 단계적으로 축소
  const ttlByLevel: Record<RiskLevel, number> = {
    LOW: 900,    // 15분
    MEDIUM: 600, // 10분
    HIGH: 300,   // 5분
    CRITICAL: 0, // 거부이므로 무의미
  };
  const ttl = ttlByLevel[riskLevel];

  const capabilities: CapabilityGrant[] = [];

  // 파일시스템 접근이 필요한 경우 (경로 대상이 포함된 요청)
  if (request.targets.some((t) => t.includes('/') || t.includes('\\'))) {
    const primaryTarget = request.targets[0] ?? '**';
    capabilities.push({
      cap: 'fs.read',
      scope: primaryTarget,
      ttl_seconds: ttl,
      max_uses: 1,
    });
  }

  // 외부 네트워크 접근이 필요한 경우
  if (request.requires_web_access) {
    capabilities.push({
      cap: 'network.access',
      scope: '*',
      ttl_seconds: ttl,
      max_uses: 3,
    });
  }

  // 코드 실행/빌드 의도가 포함된 경우
  if (
    request.intent.includes('CODE') ||
    request.intent.includes('EXEC') ||
    request.intent.includes('BUILD')
  ) {
    capabilities.push({
      cap: 'exec.run',
      scope: 'safe-commands',
      ttl_seconds: ttl,
      max_uses: 1,
    });
  }

  return capabilities;
}

/**
 * 판정 이유를 사람이 읽을 수 있는 문장으로 생성한다.
 */
function buildHumanExplanation(
  status: PolicyStatus,
  riskLevel: RiskLevel,
  riskScore: number,
  reasonCodes: readonly string[],
): string {
  const riskText = `위험도 ${riskScore}점 (${riskLevel})`;

  switch (status) {
    case 'ALLOW':
      return `${riskText} — 자동 실행이 허용됩니다.`;
    case 'CONSTRAINED_ALLOW':
      return `${riskText} — 실행 계획 검토(Gate L1) 후 제한된 범위에서 허용됩니다.`;
    case 'APPROVAL_REQUIRED':
      return `${riskText} — 변경 사항 승인(Gate L2)이 필요합니다. 사유: ${reasonCodes.join(', ')}`;
    case 'DENY':
      return `${riskText} — 정책 위반으로 거부됩니다. 사유: ${reasonCodes.join(', ')}`;
  }
}

// ─────────────────────────────────────────
// 정책 엔진 인터페이스 및 팩토리
// ─────────────────────────────────────────

/** 정책 판정 엔진 인터페이스 */
export interface PolicyEngine {
  /**
   * 요청을 평가하여 PolicyDecision을 생성한다.
   * 흐름: 절대 금지 패턴 매칭 → Risk Score 계산 → 게이트/Capability 결정
   */
  evaluate(
    request: PolicyRequest,
    subject: PolicySubject,
  ): Promise<Result<PolicyDecision, JarvisError>>;
}

/** 정책 엔진 생성 옵션 */
export interface PolicyEngineOptions {
  /** contract.md 기본 금지 패턴에 추가할 커스텀 패턴 */
  readonly customDenyPatterns?: readonly DenyPattern[];
}

/**
 * 정책 판정 엔진을 생성한다.
 * customDenyPatterns를 통해 프로젝트별 추가 금지 패턴을 등록할 수 있다.
 */
export function createPolicyEngine(options?: PolicyEngineOptions): PolicyEngine {
  // 기본 절대 금지 패턴 + 커스텀 패턴 합산
  const allDenyPatterns: readonly DenyPattern[] = [
    ...ABSOLUTE_DENY_PATTERNS,
    ...(options?.customDenyPatterns ?? []),
  ];

  return {
    async evaluate(
      request: PolicyRequest,
      subject: PolicySubject,
    ): Promise<Result<PolicyDecision, JarvisError>> {
      // ─── 단계 1: 절대 거부 패턴 매칭 ───
      const matchedDenyPattern = checkDenyPatterns(
        request.targets,
        request.raw_input,
        allDenyPatterns,
      );

      if (matchedDenyPattern !== undefined) {
        // 절대 금지 패턴 매칭 시 Risk Score 계산 없이 즉시 DENY
        const decision: PolicyDecision = {
          decision_id: generatePolicyDecisionId(),
          timestamp: new Date().toISOString(),
          subject,
          request,
          outcome: {
            status: 'DENY',
            risk_score: 100,
            risk_level: 'CRITICAL',
            requires_gates: [],
            reason_codes: [matchedDenyPattern.code],
            human_explanation:
              matchedDenyPattern.message ??
              `절대 금지 패턴(${matchedDenyPattern.code})에 해당하는 요청입니다.`,
          },
          constraints: DEFAULT_CONSTRAINTS,
          required_capabilities: [],
          audit: {
            log_level: 'FULL',
            redactions: ['secrets', 'tokens', 'cookies', 'passwords'],
          },
        };

        return ok(decision);
      }

      // ─── 단계 2: 5차원 Risk Score 계산 ───
      const dimensions = assessDimensions(request, request.targets);
      const riskScore = calculateRiskScore(dimensions);
      const riskLevel = classifyRiskLevel(riskScore);

      // ─── 단계 3: 정책 상태 결정 ───
      const policyStatus = determinePolicyStatus(riskLevel);

      // ─── 단계 4: 게이트 목록 결정 ───
      const requiredGates = determineRequiredGates(riskLevel);

      // ─── 단계 5: 위험 원인 코드 수집 ───
      const reasonCodes: string[] = [];
      if (dimensions.financial > 0) reasonCodes.push('FINANCIAL_RISK');
      if (dimensions.systemImpact > 0) reasonCodes.push('SYSTEM_IMPACT');
      if (dimensions.adminPrivilege > 0) reasonCodes.push('ADMIN_PRIVILEGE');
      if (dimensions.externalNetwork > 50) reasonCodes.push('EXTERNAL_NETWORK');
      if (dimensions.dataSensitivity > 50) reasonCodes.push('DATA_SENSITIVITY');
      if (reasonCodes.length === 0) reasonCodes.push('STANDARD_OPERATION');

      // ─── 단계 6: 판정 결과 조합 ───
      const outcome: PolicyOutcome = {
        status: policyStatus,
        risk_score: riskScore,
        risk_level: riskLevel,
        requires_gates: requiredGates,
        reason_codes: reasonCodes,
        human_explanation: buildHumanExplanation(
          policyStatus,
          riskLevel,
          riskScore,
          reasonCodes,
        ),
      };

      // ─── 단계 7: 필요 Capability 목록 생성 ───
      const requiredCapabilities = buildRequiredCapabilities(request, riskLevel);

      // ─── 단계 8: 제약 조건 보완 ───
      // 요청에 외부 접근이 포함된 경우 네트워크 허용 도메인 추가
      // (구체적인 도메인은 Gate 승인 후 사용자가 명시해야 함)
      const constraints: PolicyConstraints = {
        ...DEFAULT_CONSTRAINTS,
        network: {
          ...DEFAULT_CONSTRAINTS.network,
          allow_domains: [],
        },
      };

      // ─── 단계 9: PolicyDecision 조합 및 반환 ───
      const decision: PolicyDecision = {
        decision_id: generatePolicyDecisionId(),
        timestamp: new Date().toISOString(),
        subject,
        request,
        outcome,
        constraints,
        required_capabilities: requiredCapabilities,
        audit: {
          log_level: riskLevel === 'LOW' ? 'SUMMARY' : 'FULL',
          redactions: ['secrets', 'tokens', 'cookies', 'passwords'],
        },
      };

      return ok(decision);
    },
  };
}

// ─────────────────────────────────────────
// 판정 결과 유틸리티
// ─────────────────────────────────────────

/**
 * PolicyDecision이 자동 실행 허용인지 확인한다.
 * ALLOW 상태이고 게이트가 없을 때만 true를 반환한다.
 */
export function isAutoAllowed(decision: PolicyDecision): boolean {
  return (
    decision.outcome.status === 'ALLOW' &&
    decision.outcome.requires_gates.length === 0
  );
}

/**
 * PolicyDecision이 완전 거부인지 확인한다.
 */
export function isDenied(decision: PolicyDecision): boolean {
  return decision.outcome.status === 'DENY';
}

/**
 * PolicyDecision의 위험 코드 목록을 반환한다.
 */
export function getReasonCodes(decision: PolicyDecision): readonly string[] {
  return decision.outcome.reason_codes;
}
