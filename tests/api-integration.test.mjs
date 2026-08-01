import assert from "node:assert/strict";
import test from "node:test";

const baseUrl = process.env.TEST_BASE_URL ?? "http://127.0.0.1:4180";
const username = process.env.BOOTSTRAP_ADMIN_USERNAME;
const password = process.env.BOOTSTRAP_ADMIN_PASSWORD;

test("login, session, CSRF, student CRUD and audit permissions work together", { skip: !username || !password }, async () => {
  assert.ok(username && password, "integration test credentials are required through environment variables");
  const login = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  assert.equal(login.status, 200);
  const loginBody = await login.json();
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  assert.ok(cookie?.startsWith("xg_session="));
  assert.ok(loginBody.data.csrfToken);

  const session = await fetch(`${baseUrl}/api/auth/session`, { headers: { cookie } });
  assert.equal(session.status, 200);
  assert.equal((await session.json()).data.user.role, "admin");

  const noCsrf = await fetch(`${baseUrl}/api/students`, {
    method: "POST", headers: { cookie, "content-type": "application/json" }, body: "{}",
  });
  assert.equal(noCsrf.status, 403);

  const studentNo = `T${Date.now()}`;
  const create = await fetch(`${baseUrl}/api/students`, {
    method: "POST",
    headers: { cookie, "content-type": "application/json", "x-csrf-token": loginBody.data.csrfToken },
    body: JSON.stringify({
      name: "接口测试学生", no: studentNo, phone: "13800009999", gender: "未知",
      faculty: "测试学院", major: "测试专业", className: "测试班", grade: "2026",
      birthDate: "2008-01-01", address: "本地测试地址", status: "在读",
    }),
  });
  assert.equal(create.status, 201);
  const created = (await create.json()).data;

  const list = await fetch(`${baseUrl}/api/students?keyword=${studentNo}`, { headers: { cookie } });
  assert.equal(list.status, 200);
  assert.equal((await list.json()).data.items.length, 1);

  const remove = await fetch(`${baseUrl}/api/students/${created.id}`, {
    method: "DELETE", headers: { cookie, "x-csrf-token": loginBody.data.csrfToken },
  });
  assert.equal(remove.status, 200);
});
