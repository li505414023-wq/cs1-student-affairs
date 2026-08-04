"use client";

import { useCallback, useEffect, useState } from "react";

type HeadteacherRow = {
  id: string;
  faculty: string;
  major: string;
  className: string;
  grade: string | null;
  teacherName: string;
  teacherUsername: string;
  teacherPhone: string | null;
  active: boolean;
  createdAt: string;
};

/** Head-teacher assignment query over counselor-classes (read-only). */
export function HeadteacherQueryModule() {
  const [rows, setRows] = useState<HeadteacherRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [className, setClassName] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async (search: string, clazz: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ type: "headteacher" });
      if (search.trim()) params.set("keyword", search.trim());
      if (clazz.trim()) params.set("className", clazz.trim());
      const response = await fetch(`/api/admin/staff?${params.toString()}`, { credentials: "same-origin" });
      if (!response.ok) { setNotice("任职数据加载失败,请重试"); return; }
      const payload = await response.json() as { data: { items: HeadteacherRow[] } };
      setRows(payload.data.items);
    } catch {
      setNotice("网络连接异常,请检查后重试");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load("", ""); }, [load]);

  return (
    <section className="module-card">
      {notice && <div className="action-notice" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice("")}>×</button></div>}
      <div className="module-hero">
        <span className="module-mark">班</span>
        <div>
          <h2>班主任任职查询</h2>
          <p>按班级或教师查询班主任任职记录(数据来自辅导员-班级绑定,绑定维护由管理员在接口完成)。</p>
        </div>
        <button className="ghost" onClick={() => void load(keyword, className)}>刷新</button>
      </div>

      <form className="module-filter" onSubmit={(event) => { event.preventDefault(); void load(keyword, className); }}>
        <label><span>关键词</span><input value={keyword} onChange={(event) => setKeyword(event.target.value)} placeholder="教师姓名 / 账号 / 班级" /></label>
        <label><span>班级名称</span><input value={className} onChange={(event) => setClassName(event.target.value)} placeholder="如:软件2601" /></label>
        <button className="primary" type="submit">搜索</button>
        <button className="ghost" type="button" onClick={() => { setKeyword(""); setClassName(""); void load("", ""); }}>清空</button>
      </form>

      <div className="table-card">
        <div className="table-scroll">
          <table>
            <thead><tr><th>学院</th><th>专业</th><th>班级</th><th>年级</th><th>班主任</th><th>账号</th><th>联系电话</th><th>账号状态</th><th>绑定时间</th></tr></thead>
            <tbody>
              {isLoading && <tr><td colSpan={9} style={{ textAlign: "center", padding: 32 }}>加载中…</td></tr>}
              {!isLoading && rows.length === 0 && <tr><td colSpan={9}><div className="empty-state">暂无任职记录</div></td></tr>}
              {!isLoading && rows.map((row) => (
                <tr key={row.id}>
                  <td>{row.faculty || "—"}</td>
                  <td>{row.major || "—"}</td>
                  <td><strong>{row.className}</strong></td>
                  <td>{row.grade ?? "—"}</td>
                  <td>{row.teacherName}</td>
                  <td><code>{row.teacherUsername}</code></td>
                  <td>{row.teacherPhone ?? "—"}</td>
                  <td><span className={`status ${row.active ? "" : "pending"}`}>{row.active ? "启用" : "停用"}</span></td>
                  <td>{new Date(row.createdAt).toLocaleString("zh-CN", { hour12: false })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
