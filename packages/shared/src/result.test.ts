/**
 * Result 모나드 패턴 단위 테스트
 * ok/err 생성, 타입 가드, 유틸리티 함수의 정상 동작을 검증한다.
 */

import { describe, it, expect } from 'vitest';
import {
  ok,
  err,
  isOk,
  isErr,
  unwrapOr,
  mapOk,
  mapErr,
  andThen,
} from './result.js';

// ─────────────────────────────────────────
// ok() 함수 테스트
// ─────────────────────────────────────────

describe('ok()', () => {
  it('성공 Result를 생성해야 한다', () => {
    const result = ok(42);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(42);
  });

  it('문자열 값으로 성공 Result를 생성해야 한다', () => {
    const result = ok('hello');
    expect(result.ok).toBe(true);
    expect(result.value).toBe('hello');
  });

  it('null 값으로 성공 Result를 생성해야 한다', () => {
    const result = ok(null);
    expect(result.ok).toBe(true);
    expect(result.value).toBeNull();
  });
});

// ─────────────────────────────────────────
// err() 함수 테스트
// ─────────────────────────────────────────

describe('err()', () => {
  it('실패 Result를 생성해야 한다', () => {
    const error = new Error('test error');
    const result = err(error);
    expect(result.ok).toBe(false);
    expect(result.error).toBe(error);
  });

  it('문자열 에러로 실패 Result를 생성해야 한다', () => {
    const result = err('something went wrong');
    expect(result.ok).toBe(false);
    expect(result.error).toBe('something went wrong');
  });
});

// ─────────────────────────────────────────
// isOk() 타입 가드 테스트
// ─────────────────────────────────────────

describe('isOk()', () => {
  it('성공 Result에 대해 true를 반환해야 한다', () => {
    const result = ok(42);
    expect(isOk(result)).toBe(true);
  });

  it('실패 Result에 대해 false를 반환해야 한다', () => {
    const result = err(new Error('fail'));
    expect(isOk(result)).toBe(false);
  });
});

// ─────────────────────────────────────────
// isErr() 타입 가드 테스트
// ─────────────────────────────────────────

describe('isErr()', () => {
  it('실패 Result에 대해 true를 반환해야 한다', () => {
    const result = err(new Error('fail'));
    expect(isErr(result)).toBe(true);
  });

  it('성공 Result에 대해 false를 반환해야 한다', () => {
    const result = ok(42);
    expect(isErr(result)).toBe(false);
  });
});

// ─────────────────────────────────────────
// unwrapOr() 유틸리티 테스트
// ─────────────────────────────────────────

describe('unwrapOr()', () => {
  it('성공 Result에서 값을 반환해야 한다', () => {
    const result = ok(42);
    expect(unwrapOr(result, 0)).toBe(42);
  });

  it('실패 Result에서 기본값을 반환해야 한다', () => {
    const result = err(new Error('fail'));
    expect(unwrapOr(result, 99)).toBe(99);
  });
});

// ─────────────────────────────────────────
// mapOk() 유틸리티 테스트
// ─────────────────────────────────────────

describe('mapOk()', () => {
  it('성공 Result의 값을 변환해야 한다', () => {
    const result = ok(5);
    const mapped = mapOk(result, (n) => n * 2);
    expect(isOk(mapped)).toBe(true);
    if (isOk(mapped)) {
      expect(mapped.value).toBe(10);
    }
  });

  it('실패 Result는 변환하지 않고 그대로 전파해야 한다', () => {
    const error = new Error('fail');
    const result = err(error);
    const mapped = mapOk(result, (n: number) => n * 2);
    expect(isErr(mapped)).toBe(true);
    if (isErr(mapped)) {
      expect(mapped.error).toBe(error);
    }
  });
});

// ─────────────────────────────────────────
// mapErr() 유틸리티 테스트
// ─────────────────────────────────────────

describe('mapErr()', () => {
  it('실패 Result의 에러를 변환해야 한다', () => {
    const result = err('original error');
    const mapped = mapErr(result, (e) => `wrapped: ${e}`);
    expect(isErr(mapped)).toBe(true);
    if (isErr(mapped)) {
      expect(mapped.error).toBe('wrapped: original error');
    }
  });

  it('성공 Result는 변환하지 않고 그대로 전파해야 한다', () => {
    const result = ok(42);
    const mapped = mapErr(result, (e: string) => `wrapped: ${e}`);
    expect(isOk(mapped)).toBe(true);
    if (isOk(mapped)) {
      expect(mapped.value).toBe(42);
    }
  });
});

// ─────────────────────────────────────────
// andThen() 유틸리티 테스트
// ─────────────────────────────────────────

describe('andThen()', () => {
  it('성공 Result로 새 Result를 생성해야 한다', () => {
    const result = ok(5);
    const chained = andThen(result, (n) => ok(n * 2));
    expect(isOk(chained)).toBe(true);
    if (isOk(chained)) {
      expect(chained.value).toBe(10);
    }
  });

  it('성공에서 실패로 체인이 가능해야 한다', () => {
    const result = ok(5);
    const chained = andThen(result, (_n) => err(new Error('chained error')));
    expect(isErr(chained)).toBe(true);
  });

  it('실패 Result는 체인 함수를 호출하지 않아야 한다', () => {
    let called = false;
    const result = err(new Error('initial error'));
    const chained = andThen(result, (n: number) => {
      called = true;
      return ok(n * 2);
    });
    expect(called).toBe(false);
    expect(isErr(chained)).toBe(true);
  });
});
