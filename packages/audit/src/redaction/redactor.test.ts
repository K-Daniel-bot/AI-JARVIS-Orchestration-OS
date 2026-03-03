// 민감 정보 마스킹 단위 테스트
import { describe, it, expect } from "vitest";
import { redact, redactDeep } from "./redactor.js";

describe("redact()", () => {
  describe("민감 정보가 없는 입력", () => {
    it("should return input unchanged when no sensitive data", () => {
      // Arrange
      const input = "일반 텍스트 메시지입니다.";

      // Act
      const result = redact(input);

      // Assert
      expect(result.redacted).toBe(input);
      expect(result.applied).toHaveLength(0);
      expect(result.patternsMatched).toBe(0);
    });

    it("should return empty string unchanged", () => {
      // Act
      const result = redact("");

      // Assert
      expect(result.redacted).toBe("");
      expect(result.patternsMatched).toBe(0);
    });
  });

  describe("secrets 카테고리 마스킹", () => {
    it("should redact OpenAI/Anthropic API key (sk- prefix)", () => {
      // Arrange
      const input = "API 키: sk-abcdefghijklmnopqrstu12345";

      // Act
      const result = redact(input);

      // Assert
      expect(result.redacted).not.toContain("sk-abcdefghijklmnopqrstu12345");
      expect(result.redacted).toContain("[REDACTED:secrets]");
      expect(result.applied).toContain("secrets");
      expect(result.patternsMatched).toBeGreaterThan(0);
    });

    it("should redact AWS access key (AKIA prefix)", () => {
      // Arrange
      const input = "AWS 키: AKIAIOSFODNN7EXAMPLE";

      // Act
      const result = redact(input);

      // Assert
      expect(result.redacted).not.toContain("AKIAIOSFODNN7EXAMPLE");
      expect(result.redacted).toContain("[REDACTED:secrets]");
      expect(result.applied).toContain("secrets");
    });

    it("should redact api_key=value pattern", () => {
      // Arrange
      const input = "api_key=supersecretkey123";

      // Act
      const result = redact(input);

      // Assert
      expect(result.redacted).not.toContain("supersecretkey123");
      expect(result.redacted).toContain("[REDACTED:secrets]");
    });

    it("should redact secret_key: value pattern", () => {
      // Arrange
      const input = 'secret_key: "mySecretValue12345"';

      // Act
      const result = redact(input);

      // Assert
      expect(result.redacted).not.toContain("mySecretValue12345");
      expect(result.applied).toContain("secrets");
    });

    it("should redact GitHub personal access token (ghp_ prefix)", () => {
      // Arrange
      const input = "token: ghp_ABCDEFghijklmnopqrstuvwxyz0123456789";

      // Act
      const result = redact(input);

      // Assert
      expect(result.redacted).not.toContain("ghp_ABCDEFghijklmnopqrstuvwxyz0123456789");
      expect(result.redacted).toContain("[REDACTED:secrets]");
      expect(result.applied).toContain("secrets");
    });

    it("should redact PEM private key block", () => {
      // Arrange
      const input = "-----BEGIN RSA PRIVATE KEY-----\nMIIBogIBAAJBALRiMLAH\n-----END RSA PRIVATE KEY-----";

      // Act
      const result = redact(input);

      // Assert
      expect(result.redacted).not.toContain("MIIBogIBAAJBALRiMLAH");
      expect(result.redacted).toContain("[REDACTED:secrets]");
      expect(result.applied).toContain("secrets");
    });
  });

  describe("tokens 카테고리 마스킹", () => {
    it("should redact Bearer token", () => {
      // Arrange
      const input = "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcdef123456";

      // Act
      const result = redact(input);

      // Assert
      expect(result.redacted).not.toContain("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcdef123456");
      expect(result.redacted).toContain("[REDACTED:tokens]");
      expect(result.applied).toContain("tokens");
    });

    it("should redact access_token=value pattern", () => {
      // Arrange
      const input = "access_token=myaccesstoken12345678";

      // Act
      const result = redact(input);

      // Assert
      expect(result.redacted).not.toContain("myaccesstoken12345678");
      expect(result.redacted).toContain("[REDACTED:tokens]");
      expect(result.applied).toContain("tokens");
    });

    it("should redact JWT token (3-part dot-separated eyJ format)", () => {
      // Arrange — 실제 JWT 형식 (헤더.페이로드.서명)
      const input =
        "token: eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";

      // Act
      const result = redact(input);

      // Assert
      expect(result.redacted).toContain("[REDACTED:tokens]");
      expect(result.applied).toContain("tokens");
    });

    it("should redact refresh_token pattern", () => {
      // Arrange
      const input = "refresh_token: refreshtoken9876543210ab";

      // Act
      const result = redact(input);

      // Assert
      expect(result.redacted).toContain("[REDACTED:tokens]");
    });
  });

  describe("passwords 카테고리 마스킹", () => {
    it("should redact password=value pattern", () => {
      // Arrange
      const input = "password=mysecretpass";

      // Act
      const result = redact(input);

      // Assert
      expect(result.redacted).not.toContain("mysecretpass");
      expect(result.redacted).toContain("[REDACTED:passwords]");
      expect(result.applied).toContain("passwords");
    });

    it("should redact passwd: value pattern", () => {
      // Arrange
      const input = "passwd: hunter2";

      // Act
      const result = redact(input);

      // Assert
      expect(result.redacted).toContain("[REDACTED:passwords]");
      expect(result.applied).toContain("passwords");
    });

    it("should redact pwd=value pattern", () => {
      // Arrange
      const input = "pwd=secret99";

      // Act
      const result = redact(input);

      // Assert
      expect(result.redacted).toContain("[REDACTED:passwords]");
    });

    it("should redact connection string password", () => {
      // Arrange — 연결 문자열 내 비밀번호 패턴 (:password@)
      const input = "postgresql://user:secretpass@localhost:5432/mydb";

      // Act
      const result = redact(input);

      // Assert
      expect(result.redacted).toContain("[REDACTED:passwords]");
      expect(result.applied).toContain("passwords");
    });
  });

  describe("cookies 카테고리 마스킹", () => {
    it("should redact Set-Cookie header", () => {
      // Arrange
      const input = "Set-Cookie: session=abc123xyz; HttpOnly; Secure";

      // Act
      const result = redact(input);

      // Assert
      expect(result.redacted).toContain("[REDACTED:cookies]");
      expect(result.applied).toContain("cookies");
    });

    it("should redact Cookie header", () => {
      // Arrange
      const input = "Cookie: sessionid=xyz987abc; path=/";

      // Act
      const result = redact(input);

      // Assert
      expect(result.redacted).toContain("[REDACTED:cookies]");
    });

    it("should redact session_id pattern", () => {
      // Arrange
      const input = "session_id=abcdef1234567890";

      // Act
      const result = redact(input);

      // Assert
      expect(result.redacted).toContain("[REDACTED:cookies]");
      expect(result.applied).toContain("cookies");
    });
  });

  describe("복수 카테고리 동시 마스킹", () => {
    it("should redact multiple categories in one string", () => {
      // Arrange — API 키와 비밀번호가 함께 포함된 로그
      const input = "api_key=mysecretkey123 password=mypassword";

      // Act
      const result = redact(input);

      // Assert
      expect(result.applied).toContain("secrets");
      expect(result.applied).toContain("passwords");
      expect(result.patternsMatched).toBeGreaterThanOrEqual(2);
    });

    it("should count patternsMatched correctly for multiple matches", () => {
      // Arrange — 같은 패턴이 두 번 등장
      const input = "password=pass1 password=pass2";

      // Act
      const result = redact(input);

      // Assert
      expect(result.patternsMatched).toBeGreaterThanOrEqual(2);
    });
  });
});

