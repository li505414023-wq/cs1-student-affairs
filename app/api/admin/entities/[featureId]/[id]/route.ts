import { and, count, eq, inArray } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { managedItems } from "@/db/schema";
import { requirePermission, validateCsrf } from "@/lib/auth";
import { ENTITY_FEATURE_IDS, getEntityConfig } from "@/lib/entity-features";
import { validateEntityInput } from "@/lib/validation-entities";
import { ApiError, fail, isUniqueViolation, ok, readJson, requestIp, writeAudit } from "@/lib/api";

export const runtime = "nodejs";

export async function PUT(request: NextRequest, context: { params: Promise<{ featureId: string; id: string }> }) {
  try {
    const session = await requirePermission(request, "admin");
    validateCsrf(request, session);
    const { featureId, id } = await context.params;
    const config = getEntityConfig(featureId);
    if (!config) throw new ApiError(404, "未知的功能标识");

    const db = getDb();
    const [existing] = await db.select().from(managedItems).where(and(eq(managedItems.id, id), eq(managedItems.featureId, featureId))).limit(1);
    if (!existing) throw new ApiError(404, "记录不存在");

    const validated = validateEntityInput(config, await readJson(request));
    if (!validated.success) throw new ApiError(422, "数据校验失败", validated.errors);
    const { code, name, description, parentCode, sortOrder, status, data } = validated.data;

    try {
      await db.update(managedItems).set({
        code, name, description,
        parentCode: parentCode || null, sortOrder, status, dataJson: data,
      }).where(eq(managedItems.id, id));
    } catch (error) {
      if (isUniqueViolation(error)) throw new ApiError(409, `编码 ${code} 已存在`);
      throw error;
    }
    await writeAudit({ userId: session.user.id, action: "update_entity", resourceType: featureId, resourceId: id, detail: { code, name, status }, ip: requestIp(request) });
    return ok({ updated: true });
  } catch (error) {
    return fail(error, request);
  }
}

export async function DELETE(request: NextRequest, context: { params: Promise<{ featureId: string; id: string }> }) {
  try {
    const session = await requirePermission(request, "admin");
    validateCsrf(request, session);
    const { featureId, id } = await context.params;
    if (!getEntityConfig(featureId)) throw new ApiError(404, "未知的功能标识");

    const db = getDb();
    const [existing] = await db.select().from(managedItems).where(and(eq(managedItems.id, id), eq(managedItems.featureId, featureId))).limit(1);
    if (!existing) throw new ApiError(404, "记录不存在");

    if (existing.code) {
      // Children may live in other features whose hierarchy points at this one
      // (e.g. majors under faculties), plus same-feature children (dict items).
      const childFeatureIds = ENTITY_FEATURE_IDS.filter(
        (id) => getEntityConfig(id)?.hierarchical?.parentFeature === featureId,
      );
      if (childFeatureIds.length > 0) {
        const [childCount] = await db.select({ value: count() }).from(managedItems)
          .where(and(inArray(managedItems.featureId, childFeatureIds), eq(managedItems.parentCode, existing.code)));
        if (Number(childCount?.value ?? 0) > 0) throw new ApiError(409, "存在子项,无法删除,请先删除或迁移子项");
      }
    }

    await db.delete(managedItems).where(eq(managedItems.id, id));
    await writeAudit({ userId: session.user.id, action: "delete_entity", resourceType: featureId, resourceId: id, detail: { code: existing.code, name: existing.name }, ip: requestIp(request) });
    return ok({ deleted: true });
  } catch (error) {
    return fail(error, request);
  }
}
