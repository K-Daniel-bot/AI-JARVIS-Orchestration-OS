// ID 생성 유틸리티 — crypto.randomUUID() 사용 (Math.random() 금지)
import { randomUUID } from "node:crypto";

// 날짜 기반 접두사 생성
function datePrefix(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

// 짧은 순번 생성 (UUID 앞 8자리)
function shortSeq(): string {
  return randomUUID().replace(/-/g, "").slice(0, 8);
}

// 감사 로그 ID: aud_20260302_a1b2c3d4
export function generateAuditId(): string {
  return `aud_${datePrefix()}_${shortSeq()}`;
}

// 정책 판정 ID: pd_20260302_a1b2c3d4
export function generatePolicyDecisionId(): string {
  return `pd_${datePrefix()}_${shortSeq()}`;
}

// Capability 토큰 ID: cap_20260302_a1b2c3d4
export function generateCapabilityTokenId(): string {
  return `cap_${datePrefix()}_${shortSeq()}`;
}

// 실행 Run ID: run_20260302_a1b2c3d4
export function generateRunId(): string {
  return `run_${datePrefix()}_${shortSeq()}`;
}

// 메시지 ID: msg_20260302_a1b2c3d4
export function generateMessageId(): string {
  return `msg_${datePrefix()}_${shortSeq()}`;
}

// 액션 ID: act_20260302_a1b2c3d4
export function generateActionId(): string {
  return `act_${datePrefix()}_${shortSeq()}`;
}

// 세션 ID: sess_<uuid>
export function generateSessionId(): string {
  return `sess_${randomUUID()}`;
}
