"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { systemGroups, systems, type SystemId, type Feature, type FeatureGroup } from "../system-data";
import { isAdminGroupVisible, isFeatureVisible, systemsForRole } from "../menu-policy";
import { useAuth } from "./AuthContext";

interface NavigationContextValue {
  activeSystem: SystemId;
  activeGroup: string;
  activeFeature: string;
  expanded: Set<string>;
  sidebarFilter: string;
  sidebarOpen: boolean;
  currentGroups: FeatureGroup[];
  active: Feature | undefined;
  allowedSystems: typeof systems;
  setSidebarFilter: (value: string) => void;
  setSidebarOpen: (open: boolean | ((v: boolean) => boolean)) => void;
  toggleGroup: (id: string) => void;
  chooseFeature: (groupId: string, featureId: string) => void;
  switchSystem: (systemId: SystemId) => void;
  navigateToFeature: (featureId: string) => void;
  jumpToInstance: (instanceId: string) => void;
  resetNavigation: () => void;
}

const NavigationContext = createContext<NavigationContextValue | null>(null);

export function NavigationProvider({ children }: { children: ReactNode }) {
  const { currentRole, auth } = useAuth();
  const [activeSystem, setActiveSystem] = useState<SystemId>("student");
  const [activeGroup, setActiveGroup] = useState("student");
  const [activeFeature, setActiveFeature] = useState("students");
  const [expanded, setExpanded] = useState(() => new Set(["student"]));
  const [sidebarFilter, setSidebarFilter] = useState("");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const allowedSystems = useMemo(
    () => systems.filter((s) => systemsForRole(currentRole).includes(s.id)),
    [currentRole],
  );

  const currentGroups = useMemo(() => {
    return systemGroups[activeSystem]
      .filter((group) => activeSystem !== "admin" || isAdminGroupVisible(group.id, currentRole))
      .map((group) => ({
        ...group,
        children: group.children
          .map((child) => ({ ...child, features: child.features.filter((feature) => isFeatureVisible(feature.id, currentRole)) }))
          .filter((child) => child.features.length > 0),
      }))
      .filter((group) => group.children.length > 0);
  }, [activeSystem, currentRole]);

  const active = useMemo(() => {
    return currentGroups
      .flatMap((group) => group.children.flatMap((child) => child.features))
      .find((feature) => feature.id === activeFeature);
  }, [currentGroups, activeFeature]);

  const toggleGroup = useCallback((id: string) => {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const chooseFeature = useCallback((groupId: string, featureId: string) => {
    setActiveGroup(groupId);
    setActiveFeature(featureId);
    setSidebarOpen(false);
  }, []);

  const switchSystem = useCallback((systemId: SystemId) => {
    const firstGroup = systemGroups[systemId][0];
    const firstFeature = firstGroup.children[0].features[0];
    setActiveSystem(systemId);
    setActiveGroup(firstGroup.id);
    setActiveFeature(firstFeature.id);
    setExpanded(new Set([firstGroup.id]));
    setSidebarOpen(false);
  }, []);

  const navigateToFeature = useCallback((featureId: string) => {
    // 在所有子系统中查找目标功能（首页快捷入口可能跨系统跳转）。
    const systemId = (Object.keys(systemGroups) as SystemId[]).find((id) =>
      systemGroups[id].some((g) => g.children.some((child) => child.features.some((f) => f.id === featureId))),
    );
    const targetSystem = systemId ?? "student";
    const group = systemGroups[targetSystem].find((g) => g.children.some((child) => child.features.some((f) => f.id === featureId)));
    setActiveSystem(targetSystem);
    setActiveGroup(group?.id ?? "student");
    setActiveFeature(featureId);
    setExpanded(new Set([group?.id ?? "student"]));
    setSidebarOpen(false);
  }, []);

  const jumpToInstance = useCallback((instanceId: string) => {
    setActiveSystem("admin");
    setActiveGroup("workflow");
    setActiveFeature("my-request");
    setExpanded(new Set(["workflow"]));
    setSidebarOpen(false);
    // notificationFocus is handled by NotificationContext via event
    window.dispatchEvent(new CustomEvent("nav:focus-instance", { detail: instanceId }));
  }, []);

  const resetNavigation = useCallback(() => {
    if (auth && auth !== "loading" && auth.user.role === "student") {
      setActiveSystem("student");
      setActiveGroup("home");
      setActiveFeature("student-home");
      setExpanded(new Set(["home"]));
    }
  }, [auth]);

  return (
    <NavigationContext.Provider value={{
      activeSystem, activeGroup, activeFeature, expanded, sidebarFilter, sidebarOpen,
      currentGroups, active, allowedSystems,
      setSidebarFilter, setSidebarOpen, toggleGroup, chooseFeature, switchSystem, navigateToFeature, jumpToInstance, resetNavigation,
    }}>
      {children}
    </NavigationContext.Provider>
  );
}

export function useNavigation(): NavigationContextValue {
  const context = useContext(NavigationContext);
  if (!context) throw new Error("useNavigation must be used within NavigationProvider");
  return context;
}
