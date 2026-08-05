import { describe, it, expect, vi } from "vitest";

// Mock db BEFORE any imports that use it
const mockDb = {
  insert: vi.fn(() => ({ values: vi.fn() })),
  select: vi.fn(() => ({ from: vi.fn(() => ({ innerJoin: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => [] as unknown[]) })) })) })) })),
  update: vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn() })) })),
  delete: vi.fn(() => ({ where: vi.fn() })),
};

vi.mock("@/db", () => ({
  getDb: vi.fn(() => mockDb),
}));

vi.mock("@/db/schema", () => ({
  sessions: { _brand: "sessions" },
  users: { _brand: "users" },
}));

describe("SESSION_COOKIE constant", () => {
  it("is 'xg_session'", async () => {
    const { SESSION_COOKIE } = await import("@/lib/auth");
    expect(SESSION_COOKIE).toBe("xg_session");
  });
});

describe("setSessionCookie", () => {
  it("configures cookie with httpOnly, sameSite strict, and path /", async () => {
    const { setSessionCookie } = await import("@/lib/auth");
    const cookiesSet = vi.fn();
    const mockResponse = { cookies: { set: cookiesSet } } as unknown as import("next/server").NextResponse;
    const expiresAt = new Date("2026-07-21T00:00:00Z");

    setSessionCookie(mockResponse, "test-token", expiresAt);

    expect(cookiesSet).toHaveBeenCalledWith("xg_session", "test-token", {
      httpOnly: true,
      sameSite: "strict",
      secure: expect.any(Boolean),
      path: "/",
      expires: expiresAt,
    });
  });

  it("sets secure=true in production", async () => {
    const { setSessionCookie } = await import("@/lib/auth");
    vi.stubEnv("NODE_ENV", "production");
    const cookiesSet = vi.fn();
    const mockResponse = { cookies: { set: cookiesSet } } as unknown as import("next/server").NextResponse;

    setSessionCookie(mockResponse, "token", new Date());

    expect(cookiesSet).toHaveBeenCalledWith("xg_session", "token", expect.objectContaining({ secure: true }));
    vi.unstubAllEnvs();
  });
});

describe("clearSessionCookie", () => {
  it("clears the session cookie with maxAge 0 and secure flag", async () => {
    const { clearSessionCookie } = await import("@/lib/auth");
    const cookiesSet = vi.fn();
    const mockResponse = { cookies: { set: cookiesSet } } as unknown as import("next/server").NextResponse;

    clearSessionCookie(mockResponse);

    expect(cookiesSet).toHaveBeenCalledWith("xg_session", "", {
      httpOnly: true,
      sameSite: "strict",
      secure: expect.any(Boolean),
      path: "/",
      maxAge: 0,
    });
  });
});

describe("validateCsrf", () => {
  it("rejects a missing CSRF token", async () => {
    const { validateCsrf } = await import("@/lib/auth");
    const { ApiError: ApiErrorClass } = await import("@/lib/api");
    const request = { headers: { get: () => null } } as unknown as import("next/server").NextRequest;
    const session = { id: "s1", csrfToken: "token-abc", expiresAt: new Date(), user: { id: "u1", username: "u", displayName: "u", role: "staff", roleTags: [] } };
    expect(() => validateCsrf(request, session)).toThrowError(ApiErrorClass);
  });

  it("rejects a mismatched CSRF token", async () => {
    const { validateCsrf } = await import("@/lib/auth");
    const { ApiError: ApiErrorClass } = await import("@/lib/api");
    const request = { headers: { get: () => "wrong-token" } } as unknown as import("next/server").NextRequest;
    const session = { id: "s1", csrfToken: "token-abc", expiresAt: new Date(), user: { id: "u1", username: "u", displayName: "u", role: "staff", roleTags: [] } };
    expect(() => validateCsrf(request, session)).toThrowError(ApiErrorClass);
  });

  it("passes with a matching token", async () => {
    const { validateCsrf } = await import("@/lib/auth");
    const request = { headers: { get: () => "token-abc" } } as unknown as import("next/server").NextRequest;
    const session = { id: "s1", csrfToken: "token-abc", expiresAt: new Date(), user: { id: "u2", username: "u", displayName: "u", role: "staff", roleTags: [] } };
    expect(() => validateCsrf(request, session)).not.toThrow();
  });

  it("enforces the per-user write rate limit (429 after 120 writes/min)", async () => {
    const { validateCsrf } = await import("@/lib/auth");
    const request = { headers: { get: () => "token-abc" } } as unknown as import("next/server").NextRequest;
    const session = { id: "s1", csrfToken: "token-abc", expiresAt: new Date(), user: { id: "u-rate-limited", username: "u", displayName: "u", role: "staff", roleTags: [] } };

    for (let i = 0; i < 120; i++) {
      expect(() => validateCsrf(request, session)).not.toThrow();
    }
    try {
      validateCsrf(request, session);
      expect.unreachable("expected rate limit to trigger");
    } catch (error) {
      expect((error as { status?: number }).status).toBe(429);
    }
  });
});

