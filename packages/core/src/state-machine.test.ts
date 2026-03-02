// state-machine 테스트 — 상태 전이, 종료 상태, Gate 상태 검증
import { describe, it, expect } from 'vitest';
import { createActor } from 'xstate';
import {
  jarvisMachine,
  JarvisState,
  isFinalState,
  isGateState,
  isAgentWorkState,
  getStateDescription,
} from './state-machine.js';
import type { JarvisError } from './state-machine.js';

// ────────────────────────────────────────────────────────────
// 테스트 헬퍼 — 더미 PolicyDecision 생성
// ────────────────────────────────────────────────────────────

function makeDummyPolicyDecision(status: string, riskScore = 20) {
  return {
    decision_id: 'pd_test_001',
    timestamp: new Date().toISOString(),
    subject: {
      user_id: 'test-user',
      role: 'Owner' as const,
      device: 'test-device',
      session_id: 'test-session',
    },
    request: {
      raw_input: '테스트 요청',
      intent: 'CODE_IMPLEMENTATION',
      targets: ['src/test.ts'],
      requires_web_access: false,
      requires_login: false,
    },
    outcome: {
      status,
      risk_score: riskScore,
      risk_level: 'LOW' as const,
      requires_gates: [],
      reason_codes: [],
      human_explanation: '테스트 판정',
    },
    constraints: {
      fs: { read_allow: ['**'], write_allow: ['src/**'], write_deny: [] },
      exec: { allow: ['node'], deny: ['sudo'] },
      network: { allow_domains: [], deny_domains: [], default_policy: 'DENY' },
    },
    required_capabilities: [],
    audit: { log_level: 'SUMMARY' as const, redactions: [] },
  };
}

function makeDummyError(): JarvisError {
  return {
    code: 'INTERNAL_ERROR',
    message: '테스트 에러',
    details: { test: true },
  };
}

// ────────────────────────────────────────────────────────────
// 상태 머신 초기 상태 테스트
// ────────────────────────────────────────────────────────────

describe('jarvisMachine 초기 상태', () => {
  it('IDLE 상태로 시작해야 한다', () => {
    const actor = createActor(jarvisMachine);
    actor.start();
    expect(actor.getSnapshot().value).toBe(JarvisState.IDLE);
    actor.stop();
  });

  it('초기 컨텍스트의 runId는 빈 문자열이어야 한다', () => {
    const actor = createActor(jarvisMachine);
    actor.start();
    expect(actor.getSnapshot().context.runId).toBe('');
    actor.stop();
  });

  it('초기 컨텍스트의 riskScore는 0이어야 한다', () => {
    const actor = createActor(jarvisMachine);
    actor.start();
    expect(actor.getSnapshot().context.riskScore).toBe(0);
    actor.stop();
  });

  it('초기 currentAgent는 null이어야 한다', () => {
    const actor = createActor(jarvisMachine);
    actor.start();
    expect(actor.getSnapshot().context.currentAgent).toBeNull();
    actor.stop();
  });
});

// ────────────────────────────────────────────────────────────
// IDLE → SPEC_ANALYSIS 전이 테스트
// ────────────────────────────────────────────────────────────

