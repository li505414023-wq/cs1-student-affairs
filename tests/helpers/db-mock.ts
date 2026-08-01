import { vi } from "vitest";

export function mockNextResponse() {
  const json = vi.fn((body: unknown, init?: ResponseInit) => {
    return new Response(JSON.stringify(body), {
      status: init?.status ?? 200,
      headers: { "content-type": "application/json" },
    });
  });
  return { json };
}

export function createMockNextRequest(overrides: {
  cookies?: Map<string, { value: string }>;
  headers?: Record<string, string>;
  body?: unknown;
} = {}) {
  const cookies = {
    get: (name: string) => overrides.cookies?.get(name) ?? null,
    set: vi.fn(),
  };

  const headers = new Map<string, string>();
  headers.set("content-type", "application/json");
  if (overrides.headers) {
    for (const [key, value] of Object.entries(overrides.headers)) {
      headers.set(key, value);
    }
  }

  return {
    cookies,
    headers,
    json: vi.fn().mockResolvedValue(overrides.body ?? {}),
  } as unknown as Request;
}
