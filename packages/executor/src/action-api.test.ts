/**
 * action-api.ts 단위 테스트
 * 액션 생성, 검증, 카테고리 분류, 위험 태그 추론을 검증한다.
 */

import { describe, it, expect } from 'vitest';
import type { ActionType } from '@jarvis/shared';
import {
  ACTION_CATEGORIES,
  createAction,
  validateAction,
  inferRiskTags,
  getActionCategory,
  isMobileAction,
  requiresGate,
} from './action-api.js';

// ─────────────────────────────────────────
// ACTION_CATEGORIES 테스트
// ─────────────────────────────────────────

describe('ACTION_CATEGORIES', () => {
  it('FILE 카테고리에 파일시스템 5개 액션이 포함되어야 한다', () => {
    expect(ACTION_CATEGORIES.FILE).toContain('FS_READ');
    expect(ACTION_CATEGORIES.FILE).toContain('FS_WRITE');
    expect(ACTION_CATEGORIES.FILE).toContain('FS_LIST');
    expect(ACTION_CATEGORIES.FILE).toContain('FS_MOVE');
    expect(ACTION_CATEGORIES.FILE).toContain('FS_DELETE');
    expect(ACTION_CATEGORIES.FILE).toHaveLength(5);
  });

  it('PROCESS 카테고리에 프로세스 2개 액션이 포함되어야 한다', () => {
    expect(ACTION_CATEGORIES.PROCESS).toContain('EXEC_RUN');
    expect(ACTION_CATEGORIES.PROCESS).toContain('PROCESS_KILL');
    expect(ACTION_CATEGORIES.PROCESS).toHaveLength(2);
  });

  it('APP 카테고리에 앱/윈도우 5개 액션이 포함되어야 한다', () => {
    expect(ACTION_CATEGORIES.APP).toContain('APP_LAUNCH');
    expect(ACTION_CATEGORIES.APP).toContain('WINDOW_CLICK');
    expect(ACTION_CATEGORIES.APP).toHaveLength(5);
  });

  it('BROWSER 카테고리에 브라우저 7개 액션이 포함되어야 한다', () => {
    expect(ACTION_CATEGORIES.BROWSER).toContain('BROWSER_OPEN_URL');
    expect(ACTION_CATEGORIES.BROWSER).toContain('BROWSER_LOGIN_REQUEST');
    expect(ACTION_CATEGORIES.BROWSER).toHaveLength(7);
  });

  it('MOBILE 카테고리에 모바일 16개 액션이 포함되어야 한다', () => {
    expect(ACTION_CATEGORIES.MOBILE).toContain('MOBILE_CALL_DIAL');
    expect(ACTION_CATEGORIES.MOBILE).toContain('MOBILE_SMS_SEND');
    expect(ACTION_CATEGORIES.MOBILE).toContain('MOBILE_CLIPBOARD_SYNC');
    expect(ACTION_CATEGORIES.MOBILE).toHaveLength(16);
  });

  it('모든 카테고리를 합치면 총 35개 데스크톱+모바일 액션이 되어야 한다', () => {
    const total =
      ACTION_CATEGORIES.FILE.length +
      ACTION_CATEGORIES.PROCESS.length +
      ACTION_CATEGORIES.APP.length +
      ACTION_CATEGORIES.BROWSER.length +
      ACTION_CATEGORIES.MOBILE.length;
    expect(total).toBe(35);
  });
});

// ─────────────────────────────────────────
// inferRiskTags 테스트
// ─────────────────────────────────────────

describe('inferRiskTags', () => {
  it('FS_DELETE에는 REQUIRES_GATE, DESTRUCTIVE, IRREVERSIBLE 태그가 있어야 한다', () => {
    const tags = inferRiskTags('FS_DELETE');
    expect(tags).toContain('REQUIRES_GATE');
    expect(tags).toContain('DESTRUCTIVE');
    expect(tags).toContain('IRREVERSIBLE');
  });

  it('EXEC_RUN에는 REQUIRES_GATE, CODE_EXECUTION, HIGH_IMPACT 태그가 있어야 한다', () => {
    const tags = inferRiskTags('EXEC_RUN');
    expect(tags).toContain('REQUIRES_GATE');
    expect(tags).toContain('CODE_EXECUTION');
    expect(tags).toContain('HIGH_IMPACT');
  });

  it('MOBILE_CALL_DIAL에는 REQUIRES_GATE, PHONE_ACTION 태그가 있어야 한다', () => {
    const tags = inferRiskTags('MOBILE_CALL_DIAL');
    expect(tags).toContain('REQUIRES_GATE');
    expect(tags).toContain('PHONE_ACTION');
    expect(tags).toContain('IRREVERSIBLE');
  });

  it('MOBILE_SMS_SEND에는 REQUIRES_GATE, EXTERNAL_COMMUNICATION 태그가 있어야 한다', () => {
    const tags = inferRiskTags('MOBILE_SMS_SEND');
    expect(tags).toContain('REQUIRES_GATE');
    expect(tags).toContain('EXTERNAL_COMMUNICATION');
  });

  it('BROWSER_LOGIN_REQUEST에는 REQUIRES_GATE, CREDENTIAL_RELATED 태그가 있어야 한다', () => {
    const tags = inferRiskTags('BROWSER_LOGIN_REQUEST');
    expect(tags).toContain('REQUIRES_GATE');
    expect(tags).toContain('CREDENTIAL_RELATED');
  });

  it('FS_READ는 위험 태그가 없어야 한다', () => {
    const tags = inferRiskTags('FS_READ');
    expect(tags).toHaveLength(0);
  });

  it('BROWSER_OPEN_URL에는 EXTERNAL_NETWORK 태그가 있어야 한다', () => {
    const tags = inferRiskTags('BROWSER_OPEN_URL');
    expect(tags).toContain('EXTERNAL_NETWORK');
  });

  it('MOBILE_CONTACT_READ에는 PII_ACCESS 태그가 있어야 한다', () => {
    const tags = inferRiskTags('MOBILE_CONTACT_READ');
    expect(tags).toContain('PII_ACCESS');
  });
});

