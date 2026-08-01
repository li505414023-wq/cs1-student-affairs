import { asc, count } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { workflowDeployments, workflowForms, workflowModels } from "@/db/schema";
import { requirePermission, validateCsrf } from "@/lib/auth";
import { ApiError, fail, ok, readJson, requestIp, writeAudit } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  try {
    await requirePermission(request, "read");
    const db = getDb();
    const formRows = await db.select().from(workflowForms).orderBy(asc(workflowForms.name));
    const modelRows = await db.select().from(workflowModels).orderBy(asc(workflowModels.name));
    const deploymentRows = await db.select().from(workflowDeployments).orderBy(asc(workflowDeployments.deployedAt));
    const forms = formRows.map((item) => ({ ...item, fields: item.fieldsJson, fieldsJson: undefined }));
    const models = modelRows.map((item) => ({ ...item, nodes: item.nodesJson, nodesJson: undefined }));
    const deployments = deploymentRows.map((item) => ({ ...item, deployedAt: item.deployedAt.toISOString() }));
    return ok({ forms, models, deployments });
  } catch (error) {
    return fail(error, request);
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission(request, "write");
    validateCsrf(request, session);
    const body = await readJson(request);
    const name = typeof body?.name === "string" ? body.name.trim() : "";
    const key = typeof body?.key === "string" ? body.key.trim() : "";
    if (!name || !/^[A-Za-z0-9_-]{2,60}$/.test(key)) throw new ApiError(422, "流程名称或标识不正确");
    const id = randomUUID();
    await getDb().insert(workflowModels).values({
      id, key, name, category: String(body.category ?? "学生事务").slice(0, 50),
      description: String(body.description ?? "").slice(0, 500),
      nodesJson: Array.isArray(body.nodes) ? body.nodes : [],
    });
    await writeAudit({ userId: session.user.id, action: "create", resourceType: "workflow", resourceId: id, ip: requestIp(request) });
    return ok({ id, key, name }, 201);
  } catch (error) {
    return fail(error, request);
  }
}

export async function PUT(request: NextRequest) {
  try {
    // Full-sync rewrites all workflow definitions — admin only
    const session = await requirePermission(request, "admin");
    validateCsrf(request, session);
    const body = await readJson(request);
    const forms = Array.isArray(body.forms) ? body.forms : [];
    const models = Array.isArray(body.models) ? body.models : [];
    const deployments = Array.isArray(body.deployments) ? body.deployments : [];
    if (forms.length > 200 || models.length > 200 || deployments.length > 1000) throw new ApiError(422, "流程设计数据超过本地容量限制");
    const isKey = (value: unknown) => typeof value === "string" && /^[A-Za-z0-9_-]{2,60}$/.test(value);
    if (forms.some((item) => !item || typeof item !== "object" || !isKey((item as Record<string, unknown>).key))
      || models.some((item) => !item || typeof item !== "object" || !isKey((item as Record<string, unknown>).key))) {
      throw new ApiError(422, "流程或表单标识格式不正确");
    }
    const db = getDb();
    // Shrink guard: reject payloads that would wipe more than half of existing
    // definitions (typical symptom of an incomplete frontend state / network hiccup),
    // unless the caller explicitly confirms with allowShrink: true.
    const allowShrink = body?.allowShrink === true;
    const [formsRow] = await db.select({ value: count() }).from(workflowForms);
    const [modelsRow] = await db.select({ value: count() }).from(workflowModels);
    const [deploymentsRow] = await db.select({ value: count() }).from(workflowDeployments);
    const checkShrink = (incoming: number, existing: number, label: string) => {
      if (!allowShrink && existing >= 3 && incoming < Math.ceil(existing * 0.5)) {
        throw new ApiError(409, `${label}数量骤降（现有 ${existing}，本次提交 ${incoming}），已拒绝同步。确认无误后请附带 allowShrink: true 重试`);
      }
    };
    checkShrink(forms.length, Number(formsRow?.value ?? 0), "表单");
    checkShrink(models.length, Number(modelsRow?.value ?? 0), "流程模型");
    checkShrink(deployments.length, Number(deploymentsRow?.value ?? 0), "部署");
    // Note: still DELETE ALL + INSERT per table (skipped when the incoming array is
    // empty). A key-based upsert is tracked as a follow-up improvement.
    await db.transaction(async (tx) => {
      if (forms.length > 0) {
        await tx.delete(workflowForms);
        for (const item of forms as Array<Record<string, unknown>>) {
        await tx.insert(workflowForms).values({
          id: String(item.id).slice(0, 80), key: String(item.key), name: String(item.name ?? "未命名表单").slice(0, 100),
          type: String(item.type ?? "内置表单").slice(0, 30), status: String(item.status ?? "启用").slice(0, 20),
          fieldsJson: Array.isArray(item.fields) ? item.fields : [],
        });
      }}
      if (models.length > 0) {
        await tx.delete(workflowModels);
      for (const item of models as Array<Record<string, unknown>>) {
        await tx.insert(workflowModels).values({
          id: String(item.id).slice(0, 80), key: String(item.key), name: String(item.name ?? "未命名流程").slice(0, 100),
          category: String(item.category ?? "学生事务").slice(0, 50), description: String(item.description ?? "").slice(0, 500),
          formId: typeof item.formId === "string" && forms.some((form) => (form as Record<string, unknown>).id === item.formId) ? item.formId : null,
          version: Math.max(0, Number(item.version) || 0), status: String(item.status ?? "草稿").slice(0, 20),
          nodesJson: Array.isArray(item.nodes) ? item.nodes : [],
        });
      }}
      if (deployments.length > 0) {
        await tx.delete(workflowDeployments);
      for (const item of deployments as Array<Record<string, unknown>>) {
        await tx.insert(workflowDeployments).values({
          id: String(item.id).slice(0, 100), modelKey: String(item.modelKey ?? "").slice(0, 60), modelName: String(item.modelName ?? "").slice(0, 100),
          category: String(item.category ?? "其他事务").slice(0, 50), version: Math.max(1, Number(item.version) || 1),
          status: String(item.status ?? "激活").slice(0, 20), deployedAt: new Date(String(item.deployedAt ?? new Date().toISOString())), deployedBy: session.user.id,
        });
      }}
    });
    await writeAudit({ userId: session.user.id, action: "sync", resourceType: "workflow", detail: { forms: forms.length, models: models.length, deployments: deployments.length }, ip: requestIp(request) });
    return ok({ forms: forms.length, models: models.length, deployments: deployments.length });
  } catch (error) {
    return fail(error, request);
  }
}
