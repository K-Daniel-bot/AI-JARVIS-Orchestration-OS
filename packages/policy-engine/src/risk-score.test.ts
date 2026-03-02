// 위험도 점수 계산 단위 테스트 — calculateRiskScore, classifyRiskLevel, assessDimensions 검증

import { describe, it, expect } from 'vitest';
import {
  calculateRiskScore,
  classifyRiskLevel,
  assessDimensions,
  type RiskDimensions,
} from './risk-score.js';
import type { PolicyRequest } from '@jarvis/shared';

// ─────────────────────────────────────────
// calculateRiskScore 테스트
// ─────────────────────────────────────────

describe('calculateRiskScore', () => {
  it('모든 차원이 0이면 Risk Score는 0이어야 한다', () => {
    // Arrange
    const dimensions: RiskDimensions = {
      systemImpact: 0,
      dataSensitivity: 0,
      financial: 0,
      adminPrivilege: 0,
      externalNetwork: 0,
    };

    // Act
    const score = calculateRiskScore(dimensions);

    // Assert
    expect(score).toBe(0);
  });

  it('모든 차원이 100이면 Risk Score는 100이어야 한다', () => {
    // Arrange
    const dimensions: RiskDimensions = {
      systemImpact: 100,
      dataSensitivity: 100,
      financial: 100,
      adminPrivilege: 100,
      externalNetwork: 100,
    };

    // Act
    const score = calculateRiskScore(dimensions);

    // Assert
    expect(score).toBe(100);
  });

  it('금융 차원만 100이면 가중치(5/17)에 비례한 점수여야 한다', () => {
    // Arrange — financial 가중치: 5, 총합: 17 → 5*100/17 ≈ 29
    const dimensions: RiskDimensions = {
      systemImpact: 0,
      dataSensitivity: 0,
      financial: 100,
      adminPrivilege: 0,
      externalNetwork: 0,
    };

    // Act
    const score = calculateRiskScore(dimensions);

    // Assert — 5*100/17 = 29.4... → 반올림 29
    expect(score).toBe(29);
  });

  it('관리자 권한 차원만 100이면 가중치(4/17)에 비례한 점수여야 한다', () => {
    // Arrange — adminPrivilege 가중치: 4, 총합: 17 → 4*100/17 ≈ 24
    const dimensions: RiskDimensions = {
      systemImpact: 0,
      dataSensitivity: 0,
      financial: 0,
      adminPrivilege: 100,
      externalNetwork: 0,
    };

    // Act
    const score = calculateRiskScore(dimensions);

    // Assert — 4*100/17 = 23.5... → 반올림 24
    expect(score).toBe(24);
  });

  it('점수는 항상 0~100 범위여야 한다 (클램핑)', () => {
    // Arrange — 극단값 입력
    const dimensions: RiskDimensions = {
      systemImpact: 200,
      dataSensitivity: 200,
      financial: 200,
      adminPrivilege: 200,
      externalNetwork: 200,
    };

    // Act
    const score = calculateRiskScore(dimensions);

    // Assert
    expect(score).toBeLessThanOrEqual(100);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

// ─────────────────────────────────────────
// classifyRiskLevel 테스트
// ─────────────────────────────────────────

describe('classifyRiskLevel', () => {
  it('0점은 LOW 레벨이어야 한다', () => {
    expect(classifyRiskLevel(0)).toBe('LOW');
  });

  it('25점은 LOW 레벨이어야 한다 (경계값)', () => {
    expect(classifyRiskLevel(25)).toBe('LOW');
  });

  it('26점은 MEDIUM 레벨이어야 한다 (경계값)', () => {
    expect(classifyRiskLevel(26)).toBe('MEDIUM');
  });

  it('50점은 MEDIUM 레벨이어야 한다 (경계값)', () => {
    expect(classifyRiskLevel(50)).toBe('MEDIUM');
  });

  it('51점은 HIGH 레벨이어야 한다 (경계값)', () => {
    expect(classifyRiskLevel(51)).toBe('HIGH');
  });

  it('75점은 HIGH 레벨이어야 한다 (경계값)', () => {
    expect(classifyRiskLevel(75)).toBe('HIGH');
  });

  it('76점은 CRITICAL 레벨이어야 한다 (경계값)', () => {
    expect(classifyRiskLevel(76)).toBe('CRITICAL');
  });

  it('100점은 CRITICAL 레벨이어야 한다', () => {
    expect(classifyRiskLevel(100)).toBe('CRITICAL');
  });
});

// ─────────────────────────────────────────
// assessDimensions 테스트
// ─────────────────────────────────────────

describe('assessDimensions', () => {
  /** 기본 요청 생성 헬퍼 */
  function makeRequest(overrides: Partial<PolicyRequest> = {}): PolicyRequest {
    return {
      raw_input: '',
      intent: 'CODE_IMPLEMENTATION',
      targets: [],
      requires_web_access: false,
      requires_login: false,
      ...overrides,
    };
  }

  it('일반 코드 실행 요청은 모든 차원이 낮아야 한다', () => {
    // Arrange
    const request = makeRequest({
      raw_input: 'TypeScript 파일을 컴파일해주세요',
      intent: 'CODE_IMPLEMENTATION',
      targets: ['/workspace/project/src'],
    });

    // Act
    const dimensions = assessDimensions(request, request.targets);

    // Assert
    expect(dimensions.financial).toBe(0);
    expect(dimensions.systemImpact).toBe(0);
    expect(dimensions.adminPrivilege).toBe(0);
  });

  it('금융 키워드가 포함된 요청은 financial 차원이 100이어야 한다', () => {
    // Arrange
    const request = makeRequest({
      raw_input: 'billing 시스템을 자동화해주세요',
    });

    // Act
    const dimensions = assessDimensions(request, []);

    // Assert
    expect(dimensions.financial).toBe(100);
  });

  it('결제 키워드가 포함된 요청은 financial 차원이 100이어야 한다', () => {
    // Arrange
    const request = makeRequest({ raw_input: 'payment gateway 연동' });

    // Act
    const dimensions = assessDimensions(request, []);

    // Assert
    expect(dimensions.financial).toBe(100);
  });

  it('은행 키워드가 포함된 요청은 financial 차원이 100이어야 한다', () => {
    // Arrange
    const request = makeRequest({ raw_input: 'bank API 호출' });

    // Act
    const dimensions = assessDimensions(request, []);

    // Assert
    expect(dimensions.financial).toBe(100);
  });

  it('Windows 시스템 경로가 포함된 대상은 systemImpact가 100이어야 한다', () => {
    // Arrange
    const request = makeRequest({ raw_input: '파일 읽기' });

    // Act
    const dimensions = assessDimensions(request, ['/Windows/System32/hosts']);

    // Assert
    expect(dimensions.systemImpact).toBe(100);
  });

  it('AppData 경로가 포함된 대상은 systemImpact가 100이어야 한다', () => {
    // Arrange
    const request = makeRequest({ raw_input: '설정 파일 읽기' });

    // Act
    const dimensions = assessDimensions(request, ['AppData/Roaming/app.json']);

    // Assert
    expect(dimensions.systemImpact).toBe(100);
  });

  it('sudo 명령이 포함된 요청은 adminPrivilege가 100이어야 한다', () => {
    // Arrange
    const request = makeRequest({ raw_input: 'sudo apt install git' });

    // Act
    const dimensions = assessDimensions(request, []);

    // Assert
    expect(dimensions.adminPrivilege).toBe(100);
  });

  it('regedit 명령이 포함된 요청은 adminPrivilege가 100이어야 한다', () => {
    // Arrange
    const request = makeRequest({ raw_input: 'regedit을 실행해주세요' });

    // Act
    const dimensions = assessDimensions(request, []);

    // Assert
    expect(dimensions.adminPrivilege).toBe(100);
  });

  it('requires_web_access가 true이면 externalNetwork가 50 이상이어야 한다', () => {
    // Arrange
    const request = makeRequest({ requires_web_access: true });

    // Act
    const dimensions = assessDimensions(request, []);

    // Assert
    expect(dimensions.externalNetwork).toBeGreaterThanOrEqual(50);
  });

  it('.env 파일이 포함된 요청은 dataSensitivity가 높아야 한다', () => {
    // Arrange
    const request = makeRequest({ raw_input: '.env 파일을 읽어주세요' });

    // Act
    const dimensions = assessDimensions(request, ['.env']);

    // Assert
    expect(dimensions.dataSensitivity).toBeGreaterThan(0);
  });

  it('credentials 키워드가 포함된 요청은 dataSensitivity가 높아야 한다', () => {
    // Arrange
    const request = makeRequest({ raw_input: 'credentials 파일 확인' });

    // Act
    const dimensions = assessDimensions(request, []);

    // Assert
    expect(dimensions.dataSensitivity).toBeGreaterThan(0);
  });

  it('requires_login과 민감 파일이 동시에 있으면 dataSensitivity가 100이어야 한다', () => {
    // Arrange
    const request = makeRequest({
      raw_input: 'credentials 읽기',
      requires_login: true,
    });

    // Act
    const dimensions = assessDimensions(request, []);

    // Assert
    expect(dimensions.dataSensitivity).toBe(100);
  });

  it('차원 점수는 항상 0~100 범위여야 한다', () => {
    // Arrange — 모든 위험 요소가 동시에 포함된 극단 케이스
    const request = makeRequest({
      raw_input: 'billing payment bank credentials .env sudo regedit download',
      requires_web_access: true,
      requires_login: true,
      targets: ['/Windows/System32/cmd.exe', 'AppData/secrets.key'],
    });

    // Act
    const dimensions = assessDimensions(request, request.targets);

    // Assert
    const values = Object.values(dimensions);
    for (const value of values) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(100);
    }
  });
});
