/**
 * enforcement-hook.ts 단위 테스트
 * Capability Token 기반 실행 전/후 강제 검증을 검증한다.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import type { CapabilityToken, PolicyConstraints } from '@jarvis/shared';
import { createAction } from './action-api.js';
import {
  checkConstraints,
  preEnforce,
  postEnforce,
} from './enforcement-hook.js';

// ─────────────────────────────────────────
// 테스트 픽스처 팩토리
// ─────────────────────────────────────────

/** 테스트용 기본 PolicyConstraints 생성 */
function makeConstraints(
  overrides?: Partial<PolicyConstraints>,
): PolicyConstraints {
  return {
    fs: {
      read_allow: ['/project/**', '/home/user/**'],
      write_allow: ['/project/src/**'],
      write_deny: ['/Windows/**', '/System/**'],
    },
    exec: {
      allow: ['node', 'git', 'pnpm'],
      deny: ['sudo', 'regedit', 'powershell_admin'],
    },
    network: {
      allow_domains: ['api.example.com', '*.github.com'],
      deny_domains: ['banking.*', '*.bank.*'],
      default_policy: 'DENY',
    },
    ...overrides,
  };
}

/** 테스트용 유효한 CapabilityToken 생성 */
function makeActiveToken(
  cap: string,
  scope: string | string[],
  overrides?: Partial<CapabilityToken>,
): CapabilityToken {
  const issuedAt = new Date();
  return {
    token_id: `cap_20260302_test001`,
    issued_at: issuedAt.toISOString(),
    issued_by: 'policy-risk-agent',
    approved_by: 'user',
    grant: {
      cap,
      scope,
      ttl_seconds: 900,
      max_uses: 1,
    },
    context: {
      session_id: 'sess_test',
      run_id: 'run_test',
      policy_decision_id: 'pd_test',
      trust_mode: 'semi-auto',
    },
    status: 'ACTIVE',
    ...overrides,
  };
}

// ─────────────────────────────────────────
// checkConstraints 테스트
// ─────────────────────────────────────────

describe('checkConstraints', () => {
  let constraints: PolicyConstraints;

  beforeEach(() => {
    constraints = makeConstraints();
  });

  describe('파일시스템 쓰기 제약 검사', () => {
    it('허용된 경로에 쓰기는 통과해야 한다', () => {
      // Act
      const result = checkConstraints(
        'FS_WRITE',
        { path: '/project/src/index.ts' },
        constraints,
      );

      // Assert
      expect(result.ok).toBe(true);
    });

    it('write_deny 패턴과 일치하는 경로에 쓰기는 거부되어야 한다', () => {
      // Act
      const result = checkConstraints(
        'FS_WRITE',
        { path: '/Windows/System32/config.sys' },
        constraints,
      );

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('POLICY_DENIED');
      }
    });

    it('write_allow 범위를 벗어난 경로에 쓰기는 거부되어야 한다', () => {
      // Act
      const result = checkConstraints(
        'FS_WRITE',
        { path: '/home/user/personal.txt' }, // write_allow: /project/src/**
        constraints,
      );

      // Assert
      expect(result.ok).toBe(false);
    });

    it('path 파라미터가 없는 FS_WRITE는 VALIDATION_FAILED 에러를 반환해야 한다', () => {
      // Act
      const result = checkConstraints('FS_WRITE', {}, constraints);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
      }
    });
  });

  describe('파일시스템 읽기 제약 검사', () => {
    it('허용된 경로 읽기는 통과해야 한다', () => {
      // Act
      const result = checkConstraints(
        'FS_READ',
        { path: '/project/README.md' },
        constraints,
      );

      // Assert
      expect(result.ok).toBe(true);
    });

    it('read_allow 범위를 벗어난 경로 읽기는 거부되어야 한다', () => {
      // Act
      const result = checkConstraints(
        'FS_READ',
        { path: '/etc/passwd' }, // read_allow: ['/project/**', '/home/user/**']
        constraints,
      );

      // Assert
      expect(result.ok).toBe(false);
    });
  });

  describe('명령 실행 제약 검사', () => {
    it('허용된 명령은 통과해야 한다', () => {
      // Act
      const result = checkConstraints(
        'EXEC_RUN',
        { command: 'node --version' },
        constraints,
      );

      // Assert
      expect(result.ok).toBe(true);
    });

    it('deny 목록 명령은 거부되어야 한다', () => {
      // Act
      const result = checkConstraints(
        'EXEC_RUN',
        { command: 'sudo rm -rf /' },
        constraints,
      );

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('POLICY_DENIED');
      }
    });

    it('allow 목록에 없는 명령은 거부되어야 한다', () => {
      // Act
      const result = checkConstraints(
        'EXEC_RUN',
        { command: 'curl https://evil.com' },
        constraints,
      );

      // Assert
      expect(result.ok).toBe(false);
    });
  });

  describe('네트워크 도메인 제약 검사', () => {
    it('허용된 도메인 URL은 통과해야 한다', () => {
      // Act
      const result = checkConstraints(
        'BROWSER_FETCH',
        { url: 'https://api.example.com/v1/data' },
        constraints,
      );

      // Assert
      expect(result.ok).toBe(true);
    });

    it('deny_domains 패턴과 일치하는 도메인은 거부되어야 한다', () => {
      // Act
      const result = checkConstraints(
        'BROWSER_OPEN_URL',
        { url: 'https://banking.example.com' },
        constraints,
      );

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('POLICY_DENIED');
      }
    });

    it('유효하지 않은 URL은 VALIDATION_FAILED 에러를 반환해야 한다', () => {
      // Act
      const result = checkConstraints(
        'BROWSER_FETCH',
        { url: 'not-a-valid-url' },
        constraints,
      );

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('VALIDATION_FAILED');
      }
    });

    it('allow_domains가 없고 default_policy가 DENY이면 모든 도메인이 차단되어야 한다', () => {
      // Arrange — allow_domains 빈 배열, default_policy DENY
      const restrictiveConstraints = makeConstraints({
        network: {
          allow_domains: [],
          deny_domains: [],
          default_policy: 'DENY',
        },
      });

      // Act
      const result = checkConstraints(
        'BROWSER_FETCH',
        { url: 'https://any.domain.com' },
        restrictiveConstraints,
      );

      // Assert
      expect(result.ok).toBe(false);
    });
  });
});

