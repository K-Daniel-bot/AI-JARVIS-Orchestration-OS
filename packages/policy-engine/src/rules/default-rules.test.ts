// 기본 정책 규칙 단위 테스트

import { describe, it, expect } from "vitest";
import {
  FS_WRITE_DENY_RULES,
  EXEC_DENY_RULES,
  NETWORK_RULES,
  MOBILE_RULES,
  DEFAULT_RULES,
  DEFAULT_FS_CONSTRAINTS,
  DEFAULT_EXEC_CONSTRAINTS,
  DEFAULT_NETWORK_CONSTRAINTS,
} from "./default-rules.js";

describe("FS_WRITE_DENY_RULES", () => {
  it("Windows 시스템 경로 규칙이 DENY 액션을 가져야 한다", () => {
    // Arrange & Act
    const windowsRule = FS_WRITE_DENY_RULES.find(
      (r) => r.id === "fs.write_deny.windows_system",
    );

    // Assert
    expect(windowsRule).toBeDefined();
    expect(windowsRule?.action).toBe("DENY");
    expect(windowsRule?.riskWeight).toBe(100);
    expect(windowsRule?.category).toBe("fs");
  });

  it("환경 변수 파일 규칙이 GATE_REQUIRED 액션을 가져야 한다", () => {
    // Arrange & Act
    const envRule = FS_WRITE_DENY_RULES.find(
      (r) => r.id === "fs.write_deny.env_secrets",
    );

    // Assert
    expect(envRule).toBeDefined();
    expect(envRule?.action).toBe("GATE_REQUIRED");
    expect(envRule?.requiredGate).toBe("GATE_APPLY_CHANGES");
    expect(envRule?.requiredCapability).toBe("fs.write");
  });

  it("모든 FS 거부 규칙은 FILE_OPERATION 의도에 적용되어야 한다", () => {
    // Arrange & Act & Assert
    for (const rule of FS_WRITE_DENY_RULES) {
      expect(rule.appliesTo).toContain("FILE_OPERATION");
    }
  });
});

describe("EXEC_DENY_RULES", () => {
  it("sudo 규칙이 DENY 액션을 가져야 한다", () => {
    // Arrange & Act
    const sudoRule = EXEC_DENY_RULES.find((r) => r.id === "exec.deny.sudo");

    // Assert
    expect(sudoRule).toBeDefined();
    expect(sudoRule?.action).toBe("DENY");
    expect(sudoRule?.riskWeight).toBe(95);
  });

  it("디스크 포맷 규칙이 최대 위험 가중치를 가져야 한다", () => {
    // Arrange & Act
    const formatRule = EXEC_DENY_RULES.find((r) => r.id === "exec.deny.format");

    // Assert
    expect(formatRule).toBeDefined();
    expect(formatRule?.riskWeight).toBe(100);
    expect(formatRule?.action).toBe("DENY");
  });

  it("시스템 종료 규칙이 GATE_REQUIRED이며 게이트를 지정해야 한다", () => {
    // Arrange & Act
    const shutdownRule = EXEC_DENY_RULES.find(
      (r) => r.id === "exec.deny.shutdown",
    );

    // Assert
    expect(shutdownRule).toBeDefined();
    expect(shutdownRule?.action).toBe("GATE_REQUIRED");
    expect(shutdownRule?.requiredGate).toBe("GATE_DESTRUCTIVE");
    expect(shutdownRule?.requiredCapability).toBe("exec.run");
  });
});

describe("NETWORK_RULES", () => {
  it("파일 다운로드 규칙이 GATE_REQUIRED이어야 한다", () => {
    // Arrange & Act
    const downloadRule = NETWORK_RULES.find(
      (r) => r.id === "network.gate.download",
    );

    // Assert
    expect(downloadRule).toBeDefined();
    expect(downloadRule?.action).toBe("GATE_REQUIRED");
    expect(downloadRule?.requiredGate).toBe("GATE_DOWNLOAD");
    expect(downloadRule?.requiredCapability).toBe("browser.download");
  });

  it("인증 관련 URL 규칙이 WEB_ACCESS 의도에 적용되어야 한다", () => {
    // Arrange & Act
    const authRule = NETWORK_RULES.find((r) => r.id === "network.gate.auth");

    // Assert
    expect(authRule).toBeDefined();
    expect(authRule?.appliesTo).toContain("WEB_ACCESS");
  });
});

