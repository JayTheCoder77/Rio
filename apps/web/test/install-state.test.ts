import { describe, expect, it } from "vitest";
import { createInstallState, verifyInstallState } from "@/lib/install-state";

const SECRET = process.env.AUTH_SECRET ?? "test-secret-at-least-32-chars-long!!";

describe("install-state", () => {
  it("creates a token that verifies to the user id", async () => {
    const token = await createInstallState("user-123");
    expect(token.split(".")).toHaveLength(3);
    expect(await verifyInstallState(token)).toBe("user-123");
  });

  it("rejects a tampered token", async () => {
    const token = await createInstallState("user-123");
    const [h, p, s] = token.split(".");
    const tampered = [h, p + "x", s].join(".");
    expect(await verifyInstallState(tampered)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const { SignJWT } = await import("jose");
    const otherSecret = new TextEncoder().encode("different-secret-value-32-chars!!");
    const token = await new SignJWT({ userId: "user-123" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("10m")
      .sign(otherSecret);
    expect(await verifyInstallState(token)).toBeNull();
  });

  it("rejects garbage input", async () => {
    expect(await verifyInstallState("not-a-jwt")).toBeNull();
  });
});

describe("install-state expiry", () => {
  it("rejects an expired token", async () => {
    // Build an already-expired token by signing directly with the same secret
    // the module under test uses.
    const { SignJWT } = await import("jose");
    const secret = new TextEncoder().encode(SECRET);
    const token = await new SignJWT({ userId: "u-1" })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("-1s")
      .sign(secret);
    expect(await verifyInstallState(token)).toBeNull();
  });
});