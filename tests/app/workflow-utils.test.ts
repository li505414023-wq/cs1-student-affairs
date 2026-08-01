import { describe, it, expect } from "vitest";
import { appendWorkflowNode, deployModelVersion, toggleDeploymentStatus } from "@/app/workflow-utils.js";

describe("appendWorkflowNode", () => {
  const baseNodes = [
    { id: "start", type: "start", name: "开始" },
    { id: "end", type: "end", name: "结束" },
  ];

  it("inserts a new approval node before the end node", () => {
    const result = appendWorkflowNode(baseNodes, "approval");
    expect(result).toHaveLength(3);
    expect(result[1].type).toBe("approval");
    expect(result[2].type).toBe("end");
  });

  it("gives the new node a unique id", () => {
    const result = appendWorkflowNode(baseNodes, "copy");
    expect(result[1].id).toBeTruthy();
    expect(result[1].id).not.toBe(result[0].id);
    expect(result[1].id).not.toBe(result[2].id);
  });

  it("does not mutate the original array", () => {
    const original = [...baseNodes];
    appendWorkflowNode(baseNodes, "approval");
    expect(baseNodes).toEqual(original);
  });

  it("names the node based on type", () => {
    const result = appendWorkflowNode(baseNodes, "condition");
    expect(result[1].name).toContain("条件");
  });

  it("inserts before the last node which is end", () => {
    const multiNode = [
      { id: "start", type: "start", name: "开始" },
      { id: "approve", type: "approval", name: "审批" },
      { id: "end", type: "end", name: "结束" },
    ];
    const result = appendWorkflowNode(multiNode, "copy");
    expect(result).toHaveLength(4);
    expect(result[2].type).toBe("copy");
    expect(result[3].type).toBe("end");
  });
});

describe("deployModelVersion", () => {
  const deployments: Array<{ id: string; modelKey: string; modelName: string; category: string; version: number; status: string; deployedAt: string }> = [
    { id: "dep1", modelKey: "leave", modelName: "请假", category: "学生事务", version: 1, status: "激活", deployedAt: "2026-01-01" },
  ];

  const model = { id: "m1", key: "dorm", name: "住宿", category: "宿舍事务", description: "", formId: "f1", version: 2, status: "已部署", nodes: [] };

  it("creates a new deployment with the model details", () => {
    const result = deployModelVersion(deployments, model);
    expect(result).toHaveLength(2);
    // New deployment is prepended to the array
    expect(result[0].modelKey).toBe("dorm");
    expect(result[0].modelName).toBe("住宿");
    expect(result[0].category).toBe("宿舍事务");
    expect(result[0].version).toBe(1); // First deployment for this model key
    expect(result[0].status).toBe("激活");
    // Original deployment is now at index 1
    expect(result[1].modelKey).toBe("leave");
  });

  it("does not mutate the original array", () => {
    const original = [...deployments];
    deployModelVersion(deployments, model);
    expect(deployments).toEqual(original);
  });
});

describe("toggleDeploymentStatus", () => {
  const deployments = [
    { id: "dep1", modelKey: "leave", modelName: "请假", category: "学生事务", version: 1, status: "激活", deployedAt: "2026-01-01" },
    { id: "dep2", modelKey: "dorm", modelName: "住宿", category: "宿舍事务", version: 1, status: "挂起", deployedAt: "2026-01-02" },
  ];

  it("toggles from 激活 to 挂起", () => {
    const result = toggleDeploymentStatus(deployments, "dep1");
    const toggled = result.find((d: { id: string; status: string }) => d.id === "dep1");
    expect(toggled?.status).toBe("挂起");
  });

  it("toggles from 挂起 to 激活", () => {
    const result = toggleDeploymentStatus(deployments, "dep2");
    const toggled = result.find((d: { id: string; status: string }) => d.id === "dep2");
    expect(toggled?.status).toBe("激活");
  });

  it("does not mutate the original array", () => {
    const original = [...deployments];
    toggleDeploymentStatus(deployments, "dep1");
    expect(deployments).toEqual(original);
  });

  it("leaves other deployments unchanged", () => {
    const result = toggleDeploymentStatus(deployments, "dep1");
    expect(result[1].status).toBe("挂起");
  });
});
