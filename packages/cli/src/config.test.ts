// CLI 설정 관리 단위 테스트 — JarvisConfigSchema, DEFAULT_CONFIG, parseConfig, mergeConfig 검증
import { describe, it, expect } from "vitest";
import {
  JarvisConfigSchema,
  DEFAULT_CONFIG,
  parseConfig,
  mergeConfig,
} from "./config.js";

describe("JarvisConfigSchema", () => {
  describe("유효한 입력 검증", () => {
    it("should accept a fully specified valid config", () => {
      // Arrange
      const validInput = {
        trustMode: "suggest",
        timeoutSeconds: 120,
        logLevel: "debug",
        databasePath: "./custom/audit.db",
        policyFile: "./custom/policy.md",
        capabilities: {
          autoApproveLowRisk: true,
          requireBiometricForGate: false,
          mobileRequireApproval: true,
        },
        advanced: {
          batchApiEnabled: true,
          promptCachingEnabled: true,
          maxTokensPerRun: 50000,
        },
      };

      // Act
      const result = JarvisConfigSchema.safeParse(validInput);

      // Assert
      expect(result.success).toBe(true);
    });

    it("should accept all valid trustMode values", () => {
      // Arrange
      const modes = ["observe", "suggest", "semi-auto", "full-auto"] as const;

      // Act & Assert
      for (const mode of modes) {
        const result = JarvisConfigSchema.safeParse({ trustMode: mode });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.trustMode).toBe(mode);
        }
      }
    });

    it("should accept all valid logLevel values", () => {
      // Arrange
      const levels = ["debug", "info", "warn", "error"] as const;

      // Act & Assert
      for (const level of levels) {
        const result = JarvisConfigSchema.safeParse({ logLevel: level });
        expect(result.success).toBe(true);
        if (result.success) {
          expect(result.data.logLevel).toBe(level);
        }
      }
    });

    it("should accept positive timeoutSeconds", () => {
      // Arrange
      const input = { timeoutSeconds: 3600 };

      // Act
      const result = JarvisConfigSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeoutSeconds).toBe(3600);
      }
    });
  });

  describe("기본값 적용", () => {
    it("should apply default trustMode as suggest", () => {
      // Arrange — trustMode 미지정
      const input = {};

      // Act
      const result = JarvisConfigSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.trustMode).toBe("suggest");
      }
    });

    it("should apply default timeoutSeconds as 300", () => {
      // Arrange
      const input = {};

      // Act
      const result = JarvisConfigSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.timeoutSeconds).toBe(300);
      }
    });

    it("should apply default logLevel as info", () => {
      // Arrange
      const input = {};

      // Act
      const result = JarvisConfigSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.logLevel).toBe("info");
      }
    });

    it("should apply default databasePath", () => {
      // Arrange
      const input = {};

      // Act
      const result = JarvisConfigSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.databasePath).toBe("./data/audit.db");
      }
    });

    it("should apply default policyFile path", () => {
      // Arrange
      const input = {};

      // Act
      const result = JarvisConfigSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.policyFile).toBe("./.claude/contract.md");
      }
    });

    it("should apply default capabilities with all fields false except mobileRequireApproval", () => {
      // Arrange
      const input = {};

      // Act
      const result = JarvisConfigSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.capabilities.autoApproveLowRisk).toBe(false);
        expect(result.data.capabilities.requireBiometricForGate).toBe(false);
        expect(result.data.capabilities.mobileRequireApproval).toBe(true);
      }
    });

    it("should apply default advanced settings", () => {
      // Arrange
      const input = {};

      // Act
      const result = JarvisConfigSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.advanced.batchApiEnabled).toBe(false);
        expect(result.data.advanced.promptCachingEnabled).toBe(false);
        expect(result.data.advanced.maxTokensPerRun).toBe(100000);
      }
    });

    it("should apply defaults for empty object input", () => {
      // Arrange
      const input = {};

      // Act
      const result = JarvisConfigSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(true);
    });
  });

  describe("잘못된 trustMode 거부", () => {
    it("should reject invalid trustMode string", () => {
      // Arrange
      const input = { trustMode: "super-auto" };

      // Act
      const result = JarvisConfigSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
    });

    it("should reject numeric trustMode", () => {
      // Arrange
      const input = { trustMode: 1 };

      // Act
      const result = JarvisConfigSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
    });

    it("should reject null trustMode", () => {
      // Arrange
      const input = { trustMode: null };

      // Act
      const result = JarvisConfigSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
    });

    it("should reject empty string as trustMode", () => {
      // Arrange
      const input = { trustMode: "" };

      // Act
      const result = JarvisConfigSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
    });
  });

  describe("음수 timeout 거부", () => {
    it("should reject negative timeoutSeconds", () => {
      // Arrange
      const input = { timeoutSeconds: -1 };

      // Act
      const result = JarvisConfigSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
    });

    it("should reject zero timeoutSeconds", () => {
      // Arrange — positive() 검증이므로 0도 거부
      const input = { timeoutSeconds: 0 };

      // Act
      const result = JarvisConfigSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
    });

    it("should reject non-numeric timeoutSeconds", () => {
      // Arrange
      const input = { timeoutSeconds: "300" };

      // Act
      const result = JarvisConfigSchema.safeParse(input);

      // Assert
      expect(result.success).toBe(false);
    });
  });
});

