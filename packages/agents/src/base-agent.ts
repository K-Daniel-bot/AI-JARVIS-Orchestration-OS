// BaseAgent 추상 클래스 — 9개 에이전트가 공통으로 상속하는 기반 구현
import { z } from "zod";
import type { Result, JarvisError, CapabilityToken, AuditEntry } from "@jarvis/shared";
import {
  ok,
  err,
  createError,
  generateAuditId,
  nowISO,
} from "@jarvis/shared";
import type {
  BaseAgentConfig,
  BaseAgentDependencies,
  AgentTool,
  AgentExecutionContext,
} from "./types/agent-config.js";
import { callClaude, parseJsonResponse, type ThinkingOption } from "./claude-client.js";

// 에이전트 추상 기반 클래스 — 입력 검증, 감사 로그, 도구 권한 관리
export abstract class BaseAgent {
  protected readonly config: BaseAgentConfig;
  protected readonly deps: BaseAgentDependencies;

  constructor(config: BaseAgentConfig, deps: BaseAgentDependencies) {
    this.config = config;
    this.deps = deps;
  }

  // 에이전트 설정 조회
  getConfig(): BaseAgentConfig {
    return this.config;
  }

  // 각 에이전트가 구현해야 하는 실행 메서드
  abstract execute(
    input: unknown,
    context: AgentExecutionContext,
    capabilityToken?: CapabilityToken,
  ): Promise<Result<unknown, JarvisError>>;

  // 입력값 Zod 스키마 검증 — 검증 실패 시 Result.err 반환
  protected validateInput<T>(
    input: unknown,
    schema: z.ZodType<T>,
  ): Result<T, JarvisError> {
    const parsed = schema.safeParse(input);
    if (!parsed.success) {
      return err(
        createError("VALIDATION_FAILED", `입력 검증 실패: ${parsed.error.message}`, {
          agentId: this.config.agentId,
          context: { issues: parsed.error.issues as unknown[] },
        }),
      );
    }
    return ok(parsed.data);
  }

  // 출력값 Zod 스키마 검증 — 검증 실패 시 Result.err 반환
  protected validateOutput<T>(
    output: unknown,
    schema: z.ZodType<T>,
  ): Result<T, JarvisError> {
    const parsed = schema.safeParse(output);
    if (!parsed.success) {
      return err(
        createError("VALIDATION_FAILED", `출력 검증 실패: ${parsed.error.message}`, {
          agentId: this.config.agentId,
          context: { issues: parsed.error.issues as unknown[] },
        }),
      );
    }
    return ok(parsed.data);
  }

  // 감사 로그 기록 — AuditEntry 구조에 맞게 구성하여 저장
  // details는 aiInterpretation 필드에 직렬화하여 포함
  protected async logAudit(
    context: AgentExecutionContext,
    summary: string,
    status: AuditEntry["result"]["status"],
    details?: Record<string, unknown>,
  ): Promise<Result<void, JarvisError>> {
    // details를 aiInterpretation에 직렬화하여 포함
    const aiInterpretation = details !== undefined
      ? `${this.config.agentRole} 에이전트 실행 — ${JSON.stringify(details)}`
      : `${this.config.agentRole} 에이전트 실행`;

    // @jarvis/shared AuditEntry 구조에 맞게 구성 (integrity 필드 제외)
    const entry: Omit<AuditEntry, "integrity"> = {
      auditId: generateAuditId(),
      timestamp: nowISO(),
      logLevel: "SUMMARY",
      who: {
        userId: context.userId,
        role: "AI-Autonomous",
        sessionId: context.sessionId,
      },
      what: {
        rawInput: summary,
        aiInterpretation,
        intent: "CODE_IMPLEMENTATION",
      },
      policy: {
        policyDecisionId: "N/A",
        riskScore: 0,
        riskLevel: "LOW",
        status: "ALLOW",
      },
      capability: {
        tokenIds: [],
        scopesGranted: [],
      },
      execution: {
        runId: context.runId,
        actionsPerformed: [],
        rollbackPerformed: false,
        rollbackReason: null,
      },
      result: {
        status,
        outputSummary: summary,
        artifacts: [],
      },
      evidence: {
        screenshots: [],
        terminalLogs: [],
        previousActionId: null,
      },
      redactions: {
        applied: [],
        patternsMatched: 0,
      },
    };

    const result = await this.deps.auditLogger.record(entry);
    if (!result.ok) {
      return err(result.error);
    }
    return ok(undefined);
  }

  // 도구 사용 권한 확인 — disallowedTools에 포함되지 않아야 하고 tools에 포함되어야 함
  protected hasToolPermission(tool: AgentTool): boolean {
    if (this.config.disallowedTools.includes(tool)) {
      return false;
    }
    return this.config.tools.includes(tool);
  }

  // Claude API 호출 + JSON 파싱 + Zod 검증 — 에이전트에서 공통 사용
  // options 파라미터는 선택적 (하위 호환 유지)
  protected async callClaudeWithJson<T>(
    systemPrompt: string,
    userMessage: string,
    schema: z.ZodType<T>,
    options?: {
      thinking?: ThinkingOption;
      cacheControl?: boolean;
    },
  ): Promise<Result<T, JarvisError>> {
    if (!this.deps.claudeClient) {
      return err(
        createError("INTERNAL_ERROR", "claudeClient가 주입되지 않았습니다", {
          agentId: this.config.agentId,
        }),
      );
    }

    const claudeResult = await callClaude(this.deps.claudeClient, {
      model: this.config.model,
      systemPrompt,
      userMessage,
      thinking: options?.thinking,
      cacheControl: options?.cacheControl,
    });

    if (!claudeResult.ok) {
      return err(claudeResult.error);
    }

    return parseJsonResponse(claudeResult.value.content, schema);
  }
}
