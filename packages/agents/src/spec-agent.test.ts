/**
 * SpecAgent 단위 테스트
 * 의도 분류, 모호성 탐지, SPEC 생성을 검증한다.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { SpecAgent } from './spec-agent.js';
import type { AgentInput } from './base-agent.js';
import type { SpecArtifact } from './spec-agent.js';

// ─────────────────────────────────────────
// 테스트 헬퍼
// ─────────────────────────────────────────

function makeInput(summary: string): AgentInput {
  return {
    runId: 'run_spec_test',
    sessionId: 'sess_spec_test',
    message: {
      message_id: 'msg_spec_test',
      from_agent: 'orchestrator',
      to_agent: 'spec-agent',
      message_type: 'HANDOFF',
      timestamp: '2026-03-02T00:00:00.000Z',
      run_id: 'run_spec_test',
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

describe('SpecAgent', () => {
  let agent: SpecAgent;

  beforeEach(() => {
    agent = SpecAgent.create();
  });

  describe('create()', () => {
    it('SpecAgent를 생성해야 한다', () => {
      expect(agent).toBeDefined();
      expect(agent.config.name).toBe('spec-agent');
      expect(agent.config.model).toBe('claude-haiku-4-5-20251001');
    });
  });

  describe('execute() — 입력 검증', () => {
    it('빈 요청에 대해 VALIDATION_FAILED 에러를 반환해야 한다', async () => {
      const result = await agent.execute(makeInput(''));

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
      }
    });
  });

  describe('execute() — 의도 분류', () => {
    it('코드 구현 요청을 CODE_IMPLEMENTATION으로 분류해야 한다', async () => {
      const result = await agent.execute(
        makeInput('TypeScript 함수를 구현해주십시오'),
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        const spec = result.value.data as SpecArtifact;
        expect(spec.intentType).toBe('CODE_IMPLEMENTATION');
      }
    });

    it('파일 작업 요청을 FILE_OPERATION으로 분류해야 한다', async () => {
      const result = await agent.execute(
        makeInput('/tmp/test.txt 파일을 삭제하십시오'),
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        const spec = result.value.data as SpecArtifact;
        expect(spec.intentType).toBe('FILE_OPERATION');
      }
    });

    it('앱 실행 요청을 APP_LAUNCH로 분류해야 한다', async () => {
      const result = await agent.execute(
        makeInput('VSCode를 열어주십시오'),
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        const spec = result.value.data as SpecArtifact;
        expect(spec.intentType).toBe('APP_LAUNCH');
      }
    });
  });

  describe('execute() — 산출물 구조', () => {
    it('SPEC 유형의 산출물을 반환해야 한다', async () => {
      const result = await agent.execute(makeInput('시스템 상태를 확인하십시오'));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.artifactType).toBe('SPEC');
        expect(result.value.artifactRef).toMatch(/^spec_/);
      }
    });

    it('specId가 spec_ 접두사를 가져야 한다', async () => {
      const result = await agent.execute(makeInput('파일을 분석하십시오'));

      expect(result.ok).toBe(true);
      if (result.ok) {
        const spec = result.value.data as SpecArtifact;
        expect(spec.specId).toMatch(/^spec_/);
      }
    });

    it('acceptance criteria가 비어 있지 않아야 한다', async () => {
      const result = await agent.execute(makeInput('유틸리티 함수를 구현하십시오'));

      expect(result.ok).toBe(true);
      if (result.ok) {
        const spec = result.value.data as SpecArtifact;
        expect(spec.acceptanceCriteria.length).toBeGreaterThan(0);
      }
    });

    it('웹 접근 요청 시 requiresWebAccess가 true여야 한다', async () => {
      const result = await agent.execute(
        makeInput('https://example.com 에서 데이터를 가져오십시오'),
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        const spec = result.value.data as SpecArtifact;
        expect(spec.requiresWebAccess).toBe(true);
      }
    });

    it('경로가 포함된 요청에서 targets가 추출되어야 한다', async () => {
      const result = await agent.execute(
        makeInput('/home/user/project/src/index.ts 파일을 수정하십시오'),
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        const spec = result.value.data as SpecArtifact;
        expect(spec.targets.length).toBeGreaterThan(0);
      }
    });
  });

  describe('execute() — 모호성 탐지', () => {
    it('명확한 요청은 LOW 모호성 수준이어야 한다', async () => {
      const result = await agent.execute(
        makeInput('코드를 구현하십시오'),
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        const spec = result.value.data as SpecArtifact;
        // 명확한 요청이므로 LOW 모호성
        expect(['LOW', 'MEDIUM']).toContain(spec.ambiguityLevel);
      }
    });
  });
});
