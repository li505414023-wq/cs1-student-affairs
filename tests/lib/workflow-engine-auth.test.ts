import { describe, expect, it, beforeEach, vi } from "vitest";
import { ApiError } from "@/lib/api";
import { WorkflowError } from "@/lib/workflow/types";

/**
 * Queue-based Drizzle mock: every select/update/insert chain resolves to the
 * next queued result for its operation kind (defaults to an empty result set).
 */
function createDbMock(queues: { select?: unknown[][]; update?: unknown[][]; insert?: unknown[][] } = {}) {
  const take = (op: "select" | "update" | "insert"): unknown[] => {
    const queue = queues[op];
    return queue && queue.length > 0 ? queue.shift()! : [];
  };
  const chainable = (op: "select" | "update" | "insert") => {
    const builder: Record<string, unknown> = {
      then: (resolve: (value: unknown) => unknown, reject: (reason?: unknown) => unknown) =>
        Promise.resolve(take(op)).then(resolve, reject),
    };
    for (const method of ["from", "where", "limit", "orderBy", "offset", "set", "returning", "values", "innerJoin"]) {
      builder[method] = () => builder;
    }
    return builder;
  };
  return {
    select: () => chainable("select"),
    update: () => chainable("update"),
    insert: () => chainable("insert"),
  };
}

const dbHolder: { current: ReturnType<typeof createDbMock> | null } = { current: null };

vi.mock("@/db", () => ({ getDb: () => dbHolder.current }));
vi.mock("@/db/schema", () => ({
  workflowInstances: { _brand: "workflowInstances" },
  workflowTasks: { _brand: "workflowTasks" },
  workflowEventLog: { _brand: "workflowEventLog" },
  workflowModels: { _brand: "workflowModels" },
  notifications: { _brand: "notifications" },
  businessRecords: { _brand: "businessRecords" },
  auditLogs: { _brand: "auditLogs" },
  systemLogs: { _brand: "systemLogs" },
}));

import { WorkflowEngine } from "@/lib/workflow/engine";

const NODES = [
  { id: "n-start", type: "start", name: "开始" },
  { id: "n-approve", type: "approval", name: "辅导员审批", assignee: "辅导员", assigneeType: "role" },
  { id: "n-end", type: "end", name: "结束" },
];

const modelRow = { key: "leave", nodesJson: NODES };

function instanceRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "i-1",
    modelKey: "leave",
    status: "运行中",
    currentNodeId: "n-approve",
    startedBy: "u-student",
    recordId: null,
    title: "请假申请",
    formDataJson: {},
    ...overrides,
  };
}

function taskRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "t-1",
    instanceId: "i-1",
    nodeId: "n-approve",
    assigneeType: "role",
    assigneeValue: "辅导员",
    status: "待处理",
    claimedBy: null,
    ...overrides,
  };
}

const advanceBase = {
  instanceId: "i-1",
  nodeId: "n-approve",
  action: "approve" as const,
  userId: "u-counselor",
  userRole: "counselor",
  userRoleTags: ["辅导员"],
};

async function expectWorkflowError(promise: Promise<unknown>, status: number, messagePart?: string) {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(WorkflowError);
    expect((error as WorkflowError).status).toBe(status);
    if (messagePart) expect((error as Error).message).toContain(messagePart);
    return;
  }
  throw new Error(`expected WorkflowError ${status}, but the call succeeded`);
}

beforeEach(() => {
  dbHolder.current = null;
});

