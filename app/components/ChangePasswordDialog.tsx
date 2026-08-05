"use client";

import { useState } from "react";
import { api, apiErrorMessage, isNetworkError } from "@/lib/api-client";

/**
 * Self-service password change dialog backed by POST /api/auth/password.
 * On success the API also revokes the user's other sessions.
 */
export function ChangePasswordDialog({ csrfToken, onClose, onChanged }: {
  csrfToken: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  void csrfToken; // CSRF 由 api-client 统一携带
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (newPassword.length < 10) { setNotice("新密码至少需要 10 个字符"); return; }
    if (newPassword !== confirmPassword) { setNotice("两次输入的新密码不一致"); return; }
    setBusy(true);
    try {
      await api.post("/api/auth/password", { oldPassword, newPassword });
      onChanged();
    } catch (error) {
      setNotice(isNetworkError(error) ? "网络异常，密码修改未完成" : apiErrorMessage(error, "密码修改失败，请重试"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="修改密码"
        onMouseDown={(event) => event.stopPropagation()}
        style={{ width: "min(400px, calc(100vw - 32px))", background: "var(--color-surface, #fff)", borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,.18)", overflow: "hidden" }}
      >
        <header style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", borderBottom: "1px solid var(--color-border, #e5e7eb)" }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>修改密码</h2>
          <button aria-label="关闭" onClick={onClose}>×</button>
        </header>
        <form onSubmit={submit} style={{ padding: 16, display: "grid", gap: 12 }}>
          {notice && <div className="action-notice" role="alert">{notice}</div>}
          <label style={{ display: "grid", gap: 4 }}>当前密码
            <input type="password" value={oldPassword} onChange={(event) => setOldPassword(event.target.value)} required autoComplete="current-password" style={{ padding: 8 }} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>新密码（至少 10 位）
            <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} required minLength={10} autoComplete="new-password" style={{ padding: 8 }} />
          </label>
          <label style={{ display: "grid", gap: 4 }}>确认新密码
            <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required minLength={10} autoComplete="new-password" style={{ padding: 8 }} />
          </label>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button className="ghost" type="button" onClick={onClose}>取消</button>
            <button className="primary" type="submit" disabled={busy}>{busy ? "提交中…" : "确认修改"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
