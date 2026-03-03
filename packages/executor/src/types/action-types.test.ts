// 액션 타입 유틸리티 함수 단위 테스트 — Capability ↔ ActionType 변환 및 카테고리 분류 검증

import { describe, it, expect } from "vitest";
import {
  capabilityToActionType,
  actionTypeToCapability,
  getActionCategory,
} from "./action-types.js";

// ──────────────────────────────────────────────
// capabilityToActionType 테스트
// ──────────────────────────────────────────────
describe("capabilityToActionType", () => {
  it("'fs.read' Capability는 'FS_READ' ActionType을 반환해야 한다", () => {
    // Arrange & Act
    const result = capabilityToActionType("fs.read");

    // Assert
    expect(result).toBe("FS_READ");
  });

  it("'fs.write' Capability는 'FS_WRITE' ActionType을 반환해야 한다", () => {
    // Arrange & Act
    const result = capabilityToActionType("fs.write");

    // Assert
    expect(result).toBe("FS_WRITE");
  });

  it("'exec.run' Capability는 'EXEC_RUN' ActionType을 반환해야 한다", () => {
    // Arrange & Act
    const result = capabilityToActionType("exec.run");

    // Assert
    expect(result).toBe("EXEC_RUN");
  });

  it("'app.launch' Capability는 'APP_LAUNCH' ActionType을 반환해야 한다", () => {
    // Arrange & Act
    const result = capabilityToActionType("app.launch");

    // Assert
    expect(result).toBe("APP_LAUNCH");
  });

  it("'process.kill' Capability는 'PROCESS_KILL' ActionType을 반환해야 한다", () => {
    // Arrange & Act
    const result = capabilityToActionType("process.kill");

    // Assert
    expect(result).toBe("PROCESS_KILL");
  });

  it("'browser.navigate' Capability는 'BROWSER_OPEN_URL' ActionType을 반환해야 한다", () => {
    // Arrange & Act
    const result = capabilityToActionType("browser.navigate");

    // Assert
    expect(result).toBe("BROWSER_OPEN_URL");
  });

  it("'browser.download' Capability는 'BROWSER_DOWNLOAD' ActionType을 반환해야 한다", () => {
    // Arrange & Act
    const result = capabilityToActionType("browser.download");

    // Assert
    expect(result).toBe("BROWSER_DOWNLOAD");
  });

  it("'unknown.cap' 미등록 Capability는 undefined를 반환해야 한다", () => {
    // Arrange & Act
    const result = capabilityToActionType("unknown.cap");

    // Assert
    expect(result).toBeUndefined();
  });

  it("빈 문자열은 undefined를 반환해야 한다", () => {
    // Arrange & Act
    const result = capabilityToActionType("");

    // Assert
    expect(result).toBeUndefined();
  });
});

// ──────────────────────────────────────────────
// actionTypeToCapability 테스트
// ──────────────────────────────────────────────
describe("actionTypeToCapability", () => {
  it("'FS_READ' ActionType은 'fs.read' Capability를 반환해야 한다", () => {
    // Arrange & Act
    const result = actionTypeToCapability("FS_READ");

    // Assert
    expect(result).toBe("fs.read");
  });

  it("'FS_WRITE' ActionType은 'fs.write' Capability를 반환해야 한다", () => {
    // Arrange & Act
    const result = actionTypeToCapability("FS_WRITE");

    // Assert
    expect(result).toBe("fs.write");
  });

  it("'EXEC_RUN' ActionType은 'exec.run' Capability를 반환해야 한다", () => {
    // Arrange & Act
    const result = actionTypeToCapability("EXEC_RUN");

    // Assert
    expect(result).toBe("exec.run");
  });

  it("'APP_LAUNCH' ActionType은 'app.launch' Capability를 반환해야 한다", () => {
    // Arrange & Act
    const result = actionTypeToCapability("APP_LAUNCH");

    // Assert
    expect(result).toBe("app.launch");
  });

  it("'BROWSER_OPEN_URL' ActionType은 'browser.navigate' Capability를 반환해야 한다", () => {
    // Arrange & Act
    const result = actionTypeToCapability("BROWSER_OPEN_URL");

    // Assert
    expect(result).toBe("browser.navigate");
  });

  it("'MOBILE_SMS_SEND' — CAPABILITY_TO_ACTION 맵에 없는 ActionType은 undefined를 반환해야 한다", () => {
    // Arrange & Act — MOBILE_SMS_SEND는 CAPABILITY_TO_ACTION에 역방향 매핑 없음
    const result = actionTypeToCapability("MOBILE_SMS_SEND");

    // Assert
    expect(result).toBeUndefined();
  });

  it("'FS_LIST' — CAPABILITY_TO_ACTION 값으로 등록되지 않은 ActionType은 undefined를 반환해야 한다", () => {
    // Arrange & Act — FS_LIST는 CAPABILITY_TO_ACTION 값에 없음
    const result = actionTypeToCapability("FS_LIST");

    // Assert
    expect(result).toBeUndefined();
  });

  it("'BROWSER_DOWNLOAD' ActionType은 'browser.download' Capability를 반환해야 한다", () => {
    // Arrange & Act
    const result = actionTypeToCapability("BROWSER_DOWNLOAD");

    // Assert
    expect(result).toBe("browser.download");
  });
});

