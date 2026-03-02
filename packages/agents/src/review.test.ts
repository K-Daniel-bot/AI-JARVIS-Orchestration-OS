/**
 * ReviewAgent 단위 테스트
 * PASS/NEEDS_FIX/REJECT 판정, 보안 스캔, 품질 점수를 검증한다.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ReviewAgent } from './review.js';
import type { AgentInput } from './base-agent.js';
import type { ChangeSetArtifact } from './codegen.js';
import type { ReviewArtifact } from './review.js';

// ─────────────────────────────────────────
// 테스트 픽스처
// ─────────────────────────────────────────

/** 안전한 테스트용 ChangeSet */
const SAFE_CHANGESET: ChangeSetArtifact = {
  changesetId: 'cs_20260302_test',
  planRef: 'plan_20260302_test',
  stepRef: 'plan_test_s001',
  filesAdded: [
    {
      path: 'src/utils/format.ts',
      content: `// 날짜 포맷 유틸리티 함수
export function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}`,
    },
  ],
  filesModified: [],
  diff: '+export function formatDate(date: Date): string {',
  migrationNotes: '',
  securitySelfCheck: {
    secretsFound: false,
    injectionRisk: false,
    pathTraversalRisk: false,
    dynamicCodeRisk: false,
    detectedPatterns: [],
  },
};

/** 위험한 테스트용 ChangeSet (시크릿 포함) */
const DANGEROUS_CHANGESET: ChangeSetArtifact = {
  ...SAFE_CHANGESET,
  changesetId: 'cs_20260302_danger',
  filesAdded: [
    {
      path: 'src/config.ts',
      content: `// 설정 파일
const apiKey = "sk-prod-1234567890abcdef1234567890abcdef";
export { apiKey };`,
    },
  ],
  securitySelfCheck: {
    secretsFound: true,
    injectionRisk: false,
    pathTraversalRisk: false,
    dynamicCodeRisk: false,
    detectedPatterns: ['HARDCODED_SECRET'],
  },
};

/** eval() 포함 ChangeSet */
const EVAL_CHANGESET: ChangeSetArtifact = {
  ...SAFE_CHANGESET,
  changesetId: 'cs_20260302_eval',
  filesAdded: [
    {
      path: 'src/dynamic.ts',
      content: `// 동적 코드 실행
export function run(code: string): unknown {
  return eval(code);
}`,
    },
  ],
  securitySelfCheck: {
    secretsFound: false,
    injectionRisk: true,
    pathTraversalRisk: false,
    dynamicCodeRisk: false,
    detectedPatterns: ['INJECTION_RISK'],
  },
};

function makeInput(changeset?: ChangeSetArtifact): AgentInput {
  return {
    runId: 'run_review_test',
    sessionId: 'sess_review_test',
    message: {
      message_id: 'msg_review_test',
      from_agent: 'orchestrator',
      to_agent: 'review',
      message_type: 'HANDOFF',
      timestamp: '2026-03-02T00:00:00.000Z',
      run_id: 'run_review_test',
      payload: {
        artifact_type: 'CHANGESET',
        artifact_ref: 'cs_test',
        summary: '코드 검토 요청',
        metadata: {},
      },
      timeout_ms: 60000,
      retry_policy: { max_retries: 2, backoff_ms: 5000 },
    },
    context: changeset !== undefined ? { changeset } : {},
  };
}

// ─────────────────────────────────────────
// 테스트 스위트
// ─────────────────────────────────────────

describe('ReviewAgent', () => {
  let agent: ReviewAgent;

  beforeEach(() => {
    agent = ReviewAgent.create();
  });

  describe('create()', () => {
    it('ReviewAgent를 생성해야 한다', () => {
      expect(agent).toBeDefined();
      expect(agent.config.name).toBe('review');
      expect(agent.config.permissionMode).toBe('read-only');
    });
  });

  describe('execute() — 입력 검증', () => {
    it('ChangeSet 없이 실행 시 VALIDATION_FAILED 에러를 반환해야 한다', async () => {
      const result = await agent.execute(makeInput());

      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
      }
    });
  });

  describe('execute() — 안전한 코드 검토', () => {
    it('안전한 ChangeSet에 대해 PASS 판정을 내려야 한다', async () => {
      const result = await agent.execute(makeInput(SAFE_CHANGESET));

      expect(result.ok).toBe(true);
      if (result.ok) {
        const review = result.value.data as ReviewArtifact;
        expect(review.verdict).toBe('PASS');
        expect(review.recommended).toBe(true);
      }
    });

    it('REVIEW 유형의 산출물을 반환해야 한다', async () => {
      const result = await agent.execute(makeInput(SAFE_CHANGESET));

      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.artifactType).toBe('REVIEW');
        expect(result.value.artifactRef).toMatch(/^rev_/);
      }
    });

    it('품질 점수가 0~100 범위여야 한다', async () => {
      const result = await agent.execute(makeInput(SAFE_CHANGESET));

      expect(result.ok).toBe(true);
      if (result.ok) {
        const review = result.value.data as ReviewArtifact;
        expect(review.qualityScore.total).toBeGreaterThanOrEqual(0);
        expect(review.qualityScore.total).toBeLessThanOrEqual(100);
      }
    });
  });

  describe('execute() — 위험한 코드 검토', () => {
    it('시크릿이 포함된 코드를 REJECT 판정해야 한다', async () => {
      const result = await agent.execute(makeInput(DANGEROUS_CHANGESET));

      expect(result.ok).toBe(true);
      if (result.ok) {
        const review = result.value.data as ReviewArtifact;
        expect(review.verdict).toBe('REJECT');
        expect(review.recommended).toBe(false);
        expect(review.blockers.length).toBeGreaterThan(0);
      }
    });

    it('인젝션 위험이 있는 코드를 REJECT 판정해야 한다', async () => {
      const result = await agent.execute(makeInput(EVAL_CHANGESET));

      expect(result.ok).toBe(true);
      if (result.ok) {
        const review = result.value.data as ReviewArtifact;
        expect(review.verdict).toBe('REJECT');
        expect(review.blockers.some((b) => b.ruleId.startsWith('SEC_'))).toBe(true);
      }
    });
  });

  describe('execute() — 보안 스캔', () => {
    it('보안 스캔 결과가 포함되어야 한다', async () => {
      const result = await agent.execute(makeInput(SAFE_CHANGESET));

      expect(result.ok).toBe(true);
      if (result.ok) {
        const review = result.value.data as ReviewArtifact;
        expect(review.securityScan).toBeDefined();
        expect(typeof review.securityScan.secretsExposed).toBe('boolean');
        expect(typeof review.securityScan.injectionVulnerability).toBe('boolean');
      }
    });
  });
});
