// 타임스탬프 유틸리티 — ISO 8601 형식 일관성 보장

// 현재 시각을 ISO 8601 문자열로 반환
export function nowISO(): string {
  return new Date().toISOString();
}

// TTL 만료 여부 확인
export function isExpired(issuedAt: string, ttlSeconds: number): boolean {
  const issued = new Date(issuedAt).getTime();
  const now = Date.now();
  return now > issued + ttlSeconds * 1000;
}

// 두 타임스탬프 간 경과 시간 (밀리초)
export function elapsedMs(from: string, to?: string): number {
  const fromMs = new Date(from).getTime();
  const toMs = to ? new Date(to).getTime() : Date.now();
  return toMs - fromMs;
}
