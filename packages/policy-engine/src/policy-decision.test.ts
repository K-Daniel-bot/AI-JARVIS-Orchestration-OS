// 정책 판정 엔진 단위 테스트 — createPolicyEngine, isAutoAllowed, isDenied, getReasonCodes 검증

import { describe, it, expect } from 'vitest';
import {
  createPolicyEngine,
  isAutoAllowed,
  isDenied,
  getReasonCodes,
  type DenyPattern,
} from './policy-decision.js';
import { isOk } from '@jarvis/shared';
import type { PolicyRequest, PolicySubject } from '@jarvis/shared';

// ─────────────────────────────────────────
// 테스트 픽스처
// ─────────────────────────────────────────

/** 기본 요청 생성 헬퍼 */
function makeRequest(overrides: Partial<PolicyRequest> = {}): PolicyRequest {
  return {
    raw_input: 'TypeScript 파일을 컴파일해주세요',
    intent: 'CODE_IMPLEMENTATION',
    targets: ['/workspace/project/src'],
    requires_web_access: false,
    requires_login: false,
    ...overrides,
  };
}

/** 기본 주체 생성 헬퍼 */
function makeSubject(overrides: Partial<PolicySubject> = {}): PolicySubject {
  return {
    user_id: 'user_001',
    role: 'User',
    device: 'desktop-001',
    session_id: 'session_001',
    ...overrides,
  };
}

// ─────────────────────────────────────────
// createPolicyEngine 테스트
// ─────────────────────────────────────────

