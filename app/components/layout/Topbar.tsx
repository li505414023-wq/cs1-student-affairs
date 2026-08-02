"use client";

import { systems } from "@/app/system-data";
import { useAuth } from "@/app/contexts/AuthContext";
import { useTheme } from "@/app/contexts/ThemeContext";
import { useNavigation } from "@/app/contexts/NavigationContext";
import { useNotifications } from "@/app/contexts/NotificationContext";

interface TopbarProps {
  onShowChangePassword: () => void;
}

export function Topbar({ onShowChangePassword }: TopbarProps) {
  const { auth, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { activeSystem, allowedSystems, sidebarOpen, setSidebarOpen, switchSystem } = useNavigation();
  const { unreadCount, setShowNotifications } = useNotifications();

  return (
    <header className="topbar">
      <button className="hamburger" aria-label="菜单" aria-expanded={sidebarOpen} onClick={() => setSidebarOpen((v) => !v)}>
        <span /><span /><span />
      </button>
      <div className="brand">智慧学工管理系统</div>
      <nav className="system-switcher" aria-label="系统切换">
        {systems.filter((system) => allowedSystems.some((s) => s.id === system.id)).map((system) => (
          <button key={system.id} className={activeSystem === system.id ? "active" : ""} onClick={() => switchSystem(system.id)}>
            {activeSystem === system.id && "◉ "}{system.label}
          </button>
        ))}
      </nav>
      <div className="profile">
        <button className="logout-button" style={{ position: "relative" }} onClick={() => setShowNotifications(true)} title="通知" aria-label={`通知（${unreadCount} 条未读）`}>
          🔔{unreadCount > 0 && <span style={{ position: "absolute", top: -4, right: -6, background: "var(--color-error)", color: "#fff", borderRadius: "50%", width: 16, height: 16, fontSize: 10, display: "flex", alignItems: "center", justifyContent: "center" }}>{unreadCount}</span>}
        </button>
        <button className="logout-button" onClick={toggleTheme} title="切换主题">{theme === "light" ? "☀" : "☾"}</button>
        {auth && auth !== "loading" && (
          <>
            <span className="profile-name">{auth.user.displayName}</span>
            <button className="logout-button" onClick={onShowChangePassword} title="修改密码" aria-label="修改密码">🔑</button>
            <button className="logout-button" onClick={() => { void logout(); }}>退出</button>
          </>
        )}
        <span className="avatar">{auth && auth !== "loading" ? auth.user.displayName.slice(0, 1) : "管"}</span>
      </div>
    </header>
  );
}
