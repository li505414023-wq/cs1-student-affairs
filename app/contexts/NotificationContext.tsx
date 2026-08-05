"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api-client";
import { useAuth } from "./AuthContext";

interface NotificationContextValue {
  unreadCount: number;
  showNotifications: boolean;
  notificationFocus: string | null;
  setShowNotifications: (show: boolean) => void;
  setUnreadCount: (count: number) => void;
  consumeFocus: () => void;
}

const NotificationContext = createContext<NotificationContextValue | null>(null);

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { auth } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notificationFocus, setNotificationFocus] = useState<string | null>(null);

  // Poll unread notification count every 30s
  useEffect(() => {
    if (!auth || auth === "loading") return;
    const poll = () => {
      api.get<{ unreadCount: number }>("/api/notifications?unread=true")
        .then((data) => setUnreadCount(data.unreadCount))
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, 30000);
    return () => clearInterval(interval);
  }, [auth]);

  // Listen for navigation focus events from NavigationContext
  useEffect(() => {
    const handler = (e: Event) => {
      setNotificationFocus((e as CustomEvent<string>).detail);
    };
    window.addEventListener("nav:focus-instance", handler);
    return () => window.removeEventListener("nav:focus-instance", handler);
  }, []);

  const consumeFocus = useCallback(() => {
    setNotificationFocus(null);
  }, []);

  return (
    <NotificationContext.Provider value={{
      unreadCount, showNotifications, notificationFocus,
      setShowNotifications, setUnreadCount, consumeFocus,
    }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used within NotificationProvider");
  return context;
}
