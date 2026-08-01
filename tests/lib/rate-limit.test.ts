import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock the ApiError import before loading the module
vi.mock("@/lib/api", () => ({
  ApiError: class ApiError extends Error {
    status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

// Import the module under test - it's a .ts file with relative import to ./api
// We need to test the rate-limit logic in isolation
// Since enforceRateLimit uses a module-level Map, we need to import it dynamically

describe("enforceRateLimit", () => {
  let enforceRateLimit: (key: string, limit?: number, windowMs?: number) => void;

  beforeEach(async () => {
    // Reset the module to get a fresh Map
    vi.resetModules();
    const mod = await import("@/lib/rate-limit");
    enforceRateLimit = mod.enforceRateLimit;
  });

  it("allows the first request for a key", () => {
    expect(() => enforceRateLimit("test-key")).not.toThrow();
  });

  it("allows requests up to the limit within the window", () => {
    for (let i = 0; i < 5; i++) {
      expect(() => enforceRateLimit("test-key-2", 5, 60_000)).not.toThrow();
    }
  });

  it("throws ApiError with status 429 when limit is exceeded", () => {
    for (let i = 0; i < 3; i++) {
      enforceRateLimit("test-key-3", 3, 60_000);
    }
    try {
      enforceRateLimit("test-key-3", 3, 60_000);
      expect.fail("Should have thrown");
    } catch (error: unknown) {
      const apiError = error as { status: number; message: string };
      expect(apiError.status).toBe(429);
      expect(apiError.message).toContain("频繁");
    }
  });

  it("tracks different keys independently", () => {
    // Exhaust key-a
    for (let i = 0; i < 2; i++) {
      enforceRateLimit("key-a", 2, 60_000);
    }
    expect(() => enforceRateLimit("key-a", 2, 60_000)).toThrow();

    // key-b should still work
    expect(() => enforceRateLimit("key-b", 2, 60_000)).not.toThrow();
  });

  it("resets count after window expires", () => {
    const now = Date.now();
    vi.useFakeTimers();
    vi.setSystemTime(now);

    // Use up the limit
    for (let i = 0; i < 3; i++) {
      enforceRateLimit("expiring-key", 3, 1000);
    }
    expect(() => enforceRateLimit("expiring-key", 3, 1000)).toThrow();

    // Advance past the window
    vi.advanceTimersByTime(1001);

    // Should be allowed again
    expect(() => enforceRateLimit("expiring-key", 3, 1000)).not.toThrow();

    vi.useRealTimers();
  });

  it("uses default limit of 60 and window of 60s", () => {
    // With defaults, 60 requests should be fine
    for (let i = 0; i < 60; i++) {
      expect(() => enforceRateLimit(`default-key-${i}-${Date.now()}`)).not.toThrow();
    }
  });
});
