import { beforeEach, describe, expect, it, vi } from "vitest";
import { auditLogs, businessRecords, conductScores, leaves, punishments } from "@/db/schema";
import { DELETE, PUT } from "@/app/api/records/[featureId]/[id]/route";
import { POST as batchPost } from "@/app/api/records/[featureId]/batch/route";

type Row = Record<string, unknown>;

const mocks = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
  requirePermission: vi.fn(),
  validateCsrf: vi.fn(),
  hasPermission: vi.fn(),
  enforceRateLimit: vi.fn(),
  dbHolder: { db: null as unknown },
}));

vi.mock("@/db", () => ({ getDb: vi.fn(() => mocks.dbHolder.db) }));
vi.mock("@/lib/auth", () => ({
  getCurrentSession: mocks.getCurrentSession,
  requirePermission: mocks.requirePermission,
  validateCsrf: mocks.validateCsrf,
}));
vi.mock("@/lib/security", () => ({ hasPermission: mocks.hasPermission }));
vi.mock("@/lib/rate-limit", () => ({ enforceRateLimit: mocks.enforceRateLimit }));

function thenableRows(rows: Row[]) {
  const promise = Promise.resolve(rows) as Promise<Row[]> & { limit?: () => Promise<Row[]>; orderBy?: () => unknown };
  promise.limit = () => Promise.resolve(rows);
  promise.orderBy = () => promise;
  return promise;
}

/** 脚本式 db mock：select 结果按调用顺序从队列消费，insert/update/delete 记录调用。 */
function createDbMock() {
  const selectQueue: Row[][] = [];
  const state = {
    inserts: [] as Array<{ table: unknown; values: Row }>,
    updates: [] as Array<{ table: unknown; set: Row }>,
    deletes: [] as Array<{ table: unknown }>,
  };
  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => thenableRows(selectQueue.shift() ?? [])),
      })),
    })),
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((values: Row) => {
        state.inserts.push({ table, values });
        return Promise.resolve([]);
      }),
    })),
    update: vi.fn((table: unknown) => ({
      set: vi.fn((set: Row) => {
        state.updates.push({ table, set });
        return { where: vi.fn(() => Promise.resolve([])) };
      }),
    })),
    delete: vi.fn((table: unknown) => ({
      where: vi.fn(() => {
        state.deletes.push({ table });
        return Promise.resolve([]);
      }),
    })),
    transaction: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(db)),
  };
  return { db, state, queue: (...results: Row[][]) => { selectQueue.push(...results); } };
}

const adminSession = { user: { id: "u-admin", role: "admin", displayName: "管理员", roleTags: ["管理员"] } };
const counselorSession = { user: { id: "u-counselor", role: "counselor", displayName: "辅导员", roleTags: ["辅导员"] } };
const studentSession = { user: { id: "u-student", role: "student", displayName: "学生", roleTags: ["学生"] } };

let dbMock: ReturnType<typeof createDbMock>;

beforeEach(() => {
  vi.clearAllMocks();
  dbMock = createDbMock();
  mocks.dbHolder.db = dbMock.db;
  mocks.hasPermission.mockResolvedValue(true);
  mocks.getCurrentSession.mockResolvedValue(adminSession);
  mocks.requirePermission.mockResolvedValue(adminSession);
});

const makeRequest = (method: string, url: string, body?: unknown) =>
  new Request(url, {
    method,
    headers: { "content-type": "application/json", "x-csrf-token": "t" },
    body: body === undefined ? undefined : JSON.stringify(body),
  }) as unknown as Parameters<typeof PUT>[0];

const recordParams = (featureId: string, id: string) => ({ params: Promise.resolve({ featureId, id }) });
const featureParams = (featureId: string) => ({ params: Promise.resolve({ featureId }) });
const body = async (response: Response) => response.json() as Promise<{ success: boolean; data?: Record<string, unknown>; error?: string }>;

const record = (overrides: Row = {}) => ({
  id: "rec-1", featureId: "leave", dataJson: { 姓名: "张三" }, status: "已提交", createdBy: "u-other", ...overrides,
});

