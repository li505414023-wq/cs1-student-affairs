"use client";

import { CountUp } from "../shared/use-count-up";

type StatusCount = { status: string; count: number };

/**
 * Statistics overview driven by server-side aggregation over the FULL scoped
 * set (see /api/records/[featureId]/stats), so figures no longer reflect only
 * the current page.
 */
export function StatisticsOverview({ feature, total, byStatus, sums }: {
  feature: string;
  total: number;
  byStatus: StatusCount[];
  sums: Record<string, number>;
}) {
  if (total === 0) {
    return (
      <div className="statistics-layout">
        <div className="empty-state">暂无统计数据，请先录入{feature}记录</div>
      </div>
    );
  }

  const sumEntries = Object.entries(sums);
  const tiles = sumEntries.length > 0
    ? [{ label: "记录总数", value: total }, ...sumEntries.map(([label, value]) => ({ label, value }))]
    : [{ label: "记录总数", value: total }, ...byStatus.map((b) => ({ label: b.status, value: b.count }))];

  const chart = byStatus.length > 1
    ? byStatus.map((b) => ({ label: b.status, value: b.count }))
    : sumEntries.map(([label, value]) => ({ label, value }));
  const max = Math.max(...chart.map((c) => c.value), 1);

  return (
    <div className="statistics-layout">
      <div className="metric-grid">
        {tiles.slice(0, 6).map((tile) => (
          <article key={tile.label}>
            <span>{tile.label}</span>
            <strong><CountUp value={tile.value} /></strong>
            <small>全量统计</small>
          </article>
        ))}
      </div>
      <div className="chart-card">
        <div><strong>{feature}分布</strong><span>共 {total} 条</span></div>
        <div className="bar-chart">
          {chart.map((c) => (
            <i key={c.label} style={{ height: `${Math.max(8, Math.round((c.value / max) * 90))}%` }} title={`${c.label}：${c.value}`}>
              <span>{c.label} {c.value}</span>
            </i>
          ))}
        </div>
      </div>
    </div>
  );
}
