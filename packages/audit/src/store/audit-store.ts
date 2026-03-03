// AuditStore — SQLite 기반 불변 감사 로그 저장소 (append-only)

import Database from "better-sqlite3";
import type {
  AuditEntry,
  Result,
  JarvisError,
  RiskLevel,
} from "@jarvis/shared";
import {
  ok,
  err,
  createError,
  generateAuditId,
  nowISO,
  GENESIS_HASH,
} from "@jarvis/shared";
import { ALL_DDL_STATEMENTS } from "./schema.sql.js";
import { computeNextHash } from "../integrity/hash-chain.js";
import { verifyChain } from "../integrity/verifier.js";
import type { AuditRow } from "../integrity/verifier.js";
import { redactDeep } from "../redaction/redactor.js";
import {
  queryByRunId,
  queryBySessionId,
  queryByTimeRange,
  queryByRiskLevel,
  queryLatest,
} from "../query/audit-query.js";

// 감사 로그 저장소 — 생성, 추가, 조회, 무결성 검증
export class AuditStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    // WAL 모드로 동시 읽기 성능 향상
    this.db.pragma("journal_mode = WAL");
    this.initTables();
  }

  // 테이블 및 인덱스 초기화
  private initTables(): void {
    const transaction = this.db.transaction(() => {
      for (const ddl of ALL_DDL_STATEMENTS) {
        this.db.exec(ddl);
      }
    });
    transaction();
  }

  // 최대 엔트리 크기 (1MB)
  private static readonly MAX_ENTRY_SIZE = 1024 * 1024;

  // 감사 로그 엔트리 추가 (해시 체인 자동 갱신, 트랜잭션으로 원자성 보장)
  append(
    entry: Omit<AuditEntry, "integrity">,
  ): Result<AuditEntry, JarvisError> {
    try {
      // 민감 정보 마스킹 적용
      const { redacted, totalPatterns, categories } = redactDeep(entry);
      const redactedEntry = redacted as Omit<AuditEntry, "integrity">;

      // auditId와 timestamp 자동 생성 (없으면)
      const auditId = redactedEntry.auditId || generateAuditId();
      const timestamp = redactedEntry.timestamp || nowISO();

      // redactions 필드에 마스킹 정보 반영
      const finalEntry: Omit<AuditEntry, "integrity"> = {
        ...redactedEntry,
        auditId,
        timestamp,
        redactions: {
          applied: categories as unknown as readonly string[],
          patternsMatched: totalPatterns,
        },
      };

      const entryJson = JSON.stringify(finalEntry);

      // 엔트리 크기 제한 검증
      if (entryJson.length > AuditStore.MAX_ENTRY_SIZE) {
        return err(createError("RESOURCE_EXHAUSTED", `감사 로그 엔트리 크기 초과: ${entryJson.length} > ${AuditStore.MAX_ENTRY_SIZE}`));
      }

      // 트랜잭션으로 해시 체인 원자성 보장 (BEGIN IMMEDIATE로 동시 쓰기 시 쓰기 잠금 즉시 획득)
      let hash = "";
      let previousHash = "";

      const transaction = this.db.transaction(() => {
        previousHash = this.getLastHash();
        hash = computeNextHash(entryJson, previousHash);

        const stmt = this.db.prepare(
          "INSERT INTO audit_log (audit_id, timestamp, log_level, entry_json, hash, previous_hash) VALUES (?, ?, ?, ?, ?, ?)",
        );
        stmt.run(auditId, timestamp, finalEntry.logLevel, entryJson, hash, previousHash);
      });
      transaction.immediate();

      // 완성된 AuditEntry 반환
      const fullEntry: AuditEntry = {
        ...finalEntry,
        integrity: { hash, previousHash },
      };

      return ok(fullEntry);
    } catch (e: unknown) {
      const msg = String(e);
      if (msg.includes("UNIQUE constraint failed") || msg.includes("PRIMARY KEY")) {
        return err(createError("VALIDATION_FAILED", `감사 로그 ID 중복: ${String(e)}`));
      }
      if (msg.includes("disk") || msg.includes("SQLITE_FULL")) {
        return err(createError("RESOURCE_EXHAUSTED", "디스크 공간 부족으로 감사 로그 추가 실패"));
      }
      return err(createError("INTERNAL_ERROR", `감사 로그 추가 실패: ${String(e)}`));
    }
  }

  // 마지막 엔트리의 해시 조회 (없으면 제네시스 해시)
  private getLastHash(): string {
    const row = this.db.prepare(
      "SELECT hash FROM audit_log ORDER BY rowid DESC LIMIT 1",
    ).get() as { hash: string } | undefined;
    return row?.hash ?? GENESIS_HASH;
  }

  // 실행 ID로 조회
  getByRunId(runId: string): Result<readonly AuditEntry[], JarvisError> {
    return queryByRunId(this.db, runId);
  }

  // 세션 ID로 조회
  getBySessionId(sessionId: string): Result<readonly AuditEntry[], JarvisError> {
    return queryBySessionId(this.db, sessionId);
  }

  // 시간 범위로 조회
  getByTimeRange(from: string, to: string): Result<readonly AuditEntry[], JarvisError> {
    return queryByTimeRange(this.db, from, to);
  }

  // 위험 등급으로 조회
  getByRiskLevel(riskLevel: RiskLevel): Result<readonly AuditEntry[], JarvisError> {
    return queryByRiskLevel(this.db, riskLevel);
  }

  // 최신 N개 조회
  getLatest(limit: number): Result<readonly AuditEntry[], JarvisError> {
    return queryLatest(this.db, limit);
  }

  // 전체 해시 체인 무결성 검증
  verifyIntegrity(): Result<boolean, JarvisError> {
    try {
      const rows = this.db.prepare(
        "SELECT audit_id, timestamp, entry_json, hash, previous_hash FROM audit_log ORDER BY rowid ASC",
      ).all() as AuditRow[];
      return verifyChain(rows);
    } catch (e: unknown) {
      return err(createError("INTERNAL_ERROR", `무결성 검증 실패: ${String(e)}`));
    }
  }

  // 엔트리 수 반환 — 삭제 감지용
  getEntryCount(): number {
    const row = this.db.prepare("SELECT COUNT(*) as cnt FROM audit_log").get() as { cnt: number };
    return row.cnt;
  }

  // DB 연결 종료
  close(): void {
    this.db.close();
  }
}
