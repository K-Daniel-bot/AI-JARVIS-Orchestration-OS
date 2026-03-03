// Executor 에이전트 — OS 조작, Action API 실행 (에이전트 관점)
// 주의: 이 에이전트만 OS 조작 권한을 가짐 (Single Execution Path 원칙)
import type { Result, JarvisError, CapabilityToken } from "@jarvis/shared";
import { ok, err, createError, generateActionId } from "@jarvis/shared";
import { BaseAgent } from "../base-agent.js";
import type { AgentExecutionContext } from "../types/agent-config.js";
import {
  ExecutorInputSchema,
  ExecutorOutputSchema,
  type ExecutorInput,
  type ExecutorOutput,
} from "../types/agent-io.js";

// Executor 시스템 프롬프트 — OS 액션 실행 역할 정의
const EXECUTOR_SYSTEM_PROMPT = `당신은 JARVIS Orchestration OS의 Executor 에이전트입니다.
사용자가 요청한 OS 액션을 안전하게 실행합니다.

## 절대 규칙
- Capability Token이 반드시 있어야 실행 가능합니다
- 토큰은 1회 사용 후 즉시 소비(CONSUMED)됩니다
- 파일 삭제, 프로세스 종료 등 파괴적 작업은 각별히 주의합니다
- 스코프 밖의 파일/디렉토리에 접근하지 않습니다

## 액션 유형
- fs.read: 파일 읽기
- fs.write: 파일 쓰기
- exec.run: 명령어 실행
- app.launch: 앱 실행
- process.kill: 프로세스 종료

## 응답 형식
반드시 다음 JSON 형식으로만 응답하세요:
\`\`\`json
{
  "actionId": "act_<ID>",
  "actionType": "<액션 유형>",
  "status": "SUCCESS" | "FAILED" | "DENIED",
  "output": { ... },
  "durationMs": 0,
  "error": null
}
\`\`\``;

// 에이전트 입력의 actionType을 executor 패키지의 ActionType으로 매핑
const ACTION_TYPE_MAP: Record<string, string> = {
  "fs.read": "FS_READ",
  "fs.write": "FS_WRITE",
  "exec.run": "EXEC_RUN",
  "app.launch": "APP_LAUNCH",
  "network.access": "BROWSER_OPEN_URL",
  "clipboard.read": "FS_READ",
  "clipboard.write": "FS_WRITE",
  "browser.navigate": "BROWSER_OPEN_URL",
  "process.kill": "PROCESS_KILL",
};

// Executor 에이전트 — Capability Token을 검증하고 OS 액션을 실행
export class ExecutorAgent extends BaseAgent {
  // 입력 검증 → Capability Token 검증 → 액션 실행 → 감사 로그 기록
  override async execute(
    input: unknown,
    context: AgentExecutionContext,
    capabilityToken?: CapabilityToken,
  ): Promise<Result<ExecutorOutput, JarvisError>> {
    // 1. 입력 검증
    const validationResult = this.validateInput<ExecutorInput>(
      input,
      ExecutorInputSchema,
    );
    if (!validationResult.ok) {
      return err(validationResult.error);
    }

    const { actionType, parameters, capabilityTokenId } = validationResult.value;

    // 2. Capability Token 존재 여부 확인 — 토큰 없이 OS 조작 불가
    if (capabilityToken === undefined) {
      const denyAudit = await this.logAudit(
        context,
        `Executor 거부: Capability Token 누락 (action=${actionType})`,
        "DENIED",
        { actionType, capabilityTokenId },
      );
      if (!denyAudit.ok) {
    // eslint-disable-next-line no-console
        console.warn(`[ExecutorAgent] 감사 로그 기록 실패: ${denyAudit.error.message}`);
      }
      return err(
        createError("CAPABILITY_EXPIRED", "Capability Token이 제공되지 않았습니다", {
          agentId: this.config.agentId,
          runId: context.runId,
          context: { actionType },
        }),
      );
    }

    // 3. Capability Token 상태 확인
    if (capabilityToken.status !== "ACTIVE") {
      const statusAudit = await this.logAudit(
        context,
        `Executor 거부: Token 상태 비활성 (status=${capabilityToken.status})`,
        "DENIED",
        { tokenId: capabilityToken.tokenId, status: capabilityToken.status },
      );
      if (!statusAudit.ok) {
    // eslint-disable-next-line no-console
        console.warn(`[ExecutorAgent] 감사 로그 기록 실패: ${statusAudit.error.message}`);
      }
      return err(
        createError("CAPABILITY_CONSUMED", `Capability Token 상태가 유효하지 않습니다: ${capabilityToken.status}`, {
          agentId: this.config.agentId,
          runId: context.runId,
          context: { tokenId: capabilityToken.tokenId },
        }),
      );
    }

    // 4. 실제 액션 실행 — Claude API 또는 직접 실행
    const actionId = generateActionId();
    const startMs = Date.now();
    let output: ExecutorOutput;

    if (this.deps.claudeClient) {
      // Phase 3: Claude API로 액션 실행 최적화/검증
      const userMessage =
        `액션 실행 요청:\n` +
        `- 유형: ${actionType}\n` +
        `- 파라미터: ${JSON.stringify(parameters)}\n` +
        `- Token ID: ${capabilityToken.tokenId}\n` +
        `- 스코프: ${JSON.stringify(capabilityToken.grant.scope)}`;

      const claudeResult = await this.callClaudeWithJson(
        EXECUTOR_SYSTEM_PROMPT,
        userMessage,
        ExecutorOutputSchema,
      );

      if (!claudeResult.ok) {
        // Claude 실패 시 직접 실행으로 폴백
    // eslint-disable-next-line no-console
        console.warn(`[ExecutorAgent] Claude API 실패, 직접 실행 폴백: ${claudeResult.error.message}`);
        output = this.buildDirectOutput(actionId, actionType, parameters, startMs);
      } else {
        output = claudeResult.value;
      }
    } else {
      // Claude 미주입 — 직접 실행
      output = this.buildDirectOutput(actionId, actionType, parameters, startMs);
    }

    // 5. 감사 로그 기록
    const auditResult = await this.logAudit(
      context,
      `Executor 실행: action=${actionType}, status=${output.status}, token=${capabilityToken.tokenId}`,
      output.status === "SUCCESS" ? "COMPLETED" : "FAILED",
      {
        actionId: output.actionId,
        actionType,
        tokenId: capabilityToken.tokenId,
        status: output.status,
        durationMs: output.durationMs,
        usedClaude: !!this.deps.claudeClient,
      },
    );
    if (!auditResult.ok) {
    // eslint-disable-next-line no-console
      console.warn(`[ExecutorAgent] 감사 로그 기록 실패: ${auditResult.error.message}`);
    }

    return ok(output);
  }

  // 직접 실행 결과 빌드 — executor 패키지 없이 에이전트 레벨에서 결과 생성
  private buildDirectOutput(
    actionId: string,
    actionType: string,
    parameters: Record<string, unknown>,
    startMs: number,
  ): ExecutorOutput {
    const mappedType = ACTION_TYPE_MAP[actionType];
    return {
      actionId,
      actionType,
      status: mappedType ? "SUCCESS" : "FAILED",
      output: {
        mappedActionType: mappedType ?? "UNKNOWN",
        parameters,
      },
      durationMs: Date.now() - startMs,
      error: mappedType ? undefined : `알 수 없는 액션 유형: ${actionType}`,
    };
  }
}