// ─────────────────────────────────────────
// preEnforce 테스트
// ─────────────────────────────────────────

describe('preEnforce', () => {
  let constraints: PolicyConstraints;

  beforeEach(() => {
    constraints = makeConstraints();
  });

  it('유효한 Token이 있는 허용된 FS_READ 액션은 allowed: true를 반환해야 한다', () => {
    // Arrange
    const action = createAction({
      type: 'FS_READ',
      params: { path: '/project/src/index.ts' },
      requiredCapabilities: ['fs.read'],
    });
    const token = makeActiveToken('fs.read', '/project/**');

    // Act
    const result = preEnforce({
      action,
      capabilities: [token],
      constraints,
      now: new Date(),
    });

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.allowed).toBe(true);
    }
  });

  it('모바일 액션은 REQUIRES_GATE 태그 없이는 항상 gateRequired: true를 반환해야 한다', () => {
    // Arrange — REQUIRES_GATE 없는 MOBILE_DEVICE_STATUS (읽기 전용 모바일 액션)
    const action = createAction({
      type: 'MOBILE_DEVICE_STATUS',
      params: {},
      requiredCapabilities: ['mobile.status'],
      riskTags: [], // REQUIRES_GATE 없음
    });
    const token = makeActiveToken('mobile.status', '*');

    // Act
    const result = preEnforce({
      action,
      capabilities: [token],
      constraints,
    });

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.allowed).toBe(false);
      if (!result.value.allowed) {
        expect(result.value.gateRequired).toBe(true);
      }
    }
  });

  it('유효한 Token이 없으면 allowed: false, gateRequired: true를 반환해야 한다', () => {
    // Arrange
    const action = createAction({
      type: 'FS_WRITE',
      params: { path: '/project/src/new-file.ts' },
      requiredCapabilities: ['fs.write'],
    });

    // Act — 토큰 없이 실행
    const result = preEnforce({
      action,
      capabilities: [], // 토큰 없음
      constraints,
    });

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.allowed).toBe(false);
      if (!result.value.allowed) {
        expect(result.value.gateRequired).toBe(true);
      }
    }
  });

  it('만료된 Token은 유효한 Token으로 인정되지 않아야 한다', () => {
    // Arrange
    const action = createAction({
      type: 'FS_READ',
      params: { path: '/project/README.md' },
      requiredCapabilities: ['fs.read'],
    });
    // 과거 시간에 발급된 (이미 만료된) 토큰
    const expiredToken = makeActiveToken('fs.read', '/project/**', {
      issued_at: new Date('2020-01-01T00:00:00Z').toISOString(),
      grant: {
        cap: 'fs.read',
        scope: '/project/**',
        ttl_seconds: 1, // 1초 TTL — 이미 만료됨
        max_uses: 1,
      },
    });

    // Act — 현재 시각은 훨씬 나중이므로 만료
    const result = preEnforce({
      action,
      capabilities: [expiredToken],
      constraints,
      now: new Date(),
    });

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.allowed).toBe(false);
    }
  });

  it('제약 조건 위반 경로는 토큰이 있어도 거부되어야 한다', () => {
    // Arrange — write_deny 경로
    const action = createAction({
      type: 'FS_WRITE',
      params: { path: '/Windows/System32/hosts' },
      requiredCapabilities: ['fs.write'],
    });
    const token = makeActiveToken('fs.write', '/Windows/**');

    // Act
    const result = preEnforce({
      action,
      capabilities: [token],
      constraints,
    });

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.allowed).toBe(false);
    }
  });

  it('소비된(CONSUMED) Token은 유효하지 않아야 한다', () => {
    // Arrange
    const action = createAction({
      type: 'FS_READ',
      params: { path: '/project/src/main.ts' },
      requiredCapabilities: ['fs.read'],
    });
    const consumedToken = makeActiveToken('fs.read', '/project/**', {
      status: 'CONSUMED',
      consumed_at: new Date().toISOString(),
      consumed_by_action: 'act_previous',
    });

    // Act
    const result = preEnforce({
      action,
      capabilities: [consumedToken],
      constraints,
    });

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.allowed).toBe(false);
    }
  });
});

