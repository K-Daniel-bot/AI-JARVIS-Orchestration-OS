// 감사 로그 조회 — runId, sessionId, timeRange, riskLevel 기반 쿼리

import type Database from "better-sqlite3";
import type { AuditEntry, RiskLevel, Result, JarvisError } from "@jarvis/shared";
import { ok, err, createError } from "@jarvis/shared";

// SQLite 행을 AuditEntry로 파싱
function parseRow(row: { entry_json: string; hash: string; previous_hash: string }): AuditEntry {
  const entry = JSON.parse(row.entry_json) as Omit<AuditEntry, "integrity">;
  return {
    ...entry,
    integrity: {
      hash: row.hash,
      previousHash: row.previous_hash,
    },
  } as AuditEntry;
}

// 실행 ID로 감사 로그 조회
export function queryByRunId(
  db: Database.Database,
  runId: string,
): Result<readonly AuditEntry[], JarvisError> {
  try {
    const stmt = db.prepare(
      "SELECT entry_json, hash, previous_hash FROM audit_log WHERE json_extract(entry_json, '$.execution.runId') = ? ORDER BY timestamp ASC",
    );
    const rows = stmt.all(runId) as { entry_json: string; hash: string; previous_hash: string }[];
    return ok(rows.map(parseRow));
  } catch (e: unknown) {
    return err(createError("INTERNAL_ERROR", `runId 조회 실패: ${String(e)}`));
  }
}

// 세션 ID로 감사 로그 조회
export function queryBySessionId(
  db: Database.Database,
  sessionId: string,
): Result<readonly AuditEntry[], JarvisError> {
  try {
    const stmt = db.prepare(
      "SELECT entry_json, hash, previous_hash FROM audit_log WHERE json_extract(entry_json, '$.who.sessionId') = ? ORDER BY timestamp ASC",
    );
    const rows = stmt.all(sessionId) as { entry_json: string; hash: string; previous_hash: string }[];
    return ok(rows.map(parseRow));
  } catch (e: unknown) {
    return err(createError("INTERNAL_ERROR", `sessionId 조회 실패: ${String(e)}`));
  }
}

// 시간 범위로 감사 로그 조회
export function queryByTimeRange(
  db: Database.Database,
  from: string,
  to: string,
): Result<readonly AuditEntry[], JarvisError> {
  try {
    const stmt = db.prepare(
      "SELECT entry_json, hash, previous_hash FROM audit_log WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC",
    );
    const rows = stmt.all(from, to) as { entry_json: string; hash: string; previous_hash: string }[];
    return ok(rows.map(parseRow));
  } catch (e: unknown) {
    return err(createError("INTERNAL_ERROR", `시간 범위 조회 실패: ${String(e)}`));
  }
}

// 위험 등급으로 감사 로그 조회
export function queryByRiskLevel(
  db: Database.Database,
  riskLevel: RiskLevel,
): Result<readonly AuditEntry[], JarvisError> {
  try {
    const stmt = db.prepare(
      "SELECT entry_json, hash, previous_hash FROM audit_log WHERE json_extract(entry_json, '$.policy.riskLevel') = ? ORDER BY timestamp ASC",
    );
    const rows = stmt.all(riskLevel) as { entry_json: string; hash: string; previous_hash: string }[];
    return ok(rows.map(parseRow));
  } catch (e: unknown) {
    return err(createError("INTERNAL_ERROR", `riskLevel 조회 실패: ${String(e)}`));
  }
}

// 최신 N개 감사 로그 조회
export function queryLatest(
  db: Database.Database,
  limit: number,
): Result<readonly AuditEntry[], JarvisError> {
  try {
    const stmt = db.prepare(
      "SELECT entry_json, hash, previous_hash FROM audit_log ORDER BY timestamp DESC LIMIT ?",
    );
    const rows = stmt.all(limit) as { entry_json: string; hash: string; previous_hash: string }[];
    return ok(rows.map(parseRow));
  } catch (e: unknown) {
    return err(createError("INTERNAL_ERROR", `최신 로그 조회 실패: ${String(e)}`));
  }
}
