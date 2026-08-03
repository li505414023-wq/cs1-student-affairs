"use client";

import { ConfigRecordForm } from "./ConfigRecordForm";
import { BatchRecordForm } from "./BatchRecordForm";
import { ApplicationRecordForm } from "./ApplicationRecordForm";
import { ReviewRecordForm } from "./ReviewRecordForm";
import { ArchiveRecordForm } from "./ArchiveRecordForm";

type CurrentUser = { id: string; displayName: string; role: string } | null;

type FormField = { id: string; type: string; label: string; required: boolean };

export function BusinessRecordForm({ featureId, feature, stage, mode, onClose, onSave, currentUser, formFields, record }: {
  featureId: string; feature: string; stage: string; mode: "create" | "view";
  onClose: () => void; onSave: (data: Record<string, string>) => void;
  currentUser?: CurrentUser;
  formFields?: FormField[];
  record?: { status: string; data: Record<string, string | number> };
}) {
  const viewEntries = record ? Object.entries(record.data) : [];
  if (mode === "view" && record) {
    return (
      <div className="full-form-page">
        <div className="form-page-head">
          <div><p className="eyebrow">{feature} / 详情</p><h1>{feature}详情</h1></div>
          <button className="ghost" onClick={onClose}>关闭</button>
        </div>
        <div className="form-card">
          <p className="form-section-title">当前状态：<span className={`status ${record.status.includes("驳") || record.status.includes("拒") ? "danger" : record.status.includes("待") || record.status.includes("中") ? "pending" : ""}`}>{record.status || "未设置"}</span></p>
          <div className="form-grid">
            {viewEntries.map(([key, value]) => (
              <label key={key}><span>{key}</span><input value={String(value ?? "")} readOnly /></label>
            ))}
          </div>
          <p className="privacy-note">以上为数据库中保存的原始记录。</p>
          <div className="form-actions">
            <button className="ghost" type="button" onClick={onClose}>关闭</button>
          </div>
        </div>
      </div>
    );
  }

  const body = stage === "config" ? <ConfigRecordForm featureId={featureId} feature={feature} />
    : stage === "batch" ? <BatchRecordForm featureId={featureId} feature={feature} />
    : stage === "apply" ? <ApplicationRecordForm featureId={featureId} feature={feature} currentUser={currentUser} formFields={formFields} />
    : stage === "archive" ? <ArchiveRecordForm feature={feature} />
    : <ReviewRecordForm featureId={featureId} feature={feature} currentUser={currentUser} />;

  return (
    <div className="full-form-page">
      <div className="form-page-head">
        <div><p className="eyebrow">{feature} / {mode === "create" ? "新建" : "详情"}</p><h1>{mode === "create" ? `新建${feature}` : `${feature}详情`}</h1></div>
        <button className="ghost" onClick={onClose}>关闭</button>
      </div>
      <form className="form-card" onSubmit={(event) => { event.preventDefault(); const values = Object.fromEntries([...new FormData(event.currentTarget).entries()].map(([key, value]) => [key, String(value)])); onSave(values); }}>
        {body}
        <p className="privacy-note">业务数据将安全保存在云端数据库。</p>
        <div className="form-actions">
          <button className="primary" type="submit">{stage === "review" ? "提交审核意见" : "保存"}</button>
          <button className="ghost" type="button" onClick={onClose}>取消</button>
        </div>
      </form>
    </div>
  );
}
