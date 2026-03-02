/**
 * ExecutorAgent — OS 조작 유일 주체 에이전트
 * Action API 실행, Capability Token 검증/소비, ExecutionTrace 생성을 담당한다.
 * 계약서 §2: 모든 OS 조작은 Capability Token이 부여된 경우에만 실행된다.
 * Sonnet 4.6 모델을 사용한다.
 */

import { getAgentConfig } from '@jarvis/core';
import {
  validateToken,
  consumeToken,
  createTokenStore,
} from '@jarvis/policy-engine';
import type {
  CapabilityToken,
  ActionType,
  ExecutionTrace,
  ExecutionStep,
  RunStatus,
  Result,
} from '@jarvis/shared';
import {
  JarvisError,
  ErrorCode,
  ok,
  err,
  generateRunId,
  generateActionId,
} from '@jarvis/shared';
import { BaseAgent } from './base-agent.js';
import type { AgentInput, AgentOutput } from './base-agent.js';
import type { PlanArtifact, PlanStep } from './planner.js';
import type { TestReportArtifact } from './test-build.js';

// ─────────────────────────────────────────
// Executor 산출물 타입
// ─────────────────────────────────────────

/** 단일 액션 실행 요청 */
export interface ActionRequest {
  /** 액션 유형 */
  readonly type: ActionType;
  /** 액션 파라미터 */
  readonly params: Record<string, unknown>;
  /** 필요한 Capability Token ID */
  readonly capabilityTokenId: string;
}

/** ExecutionTrace 확장 산출물 */
export interface ExecutorArtifact {
  /** 실행 추적 기록 */
  readonly trace: ExecutionTrace;
  /** 실행된 액션 요약 */
  readonly actionSummary: readonly string[];
  /** 전체 실행 성공 여부 */
  readonly success: boolean;
}

// ─────────────────────────────────────────
// Enforcement Hook — 액션 사전/사후 검사
// ─────────────────────────────────────────

/**
 * 액션 실행 전 Enforcement Hook — 계약서 §1 절대 금지사항을 검사한다.
 * 금지된 액션 유형 또는 파라미터를 감지하면 에러를 반환한다.
 */
function enforcementPreCheck(
  request: ActionRequest,
): Result<void, JarvisError> {
  const { type, params } = request;

  // 계약서 §1: 금융/결제 영역 자동화 금지
  const targetPath = params['path'] as string | undefined;
  const targetUrl = params['url'] as string | undefined;
  const targetApp = params['app'] as string | undefined;

  const forbiddenKeywords = ['billing', 'payment', 'bank', 'finance', 'credit'];

  const checkValue = [targetPath, targetUrl, targetApp]
    .filter((v): v is string => v !== undefined)
    .some((v) =>
      forbiddenKeywords.some((kw) => v.toLowerCase().includes(kw)),
    );

  if (checkValue) {
    return err(
      new JarvisError({
        code: ErrorCode.POLICY_DENIED,
        message: '계약서 §1 위반: 금융/결제 영역 자동화가 차단되었습니다',
        context: { actionType: type, params },
      }),
    );
  }

  // 계약서 §1: 시스템 파일 접근 금지
  if (targetPath !== undefined) {
    const systemPaths = ['/Windows/', '/System/', 'AppData/', 'C:\\Windows\\'];
    const isForbiddenPath = systemPaths.some((sp) =>
      targetPath.includes(sp),
    );
    if (isForbiddenPath) {
      return err(
        new JarvisError({
          code: ErrorCode.POLICY_DENIED,
          message: '계약서 §1 위반: OS 시스템 파일 접근이 차단되었습니다',
          context: { actionType: type, path: targetPath },
        }),
      );
    }
  }

  // 계약서 §1: 관리자 권한 자동 실행 금지
  if (type === 'EXEC_RUN') {
    const command = params['command'] as string | undefined;
    const forbiddenCommands = ['sudo', 'regedit', 'powershell_admin', 'net user'];
    if (command !== undefined && forbiddenCommands.some((cmd) => command.toLowerCase().includes(cmd))) {
      return err(
        new JarvisError({
          code: ErrorCode.POLICY_DENIED,
          message: '계약서 §1 위반: 관리자 권한 명령어 실행이 차단되었습니다',
          context: { actionType: type, command },
        }),
      );
    }
  }

  return ok(undefined);
}

/**
 * 액션 유형에서 필요한 Capability 이름을 결정한다.
 */
