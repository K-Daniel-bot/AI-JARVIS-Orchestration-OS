// 감사 로그 타입 — audit-log.json 스키마 기반
import type { PolicyStatus, RiskLevel } from "./policy.js";

// 감사 로그 레벨
export type AuditLogLevel = "FULL" | "SUMMARY";

// 감사 로그 실행 결과 상태
export type AuditResultStatus = "COMPLETED" | "FAILED" | "ROLLED_BACK" | "ABORTED" | "DENIED";

// 실행 액션 상태
export type ActionExecutionStatus = "SUCCESS" | "FAILED" | "DENIED";

// 감사 로그 — 누가/뭐/결과/시간 기록
export interface AuditEntry {
  readonly auditId: string;
  readonly timestamp: string;
  readonly logLevel: AuditLogLevel;

  readonly who: {
    readonly userId: string;
    readonly role: import("./agent.js").UserRole;
    readonly sessionId: string;
  };

  readonly what: {
    readonly rawInput: string;
    readonly aiInterpretation: string;
    readonly intent: string;
  };

  readonly policy: {
    readonly policyDecisionId: string;
    readonly riskScore: number;
    readonly riskLevel: RiskLevel;
    readonly status: PolicyStatus;
  };

  readonly capability: {
    readonly tokenIds: readonly string[];
    readonly scopesGranted: readonly string[];
  };

  readonly execution: {
    readonly runId: string;
    readonly actionsPerformed: readonly ActionPerformed[];
    readonly rollbackPerformed: boolean;
    readonly rollbackReason: string | null;
  };

  readonly result: {
    readonly status: AuditResultStatus;
    readonly outputSummary: string;
    readonly artifacts: readonly string[];
  };

  readonly evidence: {
    readonly screenshots: readonly string[];
    readonly terminalLogs: readonly string[];
    readonly previousActionId: string | null;
  };

  readonly redactions: {
    readonly applied: readonly string[];
    readonly patternsMatched: number;
  };

  readonly integrity: {
    readonly hash: string;
    readonly previousHash: string;
  };
}

// 실행된 액션 정보
export interface ActionPerformed {
  readonly actionId: string;
  readonly type: string;
  readonly status: ActionExecutionStatus;
  readonly durationMs: number;
}
