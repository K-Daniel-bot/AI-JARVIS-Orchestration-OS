// 에이전트 입출력 타입 정의 — 각 에이전트의 execute() 메서드 입출력 구조
import { z } from "zod";

// ─── 공통 스키마 ────────────────────────────────────────────────────────────

// 실행 컨텍스트 스키마
const ExecutionContextSchema = z.object({
  runId: z.string(),
  sessionId: z.string(),
  userId: z.string(),
  trustMode: z.enum(["observe", "suggest", "semi-auto", "full-auto"]),
});

// ─── Orchestrator ────────────────────────────────────────────────────────────

// Orchestrator 입력 스키마 — 사용자 원시 입력과 복잡도 분류
export const OrchestratorInputSchema = z.object({
  rawInput: z.string().min(1),
  context: ExecutionContextSchema,
});

// Orchestrator 출력 스키마 — 파이프라인 흐름 결정
export const OrchestratorOutputSchema = z.object({
  complexity: z.enum(["simple", "moderate", "complex"]),
  recommendedPipeline: z.array(z.string()),
  specRef: z.string(),
  runId: z.string(),
});

export type OrchestratorInput = z.infer<typeof OrchestratorInputSchema>;
export type OrchestratorOutput = z.infer<typeof OrchestratorOutputSchema>;

// ─── Spec Agent ──────────────────────────────────────────────────────────────

// Spec Agent 입력 스키마 — 의도 분석 대상
export const SpecInputSchema = z.object({
  rawInput: z.string().min(1),
  context: ExecutionContextSchema,
  clarificationHistory: z.array(z.string()).optional(),
});

// Spec Agent 출력 스키마 — 구조화된 요구사항 명세
export const SpecOutputSchema = z.object({
  specId: z.string(),
  interpretation: z.string(),
  intent: z.enum([
    "CODE_IMPLEMENTATION",
    "FILE_OPERATION",
    "APP_LAUNCH",
    "WEB_ACCESS",
    "SYSTEM_CONFIG",
    "PACKAGE_INSTALL",
    "NETWORK_REQUEST",
    "PROCESS_MANAGEMENT",
    "MOBILE_ACTION",
  ]),
  targets: z.array(z.string()),
  requiresWebAccess: z.boolean(),
  requiresLogin: z.boolean(),
  clarifications: z.array(z.string()),
  ambiguities: z.array(z.string()),
});

export type SpecInput = z.infer<typeof SpecInputSchema>;
export type SpecOutput = z.infer<typeof SpecOutputSchema>;

// ─── Policy Risk ─────────────────────────────────────────────────────────────

// Policy Risk 입력 스키마 — 정책 판정 대상
export const PolicyRiskInputSchema = z.object({
  specOutput: SpecOutputSchema,
  context: ExecutionContextSchema,
  subject: z.object({
    userId: z.string(),
    role: z.enum(["Owner", "Admin", "User", "Guest", "AI-Autonomous"]),
    device: z.string(),
    sessionId: z.string(),
  }),
});

// Policy Risk 출력 스키마 — 정책 판정 결과 (Extended Thinking 심층 분석 필드 포함)
export const PolicyRiskOutputSchema = z.object({
  decisionId: z.string(),
  status: z.enum(["ALLOW", "DENY", "APPROVAL_REQUIRED", "CONSTRAINED_ALLOW"]),
  riskScore: z.number().min(0).max(100),
  riskLevel: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  requiresGates: z.array(z.string()),
  requiredCapabilities: z.array(z.string()),
  humanExplanation: z.string(),
  // Opus Extended Thinking 심층 분석 결과 — claudeClient 미주입 시 undefined
  deepAnalysis: z.string().optional(),
  // Opus가 조정 제안한 위험도 점수 — 원래 riskScore 이상만 반영
  adjustedRiskScore: z.number().min(0).max(100).optional(),
});

export type PolicyRiskInput = z.infer<typeof PolicyRiskInputSchema>;
export type PolicyRiskOutput = z.infer<typeof PolicyRiskOutputSchema>;

// ─── Planner ─────────────────────────────────────────────────────────────────

// Planner 입력 스키마 — 작업 분해 대상
export const PlannerInputSchema = z.object({
  specOutput: SpecOutputSchema,
  policyDecisionId: z.string(),
  context: ExecutionContextSchema,
  constraints: z.object({
    writeAllow: z.array(z.string()),
    packagesAllowed: z.array(z.string()),
  }).optional(),
});

// Planner 출력 스키마 — Task DAG
export const PlannerOutputSchema = z.object({
  planId: z.string(),
  steps: z.array(z.object({
    stepId: z.string(),
    type: z.enum(["CODE_GENERATE", "FILE_OP", "EXEC", "REVIEW", "TEST", "DEPLOY"]),
    description: z.string(),
    agent: z.string(),
    dependsOn: z.array(z.string()),
    estimatedDurationMs: z.number().nonnegative(),
  })),
  estimatedTotalMs: z.number().nonnegative(),
  toolRequests: z.array(z.object({
    packageName: z.string(),
    version: z.string(),
    reason: z.string(),
  })),
});

export type PlannerInput = z.infer<typeof PlannerInputSchema>;
export type PlannerOutput = z.infer<typeof PlannerOutputSchema>;

// ─── Codegen ─────────────────────────────────────────────────────────────────

