// agent-types 테스트 — 에이전트 설정, 복잡도 레벨, 모델 배정 검증
import { describe, it, expect } from 'vitest';
import {
  ComplexityLevel,
  MODEL_ASSIGNMENT,
  AGENT_CONFIGS,
  COMPLEXITY_AGENT_TEAMS,
  getAgentConfig,
  getTeamConfigs,
} from './agent-types.js';

// ────────────────────────────────────────────────────────────
// MODEL_ASSIGNMENT 테스트
// ────────────────────────────────────────────────────────────

describe('MODEL_ASSIGNMENT', () => {
  it('Orchestrator에 Opus 4.6 모델이 배정되어야 한다', () => {
    expect(MODEL_ASSIGNMENT['orchestrator']).toBe('claude-opus-4-6');
  });

  it('policy-risk에 Opus 4.6 모델이 배정되어야 한다', () => {
    expect(MODEL_ASSIGNMENT['policy-risk']).toBe('claude-opus-4-6');
  });

  it('spec-agent에 Haiku 4.5 모델이 배정되어야 한다', () => {
    expect(MODEL_ASSIGNMENT['spec-agent']).toBe('claude-haiku-4-5-20251001');
  });

  it('test-build에 Haiku 4.5 모델이 배정되어야 한다', () => {
    expect(MODEL_ASSIGNMENT['test-build']).toBe('claude-haiku-4-5-20251001');
  });

  it('rollback에 Haiku 4.5 모델이 배정되어야 한다', () => {
    expect(MODEL_ASSIGNMENT['rollback']).toBe('claude-haiku-4-5-20251001');
  });

  it('codegen에 Sonnet 4.6 모델이 배정되어야 한다', () => {
    expect(MODEL_ASSIGNMENT['codegen']).toBe('claude-sonnet-4-6');
  });

  it('executor에 Sonnet 4.6 모델이 배정되어야 한다', () => {
    expect(MODEL_ASSIGNMENT['executor']).toBe('claude-sonnet-4-6');
  });

  it('9개 에이전트 모두 모델이 배정되어야 한다', () => {
    const agentNames = [
      'orchestrator',
      'spec-agent',
      'policy-risk',
      'planner',
      'codegen',
      'review',
      'test-build',
      'executor',
      'rollback',
    ] as const;
    for (const name of agentNames) {
      expect(MODEL_ASSIGNMENT[name]).toBeDefined();
    }
  });
});

// ────────────────────────────────────────────────────────────
// AGENT_CONFIGS 테스트
// ────────────────────────────────────────────────────────────

describe('AGENT_CONFIGS', () => {
  it('정확히 9개의 에이전트 설정이 있어야 한다', () => {
    expect(AGENT_CONFIGS).toHaveLength(9);
  });

  it('executor만 execute 권한을 가져야 한다 (일부 에이전트 포함)', () => {
    const executeAgents = AGENT_CONFIGS.filter(
      (c) => c.permissionMode === 'execute',
    );
    const executeNames = executeAgents.map((c) => c.name);
    expect(executeNames).toContain('executor');
    expect(executeNames).toContain('test-build');
    expect(executeNames).toContain('rollback');
  });

  it('spec-agent는 read-only 권한이어야 한다', () => {
    const specAgent = AGENT_CONFIGS.find((c) => c.name === 'spec-agent');
    expect(specAgent?.permissionMode).toBe('read-only');
  });

  it('codegen은 write 권한이어야 한다', () => {
    const codegenAgent = AGENT_CONFIGS.find((c) => c.name === 'codegen');
    expect(codegenAgent?.permissionMode).toBe('write');
  });

  it('각 에이전트 설정에 모든 필수 필드가 존재해야 한다', () => {
    for (const config of AGENT_CONFIGS) {
      expect(config.name).toBeTruthy();
      expect(config.model).toBeTruthy();
      expect(config.role).toBeTruthy();
      expect(config.tools).toBeDefined();
      expect(config.tools.length).toBeGreaterThan(0);
      expect(config.permissionMode).toBeTruthy();
      expect(config.maxTurns).toBeGreaterThan(0);
    }
  });

  it('모든 에이전트 maxTurns은 양수여야 한다', () => {
    for (const config of AGENT_CONFIGS) {
      expect(config.maxTurns).toBeGreaterThan(0);
    }
  });

  it('executor의 도구 목록에 consume_capability_token이 포함되어야 한다', () => {
    const executorConfig = AGENT_CONFIGS.find((c) => c.name === 'executor');
    expect(executorConfig?.tools).toContain('consume_capability_token');
  });

  it('executor의 도구 목록에 write_audit_log가 포함되어야 한다', () => {
    const executorConfig = AGENT_CONFIGS.find((c) => c.name === 'executor');
    expect(executorConfig?.tools).toContain('write_audit_log');
  });
});

