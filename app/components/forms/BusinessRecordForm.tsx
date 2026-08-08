"use client";

import { LEAVE_TYPES, PUNISHMENT_TYPES } from "@/lib/dictionaries.js";
import { FormSection } from "./FormSection";
import type { FieldSpec } from "./FormField";

type CurrentUser = { id: string; displayName: string; role: string } | null;

type FormField = { id: string; type: string; label: string; required: boolean };

type RecordProp = { status: string; data: Record<string, string | number> };

// 身份字段由当前登录用户自动填充，界面隐藏但随表单提交。
const IDENTITY_LABELS = ["姓名", "学号", "申请人", "用户ID"];

const identityValueFor = (label: string, currentUser?: CurrentUser) =>
  label === "姓名" || label === "申请人" ? currentUser?.displayName ?? "当前用户" : currentUser?.id ?? "";

function ConfigFields({ featureId, feature }: { featureId: string; feature: string }) {
  const schemas: Record<string, FieldSpec[]> = {
    "dorm-building": [{ label: "所属校区", required: true, type: "select", options: ["滨湖校区", "城南校区"] }, { label: "楼栋名称", required: true }, { label: "楼栋代码", required: true }, { label: "楼层数", required: true, type: "number" }, { label: "住宿性别", required: true, type: "select", options: ["男", "女", "混合"] }, { label: "楼栋管理员", type: "select", options: ["王老师", "李老师"] }, { label: "联系电话" }, { label: "楼栋地址" }, { label: "启用状态", type: "select", options: ["启用", "停用"] }],
    "dorm-room": [{ label: "所属楼栋", required: true, type: "select", options: ["海棠1号楼", "海棠2号楼"] }, { label: "房间号", required: true }, { label: "所在楼层", required: true, type: "number" }, { label: "房间类型", required: true, type: "select", options: ["四人间", "六人间", "八人间"] }, { label: "床位数量", required: true, type: "number" }, { label: "住宿费用", type: "number" }, { label: "房间状态", type: "select", options: ["正常", "维修", "停用"] }, { label: "房间设施", type: "textarea" }],
    "welcome-process": [{ label: "环节名称", required: true }, { label: "环节代码", required: true }, { label: "办理顺序", required: true, type: "number" }, { label: "责任部门", required: true, type: "select", options: ["招生办", "财务处", "学生处", "后勤处"] }, { label: "是否必办", type: "select" }, { label: "办理地址" }, { label: "办理说明", type: "textarea" }],
  };
  const fields = schemas[featureId] ?? [{ label: "名称", required: true }, { label: "业务编码", required: true }, { label: "排序号", type: "number", value: "1" }, { label: "启用状态", required: true, type: "select", options: ["启用", "停用"] }, { label: "适用范围", type: "select", options: ["全校", "指定院系", "指定年级"] }, { label: "说明", type: "textarea" }];
  return <><FormSection title={`${feature}配置`} fields={fields} /><FormSection title="规则设置" fields={[{ label: "生效日期", type: "date" }, { label: "失效日期", type: "date" }, { label: "是否允许修改", type: "select" }]} /></>;
}

function BatchFields({ featureId, feature }: { featureId: string; feature: string }) {
  const allocationFields: FieldSpec[] = featureId === "dorm-batch" ? [{ label: "适用性别", type: "select", options: ["男", "女"] }, { label: "适用院系", type: "select", options: ["全部院系", "信息工程学院", "商学院"] }, { label: "可分配楼栋", type: "select", options: ["全部楼栋", "海棠1号楼", "梧桐3号楼"] }, { label: "排宿方式", type: "select", options: ["按班级集中", "按学院集中", "随机分配"] }] : [{ label: "适用院系", type: "select", options: ["全部院系", "信息工程学院", "商学院"] }, { label: "院系名额", type: "number" }];
  return <><FormSection title={`${feature}基本信息`} fields={[{ label: "批次名称", required: true }, { label: "学年", required: true, type: "select", options: ["2026-2027", "2025-2026"] }, { label: "申请开始时间", required: true, type: "date" }, { label: "申请结束时间", required: true, type: "date" }, { label: featureId === "dorm-batch" ? "计划人数" : "总名额", required: true, type: "number" }, { label: "发布状态", type: "select", options: ["草稿", "已发布", "已结束"] }, { label: "批次说明", type: "textarea" }]} /><FormSection title={featureId === "dorm-batch" ? "排宿范围与规则" : "院系名额分配"} fields={allocationFields} /></>;
}

