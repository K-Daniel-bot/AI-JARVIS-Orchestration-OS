// message-bus 테스트 — 메시지 라우팅, 계약서 §5 준수, 타임아웃, 재시도 검증
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  MessageBus,
  getGlobalMessageBus,
  resetGlobalMessageBus,
  DEFAULT_BUS_OPTIONS,
} from './message-bus.js';
import type { AgentMessage } from '@jarvis/shared';

// ────────────────────────────────────────────────────────────
// 테스트 헬퍼 — 더미 AgentMessage 생성
// ────────────────────────────────────────────────────────────

function makeAgentMessage(
  from: string,
  to: string,
  messageId = 'msg_test_001',
): AgentMessage {
  return {
    message_id: messageId,
    from_agent: from as AgentMessage['from_agent'],
    to_agent: to as AgentMessage['to_agent'],
    message_type: 'HANDOFF',
    timestamp: new Date().toISOString(),
    run_id: 'run_test_001',
    payload: {
      artifact_type: 'SPEC',
      artifact_ref: 'spec-001',
      summary: '테스트 메시지',
      metadata: {},
    },
    timeout_ms: 5000,
    retry_policy: { max_retries: 2, backoff_ms: 100 },
  };
}

// ────────────────────────────────────────────────────────────
// DEFAULT_BUS_OPTIONS 테스트
// ────────────────────────────────────────────────────────────

describe('DEFAULT_BUS_OPTIONS', () => {
  it('기본 타임아웃은 60000ms여야 한다', () => {
    expect(DEFAULT_BUS_OPTIONS.timeoutMs).toBe(60_000);
  });

  it('기본 최대 재시도 횟수는 2여야 한다', () => {
    expect(DEFAULT_BUS_OPTIONS.maxRetries).toBe(2);
  });

  it('기본 백오프는 5000ms여야 한다', () => {
    expect(DEFAULT_BUS_OPTIONS.retryBackoffMs).toBe(5_000);
  });
});

// ────────────────────────────────────────────────────────────
// subscribe / unsubscribe 테스트
// ────────────────────────────────────────────────────────────

describe('MessageBus 구독 관리', () => {
  let bus: MessageBus;

  beforeEach(() => {
    bus = new MessageBus();
  });

  afterEach(() => {
    bus.stop();
  });

  it('에이전트를 구독 등록할 수 있어야 한다', () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    bus.subscribe('orchestrator', handler);
    expect(bus.isSubscribed('orchestrator')).toBe(true);
  });

  it('구독 해제 후 isSubscribed가 false를 반환해야 한다', () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    bus.subscribe('orchestrator', handler);
    bus.unsubscribe('orchestrator');
    expect(bus.isSubscribed('orchestrator')).toBe(false);
  });

  it('등록되지 않은 에이전트는 isSubscribed가 false여야 한다', () => {
    expect(bus.isSubscribed('codegen')).toBe(false);
  });

  it('이미 등록된 에이전트는 핸들러가 교체되어야 한다', async () => {
    const handler1 = vi.fn().mockResolvedValue(undefined);
    const handler2 = vi.fn().mockResolvedValue(undefined);

    bus.subscribe('spec-agent', handler1);
    bus.subscribe('spec-agent', handler2);

    const message = makeAgentMessage('orchestrator', 'spec-agent');
    await bus.send(message);

    // 두 번째 핸들러만 호출되어야 함
    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledOnce();
  });
});

// ────────────────────────────────────────────────────────────
// send 테스트 — 정상 메시지 전송
// ────────────────────────────────────────────────────────────