describe("createSession", () => {
  it("generates a token, csrfToken, and expiry", async () => {
    const { createSession } = await import("@/lib/auth");
    const result = await createSession("test-user-id");
    expect(result.token).toBeTruthy();
    expect(result.csrfToken).toBeTruthy();
    expect(result.expiresAt).toBeInstanceOf(Date);
    expect(typeof result.token).toBe("string");
    expect(result.token.length).toBeGreaterThan(32);
    expect(result.csrfToken.length).toBeGreaterThan(24);
    // Expiry should be 8 hours in the future
    const now = new Date();
    const diffMs = result.expiresAt.getTime() - now.getTime();
    expect(diffMs).toBeGreaterThan(7 * 60 * 60 * 1000); // at least 7 hours
    expect(diffMs).toBeLessThan(9 * 60 * 60 * 1000);    // at most 9 hours
  });
});

describe("getCurrentSession", () => {
  it("returns null when no cookie is present", async () => {
    const { getCurrentSession } = await import("@/lib/auth");
    const mockRequest = {
      cookies: { get: vi.fn(() => null) },
    } as unknown as import("next/server").NextRequest;

    const result = await getCurrentSession(mockRequest);
    expect(result).toBeNull();
  });
});

describe("validateCsrf", () => {
  it("throws ApiError 403 when x-csrf-token header is missing", async () => {
    const { validateCsrf } = await import("@/lib/auth");
    const mockRequest = {
      headers: { get: vi.fn(() => null) },
    } as unknown as import("next/server").NextRequest;
    const mockSession = { id: "s1", csrfToken: "valid-token", expiresAt: new Date(), user: { id: "u1", username: "admin", displayName: "Admin", role: "admin" as const, roleTags: ["管理员"] } };

    try {
      validateCsrf(mockRequest, mockSession);
      expect.fail("Should have thrown");
    } catch (error: unknown) {
      const apiError = error as { status: number };
      expect(apiError.status).toBe(403);
    }
  });

  it("throws ApiError 403 when CSRF token does not match", async () => {
    const { validateCsrf } = await import("@/lib/auth");
    const mockRequest = {
      headers: { get: vi.fn(() => "wrong-token") },
    } as unknown as import("next/server").NextRequest;
    const mockSession = { id: "s1", csrfToken: "correct-token", expiresAt: new Date(), user: { id: "u1", username: "admin", displayName: "Admin", role: "admin" as const, roleTags: ["管理员"] } };

    try {
      validateCsrf(mockRequest, mockSession);
      expect.fail("Should have thrown");
    } catch (error: unknown) {
      const apiError = error as { status: number };
      expect(apiError.status).toBe(403);
    }
  });

  it("passes silently when CSRF tokens match", async () => {
    const { validateCsrf } = await import("@/lib/auth");
    const mockRequest = {
      headers: { get: vi.fn(() => "match-token") },
    } as unknown as import("next/server").NextRequest;
    const mockSession = { id: "s1", csrfToken: "match-token", expiresAt: new Date(), user: { id: "u1", username: "admin", displayName: "Admin", role: "admin" as const, roleTags: ["管理员"] } };

    expect(() => validateCsrf(mockRequest, mockSession)).not.toThrow();
  });
});

describe("requirePermission", () => {
  it("throws ApiError 401 when no session exists", async () => {
    const { requirePermission } = await import("@/lib/auth");
    const mockRequest = {
      cookies: { get: vi.fn(() => null) },
    } as unknown as import("next/server").NextRequest;

    try {
      await requirePermission(mockRequest, "write");
      expect.fail("Should have thrown");
    } catch (error: unknown) {
      const apiError = error as { status: number; message: string };
      expect(apiError.status).toBe(401);
      expect(apiError.message).toContain("登录");
    }
  });
});

// Builds the select(...).from(...).innerJoin(...).where(...).limit(...) chain
// used by getCurrentSession, resolving to the given rows.
function selectChain(rows: unknown[]) {
  return {
    from: vi.fn(() => ({
      innerJoin: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(() => rows),
        })),
      })),
    })),
  };
}

function sessionRow(overrides: Record<string, unknown> = {}) {
  const now = Date.now();
  return {
    id: "s1",
    csrfToken: "csrf-1",
    expiresAt: new Date(now + 6 * 60 * 60 * 1000),
    createdAt: new Date(now - 60 * 60 * 1000),
    userId: "u1",
    username: "admin",
    displayName: "Admin",
    role: "admin",
    roleTags: [],
    active: true,
    ...overrides,
  };
}

function requestWithCookie() {
  return { cookies: { get: vi.fn(() => ({ value: "tok" })) } } as unknown as import("next/server").NextRequest;
}