function resolveCapabilityName(actionType: ActionType): string {
  if (actionType.startsWith('FS_')) return 'fs.read';
  if (actionType === 'EXEC_RUN') return 'exec.run';
  if (actionType.startsWith('BROWSER_')) return 'network.access';
  if (actionType.startsWith('MOBILE_')) return `mobile.${actionType.toLowerCase().replace('mobile_', '')}`;
  return 'exec.run';
}

/**
 * Plan Step에서 ActionRequest를 생성한다.
 */
function planStepToActionRequest(
  step: PlanStep,
  tokens: readonly CapabilityToken[],
): ActionRequest | undefined {
  // Step 유형에 따른 ActionType 매핑
  const typeMap: Partial<Record<string, ActionType>> = {
    FILE_READ: 'FS_READ',
    FILE_WRITE: 'FS_WRITE',
    EXEC_RUN: 'EXEC_RUN',
    CODE_GENERATE: 'FS_WRITE',
  };

  const actionType = typeMap[step.type];
  if (actionType === undefined) return undefined;

  // 해당 액션 유형에 맞는 Capability Token 탐색
  const capName = resolveCapabilityName(actionType);
  const token = tokens.find(
    (t) => t.status === 'ACTIVE' && t.grant.cap === capName,
  );

  if (token === undefined) return undefined;

  return {
    type: actionType,
    params: {
      path: step.outputs[0] ?? '',
      description: step.description,
    },
    capabilityTokenId: token.token_id,
  };
}

// ─────────────────────────────────────────
// ExecutorAgent 구현
// ─────────────────────────────────────────

/**
 * ExecutorAgent — OS 조작 유일 주체 에이전트.
 * 계약서 §2에 따라 Capability Token 없이는 어떠한 OS 조작도 수행하지 않는다.
 */
export class ExecutorAgent extends BaseAgent {
  /** Capability Token 저장소 */
  private readonly tokenStore: ReturnType<typeof createTokenStore>;

  constructor() {
    const config = getAgentConfig('executor');
    if (config === undefined) {
      throw new Error('executor 에이전트 설정을 찾을 수 없습니다');
    }
    super(config);
    this.tokenStore = createTokenStore();
  }

  /**
   * ExecutorAgent를 기본 설정으로 생성한다.
   */
  static create(): ExecutorAgent {
    return new ExecutorAgent();
  }