describe("records 单条改删的行级范围校验（IDOR 修复）", () => {
  it("辅导员越权 PUT 数据范围外的记录被拒 403", async () => {
    mocks.getCurrentSession.mockResolvedValue(counselorSession);
    // 顺序：loadRecord → counselorClasses → 范围查询（空 = 范围外）
    dbMock.queue([record()], [], []);
    const response = await PUT(makeRequest("PUT", "http://localhost/api/records/leave/rec-1", { data: { 姓名: "李四" }, status: "已提交" }), recordParams("leave", "rec-1"));
    expect(response.status).toBe(403);
    expect(dbMock.state.updates).toHaveLength(0);
  });

  it("辅导员越权 DELETE 数据范围外的记录被拒 403", async () => {
    mocks.getCurrentSession.mockResolvedValue(counselorSession);
    dbMock.queue([record()], [{ className: "一区队" }], [], []);
    const response = await DELETE(makeRequest("DELETE", "http://localhost/api/records/leave/rec-1"), recordParams("leave", "rec-1"));
    expect(response.status).toBe(403);
    expect(dbMock.state.deletes).toHaveLength(0);
  });

  it("学生不能修改他人提交的记录 403", async () => {
    mocks.getCurrentSession.mockResolvedValue(studentSession);
    dbMock.queue([record({ createdBy: "u-other" })]);
    const response = await PUT(makeRequest("PUT", "http://localhost/api/records/leave/rec-1", { data: { 姓名: "李四" }, status: "已提交" }), recordParams("leave", "rec-1"));
    expect(response.status).toBe(403);
    expect(dbMock.state.updates).toHaveLength(0);
  });

  it("学生不能操作非申请类业务的记录 403", async () => {
    mocks.getCurrentSession.mockResolvedValue(studentSession);
    const response = await PUT(makeRequest("PUT", "http://localhost/api/records/punishment/rec-1", { data: {}, status: "已提交" }), recordParams("punishment", "rec-1"));
    expect(response.status).toBe(403);
  });

  it("管理员在范围内 PUT 成功且范围条件被应用", async () => {
    // admin 无范围限制：loadRecord → 运行中计数 → 退回实例查询
    dbMock.queue([record({ createdBy: "u-admin" })], [{ value: 0 }], []);
    const response = await PUT(makeRequest("PUT", "http://localhost/api/records/leave/rec-1", { data: { 姓名: "李四" }, status: "已提交" }), recordParams("leave", "rec-1"));
    expect(response.status).toBe(200);
    expect(dbMock.state.updates).toHaveLength(1);
    expect(dbMock.state.inserts.some((insert) => insert.table === auditLogs)).toBe(true);
  });

  it("辅导员操作范围内记录成功（范围条件生效放行）", async () => {
    mocks.getCurrentSession.mockResolvedValue(counselorSession);
    // loadRecord → counselorClasses → 区队学生 → 范围查询命中 → 运行中计数 → 退回实例
    dbMock.queue(
      [record({ createdBy: "u-student" })],
      [{ className: "一区队" }],
      [{ userId: "u-student", no: "S001" }],
      [{ id: "rec-1" }],
      [{ value: 0 }],
      [],
    );
    const response = await PUT(makeRequest("PUT", "http://localhost/api/records/leave/rec-1", { data: { 姓名: "李四" }, status: "已提交" }), recordParams("leave", "rec-1"));
    expect(response.status).toBe(200);
    expect(dbMock.state.updates).toHaveLength(1);
  });

  it("记录不存在返回 404", async () => {
    dbMock.queue([]);
    const response = await DELETE(makeRequest("DELETE", "http://localhost/api/records/leave/rec-x"), recordParams("leave", "rec-x"));
    expect(response.status).toBe(404);
  });
});

