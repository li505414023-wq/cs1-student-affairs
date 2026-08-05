"use client";

import { useCallback, useEffect, useState } from "react";
import { BUILTIN_ROLES } from "@/lib/role-defs";
import { api, isNetworkError } from "@/lib/api-client";

type TeamRow = {
  id: string;
  username: string;
  displayName: string;
  role: string;
  roleTags: string[];
  phone: string | null;
  active: boolean;
  classes: Array<{ faculty: string; major: string; className: string }>;
};

function roleLabel(code: string) {
  return BUILTIN_ROLES.find((r) => r.code === code)?.label ?? code;
}

/** Staff roster: all non-student accounts with their class bindings (read-only). */
export function TeamBuildingModule() {
  const [rows, setRows] = useState<TeamRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (search: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ type: "team" });
      if (search.trim()) params.set("keyword", search.trim());
      const data = await api.get<{ items: TeamRow[] }>(`/api/admin/staff?${params.toString()}`);
      setRows(data.items);
    } catch (error) {
      setNotice(isNetworkError(error) ? "网络连接异常,请检查后重试" : "队伍数据加载失败,请重试");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(""); }, [load]);

  return (
    <section className="module-card">
      {notice && <div className="action-notice" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice("")}>×</button></div>}
      <div className="module-hero">
        <span className="module-mark">队</span>
        <div>
          <h2>队伍建设</h2>
          <p>学工队伍花名册:管理员、辅导员、宿管等全部教职工账号及其带班情况(只读,账号维护请到「用户管理」)。</p>
        </div>
        <button className="ghost" onClick={() => void load(keyword)}>刷新</button>
      </div>

      <form className="module-filter" onSubmit={(event) => { event.preventDefault(); void load(keyword); }}>
        <label><span>关键词</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="姓名 / 账号 / 手机号" /></label>
        <button className="primary" type="submit">搜索</button>
        <button className="ghost" type="button" onClick={() => { setKeyword(""); void load(""); }}>清空</button>
      </form>

      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead><tr><th>姓名</th><th>账号</th><th>角色</th><th>角色标签</th><th>所带班级</th><th>手机号</th><th>状态</th></tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={7} style={{ textAlign: "center", padding: 32 }}>加载中…</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td colSpan={7}><div className="empty-state">没有符合条件的教职工</div></td></tr>}
              {!isLoading && rows.map((row) => (
                <tr key={row.id}>
                  <td><strong>{row.displayName}</strong></td>
                  <td><code>{row.username}</code></td>
                  <td>{roleLabel(row.role)}</td>
                  <td>{row.roleTags.join("、") || "—"}</td>
                  <td>{row.classes.length > 0 ? row.classes.map((c) => `${c.className}`).join("、") : <span style={{ opacity: 0.5 }}>未绑定班级</span>}</td>
                  <td>{row.phone ?? "—"}</td>
                  <td><span className={`status ${row.active ? "" : "pending"}`}>{row.active ? "启用" : "停用"}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
