// 감사 로그 SQLite DDL — 불변 append-only 테이블 정의

// 감사 로그 테이블 생성 SQL
export const CREATE_AUDIT_TABLE = `
CREATE TABLE IF NOT EXISTS audit_log (
  audit_id TEXT PRIMARY KEY,
  timestamp TEXT NOT NULL,
  log_level TEXT NOT NULL,
  entry_json TEXT NOT NULL,
  hash TEXT NOT NULL,
  previous_hash TEXT NOT NULL
);
` as const;

// 실행 ID로 빠른 조회를 위한 인덱스
export const CREATE_RUN_ID_INDEX = `
CREATE INDEX IF NOT EXISTS idx_audit_run_id
  ON audit_log(json_extract(entry_json, '$.execution.runId'));
` as const;

// 타임스탬프 기반 범위 조회를 위한 인덱스
export const CREATE_TIMESTAMP_INDEX = `
CREATE INDEX IF NOT EXISTS idx_audit_timestamp
  ON audit_log(timestamp);
` as const;

// 세션 ID 조회를 위한 인덱스
export const CREATE_SESSION_ID_INDEX = `
CREATE INDEX IF NOT EXISTS idx_audit_session_id
  ON audit_log(json_extract(entry_json, '$.who.sessionId'));
` as const;

// 모든 DDL을 순서대로 실행하기 위한 배열
export const ALL_DDL_STATEMENTS: readonly string[] = [
  CREATE_AUDIT_TABLE,
  CREATE_RUN_ID_INDEX,
  CREATE_TIMESTAMP_INDEX,
  CREATE_SESSION_ID_INDEX,
] as const;
