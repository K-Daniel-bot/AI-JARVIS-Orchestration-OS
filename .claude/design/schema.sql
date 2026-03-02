-- ============================================================
-- JARVIS OS SQLite 감사 로그 데이터베이스 스키마
-- version: 1.0.0
-- last_updated: 2026-03-02
-- 작성 원칙:
--   - audit_entries는 Append-only (UPDATE/DELETE 금지)
--   - SHA-256 해시 체인으로 무결성 보장
--   - capability_tokens는 상태 전이만 허용 (발급 → 소비/만료/폐기)
--   - 모든 민감 필드는 응용 계층에서 마스킹 후 저장
-- ============================================================

PRAGMA journal_mode = WAL;         -- 동시 읽기/쓰기 성능 향상
PRAGMA foreign_keys = ON;          -- 외래키 무결성 강제
PRAGMA auto_vacuum = INCREMENTAL;  -- 점진적 공간 회수

-- ============================================================
-- 테이블 1: audit_entries — 불변 감사 로그
--
-- 설계 원칙:
--   - Append-only: INSERT만 허용, UPDATE/DELETE 금지
--   - 해시 체인: hash = SHA256(이 행의 전체 내용 || previous_hash)
--   - 첫 번째 항목의 previous_hash = 'GENESIS' (고정값)
--   - entry_index는 session_id 범위 내에서 순차 증가
--   - JSON 컬럼은 파싱 가능한 유효한 JSON만 저장
-- ============================================================
CREATE TABLE IF NOT EXISTS audit_entries (
  -- 기본 키 및 식별자
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  audit_id      TEXT    UNIQUE NOT NULL,  -- aud_{YYYYMMDD}_{seq4} 형식

  -- 실행 컨텍스트 연결
  run_id        TEXT,                     -- run_{YYYYMMDD}_{seq4}, NULL 허용 (시스템 이벤트)
  session_id    TEXT    NOT NULL,         -- 세션 식별자 (필수)
  agent_id      TEXT,                     -- 작업을 수행한 에이전트 ID (시스템 이벤트는 NULL)

  -- 시간 및 순서
  timestamp     TEXT    NOT NULL,         -- UTC ISO 8601 (예: 2026-03-02T09:00:00.000Z)
  entry_index   INTEGER NOT NULL,         -- 세션 내 순차 인덱스 (1부터 시작, 무결성 검증용)

  -- 감사 페이로드 (JSON 직렬화, 민감 정보 마스킹 후 저장)
  who_json      TEXT    NOT NULL,         -- AuditEntry.who 객체 (user_id, role, session_id)
  what_json     TEXT    NOT NULL,         -- AuditEntry.what 객체 (raw_input, ai_interpretation, intent)
  policy_json   TEXT,                     -- AuditEntry.policy 객체 (NULL = 정책 미적용 이벤트)
  capability_json TEXT,                   -- AuditEntry.capability 객체 (NULL = Capability 미사용)
  execution_json  TEXT,                   -- AuditEntry.execution 객체 (NULL = 실행 없음)
  result_json   TEXT    NOT NULL,         -- AuditEntry.result 객체 (status, output_summary, artifacts)

  -- 로그 레벨
  log_level     TEXT    NOT NULL          -- 'FULL': 전체 기록 | 'SUMMARY': 요약만
    CHECK (log_level IN ('FULL', 'SUMMARY')),

  -- 해시 체인 무결성
  hash          TEXT    NOT NULL,         -- SHA-256(audit_id || session_id || timestamp || entry_index || who_json || what_json || result_json || previous_hash)
  previous_hash TEXT    NOT NULL,         -- 직전 항목의 hash ('GENESIS' = 체인의 첫 항목)

  -- 메타데이터
  created_at    TEXT    NOT NULL DEFAULT (datetime('now', 'utc'))  -- DB 삽입 시각 (자동 설정)
);