describe("redactDeep()", () => {
  describe("기본 타입 처리", () => {
    it("should return number unchanged", () => {
      // Act
      const result = redactDeep(42);

      // Assert
      expect(result.redacted).toBe(42);
      expect(result.totalPatterns).toBe(0);
    });

    it("should return boolean unchanged", () => {
      // Act
      const result = redactDeep(true);

      // Assert
      expect(result.redacted).toBe(true);
      expect(result.totalPatterns).toBe(0);
    });

    it("should return null unchanged", () => {
      // Act
      const result = redactDeep(null);

      // Assert
      expect(result.redacted).toBeNull();
    });
  });

  describe("문자열 처리", () => {
    it("should redact sensitive string at top level", () => {
      // Arrange
      const input = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcdefghijk";

      // Act
      const result = redactDeep(input);

      // Assert
      expect(result.redacted).toContain("[REDACTED:tokens]");
      expect(result.totalPatterns).toBeGreaterThan(0);
    });

    it("should return clean string unchanged", () => {
      // Arrange
      const input = "안전한 일반 문자열";

      // Act
      const result = redactDeep(input);

      // Assert
      expect(result.redacted).toBe(input);
      expect(result.totalPatterns).toBe(0);
      expect(result.categories).toHaveLength(0);
    });
  });

  describe("배열 처리", () => {
    it("should redact sensitive values inside an array", () => {
      // Arrange
      const input = ["normal text", "password=secret123", "also normal"];

      // Act
      const result = redactDeep(input);

      // Assert
      expect(Array.isArray(result.redacted)).toBe(true);
      const redacted = result.redacted as string[];
      expect(redacted[0]).toBe("normal text");
      expect(redacted[1]).toContain("[REDACTED:passwords]");
      expect(redacted[2]).toBe("also normal");
      expect(result.totalPatterns).toBeGreaterThan(0);
    });

    it("should handle nested arrays", () => {
      // Arrange
      const input = [["password=secret"], ["normal"]];

      // Act
      const result = redactDeep(input);

      // Assert
      const outer = result.redacted as unknown[][];
      expect((outer[0] as string[])[0]).toContain("[REDACTED:passwords]");
      expect((outer[1] as string[])[0]).toBe("normal");
    });
  });

  describe("객체 처리", () => {
    it("should redact sensitive value in object field", () => {
      // Arrange
      const input = {
        action: "login",
        credentials: "password=mypassword",
      };

      // Act
      const result = redactDeep(input);

      // Assert
      const out = result.redacted as typeof input;
      expect(out.action).toBe("login");
      expect(out.credentials).toContain("[REDACTED:passwords]");
      expect(result.totalPatterns).toBeGreaterThan(0);
    });

    it("should redact API key in nested object", () => {
      // Arrange
      const input = {
        config: {
          service: "claude",
          auth: {
            apiKey: "sk-abcdefghijklmnopqrstu12345",
          },
        },
      };

      // Act
      const result = redactDeep(input);

      // Assert
      const out = result.redacted as typeof input;
      expect(out.config.auth.apiKey).toContain("[REDACTED:secrets]");
      expect(result.categories).toContain("secrets");
    });

    it("should preserve keys and non-sensitive values", () => {
      // Arrange
      const input = {
        userId: "user-123",
        action: "file_read",
        path: "/home/user/docs",
        token: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcdef12345678901",
      };

      // Act
      const result = redactDeep(input);

      // Assert
      const out = result.redacted as typeof input;
      expect(out.userId).toBe("user-123");
      expect(out.action).toBe("file_read");
      expect(out.path).toBe("/home/user/docs");
      expect(out.token).toContain("[REDACTED:tokens]");
    });
  });

  describe("중첩 객체 재귀 마스킹", () => {
    it("should redact across deeply nested structure", () => {
      // Arrange
      const input = {
        level1: {
          level2: {
            level3: {
              secret: "api_key=supersecretvalue123",
            },
          },
        },
      };

      // Act
      const result = redactDeep(input);

      // Assert
      const out = result.redacted as typeof input;
      expect(out.level1.level2.level3.secret).toContain("[REDACTED:secrets]");
      expect(result.totalPatterns).toBeGreaterThan(0);
    });

    it("should accumulate categories from multiple levels", () => {
      // Arrange
      const input = {
        auth: "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9abcdef12345678901",
        db: {
          url: "postgresql://user:secretpass@localhost/db",
        },
      };

      // Act
      const result = redactDeep(input);

      // Assert
      expect(result.categories).toContain("tokens");
      expect(result.categories).toContain("passwords");
      expect(result.totalPatterns).toBeGreaterThanOrEqual(2);
    });

    it("should handle array of objects", () => {
      // Arrange
      const input = [
        { name: "item1", password: "password=secret" },
        { name: "item2", password: "no_sensitive" },
      ];

      // Act
      const result = redactDeep(input);

      // Assert
      const out = result.redacted as Array<{ name: string; password: string }>;
      expect(out[0]?.password).toContain("[REDACTED:passwords]");
      expect(out[1]?.password).toBe("no_sensitive");
    });
  });

  describe("totalPatterns 및 categories 집계", () => {
    it("should return zero totalPatterns for clean object", () => {
      // Arrange
      const input = { a: "hello", b: 42, c: true };

      // Act
      const result = redactDeep(input);

      // Assert
      expect(result.totalPatterns).toBe(0);
      expect(result.categories).toHaveLength(0);
    });

    it("should sum patternsMatched across all fields", () => {
      // Arrange — 비밀번호 두 개가 다른 필드에 존재
      const input = {
        field1: "password=pass1",
        field2: "password=pass2",
      };

      // Act
      const result = redactDeep(input);

      // Assert
      expect(result.totalPatterns).toBeGreaterThanOrEqual(2);
    });
  });
});