describe("workflow engine authorization", () => {
  it("rejects advancing a node that is not the instance's current node", async () => {
    // Attack vector: pass the start node id to skip authorization.
    dbHolder.current = createDbMock({
      select: [
        [instanceRow()],
        [taskRow()], // access-check task list
      ],
    });
    const engine = new WorkflowEngine();
    await expectWorkflowError(
      engine.advance({ ...advanceBase, nodeId: "n-start" }),
      409,
      "节点与流程当前状态不一致",
    );
  });

  it("rejects advancing when the current node has no pending task", async () => {
    dbHolder.current = createDbMock({
      select: [
        [instanceRow()],
        [taskRow()], // access list (counselor matches assigneeValue)
        [modelRow],
        [], // no pending task on the node
      ],
    });
    const engine = new WorkflowEngine();
    await expectWorkflowError(engine.advance({ ...advanceBase }), 409, "暂无待处理任务");
  });

  it("rejects a user without instance access (unrelated operator)", async () => {
    dbHolder.current = createDbMock({
      select: [
        [instanceRow()],
        [taskRow()], // assigneeValue 辅导员 — staff identities don't match
      ],
    });
    const engine = new WorkflowEngine();
    try {
      await engine.advance({ ...advanceBase, userId: "u-outsider", userRole: "staff", userRoleTags: ["工作人员"] });
      throw new Error("expected ApiError 403, but the call succeeded");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      expect((error as ApiError).status).toBe(403);
    }
  });

  it("rejects the instance starter when they are not a task candidate", async () => {
    // The starter bypass is gone: approvals require a matching candidate identity.
    dbHolder.current = createDbMock({
      select: [
        [instanceRow()],
        [taskRow()],
        [modelRow],
        [taskRow()], // pending task assigned to 辅导员
      ],
    });
    const engine = new WorkflowEngine();
    await expectWorkflowError(
      engine.advance({ ...advanceBase, userId: "u-student", userRole: "student", userRoleTags: ["学生"] }),
      403,
      "无权处理该任务",
    );
  });

  it("rejects manually advancing a start node even when it is current", async () => {
    dbHolder.current = createDbMock({
      select: [
        [instanceRow({ currentNodeId: "n-start" })],
        [[]], // starter passes access via startedBy
        [modelRow],
      ],
    });
    const engine = new WorkflowEngine();
    await expectWorkflowError(
      engine.advance({ ...advanceBase, nodeId: "n-start", userId: "u-student", userRole: "student", userRoleTags: [] }),
      409,
      "不能手动推进",
    );
  });

  it("rejects advancing a non-running instance", async () => {
    dbHolder.current = createDbMock({ select: [[instanceRow({ status: "已完成", currentNodeId: null })]] });
    const engine = new WorkflowEngine();
    await expectWorkflowError(engine.advance({ ...advanceBase }), 409, "无法推进");
  });

  it("rejects advancing a missing instance with 404", async () => {
    dbHolder.current = createDbMock({ select: [[]] });
    const engine = new WorkflowEngine();
    await expectWorkflowError(engine.advance({ ...advanceBase }), 404);
  });

  it("allows a legitimate candidate to approve and completes the flow", async () => {
    dbHolder.current = createDbMock({
      select: [
        [instanceRow()],
        [taskRow()], // access check
        [modelRow],
        [taskRow()], // pending task
        [instanceRow()], // notification lookup in completeCurrentTask
        [{ recordId: null }], // syncRecordStatus lookup
        [{ status: "已完成", currentNodeId: null }], // final re-read
      ],
      update: [
        [{ id: "t-1" }], // completeCurrentTask returning
        [], // instance completion update
      ],
      insert: [[], [], []], // notification, node_approve log, instance_complete log
    });
    const engine = new WorkflowEngine();
    const result = await engine.advance({ ...advanceBase });
    expect(result.status).toBe("已完成");
  });
});

