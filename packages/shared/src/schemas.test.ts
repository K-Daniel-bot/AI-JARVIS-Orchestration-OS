/**
 * Zod 스키마 단위 테스트
 * 유효한 입력의 파싱 성공, 잘못된 입력의 파싱 실패를 검증한다.
 */

import { describe, it, expect } from 'vitest';
import {
  PolicyDecisionSchema,
  CapabilityTokenSchema,
  ActionSchema,
  AuditEntrySchema,
  AgentMessageSchema,
} from './schemas.js';

// ─────────────────────────────────────────
// PolicyDecision 스키마 테스트
// ─────────────────────────────────────────

describe('PolicyDecisionSchema', () => {
  const validPolicyDecision = {
    decision_id: 'pd_20260302_abc123def456',
    timestamp: '2026-03-02T00:00:00.000Z',
    subject: {
      user_id: 'user-001',
      role: 'Owner' as const,
      device: 'macbook-pro',
      session_id: 'sess-001',
    },
    request: {
      raw_input: '파일을 읽어줘',
      intent: 'FILE_OPERATION',
      targets: ['/workspace/project/src/main.ts'],
      requires_web_access: false,
      requires_login: false,
    },
    outcome: {
      status: 'ALLOW' as const,
      risk_score: 20,
      risk_level: 'LOW' as const,
      requires_gates: [],
      reason_codes: ['LOW_RISK_FILE_READ'],
      human_explanation: '낮은 위험도의 파일 읽기 작업입니다.',
    },
    constraints: {
      fs: {
        read_allow: ['/workspace/**'],
        write_allow: [],
        write_deny: ['/Windows/**', '/System/**'],
      },
      exec: {
        allow: ['node', 'git'],
        deny: ['sudo', 'regedit'],
      },
      network: {
        allow_domains: [],
        deny_domains: ['banking.*'],
        default_policy: 'DENY',
      },
    },
    required_capabilities: [
      {
        cap: 'fs.read',
        scope: '/workspace/project/**',
        ttl_seconds: 900,
        max_uses: 1,
      },
    ],
    audit: {
      log_level: 'FULL' as const,
      redactions: ['secrets', 'tokens'],
    },
  };

  it('유효한 PolicyDecision을 파싱해야 한다', () => {
    const result = PolicyDecisionSchema.safeParse(validPolicyDecision);
    expect(result.success).toBe(true);
  });

  it('risk_score가 100을 초과하면 파싱에 실패해야 한다', () => {
    const invalid = {
      ...validPolicyDecision,
      outcome: { ...validPolicyDecision.outcome, risk_score: 150 },
    };
    const result = PolicyDecisionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('잘못된 decision_id 형식이면 파싱에 실패해야 한다', () => {
    const invalid = { ...validPolicyDecision, decision_id: 'wrong_id_format' };
    const result = PolicyDecisionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('잘못된 role이면 파싱에 실패해야 한다', () => {
    const invalid = {
      ...validPolicyDecision,
      subject: { ...validPolicyDecision.subject, role: 'SuperAdmin' },
    };
    const result = PolicyDecisionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────
// CapabilityToken 스키마 테스트
// ─────────────────────────────────────────

describe('CapabilityTokenSchema', () => {
  const validToken = {
    token_id: 'cap_20260302_abc123def456',
    issued_at: '2026-03-02T00:00:00.000Z',
    issued_by: 'policy-risk',
    approved_by: 'user',
    grant: {
      cap: 'fs.read',
      scope: '/workspace/**',
      ttl_seconds: 900,
      max_uses: 1,
    },
    context: {
      session_id: 'sess-001',
      run_id: 'run_20260302_abc123def456',
      policy_decision_id: 'pd_20260302_abc123def456',
      trust_mode: 'semi-auto' as const,
    },
    status: 'ACTIVE' as const,
  };

  it('유효한 CapabilityToken을 파싱해야 한다', () => {
    const result = CapabilityTokenSchema.safeParse(validToken);
    expect(result.success).toBe(true);
  });

  it('consumed_at이 있는 토큰을 파싱해야 한다', () => {
    const consumed = {
      ...validToken,
      status: 'CONSUMED' as const,
      consumed_at: '2026-03-02T00:01:00.000Z',
      consumed_by_action: 'act_20260302_abc123def456',
    };
    const result = CapabilityTokenSchema.safeParse(consumed);
    expect(result.success).toBe(true);
  });

  it('잘못된 token_id 형식이면 파싱에 실패해야 한다', () => {
    const invalid = { ...validToken, token_id: 'tok_wrong_format' };
    const result = CapabilityTokenSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('잘못된 status이면 파싱에 실패해야 한다', () => {
    const invalid = { ...validToken, status: 'PENDING' };
    const result = CapabilityTokenSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────
// Action 스키마 테스트
// ─────────────────────────────────────────

describe('ActionSchema', () => {
  const validAction = {
    action_id: 'act_20260302_abc123def456',
    type: 'FS_READ' as const,
    params: { path: '/workspace/project/src/main.ts' },
    requires_capabilities: ['cap_20260302_abc123def456'],
    risk_tags: ['FILE_READ'],
    preconditions: ['file_exists'],
    postconditions: ['file_content_available'],
    evidence: {
      capture_screenshot: false,
      capture_stdout: true,
    },
  };

  it('유효한 Action을 파싱해야 한다', () => {
    const result = ActionSchema.safeParse(validAction);
    expect(result.success).toBe(true);
  });

  it('잘못된 ActionType이면 파싱에 실패해야 한다', () => {
    const invalid = { ...validAction, type: 'INVALID_TYPE' };
    const result = ActionSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('모바일 액션 타입을 파싱해야 한다', () => {
    const mobileAction = {
      ...validAction,
      action_id: 'act_20260302_bcd234ef5678',
      type: 'MOBILE_CALL_DIAL' as const,
      params: { phone_number: '+82-10-1234-5678' },
      risk_tags: ['MOBILE', 'PHONE_CALL'],
    };
    const result = ActionSchema.safeParse(mobileAction);
    expect(result.success).toBe(true);
  });
});

// ─────────────────────────────────────────
// AgentMessage 스키마 테스트
// ─────────────────────────────────────────

describe('AgentMessageSchema', () => {
  const validMessage = {
    message_id: 'msg_20260302_abc123def456',
    from_agent: 'codegen' as const,
    to_agent: 'review' as const,
    message_type: 'HANDOFF' as const,
    timestamp: '2026-03-02T00:00:00.000Z',
    run_id: 'run_20260302_abc123def456',
    payload: {
      artifact_type: 'CHANGESET' as const,
      artifact_ref: 'cs_20260302_abc123def456',
      summary: '인증 모듈 코드 생성 완료',
      metadata: { files_added: 2, files_modified: 1 },
    },
    timeout_ms: 30000,
    retry_policy: {
      max_retries: 3,
      backoff_ms: 1000,
    },
  };

  it('유효한 AgentMessage를 파싱해야 한다', () => {
    const result = AgentMessageSchema.safeParse(validMessage);
    expect(result.success).toBe(true);
  });

  it('잘못된 에이전트 이름이면 파싱에 실패해야 한다', () => {
    const invalid = { ...validMessage, from_agent: 'unknown-agent' };
    const result = AgentMessageSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('잘못된 message_id 형식이면 파싱에 실패해야 한다', () => {
    const invalid = { ...validMessage, message_id: 'message_wrong' };
    const result = AgentMessageSchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});

// ─────────────────────────────────────────
// AuditEntry 스키마 테스트
// ─────────────────────────────────────────

describe('AuditEntrySchema', () => {
  const validAuditEntry = {
    audit_id: 'aud_20260302_abc123def456',
    timestamp: '2026-03-02T00:00:00.000Z',
    log_level: 'FULL' as const,
    who: {
      user_id: 'user-001',
      role: 'Owner' as const,
      session_id: 'sess-001',
    },
    what: {
      raw_input: '파일을 읽어줘',
      ai_interpretation: '파일 시스템 읽기 작업 요청',
      intent: 'FILE_OPERATION',
    },
    policy: {
      policy_decision_id: 'pd_20260302_abc123def456',
      risk_score: 20,
      risk_level: 'LOW' as const,
      status: 'ALLOW' as const,
    },
    capability: {
      token_ids: ['cap_20260302_abc123def456'],
      scopes_granted: ['/workspace/**'],
    },
    execution: {
      run_id: 'run_20260302_abc123def456',
      actions_performed: [
        {
          action_id: 'act_20260302_abc123def456',
          type: 'FS_READ',
          status: 'SUCCESS' as const,
          duration_ms: 120,
        },
      ],
      rollback_performed: false,
    },
    result: {
      status: 'COMPLETED' as const,
      output_summary: '파일 읽기 성공',
      artifacts: ['/workspace/project/src/main.ts'],
    },
    evidence: {
      screenshots: [],
      terminal_logs: ['log_ref_001'],
    },
    redactions: {
      applied: ['secrets'],
      patterns_matched: 0,
    },
    integrity: {
      hash: 'sha256:abc123',
      previous_hash: 'sha256:previous123',
    },
  };

  it('유효한 AuditEntry를 파싱해야 한다', () => {
    const result = AuditEntrySchema.safeParse(validAuditEntry);
    expect(result.success).toBe(true);
  });

  it('잘못된 audit_id 형식이면 파싱에 실패해야 한다', () => {
    const invalid = { ...validAuditEntry, audit_id: 'audit_wrong_format' };
    const result = AuditEntrySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });

  it('integrity.hash가 sha256: 접두사 없으면 파싱에 실패해야 한다', () => {
    const invalid = {
      ...validAuditEntry,
      integrity: {
        hash: 'abc123without_prefix',
        previous_hash: 'sha256:previous',
      },
    };
    const result = AuditEntrySchema.safeParse(invalid);
    expect(result.success).toBe(false);
  });
});