// ─────────────────────────────────────────
// createAction 테스트
// ─────────────────────────────────────────

describe('createAction', () => {
  it('기본 파라미터로 FS_READ 액션을 생성해야 한다', () => {
    // Arrange
    const params = {
      type: 'FS_READ' as ActionType,
      params: { path: '/home/user/docs/readme.txt' },
      requiredCapabilities: ['fs.read'],
    };

    // Act
    const action = createAction(params);

    // Assert
    expect(action.action_id).toMatch(/^act_/);
    expect(action.type).toBe('FS_READ');
    expect(action.params['path']).toBe('/home/user/docs/readme.txt');
    expect(action.requires_capabilities).toContain('fs.read');
    expect(action.risk_tags).toHaveLength(0); // FS_READ는 위험 태그 없음
    expect(action.evidence.capture_stdout).toBe(true);
    expect(action.evidence.capture_screenshot).toBe(false);
  });

  it('FS_DELETE 액션 생성 시 DESTRUCTIVE, IRREVERSIBLE 태그가 자동 추론되어야 한다', () => {
    // Arrange + Act
    const action = createAction({
      type: 'FS_DELETE',
      params: { path: '/tmp/old-file.txt' },
      requiredCapabilities: ['fs.write'],
    });

    // Assert
    expect(action.risk_tags).toContain('DESTRUCTIVE');
    expect(action.risk_tags).toContain('IRREVERSIBLE');
    expect(action.evidence.capture_screenshot).toBe(true); // FS_DELETE는 스크린샷 수집
  });

  it('커스텀 riskTags를 지정하면 자동 추론 대신 사용해야 한다', () => {
    // Arrange + Act
    const action = createAction({
      type: 'FS_DELETE',
      params: { path: '/tmp/file.txt' },
      requiredCapabilities: ['fs.write'],
      riskTags: ['CUSTOM_TAG'],
    });

    // Assert — 자동 추론 태그가 아닌 커스텀 태그만 있어야 함
    expect(action.risk_tags).toContain('CUSTOM_TAG');
    expect(action.risk_tags).not.toContain('DESTRUCTIVE');
  });

  it('preconditions, postconditions를 지정하면 액션에 포함되어야 한다', () => {
    // Arrange + Act
    const action = createAction({
      type: 'FS_WRITE',
      params: { path: '/project/output.txt', content: 'hello' },
      requiredCapabilities: ['fs.write'],
      preconditions: ['target_directory_exists'],
      postconditions: ['file_written_successfully'],
    });

    // Assert
    expect(action.preconditions).toContain('target_directory_exists');
    expect(action.postconditions).toContain('file_written_successfully');
  });

  it('EXEC_RUN 액션은 capture_stdout이 true여야 한다', () => {
    // Arrange + Act
    const action = createAction({
      type: 'EXEC_RUN',
      params: { command: 'node', args: ['--version'] },
      requiredCapabilities: ['exec.run'],
    });

    // Assert
    expect(action.evidence.capture_stdout).toBe(true);
  });
});

// ─────────────────────────────────────────
// validateAction 테스트
// ─────────────────────────────────────────

