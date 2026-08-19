import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  decryptProviderKey,
  encryptProviderKey,
  providerKeySuffix,
} from "@/lib/model-credentials";

const KEY = Buffer.from("x".repeat(32)).toString("base64");
const OLD_KEY = process.env.ENCRYPTION_KEY;

const PYTHON = path.resolve(__dirname, "../../../.venv/bin/python");
const AI_ENGINE = path.resolve(__dirname, "../../../services/ai-engine");

beforeAll(() => {
  process.env.ENCRYPTION_KEY = KEY;
});

afterAll(() => {
  if (OLD_KEY === undefined) delete process.env.ENCRYPTION_KEY;
  else process.env.ENCRYPTION_KEY = OLD_KEY;
});

describe("model-credentials", () => {
  it("round-trips through encrypt/decrypt", () => {
    const secret = "sk-or-v1-abcdef123456";
    const encoded = encryptProviderKey(secret);
    expect(encoded).not.toBe(secret);
    expect(decryptProviderKey(encoded)).toBe(secret);
  });

  it("encrypts with random IV (same input differs)", () => {
    const a = encryptProviderKey("same");
    const b = encryptProviderKey("same");
    expect(a).not.toBe(b);
  });

  it("providerKeySuffix returns last 4 chars", () => {
    expect(providerKeySuffix("sk-or-v1-abcdef")).toBe("cdef");
  });

  it("rejects a tampered ciphertext", () => {
    const encoded = encryptProviderKey("secret");
    const corrupted = (encoded[0] === "A" ? "B" : "A") + encoded.slice(1);
    expect(() => decryptProviderKey(corrupted)).toThrow();
  });
});

// Cross-language contract: the wire format base64(iv || ciphertext || tag)
// must be byte-compatible between Node (dashboard writes) and Python
// (ai-engine reads). This codifies the manual round-trip verification.
// Skipped in CI's js job, which has no Python venv; the ai-engine crypto is
// still covered by the python job's pytest suite.
describe.skipIf(!fs.existsSync(PYTHON))("crypto cross-language roundtrip", () => {
  const PY_SCRIPT = `
import base64, os, sys
sys.path.insert(0, "${AI_ENGINE}")
os.environ["ENCRYPTION_KEY"] = os.environ["TS_ENCRYPTION_KEY"]
from app.crypto import decrypt_provider_key, encrypt_provider_key
cmd = sys.argv[1]
if cmd == "decrypt":
    print(decrypt_provider_key(sys.argv[2]))
elif cmd == "encrypt":
    print(encrypt_provider_key(sys.argv[2]))
`;

  it("Python can decrypt what Node encrypted", () => {
    const plaintext = "sk-or-v1-from-node";
    const nodeEncrypted = encryptProviderKey(plaintext);
    const out = execFileSync(PYTHON, ["-c", PY_SCRIPT, "decrypt", nodeEncrypted], {
      env: { ...process.env, TS_ENCRYPTION_KEY: KEY },
      encoding: "utf8",
    }).trim();
    expect(out).toBe(plaintext);
  });

  it("Node can decrypt what Python encrypted", () => {
    const plaintext = "sk-or-v1-from-python";
    const out = execFileSync(PYTHON, ["-c", PY_SCRIPT, "encrypt", plaintext], {
      env: { ...process.env, TS_ENCRYPTION_KEY: KEY },
      encoding: "utf8",
    }).trim();
    expect(decryptProviderKey(out)).toBe(plaintext);
  });
});