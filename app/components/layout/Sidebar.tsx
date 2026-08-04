"use client";

import { systems } from "@/app/system-data";
import { useNavigation } from "@/app/contexts/NavigationContext";

export function Sidebar() {
  const {
    activeSystem, activeGroup, activeFeature, expanded, sidebarFilter, sidebarOpen,
    currentGroups, allowedSystems,
    setSidebarFilter, setSidebarOpen, toggleGroup, chooseFeature, switchSystem,
  } = useNavigation();

  return (
    <>
      {sidebarOpen && <div className="sidebar-overlay" aria-hidden="true" onClick={() => setSidebarOpen(false)} />}
      <nav className="mobile-system-switcher" aria-label="移动端系统切换">
        {systems.filter((system) => allowedSystems.some((s) => s.id === system.id)).map((system) => (
          <button key={system.id} className={activeSystem === system.id ? "active" : ""} onClick={() => switchSystem(system.id)}>
            {system.shortLabel}
          </button>
        ))}
      </nav>
      <aside className={`sidebar${sidebarOpen ? " is-open" : ""}`}>
        <div className="sidebar-title">
          {systems.find((system) => system.id === activeSystem)?.shortLabel}功能导航{" "}
          <span>{currentGroups.reduce((count, group) => count + group.children.flatMap((child) => child.features).length, 0)} 项</span>
        </div>
        <div className="sidebar-search">
          <input
            placeholder="搜索功能…"
            value={sidebarFilter}
            onChange={(event) => setSidebarFilter(event.target.value)}
            aria-label="搜索功能模块"
          />
        </div>
        {currentGroups.map((group) => {
          const filterText = sidebarFilter.trim().toLowerCase();
          const filteredChildren = filterText
            ? group.children.map((child) => ({
                ...child,
                features: child.features.filter((f) => f.label.toLowerCase().includes(filterText) || f.id.toLowerCase().includes(filterText)),
              })).filter((child) => child.features.length > 0)
            : group.children;
          if (filterText && filteredChildren.length === 0) return null;
          const showExpanded = expanded.has(group.id) || !!filterText;

          return (
            <section className="nav-group" key={group.id}>
              <button
                className={`nav-group-button ${activeGroup === group.id ? "current" : ""}`}
                aria-expanded={showExpanded}
                onClick={() => toggleGroup(group.id)}
              >
                <span className="nav-icon">{group.icon}</span><span>{group.label}</span><span className="chevron">{showExpanded ? "⌃" : "⌄"}</span>
              </button>
              {showExpanded && (
                <div className="nav-children">
                  {filteredChildren.map((child) => (
                    <div className="nav-section" key={child.label}>
                      <p>{child.label}</p>
                      {child.features.map((feature) => (
                        <button
                          key={feature.id}
                          className={activeFeature === feature.id ? "active" : ""}
                          onClick={() => chooseFeature(group.id, feature.id)}
                        >{feature.label}</button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}
      </aside>
    </>
  );
}
