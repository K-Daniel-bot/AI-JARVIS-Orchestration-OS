// 감사 로그 메인 모듈 — 마스킹 → 해시 계산 → SQLite 저장 파이프라인 구현
// 계약서 §3 "불변 감사 로그" 요구사항을 완전히 충족

import { randomUUID } from 'node:crypto';
import type { AuditEntry, RiskLevel, AuditResultStatus } from '@jarvis/shared';
import { ok, err } from '@jarvis/shared';
import type { Result, JarvisError } from '@jarvis/shared';
import type Database from 'better-sqlite3';
import {
  initDatabase,
  insertEntry,
  getLastEntry,
  queryEntries,
  getEntryById,
  getAllEntriesOrdered,
} from './sqlite-store.js';
import type { QueryFilter } from './sqlite-store.js';
import {
  computeHash,
  serializeEntryForHashing,
  verifyChain,
  GENESIS_HASH,
} from './hash-chain.js';
import { redactAuditEntry } from './redaction.js';

/** 감사 로그 쿼리 필터 — 외부 공개 인터페이스 */
export interface AuditQueryFilter {
  readonly startTime?: string;
  readonly endTime?: string;
  readonly riskLevel?: RiskLevel;
  readonly status?: AuditResultStatus;
  readonly limit?: number;
  readonly offset?: number;
}

/** 감사 로그 기록기 인터페이스 — 의존성 주입을 통한 테스트 가능성 보장 */
export interface AuditLogger {
  /**
   * 감사 엔트리 기록 — 마스킹, 해시 계산, 저장 파이프라인 실행
   * audit_id, timestamp, integrity는 자동 생성
   */
  record(
    entry: Omit<AuditEntry, 'audit_id' | 'timestamp' | 'integrity'>
  ): Promise<Result<AuditEntry, JarvisError>>;

  /**
   * 전체 해시 체인 무결성 검증
   * 모든 엔트리를 순서대로 검사하여 변조 여부 확인
   */
  verifyIntegrity(): Promise<Result<boolean, JarvisError>>;

  /**
   * 필터 조건으로 감사 엔트리 목록 조회
   */
  query(
    filter: AuditQueryFilter
  ): Promise<Result<AuditEntry[], JarvisError>>;

  /**
   * audit_id로 특정 감사 엔트리 조회
   */
  getById(
    auditId: string
  ): Promise<Result<AuditEntry | null, JarvisError>>;
}

/** audit_id 생성 형식 — aud_{date}_{uuid 앞 8자리} */
function generateAuditId(): string {
  const date = new Date()
    .toISOString()
    .slice(0, 10)
    .replace(/-/g, '');
  const shortUuid = randomUUID().replace(/-/g, '').slice(0, 8);
  return `aud_${date}_${shortUuid}`;
}

/**
 * 감사 로그 기록기 생성 — SQLite 기반 구현체 반환
 * 흐름: 마스킹 → audit_id/timestamp 생성 → 이전 해시 조회 → 해시 계산 → 저장
 *
 * @param dbPath - SQLite 데이터베이스 파일 경로
 * @returns AuditLogger 구현체
 */
export function createAuditLogger(dbPath: string): AuditLogger {
  // 데이터베이스 초기화 — 테이블 및 인덱스 생성 (멱등성 보장)
  const db: Database.Database = initDatabase(dbPath);

  return {
    async record(
      entry: Omit<AuditEntry, 'audit_id' | 'timestamp' | 'integrity'>
    ): Promise<Result<AuditEntry, JarvisError>> {
      // 1단계: 민감 정보 마스킹 적용
      const { redactedEntry } = redactAuditEntry(entry);

      // 2단계: 메타데이터 생성 (audit_id, timestamp)
      const auditId = generateAuditId();
      const timestamp = new Date().toISOString();

      // 3단계: 직전 엔트리의 해시 조회 (체인 연결용)
      const lastEntryResult = getLastEntry(db);
      if (!lastEntryResult.ok) {
        return err(lastEntryResult.error);
      }

      const previousHash =
        lastEntryResult.value !== null
          ? lastEntryResult.value.integrity.hash
          : GENESIS_HASH;

      // 4단계: 해시 계산을 위한 중간 엔트리 구성 (integrity 제외)
      const entryWithoutIntegrity: Omit<AuditEntry, 'integrity'> = {
        ...redactedEntry,
        audit_id: auditId,
        timestamp,
      };

      // 5단계: SHA-256 해시 계산
      const serialized = serializeEntryForHashing(entryWithoutIntegrity);
      const hash = computeHash(serialized, previousHash);

      // 6단계: 완전한 AuditEntry 구성
      const fullEntry: AuditEntry = {
        ...entryWithoutIntegrity,
        integrity: {
          hash,
          previous_hash: previousHash,
        },
      };

      // 7단계: SQLite에 저장 (append-only)
      const insertResult = insertEntry(db, fullEntry);
      if (!insertResult.ok) {
        return err(insertResult.error);
      }

      return ok(fullEntry);
    },

    async verifyIntegrity(): Promise<Result<boolean, JarvisError>> {
      // 전체 엔트리를 rowid 오름차순으로 조회하여 체인 검증
      const entriesResult = getAllEntriesOrdered(db);
      if (!entriesResult.ok) {
        return err(entriesResult.error);
      }

      return verifyChain(entriesResult.value);
    },

    async query(
      filter: AuditQueryFilter
    ): Promise<Result<AuditEntry[], JarvisError>> {
      // AuditQueryFilter를 내부 QueryFilter로 변환
      const internalFilter: QueryFilter = {
        startTime: filter.startTime,
        endTime: filter.endTime,
        riskLevel: filter.riskLevel,
        status: filter.status,
        limit: filter.limit,
        offset: filter.offset,
      };

      return queryEntries(db, internalFilter);
    },

    async getById(
      auditId: string
    ): Promise<Result<AuditEntry | null, JarvisError>> {
      return getEntryById(db, auditId);
    },
  };
}
