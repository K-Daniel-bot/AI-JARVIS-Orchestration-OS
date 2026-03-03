// JarvisRuntime — 핵심 연결 레이어. XState 액터 + 에이전트 + 감사 로그 + SSE 통합
import { randomUUID } from "node:crypto";
import { createActor, type AnyActorRef } from "xstate";
import Anthropic from "@anthropic-ai/sdk";
import { jarvisMachine } from "@jarvis/core";
import type { JarvisMachineContext } from "@jarvis/core";
import type { SpecRef, PlanRef, ChangeSetRef, ReviewRef, TestResultRef } from "@jarvis/core";
import type { Result, JarvisError, AuditEntry } from "@jarvis/shared";
import { createError } from "@jarvis/shared";
import { evaluate } from "@jarvis/policy-engine";
import { AuditStore } from "@jarvis/audit";
import {
  SpecAgent,
  PlannerAgent,
  CodegenAgent,
  ReviewAgent,
  TestBuildAgent,
  RollbackAgent,
  type BaseAgentConfig,
  type AuditLogger,
  type PolicyEvaluator,
  type BaseAgentDependencies,
  type PlannerOutput,
  type CodegenOutput,
  type ReviewOutput,
  type TestBuildOutput,
} from "@jarvis/agents";
import { sseEmitter } from "../sse/event-emitter.js";
import { gateResolver } from "./gate-resolver.js";
import { registerGate } from "../routes/gates.js";

// 활성 런 정보
export interface ActiveRun {
  readonly runId: string;
  readonly sessionId: string;
  readonly trustMode: string;
  readonly startedAt: string;
  readonly actor: AnyActorRef;
}

// 감사 로그 어댑터 — AuditStore를 AuditLogger 인터페이스로 래핑
function createAuditAdapter(store: AuditStore): AuditLogger {
  return {
    record(entry: Omit<AuditEntry, "integrity">): Promise<Result<AuditEntry, JarvisError>> {
      return Promise.resolve(store.append(entry));
    },
  };
}

// 정책 평가 어댑터 — evaluate() 함수를 PolicyEvaluator 인터페이스로 래핑
function createPolicyAdapter(): PolicyEvaluator {
  return {
    evaluate: (subject, request) => evaluate(subject, request),
  };
}

// 타임라인 노드 타입 (프론트엔드 스키마 호환)
type TimelineNodeType = "SPEC" | "POLICY" | "PLAN" | "GATE" | "CODEGEN" | "REVIEW" | "TEST" | "DEPLOY" | "ROLLBACK";
type TimelineNodeStatus = "PENDING" | "RUNNING" | "DONE" | "WAITING_GATE" | "DENIED" | "FAILED" | "SKIPPED";
type AgentTypeStr = "spec-agent" | "policy-risk" | "planner" | "codegen" | "review" | "test-build" | "executor" | "rollback" | "orchestrator";

// TimelineNodeDto 생성 헬퍼 — NODE_UPDATED SSE 페이로드를 프론트엔드 규격에 맞춤
function buildTimelineNode(
  nodeType: TimelineNodeType,
  status: TimelineNodeStatus,
  title: string,
  agentType: AgentTypeStr | null,
  summary: string | null,
  extras: {
    riskScore?: number;
    riskLevel?: string;
    riskTags?: readonly string[];
    policyRefs?: readonly string[];
    gateId?: string;
    isUndoPoint?: boolean;
    startedAt?: string;
    completedAt?: string;
    durationMs?: number;
  } = {},
): Record<string, unknown> {
  return {
    nodeId: `node_${randomUUID().slice(0, 8)}`,
    type: nodeType,
    status,
    title,
    summary,
    agentType,
    startedAt: extras.startedAt ?? new Date().toISOString(),
    completedAt: extras.completedAt ?? (status === "DONE" || status === "FAILED" ? new Date().toISOString() : null),
    durationMs: extras.durationMs ?? null,
    riskScore: extras.riskScore ?? null,
    riskLevel: extras.riskLevel ?? null,
    riskTags: extras.riskTags ?? [],
    policyRefs: extras.policyRefs ?? [],
    capabilityIds: [],
    evidenceIds: [],
    isUndoPoint: extras.isUndoPoint ?? false,
    gateId: extras.gateId ?? null,
  };
}

// JarvisRuntime 클래스 — 서버의 핵심 싱글톤
class JarvisRuntime {
  private auditStore: AuditStore | null = null;
  private claudeClient: Anthropic | null = null;
  private activeRun: ActiveRun | null = null;
  private specAgent: SpecAgent | null = null;
  private plannerAgent: PlannerAgent | null = null;
  private codegenAgent: CodegenAgent | null = null;
  private reviewAgent: ReviewAgent | null = null;
  private testBuildAgent: TestBuildAgent | null = null;
  private rollbackAgent: RollbackAgent | null = null;

