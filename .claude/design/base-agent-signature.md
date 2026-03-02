# BaseAgent 추상 클래스 인터페이스

**Phase**: 0
**Status**: 설계 문서 (구현 가이드)
**Last Updated**: 2026-03-02

---

## 목차

1. [개요](#개요)
2. [BaseAgent 추상 클래스](#baseagent-추상-클래스)
3. [구체적 에이전트 구현](#구체적-에이전트-구현)
4. [공유 유틸리티 메서드](#공유-유틸리티-메서드)
5. [에이전트별 execute 서명](#에이전트별-execute-서명)
6. [구현 예시](#구현-예시)

---

## 개요

JARVIS OS의 9개 에이전트는 모두 공통 `BaseAgent` 추상 클래스를 상속한다.
BaseAgent는 다음을 제공한다:

- **Constructor signature** — agentId, model, tools, permissionMode 초기화
- **Abstract execute() method** — 각 에이전트별 구현
- **Protected helper methods** — Claude API 호출, 출력 검증, 감사 로깅, Capability Token 강제
- **생명 주기 관리** — initialize, execute, finalize 흐름
- **에러 처리** — Result<T, E> 패턴 기반

---

## BaseAgent 추상 클래스

```typescript
/**
 * BaseAgent — 모든 9개 에이전트가 상속하는 추상 기반 클래스
 *
 * 공유 기능:
 * - Claude API 호출 (model별로 구분)
 * - 출력 JSON 검증 (Zod 스키마)
 * - 감사 로그 기록 (AuditEntry)
 * - Capability Token 강제 (Phase 1+)
 * - 타임아웃 처리 (AGENT_TIMEOUT 에러)
 */
export abstract class BaseAgent {
  // ============================================================
  // 속성 (생성자 초기화)
  // ============================================================

  readonly agentId: string;           // 에이전트 고유 ID (UUID)
  readonly agentRole: AgentRole;      // 에이전트 역할 (orchestrator|spec|policy|...)
  readonly model: ClaudeModel;        // 모델 (opus|sonnet|haiku)
  readonly tools: ReadonlyArray<AgentTool>;
  readonly disallowedTools: ReadonlyArray<AgentTool>;
  readonly permissionMode: PermissionMode; // observe|suggest|semi-auto|auto
  readonly maxTurns: number;          // 최대 턴 수
  readonly timeoutMs: number;         // 실행 타임아웃 (기본 5분)

  protected auditLog: AuditLogService;  // 감사 로깅 서비스
  protected policyEngine: PolicyEngine;  // 정책 판정 엔진
  protected capabilityTokenManager: CapabilityTokenManager; // Phase 1+

  // ============================================================
  // 생성자
  // ============================================================

  /**
   * BaseAgent 생성자
   *
   * @param config — 에이전트 설정
   *   - agentId: 에이전트 고유 ID (UUID)
   *   - agentRole: 에이전트 역할
   *   - model: Claude 모델 (claude-opus-4-6|claude-sonnet-4-6|claude-haiku-4-5-20251001)
   *   - tools: 허용된 도구 배열
   *   - disallowedTools: 금지된 도구 배열
   *   - permissionMode: 권한 모드
   *   - maxTurns: 최대 턴 수
   *   - timeoutMs: 타임아웃 (기본 300000ms = 5분)
   * @param dependencies — 의존성 주입
   *   - auditLog: AuditLogService
   *   - policyEngine: PolicyEngine
   *   - capabilityTokenManager?: CapabilityTokenManager (Phase 1+)
   *
   * @throws VALIDATION_FAILED — config 스키마 검증 실패
   */
  constructor(
    config: BaseAgentConfig,
    dependencies: BaseAgentDependencies
  );

  // ============================================================
  // 추상 메서드 — 각 에이전트별 구현 필수
  // ============================================================

  /**
   * execute() — 에이전트 실행 진입점
   *
   * 입력을 받아 에이전트별 처리를 수행하고, JSON 구조화된 출력 반환.
   * 각 에이전트는 이 메서드를 구현하여 자신의 역할 수행.
   *
   * @param input — 에이전트 입력 (에이전트별 타입)
   * @param context — 실행 컨텍스트 (상태 머신 context)
   * @param capabilityToken — Capability Token (Phase 1+, 선택)
   *
   * @returns Promise<Result<AgentOutput, AgentError>>
   *   - Ok(output): 정상 실행 결과 (JSON 스키마 준수)
   *   - Err(error): 에러 결과 (에러 코드 + 메시지)
   *
   * 구현 가이드:
   * 1. 입력 Zod 검증 (validateInput)
   * 2. Capability Token 검증 (validateCapabilityToken)
   * 3. Claude API 호출 (callClaudeAPI)
   * 4. 출력 JSON 검증 (validateOutput)
   * 5. 감사 로그 기록 (logAudit)
   * 6. 결과 반환
   */
  abstract execute(
    input: unknown,
    context: XStateContext,
    capabilityToken?: CapabilityToken
  ): Promise<Result<AgentOutput, AgentError>>;

  // ============================================================
  // Protected 헬퍼 메서드
  // ============================================================

  /**
   * validateInput() — 입력 Zod 스키마 검증
   *
   * @param input — 입력 데이터
   * @param schema — Zod 스키마
   *
   * @returns Result<T, ValidationError>
   *   - Ok(data): 검증 성공 (파싱된 데이터)
   *   - Err(error): 검증 실패
   */
  protected validateInput<T>(
    input: unknown,
    schema: ZodSchema<T>
  ): Result<T, ValidationError>;

  /**
   * validateCapabilityToken() — Capability Token 검증 (Phase 1+)
   *
   * @param token — Capability Token
   * @param requiredCapabilities — 요구되는 capabilities
   *
   * @returns Result<void, TokenError>
   *   - Ok(void): 토큰 유효
   *   - Err(error): 토큰 무효 (만료, 스코프 불일치, 사용 횟수 초과 등)
   *
   * 검증 항목:
   * - status === ACTIVE
   * - ttl_expires > now
   * - remaining_uses > 0
   * - requiredCapabilities ⊆ token.scope.allow
   * - HMAC-SHA256 서명 검증
   */
  protected validateCapabilityToken(
    token: CapabilityToken,
    requiredCapabilities: string[]
  ): Result<void, TokenError>;

  /**
   * callClaudeAPI() — Claude API 호출 (에이전트별 모델 자동 선택)
   *
   * @param systemPrompt — 시스템 프롬프트 (contract.md 자동 병합)
   * @param userMessage — 사용자 메시지
   * @param options — API 옵션
   *   - maxTokens?: 최대 출력 토큰 (기본 4096)
   *   - temperature?: 온도 (기본 1.0)
   *   - toolUse?: 도구 사용 활성화 (기본 false)
   *
   * @returns Promise<Result<string, APIError>>
   *   - Ok(text): API 응답 텍스트
   *   - Err(error): API 에러 (AGENT_TIMEOUT, RESOURCE_EXHAUSTED, INTERNAL_ERROR)
   *
   * 자동 처리:
   * - 모델 선택: this.model 사용
   * - 타임아웃: this.timeoutMs
   * - contract.md 자동 주입 (systemPrompt 앞에)
   * - 재시도 (지수 백오프, 최대 3회)
   * - 감사 로그 자동 기록 (tokens_used, cost_estimate)
   */
  protected callClaudeAPI(
    systemPrompt: string,
    userMessage: string,
    options?: {
      maxTokens?: number;
      temperature?: number;
      toolUse?: boolean;
    }
  ): Promise<Result<string, APIError>>;

  /**
   * validateOutput() — 출력 JSON 스키마 검증
   *
   * @param output — Claude API 출력 (텍스트, JSON 블록 추출 자동)
   * @param schema — 출력 Zod 스키마
   *
   * @returns Result<T, ValidationError>
   *   - Ok(data): 검증 성공 (파싱된 JSON)
   *   - Err(error): 스키마 불일치
   *
   * 처리:
   * - "```json ... ```" 블록 자동 추출
   * - JSON 파싱 실패 시 VALIDATION_FAILED 반환
   * - Zod 스키마로 타입 검증
   */
  protected validateOutput<T>(
    output: string,
    schema: ZodSchema<T>
  ): Result<T, ValidationError>;

  /**
   * logAudit() — 감사 로그 기록
   *
   * @param entry — AuditEntry
   *   - who: 에이전트 ID
   *   - what: 작업 설명
   *   - policy: PolicyDecision (선택)
   *   - capability: CapabilityToken (선택)
   *   - execution: 실행 세부정보 (선택)
   *   - result: 결과 (status|error|output)
   *
   * @returns Promise<Result<void, DBError>>
   *   - Ok(void): 로그 기록 성공
   *   - Err(error): 데이터베이스 에러
   *
   * 자동 처리:
   * - timestamp (현재 시간)
   * - 민감정보 마스킹 (tokens, passwords, API keys)
   * - 해시 체인 업데이트
   */
  protected logAudit(entry: AuditEntryInput): Promise<Result<void, DBError>>;

  /**
   * enforceCapability() — Capability Token 강제 (Phase 1+)
   *
   * 실행 전/후 토큰 상태 관리 (consume).
   *
   * @param token — CapabilityToken
   * @returns Promise<Result<void, TokenError>>
   *   - Ok(void): 토큰 소비 성공
   *   - Err(error): 토큰 무효
   *
   * 처리:
   * - 토큰 remaining_uses 감소
   * - remaining_uses === 0 → status = CONSUMED
   * - SHA-256 서명 재계산 (Phase 1+)
   * - 감사 로그에 TOKEN_CONSUMED 기록
   */
  protected enforceCapability(token: CapabilityToken): Promise<Result<void, TokenError>>;

  /**
   * getTimeout() — 타임아웃 값 반환
   *
   * @returns 타임아웃 (ms)
   */
  protected getTimeout(): number;

  /**
   * hasToolPermission() — 도구 권한 확인
   *
   * @param tool — 도구명
   * @returns boolean
   *   - true: this.tools에 포함
   *   - false: this.disallowedTools에 포함 or 미등록
   */
  protected hasToolPermission(tool: AgentTool): boolean;

  // ============================================================
  // 생명 주기 메서드
  // ============================================================

  /**
   * initialize() — 에이전트 초기화
   *
   * 선택: execute() 전에 호출 가능.
   * 예: API 클라이언트 생성, DB 연결 확인
   *
   * @returns Promise<Result<void, InitError>>
   */
  async initialize(): Promise<Result<void, InitError>>;

  /**
   * finalize() — 에이전트 정리
   *
   * 선택: execute() 후에 호출 가능.
   * 예: 리소스 정리, 로그 플러시
   *
   * @returns Promise<Result<void, CleanupError>>
   */
  async finalize(): Promise<Result<void, CleanupError>>;
}
```

---

## 구체적 에이전트 구현

### 1. OrchestratorAgent

```typescript
/**
 * OrchestratorAgent — 복잡도 분류 및 흐름 제어
 *
 * 역할: 요청 복잡도를 5단계로 분류하여 적절한 에이전트 경로 결정
 * 모델: claude-opus-4-6 (가장 복잡한 추론)
 * 도구: Read, Grep, Glob, Agent (다른 에이전트 호출 가능)
 * 금지: Edit, Write, Bash (쓰기, 실행 불가)
 *
 * Phase: 0 (필수)
 */
export class OrchestratorAgent extends BaseAgent {
  async execute(
    input: OrchestratorInput,
    context: XStateContext,
    capabilityToken?: CapabilityToken
  ): Promise<Result<OrchestratorOutput, AgentError>> {
    // 1. 입력 검증
    const validInput = this.validateInput(input, OrchestratorInputSchema);
    if (!validInput.ok) {
      return validInput;
    }

    // 2. 토큰 검증 (Phase 1+)
    if (capabilityToken) {
      const tokenCheck = this.validateCapabilityToken(
        capabilityToken,
        ['orchestrator.analyze']
      );
      if (!tokenCheck.ok) {
        return tokenCheck;
      }
    }

    // 3. Claude API 호출
    const response = await this.callClaudeAPI(
      `당신은 복잡도 분류 전문가입니다. 사용자 요청을 분석하여 다음 정보를 JSON으로 반환하세요:
       - complexity_level: LOW|MEDIUM|HIGH|CRITICAL (점수 기반)
       - estimated_tokens: 예상 토큰 수
       - required_agents: 필요한 에이전트 목록
       - gate_level: 요구되는 승인 레벨
       - reason: 분류 근거`,
      JSON.stringify(validInput.data)
    );

    if (!response.ok) {
      return response;
    }

    // 4. 출력 검증
    const output = this.validateOutput(
      response.data,
      OrchestratorOutputSchema
    );
    if (!output.ok) {
      return output;
    }

    // 5. 토큰 소비 (Phase 1+)
    if (capabilityToken) {
      const consumed = await this.enforceCapability(capabilityToken);
      if (!consumed.ok) {
        return consumed;
      }
    }

    // 6. 감사 로그
    await this.logAudit({
      who: this.agentId,
      what: `분류 완료: ${output.data.complexity_level}`,
      execution: {
        agent: 'orchestrator',
        input_hash: hashInput(validInput.data),
        output_hash: hashOutput(output.data),
        tokens_used: estimateTokens(response.data)
      },
      result: {
        status: 'success',
        output: output.data
      }
    });

    return Ok(output.data);
  }
}

/**
 * OrchestratorInput 스키마
 */
export const OrchestratorInputSchema = z.object({
  request: z.string().min(1),
  user_context: z.object({
    user_id: z.string(),
    trust_mode: z.enum(['observe', 'suggest', 'semi-auto', 'auto']),
    allowed_gate_levels: z.array(z.number())
  }),
  environment: z.object({
    os: z.enum(['windows', 'macos', 'linux']),
    available_resources: z.object({
      cpu_cores: z.number().positive(),
      memory_gb: z.number().positive()
    })
  })
});

export type OrchestratorInput = z.infer<typeof OrchestratorInputSchema>;

/**
 * OrchestratorOutput 스키마
 */
export const OrchestratorOutputSchema = z.object({
  complexity_level: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  complexity_score: z.number().min(1).max(100),
  estimated_tokens: z.number().positive(),
  required_agents: z.array(z.enum([
    'spec',
    'policy',
    'planner',
    'codegen',
    'review',
    'test',
    'executor',
    'rollback'
  ])),
  gate_level: z.number().min(0).max(3),
  gate_reasons: z.array(z.string()),
  recommended_trust_mode: z.enum(['observe', 'suggest', 'semi-auto', 'auto']),
  reason: z.string(),
  risks: z.array(z.object({
    code: z.string(),
    severity: z.enum(['LOW', 'MEDIUM', 'HIGH']),
    mitigation: z.string()
  }))
});

export type OrchestratorOutput = z.infer<typeof OrchestratorOutputSchema>;
```

### 2. SpecAgent

```typescript
/**
 * SpecAgent — 의도 분석 및 요구사항 명세
 *
 * 역할: 자연언어 요청을 구조화된 SPEC.md로 변환
 * 모델: claude-haiku-4-5-20251001 (빠른 분석)
 * 도구: Read, Grep, Glob (읽기만)
 * 금지: Edit, Write, Bash, Agent
 *
 * Phase: 0 (필수)
 */
export class SpecAgent extends BaseAgent {
  async execute(
    input: SpecInput,
    context: XStateContext,
    capabilityToken?: CapabilityToken
  ): Promise<Result<SpecOutput, AgentError>> {
    const validInput = this.validateInput(input, SpecInputSchema);
    if (!validInput.ok) return validInput;

    if (capabilityToken) {
      const tokenCheck = this.validateCapabilityToken(capabilityToken, ['spec.analyze']);
      if (!tokenCheck.ok) return tokenCheck;
    }

    const response = await this.callClaudeAPI(
      `당신은 요구사항 분석 전문가입니다. 사용자 요청을 분석하여 다음을 JSON으로 반환하세요:
       - title: 간단한 제목
       - acceptance_criteria: 수락 기준 배열
       - constraints: 제약사항 배열
       - success_metrics: 성공 지표
       - out_of_scope: 범위 외 항목`,
      JSON.stringify(validInput.data)
    );

    if (!response.ok) return response;

    const output = this.validateOutput(response.data, SpecOutputSchema);
    if (!output.ok) return output;

    if (capabilityToken) {
      const consumed = await this.enforceCapability(capabilityToken);
      if (!consumed.ok) return consumed;
    }

    await this.logAudit({
      who: this.agentId,
      what: `스펙 분석 완료: ${output.data.title}`,
      result: { status: 'success', output: output.data }
    });

    return Ok(output.data);
  }
}

export const SpecInputSchema = z.object({
  request: z.string().min(1)
});

export type SpecInput = z.infer<typeof SpecInputSchema>;

export const SpecOutputSchema = z.object({
  title: z.string(),
  acceptance_criteria: z.array(z.string()),
  constraints: z.array(z.string()),
  success_metrics: z.array(z.string()),
  out_of_scope: z.array(z.string()),
  assumptions: z.array(z.string())
});

export type SpecOutput = z.infer<typeof SpecOutputSchema>;
```

### 3. PolicyRiskAgent

```typescript
/**
 * PolicyRiskAgent — 정책 판정 및 위험도 평가
 *
 * 역할: Risk Score 계산, PolicyDecision 생성, Capability Token 발급
 * 모델: claude-opus-4-6 (정교한 판단)
 * 도구: Read, Grep, Glob
 * 금지: Edit, Write, Bash, Agent
 *
 * Phase: 0 (필수)
 * Phase 1+: Capability Token 발급 가능
 */
export class PolicyRiskAgent extends BaseAgent {
  async execute(
    input: PolicyRiskInput,
    context: XStateContext,
    capabilityToken?: CapabilityToken
  ): Promise<Result<PolicyRiskOutput, AgentError>> {
    const validInput = this.validateInput(input, PolicyRiskInputSchema);
    if (!validInput.ok) return validInput;

    if (capabilityToken) {
      const tokenCheck = this.validateCapabilityToken(capabilityToken, ['policy.judge']);
      if (!tokenCheck.ok) return tokenCheck;
    }

    const response = await this.callClaudeAPI(
      `당신은 정책 판정 전문가입니다. 다음을 분석하여 JSON으로 반환하세요:
       - risk_score: 0-100 (5차원 가중치 기반)
       - risk_level: LOW|MEDIUM|HIGH|CRITICAL
       - policy_decision: ALLOW|DENY|APPROVAL_REQUIRED|CONSTRAINED_ALLOW
       - requires_gates: 필요한 게이트 레벨
       - reason_codes: 판정 이유 코드 배열`,
      JSON.stringify(validInput.data)
    );

    if (!response.ok) return response;

    const output = this.validateOutput(response.data, PolicyRiskOutputSchema);
    if (!output.ok) return output;

    if (capabilityToken) {
      const consumed = await this.enforceCapability(capabilityToken);
      if (!consumed.ok) return consumed;
    }

    await this.logAudit({
      who: this.agentId,
      what: `정책 판정: ${output.data.policy_decision}`,
      policy: output.data,
      result: { status: 'success', output: output.data }
    });

    return Ok(output.data);
  }
}

export const PolicyRiskInputSchema = z.object({
  action_type: z.string(),
  context: z.object({
    system_impact: z.number().min(0).max(10),
    data_sensitivity: z.number().min(0).max(10),
    financial_impact: z.number().min(0).max(10),
    admin_privilege: z.number().min(0).max(10),
    external_network: z.number().min(0).max(10)
  })
});

export type PolicyRiskInput = z.infer<typeof PolicyRiskInputSchema>;

export const PolicyRiskOutputSchema = z.object({
  risk_score: z.number().min(0).max(100),
  risk_level: z.enum(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']),
  policy_decision: z.enum(['ALLOW', 'DENY', 'APPROVAL_REQUIRED', 'CONSTRAINED_ALLOW']),
  requires_gates: z.array(z.number()),
  reason_codes: z.array(z.string()),
  policy_sources: z.array(z.string()),
  human_explanation: z.string()
});

export type PolicyRiskOutput = z.infer<typeof PolicyRiskOutputSchema>;
```

### 4. PlannerAgent (생략, 유사 패턴)

```typescript
export class PlannerAgent extends BaseAgent {
  async execute(
    input: PlannerInput,
    context: XStateContext,
    capabilityToken?: CapabilityToken
  ): Promise<Result<PlanOutput, AgentError>> {
    // 입력 검증 → API 호출 → 출력 검증 → 토큰 소비 → 감사 로그
    // 특화: WBS(Work Breakdown Structure) + Task DAG 생성
  }
}
```

### 5. CodegenAgent

```typescript
/**
 * CodegenAgent — 코드 생성 및 ChangeSet 생성
 *
 * 역할: 계획을 실제 코드/스크립트로 변환 (구현은 없음, 설명만)
 * 모델: claude-sonnet-4-6
 * 도구: Read, Grep, Glob (쓰기는 명시적 승인 후에만)
 *
 * Phase: 0 (필수)
 */
export class CodegenAgent extends BaseAgent {
  async execute(
    input: CodegenInput,
    context: XStateContext,
    capabilityToken?: CapabilityToken
  ): Promise<Result<CodegenOutput, AgentError>> {
    const validInput = this.validateInput(input, CodegenInputSchema);
    if (!validInput.ok) return validInput;

    if (capabilityToken) {
      const tokenCheck = this.validateCapabilityToken(capabilityToken, ['codegen.generate']);
      if (!tokenCheck.ok) return tokenCheck;
    }

    const response = await this.callClaudeAPI(
      `당신은 코드 생성 전문가입니다. 다음 계획을 기반으로 ChangeSet을 생성하세요.
       ChangeSet은 다음을 포함해야 합니다:
       - files_added: 생성할 파일 목록
       - files_modified: 수정할 파일 목록
       - files_deleted: 삭제할 파일 목록
       - diff: 각 파일의 diff (unidiff 형식)`,
      JSON.stringify(validInput.data)
    );

    if (!response.ok) return response;

    const output = this.validateOutput(response.data, CodegenOutputSchema);
    if (!output.ok) return output;

    if (capabilityToken) {
      const consumed = await this.enforceCapability(capabilityToken);
      if (!consumed.ok) return consumed;
    }

    await this.logAudit({
      who: this.agentId,
      what: `코드 생성: ${output.data.files_added.length}개 파일 추가, ${output.data.files_modified.length}개 수정`,
      execution: {
        agent: 'codegen',
        changeset_hash: hashChangeSet(output.data)
      },
      result: { status: 'success', output: output.data }
    });

    return Ok(output.data);
  }
}

export const CodegenInputSchema = z.object({
  plan: z.object({
    tasks: z.array(z.object({
      id: z.string(),
      description: z.string(),
      files_involved: z.array(z.string())
    }))
  })
});

export type CodegenInput = z.infer<typeof CodegenInputSchema>;

export const CodegenOutputSchema = z.object({
  files_added: z.array(z.object({
    path: z.string(),
    content: z.string()
  })),
  files_modified: z.array(z.object({
    path: z.string(),
    diff: z.string() // unidiff 형식
  })),
  files_deleted: z.array(z.string()),
  summary: z.string()
});

export type CodegenOutput = z.infer<typeof CodegenOutputSchema>;
```

### 6-9. 다른 에이전트

ReviewAgent, TestBuildAgent, ExecutorAgent, RollbackAgent도 동일한 패턴을 따른다.

---

## 공유 유틸리티 메서드

### AgentError 타입 (모든 에이전트가 사용)

```typescript
/**
 * AgentError — 에이전트 실행 에러
 *
 * .claude/design/error-catalog.md 참고
 */
export enum AgentErrorCode {
  AGENT_TIMEOUT = 'AGENT_TIMEOUT',              // 타임아웃
  VALIDATION_FAILED = 'VALIDATION_FAILED',      // 입력/출력 스키마 검증 실패
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED',    // API 할당량 초과
  INTERNAL_ERROR = 'INTERNAL_ERROR',            // Claude API 내부 에러
  POLICY_DENIED = 'POLICY_DENIED',              // 정책 거부
  TOKEN_INVALID = 'TOKEN_INVALID',              // Capability Token 무효
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',              // 토큰 만료
  TOKEN_SCOPE_MISMATCH = 'TOKEN_SCOPE_MISMATCH', // 토큰 스코프 불일치
  HASH_MISMATCH = 'HASH_MISMATCH',              // 해시 체인 오류 (감사 로그)
  DB_ERROR = 'DB_ERROR'                         // 데이터베이스 에러
}

export interface AgentError {
  code: AgentErrorCode;
  message: string;
  details?: Record<string, unknown>;
  timestamp: Date;
  agentId: string;
}
```

### BaseAgentConfig 타입

```typescript
export interface BaseAgentConfig {
  agentId: string;
  agentRole: AgentRole;
  model: ClaudeModel;
  tools: readonly AgentTool[];
  disallowedTools: readonly AgentTool[];
  permissionMode: PermissionMode;
  maxTurns: number;
  timeoutMs?: number; // 기본 300000 (5분)
}

export type AgentRole =
  | 'orchestrator'
  | 'spec'
  | 'policy'
  | 'planner'
  | 'codegen'
  | 'review'
  | 'test'
  | 'executor'
  | 'rollback';

export type ClaudeModel =
  | 'claude-opus-4-6'
  | 'claude-sonnet-4-6'
  | 'claude-haiku-4-5-20251001';

export type AgentTool =
  | 'Read'
  | 'Grep'
  | 'Glob'
  | 'Agent'
  | 'Edit'
  | 'Write'
  | 'Bash';

export type PermissionMode =
  | 'observe'
  | 'suggest'
  | 'semi-auto'
  | 'auto';
```

### BaseAgentDependencies

```typescript
export interface BaseAgentDependencies {
  auditLog: AuditLogService;
  policyEngine: PolicyEngine;
  capabilityTokenManager?: CapabilityTokenManager; // Phase 1+
}

export interface AuditLogService {
  record(entry: AuditEntry): Promise<Result<void, DBError>>;
  query(filter: AuditQueryFilter): Promise<Result<AuditEntry[], DBError>>;
}

export interface PolicyEngine {
  evaluate(input: PolicyInput): Promise<Result<PolicyDecision, AgentError>>;
}

export interface CapabilityTokenManager {
  validate(token: CapabilityToken, requiredCaps: string[]): Promise<Result<void, TokenError>>;
  consume(token: CapabilityToken): Promise<Result<void, TokenError>>;
  issue(config: CapabilityConfig): Promise<Result<CapabilityToken, TokenError>>;
}
```

---

## 에이전트별 execute 서명

각 에이전트가 execute()를 구현할 때 따라야 할 서명과 절차:

| 에이전트 | 입력 스키마 | 출력 스키마 | 필수 도구 | Capability |
|---------|-----------|-----------|---------|-----------|
| **Orchestrator** | OrchestratorInput | OrchestratorOutput | Read, Grep, Glob | orchestrator.analyze |
| **SpecAgent** | SpecInput | SpecOutput | Read, Grep, Glob | spec.analyze |
| **PolicyRiskAgent** | PolicyRiskInput | PolicyRiskOutput | Read, Grep, Glob | policy.judge |
| **PlannerAgent** | PlannerInput | PlanOutput | Read, Grep, Glob | planner.plan |
| **CodegenAgent** | CodegenInput | CodegenOutput | Read, Grep, Glob | codegen.generate |
| **ReviewAgent** | ReviewInput | ReviewOutput | Read, Grep, Glob | review.audit |
| **TestBuildAgent** | TestInput | TestOutput | Read, Bash, Grep | test.run |
| **ExecutorAgent** | ExecutorInput | ExecutorOutput | Read, Edit, Write, Bash | executor.run |
| **RollbackAgent** | RollbackInput | RollbackOutput | Read, Edit, Write, Bash | rollback.abort |

---

## 구현 예시

### Phase 0 최소 구현

```typescript
// packages/agents/src/base-agent.ts

import { Result, Ok, Err } from '@jarvis-os/shared';
import { z, ZodSchema } from 'zod';

/**
 * BaseAgent — 모든 에이전트의 기반 클래스
 *
 * Phase 0: Claude API 호출, 스키마 검증, 감사 로깅 지원
 * Phase 1: Capability Token 강제 추가
 */
export abstract class BaseAgent {
  protected readonly config: BaseAgentConfig;
  protected readonly dependencies: BaseAgentDependencies;

  constructor(config: BaseAgentConfig, dependencies: BaseAgentDependencies) {
    this.config = config;
    this.dependencies = dependencies;
  }

  abstract execute(
    input: unknown,
    context: unknown,
    capabilityToken?: unknown
  ): Promise<Result<unknown, unknown>>;

  // Protected 헬퍼 구현은 Phase 0에서 최소화
  protected validateInput<T>(
    input: unknown,
    schema: ZodSchema<T>
  ): Result<T, any> {
    try {
      const data = schema.parse(input);
      return Ok(data);
    } catch (error) {
      return Err({
        code: 'VALIDATION_FAILED',
        message: String(error)
      });
    }
  }

  protected async callClaudeAPI(
    systemPrompt: string,
    userMessage: string,
    options?: any
  ): Promise<Result<string, any>> {
    // Phase 0: Placeholder (실제 구현은 packages/core에서)
    return Err({
      code: 'INTERNAL_ERROR',
      message: 'callClaudeAPI not yet implemented'
    });
  }

  protected validateOutput<T>(
    output: string,
    schema: ZodSchema<T>
  ): Result<T, any> {
    try {
      const jsonMatch = output.match(/```json\n([\s\S]*?)\n```/);
      const jsonStr = jsonMatch ? jsonMatch[1] : output;
      const data = JSON.parse(jsonStr);
      return Ok(schema.parse(data));
    } catch (error) {
      return Err({
        code: 'VALIDATION_FAILED',
        message: `JSON parsing or schema validation failed: ${error}`
      });
    }
  }

  protected async logAudit(entry: any): Promise<Result<void, any>> {
    // Phase 0: Placeholder
    return Ok(undefined);
  }
}
```

---

## 추가 참고

- **contract.md**: 모든 에이전트가 system prompt에 자동 주입되는 공통 계약서
- **error-catalog.md**: 각 에러 코드의 복구 전략
- **.claude/design/claude-api-guide.md**: API 호출 패턴 상세
- **test-scenarios.md**: 통합 테스트 시나리오 (실제 에이전트 흐름 검증)