// Codegen 입력 스키마 — 코드 생성 대상
export const CodegenInputSchema = z.object({
  planStep: z.object({
    stepId: z.string(),
    description: z.string(),
    outputs: z.array(z.string()),
  }),
  specOutput: SpecOutputSchema,
  context: ExecutionContextSchema,
  existingCode: z.record(z.string(), z.string()).optional(),
});

// Codegen 출력 스키마 — ChangeSet
export const CodegenOutputSchema = z.object({
  changeSetId: z.string(),
  planRef: z.string(),
  stepRef: z.string(),
  filesAdded: z.array(z.object({
    path: z.string(),
    content: z.string(),
  })),
  filesModified: z.array(z.object({
    path: z.string(),
    diff: z.string(),
  })),
  migrationNotes: z.string().optional(),
  securitySelfCheck: z.object({
    secretsFound: z.boolean(),
    injectionRisk: z.boolean(),
    pathTraversalRisk: z.boolean(),
  }),
});

export type CodegenInput = z.infer<typeof CodegenInputSchema>;
export type CodegenOutput = z.infer<typeof CodegenOutputSchema>;

// ─── Review ──────────────────────────────────────────────────────────────────

// Review 입력 스키마 — 코드 검토 대상
export const ReviewInputSchema = z.object({
  changeSet: CodegenOutputSchema,
  context: ExecutionContextSchema,
  policyDecisionId: z.string(),
});

// Review 출력 스키마 — 검토 결과 (보안 체크리스트 15개 + 품질 지표)
export const ReviewOutputSchema = z.object({
  reviewId: z.string(),
  passed: z.boolean(),
  blockers: z.array(z.object({
    file: z.string(),
    line: z.number().optional(),
    issue: z.string(),
    severity: z.enum(["critical", "high", "medium", "low"]),
  })),
  warnings: z.array(z.string()),
  securityFindings: z.array(z.string()),
  approvedChangeSetId: z.string().optional(),
  // 코드 품질 지표 — 복잡도, 유지보수성, 테스트 용이성 (0~100, optional)
  qualityMetrics: z.object({
    complexityScore: z.number().min(0).max(100),
    maintainabilityScore: z.number().min(0).max(100),
    testabilityScore: z.number().min(0).max(100),
  }).optional(),
});

export type ReviewInput = z.infer<typeof ReviewInputSchema>;
export type ReviewOutput = z.infer<typeof ReviewOutputSchema>;

// ─── Test Build ──────────────────────────────────────────────────────────────

// Test Build 입력 스키마 — 테스트 실행 대상
export const TestBuildInputSchema = z.object({
  changeSetId: z.string(),
  reviewId: z.string(),
  context: ExecutionContextSchema,
  testCommands: z.array(z.string()).optional(),
});

// Test Build 출력 스키마 — 테스트 결과 (테스트 제안 포함)
export const TestBuildOutputSchema = z.object({
  testRunId: z.string(),
  buildPassed: z.boolean(),
  testsPassed: z.boolean(),
  totalTests: z.number().nonnegative(),
  failedTests: z.number().nonnegative(),
  coveragePercent: z.number().min(0).max(100),
  errors: z.array(z.string()),
  durationMs: z.number().nonnegative(),
  // 추가로 작성해야 할 테스트 제안 목록 — 선택적 필드
  suggestedTests: z.array(z.object({
    testName: z.string(),
    testType: z.enum(["unit", "integration", "e2e"]),
    targetFile: z.string(),
    description: z.string(),
  })).optional(),
});

export type TestBuildInput = z.infer<typeof TestBuildInputSchema>;
export type TestBuildOutput = z.infer<typeof TestBuildOutputSchema>;

// ─── Executor Agent ──────────────────────────────────────────────────────────

// Executor 입력 스키마 — OS 조작 명령 (에이전트 관점)
export const ExecutorInputSchema = z.object({
  actionType: z.enum([
    "fs.read",
    "fs.write",
    "exec.run",
    "app.launch",
    "network.access",
    "clipboard.read",
    "clipboard.write",
    "browser.navigate",
    "process.kill",
  ]),
  parameters: z.record(z.string(), z.unknown()),
  capabilityTokenId: z.string(),
  context: ExecutionContextSchema,
});

// Executor 출력 스키마 — 실행 결과
export const ExecutorOutputSchema = z.object({
  actionId: z.string(),
  actionType: z.string(),
  status: z.enum(["SUCCESS", "FAILED", "DENIED"]),
  output: z.record(z.string(), z.unknown()).optional(),
  durationMs: z.number().nonnegative(),
  error: z.string().optional(),
});

export type ExecutorInput = z.infer<typeof ExecutorInputSchema>;
export type ExecutorOutput = z.infer<typeof ExecutorOutputSchema>;

// ─── Rollback ────────────────────────────────────────────────────────────────

// Rollback 입력 스키마 — 롤백 대상
export const RollbackInputSchema = z.object({
  runId: z.string(),
  reason: z.string(),
  context: ExecutionContextSchema,
  targetChangeSetId: z.string().optional(),
});

// Rollback 출력 스키마 — 롤백 결과
export const RollbackOutputSchema = z.object({
  rollbackId: z.string(),
  success: z.boolean(),
  revertedActions: z.array(z.string()),
  postmortem: z.string(),
  errors: z.array(z.string()),
});

export type RollbackInput = z.infer<typeof RollbackInputSchema>;
export type RollbackOutput = z.infer<typeof RollbackOutputSchema>;
