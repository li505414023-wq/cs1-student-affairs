"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import type { AuthSession } from "../components/student/student-types";

type AuthState = AuthSession | "loading" | null;

interface AuthContextValue {
  auth: AuthState;
  authNotice: string;
  csrfToken: string;
  currentUser: { id: string; displayName: string; role: string } | null;
  currentRole: string;
  setAuth: (session: AuthSession | null) => void;
  setAuthNotice: (notice: string) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [auth, setAuth] = useState<AuthState>("loading");
  const [authNotice, setAuthNoticeRaw] = useState("");
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss notice after 5 seconds
  const setAuthNotice = useCallback((notice: string) => {
    setAuthNoticeRaw(notice);
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    if (notice) {
      noticeTimer.current = setTimeout(() => setAuthNoticeRaw(""), 5000);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void fetch("/api/auth/session", { credentials: "same-origin" })
      .then(async (response) => {
        if (!active) return;
        if (!response.ok) { setAuth(null); return; }
        const payload = await response.json() as { data: AuthSession };
        setAuth(payload.data);
      })
      .catch(() => { if (active) setAuth(null); });
    return () => { active = false; };
  }, []);

  const logout = useCallback(async () => {
    if (auth && auth !== "loading") {
      await fetch("/api/auth/session", { method: "DELETE", headers: { "x-csrf-token": auth.csrfToken } });
    }
    setAuth(null);
  }, [auth]);

  const csrfToken = auth && auth !== "loading" ? auth.csrfToken : "";
  const currentUser = auth && auth !== "loading"
    ? { id: auth.user.id, displayName: auth.user.displayName, role: auth.user.role }
    : null;
  const currentRole = auth && auth !== "loading" ? auth.user.role : "viewer";

  return (
    <AuthContext.Provider value={{ auth, authNotice, csrfToken, currentUser, currentRole, setAuth, setAuthNotice, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
