/**
 * Result<T, E> 모나드 패턴
 * 비즈니스 로직에서 throw 대신 사용하는 타입 안전 에러 처리 패턴.
 * ok: true이면 value에 성공값, ok: false이면 error에 에러값이 담긴다.
 */

// ─────────────────────────────────────────
// Result 타입 정의
// ─────────────────────────────────────────

/** 성공 케이스 — value에 결과값을 담는다 */
export type OkResult<T> = { readonly ok: true; readonly value: T };

/** 실패 케이스 — error에 에러를 담는다 */
export type ErrResult<E> = { readonly ok: false; readonly error: E };

/**
 * Result<T, E> — 성공 또는 실패를 명시적으로 표현하는 합집합 타입.
 * E 기본값은 Error이며, 도메인별 에러 타입으로 교체 가능하다.
 */
export type Result<T, E = Error> = OkResult<T> | ErrResult<E>;

// ─────────────────────────────────────────
// Result 생성 함수
// ─────────────────────────────────────────

/**
 * 성공 Result를 생성한다.
 * @param value - 성공 결과값
 */
export function ok<T>(value: T): OkResult<T> {
  return { ok: true, value };
}

/**
 * 실패 Result를 생성한다.
 * @param error - 에러값
 */
export function err<E>(error: E): ErrResult<E> {
  return { ok: false, error };
}

// ─────────────────────────────────────────
// Result 타입 가드 함수
// ─────────────────────────────────────────

/**
 * Result가 성공인지 확인하는 타입 가드.
 * true이면 result.value에 안전하게 접근 가능하다.
 */
export function isOk<T, E>(
  result: Result<T, E>,
): result is OkResult<T> {
  return result.ok === true;
}

/**
 * Result가 실패인지 확인하는 타입 가드.
 * true이면 result.error에 안전하게 접근 가능하다.
 */
export function isErr<T, E>(
  result: Result<T, E>,
): result is ErrResult<E> {
  return result.ok === false;
}

// ─────────────────────────────────────────
// Result 유틸리티 함수
// ─────────────────────────────────────────

/**
 * Result에서 값을 추출하거나 기본값을 반환한다.
 * @param result - 검사할 Result
 * @param defaultValue - 실패 시 반환할 기본값
 */
export function unwrapOr<T, E>(result: Result<T, E>, defaultValue: T): T {
  if (isOk(result)) {
    return result.value;
  }
  return defaultValue;
}

/**
 * 성공 Result의 값을 변환한다 (실패는 그대로 전파).
 * @param result - 변환할 Result
 * @param fn - 성공값에 적용할 변환 함수
 */
export function mapOk<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => U,
): Result<U, E> {
  if (isOk(result)) {
    return ok(fn(result.value));
  }
  return result;
}

/**
 * 실패 Result의 에러를 변환한다 (성공은 그대로 전파).
 * @param result - 변환할 Result
 * @param fn - 에러에 적용할 변환 함수
 */
export function mapErr<T, E, F>(
  result: Result<T, E>,
  fn: (error: E) => F,
): Result<T, F> {
  if (isErr(result)) {
    return err(fn(result.error));
  }
  return result;
}

/**
 * 성공 Result의 값으로 다른 Result를 생성한다 (flatMap/chain).
 * @param result - 검사할 Result
 * @param fn - 성공값으로 새 Result를 반환하는 함수
 */
export function andThen<T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>,
): Result<U, E> {
  if (isOk(result)) {
    return fn(result.value);
  }
  return result;
}
