// 해시 유틸리티 — 감사 로그 무결성 체인에 사용
import { createHash } from "node:crypto";

// SHA-256 해시 생성
export function sha256(data: string): string {
  return createHash("sha256").update(data, "utf8").digest("hex");
}

// 감사 로그 엔트리 해시 생성 (integrity chain)
export function computeAuditHash(entryJson: string, previousHash: string): string {
  return sha256(`${previousHash}:${entryJson}`);
}

// 초기 해시 (체인의 첫 번째 엔트리용)
export const GENESIS_HASH = sha256("JARVIS_OS_GENESIS_BLOCK");