describe("审批状态保护（流转中记录改删）", () => {
  it("运行中流程的记录任何人都不能改（409）", async () => {
    dbMock.queue([record({ createdBy: "u-admin" })], [{ value: 1 }]);
    const response = await PUT(makeRequest("PUT", "http://localhost/api/records/leave/rec-1", { data: {}, status: "已提交" }), recordParams("leave", "rec-1"));
    expect(response.status).toBe(409);
    expect(dbMock.state.updates).toHaveLength(0);
  });

  it("退回待修改的记录仅申请人可改：申请人本人允许", async () => {
    mocks.getCurrentSession.mockResolvedValue(studentSession);
    dbMock.queue([record({ createdBy: "u-student" })], [{ value: 0 }], [{ startedBy: "u-student" }]);
    const response = await PUT(makeRequest("PUT", "http://localhost/api/records/leave/rec-1", { data: { 事由: "修改后" }, status: "退回待修改" }), recordParams("leave", "rec-1"));
    expect(response.status).toBe(200);
    expect(dbMock.state.updates).toHaveLength(1);
  });

  it("退回待修改的记录非申请人（辅导员）不能改写 403", async () => {
    mocks.getCurrentSession.mockResolvedValue(counselorSession);
    dbMock.queue(
      [record({ createdBy: "u-student" })],
      [{ className: "一区队" }],
      [{ userId: "u-student", no: "S001" }],
      [{ id: "rec-1" }],
      [{ value: 0 }],
      [{ startedBy: "u-student" }],
    );
    const response = await PUT(makeRequest("PUT", "http://localhost/api/records/leave/rec-1", { data: { 事由: "篡改" }, status: "退回待修改" }), recordParams("leave", "rec-1"));
    expect(response.status).toBe(403);
    expect(dbMock.state.updates).toHaveLength(0);
  });

  it("退回待修改的记录非申请人不能删除 403", async () => {
    mocks.getCurrentSession.mockResolvedValue(counselorSession);
    // loadRecord → counselorClasses → 区队学生 → 范围命中 → 运行中计数 → 退回实例
    dbMock.queue(
      [record({ createdBy: "u-student" })],
      [{ className: "一区队" }],
      [{ userId: "u-student", no: "S001" }],
      [{ id: "rec-1" }],
      [{ value: 0 }],
      [{ startedBy: "u-student" }],
    );
    const response = await DELETE(makeRequest("DELETE", "http://localhost/api/records/leave/rec-1"), recordParams("leave", "rec-1"));
    expect(response.status).toBe(403);
    expect(dbMock.state.deletes).toHaveLength(0);
  });
});

describe("学生自我审批防护（PUT 状态强制 + 终态实例保护）", () => {
  it("学生 PUT 携带 status:\"已通过\" 落库仍为\"已提交\"（对齐 POST 语义）", async () => {
    mocks.getCurrentSession.mockResolvedValue(studentSession);
    // 领域表 domainGet：leaves 记录 → students 学号 → scope 命中 → 运行中计数 → 退回（无）→ 终态（无）
    dbMock.queue(
      [record({ createdBy: "u-student" })],
      [{ no: "S001" }],
      [{ id: "rec-1" }],
      [{ value: 0 }],
      [],
      [{ value: 0 }],
    );
    const response = await PUT(makeRequest("PUT", "http://localhost/api/records/leave/rec-1", { data: { 事由: "修改后" }, status: "已通过" }), recordParams("leave", "rec-1"));
    expect(response.status).toBe(200);
    expect(dbMock.state.updates).toHaveLength(1);
    expect(dbMock.state.updates[0].set.status).toBe("已提交");
    const payload = await body(response);
    expect(payload.data?.status).toBe("已提交");
  });

  it("学生对终态实例（已完成）记录的 PUT 被拒 403", async () => {
    mocks.getCurrentSession.mockResolvedValue(studentSession);
    dbMock.queue([record({ createdBy: "u-student", status: "已通过" })], [{ value: 0 }], [], [{ value: 1 }]);
    const response = await PUT(makeRequest("PUT", "http://localhost/api/records/leave/rec-1", { data: { 事由: "篡改" }, status: "已提交" }), recordParams("leave", "rec-1"));
    expect(response.status).toBe(403);
    expect(dbMock.state.updates).toHaveLength(0);
  });

  it("学生对终态实例（已撤回）记录的 DELETE 被拒 403", async () => {
    mocks.getCurrentSession.mockResolvedValue(studentSession);
    dbMock.queue([record({ createdBy: "u-student", status: "已撤回" })], [{ value: 0 }], [], [{ value: 1 }]);
    const response = await DELETE(makeRequest("DELETE", "http://localhost/api/records/leave/rec-1"), recordParams("leave", "rec-1"));
    expect(response.status).toBe(403);
    expect(dbMock.state.deletes).toHaveLength(0);
  });

  it("管理员不受终态实例限制，可改已完结流程的记录", async () => {
    // admin：loadRecord → 运行中计数 → 退回实例（无），无终态检查
    dbMock.queue([record({ createdBy: "u-student", status: "已通过" })], [{ value: 0 }], []);
    const response = await PUT(makeRequest("PUT", "http://localhost/api/records/leave/rec-1", { data: { 事由: "管理员修正" }, status: "已驳回" }), recordParams("leave", "rec-1"));
    expect(response.status).toBe(200);
    expect(dbMock.state.updates).toHaveLength(1);
    expect(dbMock.state.updates[0].set.status).toBe("已驳回");
  });
});

