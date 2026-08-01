const nodeNames = {
  approval: "审批节点",
  copy: "抄送节点",
  condition: "条件分支",
};

export function appendWorkflowNode(nodes, type) {
  const endIndex = Math.max(0, nodes.findIndex((node) => node.type === "end"));
  const nextNode = {
    id: `${type}-${Date.now()}-${nodes.length}`,
    type,
    name: nodeNames[type] ?? "办理节点",
    assignee: type === "approval" ? "辅导员" : type === "copy" ? "学工处" : "按条件判断",
  };
  return [...nodes.slice(0, endIndex), nextNode, ...nodes.slice(endIndex)];
}

export function deployModelVersion(deployments, model) {
  const currentVersion = deployments
    .filter((deployment) => deployment.modelKey === model.key)
    .reduce((maximum, deployment) => Math.max(maximum, deployment.version), 0);
  const version = currentVersion + 1;
  const nextDeployment = {
    id: `${model.key}:${version}:${Date.now()}`,
    modelKey: model.key,
    modelName: model.name,
    category: model.category,
    version,
    status: "激活",
    deployedAt: new Date().toLocaleString("zh-CN", { hour12: false }),
  };
  return [nextDeployment, ...deployments];
}

export function toggleDeploymentStatus(deployments, id) {
  return deployments.map((deployment) => deployment.id === id
    ? { ...deployment, status: deployment.status === "激活" ? "挂起" : "激活" }
    : deployment);
}