  // 초기화 — 서버 시작 시 호출
  initialize(): void {
    // SQLite 감사 로그 저장소
    const dbPath = process.env["AUDIT_DB_PATH"] ?? "./data/jarvis-audit.db";
    this.ensureDirectory(dbPath);
    this.auditStore = new AuditStore(dbPath);

    // Claude API 클라이언트 (옵셔널 — 키 없으면 스텁 모드)
    const apiKey = process.env["ANTHROPIC_API_KEY"];
    if (apiKey && apiKey !== "sk-ant-v2-YOUR-API-KEY-HERE") {
      this.claudeClient = new Anthropic({ apiKey });
      console.log("  ✓ Claude API 클라이언트 초기화 완료");
    } else {
      console.log("  ⚠ ANTHROPIC_API_KEY 미설정 — Phase 0 스텁 모드");
    }

    // Spec 에이전트 인스턴스 생성
    const auditLogger = createAuditAdapter(this.auditStore);
    const policyEngine = createPolicyAdapter();

    const specConfig: BaseAgentConfig = {
      agentId: "agt_spec_001",
      agentRole: "spec",
      model: "claude-haiku-4-5-20251001",
      tools: ["Read", "Grep", "Glob"],
      disallowedTools: ["Edit", "Write", "Bash"],
      permissionMode: "observe",
      maxTurns: 5,
      timeoutMs: 30_000,
    };

    const deps: BaseAgentDependencies = {
      auditLogger,
      policyEngine,
      // Anthropic SDK 버전 차이 무시 — 런타임에서 동일 인스턴스 사용
      claudeClient: this.claudeClient as BaseAgentDependencies["claudeClient"],
    };

    this.specAgent = new SpecAgent(specConfig, deps);

    // Planner 에이전트 — 작업 분해 및 Task DAG 생성
    this.plannerAgent = new PlannerAgent({
      ...specConfig,
      agentId: "agt_planner_001",
      agentRole: "planner",
      model: "claude-sonnet-4-6",
      tools: ["Read", "Grep", "Glob"],
      disallowedTools: ["Edit", "Write", "Bash"],
      permissionMode: "observe",
      maxTurns: 5,
      timeoutMs: 60_000,
    }, deps);

    // Codegen 에이전트 — 코드 생성, ChangeSet 생성
    this.codegenAgent = new CodegenAgent({
      ...specConfig,
      agentId: "agt_codegen_001",
      agentRole: "codegen",
      model: "claude-sonnet-4-6",
      tools: ["Read", "Grep", "Glob", "Edit", "Write"],
      disallowedTools: ["Bash"],
      permissionMode: "suggest",
      maxTurns: 10,
      timeoutMs: 120_000,
    }, deps);

    // Review 에이전트 — 보안/품질 검토
    this.reviewAgent = new ReviewAgent({
      ...specConfig,
      agentId: "agt_review_001",
      agentRole: "review",
      model: "claude-sonnet-4-6",
      tools: ["Read", "Grep", "Glob"],
      disallowedTools: ["Edit", "Write", "Bash"],
      permissionMode: "observe",
      maxTurns: 5,
      timeoutMs: 60_000,
    }, deps);

    // TestBuild 에이전트 — 빌드/테스트 검증
    this.testBuildAgent = new TestBuildAgent({
      ...specConfig,
      agentId: "agt_testbuild_001",
      agentRole: "test",
      model: "claude-haiku-4-5-20251001",
      tools: ["Read", "Bash", "Grep", "Glob"],
      disallowedTools: ["Edit", "Write"],
      permissionMode: "observe",
      maxTurns: 5,
      timeoutMs: 120_000,
    }, deps);

    // Rollback 에이전트 — 에러 복구 및 Postmortem
    this.rollbackAgent = new RollbackAgent({
      ...specConfig,
      agentId: "agt_rollback_001",
      agentRole: "rollback",
      model: "claude-haiku-4-5-20251001",
      tools: ["Read", "Bash", "Grep", "Glob"],
      disallowedTools: ["Edit", "Write"],
      permissionMode: "observe",
      maxTurns: 5,
      timeoutMs: 60_000,
    }, deps);

    console.log("  ✓ JarvisRuntime 초기화 완료 (7 에이전트 준비)");
  }

  // 디렉토리 존재 보장
  private ensureDirectory(filePath: string): void {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const fs = require("node:fs") as typeof import("node:fs");
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const path = require("node:path") as typeof import("node:path");
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
  }