describe("DEFAULT_CONFIG", () => {
  it("should have trustMode set to suggest", () => {
    expect(DEFAULT_CONFIG.trustMode).toBe("suggest");
  });

  it("should have timeoutSeconds set to 300", () => {
    expect(DEFAULT_CONFIG.timeoutSeconds).toBe(300);
  });

  it("should have logLevel set to info", () => {
    expect(DEFAULT_CONFIG.logLevel).toBe("info");
  });

  it("should have correct default databasePath", () => {
    expect(DEFAULT_CONFIG.databasePath).toBe("./data/audit.db");
  });

  it("should have correct default policyFile", () => {
    expect(DEFAULT_CONFIG.policyFile).toBe("./.claude/contract.md");
  });

  it("should have autoApproveLowRisk disabled by default", () => {
    expect(DEFAULT_CONFIG.capabilities.autoApproveLowRisk).toBe(false);
  });

  it("should have requireBiometricForGate disabled by default", () => {
    expect(DEFAULT_CONFIG.capabilities.requireBiometricForGate).toBe(false);
  });

  it("should have mobileRequireApproval enabled by default", () => {
    // 모바일 승인은 기본적으로 필수 (보안 기본값)
    expect(DEFAULT_CONFIG.capabilities.mobileRequireApproval).toBe(true);
  });

  it("should have batchApiEnabled disabled by default", () => {
    expect(DEFAULT_CONFIG.advanced.batchApiEnabled).toBe(false);
  });

  it("should have promptCachingEnabled disabled by default", () => {
    expect(DEFAULT_CONFIG.advanced.promptCachingEnabled).toBe(false);
  });

  it("should have maxTokensPerRun set to 100000", () => {
    expect(DEFAULT_CONFIG.advanced.maxTokensPerRun).toBe(100000);
  });

  it("should be structurally valid against JarvisConfigSchema", () => {
    // DEFAULT_CONFIG 자체가 스키마를 만족하는지 검증
    const result = JarvisConfigSchema.safeParse(DEFAULT_CONFIG);
    expect(result.success).toBe(true);
  });
});

