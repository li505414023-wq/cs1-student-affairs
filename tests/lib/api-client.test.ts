import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { api, ApiClientError, isNetworkError, apiErrorMessage, setCsrfToken } from "@/lib/api-client";

type FetchArgs = { method: string; credentials?: RequestCredentials; headers: Record<string, string>; body?: string };

function mockResponse(status: number, body: unknown): Response {
  return { ok: status >= 200 && status < 300, status, json: async () => body } as unknown as Response;
}

describe("api client", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  let calls: Array<{ url: string; init: FetchArgs }>;

  beforeEach(() => {
    calls = [];
    fetchMock = vi.fn(async (url: string, init: FetchArgs) => {
      calls.push({ url, init });
      return mockResponse(200, { success: true, data: { value: 42 } });
    });
    vi.stubGlobal("fetch", fetchMock);
    setCsrfToken("");
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setCsrfToken("");
  });

  describe("request serialization", () => {
    it("GET sends same-origin credentials, no body, no content-type", async () => {
      await api.get("/api/students?page=1");
      expect(calls).toHaveLength(1);
      expect(calls[0].url).toBe("/api/students?page=1");
      expect(calls[0].init.method).toBe("GET");
      expect(calls[0].init.credentials).toBe("same-origin");
      expect(calls[0].init.body).toBeUndefined();
      expect(calls[0].init.headers["content-type"]).toBeUndefined();
    });

    it("POST serializes the JSON body and sets content-type", async () => {
      await api.post("/api/students", { name: "张三" });
      expect(calls[0].init.method).toBe("POST");
      expect(calls[0].init.headers["content-type"]).toBe("application/json");
      expect(JSON.parse(calls[0].init.body as string)).toEqual({ name: "张三" });
    });

    it("PUT and DELETE (with body) serialize the same way", async () => {
      await api.put("/api/admin/users/1", { active: false });
      await api.del("/api/counselor-classes", { id: "b1" });
      expect(calls[0].init.method).toBe("PUT");
      expect(JSON.parse(calls[0].init.body as string)).toEqual({ active: false });
      expect(calls[1].init.method).toBe("DELETE");
      expect(calls[1].init.headers["content-type"]).toBe("application/json");
      expect(JSON.parse(calls[1].init.body as string)).toEqual({ id: "b1" });
    });

    it("DELETE without body sends no content-type header", async () => {
      await api.del("/api/admin/roles/r1");
      expect(calls[0].init.method).toBe("DELETE");
      expect(calls[0].init.body).toBeUndefined();
      expect(calls[0].init.headers["content-type"]).toBeUndefined();
    });
  });

  describe("CSRF token", () => {
    it("attaches x-csrf-token on mutating requests when set", async () => {
      setCsrfToken("token-abc");
      await api.post("/api/x", {});
      await api.put("/api/x", {});
      await api.del("/api/x");
      for (const call of calls) expect(call.init.headers["x-csrf-token"]).toBe("token-abc");
    });

    it("does not attach x-csrf-token on GET or when unset", async () => {
      await api.get("/api/x");
      expect(calls[0].init.headers["x-csrf-token"]).toBeUndefined();
      setCsrfToken("token-abc");
      await api.get("/api/x");
      expect(calls[1].init.headers["x-csrf-token"]).toBeUndefined();
    });
  });

  describe("envelope unwrapping", () => {
    it("resolves with the envelope data on success", async () => {
      const data = await api.get<{ value: number }>("/api/x");
      expect(data).toEqual({ value: 42 });
    });

    it("tolerates ok responses without an explicit success field", async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(200, { data: { value: 7 } }));
      const data = await api.get<{ value: number }>("/api/x");
      expect(data).toEqual({ value: 7 });
    });

    it("throws ApiClientError with server message, status and details on success:false", async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(422, { success: false, error: "用户名已存在", details: { field: "username" } }));
      const error = (await api.post("/api/admin/users", {}).catch((e) => e)) as ApiClientError;
      expect(error).toBeInstanceOf(ApiClientError);
      expect(error.message).toBe("用户名已存在");
      expect(error.status).toBe(422);
      expect(error.details).toEqual({ field: "username" });
      expect(isNetworkError(error)).toBe(false);
      expect(apiErrorMessage(error, "fallback")).toBe("用户名已存在");
    });

    it("throws with empty message when the server provided none", async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(500, { success: false }));
      const error = (await api.get("/api/x").catch((e) => e)) as ApiClientError;
      expect(error.status).toBe(500);
      expect(error.message).toBe("");
      expect(apiErrorMessage(error, "操作失败")).toBe("操作失败");
    });

    it("throws on non-ok responses with unreadable bodies", async () => {
      fetchMock.mockResolvedValueOnce({ ok: false, status: 502, json: async () => { throw new Error("bad body"); } } as unknown as Response);
      const error = (await api.get("/api/x").catch((e) => e)) as ApiClientError;
      expect(error).toBeInstanceOf(ApiClientError);
      expect(error.status).toBe(502);
      expect(error.message).toBe("");
    });

    it("throws on explicit success:false even with 2xx (defensive)", async () => {
      fetchMock.mockResolvedValueOnce(mockResponse(200, { success: false, error: "逻辑失败" }));
      const error = (await api.get("/api/x").catch((e) => e)) as ApiClientError;
      expect(error.message).toBe("逻辑失败");
    });
  });

  describe("network errors", () => {
    it("maps fetch rejections to ApiClientError with status 0", async () => {
      fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
      const error = (await api.get("/api/x").catch((e) => e)) as ApiClientError;
      expect(error).toBeInstanceOf(ApiClientError);
      expect(isNetworkError(error)).toBe(true);
      expect(apiErrorMessage(error, "网络连接异常")).toBe("网络连接异常");
    });
  });
});
