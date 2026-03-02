// @jarvis/audit 패키지 배럴 익스포트 — 감사 로그 시스템 공개 인터페이스

// 감사 로그 메인 모듈 — AuditLogger 인터페이스 및 팩토리 함수
export type { AuditLogger, AuditQueryFilter } from './audit-log.js';
export { createAuditLogger } from './audit-log.js';

// 해시 체인 무결성 모듈 — 외부에서 해시 계산/검증이 필요한 경우를 위해 노출
export {
  computeHash,
  verifyEntry,
  verifyChain,
  serializeEntryForHashing,
  GENESIS_HASH,
} from './hash-chain.js';

// 민감 정보 마스킹 모듈 — 독립적 사용을 위해 노출
export type { RedactionType, RedactionResult } from './redaction.js';
export { redactSensitiveData, redactAuditEntry } from './redaction.js';

// SQLite 저장소 — 고급 사용자를 위한 저수준 API 노출
export type { QueryFilter } from './sqlite-store.js';
export {
  initDatabase,
  insertEntry,
  getLastEntry,
  queryEntries,
  getEntryById,
  getAllEntriesOrdered,
} from './sqlite-store.js';
