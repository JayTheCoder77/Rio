import { randomBytes, createHash } from "crypto";

const KEY_PREFIX = "rio_";

/**
 * Generates a new API key. Returns the plaintext key (shown to the user
 * exactly once) and its SHA-256 hash (the only thing persisted).
 */
export function generateApiKey(): { plaintext: string; hash: string } {
  const raw = randomBytes(32).toString("base64url");
  const plaintext = `${KEY_PREFIX}${raw}`;
  const hash = createHash("sha256").update(plaintext).digest("hex");
  return { plaintext, hash };
}

export function hashApiKey(plaintext: string): string {
  return createHash("sha256").update(plaintext).digest("hex");
}

/** Last 4 chars of the plaintext key, safe to display for identification. */
export function keySuffix(plaintext: string): string {
  return plaintext.slice(-4);
}
