"use client";

export function ModuleTitle({ title, description, action, onAction }: { title: string; description: string; action?: string; onAction?: () => void }) {
  return <div className="workflow-module-title"><div><h2>{title}</h2><p>{description}</p></div>{action && onAction && <button className="primary" onClick={onAction}>＋ {action}</button>}</div>;
}