  // 새 런 시작 — HTTP 응답 즉시 반환, 파이프라인은 백그라운드 실행
  startRun(rawInput: string, sessionId: string, trustMode: string): string {
    // 이전 런 중단
    if (this.activeRun) {
      this.stopActiveRun("새 런 시작으로 이전 런 중단");
    }

    const runId = `run_${randomUUID().slice(0, 12)}`;

    // XState 액터 생성
    const actor = createActor(jarvisMachine, {
      input: { runId, sessionId },
    });

    // 상태 전이 구독 → SSE 브로드캐스트
    actor.subscribe((snapshot: { value: unknown; context: unknown }) => {
      const state = String(snapshot.value);
      const ctx = snapshot.context as JarvisMachineContext;

      sseEmitter.broadcast("RUN_STATUS_CHANGED", {
        runId,
        state,
        currentAgent: ctx.currentAgent,
        timestamp: new Date().toISOString(),
      });
    });

    actor.start();

    this.activeRun = {
      runId,
      sessionId,
      trustMode,
      startedAt: new Date().toISOString(),
      actor,
    };

    // USER_REQUEST 이벤트로 파이프라인 시작
    actor.send({ type: "USER_REQUEST", input: rawInput });

    // 비동기 파이프라인 실행 (백그라운드)
    void this.runPipeline(runId, rawInput, sessionId, trustMode, actor);

    return runId;
  }

