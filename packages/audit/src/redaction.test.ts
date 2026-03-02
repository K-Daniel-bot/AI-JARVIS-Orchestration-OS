// 민감 정보 마스킹 단위 테스트 — 각 패턴별 마스킹 동작 및 엣지 케이스 검증
import { describe, it, expect } from 'vitest';
import { redactSensitiveData, redactAuditEntry } from './redaction.js';
import type { AuditEntry } from '@jarvis/shared';

describe('redactSensitiveData', () => {
  it('민감 데이터가 없는 텍스트는 변경하지 않아야 한다', () => {
    // Arrange
    const text = '일반적인 텍스트 내용입니다.';

    // Act
    const result = redactSensitiveData(text);

    // Assert
    expect(result.redacted).toBe(text);
    expect(result.patternsMatched).toBe(0);
    expect(result.appliedTypes).toHaveLength(0);
  });

  it('JWT 토큰을 마스킹해야 한다', () => {
    // Arrange
    const jwt =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
    const text = `Authorization: Bearer ${jwt}`;

    // Act
    const result = redactSensitiveData(text);

    // Assert
    expect(result.redacted).toContain('[REDACTED_JWT]');
    expect(result.redacted).not.toContain(jwt);
    expect(result.patternsMatched).toBeGreaterThan(0);
    expect(result.appliedTypes).toContain('jwt_token');
  });

  it('신용카드 번호를 마스킹해야 한다', () => {
    // Arrange
    const text = '카드번호: 1234-5678-9012-3456';

    // Act
    const result = redactSensitiveData(text);

    // Assert
    expect(result.redacted).toContain('[REDACTED_CC]');
    expect(result.redacted).not.toContain('1234-5678-9012-3456');
    expect(result.appliedTypes).toContain('credit_card');
  });

  it('이메일 주소를 마스킹해야 한다', () => {
    // Arrange
    const text = '담당자: user@example.com 으로 연락하세요';

    // Act
    const result = redactSensitiveData(text);

    // Assert
    expect(result.redacted).toContain('[REDACTED_EMAIL]');
    expect(result.redacted).not.toContain('user@example.com');
    expect(result.appliedTypes).toContain('email');
  });

  it('전화번호 중간 4자리를 마스킹해야 한다', () => {
    // Arrange
    const text = '연락처: 010-1234-5678';

    // Act
    const result = redactSensitiveData(text);

    // Assert
    expect(result.redacted).toContain('010-****-5678');
    expect(result.redacted).not.toContain('010-1234-5678');
    expect(result.appliedTypes).toContain('phone_number');
  });

  it('SSH 키를 마스킹해야 한다', () => {
    // Arrange
    const text =
      '-----BEGIN RSA PRIVATE KEY-----\nMIIEowIBAAKCAQEA\n-----END RSA PRIVATE KEY-----';

    // Act
    const result = redactSensitiveData(text);

    // Assert
    expect(result.redacted).toContain('[REDACTED_SSH_KEY]');
    expect(result.redacted).not.toContain('MIIEowIBAAKCAQEA');
    expect(result.appliedTypes).toContain('ssh_key');
  });

  it('여러 민감 패턴이 동시에 존재하면 모두 마스킹해야 한다', () => {
    // Arrange
    const text =
      '이메일: admin@example.com, 전화: 010-9876-5432';

    // Act
    const result = redactSensitiveData(text);

    // Assert
    expect(result.redacted).toContain('[REDACTED_EMAIL]');
    expect(result.redacted).toContain('010-****-5432');
    expect(result.appliedTypes).toContain('email');
    expect(result.appliedTypes).toContain('phone_number');
  });

  it('patternsMatched는 실제 일치 횟수를 반환해야 한다', () => {
    // Arrange — 이메일 2개 포함
    const text =
      'admin@example.com 및 user@test.com 두 개의 이메일';

    // Act
    const result = redactSensitiveData(text);

    // Assert
    expect(result.patternsMatched).toBeGreaterThanOrEqual(2);
  });
});

describe('redactAuditEntry', () => {
  /** 테스트용 기본 감사 엔트리 생성 */
  function makePartialEntry(
    rawInput: string,
    outputSummary: string
  ): Omit<AuditEntry, 'audit_id' | 'integrity'> {
    return {
      timestamp: '2026-03-01T12:00:00.000Z',
      log_level: 'FULL',
      who: {
        user_id: 'user_001',
        role: 'Owner',
        session_id: 'sess_001',
      },
      what: {
        raw_input: rawInput,
        ai_interpretation: '해석된 내용',
        intent: 'TEST',
      },
      policy: {
        policy_decision_id: 'pd_001',
        risk_score: 10,
        risk_level: 'LOW',
        status: 'ALLOW',
      },
      capability: {
        token_ids: [],
        scopes_granted: [],
      },
      execution: {
        run_id: 'run_001',
        actions_performed: [],
        rollback_performed: false,
        rollback_reason: null,
      },
      result: {
        status: 'COMPLETED',
        output_summary: outputSummary,
        artifacts: [],
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
    };
  }

  it('raw_input의 민감 정보를 마스킹해야 한다', () => {
    // Arrange
    const entry = makePartialEntry(
      '이메일 admin@example.com 로 전송해줘',
      '전송 완료'
    );

    // Act
    const { redactedEntry } = redactAuditEntry(entry);

    // Assert
    expect(redactedEntry.what.raw_input).toContain('[REDACTED_EMAIL]');
    expect(redactedEntry.what.raw_input).not.toContain('admin@example.com');
  });

  it('output_summary의 민감 정보를 마스킹해야 한다', () => {
    // Arrange
    const entry = makePartialEntry(
      '처리 요청',
      '010-1234-5678 로 알림 발송 완료'
    );

    // Act
    const { redactedEntry } = redactAuditEntry(entry);

    // Assert
    expect(redactedEntry.result.output_summary).toContain('010-****-5678');
    expect(redactedEntry.result.output_summary).not.toContain('010-1234-5678');
  });

  it('마스킹 정보(redactions)를 올바르게 반환해야 한다', () => {
    // Arrange
    const entry = makePartialEntry(
      '이메일 user@test.com 로 연락',
      '완료'
    );

    // Act
    const { redactions } = redactAuditEntry(entry);

    // Assert
    expect(redactions.applied).toContain('email');
    expect(redactions.patterns_matched).toBeGreaterThan(0);
  });

  it('민감 정보가 없으면 엔트리 내용이 변경되지 않아야 한다', () => {
    // Arrange
    const rawInput = '파일을 읽어주세요';
    const outputSummary = '파일 읽기 완료';
    const entry = makePartialEntry(rawInput, outputSummary);

    // Act
    const { redactedEntry, redactions } = redactAuditEntry(entry);

    // Assert
    expect(redactedEntry.what.raw_input).toBe(rawInput);
    expect(redactedEntry.result.output_summary).toBe(outputSummary);
    expect(redactions.patterns_matched).toBe(0);
  });
});
