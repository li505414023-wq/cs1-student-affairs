/**
 * SLA reminder job — consumes workflow_instances.timeout_at.
 * For every running instance past its due date (and not yet reminded),
 * sends a reminder notification to the instance starter and records an
 * sla_reminder_sent event so each instance is only reminded once.
 *
 * Run: source the service env (/etc/cs1.env provides DATABASE_URL), then
 *      node scripts/sla-remind.mjs   — scheduled via cron every 30 min.
 */
import { randomUUID } from "node:crypto";
import pg from "pg";

const databaseUrl = process.env.DATABASE_URL?.trim();
if (!databaseUrl) throw new Error("缺少 DATABASE_URL");

const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
try {
  const { rows } = await pool.query(`
    select i.id, i.title, i.started_by
    from workflow_instances i
    where i.status = '运行中'
      and i.timeout_at is not null
      and i.timeout_at < now()
      and i.started_by is not null
      and not exists (
        select 1 from workflow_event_log e
        where e.instance_id = i.id and e.event = 'sla_reminder_sent'
      )
  `);

  let reminded = 0;
  for (const row of rows) {
    await pool.query(
      `insert into notifications (id, user_id, type, title, content, related_id)
       values ($1, $2, 'sla_reminder', $3, $4, $5)`,
      [
        randomUUID(),
        row.started_by,
        "审批超时提醒",
        `${row.title ?? "流程实例"}已超过处理时限，请及时处理或催办。`,
        row.id,
      ],
    );
    await pool.query(
      `insert into workflow_event_log (id, instance_id, event, detail_json)
       values ($1, $2, 'sla_reminder_sent', '{}')`,
      [randomUUID(), row.id],
    );
    reminded += 1;
  }
  console.log(`[sla-remind] 超时实例 ${rows.length} 条，发送催办通知 ${reminded} 条`);
} finally {
  await pool.end();
}