-- 감사 로그 조회 인덱스
-- run_id 기준 조회: 특정 Run의 전체 감사 로그 추출
CREATE INDEX IF NOT EXISTS idx_audit_run_id
  ON audit_entries (run_id);

-- session_id 기준 조회: 세션 단위 로그 뷰어
CREATE INDEX IF NOT EXISTS idx_audit_session_id
  ON audit_entries (session_id);

-- timestamp 기준 조회: 시간 범위 필터링 (대시보드 실시간 뷰)
CREATE INDEX IF NOT EXISTS idx_audit_timestamp
  ON audit_entries (timestamp);

-- entry_index 기준 조회: 해시 체인 순차 검증
CREATE INDEX IF NOT EXISTS idx_audit_entry_index
  ON audit_entries (session_id, entry_index);

-- agent_id 기준 조회: 에이전트별 활동 추적
CREATE INDEX IF NOT EXISTS idx_audit_agent_id
  ON audit_entries (agent_id, timestamp);


-- ============================================================
-- 테이블 2: capability_tokens — Capability Token 저장소
--
-- 설계 원칙:
--   - 1회 사용 원칙: remaining_uses 감소만 허용 (증가 금지)
--   - 상태 전이: ACTIVE → CONSUMED | EXPIRED | REVOKED (역방향 전이 금지)
--   - consumed_at은 CONSUMED 상태 전이 시 정확한 UTC 시각으로 설정
--   - 만료 검사: expires_at < now() 이면 EXPIRED 처리
--   - 응용 계층의 Enforcement Hook에서 원자적(atomic) 차감 수행
-- ============================================================
CREATE TABLE IF NOT EXISTS capability_tokens (
  -- 기본 키 및 식별자
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  token_id        TEXT    UNIQUE NOT NULL,  -- cap_{YYYYMMDD}_{seq4} 형식

  -- 발급 컨텍스트
  session_id          TEXT    NOT NULL,     -- 이 토큰이 속한 세션
  run_id              TEXT    NOT NULL,     -- 이 토큰이 속한 Run
  policy_decision_id  TEXT    NOT NULL,     -- 발급 근거가 된 PolicyDecision ID

  -- 권한 정의
  cap     TEXT    NOT NULL,                 -- 허용된 Capability (capability-token.json의 grant.cap 값)
  scope   TEXT    NOT NULL,                 -- JSON 직렬화된 허용 범위 (glob 패턴 배열)

  -- 유효 기간 및 사용 횟수
  ttl_seconds     INTEGER NOT NULL,         -- 유효 기간 (초)
  max_uses        INTEGER NOT NULL DEFAULT 1,      -- 최대 허용 사용 횟수 (기본: 1회)
  remaining_uses  INTEGER NOT NULL DEFAULT 1,      -- 남은 사용 횟수 (0이면 CONSUMED)

  -- 상태 관리
  status          TEXT    NOT NULL          -- ACTIVE | CONSUMED | EXPIRED | REVOKED
    CHECK (status IN ('ACTIVE', 'CONSUMED', 'EXPIRED', 'REVOKED')),

  -- 시간 정보
  issued_at       TEXT    NOT NULL,         -- 발급 시각 (UTC ISO 8601)
  expires_at      TEXT    NOT NULL,         -- 만료 시각 = issued_at + ttl_seconds
  consumed_at     TEXT,                     -- 소비 시각 (CONSUMED 상태일 때 설정, NULL 허용)

  -- 감사 정보
  issued_by       TEXT    NOT NULL DEFAULT 'policy-risk-agent',  -- 발급 에이전트 (고정값)
  approved_by     TEXT    NOT NULL          -- 승인 주체: 'user' (사용자 직접) | 'auto' (신뢰 모드 자동)
    CHECK (approved_by IN ('user', 'auto')),

  -- 사용 추적
  consumed_by_action  TEXT,                 -- 소비한 Action ID (action-api.json의 action_id)
  revoked_reason      TEXT                  -- 폐기 사유 (REVOKED 상태일 때 설정)
);

