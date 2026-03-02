# 데이터베이스 쿼리 라이브러리

**Phase**: 0+1
**Status**: 설계 문서 (구현 가이드)
**Last Updated**: 2026-03-02

---

## 목차

1. [개요](#개요)
2. [스키마 참고](#스키마-참고)
3. [AuditLog 쿼리](#auditlog-쿼리)
4. [CapabilityToken 쿼리](#capabilitytoken-쿼리)
5. [Checkpoint 쿼리](#checkpoint-쿼리)
6. [뷰(Views) 쿼리](#뷰views-쿼리)
7. [구현 패턴](#구현-패턴)
8. [트랜잭션 처리](#트랜잭션-처리)

---

## 개요

JARVIS OS는 **SQLite 기반 append-only 감시 로그**와 **Capability Token 상태 관리**를 위해
다음 3개 주요 테이블을 사용한다:

1. **audit_entries** — 불변 감사 로그 (해시 체인 무결성)
2. **capability_tokens** — 1회 사용 권한 토큰 상태 추적
3. **checkpoints** — 롤백/복구 포인트 저장

이 문서는 각 테이블에 대한 **일반적 쿼리 패턴**과 **타입 안전 함수 시그니처**를 정의한다.
실제 구현은 `packages/audit/src/` 와 `packages/executor/src/` 에서 수행한다.

---

## 스키마 참고

### schema.sql 참고

```sql
-- 1. audit_entries 테이블
CREATE TABLE audit_entries (
  entry_id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  who TEXT NOT NULL,
  what TEXT NOT NULL,
  context_json TEXT,
  policy_json TEXT,
  capability_json TEXT,
  execution_json TEXT,
  result_json TEXT,
  prev_hash TEXT,
  entry_hash TEXT NOT NULL,
  entry_index INTEGER NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. capability_tokens 테이블
CREATE TABLE capability_tokens (
  cap_id TEXT PRIMARY KEY,
  issued_at INTEGER NOT NULL,
  issued_by TEXT NOT NULL,
  approved_by TEXT,
  scope_allow_json TEXT NOT NULL,
  scope_deny_json TEXT NOT NULL,
  ttl_seconds INTEGER NOT NULL,
  max_uses INTEGER DEFAULT 1,
  remaining_uses INTEGER NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('ACTIVE','CONSUMED','EXPIRED','REVOKED')),
  context_policy_decision_id TEXT,
  signature_hmac TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. checkpoints 테이블
CREATE TABLE checkpoints (
  checkpoint_id TEXT PRIMARY KEY,
  run_id TEXT NOT NULL,
  xstate_context_json TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_by TEXT NOT NULL
);
```

---

## AuditLog 쿼리

### 1. insertAuditEntry() — 감사 로그 추가

```typescript
/**
 * insertAuditEntry() — audit_entries에 새 로그 레코드 추가
 *
 * 특징:
 * - entry_hash: SHA-256(prev_hash + entry_json)로 체인 무결성 검증
 * - entry_index: 자동 증가 (1, 2, 3, ...)
 * - JSON 필드: context, policy, capability, execution, result
 *
 * @param entry — AuditEntry 객체
 * @returns Promise<Result<{ entry_id: string }, DBError>>
 *   - Ok: entry_id 반환
 *   - Err: DB_ERROR (중복 ID, 해시 검증 실패 등)
 *
 * 구현 가이드:
 * 1. 마지막 로그의 entry_hash를 prev_hash로 설정
 * 2. SHA-256(prev_hash + JSON.stringify(entry)) 계산
 * 3. INSERT 실행
 * 4. 해시 검증 실패 → HASH_MISMATCH 에러 반환
 */
async function insertAuditEntry(entry: AuditEntry): Promise<Result<{
  entry_id: string
}, DBError>> {
  // 예시 구현 (실제는 packages/audit/src/audit-log.ts)
  try {
    // 1. 마지막 entry_hash 조회
    const lastEntry = await db.get(
      `SELECT entry_hash, entry_index FROM audit_entries ORDER BY entry_index DESC LIMIT 1`
    );

    const prevHash = lastEntry?.entry_hash || 'GENESIS';
    const nextIndex = (lastEntry?.entry_index || 0) + 1;

    // 2. entry_hash 계산
    const entryJson = JSON.stringify(entry);
    const entryHash = sha256(prevHash + entryJson);

    // 3. INSERT
    const entry_id = generateUUID();
    await db.run(
      `INSERT INTO audit_entries (
        entry_id, timestamp, who, what, context_json, policy_json,
        capability_json, execution_json, result_json,
        prev_hash, entry_hash, entry_index
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        entry_id,
        Date.now(),
        entry.who,
        entry.what,
        entry.context ? JSON.stringify(entry.context) : null,
        entry.policy ? JSON.stringify(entry.policy) : null,
        entry.capability ? JSON.stringify(maskCapability(entry.capability)) : null,
        entry.execution ? JSON.stringify(entry.execution) : null,
        entry.result ? JSON.stringify(entry.result) : null,
        prevHash,
        entryHash,
        nextIndex
      ]
    );

    return Ok({ entry_id });
  } catch (error) {
    return Err({
      code: 'DB_ERROR',
      message: `insertAuditEntry failed: ${error}`
    });
  }
}
```

### 2. queryAuditLog() — 감사 로그 조회

```typescript
/**
 * queryAuditLog() — 필터 조건에 따라 감사 로그 조회
 *
 * @param filter — AuditQueryFilter
 *   - since?: timestamp (밀리초, 포함)
 *   - until?: timestamp (밀리초, 제외)
 *   - who?: 에이전트 ID 또는 'user' 필터
 *   - what?: 작업 설명 substring 검색 (LIKE)
 *   - result_status?: 'success' | 'error' | undefined (모두)
 *   - limit?: 기본 1000
 *   - offset?: 기본 0
 *
 * @returns Promise<Result<AuditEntry[], DBError>>
 *
 * 예시:
 * - 어제 이후 모든 policy 에러: queryAuditLog({ since: yesterday, what: 'POLICY', result_status: 'error' })
 * - 특정 세션의 모든 로그: queryAuditLog({ who: 'session-abc' })
 * - executor만의 성공 로그: queryAuditLog({ who: 'executor', result_status: 'success' })
 */
async function queryAuditLog(filter: AuditQueryFilter): Promise<Result<AuditEntry[], DBError>> {
  try {
    let sql = `SELECT * FROM audit_entries WHERE 1=1`;
    const params: any[] = [];

    if (filter.since !== undefined) {
      sql += ` AND timestamp >= ?`;
      params.push(filter.since);
    }
    if (filter.until !== undefined) {
      sql += ` AND timestamp < ?`;
      params.push(filter.until);
    }
    if (filter.who !== undefined) {
      sql += ` AND who = ?`;
      params.push(filter.who);
    }
    if (filter.what !== undefined) {
      sql += ` AND what LIKE ?`;
      params.push(`%${filter.what}%`);
    }
    if (filter.result_status !== undefined) {
      sql += ` AND json_extract(result_json, '$.status') = ?`;
      params.push(filter.result_status);
    }

    sql += ` ORDER BY entry_index ASC`;
    sql += ` LIMIT ? OFFSET ?`;
    params.push(filter.limit || 1000);
    params.push(filter.offset || 0);

    const rows = await db.all(sql, params);
    const entries = rows.map((row) => ({
      entry_id: row.entry_id,
      timestamp: row.timestamp,
      who: row.who,
      what: row.what,
      context: row.context_json ? JSON.parse(row.context_json) : undefined,
      policy: row.policy_json ? JSON.parse(row.policy_json) : undefined,
      capability: row.capability_json ? JSON.parse(row.capability_json) : undefined,
      execution: row.execution_json ? JSON.parse(row.execution_json) : undefined,
      result: row.result_json ? JSON.parse(row.result_json) : undefined,
      entry_hash: row.entry_hash,
      prev_hash: row.prev_hash,
      entry_index: row.entry_index
    }));

    return Ok(entries);
  } catch (error) {
    return Err({
      code: 'DB_ERROR',
      message: `queryAuditLog failed: ${error}`
    });
  }
}

export interface AuditQueryFilter {
  since?: number;          // timestamp ms (포함)
  until?: number;          // timestamp ms (제외)
  who?: string;            // 에이전트 ID 또는 'user'
  what?: string;           // substring 검색
  result_status?: 'success' | 'error';
  limit?: number;          // 기본 1000
  offset?: number;         // 기본 0
}
```

### 3. verifyHashChain() — 해시 체인 무결성 검증

```typescript
/**
 * verifyHashChain() — audit_entries의 SHA-256 해시 체인 검증
 *
 * 동작:
 * 1. entry_index 순서대로 모든 로그 조회
 * 2. 각 로그에 대해 SHA-256(prev_hash + entry_json) 계산
 * 3. 계산값과 저장된 entry_hash 비교
 * 4. GENESIS부터 마지막 로그까지 연속적인 체인 확인
 *
 * @param from_index?: 검증 시작 인덱스 (기본 0 = GENESIS)
 * @param to_index?: 검증 끝 인덱스 (기본 마지막)
 *
 * @returns Promise<Result<{
 *   verified: boolean,
 *   verified_count: number,
 *   first_mismatch?: { index: number, expected: string, actual: string }
 * }, DBError>>
 *
 * 사용 사례:
 * - 애플리케이션 시작 시 1회 전체 검증
 * - 매 감사 로그 삽입 후 마지막 2개 로그만 검증 (성능)
 * - 보안 감사 시 특정 범위 재검증
 */
async function verifyHashChain(from_index?: number, to_index?: number): Promise<Result<{
  verified: boolean,
  verified_count: number,
  first_mismatch?: { index: number, expected: string, actual: string }
}, DBError>> {
  try {
    const from = from_index ?? 1;
    let sql = `SELECT * FROM audit_entries WHERE entry_index >= ?`;
    const params: any[] = [from];

    if (to_index !== undefined) {
      sql += ` AND entry_index <= ?`;
      params.push(to_index);
    }

    sql += ` ORDER BY entry_index ASC`;

    const rows = await db.all(sql, params);

    let prevHash = 'GENESIS';
    let verified_count = 0;

    for (const row of rows) {
      const entryJson = JSON.stringify({
        who: row.who,
        what: row.what,
        context: row.context_json ? JSON.parse(row.context_json) : undefined,
        policy: row.policy_json ? JSON.parse(row.policy_json) : undefined,
        execution: row.execution_json ? JSON.parse(row.execution_json) : undefined,
        result: row.result_json ? JSON.parse(row.result_json) : undefined
      });

      const expectedHash = sha256(prevHash + entryJson);

      if (expectedHash !== row.entry_hash) {
        return Ok({
          verified: false,
          verified_count,
          first_mismatch: {
            index: row.entry_index,
            expected: expectedHash,
            actual: row.entry_hash
          }
        });
      }

      prevHash = row.entry_hash;
      verified_count++;
    }

    return Ok({
      verified: true,
      verified_count
    });
  } catch (error) {
    return Err({
      code: 'DB_ERROR',
      message: `verifyHashChain failed: ${error}`
    });
  }
}
```

### 4. getSessionAuditSummary() — 세션별 감사 요약

```typescript
/**
 * getSessionAuditSummary() — 특정 세션의 감사 요약 (뷰 기반)
 *
 * 사용: 웹 UI에서 Timeline 및 AuditLogPanel 표시용
 *
 * @param session_id — 세션 ID (run_id 또는 context 내 session_id)
 *
 * @returns Promise<Result<{
 *   total_entries: number,
 *   total_errors: number,
 *   policy_violations: number,
 *   agents_involved: string[],
 *   first_timestamp: number,
 *   last_timestamp: number,
 *   checksum: string
 * }, DBError>>
 */
async function getSessionAuditSummary(session_id: string): Promise<Result<{
  total_entries: number,
  total_errors: number,
  policy_violations: number,
  agents_involved: string[],
  first_timestamp: number,
  last_timestamp: number,
  checksum: string
}, DBError>> {
  try {
    // 1. 세션 내 모든 로그 조회
    const entries = await queryAuditLog({
      what: session_id // context에 session_id 포함된 로그 검색
    });

    if (!entries.ok) {
      return entries;
    }

    // 2. 요약 계산
    const total_entries = entries.data.length;
    const total_errors = entries.data.filter((e) => {
      const result = e.result as { status?: string };
      return result?.status === 'error';
    }).length;

    const policy_violations = entries.data.filter((e) => {
      const policy = e.policy as { policy_decision?: string };
      return policy?.policy_decision === 'DENY';
    }).length;

    const agents_involved = [...new Set(entries.data.map((e) => e.who))];

    const timestamps = entries.data.map((e) => e.timestamp);
    const first_timestamp = Math.min(...timestamps);
    const last_timestamp = Math.max(...timestamps);

    // 3. 체크섬 (모든 entry_hash의 SHA-256)
    const checksumInput = entries.data
      .map((e) => e.entry_hash)
      .join('|');
    const checksum = sha256(checksumInput);

    return Ok({
      total_entries,
      total_errors,
      policy_violations,
      agents_involved,
      first_timestamp,
      last_timestamp,
      checksum
    });
  } catch (error) {
    return Err({
      code: 'DB_ERROR',
      message: `getSessionAuditSummary failed: ${error}`
    });
  }
}
```

---

## CapabilityToken 쿼리

### 1. insertCapabilityToken() — 토큰 발급

```typescript
/**
 * insertCapabilityToken() — capability_tokens에 새 토큰 추가
 *
 * Phase 1+에서만 사용. Phase 0에서는 호출하지 않음.
 *
 * @param config — CapabilityTokenConfig
 *   - cap_id: UUID (생성됨)
 *   - issued_by: 발급자 (에이전트 ID 또는 'user')
 *   - approved_by: 승인자 ('user' 또는 'auto')
 *   - scope: { allow: glob[], deny: glob[] }
 *   - ttl_seconds: 유효 기간 (초)
 *   - max_uses: 최대 사용 횟수 (기본 1)
 *   - context_policy_decision_id?: 정책 판정 ID
 *
 * @returns Promise<Result<CapabilityToken, TokenError>>
 *   - Ok: 발급된 토큰 (signature 포함)
 *   - Err: TOKEN_INVALID (중복 ID), INTERNAL_ERROR
 */
async function insertCapabilityToken(config: CapabilityTokenConfig): Promise<Result<CapabilityToken, TokenError>> {
  try {
    const cap_id = generateUUID();
    const issued_at = Math.floor(Date.now() / 1000);
    const remaining_uses = config.max_uses || 1;

    // HMAC-SHA256 서명 생성
    const tokenPayload = {
      cap_id,
      issued_at,
      scope: config.scope,
      ttl_seconds: config.ttl_seconds,
      max_uses: config.max_uses || 1
    };
    const signature = hmacSHA256(JSON.stringify(tokenPayload), SIGNING_KEY);

    // INSERT
    await db.run(
      `INSERT INTO capability_tokens (
        cap_id, issued_at, issued_by, approved_by,
        scope_allow_json, scope_deny_json,
        ttl_seconds, max_uses, remaining_uses,
        status, context_policy_decision_id, signature_hmac
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        cap_id,
        issued_at,
        config.issued_by,
        config.approved_by,
        JSON.stringify(config.scope.allow || []),
        JSON.stringify(config.scope.deny || []),
        config.ttl_seconds,
        config.max_uses || 1,
        remaining_uses,
        'ACTIVE',
        config.context_policy_decision_id || null,
        signature
      ]
    );

    return Ok({
      cap: cap_id,
      scope: config.scope,
      ttl_seconds: config.ttl_seconds,
      max_uses: config.max_uses || 1,
      remaining_uses,
      status: 'ACTIVE',
      issued_by: config.issued_by,
      approved_by: config.approved_by,
      signature
    });
  } catch (error) {
    return Err({
      code: 'INTERNAL_ERROR',
      message: `insertCapabilityToken failed: ${error}`
    });
  }
}

export interface CapabilityTokenConfig {
  issued_by: string;
  approved_by?: string;
  scope: { allow: string[], deny: string[] };
  ttl_seconds: number;
  max_uses?: number;
  context_policy_decision_id?: string;
}
```

### 2. getActiveCapabilityTokens() — 활성 토큰 조회

```typescript
/**
 * getActiveCapabilityTokens() — 조건에 맞는 활성 토큰 조회
 *
 * 동작:
 * - status = 'ACTIVE'
 * - issued_at + ttl_seconds > now (만료 확인)
 * - remaining_uses > 0
 *
 * @param filter — TokenQueryFilter
 *   - issued_by?: 발급자 필터
 *   - approved_by?: 승인자 필터
 *   - scope_glob?: 스코프 glob 패턴 (allow에 포함된 토큰 반환)
 *   - limit?: 기본 100
 *
 * @returns Promise<Result<CapabilityToken[], DBError>>
 */
async function getActiveCapabilityTokens(filter: TokenQueryFilter): Promise<Result<CapabilityToken[], DBError>> {
  try {
    let sql = `SELECT * FROM capability_tokens WHERE status = 'ACTIVE'`;
    const params: any[] = [];

    if (filter.issued_by !== undefined) {
      sql += ` AND issued_by = ?`;
      params.push(filter.issued_by);
    }
    if (filter.approved_by !== undefined) {
      sql += ` AND approved_by = ?`;
      params.push(filter.approved_by);
    }

    sql += ` LIMIT ?`;
    params.push(filter.limit || 100);

    const rows = await db.all(sql, params);
    const now = Math.floor(Date.now() / 1000);

    const tokens = rows
      .filter((row) => {
        // 만료 확인
        const ttl_expires = row.issued_at + row.ttl_seconds;
        return ttl_expires > now && row.remaining_uses > 0;
      })
      .map((row) => ({
        cap: row.cap_id,
        scope: {
          allow: JSON.parse(row.scope_allow_json),
          deny: JSON.parse(row.scope_deny_json)
        },
        ttl_seconds: row.ttl_seconds,
        max_uses: row.max_uses,
        remaining_uses: row.remaining_uses,
        status: row.status,
        issued_by: row.issued_by,
        approved_by: row.approved_by
      }));

    if (filter.scope_glob !== undefined) {
      // glob 패턴 매칭 (scope.allow에 포함된 것만)
      return Ok(tokens.filter((tok) =>
        tok.scope.allow.some((glob) => minimatch(filter.scope_glob!, glob))
      ));
    }

    return Ok(tokens);
  } catch (error) {
    return Err({
      code: 'DB_ERROR',
      message: `getActiveCapabilityTokens failed: ${error}`
    });
  }
}

export interface TokenQueryFilter {
  issued_by?: string;
  approved_by?: string;
  scope_glob?: string; // 예: 'executor.*'
  limit?: number;
}
```

### 3. consumeCapabilityToken() — 토큰 소비

```typescript
/**
 * consumeCapabilityToken() — 토큰 remaining_uses 감소
 *
 * 동작:
 * 1. 토큰 존재 및 활성 확인
 * 2. remaining_uses 감소
 * 3. remaining_uses === 0 → status = 'CONSUMED'
 * 4. 서명 재계산 (Phase 1+)
 * 5. 감사 로그 기록
 *
 * @param cap_id — Capability Token ID
 * @returns Promise<Result<{ remaining_uses: number }, TokenError>>
 *   - Ok: 소비 후 남은 사용 횟수
 *   - Err: TOKEN_INVALID (찾음), TOKEN_EXPIRED, HASH_MISMATCH
 */
async function consumeCapabilityToken(cap_id: string): Promise<Result<{ remaining_uses: number }, TokenError>> {
  try {
    // 1. 토큰 조회
    const token = await db.get(
      `SELECT * FROM capability_tokens WHERE cap_id = ?`,
      [cap_id]
    );

    if (!token) {
      return Err({
        code: 'TOKEN_INVALID',
        message: `Token ${cap_id} not found`
      });
    }

    // 2. 활성 상태 확인
    if (token.status !== 'ACTIVE') {
      return Err({
        code: 'TOKEN_INVALID',
        message: `Token ${cap_id} is ${token.status}`
      });
    }

    // 3. TTL 확인
    const now = Math.floor(Date.now() / 1000);
    const ttl_expires = token.issued_at + token.ttl_seconds;
    if (ttl_expires <= now) {
      await db.run(`UPDATE capability_tokens SET status = 'EXPIRED' WHERE cap_id = ?`, [cap_id]);
      return Err({
        code: 'TOKEN_EXPIRED',
        message: `Token ${cap_id} expired at ${new Date(ttl_expires * 1000)}`
      });
    }

    // 4. remaining_uses 감소
    const new_remaining = token.remaining_uses - 1;
    const new_status = new_remaining === 0 ? 'CONSUMED' : 'ACTIVE';

    // 5. UPDATE
    await db.run(
      `UPDATE capability_tokens
       SET remaining_uses = ?, status = ?, updated_at = CURRENT_TIMESTAMP
       WHERE cap_id = ?`,
      [new_remaining, new_status, cap_id]
    );

    // 6. 감사 로그
    await insertAuditEntry({
      who: 'system',
      what: `TOKEN_CONSUMED cap=${cap_id} remaining=${new_remaining}`,
      result: { status: 'success' }
    });

    return Ok({ remaining_uses: new_remaining });
  } catch (error) {
    return Err({
      code: 'INTERNAL_ERROR',
      message: `consumeCapabilityToken failed: ${error}`
    });
  }
}
```

### 4. revokeCapabilityToken() — 토큰 폐지

```typescript
/**
 * revokeCapabilityToken() — 토큰 상태를 'REVOKED'로 설정
 *
 * @param cap_id — Capability Token ID
 * @param reason — 폐지 이유
 *
 * @returns Promise<Result<void, DBError>>
 */
async function revokeCapabilityToken(cap_id: string, reason: string): Promise<Result<void, DBError>> {
  try {
    await db.run(
      `UPDATE capability_tokens
       SET status = 'REVOKED', updated_at = CURRENT_TIMESTAMP
       WHERE cap_id = ?`,
      [cap_id]
    );

    await insertAuditEntry({
      who: 'system',
      what: `TOKEN_REVOKED cap=${cap_id} reason=${reason}`,
      result: { status: 'success' }
    });

    return Ok(undefined);
  } catch (error) {
    return Err({
      code: 'DB_ERROR',
      message: `revokeCapabilityToken failed: ${error}`
    });
  }
}
```

---

## Checkpoint 쿼리

### 1. saveCheckpoint() — 체크포인트 저장

```typescript
/**
 * saveCheckpoint() — XState context 체크포인트 저장 (롤백용)
 *
 * @param checkpoint — CheckpointData
 *   - run_id: 실행 세션 ID
 *   - xstate_context: 전체 XState 머신 context (JSON)
 *   - created_by: 저장 주체 (에이전트 ID 또는 'user')
 *
 * @returns Promise<Result<{ checkpoint_id: string }, DBError>>
 */
async function saveCheckpoint(checkpoint: CheckpointData): Promise<Result<{
  checkpoint_id: string
}, DBError>> {
  try {
    const checkpoint_id = generateUUID();

    await db.run(
      `INSERT INTO checkpoints (
        checkpoint_id, run_id, xstate_context_json, created_by
      ) VALUES (?, ?, ?, ?)`,
      [
        checkpoint_id,
        checkpoint.run_id,
        JSON.stringify(checkpoint.xstate_context),
        checkpoint.created_by
      ]
    );

    await insertAuditEntry({
      who: checkpoint.created_by,
      what: `CHECKPOINT_SAVED checkpoint_id=${checkpoint_id} run_id=${checkpoint.run_id}`,
      result: { status: 'success' }
    });

    return Ok({ checkpoint_id });
  } catch (error) {
    return Err({
      code: 'DB_ERROR',
      message: `saveCheckpoint failed: ${error}`
    });
  }
}

export interface CheckpointData {
  run_id: string;
  xstate_context: Record<string, any>;
  created_by: string;
}
```

### 2. loadCheckpoint() — 체크포인트 로드

```typescript
/**
 * loadCheckpoint() — 저장된 체크포인트 로드
 *
 * @param checkpoint_id — 체크포인트 ID
 *
 * @returns Promise<Result<{
 *   checkpoint_id: string,
 *   run_id: string,
 *   xstate_context: Record<string, any>,
 *   created_at: Date,
 *   created_by: string
 * }, DBError>>
 */
async function loadCheckpoint(checkpoint_id: string): Promise<Result<{
  checkpoint_id: string,
  run_id: string,
  xstate_context: Record<string, any>,
  created_at: Date,
  created_by: string
}, DBError>> {
  try {
    const checkpoint = await db.get(
      `SELECT * FROM checkpoints WHERE checkpoint_id = ?`,
      [checkpoint_id]
    );

    if (!checkpoint) {
      return Err({
        code: 'DB_ERROR',
        message: `Checkpoint ${checkpoint_id} not found`
      });
    }

    return Ok({
      checkpoint_id: checkpoint.checkpoint_id,
      run_id: checkpoint.run_id,
      xstate_context: JSON.parse(checkpoint.xstate_context_json),
      created_at: new Date(checkpoint.created_at),
      created_by: checkpoint.created_by
    });
  } catch (error) {
    return Err({
      code: 'DB_ERROR',
      message: `loadCheckpoint failed: ${error}`
    });
  }
}
```

### 3. listCheckpointsForRun() — 특정 run의 체크포인트 목록

```typescript
/**
 * listCheckpointsForRun() — 특정 run_id의 모든 체크포인트 조회
 *
 * @param run_id — 실행 세션 ID
 * @returns Promise<Result<CheckpointInfo[], DBError>>
 */
async function listCheckpointsForRun(run_id: string): Promise<Result<{
  checkpoint_id: string,
  created_at: Date,
  created_by: string
}[], DBError>> {
  try {
    const checkpoints = await db.all(
      `SELECT checkpoint_id, created_at, created_by FROM checkpoints
       WHERE run_id = ?
       ORDER BY created_at DESC`,
      [run_id]
    );

    return Ok(checkpoints.map((cp) => ({
      checkpoint_id: cp.checkpoint_id,
      created_at: new Date(cp.created_at),
      created_by: cp.created_by
    })));
  } catch (error) {
    return Err({
      code: 'DB_ERROR',
      message: `listCheckpointsForRun failed: ${error}`
    });
  }
}
```

---

## 뷰(Views) 쿼리

SQLite에서 정의된 3개의 뷰를 쿼리하는 패턴:

### 1. v_active_tokens 뷰

```sql
-- DDL (schema.sql에서)
CREATE VIEW v_active_tokens AS
SELECT
  cap_id,
  issued_at,
  ttl_seconds,
  remaining_uses,
  status,
  (issued_at + ttl_seconds - strftime('%s', 'now')) as ttl_expires_in_sec
FROM capability_tokens
WHERE status = 'ACTIVE'
  AND remaining_uses > 0
  AND (issued_at + ttl_seconds) > strftime('%s', 'now');
```

### 2. v_session_audit_summary 뷰

```sql
-- DDL
CREATE VIEW v_session_audit_summary AS
SELECT
  json_extract(context_json, '$.session_id') as session_id,
  COUNT(*) as total_entries,
  SUM(CASE WHEN json_extract(result_json, '$.status') = 'error' THEN 1 ELSE 0 END) as error_count,
  SUM(CASE WHEN json_extract(policy_json, '$.policy_decision') = 'DENY' THEN 1 ELSE 0 END) as violation_count,
  MIN(timestamp) as started_at,
  MAX(timestamp) as ended_at,
  COUNT(DISTINCT who) as agent_count
FROM audit_entries
GROUP BY json_extract(context_json, '$.session_id');
```

### 3. v_latest_checkpoints 뷰

```sql
-- DDL
CREATE VIEW v_latest_checkpoints AS
SELECT
  cp.*,
  ae.entry_index
FROM checkpoints cp
LEFT JOIN audit_entries ae
  ON ae.what LIKE '%' || cp.checkpoint_id || '%'
WHERE cp.checkpoint_id IN (
  SELECT checkpoint_id FROM checkpoints
  ORDER BY created_at DESC
  LIMIT 100
);
```

### 뷰 쿼리 함수

```typescript
/**
 * queryActiveTokensView() — v_active_tokens 뷰 쿼리
 */
async function queryActiveTokensView(): Promise<Result<Array<{
  cap_id: string,
  issued_at: number,
  ttl_seconds: number,
  remaining_uses: number,
  status: string,
  ttl_expires_in_sec: number
}>, DBError>> {
  try {
    const rows = await db.all(`SELECT * FROM v_active_tokens`);
    return Ok(rows);
  } catch (error) {
    return Err({
      code: 'DB_ERROR',
      message: `queryActiveTokensView failed: ${error}`
    });
  }
}

/**
 * querySessionAuditSummaryView() — v_session_audit_summary 뷰 쿼리
 */
async function querySessionAuditSummaryView(session_id?: string): Promise<Result<Array<{
  session_id: string,
  total_entries: number,
  error_count: number,
  violation_count: number,
  started_at: number,
  ended_at: number,
  agent_count: number
}>, DBError>> {
  try {
    let sql = `SELECT * FROM v_session_audit_summary`;
    const params: any[] = [];

    if (session_id !== undefined) {
      sql += ` WHERE session_id = ?`;
      params.push(session_id);
    }

    const rows = await db.all(sql, params);
    return Ok(rows);
  } catch (error) {
    return Err({
      code: 'DB_ERROR',
      message: `querySessionAuditSummaryView failed: ${error}`
    });
  }
}

/**
 * queryLatestCheckpointsView() — v_latest_checkpoints 뷰 쿼리
 */
async function queryLatestCheckpointsView(limit: number = 50): Promise<Result<Array<{
  checkpoint_id: string,
  run_id: string,
  created_at: string,
  created_by: string,
  entry_index: number
}>, DBError>> {
  try {
    const rows = await db.all(
      `SELECT checkpoint_id, run_id, created_at, created_by, entry_index FROM v_latest_checkpoints LIMIT ?`,
      [limit]
    );
    return Ok(rows);
  } catch (error) {
    return Err({
      code: 'DB_ERROR',
      message: `queryLatestCheckpointsView failed: ${error}`
    });
  }
}
```

---

## 구현 패턴

### TypeScript 패턴 (packages/audit/src/ 및 packages/executor/src/)

```typescript
// packages/audit/src/audit-log.ts

import { Result, Ok, Err } from '@jarvis-os/shared';
import Database from 'better-sqlite3';
import crypto from 'crypto';

/**
 * AuditLogService — 감사 로그 관리
 *
 * 책임:
 * - insertAuditEntry
 * - queryAuditLog
 * - verifyHashChain
 * - getSessionAuditSummary
 */
export class AuditLogService {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('synchronous = FULL');
  }

  async record(entry: AuditEntry): Promise<Result<void, DBError>> {
    const result = await insertAuditEntry(entry);
    if (!result.ok) return result;
    return Ok(undefined);
  }

  async query(filter: AuditQueryFilter): Promise<Result<AuditEntry[], DBError>> {
    return queryAuditLog(filter);
  }

  async verify(): Promise<Result<{ verified: boolean }, DBError>> {
    return verifyHashChain();
  }

  async getSummary(session_id: string): Promise<Result<any, DBError>> {
    return getSessionAuditSummary(session_id);
  }

  // ... 모든 쿼리 함수 구현
}
```

```typescript
// packages/executor/src/capability-token-manager.ts

import { Result } from '@jarvis-os/shared';

/**
 * CapabilityTokenManager — Capability Token 생명 주기 관리
 *
 * Phase 1에서만 사용.
 * Phase 0에서는 stub 구현 (항상 Ok 반환).
 */
export class CapabilityTokenManager {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
  }

  async validate(
    token: CapabilityToken,
    requiredCaps: string[]
  ): Promise<Result<void, TokenError>> {
    // Phase 1+에서만 구현
    return Ok(undefined); // Phase 0: 검증 건너뜀
  }

  async consume(token: CapabilityToken): Promise<Result<void, TokenError>> {
    return consumeCapabilityToken(token.cap);
  }

  async issue(config: CapabilityTokenConfig): Promise<Result<CapabilityToken, TokenError>> {
    return insertCapabilityToken(config);
  }

  async revoke(cap_id: string, reason: string): Promise<Result<void, TokenError>> {
    return revokeCapabilityToken(cap_id, reason);
  }

  // ... 나머지 메서드
}
```

---

## 트랜잭션 처리

### 장기 작업 중 트랜잭션 관리

```typescript
/**
 * executeInTransaction() — 여러 쿼리를 트랜잭션으로 묶음
 *
 * 사용: 여러 audit entries를 한 번에 삽입하거나,
 *      capability token 발급 + 감사 로그 기록 등
 *
 * @param callback — 트랜잭션 내에서 실행할 함수
 *
 * @returns Promise<Result<T, DBError>>
 */
async function executeInTransaction<T>(
  callback: () => Promise<Result<T, DBError>>
): Promise<Result<T, DBError>> {
  try {
    db.exec('BEGIN TRANSACTION');
    const result = await callback();

    if (result.ok) {
      db.exec('COMMIT');
    } else {
      db.exec('ROLLBACK');
    }

    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    return Err({
      code: 'DB_ERROR',
      message: `Transaction failed: ${error}`
    });
  }
}

// 사용 예
await executeInTransaction(async () => {
  // 1. Capability Token 발급
  const issueResult = await insertCapabilityToken({
    issued_by: 'orchestrator',
    scope: { allow: ['executor.*'], deny: [] },
    ttl_seconds: 3600,
    max_uses: 1
  });

  if (!issueResult.ok) return issueResult;

  // 2. 감사 로그 기록
  const auditResult = await insertAuditEntry({
    who: 'orchestrator',
    what: `TOKEN_ISSUED cap=${issueResult.data.cap}`,
    capability: issueResult.data,
    result: { status: 'success' }
  });

  return auditResult;
});
```

---

## 성능 최적화

### 인덱스 활용

```sql
-- schema.sql에 정의된 인덱스
CREATE INDEX idx_audit_entries_who ON audit_entries(who);
CREATE INDEX idx_audit_entries_timestamp ON audit_entries(timestamp);
CREATE INDEX idx_audit_entries_entry_index ON audit_entries(entry_index);
CREATE INDEX idx_capability_tokens_status ON capability_tokens(status);
CREATE INDEX idx_capability_tokens_issued_by ON capability_tokens(issued_by);
CREATE INDEX idx_capability_tokens_cap_id ON capability_tokens(cap_id);
CREATE INDEX idx_checkpoints_run_id ON checkpoints(run_id);
CREATE INDEX idx_checkpoints_created_at ON checkpoints(created_at);
```

### 쿼리 최적화 팁

```typescript
/**
 * 1. 범위 쿼리는 인덱스 활용
 *    ✅ WHERE timestamp BETWEEN ? AND ? (인덱스 활용)
 *    ❌ WHERE DATE(FROM_UNIXTIME(timestamp)) = ? (함수 사용 후 인덱스 불가)
 */

/**
 * 2. 대량 삽입은 배치 처리
 *    ✅ 트랜잭션 내에서 여러 INSERT (1 COMMIT)
 *    ❌ 각각 INSERT + COMMIT (N 번 왕복)
 */

/**
 * 3. 뷰는 읽기 전용으로 사용
 *    ✅ SELECT * FROM v_active_tokens
 *    ❌ v_active_tokens에 대한 JOIN (뷰는 MATERIALIZED되지 않음)
 */

/**
 * 4. limit + offset은 피하고 커서 사용
 *    ✅ entry_index > last_known_index (스캔 빠름)
 *    ❌ LIMIT 1000 OFFSET 10000 (오프셋 큼)
 */
```

---

## 참고 문서

- `.claude/design/schema.sql` — 전체 DDL 및 인덱스
- `.claude/design/error-catalog.md` — DB_ERROR 복구 전략
- `packages/audit/src/audit-log.ts` — 구현 (Phase 1)
- `packages/executor/src/capability-token-manager.ts` — 구현 (Phase 1)