describe('USER_REQUEST 이벤트', () => {
  it('IDLE에서 USER_REQUEST 이벤트를 받으면 SPEC_ANALYSIS로 전이해야 한다', () => {
    const actor = createActor(jarvisMachine);
    actor.start();

    actor.send({
      type: 'USER_REQUEST',
      input: '테스트 입력',
      sessionId: 'session-001',
      trustMode: 'suggest',
    });

    expect(actor.getSnapshot().value).toBe(JarvisState.SPEC_ANALYSIS);
    actor.stop();
  });

  it('USER_REQUEST 이후 currentAgent가 spec-agent로 설정되어야 한다', () => {
    const actor = createActor(jarvisMachine);
    actor.start();

    actor.send({
      type: 'USER_REQUEST',
      input: '테스트 입력',
      sessionId: 'session-001',
      trustMode: 'suggest',
    });

    expect(actor.getSnapshot().context.currentAgent).toBe('spec-agent');
    actor.stop();
  });

  it('USER_REQUEST 이후 userInput이 설정되어야 한다', () => {
    const actor = createActor(jarvisMachine);
    actor.start();

    actor.send({
      type: 'USER_REQUEST',
      input: '파일을 생성해 주세요',
      sessionId: 'session-001',
      trustMode: 'suggest',
    });

    expect(actor.getSnapshot().context.userInput).toBe('파일을 생성해 주세요');
    actor.stop();
  });

  it('USER_REQUEST 이후 timeline에 항목이 추가되어야 한다', () => {
    const actor = createActor(jarvisMachine);
    actor.start();

    actor.send({
      type: 'USER_REQUEST',
      input: '테스트',
      sessionId: 'session-001',
      trustMode: 'suggest',
    });

    expect(actor.getSnapshot().context.timeline.length).toBeGreaterThan(0);
    actor.stop();
  });
});

// ────────────────────────────────────────────────────────────
// SPEC_ANALYSIS 상태 전이 테스트
// ────────────────────────────────────────────────────────────

describe('SPEC_ANALYSIS 상태 전이', () => {
  function getSpecAnalysisActor() {
    const actor = createActor(jarvisMachine);
    actor.start();
    actor.send({
      type: 'USER_REQUEST',
      input: '테스트',
      sessionId: 'session-001',
      trustMode: 'suggest',
    });
    return actor;
  }

  it('SPEC_COMPLETE 이벤트로 POLICY_CHECK로 전이해야 한다', () => {
    const actor = getSpecAnalysisActor();
    actor.send({ type: 'SPEC_COMPLETE', specId: 'spec-001' });
    expect(actor.getSnapshot().value).toBe(JarvisState.POLICY_CHECK);
    actor.stop();
  });

  it('SPEC_NEED_CLARIFICATION 이벤트로 AWAITING_USER_INPUT으로 전이해야 한다', () => {
    const actor = getSpecAnalysisActor();
    actor.send({ type: 'SPEC_NEED_CLARIFICATION', question: '어떤 파일인가요?' });
    expect(actor.getSnapshot().value).toBe(JarvisState.AWAITING_USER_INPUT);
    actor.stop();
  });

  it('ERROR 이벤트로 ERROR_RECOVERY로 전이해야 한다', () => {
    const actor = getSpecAnalysisActor();
    actor.send({ type: 'ERROR', error: makeDummyError() });
    expect(actor.getSnapshot().value).toBe(JarvisState.ERROR_RECOVERY);
    actor.stop();
  });
});

// ────────────────────────────────────────────────────────────
// POLICY_CHECK 상태 전이 테스트
// ────────────────────────────────────────────────────────────

