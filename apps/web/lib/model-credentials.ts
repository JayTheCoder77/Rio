import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * AES-256-GCM encryption for the user's BYOK provider API key
 * (`users.model_api_key_encrypted`). Written here (dashboard save), read and
 * decrypted in `ai-engine` (Python) per-request to build the LLM client —
 * both sides must agree on the wire format and the key derivation, see
 * `services/ai-engine/app/crypto.py` for the mirror implementation.
 *
 * Wire format: base64(iv[12 bytes] || ciphertext || authTag[16 bytes]).
 * A single self-contained string, safe to store directly in one text column.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY is not set. Generate one with `openssl rand -base64 32` " +
      "and set it as a real secret — never commit it to the repo."
    );
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(
      `ENCRYPTION_KEY must decode to 32 bytes for AES-256 (got ${key.length}). ` +
      "Generate one with `openssl rand -base64 32`."
    );
  }
  return key;
}

export function encryptProviderKey(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, ciphertext, authTag]).toString("base64");
}

export function decryptProviderKey(encoded: string): string {
  const key = getKey();
  const raw = Buffer.from(encoded, "base64");
  const iv = raw.subarray(0, IV_LENGTH);
  const authTag = raw.subarray(raw.length - AUTH_TAG_LENGTH);
  const ciphertext = raw.subarray(IV_LENGTH, raw.length - AUTH_TAG_LENGTH);

  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

/** Last 4 chars of the plaintext provider key, safe to display for identification. */
export function providerKeySuffix(plaintext: string): string {
  return plaintext.slice(-4);
}
