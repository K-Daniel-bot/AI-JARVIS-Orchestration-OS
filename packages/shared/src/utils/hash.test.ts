// 해시 유틸리티 단위 테스트
import { describe, it, expect } from "vitest";
import { sha256, computeAuditHash, GENESIS_HASH } from "./hash.js";

describe("sha256()", () => {
  it("should return 64-character hex string", () => {
    const hash = sha256("hello");
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should be deterministic", () => {
    expect(sha256("test")).toBe(sha256("test"));
  });

  it("should produce different hashes for different inputs", () => {
    expect(sha256("a")).not.toBe(sha256("b"));
  });

  it("should match known SHA-256 value", () => {
    // SHA-256("hello") = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
    expect(sha256("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });

  it("should handle empty string", () => {
    const hash = sha256("");
    expect(hash).toHaveLength(64);
    // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
    expect(hash).toBe(
      "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
    );
  });
});

describe("computeAuditHash()", () => {
  it("should compute hash from entry and previous hash", () => {
    const hash = computeAuditHash('{"id":"1"}', GENESIS_HASH);
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should be deterministic", () => {
    const h1 = computeAuditHash('{"id":"1"}', "abc");
    const h2 = computeAuditHash('{"id":"1"}', "abc");
    expect(h1).toBe(h2);
  });

  it("should produce different hash for different previous hash", () => {
    const h1 = computeAuditHash('{"id":"1"}', "hash_a");
    const h2 = computeAuditHash('{"id":"1"}', "hash_b");
    expect(h1).not.toBe(h2);
  });

  it("should produce different hash for different entry", () => {
    const h1 = computeAuditHash('{"id":"1"}', GENESIS_HASH);
    const h2 = computeAuditHash('{"id":"2"}', GENESIS_HASH);
    expect(h1).not.toBe(h2);
  });

  it("should use format previousHash:entryJson", () => {
    const entry = '{"test":true}';
    const prev = "prevhash";
    const expected = sha256(`${prev}:${entry}`);
    expect(computeAuditHash(entry, prev)).toBe(expected);
  });
});

describe("GENESIS_HASH", () => {
  it("should be a valid SHA-256 hash", () => {
    expect(GENESIS_HASH).toHaveLength(64);
    expect(GENESIS_HASH).toMatch(/^[a-f0-9]{64}$/);
  });

  it("should be deterministic", () => {
    expect(GENESIS_HASH).toBe(sha256("JARVIS_OS_GENESIS_BLOCK"));
  });
});
