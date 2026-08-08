"use client";

import { useMemo, useState } from "react";
import { DOMAIN_TABS } from "@/app/domain-tabs";
import { isFeatureVisible, isStageVisible } from "@/app/menu-policy";
import { GenericModule } from "./GenericModule";

type CurrentUser = { id: string; displayName: string; role: string } | null;

/**
 * 业务域页面：一个菜单入口 + 页内 Tab 切换同域子功能。
 * Tab 按角色过滤——config/batch 类设置只对 admin 显示（与侧栏策略一致），
 * 学生只能看到其白名单内的子功能。
 */
export function TabbedDomainModule({ featureId, feature, csrfToken, currentUser }: {
  featureId: string; feature: string; csrfToken: string; currentUser?: CurrentUser;
}) {
  const role = currentUser?.role ?? "student";
  const tabs = useMemo(
    () => (DOMAIN_TABS[featureId] ?? []).filter((tab) => isFeatureVisible(tab.featureId, role) && isStageVisible(role, tab.stage)),
    [featureId, role],
  );
  const [activeTab, setActiveTab] = useState(tabs[0]?.featureId ?? "");
  const current = tabs.find((tab) => tab.featureId === activeTab) ?? tabs[0];

  if (!current) {
    return (
      <section className="module-card">
        <div className="module-hero"><span className="module-mark">{feature.slice(0, 1)}</span><div><h2>{feature}</h2><p>当前角色没有可用的子功能。</p></div></div>
      </section>
    );
  }

  return (
    <div>
      <div className="domain-tabs" role="tablist" aria-label={`${feature}子功能切换`}>
        {tabs.map((tab) => (
          <button key={tab.featureId} role="tab" aria-selected={current.featureId === tab.featureId}
            className={current.featureId === tab.featureId ? "active" : ""} onClick={() => setActiveTab(tab.featureId)}>
            {tab.label}
          </button>
        ))}
      </div>
      <GenericModule key={current.featureId} featureId={current.featureId} feature={feature} stage={current.stage} csrfToken={csrfToken} currentUser={currentUser} />
    </div>
  );
}