-- capability_tokens 조회 인덱스
-- session_id 기준 조회: 세션 내 모든 토큰 조회
CREATE INDEX IF NOT EXISTS idx_cap_session_id
  ON capability_tokens (session_id);

-- run_id 기준 조회: Run 단위 토큰 집계
CREATE INDEX IF NOT EXISTS idx_cap_run_id
  ON capability_tokens (run_id);

-- status 기준 조회: ACTIVE 토큰만 빠르게 추출 (Enforcement Hook 핫패스)
CREATE INDEX IF NOT EXISTS idx_cap_status
  ON capability_tokens (status, expires_at);

-- cap + session_id 복합 인덱스: 특정 권한의 유효 토큰 빠른 조회
CREATE INDEX IF NOT EXISTS idx_cap_cap_session
  ON capability_tokens (cap, session_id, status);


-- ============================================================
-- 테이블 3: checkpoints — 체크포인트 메타데이터
--
-- 설계 원칙:
--   - 실제 상태 스냅샷은 file_path가 가리키는 JSON 파일에 저장
--   - 이 테이블은 체크포인트 목록 인덱스 역할만 수행
--   - rollback 에이전트가 복구 시 가장 최근 체크포인트를 참조
--   - 체크포인트 파일 위치: .ai-run/checkpoints/{checkpoint_id}.json
-- ============================================================
CREATE TABLE IF NOT EXISTS checkpoints (
  -- 기본 키 및 식별자
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  checkpoint_id   TEXT    UNIQUE NOT NULL,  -- cp_{YYYYMMDD}_{seq4} 형식

  -- 실행 컨텍스트 연결
  run_id          TEXT    NOT NULL,         -- 체크포인트가 속한 Run
  session_id      TEXT    NOT NULL,         -- 체크포인트가 속한 세션

  -- 상태 정보
  state_name      TEXT    NOT NULL,         -- 저장 시점의 XState 상태명 (state-machine.json의 States 키)
  saved_at        TEXT    NOT NULL,         -- 체크포인트 저장 시각 (UTC ISO 8601)

  -- 파일 참조
  file_path       TEXT    NOT NULL,         -- 스냅샷 JSON 파일 경로 (절대 경로)
  size_bytes      INTEGER,                  -- 스냅샷 파일 크기 (바이트, NULL 허용)

  -- 롤백 메타데이터
  agent_id        TEXT,                     -- 체크포인트를 생성한 에이전트 (보통 orchestrator)
  description     TEXT,                     -- 체크포인트 생성 사유 (예: "Gate L2 승인 전 저장")
  is_rollback_point BOOLEAN NOT NULL DEFAULT 0  -- 롤백 기준점 여부 (1=기준점, 0=중간 저장)
);

-- checkpoints 조회 인덱스
-- run_id 기준 조회: 특정 Run의 모든 체크포인트 목록
CREATE INDEX IF NOT EXISTS idx_cp_run_id
  ON checkpoints (run_id, saved_at DESC);

-- session_id 기준 조회: 세션의 롤백 이력
CREATE INDEX IF NOT EXISTS idx_cp_session_id
  ON checkpoints (session_id, saved_at DESC);

-- rollback_point 기준 조회: 기준 체크포인트만 빠르게 조회
CREATE INDEX IF NOT EXISTS idx_cp_rollback_point
  ON checkpoints (run_id, is_rollback_point, saved_at DESC);


-- ============================================================
-- 뷰: v_active_tokens — 현재 유효한 Capability Token 뷰
--
-- 설명: ACTIVE 상태이고 만료되지 않은 토큰만 반환
--   응용 계층의 Enforcement Hook에서 토큰 검증에 사용
-- ============================================================
CREATE VIEW IF NOT EXISTS v_active_tokens AS
SELECT
  token_id,
  session_id,
  run_id,
  cap,
  scope,
  ttl_seconds,
  max_uses,
  remaining_uses,
  issued_at,
  expires_at,
  approved_by
FROM capability_tokens
WHERE status = 'ACTIVE'
  AND expires_at > datetime('now', 'utc')
  AND remaining_uses > 0;