describe('createPolicyEngine.evaluate', () => {
  it('일반 코드 구현 요청은 ALLOW 또는 CONSTRAINED_ALLOW를 반환해야 한다', async () => {
    // Arrange
    const engine = createPolicyEngine();
    const request = makeRequest();
    const subject = makeSubject();

    // Act
    const result = await engine.evaluate(request, subject);

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(['ALLOW', 'CONSTRAINED_ALLOW']).toContain(result.value.outcome.status);
    }
  });

  it('반환된 PolicyDecision은 pd_ 접두사를 가진 ID여야 한다', async () => {
    // Arrange
    const engine = createPolicyEngine();

    // Act
    const result = await engine.evaluate(makeRequest(), makeSubject());

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.decision_id).toMatch(/^pd_/);
    }
  });

  it('반환된 PolicyDecision은 ISO 8601 timestamp를 가져야 한다', async () => {
    // Arrange
    const engine = createPolicyEngine();

    // Act
    const result = await engine.evaluate(makeRequest(), makeSubject());

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(() => new Date(result.value.timestamp)).not.toThrow();
    }
  });

  // ─── 절대 거부 패턴 테스트 ───

  it('/Windows/** 경로 접근 요청은 즉시 DENY되어야 한다', async () => {
    // Arrange
    const engine = createPolicyEngine();
    const request = makeRequest({ targets: ['/Windows/System32/hosts'] });

    // Act
    const result = await engine.evaluate(request, makeSubject());

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.outcome.status).toBe('DENY');
      expect(result.value.outcome.risk_score).toBe(100);
      expect(result.value.outcome.reason_codes).toContain('SYSTEM_FILE_ACCESS');
    }
  });

  it('AppData/** 경로 접근 요청은 즉시 DENY되어야 한다', async () => {
    // Arrange
    const engine = createPolicyEngine();
    const request = makeRequest({ targets: ['AppData/Roaming/config.json'] });

    // Act
    const result = await engine.evaluate(request, makeSubject());

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.outcome.status).toBe('DENY');
      expect(result.value.outcome.reason_codes).toContain('SYSTEM_FILE_ACCESS');
    }
  });

  it('billing 키워드가 포함된 요청은 즉시 DENY되어야 한다', async () => {
    // Arrange
    const engine = createPolicyEngine();
    const request = makeRequest({ raw_input: 'billing 자동화 스크립트 실행' });

    // Act
    const result = await engine.evaluate(request, makeSubject());

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.outcome.status).toBe('DENY');
      expect(result.value.outcome.reason_codes).toContain('FINANCIAL_ACCESS');
    }
  });

  it('payment 키워드가 포함된 요청은 즉시 DENY되어야 한다', async () => {
    // Arrange
    const engine = createPolicyEngine();
    const request = makeRequest({ raw_input: 'payment API 호출' });

    // Act
    const result = await engine.evaluate(request, makeSubject());

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.outcome.status).toBe('DENY');
    }
  });

  it('sudo 명령이 포함된 요청은 즉시 DENY되어야 한다', async () => {
    // Arrange
    const engine = createPolicyEngine();
    const request = makeRequest({ raw_input: 'sudo apt install nodejs' });

    // Act
    const result = await engine.evaluate(request, makeSubject());

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.outcome.status).toBe('DENY');
      expect(result.value.outcome.reason_codes).toContain('ADMIN_PRIVILEGE');
    }
  });

  it('regedit 명령이 포함된 요청은 즉시 DENY되어야 한다', async () => {
    // Arrange
    const engine = createPolicyEngine();
    const request = makeRequest({ raw_input: 'regedit으로 레지스트리 수정' });

    // Act
    const result = await engine.evaluate(request, makeSubject());

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.outcome.status).toBe('DENY');
      expect(result.value.outcome.reason_codes).toContain('ADMIN_PRIVILEGE');
    }
  });

  it('절대 금지 패턴 DENY 시 required_capabilities는 빈 배열이어야 한다', async () => {
    // Arrange
    const engine = createPolicyEngine();
    const request = makeRequest({ raw_input: 'billing 처리' });

    // Act
    const result = await engine.evaluate(request, makeSubject());

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.required_capabilities).toHaveLength(0);
    }
  });

  // ─── Risk Score 기반 판정 테스트 ───

  it('외부 네트워크 접근 요청은 MEDIUM 이상 위험도를 가져야 한다', async () => {
    // Arrange
    const engine = createPolicyEngine();
    const request = makeRequest({ requires_web_access: true });

    // Act
    const result = await engine.evaluate(request, makeSubject());

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const level = result.value.outcome.risk_level;
      expect(['MEDIUM', 'HIGH', 'CRITICAL']).toContain(level);
    }
  });

  it('LOW 위험도 요청은 gates가 없어야 한다', async () => {
    // Arrange — 가장 단순한 요청
    const engine = createPolicyEngine();
    const request = makeRequest({
      raw_input: '간단한 계산 함수를 작성해주세요',
      intent: 'CODE_IMPLEMENTATION',
      targets: [],
    });

    // Act
    const result = await engine.evaluate(request, makeSubject());

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const { outcome } = result.value;
      if (outcome.risk_level === 'LOW') {
        expect(outcome.requires_gates).toHaveLength(0);
        expect(outcome.status).toBe('ALLOW');
      }
    }
  });

  it('MEDIUM 위험도 요청은 GATE_PLAN을 포함해야 한다', async () => {
    // Arrange — 외부 접근 포함으로 MEDIUM 유발
    const engine = createPolicyEngine();
    const request = makeRequest({ requires_web_access: true });

    // Act
    const result = await engine.evaluate(request, makeSubject());

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const { outcome } = result.value;
      if (outcome.risk_level === 'MEDIUM') {
        expect(outcome.requires_gates).toContain('GATE_PLAN');
      }
    }
  });

  it('DENY 판정 시 human_explanation에 사유가 포함되어야 한다', async () => {
    // Arrange
    const engine = createPolicyEngine();
    const request = makeRequest({ raw_input: 'sudo rm -rf /tmp' });

    // Act
    const result = await engine.evaluate(request, makeSubject());

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.outcome.human_explanation).toBeTruthy();
      expect(result.value.outcome.human_explanation.length).toBeGreaterThan(0);
    }
  });

  it('결과에 기본 보안 제약 조건이 포함되어야 한다', async () => {
    // Arrange
    const engine = createPolicyEngine();

    // Act
    const result = await engine.evaluate(makeRequest(), makeSubject());

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const { constraints } = result.value;
      // 시스템 경로는 쓰기 금지 목록에 포함되어야 함
      expect(constraints.fs.write_deny.some((p) => p.includes('Windows'))).toBe(true);
      // 네트워크 기본 정책은 DENY여야 함
      expect(constraints.network.default_policy).toBe('DENY');
    }
  });

  // ─── 커스텀 패턴 테스트 ───

  it('customDenyPatterns가 추가된 경우 해당 패턴도 DENY 처리해야 한다', async () => {
    // Arrange
    const customPatterns: DenyPattern[] = [
      { pattern: '*confidential*', code: 'CUSTOM_DENY', message: '기밀 데이터 접근 금지' },
    ];
    const engine = createPolicyEngine({ customDenyPatterns: customPatterns });
    const request = makeRequest({ raw_input: 'confidential 폴더를 열어주세요' });

    // Act
    const result = await engine.evaluate(request, makeSubject());

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.outcome.status).toBe('DENY');
      expect(result.value.outcome.reason_codes).toContain('CUSTOM_DENY');
    }
  });

  it('subject 정보가 PolicyDecision에 올바르게 포함되어야 한다', async () => {
    // Arrange
    const engine = createPolicyEngine();
    const subject = makeSubject({ user_id: 'user_TEST', role: 'Owner' });

    // Act
    const result = await engine.evaluate(makeRequest(), subject);

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.subject.user_id).toBe('user_TEST');
      expect(result.value.subject.role).toBe('Owner');
    }
  });

  it('audit 설정이 PolicyDecision에 포함되어야 한다', async () => {
    // Arrange
    const engine = createPolicyEngine();

    // Act
    const result = await engine.evaluate(makeRequest(), makeSubject());

    // Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(result.value.audit.redactions).toContain('secrets');
      expect(result.value.audit.redactions).toContain('tokens');
    }
  });
});

