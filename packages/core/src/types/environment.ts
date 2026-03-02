// Environment Bundle 타입 — 에이전트 간 공유되는 실행 환경 데이터
import type {
  AgentType,
  PolicyDecision,
  CapabilityToken,
  AuditEntry,
} from "@jarvis/shared";

// 스펙 문서 참조
export interface SpecRef {
  readonly specId: string;
  readonly rawInput: string;
  readonly interpretation: string;
  readonly clarifications: readonly string[];
}

// 실행 계획 참조
export interface PlanRef {
  readonly planId: string;
  readonly steps: readonly PlanStep[];
  readonly estimatedDurationMs: number;
}

// 실행 계획 단계
export interface PlanStep {
  readonly stepId: string;
  readonly description: string;
  readonly agent: AgentType;
  readonly dependsOn: readonly string[];
  readonly status: "pending" | "in_progress" | "completed" | "failed" | "skipped";
}

// 코드 변경 세트 참조
export interface ChangeSetRef {
  readonly changeSetId: string;
  readonly files: readonly FileChange[];
  readonly summary: string;
}

// 파일 변경 정보
export interface FileChange {
  readonly filePath: string;
  readonly operation: "create" | "modify" | "delete" | "rename";
  readonly diff: string;
}

// 리뷰 결과 참조
export interface ReviewRef {
  readonly reviewId: string;
  readonly passed: boolean;
  readonly blockers: readonly string[];
  readonly warnings: readonly string[];
}

// 테스트 결과 참조
export interface TestResultRef {
  readonly testRunId: string;
  readonly passed: boolean;
  readonly totalTests: number;
  readonly failedTests: number;
  readonly coveragePercent: number;
}

// Environment Bundle — 파이프라인 전체에서 누적되는 실행 컨텍스트
export interface EnvironmentBundle {
  readonly runId: string;
  readonly sessionId: string;
  readonly spec: SpecRef | null;
  readonly policy: PolicyDecision | null;
  readonly plan: PlanRef | null;
  readonly changeSet: ChangeSetRef | null;
  readonly review: ReviewRef | null;
  readonly testResult: TestResultRef | null;
  readonly capabilities: readonly CapabilityToken[];
  readonly auditTrail: readonly AuditEntry[];
  readonly metadata: Record<string, unknown>;
}

// 빈 Environment Bundle 생성
export function createEnvironmentBundle(
  runId: string,
  sessionId: string,
): EnvironmentBundle {
  return {
    runId,
    sessionId,
    spec: null,
    policy: null,
    plan: null,
    changeSet: null,
    review: null,
    testResult: null,
    capabilities: [],
    auditTrail: [],
    metadata: {},
  };
}
