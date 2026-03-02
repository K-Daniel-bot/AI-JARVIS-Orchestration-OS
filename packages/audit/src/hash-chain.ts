// 해시 체인 무결성 모듈 — SHA-256 기반 append-only 체인 구현
// 각 엔트리는 이전 엔트리의 해시를 포함하여 변조 감지 가능

import { createHash } from 'node:crypto';
import type { AuditEntry } from '@jarvis/shared';
import { ok, err, internalError } from '@jarvis/shared';
import type { Result, JarvisError } from '@jarvis/shared';

/** 해시 체인의 시작점 — 최초 엔트리의 previous_hash 값 */
export const GENESIS_HASH = '0'.repeat(64);

/**
 * 데이터와 이전 해시를 조합하여 SHA-256 해시 계산
 * 엔트리 내용의 무결성을 보장하는 핵심 함수
 *
 * @param data - 해시할 엔트리 직렬화 데이터 (integrity 필드 제외)
 * @param previousHash - 이전 엔트리의 해시값 (최초 엔트리는 GENESIS_HASH)
 * @returns 64자 SHA-256 헥스 문자열
 */
export function computeHash(data: string, previousHash: string): string {
  return createHash('sha256')
    .update(data)
    .update(previousHash)
    .digest('hex');
}

/**
 * 감사 엔트리 데이터를 해시 계산용 정규화된 문자열로 직렬화
 * integrity 필드를 제외한 나머지 필드를 결정론적으로 직렬화
 */
export function serializeEntryForHashing(
  entry: Omit<AuditEntry, 'integrity'>
): string {
  // JSON.stringify는 삽입 순서에 의존하므로 키를 명시적으로 정렬하여 결정론적 직렬화 보장
  return JSON.stringify(entry, Object.keys(entry).sort());
}

/**
 * 단일 감사 엔트리의 해시 무결성 검증
 * 저장된 hash값이 실제 데이터에서 계산한 값과 일치하는지 확인
 *
 * @param entry - 검증할 감사 엔트리
 * @param previousHash - 직전 엔트리의 해시값
 * @returns 해시가 일치하면 true, 불일치하면 false
 */
export function verifyEntry(
  entry: AuditEntry,
  previousHash: string
): boolean {
  // 현재 엔트리의 previous_hash가 전달된 previousHash와 일치하는지 확인
  if (entry.integrity.previous_hash !== previousHash) {
    return false;
  }

  // integrity 필드를 제외한 데이터로 해시 재계산
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { integrity: _integrity, ...entryWithoutIntegrity } = entry;
  const serialized = serializeEntryForHashing(entryWithoutIntegrity);
  const computedHash = computeHash(serialized, previousHash);

  return computedHash === entry.integrity.hash;
}

/**
 * 감사 엔트리 목록 전체 체인 검증
 * 첫 번째 엔트리부터 마지막 엔트리까지 순차적으로 해시 연결 검증
 * 빈 배열은 유효한 체인으로 처리
 *
 * @param entries - rowid 오름차순으로 정렬된 감사 엔트리 목록
 * @returns 체인이 유효하면 ok(true), 위반 발견 시 ok(false), DB 오류 시 err
 */
export function verifyChain(
  entries: AuditEntry[]
): Result<boolean, JarvisError> {
  try {
    // 빈 체인은 유효
    if (entries.length === 0) {
      return ok(true);
    }

    let previousHash = GENESIS_HASH;

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];

      // TypeScript noUncheckedIndexedAccess 대응 — undefined 가드
      if (entry === undefined) {
        return err(
          internalError(`체인 검증 실패: 인덱스 ${i}에서 엔트리 없음`)
        );
      }

      if (!verifyEntry(entry, previousHash)) {
        return ok(false);
      }

      // 다음 엔트리 검증을 위해 현재 엔트리의 해시를 previousHash로 설정
      previousHash = entry.integrity.hash;
    }

    return ok(true);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Unknown error';
    return err(
      internalError(`체인 검증 중 오류 발생: ${message}`)
    );
  }
}
