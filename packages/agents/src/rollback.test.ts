/**
 * RollbackAgent 단위 테스트
 * 롤백 실행, Token 무효화, Postmortem 생성을 검증한다.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { RollbackAgent } from './rollback.js';
import type { AgentInput } from './base-agent.js';
import type { RollbackArtifact } from './rollback.js';

// ─────────────────────────────────────────
// 테스트 헬퍼
// ─────────────────────────────────────────

function makeInput(
  errorMessage: string,
  failedAgent: string,
): AgentInput {
  return {
    runId: 'run_rollback_test',
    sessionId: 'sess_rollback_test',
    message: {
      message_id: 'msg_rollback_test',
      from_agent: 'orchestrator',
      to_agent: 'rollback',
      message_type: 'HANDOFF',
      timestamp: '2026-03-02T00:00:00.000Z',
      run_id: 'run_rollback_test',
      payload: {
        artifact_type: 'ROLLBACK_LOG',
        artifact_ref: 'rollback_test',
        summary: '롤백 요청',
        metadata: {},
      },
      timeout_ms: 60000,
      retry_policy: { max_retries: 2, backoff_ms: 5000 },
    },
    context: {
      errorMessage,
      failedAgent,
    },
  };
}

// ─────────────────────────────────────────
// 테스트 스위트
// ─────────────────────────────────────────

describe('RollbackAgent', () => {
  let agent: RollbackAgent;

  beforeEach(() => {
    agent = RollbackAgent.create();
  });

  describe('create()', () => {
    it('RollbackAgent를 생성해야 한다', () => {
      expect(agent).toBeDefined();
      expect(agent.config.name).toBe('rollback');
      expect(agent.config.model).toBe('claude-haiku-4-5-20251001');
    });
  });

  describe('execute() — 롤백 실행', () => {
    it('정책 위반 에러에 대한 롤백을 성공해야 한다', async () => {
      const result = await agent.execute(
        makeInput('계약서 §1 위반: 시스템 파일 접근 시도', 'executor'),
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.artifactType).toBe('ROLLBACK_LOG');
        expect(result.value.artifactRef).toMatch(/^pm_/);
      }
    });

    it('빌드 실패 에러의 근본 원인을 BUILD_FAILURE로 분류해야 한다', async () => {
      const result = await agent.execute(
        makeInput('TypeScript 컴파일 에러: cannot find module', 'codegen'),
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        const artifact = result.value.data as RollbackArtifact;
        expect(artifact.postmortem.rootCause.category).toBe('BUILD_FAILURE');
      }
    });

    it('토큰 만료 에러의 근본 원인을 TOKEN_EXPIRED로 분류해야 한다', async () => {
      const result = await agent.execute(
        makeInput('Capability token has expired', 'executor'),
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        const artifact = result.value.data as RollbackArtifact;
        expect(artifact.postmortem.rootCause.category).toBe('TOKEN_EXPIRED');
      }
    });

    it('Postmortem에 권고 사항이 포함되어야 한다', async () => {
      const result = await agent.execute(
        makeInput('알 수 없는 에러 발생', 'planner'),
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        const artifact = result.value.data as RollbackArtifact;
        expect(artifact.postmortem.recommendations.length).toBeGreaterThan(0);
      }
    });

    it('ROLLBACK_LOG 유형의 산출물을 반환해야 한다', async () => {
      const result = await agent.execute(
        makeInput('테스트 실패', 'test-build'),
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.artifactType).toBe('ROLLBACK_LOG');
      }
    });

    it('Postmortem에 실패 에이전트 이름이 기록되어야 한다', async () => {
      const result = await agent.execute(
        makeInput('에러 발생', 'policy-risk'),
      );

      expect(result.ok).toBe(true);
      if (result.ok) {
        const artifact = result.value.data as RollbackArtifact;
        expect(artifact.postmortem.failedAgent).toBe('policy-risk');
      }
    });
  });

  describe('emergencyRevokeAll()', () => {
    it('비상 토큰 무효화가 에러 없이 완료되어야 한다', () => {
      // 빈 저장소에서는 0개 무효화
      const count = agent.emergencyRevokeAll('sess_emergency_test');
      expect(typeof count).toBe('number');
      expect(count).toBeGreaterThanOrEqual(0);
    });
  });
});