describe("workflow engine condition branching", () => {
  const CONDITION_NODES = [
    { id: "n-start", type: "start", name: "开始" },
    { id: "n-submit", type: "submit", name: "申请人提交", assignee: "流程发起人" },
    { id: "n-approve", type: "approval", name: "辅导员审批", assignee: "辅导员", assigneeType: "role" },
    { id: "n-cond", type: "condition", name: "条件分支", conditionExpression: "${days} > 3", trueNodeId: "n-dean", falseNodeId: "n-end" },
    { id: "n-dean", type: "approval", name: "院系审批", assignee: "院系管理员", assigneeType: "role" },
    { id: "n-end", type: "end", name: "结束" },
  ];

  it("branches to the true target node when the condition holds", async () => {
    dbHolder.current = createDbMock({
      select: [
        [instanceRow()],                                  // instance status check
        [taskRow()],                                      // access check
        [{ key: "leave", nodesJson: CONDITION_NODES }],   // model
        [taskRow()],                                      // pending task
        [instanceRow()],                                  // completeCurrentTask notification lookup
        [instanceRow({ formDataJson: { days: "5" } })],   // evaluateCondition formData
        [instanceRow()],                                  // activateNextNode notification lookup
        [instanceRow({ status: "运行中", currentNodeId: "n-dean" })], // final re-read
      ],
      update: [
        [{ id: "t-1" }], // completeCurrentTask
        [],              // activateNextNode currentNodeId update
      ],
      insert: [[], [], [], [], []],
    });
    const engine = new WorkflowEngine();
    const result = await engine.advance({ ...advanceBase });
    expect(result.status).toBe("运行中");
    expect(result.currentNodeId).toBe("n-dean");
  });

  it("branches to the false target (end) and completes when the condition fails", async () => {
    dbHolder.current = createDbMock({
      select: [
        [instanceRow()],
        [taskRow()],
        [{ key: "leave", nodesJson: CONDITION_NODES }],
        [taskRow()],
        [instanceRow()],                                  // completeCurrentTask notification
        [instanceRow({ formDataJson: { days: "1" } })],   // evaluateCondition → false
        [{ recordId: null }],                             // syncRecordStatus lookup
        [{ status: "已完成", currentNodeId: null }],      // final re-read
      ],
      update: [
        [{ id: "t-1" }], // completeCurrentTask
        [],              // instance completion update
      ],
      insert: [[], [], []], // notification, condition_evaluated log, instance_complete log
    });
    const engine = new WorkflowEngine();
    const result = await engine.advance({ ...advanceBase });
    expect(result.status).toBe("已完成");
    expect(result.currentNodeId).toBeNull();
  });
});

describe("workflow engine claim authorization", () => {
  it("rejects claiming a task when the user is not in the candidate set", async () => {
    dbHolder.current = createDbMock({
      select: [[taskRow({ status: "待签收" })]],
    });
    const engine = new WorkflowEngine();
    await expectWorkflowError(
      engine.claimTask("t-1", "u-student", "student", ["学生"]),
      403,
      "候选处理人",
    );
  });

  it("allows a matching candidate to claim the task", async () => {
    dbHolder.current = createDbMock({
      select: [[taskRow({ status: "待签收" })]],
      update: [[{ id: "t-1", instanceId: "i-1", nodeId: "n-approve" }]],
      insert: [[]], // task_claimed log
    });
    const engine = new WorkflowEngine();
    await expect(engine.claimTask("t-1", "u-counselor", "counselor", ["辅导员"])).resolves.toBe(true);
  });

  it("allows admin to claim any task", async () => {
    dbHolder.current = createDbMock({
      select: [[taskRow({ status: "待签收" })]],
      update: [[{ id: "t-1", instanceId: "i-1", nodeId: "n-approve" }]],
      insert: [[]],
    });
    const engine = new WorkflowEngine();
    await expect(engine.claimTask("t-1", "u-admin", "admin", [])).resolves.toBe(true);
  });

  it("rejects claiming a missing task with 404", async () => {
    dbHolder.current = createDbMock({ select: [[]] });
    const engine = new WorkflowEngine();
    await expectWorkflowError(engine.claimTask("t-x", "u-counselor", "counselor", []), 404);
  });

  it("rejects claiming an already-claimed task with 409", async () => {
    dbHolder.current = createDbMock({
      select: [[taskRow({ status: "待处理", claimedBy: "u-other" })]],
    });
    const engine = new WorkflowEngine();
    await expectWorkflowError(engine.claimTask("t-1", "u-counselor", "counselor", []), 409);
  });
});
