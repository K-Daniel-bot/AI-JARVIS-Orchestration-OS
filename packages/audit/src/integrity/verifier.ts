// 무결성 검증기 — 감사 로그 해시 체인 전체 검증

import type { Result } from "@jarvis/shared";
import type { JarvisError } from "@jarvis/shared";
import { ok, err, createError, GENESIS_HASH } from "@jarvis/shared";
import { validateEntryHash } from "./hash-chain.js";

// 감사 로그 행 데이터 (SQLite에서 읽은 원시 데이터)
export interface AuditRow {
  readonly audit_id: string;
  readonly timestamp: string;
  readonly entry_json: string;
  readonly hash: string;
  readonly previous_hash: string;
}

// 전체 해시 체인 무결성 검증
export function verifyChain(rows: readonly AuditRow[]): Result<boolean, JarvisError> {
  if (rows.length === 0) {
    return ok(true);
  }

  // 첫 번째 엔트리의 previousHash는 반드시 제네시스 해시여야 함
  const firstRow = rows[0];
  if (!firstRow) {
    return ok(true);
  }

  if (firstRow.previous_hash !== GENESIS_HASH) {
    return err(createError(
      "AUDIT_INTEGRITY_VIOLATION",
      `첫 번째 엔트리의 previousHash가 제네시스 해시와 불일치: ${firstRow.audit_id}`,
      { context: { auditId: firstRow.audit_id } },
    ));
  }

  // 모든 엔트리를 순차 검증
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    if (!row) {
      continue;
    }

    const expectedPrevHash = i === 0 ? GENESIS_HASH : rows[i - 1]?.hash ?? GENESIS_HASH;

    // previousHash 체인 연결 확인
    if (row.previous_hash !== expectedPrevHash) {
      return err(createError(
        "AUDIT_INTEGRITY_VIOLATION",
        `해시 체인 연결 끊김: 인덱스 ${i}, auditId=${row.audit_id}`,
        { context: { index: i, auditId: row.audit_id } },
      ));
    }

    // 해시 값 재계산 후 비교
    if (!validateEntryHash(row.entry_json, row.previous_hash, row.hash)) {
      return err(createError(
        "AUDIT_INTEGRITY_VIOLATION",
        `해시 불일치: 인덱스 ${i}, auditId=${row.audit_id}`,
        { context: { index: i, auditId: row.audit_id } },
      ));
    }
  }

  return ok(true);
}
