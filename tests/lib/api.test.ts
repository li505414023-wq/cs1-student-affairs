import { describe, it, expect, vi } from "vitest";

// Mock the db module
vi.mock("@/db", () => ({
  getDb: vi.fn(() => ({
    insert: vi.fn(() => ({ values: vi.fn() })),
  })),
}));

// Mock the db schema
vi.mock("@/db/schema", () => ({
  auditLogs: { _brand: "auditLogs" },
}));

describe("ApiError", () => {
  it("creates an error with status, message, and details", async () => {
    const { ApiError } = await import("@/lib/api");
    const error = new ApiError(400, "Bad request", { field: "name" });
    expect(error).toBeInstanceOf(Error);
    expect(error.status).toBe(400);
    expect(error.message).toBe("Bad request");
    expect(error.details).toEqual({ field: "name" });
  });

  it("creates an error without details", async () => {
    const { ApiError } = await import("@/lib/api");
    const error = new ApiError(500, "Server error");
    expect(error.status).toBe(500);
    expect(error.details).toBeUndefined();
  });
});

describe("ok", () => {
  it("returns a success response with data and status 200 by default", async () => {
    const { ok } = await import("@/lib/api");
    const response = ok({ items: [1, 2, 3] });
    const body = await response.json() as { success: boolean; data?: unknown; error?: string; details?: unknown };
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ items: [1, 2, 3] });
    expect(response.status).toBe(200);
  });

  it("respects custom status code", async () => {
    const { ok } = await import("@/lib/api");
    const response = ok({ id: "123" }, 201);
    const body = await response.json() as { success: boolean; data?: unknown; error?: string; details?: unknown };
    expect(body.success).toBe(true);
    expect(response.status).toBe(201);
  });

  it("handles null data", async () => {
    const { ok } = await import("@/lib/api");
    const response = ok(null);
    const body = await response.json() as { success: boolean; data?: unknown; error?: string; details?: unknown };
    expect(body.success).toBe(true);
    expect(body.data).toBeNull();
  });
});

describe("fail", () => {
  it("returns error response with ApiError status and message", async () => {
    const { ApiError, fail } = await import("@/lib/api");
    const error = new ApiError(422, "Validation failed", ["name required"]);
    const response = fail(error);
    const body = await response.json() as { success: boolean; data?: unknown; error?: string; details?: unknown };
    expect(body.success).toBe(false);
    expect(body.error).toBe("Validation failed");
    expect(body.details).toEqual(["name required"]);
    expect(response.status).toBe(422);
  });

  it("returns 500 with generic message for non-ApiError errors", async () => {
    const { fail } = await import("@/lib/api");
    const error = new Error("Unexpected crash");
    const response = fail(error);
    const body = await response.json() as { success: boolean; data?: unknown; error?: string; details?: unknown };
    expect(body.success).toBe(false);
    expect(body.error).toBe("服务器处理请求失败");
    expect(response.status).toBe(500);
  });
});

describe("readJson", () => {
  it("parses valid JSON object", async () => {
    const { readJson } = await import("@/lib/api");
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify({ name: "test" }),
    });
    const result = await readJson(request);
    expect(result).toEqual({ name: "test" });
  });

  it("throws ApiError 400 for invalid JSON", async () => {
    const { readJson } = await import("@/lib/api");
    const request = new Request("http://localhost", {
      method: "POST",
      body: "not-json",
    });
    try {
      await readJson(request);
      expect.fail("Should have thrown");
    } catch (error: unknown) {
      const apiError = error as { status: number; message: string };
      expect(apiError.status).toBe(400);
      expect(apiError.message).toContain("JSON");
    }
  });

  it("throws ApiError 400 for JSON arrays", async () => {
    const { readJson } = await import("@/lib/api");
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify([1, 2, 3]),
    });
    try {
      await readJson(request);
      expect.fail("Should have thrown");
    } catch (error: unknown) {
      const apiError = error as { status: number };
      expect(apiError.status).toBe(400);
    }
  });

  it("throws ApiError 400 for JSON primitives", async () => {
    const { readJson } = await import("@/lib/api");
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify("string"),
    });
    try {
      await readJson(request);
      expect.fail("Should have thrown");
    } catch (error: unknown) {
      const apiError = error as { status: number };
      expect(apiError.status).toBe(400);
    }
  });

  it("throws ApiError 400 for null body", async () => {
    const { readJson } = await import("@/lib/api");
    const request = new Request("http://localhost", {
      method: "POST",
      body: JSON.stringify(null),
    });
    try {
      await readJson(request);
      expect.fail("Should have thrown");
    } catch (error: unknown) {
      const apiError = error as { status: number };
      expect(apiError.status).toBe(400);
    }
  });
});

describe("requestIp", () => {
  it("uses the last (nearest-proxy) hop of x-forwarded-for, not the spoofable first", async () => {
    const { requestIp } = await import("@/lib/api");
    const request = new Request("http://localhost", {
      headers: { "x-forwarded-for": "192.168.1.1, 10.0.0.1" },
    });
    expect(requestIp(request)).toBe("10.0.0.1");
  });

  it("falls back to x-real-ip when x-forwarded-for is missing", async () => {
    const { requestIp } = await import("@/lib/api");
    const request = new Request("http://localhost", {
      headers: { "x-real-ip": "10.0.0.1" },
    });
    expect(requestIp(request)).toBe("10.0.0.1");
  });

  it("returns 'local' when no IP headers are present", async () => {
    const { requestIp } = await import("@/lib/api");
    const request = new Request("http://localhost");
    expect(requestIp(request)).toBe("local");
  });

  it("prefers x-real-ip (proxy-set, unforgeable) over x-forwarded-for", async () => {
    const { requestIp } = await import("@/lib/api");
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "spoofed.by.client",
        "x-real-ip": "1.2.3.4",
      },
    });
    expect(requestIp(request)).toBe("1.2.3.4");
  });
});

describe("writeAudit", () => {
  it("calls getDb().insert() with audit log data", async () => {
    const insertMock = vi.fn().mockReturnValue({ values: vi.fn() });
    const mockDb = { insert: insertMock };
    vi.mocked((await import("@/db")).getDb).mockReturnValue(mockDb as never);

    const { writeAudit } = await import("@/lib/api");
    await writeAudit({
      userId: "user-1",
      action: "login",
      resourceType: "session",
      resourceId: "session-1",
      detail: { browser: "Chrome" },
      ip: "192.168.1.1",
    });

    expect(insertMock).toHaveBeenCalled();
  });
});
