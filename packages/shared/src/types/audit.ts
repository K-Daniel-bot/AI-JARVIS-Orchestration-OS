// 감사 로그 타입 정의 — audit-log.json 스키마 기반

/** 감사 로그 기록 수준 */
export type AuditLogLevel = 'FULL' | 'SUMMARY';

/** 사용자 역할 */
export type UserRole = 'Owner' | 'Admin' | 'User' | 'Guest' | 'AI-Autonomous';

/** 위험도 수준 */
export type RiskLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

/** 정책 판정 결과 상태 */
export type PolicyStatus =
  | 'ALLOW'
  | 'DENY'
  | 'APPROVAL_REQUIRED'
  | 'CONSTRAINED_ALLOW';

/** 액션 실행 결과 상태 */
export type ActionStatus = 'SUCCESS' | 'FAILED' | 'DENIED';

/** 감사 엔트리 최종 결과 상태 */
export type AuditResultStatus =
  | 'COMPLETED'
  | 'FAILED'
  | 'ROLLED_BACK'
  | 'ABORTED'
  | 'DENIED';

/** 요청 주체 정보 */
export interface AuditWho {
  readonly user_id: string;
  readonly role: UserRole;
  readonly session_id: string;
}

/** 요청 내용 */
export interface AuditWhat {
  readonly raw_input: string;
  readonly ai_interpretation: string;
  readonly intent: string;
}

/** 정책 판정 결과 요약 */
export interface AuditPolicy {
  readonly policy_decision_id: string;
  readonly risk_score: number;
  readonly risk_level: RiskLevel;
  readonly status: PolicyStatus;
}

/** Capability 토큰 참조 */
export interface AuditCapability {
  readonly token_ids: readonly string[];
  readonly scopes_granted: readonly string[];
}

/** 실행된 개별 액션 기록 */
export interface AuditAction {
  readonly action_id: string;
  readonly type: string;
  readonly status: ActionStatus;
  readonly duration_ms: number;
}

/** 실행 단계 기록 */
export interface AuditExecution {
  readonly run_id: string;
  readonly actions_performed: readonly AuditAction[];
  readonly rollback_performed: boolean;
  readonly rollback_reason: string | null;
}

/** 실행 결과 */
export interface AuditResult {
  readonly status: AuditResultStatus;
  readonly output_summary: string;
  readonly artifacts: readonly string[];
}

/** 증거 참조 */
export interface AuditEvidence {
  readonly screenshots: readonly string[];
  readonly terminal_logs: readonly string[];
  readonly previous_action_id: string | null;
}

/** 민감 정보 마스킹 기록 */
export interface AuditRedactions {
  readonly applied: readonly string[];
  readonly patterns_matched: number;
}

/** 해시 체인 무결성 정보 */
export interface AuditIntegrity {
  readonly hash: string;
  readonly previous_hash: string;
}

/** 감사 로그 전체 엔트리 구조 */
export interface AuditEntry {
  readonly audit_id: string;
  readonly timestamp: string;
  readonly log_level: AuditLogLevel;
  readonly who: AuditWho;
  readonly what: AuditWhat;
  readonly policy: AuditPolicy;
  readonly capability: AuditCapability;
  readonly execution: AuditExecution;
  readonly result: AuditResult;
  readonly evidence: AuditEvidence;
  readonly redactions: AuditRedactions;
  readonly integrity: AuditIntegrity;
}