describe('MessageBus.send 정상 케이스', () => {
  let bus: MessageBus;

  beforeEach(() => {
    bus = new MessageBus({ timeoutMs: 5000 });
  });

  afterEach(() => {
    bus.stop();
  });

  it('Orchestrator → 에이전트 메시지 전송이 성공해야 한다', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    bus.subscribe('spec-agent', handler);

    const message = makeAgentMessage('orchestrator', 'spec-agent');
    const result = await bus.send(message);

    expect(result.ok).toBe(true);
    expect(handler).toHaveBeenCalledWith(message);
  });

  it('에이전트 → Orchestrator 메시지 전송이 성공해야 한다', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    bus.subscribe('orchestrator', handler);

    const message = makeAgentMessage('spec-agent', 'orchestrator');
    const result = await bus.send(message);

    expect(result.ok).toBe(true);
  });

  it('전송 성공 후 processedCount가 증가해야 한다', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    bus.subscribe('planner', handler);

    const message = makeAgentMessage('orchestrator', 'planner');
    await bus.send(message);

    const status = bus.getStatus();
    expect(status.processedCount).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────
// send 테스트 — 에러 케이스 (계약서 §5 위반)
// ────────────────────────────────────────────────────────────

describe('MessageBus.send 계약서 §5 위반 — 에이전트 간 직접 통신 금지', () => {
  let bus: MessageBus;

  beforeEach(() => {
    bus = new MessageBus();
  });

  afterEach(() => {
    bus.stop();
  });

  it('에이전트 간 직접 통신 시도는 에러를 반환해야 한다', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    bus.subscribe('codegen', handler);

    // spec-agent → codegen 직접 통신 (금지)
    const message = makeAgentMessage('spec-agent', 'codegen');
    const result = await bus.send(message);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_FAILED');
    }
  });

  it('계약서 §5 위반 시 핸들러가 호출되지 않아야 한다', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    bus.subscribe('review', handler);

    const message = makeAgentMessage('planner', 'review');
    await bus.send(message);

    expect(handler).not.toHaveBeenCalled();
  });

  it('등록되지 않은 에이전트에 전송 시 에러를 반환해야 한다', async () => {
    // 에이전트 등록 없이 전송
    const message = makeAgentMessage('orchestrator', 'codegen');
    const result = await bus.send(message);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('VALIDATION_FAILED');
    }
  });

  it('중단된 버스에 전송 시 에러를 반환해야 한다', async () => {
    bus.stop();

    const message = makeAgentMessage('orchestrator', 'spec-agent');
    const result = await bus.send(message);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INTERNAL_ERROR');
    }
  });
});

// ────────────────────────────────────────────────────────────
// broadcast 테스트
// ────────────────────────────────────────────────────────────

describe('MessageBus.broadcast', () => {
  let bus: MessageBus;

  beforeEach(() => {
    bus = new MessageBus({ timeoutMs: 1000 });
  });

  afterEach(() => {
    bus.stop();
  });

  it('Orchestrator 브로드캐스트는 모든 구독 에이전트에게 전송되어야 한다', async () => {
    const handler1 = vi.fn().mockResolvedValue(undefined);
    const handler2 = vi.fn().mockResolvedValue(undefined);
    bus.subscribe('spec-agent', handler1);
    bus.subscribe('planner', handler2);

    const message = makeAgentMessage('orchestrator', 'orchestrator');
    bus.broadcast(message);

    // 비동기 전송이므로 잠시 대기
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(handler1).toHaveBeenCalledOnce();
    expect(handler2).toHaveBeenCalledOnce();
  });

  it('Orchestrator가 아닌 에이전트의 브로드캐스트는 무시되어야 한다', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    bus.subscribe('codegen', handler);

    const message = makeAgentMessage('planner', 'planner');
    bus.broadcast(message);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(handler).not.toHaveBeenCalled();
  });

  it('중단된 버스에서는 브로드캐스트가 무시되어야 한다', async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    bus.subscribe('spec-agent', handler);
    bus.stop();

    const message = makeAgentMessage('orchestrator', 'orchestrator');
    bus.broadcast(message);

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(handler).not.toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────
// getStatus 테스트
// ────────────────────────────────────────────────────────────

describe('MessageBus.getStatus', () => {
  it('초기 상태는 isRunning: true여야 한다', () => {
    const bus = new MessageBus();
    const status = bus.getStatus();
    expect(status.isRunning).toBe(true);
    bus.stop();
  });

  it('stop 후 isRunning: false여야 한다', () => {
    const bus = new MessageBus();
    bus.stop();
    const status = bus.getStatus();
    expect(status.isRunning).toBe(false);
  });

  it('구독한 에이전트가 subscribedAgents에 포함되어야 한다', () => {
    const bus = new MessageBus();
    bus.subscribe('orchestrator', vi.fn());
    bus.subscribe('spec-agent', vi.fn());

    const status = bus.getStatus();
    expect(status.subscribedAgents).toContain('orchestrator');
    expect(status.subscribedAgents).toContain('spec-agent');
    bus.stop();
  });
});

// ────────────────────────────────────────────────────────────
// 싱글톤 팩토리 테스트
// ────────────────────────────────────────────────────────────

describe('getGlobalMessageBus / resetGlobalMessageBus', () => {
  afterEach(() => {
    // 테스트 후 전역 버스 초기화
    resetGlobalMessageBus();
  });

  it('동일한 인스턴스를 반환해야 한다 (싱글톤)', () => {
    const bus1 = getGlobalMessageBus();
    const bus2 = getGlobalMessageBus();
    expect(bus1).toBe(bus2);
  });

  it('resetGlobalMessageBus 후 새 인스턴스를 반환해야 한다', () => {
    const bus1 = getGlobalMessageBus();
    const bus2 = resetGlobalMessageBus();
    expect(bus1).not.toBe(bus2);
  });

  it('resetGlobalMessageBus 후 버스는 isRunning: true여야 한다', () => {
    const bus = resetGlobalMessageBus();
    expect(bus.getStatus().isRunning).toBe(true);
    bus.stop();
  });
});
