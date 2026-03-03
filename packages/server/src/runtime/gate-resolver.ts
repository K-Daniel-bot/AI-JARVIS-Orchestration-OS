// 게이트 대기 메커니즘 — Promise 기반 사용자 승인/거부 대기
import { randomUUID } from "node:crypto";

// 게이트 해결 결과
export interface GateResolution {
  readonly action: "APPROVE" | "REJECT";
  readonly reason?: string;
  readonly scopeOverride?: unknown;
}

// 대기 중인 게이트 항목
interface PendingGate {
  readonly resolve: (resolution: GateResolution) => void;
  readonly reject: (error: Error) => void;
  readonly timeoutId: ReturnType<typeof setTimeout>;
  readonly createdAt: string;
}

// 기본 타임아웃 — 10분
const DEFAULT_GATE_TIMEOUT_MS = 600_000;

// 게이트 리졸버 — 파이프라인 대기 + HTTP 라우트 해결 연결
class GateResolverImpl {
  private readonly pending = new Map<string, PendingGate>();

  // 게이트 ID 생성
  createGateId(): string {
    return `gate_${randomUUID().slice(0, 8)}`;
  }

  // 게이트 대기 — 사용자가 approve/reject 할 때까지 Promise 블록
  waitForGate(
    gateId: string,
    timeoutMs: number = DEFAULT_GATE_TIMEOUT_MS,
  ): Promise<GateResolution> {
    return new Promise<GateResolution>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(gateId);
        reject(new Error(`게이트 ${gateId} 타임아웃 (${timeoutMs}ms)`));
      }, timeoutMs);

      this.pending.set(gateId, {
        resolve,
        reject,
        timeoutId,
        createdAt: new Date().toISOString(),
      });
    });
  }

  // 게이트 해결 — HTTP 라우트에서 호출
  resolveGate(gateId: string, resolution: GateResolution): boolean {
    const gate = this.pending.get(gateId);
    if (!gate) {
      return false;
    }

    clearTimeout(gate.timeoutId);
    this.pending.delete(gateId);
    gate.resolve(resolution);
    return true;
  }

  // 대기 중인 게이트 수
  get pendingCount(): number {
    return this.pending.size;
  }

  // 대기 중인 게이트 ID 목록
  getPendingGateIds(): string[] {
    return Array.from(this.pending.keys());
  }

  // 모든 대기 게이트 거부 (긴급 중단 용)
  rejectAll(reason: string): void {
    for (const [, gate] of this.pending) {
      clearTimeout(gate.timeoutId);
      gate.reject(new Error(reason));
    }
    this.pending.clear();
  }
}

// 싱글톤 인스턴스
export const gateResolver = new GateResolverImpl();