describe('POLICY_CHECK 상태 전이', () => {
  function getPolicyCheckActor() {
    const actor = createActor(jarvisMachine);
    actor.start();
    actor.send({ type: 'USER_REQUEST', input: '테스트', sessionId: 's1', trustMode: 'suggest' });
    actor.send({ type: 'SPEC_COMPLETE', specId: 'spec-001' });
    return actor;
  }

  it('ALLOW 이벤트로 PLANNING으로 전이해야 한다', () => {
    const actor = getPolicyCheckActor();
    actor.send({
      type: 'ALLOW',
      policyDecision: makeDummyPolicyDecision('ALLOW', 10) as never,
    });
    expect(actor.getSnapshot().value).toBe(JarvisState.PLANNING);
    actor.stop();
  });

  it('ALLOW 이벤트 후 riskScore가 설정되어야 한다', () => {
    const actor = getPolicyCheckActor();
    actor.send({
      type: 'ALLOW',
      policyDecision: makeDummyPolicyDecision('ALLOW', 15) as never,
    });
    expect(actor.getSnapshot().context.riskScore).toBe(15);
    actor.stop();
  });

  it('CONSTRAINED_ALLOW 이벤트로 PLANNING으로 전이해야 한다', () => {
    const actor = getPolicyCheckActor();
    actor.send({
      type: 'CONSTRAINED_ALLOW',
      policyDecision: makeDummyPolicyDecision('CONSTRAINED_ALLOW', 40) as never,
    });
    expect(actor.getSnapshot().value).toBe(JarvisState.PLANNING);
    actor.stop();
  });

  it('APPROVAL_REQUIRED 이벤트로 GATE_PLAN_APPROVAL로 전이해야 한다', () => {
    const actor = getPolicyCheckActor();
    actor.send({
      type: 'APPROVAL_REQUIRED',
      policyDecision: makeDummyPolicyDecision('APPROVAL_REQUIRED', 65) as never,
    });
    expect(actor.getSnapshot().value).toBe(JarvisState.GATE_PLAN_APPROVAL);
    actor.stop();
  });

  it('DENY 이벤트로 DENIED 종료 상태로 전이해야 한다', () => {
    const actor = getPolicyCheckActor();
    actor.send({ type: 'DENY', reason: '위험도 초과' });
    expect(actor.getSnapshot().value).toBe(JarvisState.DENIED);
    actor.stop();
  });
});

// ────────────────────────────────────────────────────────────
// Gate 상태 테스트
// ────────────────────────────────────────────────────────────

describe('GATE_PLAN_APPROVAL 상태 전이', () => {
  function getGatePlanApprovalActor() {
    const actor = createActor(jarvisMachine);
    actor.start();
    actor.send({ type: 'USER_REQUEST', input: '테스트', sessionId: 's1', trustMode: 'suggest' });
    actor.send({ type: 'SPEC_COMPLETE', specId: 'spec-001' });
    actor.send({
      type: 'APPROVAL_REQUIRED',
      policyDecision: makeDummyPolicyDecision('APPROVAL_REQUIRED', 65) as never,
    });
    return actor;
  }

  it('APPROVED 이벤트로 PLANNING으로 전이해야 한다', () => {
    const actor = getGatePlanApprovalActor();
    actor.send({
      type: 'APPROVED',
      approvedBy: 'user-001',
      timestamp: new Date().toISOString(),
    });
    expect(actor.getSnapshot().value).toBe(JarvisState.PLANNING);
    actor.stop();
  });

  it('REJECTED 이벤트로 DENIED 종료 상태로 전이해야 한다', () => {
    const actor = getGatePlanApprovalActor();
    actor.send({ type: 'REJECTED', reason: '범위 너무 큼' });
    expect(actor.getSnapshot().value).toBe(JarvisState.DENIED);
    actor.stop();
  });

  it('TIMEOUT 이벤트로 DENIED 종료 상태로 전이해야 한다', () => {
    const actor = getGatePlanApprovalActor();
    actor.send({ type: 'TIMEOUT' });
    expect(actor.getSnapshot().value).toBe(JarvisState.DENIED);
    actor.stop();
  });

  it('SCOPE_MODIFIED 이벤트로 POLICY_CHECK로 돌아가야 한다', () => {
    const actor = getGatePlanApprovalActor();
    actor.send({ type: 'SCOPE_MODIFIED', newScope: '수정된 범위' });
    expect(actor.getSnapshot().value).toBe(JarvisState.POLICY_CHECK);
    actor.stop();
  });
});

// ────────────────────────────────────────────────────────────
// ERROR_RECOVERY 상태 테스트
// ────────────────────────────────────────────────────────────

