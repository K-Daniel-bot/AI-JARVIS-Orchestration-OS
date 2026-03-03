// 감사 로그 조회 — runId, sessionId, timeRange, riskLevel 기반 쿼리

import type Database from "better-sqlite3";
import type { AuditEntry, RiskLevel, Result, JarvisError } from "@jarvis/shared";
import { ok, err, createError } from "@jarvis/shared";
import { z } from "zod";

// SQLite 행 스키마 — 런타임 검증
const AuditRowSchema = z.object({
  entry_json: z.string(),
  hash: z.string(),
  previous_hash: z.string(),
});
type AuditQueryRow = z.infer<typeof AuditRowSchema>;

// UUID/ID 형식 검증 스키마
const IdSchema = z.string().min(1).max(256);
const LimitSchema = z.number().int().positive().max(10000);

// SQLite 행을 AuditEntry로 파싱
function parseRow(row: AuditQueryRow): AuditEntry {
  const entry = JSON.parse(row.entry_json) as Omit<AuditEntry, "integrity">;
  return {
    ...entry,
    integrity: {
      hash: row.hash,
      previousHash: row.previous_hash,
    },
  } as AuditEntry;
}

// 쿼리 결과 행을 안전하게 파싱
function parseRows(rawRows: unknown[]): Result<readonly AuditEntry[], JarvisError> {
  try {
    const entries: AuditEntry[] = [];
    for (const raw of rawRows) {
      const parsed = AuditRowSchema.safeParse(raw);
      if (!parsed.success) {
        return err(createError("VALIDATION_FAILED", `감사 로그 행 파싱 실패: ${parsed.error.message}`));
      }
      entries.push(parseRow(parsed.data));
    }
    return ok(entries);
  } catch (e: unknown) {
    return err(createError("INTERNAL_ERROR", `감사 로그 파싱 실패: ${String(e)}`));
  }
}

// 실행 ID로 감사 로그 조회
export function queryByRunId(
  db: Database.Database,
  runId: string,
): Result<readonly AuditEntry[], JarvisError> {
  const idResult = IdSchema.safeParse(runId);
  if (!idResult.success) {
    return err(createError("VALIDATION_FAILED", `유효하지 않은 runId: ${runId}`));
  }
  try {
    const stmt = db.prepare(
      "SELECT entry_json, hash, previous_hash FROM audit_log WHERE json_extract(entry_json, '$.execution.runId') = ? ORDER BY timestamp ASC",
    );
    const rows = stmt.all(runId);
    return parseRows(rows);
  } catch (e: unknown) {
    return err(createError("INTERNAL_ERROR", `runId 조회 실패: ${String(e)}`));
  }
}

// 세션 ID로 감사 로그 조회
export function queryBySessionId(
  db: Database.Database,
  sessionId: string,
): Result<readonly AuditEntry[], JarvisError> {
  const idResult = IdSchema.safeParse(sessionId);
  if (!idResult.success) {
    return err(createError("VALIDATION_FAILED", `유효하지 않은 sessionId: ${sessionId}`));
  }
  try {
    const stmt = db.prepare(
      "SELECT entry_json, hash, previous_hash FROM audit_log WHERE json_extract(entry_json, '$.who.sessionId') = ? ORDER BY timestamp ASC",
    );
    const rows = stmt.all(sessionId);
    return parseRows(rows);
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
  if (!from || !to) {
    return err(createError("VALIDATION_FAILED", "시간 범위의 from과 to는 필수입니다"));
  }
  if (from > to) {
    return err(createError("VALIDATION_FAILED", `from(${from})이 to(${to})보다 이후입니다`));
  }
  try {
    const stmt = db.prepare(
      "SELECT entry_json, hash, previous_hash FROM audit_log WHERE timestamp >= ? AND timestamp <= ? ORDER BY timestamp ASC",
    );
    const rows = stmt.all(from, to);
    return parseRows(rows);
  } catch (e: unknown) {
    return err(createError("INTERNAL_ERROR", `시간 범위 조회 실패: ${String(e)}`));
  }
}

// 위험 등급으로 감사 로그 조회
export function queryByRiskLevel(
  db: Database.Database,
  riskLevel: RiskLevel,
): Result<readonly AuditEntry[], JarvisError> {
  const validLevels: readonly string[] = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];
  if (!validLevels.includes(riskLevel)) {
    return err(createError("VALIDATION_FAILED", `유효하지 않은 riskLevel: ${riskLevel}`));
  }
  try {
    const stmt = db.prepare(
      "SELECT entry_json, hash, previous_hash FROM audit_log WHERE json_extract(entry_json, '$.policy.riskLevel') = ? ORDER BY timestamp ASC",
    );
    const rows = stmt.all(riskLevel);
    return parseRows(rows);
  } catch (e: unknown) {
    return err(createError("INTERNAL_ERROR", `riskLevel 조회 실패: ${String(e)}`));
  }
}

// 최신 N개 감사 로그 조회
export function queryLatest(
  db: Database.Database,
  limit: number,
): Result<readonly AuditEntry[], JarvisError> {
  const limitResult = LimitSchema.safeParse(limit);
  if (!limitResult.success) {
    return err(createError("VALIDATION_FAILED", `유효하지 않은 limit: ${limit}`));
  }
  try {
    const stmt = db.prepare(
      "SELECT entry_json, hash, previous_hash FROM audit_log ORDER BY timestamp DESC LIMIT ?",
    );
    const rows = stmt.all(limit);
    return parseRows(rows);
  } catch (e: unknown) {
    return err(createError("INTERNAL_ERROR", `최신 로그 조회 실패: ${String(e)}`));
  }
}
