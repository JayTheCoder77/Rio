import { describe, expect, it } from "vitest";
import { createHash } from "crypto";
import { generateApiKey, hashApiKey, keySuffix } from "@/lib/api-keys";

describe("api-keys", () => {
  it("generates a rio_-prefixed key", () => {
    const { plaintext } = generateApiKey();
    expect(plaintext.startsWith("rio_")).toBe(true);
    expect(plaintext.length).toBeGreaterThan("rio_".length + 32);
  });

  it("returns the sha256 hash of the plaintext", () => {
    const { plaintext, hash } = generateApiKey();
    const expected = createHash("sha256").update(plaintext).digest("hex");
    expect(hash).toBe(expected);
  });

  it("hashApiKey is deterministic and length 64", () => {
    expect(hashApiKey("abc")).toBe(hashApiKey("abc"));
    expect(hashApiKey("abc")).toHaveLength(64);
    expect(hashApiKey("abc")).not.toBe(hashApiKey("abd"));
  });

  it("keySuffix returns last 4 chars", () => {
    expect(keySuffix("rio_abcdefgh")).toBe("efgh");
  });
});