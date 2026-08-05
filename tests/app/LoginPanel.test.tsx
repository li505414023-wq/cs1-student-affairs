// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginPanel } from "@/app/components/LoginPanel";

type FetchStub = ReturnType<typeof vi.fn>;

function stubFetch(impl: (...args: unknown[]) => unknown): FetchStub {
  const fetchMock = vi.fn(impl);
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function jsonResponse(status: number, body: unknown) {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe("LoginPanel", () => {
  it("renders the login form with username and password inputs", () => {
    render(<LoginPanel onAuthenticated={vi.fn()} />);
    expect(screen.getByRole("heading", { name: "智慧学工管理系统" })).toBeTruthy();
    expect(screen.getByPlaceholderText("请输入用户名")).toBeTruthy();
    expect(screen.getByPlaceholderText("请输入密码")).toBeTruthy();
    expect(screen.getByRole("button", { name: "登录" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "学生自助注册" })).toBeTruthy();
  });

  it("posts credentials and reports the authenticated session on success", async () => {
    const session = { user: { id: "u1", username: "admin", role: "admin" }, csrfToken: "token" };
    const fetchMock = stubFetch(async () => jsonResponse(200, { data: session }));
    const onAuthenticated = vi.fn();
    render(<LoginPanel onAuthenticated={onAuthenticated} />);

    fireEvent.change(screen.getByPlaceholderText("请输入用户名"), { target: { value: "admin" } });
    fireEvent.change(screen.getByPlaceholderText("请输入密码"), { target: { value: "secret-password" } });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalledWith(session));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/auth/login");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ username: "admin", password: "secret-password" });
  });

  it("shows the server error message when login fails", async () => {
    stubFetch(async () => jsonResponse(401, { error: "用户名或密码不正确" }));
    render(<LoginPanel onAuthenticated={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("请输入用户名"), { target: { value: "admin" } });
    fireEvent.change(screen.getByPlaceholderText("请输入密码"), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("用户名或密码不正确");
  });

  it("shows a connection error when the request fails", async () => {
    stubFetch(async () => { throw new Error("network down"); });
    render(<LoginPanel onAuthenticated={vi.fn()} />);

    fireEvent.change(screen.getByPlaceholderText("请输入用户名"), { target: { value: "admin" } });
    fireEvent.change(screen.getByPlaceholderText("请输入密码"), { target: { value: "secret" } });
    fireEvent.click(screen.getByRole("button", { name: "登录" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("服务暂时无法连接");
  });

  it("switches to the register view and validates the id card before submitting", async () => {
    const fetchMock = stubFetch(async () => jsonResponse(200, {}));
    render(<LoginPanel onAuthenticated={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "学生自助注册" }));
    expect(screen.getByRole("heading", { name: "学生自助注册" })).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText("请输入学号"), { target: { value: "20260001" } });
    fireEvent.change(screen.getByPlaceholderText("与学籍登记一致"), { target: { value: "测试" } });
    fireEvent.change(screen.getByPlaceholderText("用于本人核验，后6位需匹配"), { target: { value: "123" } });
    fireEvent.change(screen.getByPlaceholderText("至少 10 位"), { target: { value: "Passw0rd!Passw0rd!" } });
    fireEvent.change(screen.getByPlaceholderText("再次输入密码"), { target: { value: "Passw0rd!Passw0rd!" } });
    fireEvent.click(screen.getByRole("button", { name: "注册账号" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("身份证号格式不正确");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects registration when the two passwords differ", async () => {
    const fetchMock = stubFetch(async () => jsonResponse(200, {}));
    render(<LoginPanel onAuthenticated={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "学生自助注册" }));
    fireEvent.change(screen.getByPlaceholderText("请输入学号"), { target: { value: "20260001" } });
    fireEvent.change(screen.getByPlaceholderText("与学籍登记一致"), { target: { value: "测试" } });
    // A syntactically valid 18-digit id (checksum digit computed for the stub).
    fireEvent.change(screen.getByPlaceholderText("用于本人核验，后6位需匹配"), { target: { value: "110101200803129518" } });
    fireEvent.change(screen.getByPlaceholderText("至少 10 位"), { target: { value: "Passw0rd!Passw0rd!" } });
    fireEvent.change(screen.getByPlaceholderText("再次输入密码"), { target: { value: "Different!Passw0rd" } });
    fireEvent.click(screen.getByRole("button", { name: "注册账号" }));

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toBe("两次输入的密码不一致");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