describe('ERROR_RECOVERY 상태 전이', () => {
  function getErrorRecoveryActor() {
    const actor = createActor(jarvisMachine);
    actor.start();
    actor.send({ type: 'USER_REQUEST', input: '테스트', sessionId: 's1', trustMode: 'suggest' });
    actor.send({ type: 'ERROR', error: makeDummyError() });
    return actor;
  }

  it('RECOVERY_SUCCESS 이벤트로 COMPLETED 종료 상태로 전이해야 한다', () => {
    const actor = getErrorRecoveryActor();
    actor.send({ type: 'RECOVERY_SUCCESS' });
    expect(actor.getSnapshot().value).toBe(JarvisState.COMPLETED);
    actor.stop();
  });

  it('RECOVERY_FAILED 이벤트로 EMERGENCY_STOP 종료 상태로 전이해야 한다', () => {
    const actor = getErrorRecoveryActor();
    actor.send({ type: 'RECOVERY_FAILED', error: makeDummyError() });
    expect(actor.getSnapshot().value).toBe(JarvisState.EMERGENCY_STOP);
    actor.stop();
  });
});

// ────────────────────────────────────────────────────────────
// AWAITING_USER_INPUT 상태 테스트
// ────────────────────────────────────────────────────────────

describe('AWAITING_USER_INPUT 상태 전이', () => {
  function getAwaitingInputActor() {
    const actor = createActor(jarvisMachine);
    actor.start();
    actor.send({ type: 'USER_REQUEST', input: '테스트', sessionId: 's1', trustMode: 'suggest' });
    actor.send({ type: 'SPEC_NEED_CLARIFICATION', question: '더 자세히 설명해주세요' });
    return actor;
  }

  it('USER_RESPONSE 이벤트로 SPEC_ANALYSIS로 전이해야 한다', () => {
    const actor = getAwaitingInputActor();
    actor.send({ type: 'USER_RESPONSE', response: '파일 생성 요청입니다' });
    expect(actor.getSnapshot().value).toBe(JarvisState.SPEC_ANALYSIS);
    actor.stop();
  });

  it('CANCEL 이벤트로 DENIED 종료 상태로 전이해야 한다', () => {
    const actor = getAwaitingInputActor();
    actor.send({ type: 'CANCEL' });
    expect(actor.getSnapshot().value).toBe(JarvisState.DENIED);
    actor.stop();
  });
});

// ────────────────────────────────────────────────────────────
// 유틸리티 함수 테스트
// ────────────────────────────────────────────────────────────

describe('isFinalState', () => {
  it('COMPLETED는 종료 상태여야 한다', () => {
    expect(isFinalState(JarvisState.COMPLETED)).toBe(true);
  });

  it('DENIED는 종료 상태여야 한다', () => {
    expect(isFinalState(JarvisState.DENIED)).toBe(true);
  });

  it('EMERGENCY_STOP은 종료 상태여야 한다', () => {
    expect(isFinalState(JarvisState.EMERGENCY_STOP)).toBe(true);
  });

  it('IDLE은 종료 상태가 아니어야 한다', () => {
    expect(isFinalState(JarvisState.IDLE)).toBe(false);
  });

  it('PLANNING은 종료 상태가 아니어야 한다', () => {
    expect(isFinalState(JarvisState.PLANNING)).toBe(false);
  });
});

describe('isGateState', () => {
  it('GATE_PLAN_APPROVAL은 Gate 상태여야 한다', () => {
    expect(isGateState(JarvisState.GATE_PLAN_APPROVAL)).toBe(true);
  });

  it('GATE_TOOL_APPROVAL은 Gate 상태여야 한다', () => {
    expect(isGateState(JarvisState.GATE_TOOL_APPROVAL)).toBe(true);
  });

  it('GATE_APPLY_CHANGES는 Gate 상태여야 한다', () => {
    expect(isGateState(JarvisState.GATE_APPLY_CHANGES)).toBe(true);
  });

  it('GATE_DEPLOY는 Gate 상태여야 한다', () => {
    expect(isGateState(JarvisState.GATE_DEPLOY)).toBe(true);
  });

  it('PLANNING은 Gate 상태가 아니어야 한다', () => {
    expect(isGateState(JarvisState.PLANNING)).toBe(false);
  });

  it('IDLE은 Gate 상태가 아니어야 한다', () => {
    expect(isGateState(JarvisState.IDLE)).toBe(false);
  });
});

