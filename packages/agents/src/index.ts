// @jarvis/agents — 에이전트 시스템 barrel export

// Claude API 클라이언트
export {
  callClaude,
  parseJsonResponse,
  createAnthropicClient,
} from "./claude-client.js";
export type { ClaudeCallOptions, ClaudeResponse, ThinkingOption } from "./claude-client.js";

// 기반 클래스
export { BaseAgent } from "./base-agent.js";

// 9개 에이전트 구현체
export { OrchestratorAgent } from "./agents/orchestrator.js";
export { SpecAgent } from "./agents/spec-agent.js";
export { PolicyRiskAgent } from "./agents/policy-risk.js";
export { PlannerAgent } from "./agents/planner.js";
export { CodegenAgent } from "./agents/codegen.js";
export { ReviewAgent } from "./agents/review.js";
export { TestBuildAgent } from "./agents/test-build.js";
export { ExecutorAgent } from "./agents/executor-agent.js";
export { RollbackAgent } from "./agents/rollback.js";

// 타입
export type {
  AgentRole,
  ClaudeModel,
  AgentTool,
  PermissionMode,
  BaseAgentConfig,
  AgentExecutionContext,
  AuditLogger,
  PolicyEvaluator,
  BaseAgentDependencies,
} from "./types/agent-config.js";

// 입출력 스키마 및 타입
export {
  OrchestratorInputSchema,
  OrchestratorOutputSchema,
  SpecInputSchema,
  SpecOutputSchema,
  PolicyRiskInputSchema,
  PolicyRiskOutputSchema,
  PlannerInputSchema,
  PlannerOutputSchema,
  CodegenInputSchema,
  CodegenOutputSchema,
  ReviewInputSchema,
  ReviewOutputSchema,
  TestBuildInputSchema,
  TestBuildOutputSchema,
  ExecutorInputSchema,
  ExecutorOutputSchema,
  RollbackInputSchema,
  RollbackOutputSchema,
} from "./types/agent-io.js";

export type {
  OrchestratorInput,
  OrchestratorOutput,
  SpecInput,
  SpecOutput,
  PolicyRiskInput,
  PolicyRiskOutput,
  PlannerInput,
  PlannerOutput,
  CodegenInput,
  CodegenOutput,
  ReviewInput,
  ReviewOutput,
  TestBuildInput,
  TestBuildOutput,
  ExecutorInput,
  ExecutorOutput,
  RollbackInput,
  RollbackOutput,
} from "./types/agent-io.js";

// Batch API 클라이언트
export {
  createBatch,
  getBatchStatus,
  getBatchResults,
  cancelBatch,
} from "./batch-client.js";
export type { BatchRequest, BatchResult, BatchStatus } from "./batch-client.js";

// Cost Tracker
export { CostTracker, calculateCost, MODEL_PRICING } from "./cost-tracker.js";
export type { CostEntry, CostSummary } from "./cost-tracker.js";
