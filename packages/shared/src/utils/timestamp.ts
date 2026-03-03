// 타임스탬프 유틸리티 — ISO 8601 형식 일관성 보장

// 현재 시각을 ISO 8601 문자열로 반환
export function nowISO(): string {
  return new Date().toISOString();
}

// TTL 만료 여부 확인 — 잘못된 타임스탬프는 만료로 처리 (안전 기본값)
export function isExpired(issuedAt: string, ttlSeconds: number): boolean {
  const issued = new Date(issuedAt).getTime();
  if (Number.isNaN(issued)) {
    return true;
  }
  const now = Date.now();
  return now > issued + ttlSeconds * 1000;
}

// 두 타임스탬프 간 경과 시간 (밀리초) — 잘못된 타임스탬프는 NaN 반환
export function elapsedMs(from: string, to?: string): number {
  const fromMs = new Date(from).getTime();
  if (Number.isNaN(fromMs)) {
    return NaN;
  }
  const toMs = to ? new Date(to).getTime() : Date.now();
  if (Number.isNaN(toMs)) {
    return NaN;
  }
  return toMs - fromMs;
}