function ApplyFields({ featureId, feature, currentUser, formFields }: { featureId: string; feature: string; currentUser?: CurrentUser; formFields?: FormField[] }) {
  const domainFields: Record<string, FieldSpec[]> = {
    // 姓名/学号为身份字段，自动填充并隐藏；请假天数由起止日期自动计算（结束-开始+1），不再手填。
    leave: [{ label: "姓名", required: true }, { label: "学号", required: true }, { label: "请假类型", required: true, type: "select", options: LEAVE_TYPES }, { label: "开始时间", required: true, type: "date" }, { label: "结束时间", required: true, type: "date" }, { label: "请假原因", required: true, type: "textarea" }],
    discipline: [{ label: "违纪类型", required: true, type: "select", options: ["校纪校规", "考试纪律", "宿舍纪律"] }, { label: "违纪时间", required: true, type: "date" }, { label: "违纪地点", required: true }, { label: "违纪事实", required: true, type: "textarea" }],
    "club-apply": [{ label: "社团名称", required: true }, { label: "社团类别", required: true, type: "select", options: ["学术科技", "文化体育", "公益实践"] }, { label: "指导教师", required: true }, { label: "社团简介", required: true, type: "textarea" }],
    "student-card": [{ label: "申办类型", required: true, type: "select", options: ["遗失补办", "损坏换发"] }, { label: "申请原因", required: true, type: "textarea" }],
    // 手册:接到处分决定书之日起10日内可向学申委提出书面申诉(服务端校验时限)。
    appeal: [{ label: "处分类型", required: true, type: "select", options: PUNISHMENT_TYPES }, { label: "处分决定书日期", required: true, type: "date" }, { label: "申诉理由", required: true, type: "textarea" }],
  };
  // 有 FormDesigner 字段时优先使用，否则回退到内置领域字段。
  const typeMap: Record<string, FieldSpec["type"]> = { "单行文本": "text", "多行文本": "textarea", "下拉选择": "select", "日期": "date", "金额": "number", "附件": "text" };
  const fields = formFields && formFields.length > 0
    ? formFields.map((field) => ({ label: field.label, required: field.required, type: typeMap[field.type] ?? "text" as const }))
    : domainFields[featureId] ?? [{ label: "申请类型", required: true, type: "select" as const, options: ["个人申请", "集体申请"] }, { label: "申请陈述", required: true, type: "textarea" as const }];
  const hiddenLabels = [...new Set(["申请人", "用户ID", ...fields.map((field) => field.label).filter((label) => IDENTITY_LABELS.includes(label))])];
  return <>
    {hiddenLabels.map((label) => <input key={label} type="hidden" name={label} value={identityValueFor(label, currentUser)} />)}
    <FormSection title={`${feature}申请信息`} fields={fields.filter((field) => !IDENTITY_LABELS.includes(field.label))} />
    <FormSection title="附件材料" fields={[{ label: "附件材料", placeholder: "选择或拖入证明材料" }, { label: "补充说明", type: "textarea" }]} />
  </>;
}

function ReviewFields({ featureId, feature, currentUser }: { featureId: string; feature: string; currentUser?: CurrentUser }) {
  const displayName = currentUser?.displayName ?? "当前审核人";
  const detailFields: FieldSpec[] = featureId.includes("scholarship") || featureId.includes("grant") || featureId.includes("hardship")
    ? [{ label: "申请种类", value: feature }, { label: "申请等级", value: "待审核" }, { label: "申请陈述", type: "textarea", value: "" }]
    : [{ label: "业务类型", value: feature }, { label: "申请时间", value: new Date().toISOString().slice(0, 10) }, { label: "申请陈述", type: "textarea", value: "" }];
  return <>
    <FormSection title="申请人信息" fields={[{ label: "申请人", value: displayName }, { label: "角色", value: currentUser?.role ?? "" }]} />
    <FormSection title={`${feature}申请详情`} fields={detailFields} />
    <FormSection title="审核处理" fields={[{ label: "审核结论", required: true, type: "select", options: ["同意", "退回修改", "不同意"] }, { label: "审核意见", required: true, type: "textarea" }, { label: "下一审核人", type: "select", options: ["院系管理员", "学工处管理员"] }]} />
    <div className="audit-trail"><strong>审核记录</strong><ol><li><span />{displayName} 正在处理审核 <small>{new Date().toLocaleString("zh-CN")}</small></li></ol></div>
  </>;
}

function ArchiveFields({ feature, record }: { feature: string; record?: RecordProp }) {
  if (!record) return <p className="empty-state">暂无可归档的记录数据，请先从列表中选择已办结的记录。</p>;
  return <FormSection title={`${feature}归档信息`}><div className="form-grid">{Object.entries(record.data).map(([key, value]) => <label key={key}><span>{key}</span><span>{String(value ?? "")}</span></label>)}</div></FormSection>;
}

