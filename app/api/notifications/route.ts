import { desc, eq, and, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { notifications } from "@/db/schema";
import { requirePermission, validateCsrf } from "@/lib/auth";
import { fail, ok, readJson } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(request, "read");
    const url = new URL(request.url);
    const unreadOnly = url.searchParams.get("unread") === "true";

    let query = getDb().select().from(notifications).$dynamic();
    query = query.where(eq(notifications.userId, session.user.id));
    if (unreadOnly) query = query.where(eq(notifications.read, false));

    const items = await query.orderBy(desc(notifications.createdAt)).limit(50);
    return ok({ items, unreadCount: items.filter((n) => !n.read).length });
  } catch (error) {
    return fail(error, request);
  }
}

export async function POST(request: NextRequest) {
  try {
    await requirePermission(request, "write");
    // Anyone with write permission can create notifications (for system use)
    const body = await readJson(request);
    const userId = typeof body?.userId === "string" ? body.userId : "";
    const title = typeof body?.title === "string" ? body.title : "";
    if (!userId || !title) return fail(new Error("userId and title are required"));

    await getDb().insert(notifications).values({
      id: randomUUID(),
      userId,
      type: String(body?.type ?? "info"),
      title,
      content: String(body?.content ?? ""),
      relatedId: typeof body?.relatedId === "string" ? body.relatedId : null,
    });
    return ok({ created: true }, 201);
  } catch (error) {
    return fail(error, request);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await requirePermission(request, "read");
    const body = await readJson(request);
    const ids = Array.isArray(body?.ids) ? body.ids.filter((id: unknown) => typeof id === "string") : [];

    if (ids.length > 0) {
      await getDb().update(notifications).set({ read: true })
        .where(and(eq(notifications.userId, session.user.id), inArray(notifications.id, ids)));
    } else {
      // Mark all as read
      await getDb().update(notifications).set({ read: true })
        .where(eq(notifications.userId, session.user.id));
    }
    return ok({ marked: true });
  } catch (error) {
    return fail(error, request);
  }
}