  // 파이프라인 실행 — SPEC → POLICY → (GATE) → PLAN → CODE → REVIEW → (GATE L2) → TEST → COMPLETED
  private async runPipeline(
    runId: string,
    rawInput: string,
    sessionId: string,
    trustMode: string,
    actor: AnyActorRef,
  ): Promise<void> {
    const execCtx = {
      runId,
      sessionId,
      userId: "user_001",
      trustMode: trustMode as "observe" | "suggest" | "semi-auto" | "full-auto",
    };

    try {
      // ─── 1단계: SPEC_ANALYSIS ───────────────────────────────
      if (!this.specAgent) {
        actor.send({ type: "ERROR", error: createError("INTERNAL_ERROR", "Spec 에이전트 미초기화") });
        return;
      }

      const specStartedAt = new Date().toISOString();
      sseEmitter.broadcast("NODE_UPDATED", {
        runId,
        node: buildTimelineNode("SPEC", "RUNNING", "요구사항 분석", "spec-agent", null, { startedAt: specStartedAt }),
      });

      const specResult = await this.specAgent.execute(
        { rawInput, context: execCtx },
        execCtx,
      );

      if (!specResult.ok) {
        actor.send({ type: "ERROR", error: specResult.error });
        sseEmitter.broadcast("NODE_UPDATED", {
          runId,
          node: buildTimelineNode("SPEC", "FAILED", "요구사항 분석", "spec-agent", specResult.error.message, { startedAt: specStartedAt }),
        });
        this.broadcastChatMessage(runId, `분석 실패: ${specResult.error.message}`);
        return;
      }

      const specOutput = specResult.value;

      // Spec 결과를 SpecRef로 변환
      const specRef: SpecRef = {
        specId: specOutput.specId,
        rawInput,
        interpretation: specOutput.interpretation,
        clarifications: specOutput.clarifications,
      };

      actor.send({ type: "SPEC_COMPLETE", spec: specRef });

      sseEmitter.broadcast("NODE_UPDATED", {
        runId,
        node: buildTimelineNode("SPEC", "DONE", "요구사항 분석", "spec-agent", specOutput.interpretation, { startedAt: specStartedAt }),
      });

      // ─── 2단계: POLICY_CHECK ───────────────────────────────
      const policyStartedAt = new Date().toISOString();
      sseEmitter.broadcast("NODE_UPDATED", {
        runId,
        node: buildTimelineNode("POLICY", "RUNNING", "정책 판정", "policy-risk", null, { startedAt: policyStartedAt }),
      });

      const policyResult = evaluate(
        { userId: "user_001", role: "Owner", device: "desktop", sessionId },
        {
          rawInput,
          intent: specOutput.intent,
          targets: specOutput.targets,
          requiresWebAccess: specOutput.requiresWebAccess,
          requiresLogin: specOutput.requiresLogin,
        },
      );

      if (!policyResult.ok) {
        actor.send({ type: "ERROR", error: policyResult.error });
        sseEmitter.broadcast("NODE_UPDATED", {
          runId,
          node: buildTimelineNode("POLICY", "FAILED", "정책 판정", "policy-risk", policyResult.error.message, { startedAt: policyStartedAt }),
        });
        this.broadcastChatMessage(runId, `정책 판정 실패: ${policyResult.error.message}`);
        return;
      }

      const decision = policyResult.value;
      const outcomeRiskScore = decision.outcome.riskScore;
      const outcomeRiskLevel = decision.outcome.riskLevel;

      sseEmitter.broadcast("NODE_UPDATED", {
        runId,
        node: buildTimelineNode("POLICY", "DONE", "정책 판정", "policy-risk",
          `${decision.outcome.status} (위험도: ${outcomeRiskLevel})`,
          { startedAt: policyStartedAt, riskScore: outcomeRiskScore, riskLevel: outcomeRiskLevel },
        ),
      });

      sseEmitter.broadcast("RISK_UPDATED", {
        runId,
        riskScore: outcomeRiskScore,
        riskLevel: outcomeRiskLevel,
      });

      // 정책 판정 결과에 따라 분기
      const policyStatus = decision.outcome.status;

      if (policyStatus === "DENY") {
        actor.send({ type: "DENY", decision });
        this.broadcastChatMessage(runId, `정책 거부: ${decision.outcome.humanExplanation}`);
        return;
      }

      // APPROVAL_REQUIRED — Gate L1 대기
      if (policyStatus === "APPROVAL_REQUIRED") {
        actor.send({ type: "APPROVAL_REQUIRED", decision });

        const gateId = gateResolver.createGateId();
        const gate = {
          gateId,
          gateLevel: "L1",
          runId,
          what: specOutput.interpretation,
          why: decision.outcome.humanExplanation,
          riskScore: outcomeRiskScore,
          riskLevel: outcomeRiskLevel,
          status: "PENDING",
          createdAt: new Date().toISOString(),
        };

        registerGate(gate);

        sseEmitter.broadcast("NODE_UPDATED", {
          runId,
          node: buildTimelineNode("GATE", "WAITING_GATE", "승인 대기 (L1)", null,
            decision.outcome.humanExplanation,
            { riskScore: outcomeRiskScore, riskLevel: outcomeRiskLevel, gateId },
          ),
        });
        sseEmitter.broadcast("GATE_OPENED", { gate });

        this.broadcastChatMessage(
          runId,
          `[승인 필요] ${specOutput.interpretation}\n\n` +
          `위험도: ${outcomeRiskLevel} (${outcomeRiskScore}점)\n` +
          `사유: ${decision.outcome.humanExplanation}\n\n` +
          `게이트 UI에서 승인 또는 거부해주세요.`,
        );

        try {
          const resolution = await gateResolver.waitForGate(gateId);
          if (resolution.action !== "APPROVE") {
            actor.send({ type: "REJECTED", reason: resolution.reason ?? "사용자 거부" });
            this.broadcastChatMessage(runId, `게이트 거부됨: ${resolution.reason ?? "사용자가 거부했습니다"}`);
            return;
          }
          actor.send({
            type: "APPROVED",
            approval: {
              gateId,
              gateLevel: "L1" as const,
              approvedBy: "USER",
              approvedAt: new Date().toISOString(),
              scopeModifications: [],
            },
          });
          this.broadcastChatMessage(runId, `Gate L1 승인 — 계획 수립 진행.`);
        } catch {
          actor.send({ type: "TIMEOUT" });
          this.broadcastChatMessage(runId, `게이트 타임아웃 — 요청이 거부되었습니다.`);
          return;
        }
      } else {
        // ALLOW / CONSTRAINED_ALLOW — 바로 PLANNING으로 진행
        actor.send({ type: policyStatus, decision });
        this.broadcastChatMessage(
          runId,
          `[정책 통과] ${policyStatus} (위험도: ${outcomeRiskLevel}, 점수: ${outcomeRiskScore})`,
        );
      }

      // ─── 3단계: PLANNING ───────────────────────────────────
      if (!this.plannerAgent) {
        actor.send({ type: "ERROR", error: createError("INTERNAL_ERROR", "Planner 에이전트 미초기화") });
        return;
      }

      const planStartedAt = new Date().toISOString();
      sseEmitter.broadcast("NODE_UPDATED", {
        runId,
        node: buildTimelineNode("PLAN", "RUNNING", "실행 계획 수립", "planner", null, { startedAt: planStartedAt }),
      });

      const planResult = await this.plannerAgent.execute(
        {
          specOutput: {
            specId: specOutput.specId,
            interpretation: specOutput.interpretation,
            intent: specOutput.intent,
            targets: specOutput.targets,
            requiresWebAccess: specOutput.requiresWebAccess,
            requiresLogin: specOutput.requiresLogin,
            clarifications: specOutput.clarifications,
            ambiguities: specOutput.ambiguities,
          },
          policyDecisionId: decision.decisionId,
          context: execCtx,
        },
        execCtx,
      );

      if (!planResult.ok) {
        actor.send({ type: "ERROR", error: planResult.error });
        sseEmitter.broadcast("NODE_UPDATED", {
          runId,
          node: buildTimelineNode("PLAN", "FAILED", "실행 계획 수립", "planner", planResult.error.message, { startedAt: planStartedAt }),
        });
        this.broadcastChatMessage(runId, `계획 수립 실패: ${planResult.error.message}`);
        return;
      }

      const planOutput: PlannerOutput = planResult.value;

      // PlanRef로 변환하여 XState에 전달
      const planRef: PlanRef = {
        planId: planOutput.planId,
        steps: planOutput.steps.map(s => ({
          stepId: s.stepId,
          description: s.description,
          agent: s.agent as PlanRef["steps"][number]["agent"],
          dependsOn: s.dependsOn,
          status: "pending" as const,
        })),
        estimatedDurationMs: planOutput.estimatedTotalMs,
      };

      actor.send({ type: "PLAN_COMPLETE", plan: planRef });

      sseEmitter.broadcast("NODE_UPDATED", {
        runId,
        node: buildTimelineNode("PLAN", "DONE", "실행 계획 수립", "planner",
          `${planOutput.steps.length}개 단계, 예상 ${Math.round(planOutput.estimatedTotalMs / 1000)}초`,
          { startedAt: planStartedAt },
        ),
      });

      this.broadcastChatMessage(
        runId,
        `[계획 완료] ${planOutput.steps.length}개 단계 생성\n` +
        planOutput.steps.map(s => `  ${s.stepId}: ${s.description} (${s.agent})`).join("\n"),
      );

      // ─── 4단계: CODE_GENERATION ────────────────────────────
      if (!this.codegenAgent) {
        actor.send({ type: "ERROR", error: createError("INTERNAL_ERROR", "Codegen 에이전트 미초기화") });
        return;
      }

      const codeStartedAt = new Date().toISOString();
      sseEmitter.broadcast("NODE_UPDATED", {
        runId,
        node: buildTimelineNode("CODEGEN", "RUNNING", "코드 생성", "codegen", null, { startedAt: codeStartedAt }),
      });

      // Plan의 CODE_GENERATE 단계별로 Codegen 에이전트 호출
      const codegenSteps = planOutput.steps.filter(s => s.type === "CODE_GENERATE");
      const changeSets: CodegenOutput[] = [];

      for (const step of codegenSteps) {
        const codeResult = await this.codegenAgent.execute(
          {
            planStep: { stepId: step.stepId, description: step.description, outputs: [] },
            specOutput: {
              specId: specOutput.specId,
              interpretation: specOutput.interpretation,
              intent: specOutput.intent,
              targets: specOutput.targets,
              requiresWebAccess: specOutput.requiresWebAccess,
              requiresLogin: specOutput.requiresLogin,
              clarifications: specOutput.clarifications,
              ambiguities: specOutput.ambiguities,
            },
            context: execCtx,
          },
          execCtx,
        );

        if (!codeResult.ok) {
          actor.send({ type: "ERROR", error: codeResult.error });
          sseEmitter.broadcast("NODE_UPDATED", {
            runId,
            node: buildTimelineNode("CODEGEN", "FAILED", "코드 생성", "codegen", codeResult.error.message, { startedAt: codeStartedAt }),
          });
          this.broadcastChatMessage(runId, `코드 생성 실패 (${step.stepId}): ${codeResult.error.message}`);
          return;
        }

        changeSets.push(codeResult.value);
      }

      // CODE_GENERATE 단계가 없으면 빈 ChangeSet 생성
      const mergedChangeSet: CodegenOutput = changeSets.length > 0
        ? changeSets[changeSets.length - 1]!
        : {
          changeSetId: `cs_${randomUUID().slice(0, 8)}`,
          planRef: planOutput.planId,
          stepRef: "none",
          filesAdded: [],
          filesModified: [],
          securitySelfCheck: { secretsFound: false, injectionRisk: false, pathTraversalRisk: false },
        };

      // ChangeSetRef로 변환
      const changeSetRef: ChangeSetRef = {
        changeSetId: mergedChangeSet.changeSetId,
        files: [
          ...mergedChangeSet.filesAdded.map(f => ({ filePath: f.path, operation: "create" as const, diff: f.content })),
          ...mergedChangeSet.filesModified.map(f => ({ filePath: f.path, operation: "modify" as const, diff: f.diff })),
        ],
        summary: `파일 추가 ${mergedChangeSet.filesAdded.length}개, 수정 ${mergedChangeSet.filesModified.length}개`,
      };

      actor.send({ type: "CODE_COMPLETE", changeSet: changeSetRef });

      sseEmitter.broadcast("NODE_UPDATED", {
        runId,
        node: buildTimelineNode("CODEGEN", "DONE", "코드 생성", "codegen",
          changeSetRef.summary,
          { startedAt: codeStartedAt, isUndoPoint: true },
        ),
      });

      this.broadcastChatMessage(runId, `[코드 생성 완료] ${changeSetRef.summary}`);

      // ─── 5단계: CODE_REVIEW ────────────────────────────────
      if (!this.reviewAgent) {
        actor.send({ type: "ERROR", error: createError("INTERNAL_ERROR", "Review 에이전트 미초기화") });
        return;
      }

      const reviewStartedAt = new Date().toISOString();
      sseEmitter.broadcast("NODE_UPDATED", {
        runId,
        node: buildTimelineNode("REVIEW", "RUNNING", "코드 리뷰", "review", null, { startedAt: reviewStartedAt }),
      });

      const reviewResult = await this.reviewAgent.execute(
        {
          changeSet: mergedChangeSet,
          context: execCtx,
          policyDecisionId: decision.decisionId,
        },
        execCtx,
      );

      if (!reviewResult.ok) {
        actor.send({ type: "ERROR", error: reviewResult.error });
        sseEmitter.broadcast("NODE_UPDATED", {
          runId,
          node: buildTimelineNode("REVIEW", "FAILED", "코드 리뷰", "review", reviewResult.error.message, { startedAt: reviewStartedAt }),
        });
        this.broadcastChatMessage(runId, `코드 리뷰 실패: ${reviewResult.error.message}`);
        return;
      }

      const reviewOutput: ReviewOutput = reviewResult.value;

      // ReviewRef로 변환
      const reviewRef: ReviewRef = {
        reviewId: reviewOutput.reviewId,
        passed: reviewOutput.passed,
        blockers: reviewOutput.blockers.map(b => ({
          id: `blk_${randomUUID().slice(0, 6)}`,
          severity: b.severity,
          category: "security" as const,
          description: b.issue,
          filePath: b.file,
          suggestion: null,
        })),
        warnings: reviewOutput.warnings.map(w => ({
          id: `wrn_${randomUUID().slice(0, 6)}`,
          severity: "low" as const,
          category: "quality" as const,
          description: w,
          filePath: null,
          suggestion: null,
        })),
      };

      if (!reviewOutput.passed) {
        // 블로커 발견 — REVIEW_BLOCKERS 이벤트 전송
        actor.send({ type: "REVIEW_BLOCKERS", review: reviewRef });
        sseEmitter.broadcast("NODE_UPDATED", {
          runId,
          node: buildTimelineNode("REVIEW", "FAILED", "코드 리뷰", "review",
            `블로커 ${reviewOutput.blockers.length}건 발견`,
            { startedAt: reviewStartedAt },
          ),
        });
        this.broadcastChatMessage(
          runId,
          `[리뷰 실패] 블로커 ${reviewOutput.blockers.length}건:\n` +
          reviewOutput.blockers.map(b => `  - [${b.severity}] ${b.file}: ${b.issue}`).join("\n"),
        );
        return;
      }

      actor.send({ type: "REVIEW_PASS", review: reviewRef });

      sseEmitter.broadcast("NODE_UPDATED", {
        runId,
        node: buildTimelineNode("REVIEW", "DONE", "코드 리뷰", "review",
          `통과 (경고 ${reviewOutput.warnings.length}건)`,
          { startedAt: reviewStartedAt },
        ),
      });

      this.broadcastChatMessage(runId, `[리뷰 통과] 보안/품질 검토 완료 (경고 ${reviewOutput.warnings.length}건)`);

      // ─── 6단계: GATE_APPLY_CHANGES (Gate L2) ───────────────
      const gateL2Id = gateResolver.createGateId();
      const gateL2 = {
        gateId: gateL2Id,
        gateLevel: "L2",
        runId,
        what: "코드 변경 적용",
        why: `ChangeSet ${mergedChangeSet.changeSetId}: ${changeSetRef.summary}`,
        riskScore: outcomeRiskScore,
        riskLevel: outcomeRiskLevel,
        status: "PENDING",
        createdAt: new Date().toISOString(),
        securitySelfCheck: mergedChangeSet.securitySelfCheck,
        filesAdded: mergedChangeSet.filesAdded.length,
        filesModified: mergedChangeSet.filesModified.length,
      };

      registerGate(gateL2);

      sseEmitter.broadcast("NODE_UPDATED", {
        runId,
        node: buildTimelineNode("GATE", "WAITING_GATE", "변경 적용 승인 (L2)", null,
          `${changeSetRef.summary}`,
          { riskScore: outcomeRiskScore, riskLevel: outcomeRiskLevel, gateId: gateL2Id },
        ),
      });
      sseEmitter.broadcast("GATE_OPENED", { gate: gateL2 });

      this.broadcastChatMessage(
        runId,
        `[승인 필요 — Gate L2] 코드 변경 적용\n\n` +
        `변경: ${changeSetRef.summary}\n` +
        `보안 자가검사: secrets=${mergedChangeSet.securitySelfCheck.secretsFound}, injection=${mergedChangeSet.securitySelfCheck.injectionRisk}, traversal=${mergedChangeSet.securitySelfCheck.pathTraversalRisk}\n\n` +
        `게이트 UI에서 승인 또는 거부해주세요.`,
      );

      // Gate L2 대기
      try {
        const gateL2Resolution = await gateResolver.waitForGate(gateL2Id);
        if (gateL2Resolution.action !== "APPROVE") {
          actor.send({ type: "REJECTED", reason: gateL2Resolution.reason ?? "사용자 거부 (L2)" });
          this.broadcastChatMessage(runId, `Gate L2 거부됨: ${gateL2Resolution.reason ?? "사용자가 거부했습니다"}`);
          return;
        }
        actor.send({
          type: "APPROVED",
          approval: {
            gateId: gateL2Id,
            gateLevel: "L2" as const,
            approvedBy: "USER",
            approvedAt: new Date().toISOString(),
            scopeModifications: [],
          },
        });
        this.broadcastChatMessage(runId, `Gate L2 승인 — 변경 적용 및 테스트 진행.`);
      } catch {
        actor.send({ type: "TIMEOUT" });
        this.broadcastChatMessage(runId, `Gate L2 타임아웃 — 요청이 거부되었습니다.`);
        return;
      }

      // APPLY_CHANGES는 Phase 3에서 Executor가 실제 적용 — 지금은 바로 성공 처리
      actor.send({ type: "APPLY_SUCCESS" });

      // ─── 7단계: TESTING ────────────────────────────────────
      if (!this.testBuildAgent) {
        actor.send({ type: "ERROR", error: createError("INTERNAL_ERROR", "TestBuild 에이전트 미초기화") });
        return;
      }

      const testStartedAt = new Date().toISOString();
      sseEmitter.broadcast("NODE_UPDATED", {
        runId,
        node: buildTimelineNode("TEST", "RUNNING", "테스트 실행", "test-build", null, { startedAt: testStartedAt }),
      });

      const testResult = await this.testBuildAgent.execute(
        {
          changeSetId: mergedChangeSet.changeSetId,
          reviewId: reviewOutput.reviewId,
          context: execCtx,
        },
        execCtx,
      );

      if (!testResult.ok) {
        actor.send({ type: "ERROR", error: testResult.error });
        sseEmitter.broadcast("NODE_UPDATED", {
          runId,
          node: buildTimelineNode("TEST", "FAILED", "테스트 실행", "test-build", testResult.error.message, { startedAt: testStartedAt }),
        });
        this.broadcastChatMessage(runId, `테스트 실행 실패: ${testResult.error.message}`);
        return;
      }

      const testOutput: TestBuildOutput = testResult.value;

      // TestResultRef로 변환
      const testResultRef: TestResultRef = {
        testRunId: testOutput.testRunId,
        passed: testOutput.testsPassed,
        totalTests: testOutput.totalTests,
        failedTests: testOutput.failedTests,
        coveragePercent: testOutput.coveragePercent,
      };

      if (!testOutput.testsPassed || !testOutput.buildPassed) {
        actor.send({ type: "TEST_FAIL", result: testResultRef });
        sseEmitter.broadcast("NODE_UPDATED", {
          runId,
          node: buildTimelineNode("TEST", "FAILED", "테스트 실행", "test-build",
            `실패 — ${testOutput.failedTests}/${testOutput.totalTests} 테스트 실패`,
            { startedAt: testStartedAt },
          ),
        });
        this.broadcastChatMessage(
          runId,
          `[테스트 실패] ${testOutput.failedTests}/${testOutput.totalTests} 실패\n` +
          (testOutput.errors.length > 0 ? `에러: ${testOutput.errors.join(", ")}` : ""),
        );
        return;
      }

      actor.send({ type: "TEST_PASS", result: testResultRef });

      sseEmitter.broadcast("NODE_UPDATED", {
        runId,
        node: buildTimelineNode("TEST", "DONE", "테스트 실행", "test-build",
          `통과 — ${testOutput.totalTests}개 테스트, 커버리지 ${testOutput.coveragePercent}%`,
          { startedAt: testStartedAt },
        ),
      });

      this.broadcastChatMessage(
        runId,
        `[테스트 통과] ${testOutput.totalTests}개 테스트 통과, 커버리지 ${testOutput.coveragePercent}%, 소요 ${testOutput.durationMs}ms`,
      );

      // ─── 8단계: COMPLETED ──────────────────────────────────
      // Phase 2에서는 배포(Gate L3)를 스킵하고 바로 완료 처리
      actor.send({ type: "SKIPPED" });

      sseEmitter.broadcast("NODE_UPDATED", {
        runId,
        node: buildTimelineNode("DEPLOY", "SKIPPED", "배포", "executor", "Phase 2 — 배포 스킵"),
      });

      this.broadcastChatMessage(
        runId,
        `[파이프라인 완료] 전체 흐름 성공\n\n` +
        `SPEC → POLICY → PLAN (${planOutput.steps.length}단계) → CODE → REVIEW → TEST → COMPLETE\n` +
        `Plan: ${planOutput.planId}\n` +
        `ChangeSet: ${mergedChangeSet.changeSetId}\n` +
        `Review: ${reviewOutput.reviewId} (통과)\n` +
        `Test: ${testOutput.testRunId} (${testOutput.totalTests}개 통과)`,
      );

      // 활성 런 정리
      this.activeRun = null;

    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);

      // 에러 복구 시도 — RollbackAgent
      if (this.rollbackAgent) {
        sseEmitter.broadcast("NODE_UPDATED", {
          runId,
          node: buildTimelineNode("ROLLBACK", "RUNNING", "에러 복구", "rollback", errorMsg),
        });

        const rollbackResult = await this.rollbackAgent.execute(
          { runId, reason: errorMsg, context: execCtx },
          execCtx,
        ).catch(() => null);

        if (rollbackResult && rollbackResult.ok) {
          actor.send({ type: "RECOVERY_SUCCESS" });
          sseEmitter.broadcast("NODE_UPDATED", {
            runId,
            node: buildTimelineNode("ROLLBACK", "DONE", "에러 복구", "rollback",
              `복구 완료 — ${rollbackResult.value.revertedActions.length}개 액션 되돌림`,
            ),
          });
          this.broadcastChatMessage(
            runId,
            `[에러 복구 완료] ${rollbackResult.value.postmortem}`,
          );
          return;
        }

        // 복구 실패 — EMERGENCY_STOP
        actor.send({
          type: "RECOVERY_FAILED",
          error: createError("INTERNAL_ERROR", `복구 실패: ${errorMsg}`),
        });
        sseEmitter.broadcast("NODE_UPDATED", {
          runId,
          node: buildTimelineNode("ROLLBACK", "FAILED", "에러 복구", "rollback", "복구 실패 — 긴급 중단"),
        });
      } else {
        actor.send({
          type: "ERROR",
          error: createError("INTERNAL_ERROR", `파이프라인 오류: ${errorMsg}`),
        });
      }

      this.broadcastChatMessage(runId, `오류 발생: ${errorMsg}`);
    }
  }

  // JARVIS 채팅 메시지 브로드캐스트 헬퍼
  private broadcastChatMessage(runId: string, content: string): void {
    const msg = {
      messageId: randomUUID(),
      role: "JARVIS" as const,
      content,
      timestamp: new Date().toISOString(),
      runId,
      contextBadge: "COMPLETED" as const,
      isVoice: false,
    };
    sseEmitter.broadcast("CHAT_MESSAGE_ADDED", { message: msg });
  }

  // 활성 런 중단
  stopActiveRun(reason: string): void {
    if (!this.activeRun) return;

    gateResolver.rejectAll(reason);

    try {
      this.activeRun.actor.stop();
    } catch {
      // 이미 종료된 액터 무시
    }

    this.activeRun = null;
  }

  // 긴급 정지
  emergencyStop(reason: string): void {
    this.stopActiveRun(`비상 정지: ${reason}`);
    sseEmitter.broadcast("EMERGENCY_STOPPED", {
      reason,
      stoppedAt: new Date().toISOString(),
    });
  }

  // 활성 런 조회
  getActiveRun(): ActiveRun | null {
    return this.activeRun;
  }

  // XState 현재 상태 조회
  getCurrentState(): string {
    if (!this.activeRun) return "IDLE";
    try {
      const snapshot = this.activeRun.actor.getSnapshot();
      return String(snapshot.value);
    } catch {
      return "IDLE";
    }
  }

  // XState 컨텍스트 조회
  getContext(): JarvisMachineContext | null {
    if (!this.activeRun) return null;
    try {
      const snapshot = this.activeRun.actor.getSnapshot();
      return snapshot.context as JarvisMachineContext;
    } catch {
      return null;
    }
  }

  // 대기 중 게이트 수
  getPendingGatesCount(): number {
    return gateResolver.pendingCount;
  }

  // 감사 로그 저장소 접근
  getAuditStore(): AuditStore | null {
    return this.auditStore;
  }

  // 종료 정리
  shutdown(): void {
    this.stopActiveRun("서버 종료");
    this.auditStore?.close();
  }
}

// 싱글톤 인스턴스
export const jarvisRuntime = new JarvisRuntime();
