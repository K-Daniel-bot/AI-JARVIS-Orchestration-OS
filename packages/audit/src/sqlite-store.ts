// SQLite 저장소 — 감사 로그 영속화를 담당하는 하위 레이어
// better-sqlite3 기반의 동기식 SQLite 인터페이스 사용

import Database from 'better-sqlite3';
import type { AuditEntry, RiskLevel, AuditResultStatus } from '@jarvis/shared';
import { ok, err, dbError } from '@jarvis/shared';
import type { Result, JarvisError } from '@jarvis/shared';

/** 데이터베이스 인스턴스 타입 재노출 (내부 사용) */
export type { Database };

/** SQLite 행 조회 결과 — JSON 컬럼 포함 */
interface AuditRow {
  readonly audit_id: string;
  readonly timestamp: string;
  readonly log_level: string;
  readonly data: string;
  readonly hash: string;
  readonly previous_hash: string;
}

/** 엔트리 쿼리 필터 조건 */
export interface QueryFilter {
  readonly startTime?: string;
  readonly endTime?: string;
  readonly riskLevel?: RiskLevel;
  readonly status?: AuditResultStatus;
  readonly limit?: number;
  readonly offset?: number;
}

/** 최대 조회 행 수 — 무제한 쿼리 방지 */
const MAX_QUERY_LIMIT = 1000;

/**
 * 데이터베이스 초기화 — audit_entries 테이블 생성 및 인덱스 설정
 * 멱등성 보장 (IF NOT EXISTS 사용)
 */
export function initDatabase(dbPath: string): Database.Database {
  const db = new Database(dbPath);

  // WAL 모드 활성화 — 동시 읽기 성능 개선
  db.pragma('journal_mode = WAL');
  // 외래키 무결성 활성화
  db.pragma('foreign_keys = ON');

  // 감사 로그 엔트리 테이블 생성
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_entries (
      audit_id      TEXT PRIMARY KEY,
      timestamp     TEXT NOT NULL,
      log_level     TEXT NOT NULL CHECK (log_level IN ('FULL', 'SUMMARY')),
      data          TEXT NOT NULL,
      hash          TEXT NOT NULL,
      previous_hash TEXT NOT NULL
    );

    -- 시간 범위 쿼리 최적화 인덱스
    CREATE INDEX IF NOT EXISTS idx_audit_timestamp
      ON audit_entries (timestamp);

    -- 삽입 순서 추적용 rowid 기반 인덱스 (기본 내장)
  `);

  return db;
}

/**
 * 감사 엔트리 삽입 — 중복 audit_id 거부 (append-only 보장)
 * 트랜잭션 내에서 원자적으로 실행
 */
export function insertEntry(
  db: Database.Database,
  entry: AuditEntry
): Result<void, JarvisError> {
  try {
    const stmt = db.prepare(`
      INSERT INTO audit_entries (audit_id, timestamp, log_level, data, hash, previous_hash)
      VALUES (@audit_id, @timestamp, @log_level, @data, @hash, @previous_hash)
    `);

    stmt.run({
      audit_id: entry.audit_id,
      timestamp: entry.timestamp,
      log_level: entry.log_level,
      // 전체 엔트리를 JSON으로 직렬화하여 data 컬럼에 저장
      data: JSON.stringify(entry),
      hash: entry.integrity.hash,
      previous_hash: entry.integrity.previous_hash,
    });

    return ok(undefined);
  } catch (e: unknown) {
    return err(dbError(`감사 엔트리 삽입: audit_id=${entry.audit_id}`, e));
  }
}

/**
 * 마지막 감사 엔트리 조회 — 해시 체인 연결을 위해 사용
 * rowid 기준 내림차순으로 첫 번째 행 반환
 */
export function getLastEntry(
  db: Database.Database
): Result<AuditEntry | null, JarvisError> {
  try {
    const stmt = db.prepare(`
      SELECT * FROM audit_entries
      ORDER BY rowid DESC
      LIMIT 1
    `);

    const row = stmt.get() as AuditRow | undefined;

    if (row === undefined) {
      return ok(null);
    }

    return ok(parseRow(row));
  } catch (e: unknown) {
    return err(dbError('마지막 엔트리 조회', e));
  }
}

/**
 * 감사 엔트리 목록 조회 — 필터 조건 적용 가능
 * 시간 범위, 위험도, 결과 상태로 필터링 지원
 */
export function queryEntries(
  db: Database.Database,
  filter: QueryFilter
): Result<AuditEntry[], JarvisError> {
  try {
    // 동적 쿼리 조건 조립 — SQL Injection 방지를 위해 파라미터화 사용
    const conditions: string[] = [];
    const params: Record<string, unknown> = {};

    if (filter.startTime !== undefined) {
      conditions.push('timestamp >= @startTime');
      params['startTime'] = filter.startTime;
    }

    if (filter.endTime !== undefined) {
      conditions.push('timestamp <= @endTime');
      params['endTime'] = filter.endTime;
    }

    // 위험도 및 상태 필터는 JSON 데이터에서 추출 후 필터링
    // SQLite JSON 함수 활용
    if (filter.riskLevel !== undefined) {
      conditions.push(`json_extract(data, '$.policy.risk_level') = @riskLevel`);
      params['riskLevel'] = filter.riskLevel;
    }

    if (filter.status !== undefined) {
      conditions.push(`json_extract(data, '$.result.status') = @status`);
      params['status'] = filter.status;
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // 최대 조회 수 제한 적용
    const limit = Math.min(filter.limit ?? MAX_QUERY_LIMIT, MAX_QUERY_LIMIT);
    const offset = filter.offset ?? 0;

    params['limit'] = limit;
    params['offset'] = offset;

    const stmt = db.prepare(`
      SELECT * FROM audit_entries
      ${whereClause}
      ORDER BY timestamp ASC
      LIMIT @limit OFFSET @offset
    `);

    const rows = stmt.all(params) as AuditRow[];
    return ok(rows.map(parseRow));
  } catch (e: unknown) {
    return err(dbError('엔트리 목록 조회', e));
  }
}

/**
 * audit_id로 특정 감사 엔트리 조회
 */
export function getEntryById(
  db: Database.Database,
  auditId: string
): Result<AuditEntry | null, JarvisError> {
  try {
    const stmt = db.prepare(`
      SELECT * FROM audit_entries WHERE audit_id = @audit_id
    `);

    const row = stmt.get({ audit_id: auditId }) as AuditRow | undefined;

    if (row === undefined) {
      return ok(null);
    }

    return ok(parseRow(row));
  } catch (e: unknown) {
    return err(dbError(`엔트리 조회: audit_id=${auditId}`, e));
  }
}

/**
 * 전체 엔트리 조회 — 체인 검증용 (rowid 오름차순)
 * 대용량 데이터베이스에서는 분할 처리 필요
 */
export function getAllEntriesOrdered(
  db: Database.Database
): Result<AuditEntry[], JarvisError> {
  try {
    const stmt = db.prepare(`
      SELECT * FROM audit_entries ORDER BY rowid ASC
    `);

    const rows = stmt.all() as AuditRow[];
    return ok(rows.map(parseRow));
  } catch (e: unknown) {
    return err(dbError('전체 엔트리 조회', e));
  }
}

/**
 * SQLite 행 데이터를 AuditEntry 타입으로 변환
 * data 컬럼의 JSON 파싱 수행
 */
function parseRow(row: AuditRow): AuditEntry {
  return JSON.parse(row.data) as AuditEntry;
}
