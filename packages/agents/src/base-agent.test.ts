/**
 * BaseAgent 단위 테스트
 * 공통 기반 클래스의 callClaude, logAudit, createResponse 메서드를 검증한다.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BaseAgent } from './base-agent.js';
import type { AgentInput, AgentOutput } from './base-agent.js';
import type { AgentConfig } from '@jarvis/core';
import type { Result } from '@jarvis/shared';
import { JarvisError } from '@jarvis/shared';

// ─────────────────────────────────────────
// 테스트용 ConcreteAgent 구현
// ─────────────────────────────────────────

/** BaseAgent 테스트를 위한 최소 구현체 */
class ConcreteTestAgent extends BaseAgent {
  async execute(
    input: AgentInput,
  ): Promise<Result<AgentOutput, JarvisError>> {
    return {
      ok: true,
      value: {
        artifactType: 'SPEC',
        artifactRef: 'test_ref',
        summary: '테스트 산출물',
        data: { input },
        metadata: {},
      },
    };
  }

  /** callClaude를 외부에서 테스트할 수 있도록 공개 */
  public callClaudePublic(params: {
    systemPrompt: string;
    userMessage: string;
    maxTokens?: number;
  }) {
    return this.callClaude(params);
  }

  /** createResponse를 외부에서 테스트할 수 있도록 공개 */
  public createResponsePublic(params: {
    toAgent: Parameters<BaseAgent['createResponse']>[0]['toAgent'];
    runId: string;
    artifactType: Parameters<BaseAgent['createResponse']>[0]['artifactType'];
    artifactRef: string;
    summary: string;
  }) {
    return this.createResponse(params);
  }

  /** logAudit를 외부에서 테스트할 수 있도록 공개 */
  public logAuditPublic(params: {
    runId: string;
    action: string;
    result: string;
  }) {
    return this.logAudit(params);
  }
}

// ─────────────────────────────────────────
// 테스트 픽스처
// ─────────────────────────────────────────

/** 테스트용 AgentConfig */
const TEST_CONFIG: AgentConfig = {
  name: 'spec-agent',
  model: 'claude-haiku-4-5-20251001',
  role: '테스트 에이전트',
  tools: [],
  permissionMode: 'read-only',
  maxTurns: 10,
};

/** 테스트용 AgentInput */
const TEST_INPUT: AgentInput = {
  runId: 'run_20260302_test',
  sessionId: 'sess_20260302_test',
  message: {
    message_id: 'msg_20260302_test',
    from_agent: 'orchestrator',
    to_agent: 'spec-agent',
    message_type: 'HANDOFF',
    timestamp: '2026-03-02T00:00:00.000Z',
    run_id: 'run_20260302_test',
    payload: {
      artifact_type: 'SPEC',
      artifact_ref: 'test_spec',
      summary: '테스트 사용자 요청',
      metadata: {},
    },
    timeout_ms: 60000,
    retry_policy: { max_retries: 2, backoff_ms: 5000 },
  },
  context: {},
};

// ─────────────────────────────────────────
// 테스트 스위트
// ─────────────────────────────────────────

describe('BaseAgent', () => {
  let agent: ConcreteTestAgent;

  beforeEach(() => {
    agent = new ConcreteTestAgent(TEST_CONFIG);
  });

  describe('생성자', () => {
    it('config를 올바르게 초기화해야 한다', () => {
      expect(agent.config.name).toBe('spec-agent');
      expect(agent.config.model).toBe('claude-haiku-4-5-20251001');
      expect(agent.config.permissionMode).toBe('read-only');
    });
  });

  describe('callClaude', () => {
    it('ANTHROPIC_API_KEY 미설정 시 스텁 응답을 반환해야 한다', async () => {
      // ANTHROPIC_API_KEY 제거
      const originalKey = process.env['ANTHROPIC_API_KEY'];
      delete process.env['ANTHROPIC_API_KEY'];

      const result = await agent.callClaudePublic({
        systemPrompt: '테스트 시스템 프롬프트',
        userMessage: '테스트 사용자 메시지',
      });

      expect(result.ok).toBe(true);
      if (result.ok) {
        const parsed = JSON.parse(result.value) as { stub: boolean; agent: string };
        expect(parsed.stub).toBe(true);
        expect(parsed.agent).toBe('spec-agent');
      }

      // 원래 값 복구
      if (originalKey !== undefined) {
        process.env['ANTHROPIC_API_KEY'] = originalKey;
      }
    });

    it('빈 API 키로도 스텁 응답을 반환해야 한다', async () => {
      const originalKey = process.env['ANTHROPIC_API_KEY'];
      process.env['ANTHROPIC_API_KEY'] = '';

      const result = await agent.callClaudePublic({
        systemPrompt: '시스템',
        userMessage: '메시지',
      });

      expect(result.ok).toBe(true);

      if (originalKey !== undefined) {
        process.env['ANTHROPIC_API_KEY'] = originalKey;
      } else {
        delete process.env['ANTHROPIC_API_KEY'];
      }
    });
  });

  describe('createResponse', () => {
    it('올바른 AgentMessage 구조를 생성해야 한다', () => {
      const response = agent.createResponsePublic({
        toAgent: 'orchestrator',
        runId: 'run_test_001',
        artifactType: 'SPEC',
        artifactRef: 'spec_test_001',
        summary: '테스트 요약',
      });

      expect(response.from_agent).toBe('spec-agent');
      expect(response.to_agent).toBe('orchestrator');
      expect(response.message_type).toBe('RESPONSE');
      expect(response.run_id).toBe('run_test_001');
      expect(response.payload.artifact_type).toBe('SPEC');
      expect(response.payload.artifact_ref).toBe('spec_test_001');
      expect(response.payload.summary).toBe('테스트 요약');
    });

    it('message_id가 유효한 형식이어야 한다', () => {
      const response = agent.createResponsePublic({
        toAgent: 'orchestrator',
        runId: 'run_test_001',
        artifactType: 'PLAN',
        artifactRef: 'plan_test_001',
        summary: '계획 요약',
      });

      expect(response.message_id).toMatch(/^msg_/);
    });

    it('retry_policy가 기본값으로 설정되어야 한다', () => {
      const response = agent.createResponsePublic({
        toAgent: 'orchestrator',
        runId: 'run_test',
        artifactType: 'SPEC',
        artifactRef: 'spec_test',
        summary: '요약',
      });

      expect(response.retry_policy.max_retries).toBe(2);
      expect(response.retry_policy.backoff_ms).toBe(5000);
    });
  });

  describe('logAudit', () => {
    it('감사 로그가 에러 없이 기록되어야 한다', () => {
      const writeSpy = vi.spyOn(process.stdout, 'write').mockReturnValue(true);

      agent.logAuditPublic({
        runId: 'run_test_001',
        action: '테스트 액션',
        result: 'SUCCESS',
      });

      expect(writeSpy).toHaveBeenCalledOnce();
      const callArg = writeSpy.mock.calls[0]?.[0] as string;
      expect(callArg).toContain('[AUDIT]');
      expect(callArg).toContain('run_test_001');

      writeSpy.mockRestore();
    });
  });

  describe('execute', () => {
    it('테스트 구현체가 성공 Result를 반환해야 한다', async () => {
      const result = await agent.execute(TEST_INPUT);

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.artifactType).toBe('SPEC');
        expect(result.value.artifactRef).toBe('test_ref');
      }
    });
  });
});
