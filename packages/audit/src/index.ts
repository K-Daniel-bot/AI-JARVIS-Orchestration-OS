// @jarvis/audit — 불변 감사 로그 시스템 barrel export

// 저장소
export { AuditStore } from "./store/audit-store.js";
export { ALL_DDL_STATEMENTS, CREATE_AUDIT_TABLE, CREATE_RUN_ID_INDEX, CREATE_TIMESTAMP_INDEX, CREATE_SESSION_ID_INDEX } from "./store/schema.sql.js";

// 무결성
export { computeNextHash, validateEntryHash, getGenesisHash } from "./integrity/hash-chain.js";
export { verifyChain } from "./integrity/verifier.js";
export type { AuditRow } from "./integrity/verifier.js";

// 마스킹
export { redact, redactDeep } from "./redaction/redactor.js";
export type { RedactionResult } from "./redaction/redactor.js";

// 조회
export { queryByRunId, queryBySessionId, queryByTimeRange, queryByRiskLevel, queryLatest } from "./query/audit-query.js";