export function BusinessRecordForm({ featureId, feature, stage, mode, onClose, onSave, currentUser, formFields, record, onDelete }: {
  featureId: string; feature: string; stage: string; mode: "create" | "view" | "edit";
  onClose: () => void; onSave: (data: Record<string, string>) => void;
  currentUser?: CurrentUser;
  formFields?: FormField[];
  record?: RecordProp;
  onDelete?: () => void;
}) {
  const viewEntries = record ? Object.entries(record.data) : [];
  if (mode === "view" && record) {
    return (
      <div className="full-form-page">
        <div className="form-page-head"><div><p className="eyebrow">{feature} / 详情</p><h1>{feature}详情</h1></div><button className="ghost" onClick={onClose}>关闭</button></div>
        <div className="form-card">
          <p className="form-section-title">当前状态：<span className={`status ${record.status.includes("驳") || record.status.includes("拒") ? "danger" : record.status.includes("待") || record.status.includes("中") ? "pending" : ""}`}>{record.status || "未设置"}</span></p>
          <div className="form-grid">
            {viewEntries.map(([key, value]) => <label key={key}><span>{key}</span><input value={String(value ?? "")} readOnly /></label>)}
          </div>
          <p className="privacy-note">以上为数据库中保存的原始记录。</p>
          <div className="form-actions"><button className="ghost" type="button" onClick={onClose}>关闭</button></div>
        </div>
      </div>
    );
  }

  // 编辑模式：按字段回填既有数据，保存时更新同一条记录。
  if (mode === "edit" && record) {
    return (
      <div className="full-form-page">
        <div className="form-page-head"><div><p className="eyebrow">{feature} / 编辑</p><h1>编辑{feature}</h1></div><button className="ghost" onClick={onClose}>关闭</button></div>
        <form className="form-card" onSubmit={(event) => { event.preventDefault(); const values = Object.fromEntries([...new FormData(event.currentTarget).entries()].map(([key, value]) => [key, String(value)])); onSave(values); }}>
          <p className="form-section-title">当前状态：<span className="status">{record.status || "未设置"}</span></p>
          <div className="form-grid">
            {viewEntries.map(([key, value]) => <label key={key}><span>{key}</span><input name={key} defaultValue={String(value ?? "")} /></label>)}
          </div>
          <p className="privacy-note">修改后保存将直接更新数据库中的这条记录。</p>
          <div className="form-actions">
            {onDelete && <button className="ghost" type="button" onClick={() => { if (window.confirm("确定删除这条记录吗？删除后不可恢复。")) onDelete(); }}>删除记录</button>}
            <button className="ghost" type="button" onClick={onClose}>取消</button>
            <button className="primary" type="submit">保存修改</button>
          </div>
        </form>
      </div>
    );
  }

  const body = stage === "config" ? <ConfigFields featureId={featureId} feature={feature} />
    : stage === "batch" ? <BatchFields featureId={featureId} feature={feature} />
    : stage === "apply" ? <ApplyFields featureId={featureId} feature={feature} currentUser={currentUser} formFields={formFields} />
    : stage === "archive" ? <ArchiveFields feature={feature} record={record} />
    : <ReviewFields featureId={featureId} feature={feature} currentUser={currentUser} />;

  return (
    <div className="full-form-page">
      <div className="form-page-head"><div><p className="eyebrow">{feature} / {mode === "create" ? "新建" : "详情"}</p><h1>{mode === "create" ? `新建${feature}` : `${feature}详情`}</h1></div><button className="ghost" onClick={onClose}>关闭</button></div>
      <form className="form-card" onSubmit={(event) => {
        event.preventDefault();
        const values = Object.fromEntries([...new FormData(event.currentTarget).entries()].map(([key, value]) => [key, String(value)]));
        if (stage === "apply") {
          const start = Date.parse(values["开始时间"] ?? "");
          const end = Date.parse(values["结束时间"] ?? "");
          if (!Number.isNaN(start) && !Number.isNaN(end)) values["请假天数"] = String(Math.round((end - start) / 86400000) + 1);
        }
        onSave(values);
      }}>
        {body}
        <p className="privacy-note">业务数据将安全保存在云端数据库。</p>
        <div className="form-actions"><button className="primary" type="submit">{stage === "review" ? "提交审核意见" : "保存"}</button><button className="ghost" type="button" onClick={onClose}>取消</button></div>
      </form>
    </div>
  );
}
