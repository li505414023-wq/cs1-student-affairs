"use client";

import { useState, type FormEvent } from "react";
import type { AuthSession } from "./student/student-types";
import { isValidIdCard } from "@/lib/student-register";

type View = "login" | "register" | "done";

export function LoginPanel({ onAuthenticated }: { onAuthenticated: (session: AuthSession) => void }) {
  const [view, setView] = useState<View>("login");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const login = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError("");
    const data = new FormData(event.currentTarget);
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ username: data.get("username"), password: data.get("password") }) });
      const payload = await response.json() as { data: AuthSession; error?: string };
      if (!response.ok) { setError(payload.error ?? "登录失败"); return; }
      onAuthenticated(payload.data);
    } catch {
      setError("服务暂时无法连接");
    } finally {
      setSubmitting(false);
    }
  };

  const register = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const idCard = String(data.get("idCard") ?? "");
    if (!isValidIdCard(idCard)) { setError("身份证号格式不正确"); return; }
    if (String(data.get("password") ?? "") !== String(data.get("confirmPassword") ?? "")) { setError("两次输入的密码不一致"); return; }
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          no: data.get("no"),
          name: data.get("name"),
          idCard,
          password: data.get("password"),
          confirmPassword: data.get("confirmPassword"),
        }),
      });
      const payload = await response.json() as { error?: string; details?: Array<{ field: string; message: string }> };
      if (!response.ok) {
        setError(payload.details?.[0]?.message || payload.error || "注册失败");
        return;
      }
      setView("done");
    } catch {
      setError("服务暂时无法连接");
    } finally {
      setSubmitting(false);
    }
  };

  const switchTo = (next: View) => { setError(""); setView(next); };

  return (
    <div className="login-screen">
      <div className="login-statement" aria-hidden="true">
        <span className="login-tagline">学生事务管理平台</span>
        <span className="login-ghost">学工</span>
      </div>
      <section className="login-card">
        <div className="login-logo">智</div>
        {view === "done" ? (
          <>
            <h1>注册成功</h1>
            <p>你的登录账号已创建并绑定学籍。请使用学号与刚刚设置的密码登录系统。</p>
            <div style={{ display: "grid", gap: "var(--space-12)" }}>
              <button className="primary" onClick={() => switchTo("login")}>去登录</button>
              <button className="ghost" style={{ width: "100%" }} onClick={() => switchTo("register")}>继续注册其他学籍</button>
            </div>
          </>
        ) : view === "register" ? (
          <>
            <h1>学生自助注册</h1>
            <p>请填写与学籍登记完全一致的信息。身份证号仅用于核验本人，系统不会向任何人展示。</p>
            <form onSubmit={register}>
              <label><span>学号</span><input name="no" required placeholder="请输入学号" autoComplete="username" /></label>
              <label><span>姓名</span><input name="name" required placeholder="与学籍登记一致" autoComplete="name" /></label>
              <label><span>身份证号</span><input name="idCard" required maxLength={18} placeholder="用于本人核验，后6位需匹配" autoComplete="off" inputMode="text" /></label>
              <label><span>设置密码</span><input name="password" type="password" required minLength={10} placeholder="至少 10 位" autoComplete="new-password" /></label>
              <label><span>确认密码</span><input name="confirmPassword" type="password" required minLength={10} placeholder="再次输入密码" autoComplete="new-password" /></label>
              <div className="login-error-slot">
                {error && <div className="login-error" role="alert">{error}</div>}
              </div>
              <button className="primary" type="submit" disabled={submitting}>{submitting ? "注册中…" : "注册账号"}</button>
            </form>
            <button className="login-switch" type="button" onClick={() => switchTo("login")}>已有账号？返回登录</button>
          </>
        ) : (
          <>
            <h1>智慧学工管理系统</h1>
            <p>学籍 · 审批 · 助困奖助 · 宿舍运维</p>
            <form onSubmit={login}>
              <label><span>用户名</span><input name="username" autoComplete="username" required placeholder="请输入用户名" /></label>
              <label><span>密码</span><input name="password" type="password" autoComplete="current-password" required placeholder="请输入密码" /></label>
              <div className="login-error-slot">
                {error && <div className="login-error" role="alert">{error}</div>}
              </div>
              <button className="primary" type="submit" disabled={submitting}>{submitting ? "正在登录…" : "登录"}</button>
            </form>
            <button className="login-switch" type="button" onClick={() => switchTo("register")}>学生自助注册</button>
          </>
        )}
      </section>
    </div>
  );
}