-- ============================================================
-- 뷰: v_session_audit_summary — 세션별 감사 요약 뷰
--
-- 설명: 세션 단위로 집계한 활동 통계
--   대시보드 AuditLogPanel 및 세션 종료 리포트에 사용
-- ============================================================
CREATE VIEW IF NOT EXISTS v_session_audit_summary AS
SELECT
  session_id,
  COUNT(*)                                              AS total_entries,
  MIN(timestamp)                                        AS session_start,
  MAX(timestamp)                                        AS last_activity,
  COUNT(DISTINCT agent_id)                              AS unique_agents,
  COUNT(DISTINCT run_id)                                AS total_runs,
  SUM(CASE WHEN log_level = 'FULL' THEN 1 ELSE 0 END)    AS full_log_count,
  SUM(CASE WHEN log_level = 'SUMMARY' THEN 1 ELSE 0 END)  AS summary_log_count
FROM audit_entries
GROUP BY session_id;


-- ============================================================
-- 뷰: v_latest_checkpoints — Run별 최신 체크포인트 뷰
--
-- 설명: 각 Run의 가장 최근 체크포인트 정보
--   rollback 에이전트가 복구 시작 지점을 찾는 데 사용
-- ============================================================
CREATE VIEW IF NOT EXISTS v_latest_checkpoints AS
SELECT
  cp.run_id,
  cp.session_id,
  cp.checkpoint_id,
  cp.state_name,
  cp.saved_at,
  cp.file_path,
  cp.size_bytes,
  cp.is_rollback_point
FROM checkpoints cp
INNER JOIN (
  -- Run별 가장 최근 저장 시각
  SELECT run_id, MAX(saved_at) AS max_saved_at
  FROM checkpoints
  GROUP BY run_id
) latest ON cp.run_id = latest.run_id
        AND cp.saved_at = latest.max_saved_at;


-- ============================================================
-- 초기 데이터: 해시 체인 제네시스 레코드
--
-- 설명: 해시 체인의 최초 기준점 역할을 하는 제네시스 항목
--   실제 감사 로그는 이 항목 다음부터 시작
--   previous_hash 필드 값 'GENESIS'는 체인 시작 표시
-- ============================================================
INSERT OR IGNORE INTO audit_entries (
  audit_id,
  run_id,
  session_id,
  agent_id,
  timestamp,
  entry_index,
  who_json,
  what_json,
  policy_json,
  capability_json,
  execution_json,
  result_json,
  log_level,
  hash,
  previous_hash
) VALUES (
  'aud_GENESIS_0000',                          -- 제네시스 항목 식별자
  NULL,                                        -- Run 없음
  'SYSTEM',                                    -- 시스템 세션
  'system',                                    -- 시스템 에이전트
  '2026-03-02T00:00:00.000Z',                  -- 시스템 기준 시각
  0,                                           -- 인덱스 0 (제네시스)
  '{"user_id":"SYSTEM","role":"Owner","session_id":"SYSTEM"}',
  '{"raw_input":"GENESIS","ai_interpretation":"해시 체인 초기화","intent":"SYSTEM_INIT"}',
  NULL,
  NULL,
  NULL,
  '{"status":"COMPLETED","output_summary":"감사 로그 해시 체인 초기화 완료","artifacts":[]}',
  'SUMMARY',
  'GENESIS_HASH_0000000000000000000000000000000000000000000000000000000000000',  -- 제네시스 해시 (고정값)
  'GENESIS'                                    -- 체인 시작 표시
);

-- ============================================================
-- 스키마 버전 메모
-- version: 1.0.0
-- 다음 버전(1.1.0) 계획:
--   - audit_entries에 redaction_json 컬럼 추가 (마스킹 이력)
--   - capability_tokens에 consumed_by_agent 컬럼 추가
--   - v_token_usage_stats 뷰 추가 (에이전트별 토큰 소비 통계)
-- ============================================================
