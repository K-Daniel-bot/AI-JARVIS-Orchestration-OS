// Spec 에이전트 — 사용자 의도 분석, 요구사항 명세 생성
import { randomUUID } from "node:crypto";
import type { Result, JarvisError, CapabilityToken } from "@jarvis/shared";
import { ok, err } from "@jarvis/shared";
import { BaseAgent } from "../base-agent.js";
import type { AgentExecutionContext } from "../types/agent-config.js";
import {
  SpecInputSchema,
  SpecOutputSchema,
  type SpecInput,
  type SpecOutput,
} from "../types/agent-io.js";

// Spec 에이전트 시스템 프롬프트 — 의도 분석 역할 정의
const SPEC_SYSTEM_PROMPT = `당신은 JARVIS Orchestration OS의 Spec 에이전트입니다.
사용자의 원시 입력을 분석하여 구조화된 요구사항 명세(JSON)를 생성합니다.

## 절대 규칙
- 계약서(contract.md)가 모든 판단보다 우선합니다
- 모호한 요청에는 clarifications 배열에 질문을 추가합니다
- 위험한 작업(시스템 파일 삭제, 인증정보 접근 등)은 ambiguities에 경고를 추가합니다

## 의도 유형
- CODE_IMPLEMENTATION: 코드 작성/수정
- FILE_OPERATION: 파일/디렉토리 조작
- APP_LAUNCH: 앱 실행
- WEB_ACCESS: 웹 접근
- SYSTEM_CONFIG: 시스템 설정 변경
- PACKAGE_INSTALL: 패키지 설치
- NETWORK_REQUEST: 네트워크 요청
- PROCESS_MANAGEMENT: 프로세스 관리
- MOBILE_ACTION: 모바일 작업

## 응답 형식
반드시 다음 JSON 형식으로만 응답하세요:
\`\`\`json
{
  "specId": "spec_<8자리UUID>",
  "interpretation": "사용자 요청에 대한 상세 해석",
  "intent": "<의도 유형>",
  "targets": ["대상1", "대상2"],
  "requiresWebAccess": false,
  "requiresLogin": false,
  "clarifications": [],
  "ambiguities": []
}
\`\`\``;

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

    const { rawInput, clarificationHistory } = validationResult.value;

    // 2. Claude API 호출 또는 Phase 0 스텁 폴백
    let output: SpecOutput;

    if (this.deps.claudeClient) {
      // Phase 1: Claude API로 실제 의도 분석
      const userMessage = clarificationHistory && clarificationHistory.length > 0
        ? `사용자 요청: ${rawInput}\n\n이전 대화:\n${clarificationHistory.join("\n")}`
        : `사용자 요청: ${rawInput}`;

      const claudeResult = await this.callClaudeWithJson(
        SPEC_SYSTEM_PROMPT,
        userMessage,
        SpecOutputSchema,
      );

      if (!claudeResult.ok) {
        // Claude 실패 시 Phase 0 스텁으로 폴백
        console.warn(`[SpecAgent] Claude API 실패, 스텁 폴백: ${claudeResult.error.message}`);
        output = this.buildStubOutput(rawInput);
      } else {
        output = claudeResult.value;
      }
    } else {
      // Phase 0 스텁 — claudeClient 미주입
      output = this.buildStubOutput(rawInput);
    }

    // 3. 감사 로그 기록
    const auditResult = await this.logAudit(
      context,
      `Spec 에이전트 실행: 의도=${output.intent}`,
      "COMPLETED",
      { intent: output.intent, targetsCount: output.targets.length, usedClaude: !!this.deps.claudeClient },
    );
    if (!auditResult.ok) {
      console.warn(`[SpecAgent] 감사 로그 기록 실패: ${auditResult.error.message}`);
    }

    return ok(output);
  }

  // Phase 0 스텁 출력 생성 — Claude 미사용 시 키워드 기반 분석
  private buildStubOutput(rawInput: string): SpecOutput {
    return {
      specId: `spec_${randomUUID().slice(0, 8)}`,
      interpretation: `사용자 요청 분석: ${rawInput.slice(0, 100)}`,
      intent: this.inferIntent(rawInput),
      targets: this.extractTargets(rawInput),
      requiresWebAccess: rawInput.toLowerCase().includes("web") || rawInput.toLowerCase().includes("http"),
      requiresLogin: rawInput.toLowerCase().includes("login") || rawInput.toLowerCase().includes("auth"),
      clarifications: [],
      ambiguities: [],
    };
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
