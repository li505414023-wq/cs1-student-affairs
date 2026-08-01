export type StudentRecord = { name: string; no: string; phone: string; gender: string; faculty: string; major: string; className: string; grade: string; birthDate: string; address: string; id?: string; status?: string };

export type StudentEditor = { mode: "create" | "view" | "edit"; student?: StudentRecord } | null;

export type AuthSession = { user: { id: string; username: string; displayName: string; role: string; roleTags: string[] }; csrfToken: string };

export type StudentFilters = { name: string; no: string; phone: string; faculty: string; major: string; className: string; grade: string };

export type StudentQuery = { page: number; pageSize: number; keyword: string; faculty: string; major: string; className: string; grade: string };

export const emptyStudentQuery: StudentQuery = { page: 1, pageSize: 10, keyword: "", faculty: "", major: "", className: "", grade: "" };

export type ImportError = { row: number; message: string };
export type ImportedRecord = Record<string, string>;

export const emptyStudentFilters: StudentFilters = { name: "", no: "", phone: "", faculty: "", major: "", className: "", grade: "" };

export const studentFilterSpecs: Array<{ key: keyof StudentFilters; label: string; placeholder: string }> = [
  { key: "name", label: "姓名", placeholder: "请输入姓名" },
  { key: "no", label: "学号", placeholder: "请输入学号" },
  { key: "phone", label: "手机号", placeholder: "请输入手机号" },
  { key: "faculty", label: "院系名称", placeholder: "请输入院系名称" },
  { key: "major", label: "专业名称", placeholder: "请输入专业名称" },
  { key: "className", label: "班级名称", placeholder: "请输入班级名称" },
  { key: "grade", label: "年级", placeholder: "请选择年级" },
];

export const studentColumns = ["姓名", "学号", "手机号", "性别", "院系名称", "专业名称", "班级名称", "年级", "出生日期", "现住址"];

export function studentCell(student: StudentRecord, column: string) {
  const keys: Record<string, keyof StudentRecord> = { 姓名: "name", 学号: "no", 手机号: "phone", 性别: "gender", 院系名称: "faculty", 专业名称: "major", 班级名称: "className", 年级: "grade", 出生日期: "birthDate", 现住址: "address" };
  return String(student[keys[column]] ?? "");
}