describe("MOBILE_RULES", () => {
  it("SMS 전송 규칙이 GATE_REQUIRED이어야 한다", () => {
    // Arrange & Act
    const smsRule = MOBILE_RULES.find((r) => r.id === "mobile.gate.sms");

    // Assert
    expect(smsRule).toBeDefined();
    expect(smsRule?.action).toBe("GATE_REQUIRED");
    expect(smsRule?.requiredGate).toBe("GATE_SMS_CONFIRM");
    expect(smsRule?.requiredCapability).toBe("mobile.sms.send");
  });

  it("전화 발신 규칙이 MOBILE_ACTION 의도에만 적용되어야 한다", () => {
    // Arrange & Act
    const callRule = MOBILE_RULES.find((r) => r.id === "mobile.gate.call");

    // Assert
    expect(callRule).toBeDefined();
    expect(callRule?.appliesTo).toEqual(["MOBILE_ACTION"]);
  });
});

describe("DEFAULT_RULES", () => {
  it("모든 개별 규칙 목록을 포함해야 한다", () => {
    // Arrange
    const expectedCount =
      FS_WRITE_DENY_RULES.length +
      EXEC_DENY_RULES.length +
      NETWORK_RULES.length +
      MOBILE_RULES.length;

    // Act & Assert
    expect(DEFAULT_RULES.length).toBe(expectedCount);
  });

  it("모든 규칙은 고유한 id를 가져야 한다", () => {
    // Arrange & Act
    const ids = DEFAULT_RULES.map((r) => r.id);
    const uniqueIds = new Set(ids);

    // Assert
    expect(uniqueIds.size).toBe(ids.length);
  });

  it("모든 규칙의 riskWeight는 0 이상 100 이하여야 한다", () => {
    // Arrange & Act & Assert
    for (const rule of DEFAULT_RULES) {
      expect(rule.riskWeight).toBeGreaterThanOrEqual(0);
      expect(rule.riskWeight).toBeLessThanOrEqual(100);
    }
  });
});

describe("DEFAULT_FS_CONSTRAINTS", () => {
  it("기본 읽기 허용 패턴이 모든 경로를 포함해야 한다", () => {
    // Arrange & Act & Assert
    expect(DEFAULT_FS_CONSTRAINTS.readAllow).toContain("**/*");
  });

  it("기본 쓰기 허용 패턴이 현재 디렉토리 하위를 포함해야 한다", () => {
    // Arrange & Act & Assert
    expect(DEFAULT_FS_CONSTRAINTS.writeAllow).toContain("./**/*");
  });

  it("시스템 경로가 쓰기 거부 목록에 포함되어야 한다", () => {
    // Arrange & Act & Assert
    expect(DEFAULT_FS_CONSTRAINTS.writeDeny).toContain("/Windows/**");
    expect(DEFAULT_FS_CONSTRAINTS.writeDeny).toContain("/System/**");
  });
});

describe("DEFAULT_EXEC_CONSTRAINTS", () => {
  it("기본 허용 명령어 목록에 node와 git이 포함되어야 한다", () => {
    // Arrange & Act & Assert
    expect(DEFAULT_EXEC_CONSTRAINTS.allow).toContain("node");
    expect(DEFAULT_EXEC_CONSTRAINTS.allow).toContain("git");
  });

  it("기본 거부 명령어 목록에 sudo와 regedit이 포함되어야 한다", () => {
    // Arrange & Act & Assert
    expect(DEFAULT_EXEC_CONSTRAINTS.deny).toContain("sudo");
    expect(DEFAULT_EXEC_CONSTRAINTS.deny).toContain("regedit");
  });
});

describe("DEFAULT_NETWORK_CONSTRAINTS", () => {
  it("기본 허용 도메인에 github.com이 포함되어야 한다", () => {
    // Arrange & Act & Assert
    expect(DEFAULT_NETWORK_CONSTRAINTS.allowDomains).toContain("*.github.com");
  });

  it("기본 네트워크 정책이 DENY여야 한다 (화이트리스트 원칙)", () => {
    // Arrange & Act & Assert
    expect(DEFAULT_NETWORK_CONSTRAINTS.default).toBe("DENY");
  });
});
