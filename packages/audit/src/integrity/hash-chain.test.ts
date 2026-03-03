// 해시 체인 무결성 단위 테스트
import { describe, it, expect } from "vitest";
import { computeNextHash, validateEntryHash, getGenesisHash } from "./hash-chain.js";
import { computeAuditHash, GENESIS_HASH } from "@jarvis/shared";

describe("computeNextHash()", () => {
  it("should return a 64-character hex hash", () => {
    // Arrange
    const entryJson = '{"id":"entry-1"}';
    const prevHash = GENESIS_HASH;

    // Act
    const result = computeNextHash(entryJson, prevHash);

    // Assert
    expect(result).toHaveLength(64);
    expect(result).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should be deterministic for same inputs", () => {
    // Arrange
    const entryJson = '{"id":"entry-1"}';
    const prevHash = GENESIS_HASH;

    // Act
    const h1 = computeNextHash(entryJson, prevHash);
    const h2 = computeNextHash(entryJson, prevHash);

    // Assert
    expect(h1).toBe(h2);
  });

  it("should produce different hash when entryJson differs", () => {
    // Arrange
    const prevHash = GENESIS_HASH;

    // Act
    const h1 = computeNextHash('{"id":"entry-1"}', prevHash);
    const h2 = computeNextHash('{"id":"entry-2"}', prevHash);

    // Assert
    expect(h1).not.toBe(h2);
  });

  it("should produce different hash when previousHash differs", () => {
    // Arrange
    const entryJson = '{"id":"entry-1"}';

    // Act
    const h1 = computeNextHash(entryJson, "prevhash_a");
    const h2 = computeNextHash(entryJson, "prevhash_b");

    // Assert
    expect(h1).not.toBe(h2);
  });

  it("should match computeAuditHash from shared", () => {
    // Arrange
    const entryJson = '{"test":true}';
    const prevHash = "some_previous_hash";

    // Act
    const result = computeNextHash(entryJson, prevHash);
    const expected = computeAuditHash(entryJson, prevHash);

    // Assert
    expect(result).toBe(expected);
  });
});

describe("validateEntryHash()", () => {
  it("should return true when hash matches computed value", () => {
    // Arrange
    const entryJson = '{"id":"entry-1"}';
    const prevHash = GENESIS_HASH;
    const correctHash = computeAuditHash(entryJson, prevHash);

    // Act
    const result = validateEntryHash(entryJson, prevHash, correctHash);

    // Assert
    expect(result).toBe(true);
  });

  it("should return false when hash does not match", () => {
    // Arrange
    const entryJson = '{"id":"entry-1"}';
    const prevHash = GENESIS_HASH;
    const wrongHash = "0000000000000000000000000000000000000000000000000000000000000000";

    // Act
    const result = validateEntryHash(entryJson, prevHash, wrongHash);

    // Assert
    expect(result).toBe(false);
  });

  it("should return false when entryJson is tampered", () => {
    // Arrange
    const originalEntry = '{"id":"entry-1","action":"read"}';
    const tamperedEntry = '{"id":"entry-1","action":"write"}';
    const prevHash = GENESIS_HASH;
    const originalHash = computeAuditHash(originalEntry, prevHash);

    // Act — 변조된 엔트리로 검증
    const result = validateEntryHash(tamperedEntry, prevHash, originalHash);

    // Assert
    expect(result).toBe(false);
  });

  it("should return false when previousHash is tampered", () => {
    // Arrange
    const entryJson = '{"id":"entry-1"}';
    const correctPrevHash = GENESIS_HASH;
    const wrongPrevHash = "wrongprevhash";
    const hash = computeAuditHash(entryJson, correctPrevHash);

    // Act — 잘못된 이전 해시로 검증
    const result = validateEntryHash(entryJson, wrongPrevHash, hash);

    // Assert
    expect(result).toBe(false);
  });

  it("should return true for genesis-linked first entry", () => {
    // Arrange
    const entryJson = '{"id":"first-entry"}';
    const hash = computeAuditHash(entryJson, GENESIS_HASH);

    // Act
    const result = validateEntryHash(entryJson, GENESIS_HASH, hash);

    // Assert
    expect(result).toBe(true);
  });
});

describe("getGenesisHash()", () => {
  it("should return a valid 64-character hex string", () => {
    // Act
    const genesis = getGenesisHash();

    // Assert
    expect(genesis).toHaveLength(64);
    expect(genesis).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should match GENESIS_HASH from shared", () => {
    // Act
    const result = getGenesisHash();

    // Assert
    expect(result).toBe(GENESIS_HASH);
  });

  it("should be deterministic across calls", () => {
    // Act
    const g1 = getGenesisHash();
    const g2 = getGenesisHash();

    // Assert
    expect(g1).toBe(g2);
  });
});