// ────────────────────────────────────────────────────────────
// getAgentConfig 테스트
// ────────────────────────────────────────────────────────────

describe('getAgentConfig', () => {
  it('유효한 에이전트 이름으로 설정을 반환해야 한다', () => {
    const config = getAgentConfig('orchestrator');
    expect(config).toBeDefined();
    expect(config?.name).toBe('orchestrator');
  });

  it('존재하지 않는 에이전트 이름에 undefined를 반환해야 한다', () => {
    const config = getAgentConfig('unknown-agent' as never);
    expect(config).toBeUndefined();
  });

  it('반환된 설정이 MODEL_ASSIGNMENT와 일치해야 한다', () => {
    const config = getAgentConfig('planner');
    expect(config?.model).toBe(MODEL_ASSIGNMENT['planner']);
  });
});

// ────────────────────────────────────────────────────────────
// getTeamConfigs 테스트
// ────────────────────────────────────────────────────────────

describe('getTeamConfigs', () => {
  it('L1_SIMPLE 복잡도에 최소 3개 에이전트 설정이 반환되어야 한다', () => {
    const configs = getTeamConfigs(ComplexityLevel.L1_SIMPLE);
    expect(configs.length).toBeGreaterThanOrEqual(3);
  });

  it('L4_DANGEROUS 복잡도에 rollback 에이전트가 포함되어야 한다', () => {
    const configs = getTeamConfigs(ComplexityLevel.L4_DANGEROUS);
    const names = configs.map((c) => c.name);
    expect(names).toContain('rollback');
  });

  it('L2_MODERATE 복잡도에 codegen과 review가 포함되어야 한다', () => {
    const configs = getTeamConfigs(ComplexityLevel.L2_MODERATE);
    const names = configs.map((c) => c.name);
    expect(names).toContain('codegen');
    expect(names).toContain('review');
  });

  it('L1_SIMPLE 복잡도에 executor가 포함되지 않아야 한다', () => {
    const configs = getTeamConfigs(ComplexityLevel.L1_SIMPLE);
    const names = configs.map((c) => c.name);
    expect(names).not.toContain('executor');
  });
});

// ────────────────────────────────────────────────────────────
// COMPLEXITY_AGENT_TEAMS 테스트
// ────────────────────────────────────────────────────────────

describe('COMPLEXITY_AGENT_TEAMS', () => {
  it('4개 복잡도 레벨 모두 팀이 정의되어야 한다', () => {
    const levels = Object.values(ComplexityLevel);
    for (const level of levels) {
      expect(COMPLEXITY_AGENT_TEAMS[level]).toBeDefined();
      expect(COMPLEXITY_AGENT_TEAMS[level].length).toBeGreaterThan(0);
    }
  });

  it('복잡도가 높을수록 팀 규모가 같거나 더 커야 한다', () => {
    expect(COMPLEXITY_AGENT_TEAMS[ComplexityLevel.L2_MODERATE].length).toBeGreaterThanOrEqual(
      COMPLEXITY_AGENT_TEAMS[ComplexityLevel.L1_SIMPLE].length,
    );
    expect(COMPLEXITY_AGENT_TEAMS[ComplexityLevel.L3_COMPLEX].length).toBeGreaterThanOrEqual(
      COMPLEXITY_AGENT_TEAMS[ComplexityLevel.L2_MODERATE].length,
    );
    expect(COMPLEXITY_AGENT_TEAMS[ComplexityLevel.L4_DANGEROUS].length).toBeGreaterThanOrEqual(
      COMPLEXITY_AGENT_TEAMS[ComplexityLevel.L3_COMPLEX].length,
    );
  });
});