  /**
   * Plan의 실행 가능한 단계를 실행하고 ExecutionTrace를 생성한다.
   * 1. Capability Token 검증
   * 2. Enforcement Hook 사전 검사
   * 3. 액션 실행 (Phase 0: 시뮬레이션)
   * 4. 토큰 소비
   * 5. ExecutionTrace 생성
   */
  async execute(
    input: AgentInput,
  ): Promise<Result<AgentOutput, JarvisError>> {
    const planData = input.context['plan'] as PlanArtifact | undefined;
    const testReport = input.context['testReport'] as TestReportArtifact | undefined;
    const tokens = (input.context['capabilityTokens'] ?? []) as CapabilityToken[];

    if (planData === undefined) {
      return err(
        new JarvisError({
          code: ErrorCode.VALIDATION_FAILED,
          message: 'ExecutorAgent: 컨텍스트에 Plan 데이터가 없습니다',
          context: { runId: input.runId },
        }),
      );
    }

    // 테스트 미통과 시 실행 차단
    if (testReport !== undefined && !testReport.allPassed) {
      return err(
        new JarvisError({
          code: ErrorCode.POLICY_DENIED,
          message: 'ExecutorAgent: 테스트가 통과되지 않아 실행이 차단됩니다',
          context: {
            runId: input.runId,
            testFailed: testReport.failed,
            buildSuccess: testReport.buildResult.success,
          },
        }),
      );
    }

    this.logAudit({
      runId: input.runId,
      action: `실행 시작: 토큰 ${tokens.length}개, 단계 ${planData.steps.length}개`,
      result: 'STARTED',
    });

    // 토큰을 저장소에 등록
    for (const token of tokens) {
      this.tokenStore.save(token);
    }

    const runId = generateRunId();
    const executionSteps: ExecutionStep[] = [];
    const actionSummary: string[] = [];
    let overallSuccess = true;

    // 각 Plan Step을 순차 실행
    for (const step of planData.steps) {
      const stepStartTime = new Date().toISOString();
      const actionId = generateActionId();

      // ActionRequest 생성
      const actionRequest = planStepToActionRequest(step, tokens);

      if (actionRequest === undefined) {
        // 실행 불가 단계 (CODE_GENERATE는 이미 codegen이 처리)
        executionSteps.push({
          action_id: actionId,
          status: 'SKIPPED',
          started_at: stepStartTime,
          ended_at: new Date().toISOString(),
          evidence: {},
        });
        continue;
      }

      // Enforcement Hook 사전 검사
      const preCheckResult = enforcementPreCheck(actionRequest);
      if (!preCheckResult.ok) {
        executionSteps.push({
          action_id: actionId,
          status: 'DENIED',
          started_at: stepStartTime,
          ended_at: new Date().toISOString(),
          evidence: {},
          error: preCheckResult.error.message,
        });
        overallSuccess = false;
        this.logAudit({
          runId: input.runId,
          action: `액션 거부: ${step.description}`,
          result: 'DENIED',
        });
        continue;
      }

      // Capability Token 검증
      const token = this.tokenStore.get(actionRequest.capabilityTokenId);
      if (token === undefined) {
        executionSteps.push({
          action_id: actionId,
          status: 'DENIED',
          started_at: stepStartTime,
          ended_at: new Date().toISOString(),
          evidence: {},
          error: `Capability Token '${actionRequest.capabilityTokenId}'을 찾을 수 없습니다`,
        });
        overallSuccess = false;
        continue;
      }

      const capName = resolveCapabilityName(actionRequest.type);
      const validateResult = validateToken(
        token,
        capName,
        (actionRequest.params['path'] as string | undefined) ?? '*',
      );

      if (!validateResult.ok) {
        executionSteps.push({
          action_id: actionId,
          status: 'DENIED',
          started_at: stepStartTime,
          ended_at: new Date().toISOString(),
          evidence: {},
          error: validateResult.error.message,
        });
        overallSuccess = false;
        continue;
      }

      // Claude로 실행 계획 확인
      const claudeResult = await this.callClaude({
        systemPrompt: this.buildSystemPrompt(),
        userMessage: `다음 액션을 실행 확인하십시오: ${JSON.stringify(actionRequest)}`,
        maxTokens: 256,
      });

      if (!claudeResult.ok) {
        return err(claudeResult.error);
      }

      // Phase 0: 실제 OS 조작 대신 시뮬레이션
      const consumeResult = consumeToken(
        this.tokenStore,
        actionRequest.capabilityTokenId,
        actionId,
      );

      if (!consumeResult.ok) {
        executionSteps.push({
          action_id: actionId,
          status: 'FAILED',
          started_at: stepStartTime,
          ended_at: new Date().toISOString(),
          evidence: {},
          error: consumeResult.error.message,
        });
        overallSuccess = false;
        continue;
      }

      executionSteps.push({
        action_id: actionId,
        status: 'SUCCESS',
        started_at: stepStartTime,
        ended_at: new Date().toISOString(),
        evidence: {},
      });

      actionSummary.push(`${step.type}: ${step.description} — 성공`);

      this.logAudit({
        runId: input.runId,
        action: `액션 실행 완료: ${step.description} (토큰: ${actionRequest.capabilityTokenId})`,
        result: 'SUCCESS',
      });
    }

    const runStatus: RunStatus = overallSuccess ? 'SUCCESS' : 'PARTIAL_SUCCESS';

    const trace: ExecutionTrace = {
      run_id: runId,
      status: runStatus,
      steps: executionSteps,
      redactions_applied: ['secrets', 'tokens', 'cookies'],
    };

    const artifact: ExecutorArtifact = {
      trace,
      actionSummary,
      success: overallSuccess,
    };

    this.logAudit({
      runId: input.runId,
      action: `실행 완료: ${runStatus}, ${executionSteps.length}개 단계`,
      result: runStatus,
    });

    return ok({
      artifactType: 'EXECUTION_TRACE',
      artifactRef: runId,
      summary: `실행 ${runStatus}: ${executionSteps.filter((s) => s.status === 'SUCCESS').length}/${executionSteps.length} 성공`,
      data: artifact,
      metadata: {
        runStatus,
        totalSteps: executionSteps.length,
        successSteps: executionSteps.filter((s) => s.status === 'SUCCESS').length,
        deniedSteps: executionSteps.filter((s) => s.status === 'DENIED').length,
        skippedSteps: executionSteps.filter((s) => s.status === 'SKIPPED').length,
      },
    });
  }

  /** ExecutorAgent 시스템 프롬프트 생성 */
  private buildSystemPrompt(): string {
    return `당신은 JARVIS OS의 Executor 에이전트입니다.
OS 조작을 수행하는 유일한 에이전트입니다.

반드시 준수할 계약서 §1 절대 금지사항:
1. OS 시스템 파일 접근 금지
2. 금융/결제 영역 자동화 금지
3. 관리자 권한 자동 실행 금지
4. 사용자 승인 없이 파일 삭제/패키지 설치 금지

모든 액션은 유효한 Capability Token이 있어야만 실행됩니다.`;
  }
}
