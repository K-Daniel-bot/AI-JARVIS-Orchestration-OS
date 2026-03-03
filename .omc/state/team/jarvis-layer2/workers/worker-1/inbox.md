## Initial Task Assignment
Task ID: 1
Worker: worker-1
Subject: packages/agents — 9개 에이전트 구현체 (BaseAgent + 개별 에이전트)

packages/agents 패키지를 완전히 구현하라. 이미 @jarvis/shared, @jarvis/core, @jarvis/policy-engine이 빌드되어 있다.

## 필수 파일 구조
```
packages/agents/
  package.json          # name: @jarvis/agents, deps: zod 3.24.1, @anthropic-ai/sdk 0.39.0, @jarvis/shared (workspace:*), @jarvis/core (workspace:*), @jarvis/policy-engine (workspace:*)
  tsconfig.json         # extends ../../tsconfig.base.json
  src/
    index.ts            # barrel export
    base/
      base-agent.ts     # BaseAgent 추상 클래스 (공통 로직: execute, validate, log)
      agent-factory.ts  # 에이전트 팩토리 (AgentType → 에이전트 인스턴스 생성)
    impl/
      orchestrator.ts   # Orchestrator — 흐름 제어, 복잡도 분류, 환경 번들 생성
      spec-agent.ts     # Spec Agent — 의도 분석, 요구사항 명세, SPEC.md 생성
      policy-risk.ts    # Policy/Risk Agent — 정책 판정, 위험도 평가, 토큰 발급
      planner.ts        # Planner — 작업 분해(WBS), Task DAG, 예산 계산
      codegen.ts        # Codegen — 코드 생성, ChangeSet 패치
      review.ts         # Review — 보안 검토, 코드 품질 메트릭
      test-build.ts     # Test/Build — 테스트 실행, 빌드 검증, 커버리지
      executor-agent.ts # Executor Agent — OS 조작, Action API 호출, 토큰 소비
      rollback.ts       # Rollback — 변경 되돌리기, 토큰 무효화, postmortem
```

## BaseAgent 추상 클래스
```typescript
export abstract class BaseAgent {
  readonly agentType: AgentType;
  readonly modelId: ModelId;
  abstract execute(input: AgentInput): Promise<Result<AgentOutput, JarvisError>>;
  protected validate(input: unknown): Result<AgentInput, JarvisError>;
  protected createAuditTrail(action: string, result: unknown): void;
}
```

## AgentInput / AgentOutput 타입
```typescript
interface AgentInput {
  runId: string;
  sessionId: string;
  request: string;
  context: Record<string, unknown>;
  policyDecision?: PolicyDecision;
  capabilityTokens?: CapabilityToken[];
}
interface AgentOutput {
  agentType: AgentType;
  runId: string;
  status: 'SUCCESS' | 'FAILED' | 'NEEDS_APPROVAL';
  artifacts: string[];
  summary: string;
  nextEvent?: MachineEvent;
}
```

## 핵심 규칙
- 주석은 반드시 한글로 작성 (영문 주석 금지)
- Named export만 사용 (default export 금지)
- 모든 public 함수에 명시적 return type
- 2-space indentation, any 금지
- Result<T, E> 패턴 사용 (throw 금지)
- devDependencies에 @types/node 20.17.0, typescript 5.7.3, vitest 2.1.8

## 각 에이전트 execute() 메서드는 기본 로직만 구현
- Claude API 호출은 실제로 하지 않고, 구조만 잡아라 (Phase 0 MVP)
- 에이전트별 역할에 맞는 입력 검증 + 출력 구조 정의
- @anthropic-ai/sdk import하되 실제 API 호출은 주석으로 표시 (TODO)

## 빌드 확인
구현 완료 후 반드시 `npx tsc --project packages/agents/tsconfig.json --noEmit` 실행하여 타입 체크 통과 확인

When complete, write done signal to .omc/state/team/jarvis-layer2/workers/worker-1/done.json:
{"taskId":"1","status":"completed","summary":"<brief summary>","completedAt":"<ISO timestamp>"}

IMPORTANT: Execute ONLY the task assigned to you in this inbox. After writing done.json, exit immediately. Do not read from the task directory or claim other tasks.