describe("session absolute timeout", () => {
  it("rejects a session older than 7 days even if expiresAt is in the future", async () => {
    const { getCurrentSession } = await import("@/lib/auth");
    const now = Date.now();
    mockDb.select.mockReturnValueOnce(selectChain([sessionRow({
      createdAt: new Date(now - 8 * 24 * 60 * 60 * 1000),
      expiresAt: new Date(now + 6 * 60 * 60 * 1000),
    })]));

    const result = await getCurrentSession(requestWithCookie());
    expect(result).toBeNull();
    expect(mockDb.update).not.toHaveBeenCalled();
  });

  it("caps sliding renewal at the absolute 7-day deadline", async () => {
    const { getCurrentSession } = await import("@/lib/auth");
    const now = Date.now();
    const createdAt = new Date(now - (7 * 24 - 4) * 60 * 60 * 1000); // 4h left until absolute deadline
    const set = vi.fn((_patch: { lastSeenAt: Date; expiresAt: Date }) => ({ where: vi.fn() }));
    mockDb.update.mockReturnValueOnce({ set } as never);
    // Remaining lifetime (1h) < half of 8h → renewal is triggered.
    mockDb.select.mockReturnValueOnce(selectChain([sessionRow({
      createdAt,
      expiresAt: new Date(now + 1 * 60 * 60 * 1000),
    })]));

    const result = await getCurrentSession(requestWithCookie());
    expect(result).not.toBeNull();
    const absoluteDeadline = createdAt.getTime() + 7 * 24 * 60 * 60 * 1000;
    expect(result!.expiresAt.getTime()).toBe(absoluteDeadline);
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ expiresAt: expect.any(Date) }));
    const renewed = set.mock.calls[0][0].expiresAt as Date;
    expect(renewed.getTime()).toBe(absoluteDeadline);
  });

  it("renews normally when far from the absolute deadline", async () => {
    const { getCurrentSession } = await import("@/lib/auth");
    const now = Date.now();
    const set = vi.fn((_patch: { lastSeenAt: Date; expiresAt: Date }) => ({ where: vi.fn() }));
    mockDb.update.mockReturnValueOnce({ set } as never);
    mockDb.select.mockReturnValueOnce(selectChain([sessionRow({
      createdAt: new Date(now - 24 * 60 * 60 * 1000),
      expiresAt: new Date(now + 2 * 60 * 60 * 1000), // < 4h remaining → renew
    })]));

    const result = await getCurrentSession(requestWithCookie());
    expect(result).not.toBeNull();
    const renewed = set.mock.calls[0][0].expiresAt as Date;
    expect(renewed.getTime()).toBeGreaterThan(now + 7 * 60 * 60 * 1000);
    expect(renewed.getTime()).toBeLessThan(now + 9 * 60 * 60 * 1000);
  });
});

describe("CSRF constant-time comparison", () => {
  it("rejects a token with a different byte length", async () => {
    const { validateCsrf } = await import("@/lib/auth");
    const request = { headers: { get: () => "token-abc-much-longer" } } as unknown as import("next/server").NextRequest;
    const session = { id: "s1", csrfToken: "token-abc", expiresAt: new Date(), user: { id: "u-csrf-len", username: "u", displayName: "u", role: "staff", roleTags: [] } };
    expect(() => validateCsrf(request, session)).toThrowError((await import("@/lib/api")).ApiError);
  });

  it("rejects same-length but different tokens", async () => {
    const { validateCsrf } = await import("@/lib/auth");
    const request = { headers: { get: () => "token-xyz" } } as unknown as import("next/server").NextRequest;
    const session = { id: "s1", csrfToken: "token-abc", expiresAt: new Date(), user: { id: "u-csrf-diff", username: "u", displayName: "u", role: "staff", roleTags: [] } };
    expect(() => validateCsrf(request, session)).toThrowError((await import("@/lib/api")).ApiError);
  });

  it("accepts an exact token match (including multibyte content)", async () => {
    const { validateCsrf } = await import("@/lib/auth");
    const request = { headers: { get: () => "令牌-token-αβγ" } } as unknown as import("next/server").NextRequest;
    const session = { id: "s1", csrfToken: "令牌-token-αβγ", expiresAt: new Date(), user: { id: "u-csrf-ok", username: "u", displayName: "u", role: "staff", roleTags: [] } };
    expect(() => validateCsrf(request, session)).not.toThrow();
  });
});

describe("secure cookie enforcement", () => {
  it("forces secure=true in production even when x-forwarded-proto claims http", async () => {
    const { setSessionCookie } = await import("@/lib/auth");
    vi.stubEnv("NODE_ENV", "production");
    const cookiesSet = vi.fn();
    const mockResponse = { cookies: { set: cookiesSet } } as unknown as import("next/server").NextResponse;
    const forgedRequest = {
      headers: { get: () => "http" },
      nextUrl: { protocol: "http:" },
    } as unknown as import("next/server").NextRequest;

    setSessionCookie(mockResponse, "token", new Date(), forgedRequest);

    expect(cookiesSet).toHaveBeenCalledWith("xg_session", "token", expect.objectContaining({ secure: true }));
    vi.unstubAllEnvs();
  });
});

describe("scheduleExpiredSessionCleanup", () => {
  it("runs at most once per throttle interval and never throws", async () => {
    const { scheduleExpiredSessionCleanup } = await import("@/lib/auth");
    const deleteCallsBefore = mockDb.delete.mock.calls.length;

    scheduleExpiredSessionCleanup();
    scheduleExpiredSessionCleanup();

    expect(mockDb.delete.mock.calls.length).toBe(deleteCallsBefore + 1);
  });
});
