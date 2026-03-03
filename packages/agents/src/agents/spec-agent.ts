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
- COMPOSITE_ACTION: 복합 작업 (여러 단계를 순차 실행)

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
  "ambiguities": [],
  "steps": [
    { "stepIndex": 0, "actionType": "app.launch", "parameters": { "appName": "notepad.exe" }, "description": "메모장 실행", "waitMs": 2000 },
    { "stepIndex": 1, "actionType": "app.focus", "parameters": { "titlePattern": "notepad" }, "description": "메모장 윈도우 포커스", "waitMs": 500 },
    { "stepIndex": 2, "actionType": "window.type", "parameters": { "text": "Hello" }, "description": "텍스트 입력" }
  ]
}
\`\`\`
steps는 COMPOSITE_ACTION일 때만 포함합니다.`;

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
    // eslint-disable-next-line no-console
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
    // eslint-disable-next-line no-console
      console.warn(`[SpecAgent] 감사 로그 기록 실패: ${auditResult.error.message}`);
    }

    return ok(output);
  }

  // Phase 0 스텁 출력 생성 — Claude 미사용 시 키워드 기반 분석
  private buildStubOutput(rawInput: string): SpecOutput {
    const intent = this.inferIntent(rawInput);
    const targets = this.extractTargets(rawInput);
    const base: SpecOutput = {
      specId: `spec_${randomUUID().slice(0, 8)}`,
      interpretation: `사용자 요청 분석: ${rawInput.slice(0, 100)}`,
      intent,
      targets,
      requiresWebAccess: rawInput.toLowerCase().includes("web") || rawInput.toLowerCase().includes("http"),
      requiresLogin: rawInput.toLowerCase().includes("login") || rawInput.toLowerCase().includes("auth"),
      clarifications: [],
      ambiguities: [],
    };

    // 복합 작업이면 steps 분해 추가
    if (intent === "COMPOSITE_ACTION") {
      return { ...base, steps: this.decomposeCompositeAction(rawInput, targets) };
    }

    return base;
  }

  // 복합 작업 분해 — 사용자 입력에서 순차 실행 steps 배열 생성
  private decomposeCompositeAction(
    rawInput: string,
    targets: string[]
  ): { stepIndex: number; actionType: string; parameters: Record<string, unknown>; description: string; waitMs?: number }[] {
    const steps: { stepIndex: number; actionType: string; parameters: Record<string, unknown>; description: string; waitMs?: number }[] = [];
    const lower = rawInput.toLowerCase();
    const appTarget = targets[0] ?? "notepad.exe";

    // Step 0: 앱 실행
    steps.push({
      stepIndex: 0,
      actionType: "app.launch",
      parameters: { appName: appTarget },
      description: `${appTarget} 실행`,
      waitMs: 2000,
    });

    // Step 1: 윈도우 포커스
    const titlePattern = appTarget.replace(".exe", "");
    steps.push({
      stepIndex: 1,
      actionType: "app.focus",
      parameters: { titlePattern },
      description: `${titlePattern} 윈도우 포커스`,
      waitMs: 500,
    });

    // Step 2: 텍스트 입력 — "작성", "입력", "쓰기", "type", "write" 키워드 뒤 내용 추출
    const typePatterns = [
      /(?:작성|입력|쓰기|써|write|type)[^"]*["「]([^"」]+)["」]/,
      /(?:작성|입력|쓰기|써|write|type)\s*(?:해|하)[^\s]*\s+(.+)/,
    ];
    let textToType = "";
    for (const pattern of typePatterns) {
      const match = rawInput.match(pattern);
      if (match?.[1]) {
        textToType = match[1];
        break;
      }
    }

    // 패턴 매칭 실패 시 — 한국어 "고" 접속사 뒤 내용 추출
    if (!textToType) {
      const afterAndMatch = rawInput.match(/(?:열고|실행하고|띄우고|켜고)\s*(.+)/);
      if (afterAndMatch?.[1]) {
        textToType = afterAndMatch[1].trim();
      }
    }

    if (textToType || lower.includes("작성") || lower.includes("입력") || lower.includes("type") || lower.includes("write")) {
      steps.push({
        stepIndex: 2,
        actionType: "window.type",
        parameters: { text: textToType || rawInput },
        description: `텍스트 입력: ${(textToType || rawInput).slice(0, 50)}`,
      });
    }

    return steps;
  }

  // 한국어 앱 이름 키워드 — APP_LAUNCH 판별용
  // 주의: 일반적인 단어("코드" 등)는 오분류를 유발하므로 제외
  private static readonly APP_NAME_KEYWORDS = [
    "메모장", "계산기", "탐색기", "그림판", "브라우저", "크롬",
    "edge", "vscode",
  ];

  // 입력 키워드 기반 의도 분류 — 한국어 + 영어 휴리스틱
  private inferIntent(input: string): SpecOutput["intent"] {
    const lower = input.toLowerCase();

    // 복합 작업 감지 — "열고...작성", "실행하고...입력", "open...and...type" 등
    const compositePatterns = [
      /열고.*(작성|입력|쓰기|써|타이핑)/,
      /실행.*(작성|입력|쓰기|써|타이핑)/,
      /켜고.*(작성|입력|쓰기|써|타이핑)/,
      /띄우고.*(작성|입력|쓰기|써|타이핑)/,
      /open.*(?:and|then).*(?:type|write|input)/i,
      /launch.*(?:and|then).*(?:type|write|input)/i,
      /start.*(?:and|then).*(?:type|write|input)/i,
    ];
    const isComposite = compositePatterns.some(p => p.test(lower));
    if (isComposite) {
      return "COMPOSITE_ACTION";
    }

    // 앱 이름이 직접 언급된 경우 → 우선적으로 APP_LAUNCH
    const hasAppName = SpecAgent.APP_NAME_KEYWORDS.some(k => lower.includes(k));
    if (hasAppName) {
      return "APP_LAUNCH";
    }

    // 패키지 설치 (install, npm 등) — APP_LAUNCH 동사보다 우선
    if (lower.includes("install") || lower.includes("package") || lower.includes("npm") || lower.includes("설치")) {
      return "PACKAGE_INSTALL";
    }
    // 웹 접근 (url, http 등) — APP_LAUNCH 동사보다 우선
    if (lower.includes("http") || lower.includes("url") || lower.includes("api") || lower.includes("web") || lower.includes("접속")) {
      return "WEB_ACCESS";
    }

    // 앱 실행 — 앱 이름 없이 실행 동사만 있는 경우 (launch, open app, start)
    if (
      lower.includes("launch") || lower.includes("open app") || lower.includes("start")
    ) {
      return "APP_LAUNCH";
    }
    // 한국어 실행 동사("열어", "실행", "켜") — 다른 특수 intent가 없을 때만 APP_LAUNCH
    if (
      lower.includes("열어") || lower.includes("실행") || lower.includes("켜")
    ) {
      return "APP_LAUNCH";
    }
    // 파일/폴더 조작 — 한국어 키워드
    if (
      lower.includes("파일") || lower.includes("폴더") || lower.includes("디렉토리") ||
      lower.includes("만들어") || lower.includes("생성") || lower.includes("삭제") ||
      lower.includes("복사") || lower.includes("이동") ||
      lower.includes("file") || lower.includes("directory") || lower.includes("folder")
    ) {
      return "FILE_OPERATION";
    }
    // 프로세스 관리
    if (
      lower.includes("프로세스") || lower.includes("종료") || lower.includes("닫아") ||
      lower.includes("process") || lower.includes("kill") || lower.includes("pid")
    ) {
      return "PROCESS_MANAGEMENT";
    }
    // 시스템 설정
    if (
      lower.includes("설정") || lower.includes("환경") || lower.includes("시스템") ||
      lower.includes("config") || lower.includes("setting") || lower.includes("environment")
    ) {
      return "SYSTEM_CONFIG";
    }
    if (lower.includes("network") || lower.includes("request") || lower.includes("fetch") || lower.includes("네트워크")) {
      return "NETWORK_REQUEST";
    }
    if (lower.includes("mobile") || lower.includes("phone") || lower.includes("sms") || lower.includes("모바일")) {
      return "MOBILE_ACTION";
    }
    return "CODE_IMPLEMENTATION";
  }

  // 한국어 앱 이름 → 실행파일 매핑
  private static readonly APP_NAME_MAP: Readonly<Record<string, string>> = {
    "메모장": "notepad.exe",
    "notepad": "notepad.exe",
    "계산기": "calc.exe",
    "calculator": "calc.exe",
    "탐색기": "explorer.exe",
    "explorer": "explorer.exe",
    "그림판": "mspaint.exe",
    "paint": "mspaint.exe",
    "브라우저": "msedge.exe",
    "크롬": "chrome.exe",
    "chrome": "chrome.exe",
    "edge": "msedge.exe",
    "코드": "code.exe",
    "vscode": "code.exe",
    "터미널": "cmd.exe",
    "cmd": "cmd.exe",
    "파워셸": "powershell.exe",
    "powershell": "powershell.exe",
  };

  // 입력에서 조작 대상 추출 — 한국어 앱 이름 우선, 경로 패턴 폴백
  private extractTargets(input: string): string[] {
    const lower = input.toLowerCase();

    // 한국어 앱 이름 → 실행파일 매핑 우선
    for (const [keyword, exe] of Object.entries(SpecAgent.APP_NAME_MAP)) {
      if (lower.includes(keyword)) {
        return [exe];
      }
    }

    // 파일 경로 패턴 추출
    const pathPattern = /(?:\/[\w./\-]+|[\w]+\.(?:ts|js|json|md|tsx|jsx|py|go))/g;
    const matches = input.match(pathPattern);
    if (matches && matches.length > 0) {
      return matches.slice(0, 5);
    }
    return ["general"];
  }
}
