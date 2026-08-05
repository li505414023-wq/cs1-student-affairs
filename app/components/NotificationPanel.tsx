"use client";

import { useCallback, useEffect, useState } from "react";
import { api, isNetworkError } from "@/lib/api-client";

type NotificationItem = {
  id: string;
  type: string;
  title: string;
  content: string;
  read: boolean;
  relatedId: string | null;
  createdAt: string;
};

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("zh-CN", { hour12: false });
}

/**
 * Notification center opened from the topbar bell. Lists the user's
 * notifications, marks them read, and deep-links to the related workflow
 * instance when present.
 */
export function NotificationPanel({ csrfToken, onClose, onJump, onUnreadChanged }: {
  csrfToken: string;
  onClose: () => void;
  onJump: (instanceId: string) => void;
  onUnreadChanged: (count: number) => void;
}) {
  void csrfToken; // CSRF 由 api-client 统一携带
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await api.get<{ items: NotificationItem[]; unreadCount: number }>("/api/notifications");
      setItems(data.items);
      onUnreadChanged(data.unreadCount);
    } catch (error) {
      setNotice(isNetworkError(error) ? "网络连接异常，请重试" : "通知加载失败，请重试");
    } finally {
      setIsLoading(false);
    }
  }, [onUnreadChanged]);

  useEffect(() => { void refresh(); }, [refresh]);

  const markRead = async (ids: string[]) => {
    try {
      await api.put("/api/notifications", { ids });
    } catch (error) {
      if (isNetworkError(error)) { setNotice("网络异常，标记已读失败"); return; }
      // Server rejected the update: the previous implementation ignored
      // response.ok here and marked items read optimistically — keep that.
    }
    setItems((current) => current.map((item) => ids.length === 0 || ids.includes(item.id) ? { ...item, read: true } : item));
    onUnreadChanged(ids.length === 0 ? 0 : items.filter((item) => !item.read && !ids.includes(item.id)).length);
  };

  const openItem = async (item: NotificationItem) => {
    if (!item.read) await markRead([item.id]);
    if (item.relatedId) {
      onJump(item.relatedId);
      onClose();
    }
  };

  return (
    <div className="dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label="通知中心"
        onMouseDown={(event) => event.stopPropagation()}
        style={{ position: "fixed", top: 56, right: 16, width: "min(380px, calc(100vw - 32px))", maxHeight: "70vh", display: "flex", flexDirection: "column", background: "var(--color-surface, #fff)", borderRadius: 12, boxShadow: "0 12px 40px rgba(0,0,0,.18)", overflow: "hidden" }}
      >
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 16px", borderBottom: "1px solid var(--color-border, #e5e7eb)" }}>
          <h2 style={{ margin: 0, fontSize: 16 }}>通知中心</h2>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="ghost" onClick={() => void markRead([])}>全部已读</button>
            <button aria-label="关闭" onClick={onClose}>×</button>
          </div>
        </header>
        {notice && <div className="action-notice" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice("")}>×</button></div>}
        <div style={{ overflowY: "auto", padding: "8px 0" }}>
          {isLoading ? <p style={{ padding: 16 }}>加载中…</p> : items.length === 0 ? <p style={{ padding: 24, textAlign: "center" }}>暂无通知</p> : (
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {items.map((item) => (
                <li key={item.id}>
                  <button
                    onClick={() => void openItem(item)}
                    style={{ display: "block", width: "100%", textAlign: "left", padding: "10px 16px", border: "none", borderBottom: "1px solid var(--color-border, #f0f0f0)", background: item.read ? "transparent" : "var(--color-surface-muted, #f5f8ff)", cursor: "pointer" }}
                  >
                    <strong style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {!item.read && <span aria-label="未读" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-error, #e5484d)", flexShrink: 0 }} />}
                      {item.title}
                    </strong>
                    <span style={{ display: "block", fontSize: 13, opacity: 0.85, marginTop: 2 }}>{item.content}</span>
                    <small style={{ display: "block", marginTop: 2, opacity: 0.6 }}>{formatTime(item.createdAt)}{item.relatedId ? " · 点击查看详情" : ""}</small>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