// ─────────────────────────────────────────
// postEnforce 테스트
// ─────────────────────────────────────────

describe('postEnforce', () => {
  it('SUCCESS 상태의 정상 실행은 proceed: true, 이상 없음을 반환해야 한다', () => {
    // Arrange
    const action = createAction({
      type: 'FS_READ',
      params: { path: '/project/file.txt' },
      requiredCapabilities: ['fs.read'],
    });
    const now = new Date().toISOString();
    const step = {
      action_id: action.action_id,
      status: 'SUCCESS' as const,
      started_at: now,
      ended_at: now,
      evidence: {},
    };

    // Act
    const result = postEnforce({ step, action });

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.proceed).toBe(true);
      expect(result.value.anomalies).toHaveLength(0);
    }
  });

  it('DENIED 상태 실행은 이상 징후를 탐지하고 proceed: false를 반환해야 한다', () => {
    // Arrange
    const action = createAction({
      type: 'FS_DELETE',
      params: { path: '/project/file.txt' },
      requiredCapabilities: ['fs.write'],
    });
    const now = new Date().toISOString();
    const step = {
      action_id: action.action_id,
      status: 'DENIED' as const,
      started_at: now,
      ended_at: now,
      evidence: {},
    };

    // Act
    const result = postEnforce({ step, action });

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.proceed).toBe(false);
      expect(result.value.anomalies.length).toBeGreaterThan(0);
    }
  });

  it('FAILED 상태 실행은 이상 징후를 포함해야 한다', () => {
    // Arrange
    const action = createAction({
      type: 'EXEC_RUN',
      params: { command: 'node', args: ['app.js'] },
      requiredCapabilities: ['exec.run'],
    });
    const now = new Date().toISOString();
    const step = {
      action_id: action.action_id,
      status: 'FAILED' as const,
      started_at: now,
      ended_at: now,
      evidence: {},
      error: 'Command not found',
    };

    // Act
    const result = postEnforce({ step, action });

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.anomalies.length).toBeGreaterThan(0);
      expect(result.value.anomalies[0]).toContain('FAILED');
    }
  });

  it('30초 초과 실행은 이상 징후로 탐지되어야 한다', () => {
    // Arrange
    const action = createAction({
      type: 'EXEC_RUN',
      params: { command: 'node', args: ['slow-script.js'] },
      requiredCapabilities: ['exec.run'],
    });
    const startedAt = new Date('2026-03-02T10:00:00Z').toISOString();
    const endedAt = new Date('2026-03-02T10:01:00Z').toISOString(); // 60초 후
    const step = {
      action_id: action.action_id,
      status: 'SUCCESS' as const,
      started_at: startedAt,
      ended_at: endedAt,
      evidence: {},
    };

    // Act
    const result = postEnforce({ step, action });

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.anomalies.length).toBeGreaterThan(0);
      expect(result.value.anomalies.some((a) => a.includes('ms'))).toBe(true);
    }
  });

  it('expectedOutcome이 지정되었고 실패한 경우 이상 징후에 포함되어야 한다', () => {
    // Arrange
    const action = createAction({
      type: 'FS_WRITE',
      params: { path: '/project/output.txt', content: 'data' },
      requiredCapabilities: ['fs.write'],
    });
    const now = new Date().toISOString();
    const step = {
      action_id: action.action_id,
      status: 'FAILED' as const,
      started_at: now,
      ended_at: now,
      evidence: {},
    };

    // Act
    const result = postEnforce({
      step,
      action,
      expectedOutcome: '파일이 성공적으로 작성되어야 함',
    });

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.anomalies.length).toBeGreaterThanOrEqual(2);
    }
  });
});
