// 감사 로그 통합 테스트 — createAuditLogger 전체 파이프라인 검증
// 임시 인메모리(:memory:) SQLite 사용으로 실제 파일 시스템 의존성 제거
import { describe, it, expect, beforeEach } from 'vitest';
import { createAuditLogger } from './audit-log.js';
import type { AuditLogger, AuditQueryFilter } from './audit-log.js';
import type { AuditEntry } from '@jarvis/shared';

/** 테스트용 감사 엔트리 입력 생성 — audit_id, timestamp, integrity 제외 */
function makeEntryInput(
  overrides: Partial<Omit<AuditEntry, 'audit_id' | 'timestamp' | 'integrity'>> = {}
): Omit<AuditEntry, 'audit_id' | 'timestamp' | 'integrity'> {
  return {
    log_level: 'FULL',
    who: {
      user_id: 'user_001',
      role: 'Owner',
      session_id: 'sess_test_001',
    },
    what: {
      raw_input: '테스트 요청입니다',
      ai_interpretation: '파일 작업 요청',
      intent: 'FILE_OPERATION',
    },
    policy: {
      policy_decision_id: 'pd_test_001',
      risk_score: 20,
      risk_level: 'LOW',
      status: 'ALLOW',
    },
    capability: {
      token_ids: ['tok_001'],
      scopes_granted: ['fs.read'],
    },
    execution: {
      run_id: 'run_test_001',
      actions_performed: [
        {
          action_id: 'act_001',
          type: 'FS_READ',
          status: 'SUCCESS',
          duration_ms: 50,
        },
      ],
      rollback_performed: false,
      rollback_reason: null,
    },
    result: {
      status: 'COMPLETED',
      output_summary: '파일 읽기 완료',
      artifacts: ['/project/src/index.ts'],
    },
    evidence: {
      screenshots: [],
      terminal_logs: [],
      previous_action_id: null,
    },
    redactions: {
      applied: [],
      patterns_matched: 0,
    },
    ...overrides,
  };
}

describe('createAuditLogger', () => {
  // 각 테스트마다 새 인메모리 DB 생성
  let logger: AuditLogger;

  beforeEach(() => {
    // :memory: 경로는 better-sqlite3가 지원하는 인메모리 DB
    logger = createAuditLogger(':memory:');
  });

  describe('record', () => {
    it('감사 엔트리를 성공적으로 기록해야 한다', async () => {
      // Arrange
      const input = makeEntryInput();

      // Act
      const result = await logger.record(input);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.audit_id).toMatch(/^aud_/);
        expect(result.value.timestamp).toBeTruthy();
        expect(result.value.integrity.hash).toHaveLength(64);
        expect(result.value.integrity.previous_hash).toHaveLength(64);
      }
    });

    it('첫 번째 엔트리의 previous_hash는 GENESIS_HASH여야 한다', async () => {
      // Arrange
      const GENESIS_HASH = '0'.repeat(64);
      const input = makeEntryInput();

      // Act
      const result = await logger.record(input);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.integrity.previous_hash).toBe(GENESIS_HASH);
      }
    });

    it('두 번째 엔트리의 previous_hash는 첫 번째 엔트리의 hash여야 한다', async () => {
      // Arrange
      const input = makeEntryInput();

      // Act
      const first = await logger.record(input);
      const second = await logger.record(makeEntryInput({ what: { ...input.what, raw_input: '두 번째 요청' } }));

      // Assert
      expect(first.ok).toBe(true);
      expect(second.ok).toBe(true);
      if (first.ok && second.ok) {
        expect(second.value.integrity.previous_hash).toBe(
          first.value.integrity.hash
        );
      }
    });

    it('민감한 이메일 주소가 마스킹되어야 한다', async () => {
      // Arrange
      const input = makeEntryInput({
        what: {
          raw_input: 'admin@secret.com 에게 전송',
          ai_interpretation: '이메일 전송 요청',
          intent: 'SEND_EMAIL',
        },
      });

      // Act
      const result = await logger.record(input);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.what.raw_input).toContain('[REDACTED_EMAIL]');
        expect(result.value.what.raw_input).not.toContain(
          'admin@secret.com'
        );
      }
    });

    it('log_level이 FULL인 엔트리를 기록해야 한다', async () => {
      // Arrange
      const input = makeEntryInput({ log_level: 'FULL' });

      // Act
      const result = await logger.record(input);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.log_level).toBe('FULL');
      }
    });
  });

  describe('verifyIntegrity', () => {
    it('빈 데이터베이스는 무결성 검증을 통과해야 한다', async () => {
      // Act
      const result = await logger.verifyIntegrity();

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });

    it('단일 엔트리 기록 후 무결성 검증을 통과해야 한다', async () => {
      // Arrange
      await logger.record(makeEntryInput());

      // Act
      const result = await logger.verifyIntegrity();

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });

    it('다중 엔트리 기록 후 체인 무결성 검증을 통과해야 한다', async () => {
      // Arrange — 3개 엔트리 순차 기록
      await logger.record(makeEntryInput());
      await logger.record(
        makeEntryInput({
          what: { raw_input: '두 번째', ai_interpretation: '해석', intent: 'TEST' },
        })
      );
      await logger.record(
        makeEntryInput({
          what: { raw_input: '세 번째', ai_interpretation: '해석', intent: 'TEST' },
        })
      );

      // Act
      const result = await logger.verifyIntegrity();

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBe(true);
      }
    });
  });

  describe('query', () => {
    it('저장된 엔트리 목록을 조회해야 한다', async () => {
      // Arrange
      await logger.record(makeEntryInput());
      await logger.record(makeEntryInput());

      // Act
      const result = await logger.query({});

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(2);
      }
    });

    it('limit 필터가 조회 수를 제한해야 한다', async () => {
      // Arrange
      await logger.record(makeEntryInput());
      await logger.record(makeEntryInput());
      await logger.record(makeEntryInput());

      const filter: AuditQueryFilter = { limit: 2 };

      // Act
      const result = await logger.query(filter);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.length).toBeLessThanOrEqual(2);
      }
    });

    it('빈 데이터베이스 조회 시 빈 배열을 반환해야 한다', async () => {
      // Act
      const result = await logger.query({});

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toHaveLength(0);
      }
    });
  });

  describe('getById', () => {
    it('존재하는 audit_id로 엔트리를 조회해야 한다', async () => {
      // Arrange
      const recordResult = await logger.record(makeEntryInput());
      expect(recordResult.ok).toBe(true);

      if (!recordResult.ok) return;
      const auditId = recordResult.value.audit_id;

      // Act
      const result = await logger.getById(auditId);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).not.toBeNull();
        if (result.value !== null) {
          expect(result.value.audit_id).toBe(auditId);
        }
      }
    });

    it('존재하지 않는 audit_id는 null을 반환해야 한다', async () => {
      // Act
      const result = await logger.getById('aud_nonexistent_id');

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value).toBeNull();
      }
    });
  });
});
