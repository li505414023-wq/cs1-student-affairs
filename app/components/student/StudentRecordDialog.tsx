"use client";

import { useEffect, useState, useRef, type FormEvent } from "react";
import { FormSection } from "../forms/FormSection";
import { FormField, type FieldSpec } from "../forms/FormField";
import { useEntityOptions } from "../shared/use-entity-options";
import { validateStudentInput } from "@/lib/validation";
import type { StudentEditor, StudentRecord } from "./student-types";

const PATH_TO_LABEL: Record<string, string> = {
  name: "姓名", no: "学号", phone: "移动电话", gender: "性别",
  faculty: "院系名称", major: "专业名称", className: "班级名称", grade: "入学年级", birthDate: "出生日期",
};

function yearOptions(): string[] {
  const y = new Date().getFullYear();
  return [String(y), String(y - 1), String(y - 2), String(y - 3)];
}

export function StudentRecordDialog({ editor, onClose, onSave }: { editor: NonNullable<StudentEditor>; onClose: () => void; onSave: (student: StudentRecord) => void }) {
  const [photoName, setPhotoName] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const photoInput = useRef<HTMLInputElement>(null);
  const isCreate = editor.mode === "create";
  const readOnly = editor.mode === "view";

  // Cascading org selects (faculty → major → class), fed by reference data.
  const [facultyCode, setFacultyCode] = useState("");
  const [majorCode, setMajorCode] = useState("");
  const [classCode, setClassCode] = useState("");
  const [grade, setGrade] = useState(editor.student?.grade ?? "");
  const faculties = useEntityOptions("faculty-admin");
  const majors = useEntityOptions("major-admin", facultyCode || null);
  const classes = useEntityOptions("class-admin", majorCode || null);

  // On edit, resolve stored names → codes once the option lists arrive.
  useEffect(() => {
    if (isCreate || facultyCode || !editor.student?.faculty) return;
    const match = faculties.find((f) => f.name === editor.student?.faculty);
    if (match) setFacultyCode(match.code);
  }, [faculties, editor.student, facultyCode, isCreate]);
  useEffect(() => {
    if (isCreate || majorCode || !editor.student?.major) return;
    const match = majors.find((m) => m.name === editor.student?.major);
    if (match) setMajorCode(match.code);
  }, [majors, editor.student, majorCode, isCreate]);
  useEffect(() => {
    if (isCreate || classCode || !editor.student?.className) return;
    const match = classes.find((c) => c.name === editor.student?.className);
    if (match) setClassCode(match.code);
  }, [classes, editor.student, classCode, isCreate]);

  const facultyName = faculties.find((f) => f.code === facultyCode)?.name ?? (!isCreate ? editor.student?.faculty ?? "" : "");
  const majorName = majors.find((m) => m.code === majorCode)?.name ?? (!isCreate ? editor.student?.major ?? "" : "");
  const className = classes.find((c) => c.code === classCode)?.name ?? (!isCreate ? editor.student?.className ?? "" : "");

  const basicFields: FieldSpec[] = [
    { label: "学号", required: true }, { label: "姓名", required: true }, { label: "英文姓名" },
    { label: "性别", required: true, type: "select", options: ["男", "女"] },
    { label: "出生日期", required: true, type: "date" },
    { label: "民族", required: true, type: "select", options: ["汉族", "壮族", "回族", "其他"] }, { label: "学制", required: true, type: "number", value: "3" },
  ];
  const statusFields: FieldSpec[] = [
    { label: "籍贯" }, { label: "国籍地区码", required: true, type: "select", options: ["中国", "其他"] },
    { label: "证件类型", required: true, type: "select", options: ["居民身份证", "护照", "其他"] }, { label: "身份证件号", required: true },
    { label: "证件有效期", required: true, type: "date" }, { label: "政治面貌", required: true, type: "select", options: ["群众", "共青团员", "中共党员"] },
    { label: "就读方式", required: true, type: "select", options: ["全日制", "非全日制"] }, { label: "入学方式", required: true, type: "select", options: ["统一招生", "自主招生"] },
    { label: "入学日期", required: true, type: "date" }, { label: "学生来源", required: true, type: "select", options: ["应届", "往届", "其他"] },
    { label: "录取类别", required: true, type: "select", options: ["普通录取", "专项录取"] }, { label: "培养层次", required: true, type: "select", options: ["专科", "本科"] },
    { label: "学历方式", required: true, type: "select", options: ["普通教育", "成人教育"] }, { label: "学生类别", required: true, type: "select", options: ["普通学生", "留学生"] },
    { label: "婚姻状况", required: true, type: "select", options: ["未婚", "已婚"] }, { label: "港澳台侨", type: "select", options: ["否", "是"] },
    { label: "健康状况", type: "select", options: ["健康", "良好", "其他"] }, { label: "血型", required: true, type: "select", options: ["A型", "B型", "AB型", "O型", "未知"] },
    { label: "是否独生子女", required: true, type: "select" }, { label: "是否走读", required: true, type: "select" },
    { label: "学生当前状态", required: true, type: "select", options: ["在读", "休学", "退学", "毕业"] },
  ];
  const personalFields: FieldSpec[] = [
    { label: "移动电话", required: true }, { label: "QQ号" }, { label: "微信号" }, { label: "电子信箱" }, { label: "现地址" },
  ];
  const welcomeFields: FieldSpec[] = [
    { label: "是否属于迎新批次", required: true, type: "select", options: ["是", "否"] },
    { label: "迎新批次", type: "select", options: ["2026 秋季迎新", "2026 春季迎新"] },
  ];
  const values: Record<string, string | undefined> = { 学号: editor.student?.no, 姓名: editor.student?.name, 性别: editor.student?.gender, 出生日期: editor.student?.birthDate, 移动电话: editor.student?.phone, 现地址: editor.student?.address };
  const hydrate = (fields: FieldSpec[]) => fields.map((field) => {
    const existing = values[field.label];
    if (existing) return { ...field, value: existing };
    if (editor.mode !== "create" && field.required) return { ...field, value: field.options?.[0] ?? (field.type === "date" ? "2026-07-19" : field.type === "number" ? "1" : "演示信息") };
    return field;
  });
  const title = editor.mode === "create" ? "添加学生" : editor.mode === "edit" ? "编辑学生" : "学生详情";

  const cascadeSelect = (label: string, value: string, options: Array<{ code: string; name: string }>, onChange: (code: string) => void, placeholder: string) => (
    <label>
      <span><b className="required">*</b>{label}</span>
      <select value={value} disabled={readOnly} aria-invalid={!!errors[label]} onChange={(event) => onChange(event.target.value)}>
        <option value="">{placeholder}</option>
        {options.map((option) => <option key={option.code} value={option.code}>{option.name}</option>)}
      </select>
      {errors[label] && <span className="field-error" role="alert">{errors[label]}</span>}
    </label>
  );

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload: StudentRecord = {
      name: String(data.get("姓名") ?? ""), no: String(data.get("学号") ?? ""), phone: String(data.get("移动电话") ?? ""),
      gender: String(data.get("性别") ?? ""), faculty: facultyName, major: majorName, className, grade,
      birthDate: String(data.get("出生日期") ?? ""), address: String(data.get("现地址") ?? ""), status: String(data.get("学生当前状态") ?? "在读"),
    };
    const next: Record<string, string> = {};
    const validated = validateStudentInput(payload);
    if (!validated.success) for (const issue of validated.errors) {
      next[PATH_TO_LABEL[issue.field] ?? issue.field] = issue.message;
    }
    if (isCreate) {
      if (!facultyName) next["院系名称"] = "请选择院系";
      if (!majorName) next["专业名称"] = "请选择专业";
      if (!className) next["班级名称"] = "请选择班级";
      if (!grade) next["入学年级"] = "请选择年级";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return;
    onSave(payload);
  };

  return <div className="full-form-page"><div className="form-page-head"><div><p className="eyebrow">学生管理 / {title}</p><h1>{title}</h1></div><button className="ghost" onClick={onClose}>关闭</button></div><form className="form-card" noValidate onSubmit={submit} onReset={() => { setFacultyCode(""); setMajorCode(""); setClassCode(""); setGrade(""); setErrors({}); setPhotoName(""); }}><FormSection title="基本信息"><div className="photo-and-fields"><div className="photo-upload"><button className="photo-box" type="button" disabled={readOnly} onClick={() => photoInput.current?.click()}>＋</button><strong>{photoName || "照片"}</strong><small>建议上传一寸免冠照片<br />像素 413×295 左右</small><input ref={photoInput} className="file-input" type="file" accept="image/*" onChange={(event) => setPhotoName(event.target.files?.[0]?.name ?? "")} /></div><div className="form-grid">{hydrate(basicFields).map((field) => <FormField key={field.label} field={field} readOnly={readOnly} error={errors[field.label]} />)}{!readOnly ? <>{cascadeSelect("院系名称", facultyCode, faculties, (code) => { setFacultyCode(code); setMajorCode(""); setClassCode(""); }, "请选择院系")}{cascadeSelect("专业名称", majorCode, majors, (code) => { setMajorCode(code); setClassCode(""); }, facultyCode ? "请选择专业" : "请先选择院系")}{cascadeSelect("班级名称", classCode, classes, setClassCode, majorCode ? "请选择班级" : "请先选择专业")}<label><span><b className="required">*</b>入学年级</span><select value={grade} aria-invalid={!!errors["入学年级"]} onChange={(event) => setGrade(event.target.value)}>{!grade && <option value="">请选择年级</option>}{yearOptions().map((y) => <option key={y} value={y}>{y}</option>)}</select>{errors["入学年级"] && <span className="field-error" role="alert">{errors["入学年级"]}</span>}</label></> : <>{facultyName && <label><span>院系名称</span><input value={facultyName} readOnly /></label>}{majorName && <label><span>专业名称</span><input value={majorName} readOnly /></label>}{className && <label><span>班级名称</span><input value={className} readOnly /></label>}{grade && <label><span>入学年级</span><input value={grade} readOnly /></label>}</>}</div></div></FormSection><FormSection title="学籍信息" fields={hydrate(statusFields)} readOnly={readOnly} errors={errors} /><FormSection title="个人信息" fields={hydrate(personalFields)} readOnly={readOnly} errors={errors} /><FormSection title="迎新信息" fields={hydrate(welcomeFields)} readOnly={readOnly} errors={errors} /><p className="privacy-note">学生信息将安全保存在云端 PostgreSQL 数据库。</p><div className="form-actions">{!readOnly && <button className="primary" type="submit">▣ 保存</button>}{!readOnly && <button className="ghost" type="reset">清空</button>}<button className="ghost" type="button" onClick={onClose}>{readOnly ? "返回" : "取消"}</button></div></form></div>;
}