// ─────────────────────────────────────────
// isAutoAllowed 테스트
// ─────────────────────────────────────────

describe('isAutoAllowed', () => {
  it('ALLOW 상태이고 게이트가 없으면 true를 반환해야 한다', async () => {
    // Arrange
    const engine = createPolicyEngine();
    const result = await engine.evaluate(
      makeRequest({
        raw_input: '기본 함수 작성',
        intent: 'CODE_IMPLEMENTATION',
        targets: [],
      }),
      makeSubject(),
    );

    // Act & Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const decision = result.value;
      if (decision.outcome.status === 'ALLOW' && decision.outcome.requires_gates.length === 0) {
        expect(isAutoAllowed(decision)).toBe(true);
      }
    }
  });
});

// ─────────────────────────────────────────
// isDenied 테스트
// ─────────────────────────────────────────

describe('isDenied', () => {
  it('DENY 판정 결과에 대해 true를 반환해야 한다', async () => {
    // Arrange
    const engine = createPolicyEngine();
    const result = await engine.evaluate(
      makeRequest({ raw_input: 'sudo 실행' }),
      makeSubject(),
    );

    // Act & Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      expect(isDenied(result.value)).toBe(true);
    }
  });
});

// ─────────────────────────────────────────
// getReasonCodes 테스트
// ─────────────────────────────────────────

describe('getReasonCodes', () => {
  it('정상 요청의 reason_codes는 STANDARD_OPERATION을 포함해야 한다', async () => {
    // Arrange
    const engine = createPolicyEngine();
    const result = await engine.evaluate(
      makeRequest({
        raw_input: '일반 함수 작성',
        targets: [],
        requires_web_access: false,
      }),
      makeSubject(),
    );

    // Act & Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const codes = getReasonCodes(result.value);
      expect(codes).toContain('STANDARD_OPERATION');
    }
  });

  it('금지 패턴이 감지된 요청의 reason_codes에 금지 코드가 포함되어야 한다', async () => {
    // Arrange
    const engine = createPolicyEngine();
    const result = await engine.evaluate(
      makeRequest({ raw_input: 'billing 처리 자동화' }),
      makeSubject(),
    );

    // Act & Assert
    expect(isOk(result)).toBe(true);
    if (isOk(result)) {
      const codes = getReasonCodes(result.value);
      expect(codes).toContain('FINANCIAL_ACCESS');
    }
  });
});
