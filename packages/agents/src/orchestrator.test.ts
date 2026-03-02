/**
 * OrchestratorAgent 단위 테스트
 * 복잡도 분류, Task DAG 생성, 게이트 결정을 검증한다.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { OrchestratorAgent } from './orchestrator.js';
import { ComplexityLevel } from '@jarvis/core';
import type { AgentInput } from './base-agent.js';

// ─────────────────────────────────────────
// 테스트 헬퍼
// ─────────────────────────────────────────

/** AgentInput 생성 헬퍼 */
function makeInput(summary: string): AgentInput {
  return {
    runId: 'run_20260302_orch_test',
    sessionId: 'sess_20260302_test',
    message: {
      message_id: 'msg_20260302_test',
      from_agent: 'orchestrator',
      to_agent: 'orchestrator',
      message_type: 'REQUEST',
      timestamp: '2026-03-02T00:00:00.000Z',
      run_id: 'run_20260302_orch_test',
      payload: {
        artifact_type: 'SPEC',
        artifact_ref: 'spec_test',
        summary,
        metadata: {},
      },
      timeout_ms: 60000,
      retry_policy: { max_retries: 2, backoff_ms: 5000 },
    },
    context: {},
  };
}

// ─────────────────────────────────────────
// 테스트 스위트
// ─────────────────────────────────────────

describe('OrchestratorAgent', () => {
  let agent: OrchestratorAgent;

  beforeEach(() => {
    agent = OrchestratorAgent.create();
  });

  describe('create()', () => {
    it('OrchestratorAgent를 생성해야 한다', () => {
      expect(agent).toBeDefined();
      expect(agent.config.name).toBe('orchestrator');
      expect(agent.config.model).toBe('claude-opus-4-6');
    });
  });

  describe('execute() — 복잡도 분류', () => {
    it('빈 요청에 대해 VALIDATION_FAILED 에러를 반환해야 한다', async () => {
      const result = await agent.execute(makeInput(''));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
      }
    });

    it('단순 조회 요청을 L1_SIMPLE로 분류해야 한다', async () => {
      const result = await agent.execute(makeInput('현재 시스템 상태를 확인하십시오'));

      expect(result.ok).toBe(true);
      if (result.ok) {
        const plan = result.value.data as { complexity: { level: string } };
        expect(plan.complexity.level).toBe(ComplexityLevel.L1_SIMPLE);
      }
    });

    it('코드 생성 요청을 L2_MODERATE 이상으로 분류해야 한다', async () => {
      const result = await agent.execute(
        makeInput('TypeScript 유틸리티 함수를 구현하십시오'),
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        const plan = result.value.data as { complexity: { level: string } };
        expect([
          ComplexityLevel.L2_MODERATE,
          ComplexityLevel.L3_COMPLEX,
          ComplexityLevel.L4_DANGEROUS,
        ]).toContain(plan.complexity.level);
      }
    });

    it('위험 키워드 포함 요청을 L4_DANGEROUS로 분류해야 한다', async () => {
      const result = await agent.execute(
        makeInput('관리자 권한으로 시스템 설정을 변경하십시오'),
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        const plan = result.value.data as { complexity: { level: string } };
        expect(plan.complexity.level).toBe(ComplexityLevel.L4_DANGEROUS);
      }
    });

    it('빌드/테스트 요청을 L3_COMPLEX로 분류해야 한다', async () => {
      const result = await agent.execute(
        makeInput('프로젝트를 빌드하고 테스트를 실행하십시오'),
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        const plan = result.value.data as { complexity: { level: string } };
        expect(plan.complexity.level).toBe(ComplexityLevel.L3_COMPLEX);
      }
    });
  });

  describe('execute() — 산출물 구조', () => {
    it('PLAN 유형의 산출물을 반환해야 한다', async () => {
      const result = await agent.execute(makeInput('파일 목록을 확인하십시오'));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.artifactType).toBe('PLAN');
        expect(result.value.artifactRef).toMatch(/^orch_/);
      }
    });

    it('Task DAG가 빈 배열이 아니어야 한다', async () => {
      const result = await agent.execute(makeInput('파일을 확인하십시오'));

      expect(result.ok).toBe(true);
      if (result.ok) {
        const plan = result.value.data as { taskDag: unknown[] };
        expect(plan.taskDag.length).toBeGreaterThan(0);
      }
    });

    it('L4 복잡도에서 게이트 목록이 3개여야 한다', async () => {
      const result = await agent.execute(
        makeInput('admin 권한으로 시스템 파일을 수정하십시오'),
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        const plan = result.value.data as { requiresGates: string[] };
        expect(plan.requiresGates.length).toBe(3);
      }
    });

    it('L1 복잡도에서 게이트가 없어야 한다', async () => {
      const result = await agent.execute(makeInput('목록을 보여주십시오'));

      expect(result.ok).toBe(true);
      if (result.ok) {
        const plan = result.value.data as { requiresGates: string[] };
        expect(plan.requiresGates.length).toBe(0);
      }
    });
  });
});
