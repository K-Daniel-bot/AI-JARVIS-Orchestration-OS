/**
 * JarvisError 클래스 및 에러 헬퍼 함수 단위 테스트
 * 에러 코드, 메시지, 컨텍스트, toSafeObject 직렬화를 검증한다.
 */

import { describe, it, expect } from 'vitest';
import {
  ErrorCode,
  JarvisError,
  agentTimeoutError,
  validationFailedError,
  policyDeniedError,
  tokenInvalidError,
  tokenExpiredError,
  tokenScopeMismatchError,
  hashMismatchError,
  dbError,
  internalError,
} from './errors.js';

// ─────────────────────────────────────────
// JarvisError 클래스 테스트
// ─────────────────────────────────────────

describe('JarvisError', () => {
  it('에러 코드와 메시지로 생성되어야 한다', () => {
    const error = new JarvisError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'test error',
    });
    expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(error.message).toBe('test error');
    expect(error.name).toBe('JarvisError');
  });

  it('Error를 상속해야 한다', () => {
    const error = new JarvisError({
      code: ErrorCode.VALIDATION_FAILED,
      message: 'validation error',
    });
    expect(error instanceof Error).toBe(true);
    expect(error instanceof JarvisError).toBe(true);
  });

  it('컨텍스트를 포함할 수 있어야 한다', () => {
    const context = { field: 'email', reason: 'invalid format' };
    const error = new JarvisError({
      code: ErrorCode.VALIDATION_FAILED,
      message: 'validation failed',
      context,
    });
    expect(error.context).toEqual(context);
  });

  it('cause를 포함할 수 있어야 한다', () => {
    const cause = new Error('original error');
    const error = new JarvisError({
      code: ErrorCode.DB_ERROR,
      message: 'db error',
      cause,
    });
    expect(error.cause).toBe(cause);
  });

  it('toSafeObject()는 스택 트레이스 없이 안전한 객체를 반환해야 한다', () => {
    const error = new JarvisError({
      code: ErrorCode.POLICY_DENIED,
      message: 'denied',
      context: { decisionId: 'pd_123' },
    });
    const safeObj = error.toSafeObject();
    expect(safeObj.name).toBe('JarvisError');
    expect(safeObj.code).toBe(ErrorCode.POLICY_DENIED);
    expect(safeObj.message).toBe('denied');
    expect(safeObj.hasContext).toBe(true);
    // 스택 트레이스가 노출되지 않아야 한다
    expect('stack' in safeObj).toBe(false);
  });

  it('toSafeObject()는 컨텍스트 없을 때 hasContext: false를 반환해야 한다', () => {
    const error = new JarvisError({
      code: ErrorCode.INTERNAL_ERROR,
      message: 'internal',
    });
    const safeObj = error.toSafeObject();
    expect(safeObj.hasContext).toBe(false);
  });
});

// ─────────────────────────────────────────
// 에러 헬퍼 함수 테스트
// ─────────────────────────────────────────

describe('agentTimeoutError()', () => {
  it('AGENT_TIMEOUT 코드로 에러를 생성해야 한다', () => {
    const error = agentTimeoutError('codegen', 30000);
    expect(error.code).toBe(ErrorCode.AGENT_TIMEOUT);
    expect(error.message).toContain('codegen');
    expect(error.message).toContain('30000');
  });
});

describe('validationFailedError()', () => {
  it('VALIDATION_FAILED 코드로 에러를 생성해야 한다', () => {
    const error = validationFailedError('email', 'invalid format');
    expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(error.message).toContain('email');
    expect(error.message).toContain('invalid format');
  });
});

describe('policyDeniedError()', () => {
  it('POLICY_DENIED 코드로 에러를 생성해야 한다', () => {
    const error = policyDeniedError('pd_20260302_abc123', 'HIGH_RISK');
    expect(error.code).toBe(ErrorCode.POLICY_DENIED);
    expect(error.message).toContain('pd_20260302_abc123');
  });
});

describe('tokenInvalidError()', () => {
  it('TOKEN_INVALID 코드로 에러를 생성해야 한다', () => {
    const error = tokenInvalidError('cap_20260302_abc123');
    expect(error.code).toBe(ErrorCode.TOKEN_INVALID);
    expect(error.message).toContain('cap_20260302_abc123');
  });
});

describe('tokenExpiredError()', () => {
  it('TOKEN_EXPIRED 코드로 에러를 생성해야 한다', () => {
    const error = tokenExpiredError('cap_20260302_abc123');
    expect(error.code).toBe(ErrorCode.TOKEN_EXPIRED);
    expect(error.message).toContain('cap_20260302_abc123');
  });
});

describe('tokenScopeMismatchError()', () => {
  it('TOKEN_SCOPE_MISMATCH 코드로 에러를 생성해야 한다', () => {
    const error = tokenScopeMismatchError(
      'cap_20260302_abc123',
      '/workspace/**',
      '/workspace/project/**',
    );
    expect(error.code).toBe(ErrorCode.TOKEN_SCOPE_MISMATCH);
    expect(error.message).toContain('cap_20260302_abc123');
  });
});

describe('hashMismatchError()', () => {
  it('HASH_MISMATCH 코드로 에러를 생성해야 한다', () => {
    const error = hashMismatchError('aud_20260302_abc123');
    expect(error.code).toBe(ErrorCode.HASH_MISMATCH);
    expect(error.message).toContain('aud_20260302_abc123');
  });
});

describe('dbError()', () => {
  it('DB_ERROR 코드로 에러를 생성해야 한다', () => {
    const cause = new Error('sqlite error');
    const error = dbError('INSERT', cause);
    expect(error.code).toBe(ErrorCode.DB_ERROR);
    expect(error.message).toContain('INSERT');
    expect(error.cause).toBe(cause);
  });
});

describe('internalError()', () => {
  it('INTERNAL_ERROR 코드로 에러를 생성해야 한다', () => {
    const error = internalError('unexpected state');
    expect(error.code).toBe(ErrorCode.INTERNAL_ERROR);
    expect(error.message).toBe('unexpected state');
  });
});
