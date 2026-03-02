// 해시 체인 무결성 — SHA-256 기반 append-only 체인 관리

import { computeAuditHash, GENESIS_HASH } from "@jarvis/shared";

// 새 엔트리의 해시를 계산하여 반환
export function computeNextHash(entryJson: string, previousHash: string): string {
  return computeAuditHash(entryJson, previousHash);
}

// 단일 엔트리의 해시 유효성 검증
export function validateEntryHash(
  entryJson: string,
  previousHash: string,
  expectedHash: string,
): boolean {
  const computed = computeAuditHash(entryJson, previousHash);
  return computed === expectedHash;
}

// 제네시스 해시 반환 (첫 번째 엔트리의 previousHash)
export function getGenesisHash(): string {
  return GENESIS_HASH;
}