describe("parseConfig()", () => {
  describe("유효한 입력 처리", () => {
    it("should return ok result for valid full config", () => {
      // Arrange
      const validConfig = {
        trustMode: "full-auto",
        timeoutSeconds: 600,
        logLevel: "warn",
        databasePath: "./db/audit.db",
        policyFile: "./policy.md",
        capabilities: {
          autoApproveLowRisk: true,
          requireBiometricForGate: true,
          mobileRequireApproval: false,
        },
        advanced: {
          batchApiEnabled: true,
          promptCachingEnabled: false,
          maxTokensPerRun: 200000,
        },
      };

      // Act
      const result = parseConfig(validConfig);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.trustMode).toBe("full-auto");
        expect(result.value.timeoutSeconds).toBe(600);
      }
    });

    it("should apply defaults for empty object input", () => {
      // Arrange
      const input = {};

      // Act
      const result = parseConfig(input);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.trustMode).toBe("suggest");
        expect(result.value.timeoutSeconds).toBe(300);
      }
    });

    it("should return ok result for partial config with valid fields", () => {
      // Arrange
      const partial = { trustMode: "observe", logLevel: "error" };

      // Act
      const result = parseConfig(partial);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.trustMode).toBe("observe");
        expect(result.value.logLevel).toBe("error");
      }
    });
  });

  describe("무효한 입력 거부", () => {
    it("should return err result for invalid trustMode", () => {
      // Arrange
      const invalidConfig = { trustMode: "yolo-mode" };

      // Act
      const result = parseConfig(invalidConfig);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
        expect(result.error.message).toContain("설정 파일 검증 실패");
      }
    });

    it("should return err result for negative timeoutSeconds", () => {
      // Arrange
      const invalidConfig = { timeoutSeconds: -100 };

      // Act
      const result = parseConfig(invalidConfig);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("should return err result for null input", () => {
      // Arrange
      const nullInput = null;

      // Act
      const result = parseConfig(nullInput);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("should return err result for string input", () => {
      // Arrange
      const stringInput = "not-an-object";

      // Act
      const result = parseConfig(stringInput);

      // Assert
      expect(result.ok).toBe(false);
    });

    it("should return err result for invalid logLevel", () => {
      // Arrange
      const invalidConfig = { logLevel: "trace" };

      // Act
      const result = parseConfig(invalidConfig);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("should include Zod error details in error message", () => {
      // Arrange
      const invalidConfig = { trustMode: "bad-mode" };

      // Act
      const result = parseConfig(invalidConfig);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        // 에러 메시지에 Zod 검증 실패 내용 포함 확인
        expect(result.error.message).toContain("설정 파일 검증 실패");
      }
    });
  });
});

describe("mergeConfig()", () => {
  describe("부분 설정 병합", () => {
    it("should merge partial config over default values", () => {
      // Arrange — trustMode만 오버라이드
      const partial = { trustMode: "semi-auto" as const };

      // Act
      const result = mergeConfig(partial);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.trustMode).toBe("semi-auto");
        // 나머지 값은 DEFAULT_CONFIG 값 유지
        expect(result.value.timeoutSeconds).toBe(DEFAULT_CONFIG.timeoutSeconds);
        expect(result.value.logLevel).toBe(DEFAULT_CONFIG.logLevel);
      }
    });

    it("should merge multiple fields simultaneously", () => {
      // Arrange
      const partial = {
        trustMode: "full-auto" as const,
        logLevel: "debug" as const,
        timeoutSeconds: 60,
      };

      // Act
      const result = mergeConfig(partial);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.trustMode).toBe("full-auto");
        expect(result.value.logLevel).toBe("debug");
        expect(result.value.timeoutSeconds).toBe(60);
      }
    });

    it("should merge capabilities partial override", () => {
      // Arrange — capabilities 전체 교체 (spread 방식)
      const partial = {
        capabilities: {
          autoApproveLowRisk: true,
          requireBiometricForGate: false,
          mobileRequireApproval: false,
        },
      };

      // Act
      const result = mergeConfig(partial);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.capabilities.autoApproveLowRisk).toBe(true);
        expect(result.value.capabilities.mobileRequireApproval).toBe(false);
      }
    });

    it("should merge advanced settings override", () => {
      // Arrange
      const partial = {
        advanced: {
          batchApiEnabled: true,
          promptCachingEnabled: true,
          maxTokensPerRun: 50000,
        },
      };

      // Act
      const result = mergeConfig(partial);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.advanced.batchApiEnabled).toBe(true);
        expect(result.value.advanced.maxTokensPerRun).toBe(50000);
      }
    });
  });

  describe("기본값 유지", () => {
    it("should preserve all DEFAULT_CONFIG values when merging empty partial", () => {
      // Arrange — 빈 부분 설정 병합
      const partial = {};

      // Act
      const result = mergeConfig(partial);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.trustMode).toBe(DEFAULT_CONFIG.trustMode);
        expect(result.value.timeoutSeconds).toBe(DEFAULT_CONFIG.timeoutSeconds);
        expect(result.value.logLevel).toBe(DEFAULT_CONFIG.logLevel);
        expect(result.value.databasePath).toBe(DEFAULT_CONFIG.databasePath);
        expect(result.value.policyFile).toBe(DEFAULT_CONFIG.policyFile);
      }
    });

    it("should preserve unspecified fields when partially merging", () => {
      // Arrange — databasePath만 변경
      const partial = { databasePath: "./custom/db.sqlite" };

      // Act
      const result = mergeConfig(partial);

      // Assert
      expect(result.ok).toBe(true);
      if (result.ok) {
        expect(result.value.databasePath).toBe("./custom/db.sqlite");
        // 변경하지 않은 필드는 기본값 유지
        expect(result.value.trustMode).toBe(DEFAULT_CONFIG.trustMode);
        expect(result.value.policyFile).toBe(DEFAULT_CONFIG.policyFile);
      }
    });

    it("should return ok for merging empty partial (no changes)", () => {
      // Arrange
      const partial = {};

      // Act
      const result = mergeConfig(partial);

      // Assert
      expect(result.ok).toBe(true);
    });
  });

  describe("무효한 병합 입력 거부", () => {
    it("should return err when merging invalid trustMode", () => {
      // Arrange — 유효하지 않은 값으로 오버라이드 시도
      const partial = { trustMode: "invalid-mode" as never };

      // Act
      const result = mergeConfig(partial);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });

    it("should return err when merging negative timeout", () => {
      // Arrange
      const partial = { timeoutSeconds: -500 };

      // Act
      const result = mergeConfig(partial);

      // Assert
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("VALIDATION_FAILED");
      }
    });
  });
});
