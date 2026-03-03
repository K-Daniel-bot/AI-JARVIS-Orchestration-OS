// 에이전트 설정 타입 정의 — BaseAgent 생성자에 전달되는 설정 구조
import type Anthropic from "@anthropic-ai/sdk";
import type { Result, JarvisError, AuditEntry } from "@jarvis/shared";
import type { PolicyDecision, PolicySubject, PolicyRequest } from "@jarvis/shared";

// 에이전트 역할 — 9개 에이전트 식별자
export type AgentRole =
  | "orchestrator"
  | "spec"
  | "policy"
  | "planner"
  | "codegen"
  | "review"
  | "test"
  | "executor"
  | "rollback";

// Claude 모델 식별자
export type ClaudeModel =
  | "claude-opus-4-6"
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5-20251001";

// 에이전트가 사용할 수 있는 도구 목록
export type AgentTool =
  | "Read"
  | "Grep"
  | "Glob"
  | "Agent"
  | "Edit"
  | "Write"
  | "Bash";

// 권한 모드 — 에이전트 자율성 레벨
export type PermissionMode =
  | "observe"
  | "suggest"
  | "semi-auto"
  | "auto";

// 에이전트 기본 설정 인터페이스
export interface BaseAgentConfig {
  readonly agentId: string;
  readonly agentRole: AgentRole;
  readonly model: ClaudeModel;
  readonly tools: readonly AgentTool[];
  readonly disallowedTools: readonly AgentTool[];
  readonly permissionMode: PermissionMode;
  readonly maxTurns: number;
  readonly timeoutMs: number;
}

// 에이전트 실행 컨텍스트 — 각 execute() 호출에 전달
export interface AgentExecutionContext {
  readonly runId: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly trustMode: "observe" | "suggest" | "semi-auto" | "full-auto";
}

// 감사 로그 기록 인터페이스 — 에이전트가 주입받아 사용
export interface AuditLogger {
  record(entry: Omit<AuditEntry, "integrity">): Promise<Result<AuditEntry, JarvisError>>;
}

// 정책 평가 인터페이스 — 에이전트가 주입받아 사용
export interface PolicyEvaluator {
  evaluate(
    subject: PolicySubject,
    request: PolicyRequest,
  ): Result<PolicyDecision, JarvisError>;
}

// 에이전트 기본 의존성 — 생성자에서 주입
export interface BaseAgentDependencies {
  readonly auditLogger: AuditLogger;
  readonly policyEngine: PolicyEvaluator;
  readonly claudeClient?: Anthropic;  // 옵셔널 — Phase 0 테스트 호환
}
