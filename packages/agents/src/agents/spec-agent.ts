// Spec 에이전트 — 사용자 의도 분석, 요구사항 명세 생성
import { randomUUID } from "node:crypto";
import type { Result, JarvisError, CapabilityToken } from "@jarvis/shared";
import { ok, err } from "@jarvis/shared";
import { BaseAgent } from "../base-agent.js";
import type { AgentExecutionContext } from "../types/agent-config.js";
import {
  SpecInputSchema,
  type SpecInput,
  type SpecOutput,
} from "../types/agent-io.js";

// Spec 에이전트 — 사용자 원시 입력을 구조화된 요구사항 명세로 변환
export class SpecAgent extends BaseAgent {
  // 입력 검증 → 의도 분석 → 명세 생성 → 감사 로그 기록
  override async execute(
    input: unknown,
    context: AgentExecutionContext,
    _capabilityToken?: CapabilityToken,
  ): Promise<Result<SpecOutput, JarvisError>> {
    // 1. 입력 검증
    const validationResult = this.validateInput<SpecInput>(
      input,
      SpecInputSchema,
    );
    if (!validationResult.ok) {
      return err(validationResult.error);
    }

    const { rawInput } = validationResult.value;

    // 2. Phase 0 스텁 — 의도 분류 (실제 Claude API 호출은 Phase 1에서 구현)
    const intent = this.inferIntent(rawInput);
    const targets = this.extractTargets(rawInput);

    const output: SpecOutput = {
      specId: `spec_${randomUUID().slice(0, 8)}`,
      interpretation: `사용자 요청 분석: ${rawInput.slice(0, 100)}`,
      intent,
      targets,
      requiresWebAccess: rawInput.toLowerCase().includes("web") || rawInput.toLowerCase().includes("http"),
      requiresLogin: rawInput.toLowerCase().includes("login") || rawInput.toLowerCase().includes("auth"),
      clarifications: [],
      ambiguities: [],
    };

    // 3. 감사 로그 기록
    const auditResult = await this.logAudit(
      context,
      `Spec 에이전트 실행: 의도=${intent}`,
      "COMPLETED",
      { intent, targetsCount: targets.length },
    );
    if (!auditResult.ok) {
      console.warn(`[SpecAgent] 감사 로그 기록 실패: ${auditResult.error.message}`);
    }

    return ok(output);
  }

  // 입력 키워드 기반 의도 분류 — Phase 0 휴리스틱
  private inferIntent(input: string): SpecOutput["intent"] {
    const lower = input.toLowerCase();

    if (lower.includes("install") || lower.includes("package") || lower.includes("npm")) {
      return "PACKAGE_INSTALL";
    }
    if (lower.includes("http") || lower.includes("url") || lower.includes("api") || lower.includes("web")) {
      return "WEB_ACCESS";
    }
    if (lower.includes("launch") || lower.includes("open app") || lower.includes("start")) {
      return "APP_LAUNCH";
    }
    if (lower.includes("file") || lower.includes("directory") || lower.includes("folder")) {
      return "FILE_OPERATION";
    }
    if (lower.includes("config") || lower.includes("setting") || lower.includes("environment")) {
      return "SYSTEM_CONFIG";
    }
    if (lower.includes("network") || lower.includes("request") || lower.includes("fetch")) {
      return "NETWORK_REQUEST";
    }
    if (lower.includes("process") || lower.includes("kill") || lower.includes("pid")) {
      return "PROCESS_MANAGEMENT";
    }
    if (lower.includes("mobile") || lower.includes("phone") || lower.includes("sms")) {
      return "MOBILE_ACTION";
    }
    return "CODE_IMPLEMENTATION";
  }

  // 입력에서 조작 대상 추출 — Phase 0 단순 파싱
  private extractTargets(input: string): string[] {
    // 파일 경로 패턴 추출
    const pathPattern = /(?:\/[\w./\-]+|[\w]+\.(?:ts|js|json|md|tsx|jsx|py|go))/g;
    const matches = input.match(pathPattern);
    if (matches && matches.length > 0) {
      return matches.slice(0, 5);
    }
    return ["general"];
  }
}
