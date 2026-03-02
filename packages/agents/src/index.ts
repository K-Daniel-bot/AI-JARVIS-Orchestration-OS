/**
 * @jarvis/agents 패키지 barrel export
 * 9개 에이전트 구현체와 공통 기반 클래스를 외부에 공개한다.
 * export 순서: base → orchestrator → spec → policy → planner → codegen → review → test → executor → rollback
 */

// ─────────────────────────────────────────
// 1. 공통 기반 클래스 및 인터페이스
// ─────────────────────────────────────────

export type { AgentInput, AgentOutput } from './base-agent.js';
export { BaseAgent } from './base-agent.js';

// ─────────────────────────────────────────
// 2. OrchestratorAgent — 복잡도 분류, 흐름 제어
// ─────────────────────────────────────────

export type {
  ComplexityAssessment,
  TaskNode,
  OrchestrationPlan,
} from './orchestrator.js';
export { OrchestratorAgent } from './orchestrator.js';

// ─────────────────────────────────────────
// 3. SpecAgent — 의도 분석, SPEC 생성
// ─────────────────────────────────────────

export type {
  IntentType,
  AmbiguityLevel,
  AmbiguityItem,
  SpecArtifact,
} from './spec-agent.js';
export { SpecAgent } from './spec-agent.js';

// ─────────────────────────────────────────
// 4. PolicyRiskAgent — 정책 판정, Capability Token 발급
// ─────────────────────────────────────────

export type { PolicyRiskArtifact } from './policy-risk.js';
export { PolicyRiskAgent } from './policy-risk.js';

// ─────────────────────────────────────────
// 5. PlannerAgent — WBS, Task DAG 생성
// ─────────────────────────────────────────

export type {
  PlanStepType,
  PlanStep,
  BudgetPlan,
  PlanArtifact,
} from './planner.js';
export { PlannerAgent } from './planner.js';

// ─────────────────────────────────────────
// 6. CodegenAgent — 코드 생성, ChangeSet 작성
// ─────────────────────────────────────────

export type {
  AddedFile,
  ModifiedFile,
  SecuritySelfCheck,
  ChangeSetArtifact,
} from './codegen.js';
export { CodegenAgent } from './codegen.js';

// ─────────────────────────────────────────
// 7. ReviewAgent — 보안 검토, 코드 품질 검사
// ─────────────────────────────────────────

export type {
  ReviewVerdict,
  SecurityScanResult,
  CodeQualityScore,
  Blocker,
  Warning,
  ReviewArtifact,
} from './review.js';
export { ReviewAgent } from './review.js';

// ─────────────────────────────────────────
// 8. TestBuildAgent — 테스트/빌드 검증
// ─────────────────────────────────────────

export type {
  BuildResult,
  TestCaseResult,
  CoverageResult,
  FailureAnalysis,
  TestReportArtifact,
} from './test-build.js';
export { TestBuildAgent } from './test-build.js';

// ─────────────────────────────────────────
// 9. ExecutorAgent — OS 조작 유일 주체
// ─────────────────────────────────────────

export type {
  ActionRequest,
  ExecutorArtifact,
} from './executor-agent.js';
export { ExecutorAgent } from './executor-agent.js';

// ─────────────────────────────────────────
// 10. RollbackAgent — 롤백, Postmortem
// ─────────────────────────────────────────

export type {
  RollbackStep,
  RootCauseAnalysis,
  PostmortemReport,
  RollbackArtifact,
} from './rollback.js';
export { RollbackAgent } from './rollback.js';
