import { describe, it, expect } from "vitest";
import { hasPermission, hashPassword, verifyPassword } from "@/lib/security";

describe("hasPermission", () => {
  it("admin has all permissions (hard guard, no DB needed)", async () => {
    expect(await hasPermission("admin", "read")).toBe(true);
    expect(await hasPermission("admin", "write")).toBe(true);
    expect(await hasPermission("admin", "delete")).toBe(true);
    expect(await hasPermission("admin", "admin")).toBe(true);
  });

  it("staff has read and write but not delete or admin (fallback path)", async () => {
    expect(await hasPermission("staff", "read")).toBe(true);
    expect(await hasPermission("staff", "write")).toBe(true);
    expect(await hasPermission("staff", "delete")).toBe(false);
    expect(await hasPermission("staff", "admin")).toBe(false);
  });

  it("viewer has read only (fallback path)", async () => {
    expect(await hasPermission("viewer", "read")).toBe(true);
    expect(await hasPermission("viewer", "write")).toBe(false);
    expect(await hasPermission("viewer", "delete")).toBe(false);
  });

  it("returns false for unknown roles", async () => {
    expect(await hasPermission("guest", "read")).toBe(false);
  });

  it("returns false for unknown permissions", async () => {
    // @ts-expect-error intentionally invalid permission to test the runtime guard
    expect(await hasPermission("admin", "unknown")).toBe(false);
  });
});

describe("hashPassword", () => {
  it("hashes a password with scrypt format", async () => {
    const hash = await hashPassword("mypassword123");
    expect(hash).toContain("scrypt$");
    const [algo, salt, derived] = hash.split("$");
    expect(algo).toBe("scrypt");
    expect(salt).toHaveLength(32); // 16 bytes hex = 32 chars
    expect(derived).toHaveLength(128); // 64 bytes hex = 128 chars
  });

  it("rejects passwords shorter than 10 characters", async () => {
    await expect(hashPassword("short")).rejects.toThrow("密码至少需要 10 个字符");
  });

  it("produces different hashes for the same password", async () => {
    const h1 = await hashPassword("mypassword123");
    const h2 = await hashPassword("mypassword123");
    expect(h1).not.toBe(h2); // Different salts
  });

  it("throws on non-string input", async () => {
    await expect(hashPassword(null as unknown as string)).rejects.toThrow();
  });
});

describe("verifyPassword", () => {
  it("verifies a correct password", async () => {
    const hash = await hashPassword("correctpassword");
    const result = await verifyPassword("correctpassword", hash);
    expect(result).toBe(true);
  });

  it("rejects an incorrect password", async () => {
    const hash = await hashPassword("correctpassword");
    const result = await verifyPassword("wrongpassword", hash);
    expect(result).toBe(false);
  });

  it("returns false for malformed hash", async () => {
    expect(await verifyPassword("any", "not-a-valid-hash")).toBe(false);
  });

  it("returns false for empty string hash", async () => {
    expect(await verifyPassword("any", "")).toBe(false);
  });
});
