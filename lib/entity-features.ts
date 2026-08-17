/**
 * Registry of admin "managed entity" features backed by the managed_items table.
 *
 * `key` is the stable storage key inside data_json (never rename after release);
 * `label` is the display label and may change freely.
 *
 * Reserved column keys rendered from top-level columns:
 * name / code / description / status / sortOrder / parentName.
 */

export type EntityFieldType = "text" | "select" | "date" | "number" | "textarea" | "url";

export type EntityFieldSpec = {
  key: string;
  label: string;
  type?: EntityFieldType;
  required?: boolean;
  maxLength?: number;
  options?: string[];
};

export type EntityColumnSpec = { key: string; label: string };

export type EntityFeatureConfig = {
  featureId: string;
  label: string;
  nameLabel: string;
  description: string;
  hasCode?: boolean;
  hierarchical?: { parentFeature: string; parentLabel: string };
  columns: EntityColumnSpec[];
  fields: EntityFieldSpec[];
};

const ENABLE_STATUS: EntityColumnSpec = { key: "status", label: "启用状态" };

const dictColumns: EntityColumnSpec[] = [
  { key: "name", label: "名称" },
  { key: "code", label: "编码" },
  { key: "parentName", label: "所属字典" },
  { key: "value", label: "字典值" },
  { key: "sortOrder", label: "排序" },
  ENABLE_STATUS,
];

const dictFields: EntityFieldSpec[] = [{ key: "value", label: "字典值", maxLength: 100 }];

export const ENTITY_FEATURES: Record<string, EntityFeatureConfig> = {
  "faculty-admin": {
    featureId: "faculty-admin",
    label: "学院管理",
    nameLabel: "学院名称",
    description: "维护学院基础信息,作为专业与班级的上级组织。",
    hasCode: true,
    columns: [
      { key: "name", label: "学院名称" },
      { key: "code", label: "学院代码" },
      { key: "dean", label: "院长" },
      { key: "phone", label: "办公电话" },
      ENABLE_STATUS,
    ],
    fields: [
      { key: "dean", label: "院长", maxLength: 30 },
      { key: "phone", label: "办公电话", maxLength: 20 },
    ],
  },
  "major-admin": {
    featureId: "major-admin",
    label: "专业管理",
    nameLabel: "专业名称",
    description: "维护专业信息,隶属于学院。",
    hasCode: true,
    hierarchical: { parentFeature: "faculty-admin", parentLabel: "所属学院" },
    columns: [
      { key: "name", label: "专业名称" },
      { key: "code", label: "专业代码" },
      { key: "parentName", label: "所属学院" },
      { key: "level", label: "培养层次" },
      ENABLE_STATUS,
    ],
    fields: [{ key: "level", label: "培养层次", type: "select", options: ["本科", "专科"] }],
  },
  "corps-admin": {
    featureId: "corps-admin",
    label: "学生大队管理",
    nameLabel: "大队名称",
    description: "维护学生大队信息,隶属系部,一个院系只设一个大队;大队长直接管理本大队辅导员,辅导员管理自己的区队。",
    hasCode: true,
    hierarchical: { parentFeature: "faculty-admin", parentLabel: "所属系部" },
    columns: [
      { key: "name", label: "大队名称" },
      { key: "code", label: "大队代码" },
      { key: "parentName", label: "所属系部" },
      { key: "leader", label: "大队长" },
      { key: "gradeRange", label: "覆盖年级" },
      ENABLE_STATUS,
    ],
    fields: [
      { key: "leader", label: "大队长", maxLength: 30 },
      { key: "gradeRange", label: "覆盖年级", maxLength: 50 },
    ],
  },
  "class-admin": {
    featureId: "class-admin",
    label: "班级管理",
    nameLabel: "班级名称",
    description: "维护班级信息,隶属于专业。",
    hasCode: true,
    hierarchical: { parentFeature: "major-admin", parentLabel: "所属专业" },
    columns: [
      { key: "name", label: "班级名称" },
      { key: "code", label: "班级代码" },
      { key: "parentName", label: "所属专业" },
      { key: "grade", label: "年级" },
      { key: "corps", label: "所属大队" },
      { key: "headTeacher", label: "班主任" },
      ENABLE_STATUS,
    ],
    fields: [
      { key: "grade", label: "年级", maxLength: 10 },
      { key: "corps", label: "所属大队", maxLength: 50 },
      { key: "headTeacher", label: "班主任", maxLength: 30 },
    ],
  },
  "org-admin": {
    featureId: "org-admin",
    label: "机构管理",
    nameLabel: "机构名称",
    description: "维护行政/教学机构树,支持多级机构。",
    hasCode: true,
    hierarchical: { parentFeature: "org-admin", parentLabel: "上级机构" },
    columns: [
      { key: "name", label: "机构名称" },
      { key: "code", label: "机构代码" },
      { key: "parentName", label: "上级机构" },
      { key: "orgType", label: "机构类型" },
      { key: "leader", label: "负责人" },
      ENABLE_STATUS,
    ],
    fields: [
      { key: "orgType", label: "机构类型", type: "select", options: ["行政机构", "教学机构", "党群机构"] },
      { key: "leader", label: "负责人", maxLength: 30 },
      { key: "phone", label: "联系电话", maxLength: 20 },
    ],
  },
  "post-admin": {
    featureId: "post-admin",
    label: "岗位管理",
    nameLabel: "岗位名称",
    description: "维护岗位信息,用于用户岗位关联。",
    hasCode: true,
    columns: [
      { key: "name", label: "岗位名称" },
      { key: "code", label: "岗位代码" },
      { key: "category", label: "岗位类别" },
      { key: "sortOrder", label: "排序" },
      ENABLE_STATUS,
    ],
    fields: [{ key: "category", label: "岗位类别", type: "select", options: ["管理岗", "专技岗", "工勤岗"] }],
  },
  "system-dict": {
    featureId: "system-dict",
    label: "系统字典",
    nameLabel: "名称",
    description: "系统级字典维护:先建字典(如“性别”),再在其下建字典项(上级字典选择对应字典)。",
    hasCode: true,
    hierarchical: { parentFeature: "system-dict", parentLabel: "所属字典" },
    columns: dictColumns,
    fields: dictFields,
  },
  "business-dict": {
    featureId: "business-dict",
    label: "业务字典",
    nameLabel: "名称",
    description: "业务级字典维护:先建字典,再在其下建字典项(上级字典选择对应字典)。",
    hasCode: true,
    hierarchical: { parentFeature: "business-dict", parentLabel: "所属字典" },
    columns: dictColumns,
    fields: dictFields,
  },
  "flow-category": {
    featureId: "flow-category",
    label: "流程分类",
    nameLabel: "分类名称",
    description: "维护流程模型的分类体系。",
    hasCode: true,
    hierarchical: { parentFeature: "flow-category", parentLabel: "上级分类" },
    columns: [
      { key: "name", label: "分类名称" },
      { key: "code", label: "分类编码" },
      { key: "parentName", label: "上级分类" },
      { key: "sortOrder", label: "排序" },
      ENABLE_STATUS,
    ],
    fields: [],
  },
};

export function getEntityConfig(featureId: string): EntityFeatureConfig | undefined {
  return ENTITY_FEATURES[featureId];
}

export const ENTITY_FEATURE_IDS = Object.keys(ENTITY_FEATURES);

export function isEntityFeature(featureId: string): boolean {
  return featureId in ENTITY_FEATURES;
}