describe("批量导入走业务钩子流水线", () => {
  it("处分导入触发操行分联动钩子", async () => {
    mocks.requirePermission.mockResolvedValue(adminSession);
    const response = await batchPost(
      makeRequest("POST", "http://localhost/api/records/punishment/batch", {
        records: [{ data: { 姓名: "张三", 学号: "S001", 处分类型: "警告", 区队: "一区队" }, status: "已提交" }],
      }),
      featureParams("punishment"),
    );
    expect(response.status).toBe(201);
    const payload = await body(response);
    expect(payload.data?.savedCount).toBe(1);
    // 处分本体写入领域表 punishments，操行分联动写入领域表 conduct_scores。
    const punishmentInserts = dbMock.state.inserts.filter((insert) => insert.table === punishments);
    const conductInserts = dbMock.state.inserts.filter((insert) => insert.table === conductScores);
    expect(punishmentInserts).toHaveLength(1);
    expect(conductInserts).toHaveLength(1);
    expect((punishmentInserts[0].values as Row).studentNo).toBe("S001");
    expect((conductInserts[0].values as Row).reason).toMatch("处分联动减分");
  });

  it("手册业务规则校验失败的行进入错误明细且不入库", async () => {
    mocks.requirePermission.mockResolvedValue(adminSession);
    const response = await batchPost(
      makeRequest("POST", "http://localhost/api/records/leave/batch", {
        records: [{ data: { 姓名: "张三", 请假天数: "91" }, status: "已提交" }],
      }),
      featureParams("leave"),
    );
    expect(response.status).toBe(201);
    const payload = await body(response);
    expect(payload.data?.savedCount).toBe(0);
    expect(String((payload.data?.errors as Array<{ message: string }>)?.[0]?.message)).toMatch("休学");
    expect(dbMock.state.inserts.filter((insert) => insert.table === businessRecords)).toHaveLength(0);
  });

  it("数据库前置校验生效：有生效处分的学生批量评优被拒", async () => {
    mocks.requirePermission.mockResolvedValue(adminSession);
    // validateRecordAgainstDb 现查询领域表 punishments（索引），返回行即视为存在生效处分。
    dbMock.queue([{ id: "p1" }]);
    const response = await batchPost(
      makeRequest("POST", "http://localhost/api/records/scholarship/batch", {
        records: [{ data: { 姓名: "张三", 学号: "S001" }, status: "已提交" }],
      }),
      featureParams("scholarship"),
    );
    expect(response.status).toBe(201);
    const payload = await body(response);
    expect(payload.data?.savedCount).toBe(0);
    expect(String((payload.data?.errors as Array<{ message: string }>)?.[0]?.message)).toMatch("处分");
    expect(dbMock.state.inserts.filter((insert) => insert.table === businessRecords)).toHaveLength(0);
  });

  it("请假批量导入经过数据补全（写入审批链）", async () => {
    mocks.requirePermission.mockResolvedValue(adminSession);
    const response = await batchPost(
      makeRequest("POST", "http://localhost/api/records/leave/batch", {
        records: [{ data: { 姓名: "张三", 请假天数: "2" }, status: "已提交" }],
      }),
      featureParams("leave"),
    );
    expect(response.status).toBe(201);
    // leave 现写入领域表 leaves，data_json 仍携带补全后的审批链。
    const inserted = dbMock.state.inserts.find((insert) => insert.table === leaves);
    expect((inserted?.values as Row).dataJson).toMatchObject({ 审批链: "区队指导员→大队长" });
  });
});
