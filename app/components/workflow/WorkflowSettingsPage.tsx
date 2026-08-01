"use client";

import { useState } from "react";
import { ModuleTitle } from "./ModuleTitle";

const settingDefinitions: Record<string, { title: string; action: string; columns: string[]; examples: string[][] }> = {
  "flow-button": { title: "流程按钮", action: "新增流程按钮", columns: ["按钮名称", "按钮编码", "触发动作", "启用状态"], examples: [["同意", "agree", "提交下一节点", "启用"], ["退回", "reject", "退回上一节点", "启用"]] },
  "flow-category": { title: "流程分类", action: "新增流程分类", columns: ["分类名称", "分类编码", "流程数量", "启用状态"], examples: [["学生事务", "student", "8", "启用"], ["宿舍事务", "dorm", "5", "启用"]] },
  "form-default": { title: "表单默认值", action: "新增默认值", columns: ["表单名称", "字段名称", "默认值表达式", "启用状态"], examples: [["学生请假申请表", "申请人", "${currentUser}", "启用"], ["住宿申办表", "申请时间", "${now}", "启用"]] },
  "flow-expression": { title: "流程表达式", action: "新增流程表达式", columns: ["表达式名称", "表达式编码", "表达式内容", "启用状态"], examples: [["请假天数大于三天", "leave_gt_3", "days > 3", "启用"], ["金额超过五千", "amount_gt_5000", "amount > 5000", "启用"]] },
};

export function WorkflowSettingsPage({ featureId }: { featureId: string }) {
  const definition = settingDefinitions[featureId];
  const [rows, setRows] = useState(definition.examples);
  const [notice, setNotice] = useState("");
  const addRecord = () => setRows((current) => [[`${definition.title}${current.length + 1}`, `${featureId}_${current.length + 1}`, "待配置", "启用"], ...current]);
  return <section className="workflow-workbench">{notice && <div className="action-notice" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice("")}>×</button></div>}<ModuleTitle title={definition.title} description={`配置${definition.title}，供模型和流程节点统一引用。`} action={definition.action} onAction={() => { addRecord(); setNotice(`已新增一条${definition.title}记录`); }} /><div className="workflow-table"><table><thead><tr>{definition.columns.map((column) => <th key={column}>{column}</th>)}<th>操作</th></tr></thead><tbody>{rows.map((row, rowIndex) => <tr key={`${featureId}-${rowIndex}`}>{row.map((cell, index) => <td key={definition.columns[index]}>{index === row.length - 1 ? <span className="status">{cell}</span> : cell}</td>)}<td><button className="link-button" onClick={() => { setRows((current) => current.map((item, index) => index === rowIndex ? item.map((cell, cellIndex) => cellIndex === item.length - 1 ? (cell === "启用" ? "停用" : "启用") : cell) : item)); setNotice("配置状态已更新"); }}>切换状态</button><button className="link-button" onClick={() => setRows((current) => current.filter((_, index) => index !== rowIndex))}>删除</button></td></tr>)}</tbody></table></div></section>;
}
