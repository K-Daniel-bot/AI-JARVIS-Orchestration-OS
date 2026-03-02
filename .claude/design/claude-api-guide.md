# JARVIS OS — Claude API 호출 가이드

> 이 문서는 JARVIS OS의 9개 에이전트가 Claude API를 호출하는 방법을 구체화합니다.
> BaseAgent 추상 클래스 구조, 호출 패턴, 응답 검증 파이프라인, 에러 처리 전략을 포함합니다.
> 모든 에이전트는 이 가이드를 기준으로 구현해야 합니다.

---

## 목차

1. [BaseAgent 추상 클래스](#1-baseagent-추상-클래스)
2. [Claude API 호출 패턴](#2-claude-api-호출-패턴)
3. [System Prompt 조합 규칙](#3-system-prompt-조합-규칙)
4. [에이전트별 호출 설정](#4-에이전트별-호출-설정)
5. [응답 검증 파이프라인](#5-응답-검증-파이프라인)
6. [에러 처리 및 재시도](#6-에러-처리-및-재시도)
7. [토큰 예산 관리](#7-토큰-예산-관리)
8. [스트리밍 vs 비스트리밍](#8-스트리밍-vs-비스트리밍)
9. [스텁 모드](#9-스텁-모드)
10. [구현 예시](#10-구현-예시)

---

## 1. BaseAgent 추상 클래스

> 모든 에이전트는 이 추상 클래스를 상속받아 구현한다.
> `packages/agents/src/base-agent.ts`에 위치.

```typescript
// 에이전트 기반 추상 클래스 — 9개 에이전트 공통 인터페이스
import Anthropic from '@anthropic-ai/sdk';
import { ZodSchema } from 'zod';
import type {
  AgentId,
  AgentDispatchRequest,
  AgentResult,
  JarvisError,
  AuditEntryInput,
} from '@jarvis/shared';
import type { Result } from '@jarvis/shared';

/** Claude 모델 식별자 — 에이전트별 배정에 사용 */
type ClaudeModelId =
  | 'claude-opus-4-6'
  | 'claude-sonnet-4-6'
  | 'claude-haiku-4-5-20251001';

/** Claude API 호출 파라미터 */
interface ClaudeCallParams {
  /** 계약서 + 에이전트별 역할 프롬프트 조합 결과 */
  systemPrompt: string;
  /** 작업 지시 (SPEC.md 내용, PLAN.json 내용 등) */
  userMessage: string;
  /** 에이전트별 기본값 사용 (§4 참조) */
  maxTokens: number;
  /** 에이전트별 기본값 사용 (§4 참조) */
  temperature: number;
  /** Tool Use 정의 (선택 — test-build, executor, rollback만 사용) */
  tools?: Anthropic.Tool[];
  /** 응답 형식 지정 */
  responseFormat: 'text' | 'json';
}

/** Claude API 응답 래퍼 */
interface ClaudeResponse {
  /** 원본 응답 텍스트 */
  content: string;
  /** 실제 사용 토큰 수 (입력 + 출력) */
  tokensUsed: number;
  /** 중단 이유 */
  stopReason: 'end_turn' | 'max_tokens' | 'tool_use' | 'stop_sequence';
  /** Tool Use 결과 (tools 파라미터 사용 시) */
  toolUseBlocks?: Anthropic.ToolUseBlock[];
}

/** 감사 로그 기록 입력 (간소화 버전 — 상세는 api-endpoints.md §4.1 참조) */
type AuditEntryInput = import('@jarvis/shared').AuditEntryInput;

/**
 * 에이전트 기반 추상 클래스
 * 모든 에이전트(orchestrator ~ rollback)는 이 클래스를 상속받아 execute()를 구현한다.
 */
abstract class BaseAgent {
  /** 에이전트 식별자 — 감사 로그 추적에 사용 */
  protected readonly agentId: AgentId;

  /** 배정된 Claude 모델 ID — §4 테이블 참조 */
  protected readonly model: ClaudeModelId;

  /** Anthropic SDK 클라이언트 인스턴스 */
  protected readonly client: Anthropic;

  /** 스텁 모드 여부 — JARVIS_STUB_MODE=true 시 API 호출 스킵 */
  protected readonly stubMode: boolean;

  constructor(agentId: AgentId, model: ClaudeModelId) {
    this.agentId = agentId;
    this.model = model;
    this.stubMode = process.env['JARVIS_STUB_MODE'] === 'true';

    // API 키 검증 — 스텁 모드가 아닐 때만 필수
    const apiKey = process.env['ANTHROPIC_API_KEY'];
    if (!this.stubMode && !apiKey) {
      throw new Error('ANTHROPIC_API_KEY is required when JARVIS_STUB_MODE is false');
    }

    this.client = new Anthropic({ apiKey: apiKey ?? 'stub-key' });
  }

  /**
   * 에이전트 실행 진입점 — 하위 클래스가 반드시 구현해야 함.
   * Orchestrator가 dispatchAgent()로 호출할 때 이 함수가 실행된다.
   * 절대 throw하지 않음 — 모든 에러는 Result.err()로 반환.
   */
  abstract execute(
    request: AgentDispatchRequest
  ): Promise<Result<AgentResult, JarvisError>>;

  /**
   * Claude API 단일 호출 — 재시도 로직 포함.
   * §6 에러 처리 및 재시도 정책을 내부적으로 적용한다.
   * 토큰 예산 소진 시 RESOURCE_EXHAUSTED 에러 반환.
   */
  protected async callClaude(
    params: ClaudeCallParams
  ): Promise<Result<ClaudeResponse, JarvisError>>;

  /**
   * System Prompt 조합 — §3 규칙에 따라 4개 블록을 조합.
   * contract.md 전문 + 에이전트별 역할 프롬프트 + 작업 컨텍스트 + 응답 형식 지정.
   */
  protected buildSystemPrompt(
    contractMd: string,
    agentPrompt: string,
    taskContext?: string,
    outputSchema?: string
  ): string;

  /**
   * 응답 파싱 및 Zod 검증 — §5 검증 파이프라인 구현체.
   * JSON.parse() → Zod 검증 → 성공 시 Result.ok() / 실패 시 최대 2회 재시도.
   */
  protected parseResponse<T>(
    raw: string,
    schema: ZodSchema<T>
  ): Result<T, JarvisError>;

  /**
   * 감사 로그 기록 — 모든 에이전트 작업 시작/완료마다 호출 필수.
   * 계약서 §3: 불변 감사 로그에 append-only 기록.
   * DB 쓰기 실패 시 에러를 throw하지 않고 메모리 버퍼에 저장 후 재시도.
   */
  protected async recordAudit(entry: AuditEntryInput): Promise<void>;

  /**
   * 스텁 응답 생성 — JARVIS_STUB_MODE=true 시 callClaude() 대신 호출.
   * 개발/테스트 환경에서 API 비용 없이 워크플로우 검증용.
   */
  protected generateStubResponse(agentId: AgentId): ClaudeResponse;
}
```

---

## 2. Claude API 호출 패턴

> `callClaude()` 내부 구현 상세 — 모든 에이전트가 공유하는 단일 호출 패턴.

```typescript
// Claude API 호출 파라미터 전체 명세
interface ClaudeCallParams {
  /** 계약서 + 에이전트별 역할 프롬프트를 buildSystemPrompt()로 조합한 결과 */
  systemPrompt: string;

  /**
   * 작업 지시 메시지.
   * 예: SPEC.md 전문, PLAN.json 직렬화 결과, PolicyDecision 요약 등.
   * 민감 정보(API 키, 비밀번호)는 이 필드에 절대 포함 금지.
   */
  userMessage: string;

  /**
   * 최대 출력 토큰 수 — 에이전트별 기본값은 §4 테이블 참조.
   * 절대 0 이하 또는 에이전트 기본값 초과 설정 금지.
   */
  maxTokens: number;

  /**
   * 샘플링 온도 (0.0 ~ 1.0).
   * 정책 판정(policy-risk), 리뷰(review): 0.1 (결정론적)
   * 코드 생성(codegen): 0.2 (약간의 다양성)
   * 분석(spec-agent): 0.5 (창의적 해석 허용)
   */
  temperature: number;

  /**
   * Tool Use 정의 (선택).
   * test-build: bash (테스트 실행)
   * executor: bash + file (OS 조작)
   * rollback: bash (롤백 실행)
   * 그 외 에이전트: undefined (Tool Use 사용 안 함)
   */
  tools?: Anthropic.Tool[];

  /**
   * 응답 형식.
   * 'json': JSON 파싱 후 Zod 검증 필수 (대부분의 에이전트)
   * 'text': Markdown 형식 그대로 반환 (spec-agent SPEC.md 생성)
   */
  responseFormat: 'text' | 'json';
}
```

### 2.1 내부 구현 흐름

```
callClaude(params) 호출
  │
  ├─ [스텁 모드] → generateStubResponse() → Result.ok()
  │
  ├─ [토큰 예산 검사] 잔여량 < params.maxTokens → Result.err(RESOURCE_EXHAUSTED)
  │
  ├─ Anthropic SDK messages.create() 호출
  │   ├─ model: this.model
  │   ├─ system: params.systemPrompt
  │   ├─ messages: [{ role: 'user', content: params.userMessage }]
  │   ├─ max_tokens: params.maxTokens
  │   ├─ temperature: params.temperature
  │   └─ tools?: params.tools
  │
  ├─ 응답 수신
  │   ├─ content 블록에서 텍스트/tool_use 추출
  │   ├─ usage.input_tokens + usage.output_tokens → tokensUsed 계산
  │   └─ stop_reason 확인 (max_tokens 시 경고 로그)
  │
  └─ Result.ok(ClaudeResponse) 반환
```

### 2.2 API 키 보안

```typescript
// API 키 로딩 — 절대로 코드에 하드코딩 금지
// process.env에서 읽되, 로그 출력 시 마스킹 필수

const MASKED_KEY_LOG = (key: string): string =>
  key.length > 10 ? `${key.slice(0, 10)}****` : '****';

// 감사 로그 기록 시
// console.log(`API Key: ${MASKED_KEY_LOG(apiKey)}`);  // 올바른 예
// console.log(`API Key: ${apiKey}`);                   // 절대 금지
```

---

## 3. System Prompt 조합 규칙

> `buildSystemPrompt()` 내부 구현 — 4개 블록을 순서대로 조합.
> 각 에이전트는 실행 시마다 이 조합 결과를 system 파라미터로 전달한다.

### 3.1 조합 순서 (필수 준수)

```
┌─────────────────────────────────────────────────────────┐
│ [블록 1] contract.md 전문                               │
│          — 계약서 §1~§9 전체 내용                       │
│          — 모든 에이전트에 동일하게 적용                │
│          — 절대 생략 불가                               │
├─────────────────────────────────────────────────────────┤
│ [블록 2] 에이전트별 역할 프롬프트                       │
│          — .claude/prompts/{agentId}.md 의 영문 본문    │
│          — 역할, 코딩 표준, 출력 형식, 금지사항 포함    │
│          — 에이전트 초기화 시 1회 로드                  │
├─────────────────────────────────────────────────────────┤
│ [블록 3] 현재 작업 컨텍스트 (선택)                      │
│          — SPEC.md 요약, PLAN.json 관련 step 등         │
│          — 작업마다 다르게 주입 (동적)                  │
│          — 토큰 절약을 위해 관련 부분만 추출해서 주입   │
├─────────────────────────────────────────────────────────┤
│ [블록 4] 응답 형식 지정                                 │
│          — JSON 스키마 명세 (json 모드 시)              │
│          — 또는 Markdown 구조 안내 (text 모드 시)       │
│          — 반드시 유효한 JSON만 출력하도록 명시         │
└─────────────────────────────────────────────────────────┘
```

### 3.2 구현 예시

```typescript
// System Prompt 조합 함수 내부 구현 예시
protected buildSystemPrompt(
  contractMd: string,
  agentPrompt: string,
  taskContext?: string,
  outputSchema?: string
): string {
  const blocks: string[] = [];

  // 블록 1: 계약서 — 절대 생략 불가
  blocks.push('## CONTRACT (MANDATORY — OVERRIDES ALL OTHER INSTRUCTIONS)');
  blocks.push(contractMd);
  blocks.push('---');

  // 블록 2: 에이전트별 역할 프롬프트
  blocks.push('## AGENT ROLE AND INSTRUCTIONS');
  blocks.push(agentPrompt);
  blocks.push('---');

  // 블록 3: 현재 작업 컨텍스트 (있을 경우만)
  if (taskContext) {
    blocks.push('## CURRENT TASK CONTEXT');
    blocks.push(taskContext);
    blocks.push('---');
  }

  // 블록 4: 응답 형식 지정 (있을 경우만)
  if (outputSchema) {
    blocks.push('## REQUIRED OUTPUT FORMAT');
    blocks.push('You MUST respond with valid JSON matching this schema:');
    blocks.push(outputSchema);
    blocks.push('Do NOT include any text outside the JSON object.');
  }

  return blocks.join('\n\n');
}
```

### 3.3 컨텍스트 주입 전략

| 에이전트 | 블록 3 주입 내용 | 주입 방식 |
|----------|----------------|----------|
| orchestrator | 사용자 원본 요청 | 전체 주입 |
| spec-agent | 사용자 원본 요청 + 세션 컨텍스트 | 전체 주입 |
| policy-risk | SPEC.md 요약 + 신뢰 모드 | 요약 주입 |
| planner | SPEC.md + PolicyDecision 요약 | 요약 주입 |
| codegen | 관련 PLAN step + 기존 코드 | step 단위 주입 |
| review | ChangeSet diff | 전체 주입 |
| test-build | TestResult 대상 파일 목록 | 경로만 주입 |
| executor | ExecutionPlan + Capability Token ID | 요약 주입 |
| rollback | ExecutionTrace + 실패 원인 | 전체 주입 |

---

## 4. 에이전트별 호출 설정

> 각 에이전트의 모델 배정, 토큰 한도, 온도, Tool Use, 응답 형식을 정의한다.
> Phase 0 기준 설정이며, Phase 1+에서는 orchestrator와 policy-risk가 Opus로 업그레이드된다.

### 4.1 설정 테이블

| Agent | Model ID | maxTokens | temperature | tools | 응답 형식 | 출력 타입 |
|-------|----------|-----------|-------------|-------|----------|----------|
| orchestrator | claude-sonnet-4-6 | 4096 | 0.3 | 없음 | JSON | ComplexityResult / RunPlan |
| spec-agent | claude-haiku-4-5-20251001 | 8192 | 0.5 | 없음 | text | SPEC.md (Markdown) |
| policy-risk | claude-sonnet-4-6 | 4096 | 0.1 | 없음 | JSON | PolicyDecision |
| planner | claude-sonnet-4-6 | 8192 | 0.3 | 없음 | JSON | PLAN.json |
| codegen | claude-sonnet-4-6 | 16384 | 0.2 | 없음 | JSON | ChangeSet |
| review | claude-sonnet-4-6 | 4096 | 0.1 | 없음 | JSON | ReviewResult |
| test-build | claude-haiku-4-5-20251001 | 4096 | 0.1 | bash | JSON | TestResult |
| executor | claude-sonnet-4-6 | 4096 | 0.1 | bash, file | JSON | ExecutionPlan |
| rollback | claude-haiku-4-5-20251001 | 4096 | 0.1 | bash | JSON | RollbackPlan |

> Phase 1+ 모델 업그레이드:
> - orchestrator: claude-haiku-4-5-20251001 → claude-opus-4-6
> - policy-risk: claude-sonnet-4-6 → claude-opus-4-6

### 4.2 설정 상수 정의

```typescript
// 에이전트별 Claude API 호출 기본 설정 상수
// packages/agents/src/agent-configs.ts

import type { AgentId } from '@jarvis/shared';

/** 에이전트 Claude API 호출 기본 설정 */
interface AgentCallConfig {
  model: 'claude-opus-4-6' | 'claude-sonnet-4-6' | 'claude-haiku-4-5-20251001';
  maxTokens: number;
  temperature: number;
  useTools: boolean;
  responseFormat: 'text' | 'json';
}

/** 에이전트별 기본 설정 맵 (Phase 0 기준) */
const AGENT_CALL_CONFIGS: Record<AgentId, AgentCallConfig> = {
  'orchestrator': {
    model: 'claude-sonnet-4-6',
    maxTokens: 4096,
    temperature: 0.3,
    useTools: false,
    responseFormat: 'json',
  },
  'spec-agent': {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 8192,
    temperature: 0.5,
    useTools: false,
    responseFormat: 'text',
  },
  'policy-risk': {
    model: 'claude-sonnet-4-6',
    maxTokens: 4096,
    temperature: 0.1,
    useTools: false,
    responseFormat: 'json',
  },
  'planner': {
    model: 'claude-sonnet-4-6',
    maxTokens: 8192,
    temperature: 0.3,
    useTools: false,
    responseFormat: 'json',
  },
  'codegen': {
    model: 'claude-sonnet-4-6',
    maxTokens: 16384,
    temperature: 0.2,
    useTools: false,
    responseFormat: 'json',
  },
  'review': {
    model: 'claude-sonnet-4-6',
    maxTokens: 4096,
    temperature: 0.1,
    useTools: false,
    responseFormat: 'json',
  },
  'test-build': {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 4096,
    temperature: 0.1,
    useTools: true,
    responseFormat: 'json',
  },
  'executor': {
    model: 'claude-sonnet-4-6',
    maxTokens: 4096,
    temperature: 0.1,
    useTools: true,
    responseFormat: 'json',
  },
  'rollback': {
    model: 'claude-haiku-4-5-20251001',
    maxTokens: 4096,
    temperature: 0.1,
    useTools: true,
    responseFormat: 'json',
  },
} as const;
```

### 4.3 Tool Use 정의 (해당 에이전트만)

```typescript
// test-build, executor, rollback 에이전트가 사용하는 Tool 정의
// packages/agents/src/tool-definitions.ts

/** bash 실행 Tool 정의 — test-build, executor, rollback 전용 */
const BASH_TOOL: Anthropic.Tool = {
  name: 'bash',
  description: 'Execute a bash command. Only allowlisted commands are permitted.',
  input_schema: {
    type: 'object' as const,
    properties: {
      command: {
        type: 'string',
        description: 'The bash command to execute',
      },
    },
    required: ['command'],
  },
};

/** 파일 쓰기 Tool 정의 — executor 전용 (ChangeSet 적용) */
const FILE_WRITE_TOOL: Anthropic.Tool = {
  name: 'file_write',
  description: 'Write content to a file. Path must be within allowed scope.',
  input_schema: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: 'Absolute file path within allowed scope',
      },
      content: {
        type: 'string',
        description: 'File content to write',
      },
    },
    required: ['path', 'content'],
  },
};

/** 에이전트별 Tool 목록 */
const AGENT_TOOLS: Partial<Record<AgentId, Anthropic.Tool[]>> = {
  'test-build': [BASH_TOOL],
  'executor': [BASH_TOOL, FILE_WRITE_TOOL],
  'rollback': [BASH_TOOL],
};
```

---

## 5. 응답 검증 파이프라인

> Claude 응답을 수신한 후 비즈니스 로직에 사용하기 전 반드시 거쳐야 하는 검증 단계.
> `parseResponse()` 내부 구현이 이 파이프라인을 담당한다.

### 5.1 파이프라인 흐름

```
Claude 응답 수신 (ClaudeResponse.content)
  │
  ├─ [text 모드] → 텍스트 그대로 반환 → Result.ok()
  │
  └─ [json 모드]
       │
       ├─ Step 1: 코드 블록 제거 (```json ... ``` 제거)
       │
       ├─ Step 2: JSON.parse()
       │   └─ 실패 → 재시도 카운트 증가 (최대 2회)
       │            재시도 시 userMessage에 파싱 에러 피드백 추가
       │            2회 모두 실패 → Result.err(VALIDATION_FAILED)
       │
       ├─ Step 3: Zod 스키마 검증
       │   └─ 실패 → 재시도 카운트 증가 (최대 2회)
       │            재시도 시 userMessage에 스키마 에러 피드백 추가
       │            2회 모두 실패 → Result.err(VALIDATION_FAILED)
       │
       └─ Step 4: 성공 → Result.ok(parsedValue)
```

### 5.2 구현 예시

```typescript
// 응답 파싱 및 Zod 검증 — parseResponse() 구현
protected parseResponse<T>(
  raw: string,
  schema: ZodSchema<T>
): Result<T, JarvisError> {
  // 코드 블록 마커 제거 (Claude가 JSON을 코드 블록으로 감쌀 때)
  const cleaned = raw
    .replace(/^```(?:json)?\n?/m, '')
    .replace(/\n?```$/m, '')
    .trim();

  // JSON 파싱 시도
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (e) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: `JSON parse failed: ${e instanceof Error ? e.message : 'unknown'}`,
        userMessage: '응답 형식 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
        agentId: this.agentId,
        retryable: true,
        blocksOsActions: false,
      },
    };
  }

  // Zod 스키마 검증
  const result = schema.safeParse(parsed);
  if (!result.success) {
    return {
      ok: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: `Schema validation failed: ${result.error.message}`,
        userMessage: '응답 데이터 형식이 올바르지 않습니다.',
        agentId: this.agentId,
        retryable: true,
        blocksOsActions: false,
      },
    };
  }

  return { ok: true, value: result.data };
}
```

### 5.3 재시도 로직 (검증 실패 시)

```typescript
// parseResponse 실패 시 재시도 — callClaude 내부에서 최대 2회 반복
// 재시도 시 userMessage에 이전 에러 피드백 추가

const MAX_PARSE_RETRIES = 2;

async function callClaudeWithRetry<T>(
  params: ClaudeCallParams,
  schema: ZodSchema<T>,
  retryCount = 0
): Promise<Result<T, JarvisError>> {
  const response = await callClaude(params);
  if (!response.ok) return response;

  const parsed = parseResponse(response.value.content, schema);
  if (parsed.ok) return parsed;

  if (retryCount >= MAX_PARSE_RETRIES) {
    // 최대 재시도 초과 — 최종 에러 반환
    return {
      ok: false,
      error: {
        code: 'VALIDATION_FAILED',
        message: `Schema validation failed after ${MAX_PARSE_RETRIES} retries`,
        userMessage: '응답 검증에 반복 실패했습니다.',
        agentId: this.agentId,
        retryable: false,
        blocksOsActions: false,
      },
    };
  }

  // 재시도: 이전 에러 피드백을 userMessage에 추가
  const retryParams: ClaudeCallParams = {
    ...params,
    userMessage: [
      params.userMessage,
      '',
      `[RETRY ${retryCount + 1}/${MAX_PARSE_RETRIES}]`,
      `Previous response had validation error: ${parsed.error.message}`,
      'Please respond with valid JSON matching the required schema exactly.',
    ].join('\n'),
  };

  return callClaudeWithRetry(retryParams, schema, retryCount + 1);
}
```

---

## 6. 에러 처리 및 재시도

> HTTP 상태 코드별 에러 처리 전략과 재시도 정책을 정의한다.

### 6.1 HTTP 상태 코드별 처리

| HTTP 코드 | 원인 | 처리 전략 | 재시도 |
|-----------|------|----------|-------|
| 429 Rate Limit | API 요청 한도 초과 | 지수 백오프 (1s → 2s → 4s) | 최대 3회 |
| 500 Server Error | Anthropic 서버 내부 오류 | 즉시 1회 재시도 | 1회 |
| 529 Overloaded | Anthropic 서버 과부하 | 지수 백오프 (2s → 4s → 8s) | 최대 3회 |
| 400 Bad Request | 잘못된 요청 파라미터 | 즉시 에러 반환 (재시도 불가) | 없음 |
| 401 Unauthorized | API 키 오류 | 즉시 에러 반환 + 기동 중단 | 없음 |
| 408 Timeout | 60초 타임아웃 초과 | 즉시 에러 반환 | 없음 |

### 6.2 재시도 구현

```typescript
// API 재시도 전략 — callClaude() 내부 구현
// packages/agents/src/base-agent.ts

/** 지수 백오프 대기 시간 계산 */
const BACKOFF_BASE_MS = 1000;
const BACKOFF_MULTIPLIER = 2;
const MAX_BACKOFF_MS = 8000;

const calculateBackoff = (attempt: number): number =>
  Math.min(BACKOFF_BASE_MS * Math.pow(BACKOFF_MULTIPLIER, attempt), MAX_BACKOFF_MS);

/** API 에러 분류 */
type ApiErrorCategory =
  | 'RATE_LIMIT'     // 429 — 지수 백오프 재시도
  | 'SERVER_ERROR'   // 500, 529 — 즉시 재시도 또는 백오프
  | 'CLIENT_ERROR'   // 400, 401 — 재시도 없음
  | 'TIMEOUT';       // 타임아웃 — 재시도 없음

const classifyApiError = (statusCode: number): ApiErrorCategory => {
  if (statusCode === 429) return 'RATE_LIMIT';
  if (statusCode === 500 || statusCode === 529) return 'SERVER_ERROR';
  if (statusCode >= 400 && statusCode < 500) return 'CLIENT_ERROR';
  return 'TIMEOUT';
};

/** 에이전트 기본 타임아웃 — 60초, 연장 불가 */
const AGENT_TIMEOUT_MS = 60_000;
```

### 6.3 에러 → JarvisError 변환

```typescript
// Anthropic SDK APIError → JarvisError 변환
// packages/agents/src/base-agent.ts

const toJarvisError = (
  error: Anthropic.APIError,
  agentId: AgentId
): JarvisError => {
  const category = classifyApiError(error.status ?? 500);

  return {
    code: category === 'RATE_LIMIT' || category === 'SERVER_ERROR'
      ? 'RESOURCE_EXHAUSTED'
      : 'INTERNAL_ERROR',
    message: `Claude API error (${error.status}): ${error.message}`,
    // 사용자에게는 내부 상세 정보 노출 금지
    userMessage: category === 'RATE_LIMIT'
      ? 'API 요청 한도에 도달했습니다. 잠시 후 자동으로 재시도합니다.'
      : '일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.',
    agentId,
    retryable: category === 'RATE_LIMIT' || category === 'SERVER_ERROR',
    blocksOsActions: true,
  };
};
```

---

## 7. 토큰 예산 관리

> Run 전체에 걸쳐 Claude API 토큰 소비량을 추적하고 한도를 초과하지 않도록 관리한다.
> JARVIS_MAX_TOKENS_PER_RUN 환경변수(기본값: 100,000)를 상한선으로 사용한다.

### 7.1 TokenBudget 인터페이스

```typescript
// 토큰 예산 추적 구조체
// packages/agents/src/token-budget.ts

/** Run 전체 토큰 예산 */
interface TokenBudget {
  /** 이번 Run의 총 토큰 한도 (JARVIS_MAX_TOKENS_PER_RUN) */
  totalLimit: number;

  /** 지금까지 사용한 토큰 수 (입력 + 출력 합산) */
  used: number;

  /** 남은 토큰 수 (totalLimit - used) */
  readonly remaining: number;  // getter: totalLimit - used

  /** 경고 임계값 — 사용률 80% 도달 시 사용자 경고 */
  readonly warningThreshold: 0.8;

  /** 위험 임계값 — 사용률 95% 도달 시 현재 단계 완료 후 중단 */
  readonly criticalThreshold: 0.95;
}

/** 에이전트별 토큰 할당 (BUDGET.json에서 로드) */
interface AgentBudgetAllocation {
  agentId: AgentId;
  /** 이 에이전트에 할당된 최대 토큰 수 */
  maxTokens: number;
  /** 현재까지 이 에이전트가 사용한 토큰 수 */
  usedTokens: number;
}
```

### 7.2 예산 소비 흐름

```
callClaude() 호출 전:
  1. remaining < params.maxTokens → Result.err(RESOURCE_EXHAUSTED) 즉시 반환
  2. used / totalLimit >= criticalThreshold(0.95) → 중단 경고 + 현재 단계 완료 후 종료

callClaude() 완료 후:
  1. budget.used += response.tokensUsed
  2. used / totalLimit >= warningThreshold(0.8) → 감사 로그에 경고 기록 + 사용자 알림
  3. BUDGET.json 업데이트 (에이전트별 usedTokens 갱신)
```

### 7.3 BUDGET.json 구조 예시

```json
{
  "run_id": "run_20260302_0001",
  "total_limit": 100000,
  "used": 34500,
  "remaining": 65500,
  "warning_threshold": 0.8,
  "critical_threshold": 0.95,
  "per_agent": {
    "orchestrator": { "allocated": 4096, "used": 1200 },
    "spec-agent":   { "allocated": 8192, "used": 3400 },
    "policy-risk":  { "allocated": 4096, "used": 2100 },
    "planner":      { "allocated": 8192, "used": 5800 },
    "codegen":      { "allocated": 16384, "used": 12000 },
    "review":       { "allocated": 4096, "used": 4096 },
    "test-build":   { "allocated": 4096, "used": 2900 },
    "executor":     { "allocated": 4096, "used": 1800 },
    "rollback":     { "allocated": 4096, "used": 1200 }
  }
}
```

---

## 8. 스트리밍 vs 비스트리밍

> 대부분의 에이전트 호출은 비스트리밍(동기 응답)을 사용한다.
> Web UI에서 실시간 진행 상황을 표시할 때만 스트리밍을 사용한다.

### 8.1 비스트리밍 (기본)

```typescript
// 비스트리밍 호출 — 대부분의 에이전트 작업
// packages/agents/src/base-agent.ts

// Anthropic SDK messages.create() — 완전한 응답을 한 번에 수신
const response = await this.client.messages.create({
  model: this.model,
  system: params.systemPrompt,
  messages: [{ role: 'user', content: params.userMessage }],
  max_tokens: params.maxTokens,
  temperature: params.temperature,
  ...(params.tools ? { tools: params.tools } : {}),
});

// content 블록에서 텍스트 추출
const textContent = response.content
  .filter((block): block is Anthropic.TextBlock => block.type === 'text')
  .map(block => block.text)
  .join('');
```

### 8.2 스트리밍 (Web UI 전용)

```typescript
// 스트리밍 호출 — Web UI AuditLogPanel 실시간 표시용
// packages/web/src/services/agent-stream.ts

// stream: true 옵션 추가 — AsyncIterable로 청크 단위 수신
const stream = await this.client.messages.create({
  model: this.model,
  system: params.systemPrompt,
  messages: [{ role: 'user', content: params.userMessage }],
  max_tokens: params.maxTokens,
  temperature: params.temperature,
  stream: true,
});

// 스트리밍 이벤트 타입별 처리
for await (const event of stream) {
  if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
    // Web UI로 실시간 텍스트 청크 전송 (WebSocket 또는 SSE)
    onChunk(event.delta.text);
  }
  if (event.type === 'message_stop') {
    // 스트리밍 완료
    onComplete();
  }
}
```

### 8.3 스트리밍 사용 기준

| 사용 가능 여부 | 조건 |
|-------------|------|
| 비스트리밍 사용 | 에이전트 간 내부 호출, 응답 검증 필요, Tool Use |
| 스트리밍 사용 | Web UI 실시간 표시 (spec-agent의 SPEC.md 생성, codegen 진행 표시) |
| 스트리밍 금지 | JSON 응답 파싱 필요 시 (파싱 완료 전까지 스트리밍 불가) |

---

## 9. 스텁 모드

> `JARVIS_STUB_MODE=true` 설정 시 Claude API를 호출하지 않고 사전 정의된 응답을 반환한다.
> 개발/테스트 환경에서 API 비용 없이 전체 워크플로우를 검증할 수 있다.

### 9.1 스텁 응답 정의

```typescript
// 에이전트별 스텁 응답 — packages/agents/src/stub-responses.ts

const STUB_RESPONSES: Record<AgentId, unknown> = {
  'orchestrator': {
    run_id: 'run_stub_0001',
    complexity_score: 10,
    complexity_level: 'LOW',
    strategy: 'SINGLE_AGENT',
    agents_required: ['spec-agent', 'codegen'],
    task_graph: { nodes: [], edges: [] },
    gates: ['GATE_PLAN'],
    budget: { total_tokens: 100000, per_agent: {} },
    model_assignment: { 'spec-agent': 'claude-haiku-4-5-20251001', codegen: 'claude-sonnet-4-6' },
  },
  'spec-agent': '# SPEC.md (스텁)\n\n## 사용자 요청\n[스텁] 분석 완료\n',
  'policy-risk': {
    decisionId: 'dec_stub_0001',
    timestamp: new Date().toISOString(),
    outcome: {
      status: 'ALLOW',
      riskScore: 10,
      riskLevel: 'LOW',
      requiresGates: [],
      reasonCodes: ['STUB_MODE'],
      humanExplanation: '[스텁] 정책 허용',
    },
    constraints: {
      fs: { readAllow: ['**'], writeAllow: ['packages/**'], writeDeny: [] },
      exec: { allow: ['pnpm', 'node'], deny: [] },
      network: { allowDomains: [], denyDomains: [], default: 'DENY' },
    },
    requiredCapabilities: [],
    denials: [],
  },
  'planner': {
    plan_id: 'plan_stub_0001',
    steps: [{ step_id: 's1', type: 'CODE_GENERATE', description: '[스텁] 코드 생성 단계' }],
  },
  'codegen': {
    changeset_id: 'cs_stub_0001',
    plan_ref: 'plan_stub_0001',
    step_ref: 's1',
    files_added: [{ path: 'packages/stub/stub.ts', content: '// [스텁] 코드 생성' }],
    files_modified: [],
    migration_notes: '',
    security_self_check: {
      secrets_found: false,
      injection_risk: false,
      path_traversal_risk: false,
      rce_risk: false,
      xss_risk: false,
      notes: '[스텁 모드]',
    },
  },
  'review': {
    review_id: 'rev_stub_0001',
    status: 'APPROVED',
    issues: [],
    summary: '[스텁] 코드 검토 통과',
  },
  'test-build': {
    test_run_id: 'test_stub_0001',
    status: 'PASSED',
    passed: 1,
    failed: 0,
    coverage: 100,
    summary: '[스텁] 모든 테스트 통과',
  },
  'executor': {
    run_id: 'run_stub_0001',
    status: 'SUCCESS',
    steps: [],
    redactions_applied: [],
    anomalies_detected: [],
  },
  'rollback': {
    rollback_id: 'rb_stub_0001',
    status: 'COMPLETED',
    rolled_back_actions: [],
    postmortem: '[스텁] 롤백 완료',
  },
};
```

### 9.2 스텁 모드 감사 로그

```
스텁 모드에서도 감사 로그는 정상 기록됨.
응답에 [STUB] 태그를 포함하여 스텁 응답임을 명시.
OS 조작(Executor 액션)은 스텁 모드에서도 dry-run으로만 동작.
```

---

## 10. 구현 예시

> Codegen Agent를 예시로 BaseAgent 상속 및 execute() 구현 패턴을 보여준다.

```typescript
// Codegen Agent 구현 예시
// packages/agents/src/codegen-agent.ts

import { z } from 'zod';
import { BaseAgent } from './base-agent';
import { AGENT_CALL_CONFIGS } from './agent-configs';
import type {
  AgentDispatchRequest,
  AgentResult,
  JarvisError,
  Result,
} from '@jarvis/shared';

/** ChangeSet Zod 검증 스키마 */
const changeSetSchema = z.object({
  changeset_id: z.string(),
  plan_ref: z.string(),
  step_ref: z.string(),
  files_added: z.array(z.object({
    path: z.string(),
    content: z.string(),
  })),
  files_modified: z.array(z.object({
    path: z.string(),
    diff: z.string(),
  })),
  files_deleted: z.array(z.string()).default([]),
  migration_notes: z.string(),
  security_self_check: z.object({
    secrets_found: z.boolean(),
    injection_risk: z.boolean(),
    path_traversal_risk: z.boolean(),
    rce_risk: z.boolean(),
    xss_risk: z.boolean(),
    notes: z.string(),
  }),
});

type ChangeSet = z.infer<typeof changeSetSchema>;

/** Codegen 에이전트 — PLAN.json 단계에 따른 코드 변경안 생성 */
class CodegenAgent extends BaseAgent {
  constructor() {
    const config = AGENT_CALL_CONFIGS['codegen'];
    super('codegen', config.model);
  }

  /**
   * Codegen 에이전트 실행 진입점.
   * PLAN.json의 CODE_GENERATE step을 읽어 ChangeSet을 생성한다.
   */
  async execute(
    request: AgentDispatchRequest
  ): Promise<Result<AgentResult, JarvisError>> {
    // 작업 시작 감사 로그 기록
    await this.recordAudit({
      who: { userId: 'system', role: 'AI-Autonomous', sessionId: request.sessionId },
      what: { aiInterpretation: 'Codegen 에이전트 실행 시작', intent: 'code_generation' },
      result: { status: 'COMPLETED', outputSummary: '코드 생성 작업 시작' },
      logLevel: 'SUMMARY',
    });

    // contract.md + codegen 역할 프롬프트 로드
    const contractMd = await this.loadContractMd();
    const agentPrompt = await this.loadAgentPrompt('codegen');
    const planStep = await this.loadPlanStep(request.environmentBundle.planPath);

    // System Prompt 조합 (§3 규칙 적용)
    const systemPrompt = this.buildSystemPrompt(
      contractMd,
      agentPrompt,
      `## 현재 작업 단계\n${JSON.stringify(planStep, null, 2)}`,
      JSON.stringify(changeSetSchema.shape, null, 2),
    );

    // Claude API 호출 (§4 설정 적용)
    const config = AGENT_CALL_CONFIGS['codegen'];
    const claudeResult = await this.callClaude({
      systemPrompt,
      userMessage: `다음 PLAN step을 구현하는 ChangeSet을 생성해주세요:\n${JSON.stringify(planStep)}`,
      maxTokens: config.maxTokens,
      temperature: config.temperature,
      responseFormat: 'json',
    });

    if (!claudeResult.ok) {
      return { ok: false, error: claudeResult.error };
    }

    // 응답 검증 (§5 파이프라인 적용)
    const parsed = this.parseResponse(claudeResult.value.content, changeSetSchema);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error };
    }

    const changeSet: ChangeSet = parsed.value;

    // 보안 자체 검사 결과 확인
    if (changeSet.security_self_check.secrets_found ||
        changeSet.security_self_check.injection_risk) {
      return {
        ok: false,
        error: {
          code: 'VALIDATION_FAILED',
          message: 'Security self-check failed: secrets or injection risk detected',
          userMessage: '생성된 코드에서 보안 위험이 발견되었습니다.',
          agentId: 'codegen',
          retryable: false,
          blocksOsActions: true,
        },
      };
    }

    // 작업 완료 감사 로그 기록
    await this.recordAudit({
      who: { userId: 'system', role: 'AI-Autonomous', sessionId: request.sessionId },
      what: { aiInterpretation: 'ChangeSet 생성 완료', intent: 'code_generation' },
      result: {
        status: 'COMPLETED',
        outputSummary: `파일 ${changeSet.files_added.length}개 추가, ${changeSet.files_modified.length}개 수정`,
        artifacts: [changeSet.changeset_id],
      },
      logLevel: 'FULL',
    });

    // 성공 결과 반환
    return {
      ok: true,
      value: {
        agentId: 'codegen',
        runId: request.runId,
        taskId: changeSet.changeset_id,
        status: 'SUCCESS',
        nextEvent: request.onCompleteEvent,
        artifacts: [changeSet.changeset_id],
        handoffPayload: {
          artifactType: 'CHANGESET',
          artifactRef: changeSet.changeset_id,
          summary: `파일 ${changeSet.files_added.length}개 추가, ${changeSet.files_modified.length}개 수정`,
          metadata: { migration_notes: changeSet.migration_notes },
        },
        tokensUsed: claudeResult.value.tokensUsed,
      },
    };
  }
}
```

---

## 참조 문서

| 문서 | 내용 |
|------|------|
| `.claude/agents/*.md` | 9개 에이전트 역할 정의 (YAML frontmatter + 규칙) |
| `.claude/prompts/*.md` | 9개 에이전트 System Prompt 템플릿 |
| `.claude/contract.md` | 계약서 §1~§9 (System Prompt 블록 1) |
| `.claude/design/api-endpoints.md` §2.1 | 에이전트 실행 요청/결과 인터페이스 |
| `.claude/design/env-variables.md` | ANTHROPIC_API_KEY, JARVIS_STUB_MODE 등 환경변수 |
| `.claude/design/error-catalog.md` | JarvisErrorCode 전체 카탈로그 |
| `.claude/schemas/audit-log.json` | AuditEntryInput 스키마 |

---

> version: 1.0.0
> last_updated: 2026-03-02
> 참조: `.claude/agents/*.md`, `.claude/prompts/*.md`, `.claude/contract.md`, `.claude/design/api-endpoints.md` §2.1
