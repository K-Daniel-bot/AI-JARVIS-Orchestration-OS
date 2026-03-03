// JarvisRuntime — 핵심 연결 레이어. XState 액터 + 에이전트 + 감사 로그 + SSE 통합
import { randomUUID } from "node:crypto";
import { createActor, type AnyActorRef } from "xstate";
import Anthropic from "@anthropic-ai/sdk";
import { jarvisMachine } from "@jarvis/core";
import type { JarvisMachineContext } from "@jarvis/core";
import type { SpecRef } from "@jarvis/core";
import type { Result, JarvisError, AuditEntry } from "@jarvis/shared";
import { createError } from "@jarvis/shared";
import { evaluate } from "@jarvis/policy-engine";
import { AuditStore } from "@jarvis/audit";
import {
  SpecAgent,
  type BaseAgentConfig,
  type AuditLogger,
  type PolicyEvaluator,
  type BaseAgentDependencies,
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

// JarvisRuntime 클래스 — 서버의 핵심 싱글톤
class JarvisRuntime {
  private auditStore: AuditStore | null = null;
  private claudeClient: Anthropic | null = null;
  private activeRun: ActiveRun | null = null;
  private specAgent: SpecAgent | null = null;

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

    console.log("  ✓ JarvisRuntime 초기화 완료");
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

  // 파이프라인 실행 — SPEC → POLICY → (GATE) → PLAN → ... → COMPLETED
  private async runPipeline(
    runId: string,
    rawInput: string,
    sessionId: string,
    trustMode: string,
    actor: AnyActorRef,
  ): Promise<void> {
    try {
      // ─── 1단계: SPEC_ANALYSIS ───────────────────────────────
      if (!this.specAgent) {
        actor.send({ type: "ERROR", error: createError("INTERNAL_ERROR", "Spec 에이전트 미초기화") });
        return;
      }

      const specResult = await this.specAgent.execute(
        { rawInput, context: { runId, sessionId, userId: "user_001", trustMode } },
        { runId, sessionId, userId: "user_001", trustMode: trustMode as "observe" | "suggest" | "semi-auto" | "full-auto" },
      );

      if (!specResult.ok) {
        actor.send({ type: "ERROR", error: specResult.error });
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

      // SSE로 Spec 결과 브로드캐스트
      sseEmitter.broadcast("NODE_UPDATED", {
        runId,
        node: "SPEC_ANALYSIS",
        status: "completed",
        data: { intent: specOutput.intent, interpretation: specOutput.interpretation },
      });

      // ─── 2단계: POLICY_CHECK ───────────────────────────────
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
        this.broadcastChatMessage(runId, `정책 판정 실패: ${policyResult.error.message}`);
        return;
      }

      const decision = policyResult.value;
      const outcomeRiskScore = decision.outcome.riskScore;
      const outcomeRiskLevel = decision.outcome.riskLevel;

      sseEmitter.broadcast("NODE_UPDATED", {
        runId,
        node: "POLICY_CHECK",
        status: "completed",
        data: {
          status: decision.outcome.status,
          riskScore: outcomeRiskScore,
          riskLevel: outcomeRiskLevel,
        },
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

      if (policyStatus === "ALLOW" || policyStatus === "CONSTRAINED_ALLOW") {
        actor.send({ type: policyStatus, decision });
        this.broadcastChatMessage(
          runId,
          `[의도 분석 완료] ${specOutput.interpretation}\n\n` +
          `의도: ${specOutput.intent}\n` +
          `대상: ${specOutput.targets.join(", ")}\n` +
          `정책: ${policyStatus} (위험도: ${outcomeRiskLevel}, 점수: ${outcomeRiskScore})\n\n` +
          `→ 계획 수립 단계는 Phase 2에서 구현됩니다.`,
        );
        return;
      }

      if (policyStatus === "APPROVAL_REQUIRED") {
        actor.send({ type: "APPROVAL_REQUIRED", decision });

        // 게이트 등록 + SSE 알림
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
        sseEmitter.broadcast("GATE_OPENED", { gate });

        this.broadcastChatMessage(
          runId,
          `[승인 필요] ${specOutput.interpretation}\n\n` +
          `위험도: ${outcomeRiskLevel} (${outcomeRiskScore}점)\n` +
          `사유: ${decision.outcome.humanExplanation}\n\n` +
          `게이트 UI에서 승인 또는 거부해주세요.`,
        );

        // 게이트 승인 대기
        try {
          const resolution = await gateResolver.waitForGate(gateId);
          if (resolution.action === "APPROVE") {
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
            this.broadcastChatMessage(runId, `게이트 승인됨. 계획 수립 단계는 Phase 2에서 구현됩니다.`);
          } else {
            actor.send({ type: "REJECTED", reason: resolution.reason ?? "사용자 거부" });
            this.broadcastChatMessage(runId, `게이트 거부됨: ${resolution.reason ?? "사용자가 거부했습니다"}`);
          }
        } catch {
          actor.send({ type: "TIMEOUT" });
          this.broadcastChatMessage(runId, `게이트 타임아웃 — 요청이 거부되었습니다.`);
        }
        return;
      }
    } catch (e: unknown) {
      const errorMsg = e instanceof Error ? e.message : String(e);
      actor.send({
        type: "ERROR",
        error: createError("INTERNAL_ERROR", `파이프라인 오류: ${errorMsg}`),
      });
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