describe('validateAction', () => {
  it('유효한 FS_READ 액션은 검증을 통과해야 한다', () => {
    // Arrange
    const action = createAction({
      type: 'FS_READ',
      params: { path: '/home/user/file.txt' },
      requiredCapabilities: ['fs.read'],
    });

    // Act
    const result = validateAction(action);

    // Assert
    expect(result.ok).toBe(true);
  });

  it('requires_capabilities가 비어있으면 VALIDATION_FAILED 에러를 반환해야 한다', () => {
    // Arrange — 직접 액션 객체를 구성 (createAction 우회)
    const action = createAction({
      type: 'FS_READ',
      params: { path: '/file.txt' },
      requiredCapabilities: ['fs.read'], // 일단 생성
    });
    // requires_capabilities를 비워서 테스트
    const invalidAction = {
      ...action,
      requires_capabilities: [] as string[],
    };

    // Act
    const result = validateAction(invalidAction);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_FAILED');
    }
  });

  it('MOBILE_CALL_DIAL 액션에 REQUIRES_GATE 태그가 없으면 VALIDATION_FAILED 에러를 반환해야 한다', () => {
    // Arrange — REQUIRES_GATE 없는 MOBILE_CALL_DIAL 직접 구성
    const action = createAction({
      type: 'MOBILE_CALL_DIAL',
      params: { target: '+82-10-1234-5678' },
      requiredCapabilities: ['mobile.call'],
      riskTags: ['PHONE_ACTION'], // REQUIRES_GATE 누락
    });

    // Act
    const result = validateAction(action);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_FAILED');
      expect(result.error.message).toContain('REQUIRES_GATE');
    }
  });

  it('MOBILE_CALL_DIAL 액션에 REQUIRES_GATE 태그가 있으면 검증을 통과해야 한다', () => {
    // Arrange — inferRiskTags가 REQUIRES_GATE를 자동 추론함
    const action = createAction({
      type: 'MOBILE_CALL_DIAL',
      params: { target: '+82-10-1234-5678' },
      requiredCapabilities: ['mobile.call'],
    });

    // Act
    const result = validateAction(action);

    // Assert
    expect(result.ok).toBe(true);
  });

  it('FS_DELETE 액션에 REQUIRES_GATE 태그가 없으면 VALIDATION_FAILED 에러를 반환해야 한다', () => {
    // Arrange
    const action = createAction({
      type: 'FS_DELETE',
      params: { path: '/tmp/file.txt' },
      requiredCapabilities: ['fs.write'],
      riskTags: ['DESTRUCTIVE'], // REQUIRES_GATE 누락
    });

    // Act
    const result = validateAction(action);

    // Assert
    expect(result.ok).toBe(false);
  });
});

// ─────────────────────────────────────────
// getActionCategory 테스트
// ─────────────────────────────────────────

describe('getActionCategory', () => {
  it('FS_READ는 FILE 카테고리여야 한다', () => {
    expect(getActionCategory('FS_READ')).toBe('FILE');
  });

  it('EXEC_RUN은 PROCESS 카테고리여야 한다', () => {
    expect(getActionCategory('EXEC_RUN')).toBe('PROCESS');
  });

  it('APP_LAUNCH는 APP 카테고리여야 한다', () => {
    expect(getActionCategory('APP_LAUNCH')).toBe('APP');
  });

  it('BROWSER_FETCH는 BROWSER 카테고리여야 한다', () => {
    expect(getActionCategory('BROWSER_FETCH')).toBe('BROWSER');
  });

  it('MOBILE_SMS_SEND는 MOBILE 카테고리여야 한다', () => {
    expect(getActionCategory('MOBILE_SMS_SEND')).toBe('MOBILE');
  });
});

// ─────────────────────────────────────────
// isMobileAction 테스트
// ─────────────────────────────────────────

describe('isMobileAction', () => {
  it('MOBILE_CALL_DIAL은 모바일 액션이어야 한다', () => {
    expect(isMobileAction('MOBILE_CALL_DIAL')).toBe(true);
  });

  it('FS_READ는 모바일 액션이 아니어야 한다', () => {
    expect(isMobileAction('FS_READ')).toBe(false);
  });

  it('BROWSER_FETCH는 모바일 액션이 아니어야 한다', () => {
    expect(isMobileAction('BROWSER_FETCH')).toBe(false);
  });
});

// ─────────────────────────────────────────
// requiresGate 테스트
// ─────────────────────────────────────────

describe('requiresGate', () => {
  it('REQUIRES_GATE 태그가 있는 액션은 true를 반환해야 한다', () => {
    // Arrange — MOBILE_CALL_DIAL은 inferRiskTags에서 REQUIRES_GATE 자동 추론
    const action = createAction({
      type: 'MOBILE_CALL_DIAL',
      params: { target: '+82-10-0000-0000' },
      requiredCapabilities: ['mobile.call'],
    });

    // Act + Assert
    expect(requiresGate(action)).toBe(true);
  });

  it('REQUIRES_GATE 태그가 없는 액션은 false를 반환해야 한다', () => {
    // Arrange
    const action = createAction({
      type: 'FS_READ',
      params: { path: '/file.txt' },
      requiredCapabilities: ['fs.read'],
    });

    // Act + Assert
    expect(requiresGate(action)).toBe(false);
  });
});
