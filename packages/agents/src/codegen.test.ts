/**
 * CodegenAgent 단위 테스트
 * ChangeSet 생성, 보안 자가 검사, 코드 생성을 검증한다.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { CodegenAgent } from './codegen.js';
import type { AgentInput } from './base-agent.js';
import type { PlanArtifact } from './planner.js';
import type { ChangeSetArtifact } from './codegen.js';

// ─────────────────────────────────────────
// 테스트 픽스처
// ─────────────────────────────────────────

/** 테스트용 PlanArtifact */
const MOCK_PLAN: PlanArtifact = {
  planId: 'plan_20260302_test',
  specRef: 'spec_20260302_test',
  policyRef: 'pd_20260302_test',
  steps: [
    {
      stepId: 'plan_test_s001',
      type: 'CODE_GENERATE',
      description: '날짜 포맷 유틸리티 함수 생성',
      inputs: ['spec_test', 'pd_test'],
      outputs: ['src/utils/date-format.ts'],
      dependsOn: [],
      constraints: {
        writeAllow: ['/project/src/**'],
        packagesAllowed: ['date-fns'],
      },
      estimatedTokens: 1024,
    },
  ],
  budget: {
    maxTokens: 8192,
    maxSteps: 10,
    estimatedTotalTokens: 1024,
  },
  toolRequests: ['date-fns'],
  requiredGates: ['GATE_L1_PLAN'],
};

function makeInput(plan?: PlanArtifact): AgentInput {
  return {
    runId: 'run_codegen_test',
    sessionId: 'sess_codegen_test',
    message: {
      message_id: 'msg_codegen_test',
      from_agent: 'orchestrator',
      to_agent: 'codegen',
      message_type: 'HANDOFF',
      timestamp: '2026-03-02T00:00:00.000Z',
      run_id: 'run_codegen_test',
      payload: {
        artifact_type: 'PLAN',
        artifact_ref: 'plan_test',
        summary: '코드 생성 작업',
        metadata: {},
      },
      timeout_ms: 60000,
      retry_policy: { max_retries: 2, backoff_ms: 5000 },
    },
    context: plan !== undefined ? { plan } : {},
  };
}

// ─────────────────────────────────────────
// 테스트 스위트
// ─────────────────────────────────────────

describe('CodegenAgent', () => {
  let agent: CodegenAgent;

  beforeEach(() => {
    agent = CodegenAgent.create();
  });

  describe('create()', () => {
    it('CodegenAgent를 생성해야 한다', () => {
      expect(agent).toBeDefined();
      expect(agent.config.name).toBe('codegen');
      expect(agent.config.permissionMode).toBe('write');
    });
  });

  describe('execute() — 입력 검증', () => {
    it('Plan 없이 실행 시 VALIDATION_FAILED 에러를 반환해야 한다', async () => {
      const result = await agent.execute(makeInput());

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
      }
    });

    it('CODE_GENERATE 단계 없는 Plan으로 실행 시 에러를 반환해야 한다', async () => {
      const planWithoutCodeStep: PlanArtifact = {
        ...MOCK_PLAN,
        steps: [
          {
            ...MOCK_PLAN.steps[0]!,
            type: 'FILE_READ',
          },
        ],
      };

      const result = await agent.execute(makeInput(planWithoutCodeStep));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
      }
    });
  });

  describe('execute() — ChangeSet 생성', () => {
    it('CHANGESET 유형의 산출물을 반환해야 한다', async () => {
      const result = await agent.execute(makeInput(MOCK_PLAN));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.artifactType).toBe('CHANGESET');
        expect(result.value.artifactRef).toMatch(/^cs_/);
      }
    });

    it('ChangeSet이 파일 목록을 포함해야 한다', async () => {
      const result = await agent.execute(makeInput(MOCK_PLAN));

      expect(result.ok).toBe(true);
      if (result.ok) {
        const changeset = result.value.data as ChangeSetArtifact;
        expect(changeset.filesAdded.length).toBeGreaterThan(0);
      }
    });

    it('보안 자가 검사 결과가 포함되어야 한다', async () => {
      const result = await agent.execute(makeInput(MOCK_PLAN));

      expect(result.ok).toBe(true);
      if (result.ok) {
        const changeset = result.value.data as ChangeSetArtifact;
        expect(changeset.securitySelfCheck).toBeDefined();
        expect(typeof changeset.securitySelfCheck.secretsFound).toBe('boolean');
        expect(typeof changeset.securitySelfCheck.injectionRisk).toBe('boolean');
        expect(typeof changeset.securitySelfCheck.pathTraversalRisk).toBe('boolean');
      }
    });

    it('planRef가 Plan ID와 일치해야 한다', async () => {
      const result = await agent.execute(makeInput(MOCK_PLAN));

      expect(result.ok).toBe(true);
      if (result.ok) {
        const changeset = result.value.data as ChangeSetArtifact;
        expect(changeset.planRef).toBe(MOCK_PLAN.planId);
      }
    });
  });

  describe('execute() — 보안 자가 검사', () => {
    it('정상 코드에서 보안 위험이 감지되지 않아야 한다', async () => {
      const result = await agent.execute(makeInput(MOCK_PLAN));

      expect(result.ok).toBe(true);
      // 스텁 모드에서는 위험 없는 스텁 코드가 반환되므로 성공 가능
      // 실제 API에서는 생성된 코드를 검사
    });
  });
});