describe('isAgentWorkState', () => {
  it('SPEC_ANALYSIS는 에이전트 작업 상태여야 한다', () => {
    expect(isAgentWorkState(JarvisState.SPEC_ANALYSIS)).toBe(true);
  });

  it('CODE_GENERATION은 에이전트 작업 상태여야 한다', () => {
    expect(isAgentWorkState(JarvisState.CODE_GENERATION)).toBe(true);
  });

  it('IDLE은 에이전트 작업 상태가 아니어야 한다', () => {
    expect(isAgentWorkState(JarvisState.IDLE)).toBe(false);
  });

  it('GATE_PLAN_APPROVAL은 에이전트 작업 상태가 아니어야 한다', () => {
    expect(isAgentWorkState(JarvisState.GATE_PLAN_APPROVAL)).toBe(false);
  });
});

describe('getStateDescription', () => {
  it('IDLE에 대한 한글 설명을 반환해야 한다', () => {
    const desc = getStateDescription(JarvisState.IDLE);
    expect(desc).toBe('대기 중');
  });

  it('COMPLETED에 대한 한글 설명을 반환해야 한다', () => {
    const desc = getStateDescription(JarvisState.COMPLETED);
    expect(desc).toBe('완료');
  });

  it('EMERGENCY_STOP에 대한 한글 설명을 반환해야 한다', () => {
    const desc = getStateDescription(JarvisState.EMERGENCY_STOP);
    expect(desc).toBe('비상 중단');
  });

  it('모든 상태에 대한 설명이 비어있지 않아야 한다', () => {
    for (const state of Object.values(JarvisState)) {
      const desc = getStateDescription(state as JarvisState);
      expect(desc.length).toBeGreaterThan(0);
    }
  });
});

// ────────────────────────────────────────────────────────────
// 보안 테스트 — 계약서 §5 라우팅 규칙 확인
// ────────────────────────────────────────────────────────────

describe('보안: GATE_DEPLOY SKIPPED 동작', () => {
  it('GATE_DEPLOY에서 SKIPPED 이벤트로 COMPLETED로 전이해야 한다', () => {
    const actor = createActor(jarvisMachine);
    actor.start();

    // 정상 흐름을 거쳐 GATE_DEPLOY에 도달
    actor.send({ type: 'USER_REQUEST', input: '테스트', sessionId: 's1', trustMode: 'suggest' });
    actor.send({ type: 'SPEC_COMPLETE', specId: 'spec-001' });
    actor.send({
      type: 'ALLOW',
      policyDecision: makeDummyPolicyDecision('ALLOW', 10) as never,
    });
    actor.send({ type: 'PLAN_COMPLETE', planId: 'plan-001' });
    actor.send({ type: 'CODE_COMPLETE', changesetId: 'cs-001' });
    actor.send({ type: 'REVIEW_PASS', reviewId: 'rev-001' });
    actor.send({
      type: 'APPROVED',
      approvedBy: 'user-001',
      timestamp: new Date().toISOString(),
    });
    actor.send({
      type: 'APPLY_SUCCESS',
      appliedFiles: ['src/test.ts'],
    });
    actor.send({ type: 'TEST_PASS', reportId: 'rpt-001' });

    expect(actor.getSnapshot().value).toBe(JarvisState.GATE_DEPLOY);

    // 배포 불필요로 건너뜀
    actor.send({ type: 'SKIPPED' });
    expect(actor.getSnapshot().value).toBe(JarvisState.COMPLETED);
    actor.stop();
  });
});