// ──────────────────────────────────────────────
// getActionCategory 테스트
// ──────────────────────────────────────────────
describe("getActionCategory", () => {
  it("FS_READ는 'FILE' 카테고리를 반환해야 한다", () => {
    // Arrange & Act
    const result = getActionCategory("FS_READ");

    // Assert
    expect(result).toBe("FILE");
  });

  it("FS_WRITE는 'FILE' 카테고리를 반환해야 한다", () => {
    // Arrange & Act
    const result = getActionCategory("FS_WRITE");

    // Assert
    expect(result).toBe("FILE");
  });

  it("FS_LIST는 'FILE' 카테고리를 반환해야 한다", () => {
    // Arrange & Act
    const result = getActionCategory("FS_LIST");

    // Assert
    expect(result).toBe("FILE");
  });

  it("FS_DELETE는 'FILE' 카테고리를 반환해야 한다", () => {
    // Arrange & Act
    const result = getActionCategory("FS_DELETE");

    // Assert
    expect(result).toBe("FILE");
  });

  it("EXEC_RUN은 'PROCESS' 카테고리를 반환해야 한다", () => {
    // Arrange & Act
    const result = getActionCategory("EXEC_RUN");

    // Assert
    expect(result).toBe("PROCESS");
  });

  it("PROCESS_KILL은 'PROCESS' 카테고리를 반환해야 한다", () => {
    // Arrange & Act
    const result = getActionCategory("PROCESS_KILL");

    // Assert
    expect(result).toBe("PROCESS");
  });

  it("APP_LAUNCH는 'APP' 카테고리를 반환해야 한다", () => {
    // Arrange & Act
    const result = getActionCategory("APP_LAUNCH");

    // Assert
    expect(result).toBe("APP");
  });

  it("WINDOW_CLICK는 'APP' 카테고리를 반환해야 한다", () => {
    // Arrange & Act
    const result = getActionCategory("WINDOW_CLICK");

    // Assert
    expect(result).toBe("APP");
  });

  it("BROWSER_OPEN_URL는 'BROWSER' 카테고리를 반환해야 한다", () => {
    // Arrange & Act
    const result = getActionCategory("BROWSER_OPEN_URL");

    // Assert
    expect(result).toBe("BROWSER");
  });

  it("BROWSER_DOWNLOAD는 'BROWSER' 카테고리를 반환해야 한다", () => {
    // Arrange & Act
    const result = getActionCategory("BROWSER_DOWNLOAD");

    // Assert
    expect(result).toBe("BROWSER");
  });

  it("MOBILE_SMS_SEND는 'MOBILE' 카테고리를 반환해야 한다", () => {
    // Arrange & Act
    const result = getActionCategory("MOBILE_SMS_SEND");

    // Assert
    expect(result).toBe("MOBILE");
  });

  it("MOBILE_CALL_DIAL은 'MOBILE' 카테고리를 반환해야 한다", () => {
    // Arrange & Act
    const result = getActionCategory("MOBILE_CALL_DIAL");

    // Assert
    expect(result).toBe("MOBILE");
  });

  it("MOBILE_MESSENGER_SEND는 'MOBILE' 카테고리를 반환해야 한다", () => {
    // Arrange & Act
    const result = getActionCategory("MOBILE_MESSENGER_SEND");

    // Assert
    expect(result).toBe("MOBILE");
  });

  it("MOBILE_NOTIFICATION_READ는 'MOBILE' 카테고리를 반환해야 한다", () => {
    // Arrange & Act
    const result = getActionCategory("MOBILE_NOTIFICATION_READ");

    // Assert
    expect(result).toBe("MOBILE");
  });
});
