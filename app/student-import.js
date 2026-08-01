export const REQUIRED_STUDENT_COLUMNS = [
  "学号", "姓名", "性别", "院系名称", "专业名称", "班级名称",
  "入学年级", "出生日期", "民族", "学制", "移动电话",
];

export function parseCsv(text) {
  const source = text.replace(/^\uFEFF/, "");
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (character === '"') {
      if (quoted && source[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === "," && !quoted) {
      row = [...row, cell.trim()];
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && source[index + 1] === "\n") index += 1;
      row = [...row, cell.trim()];
      if (row.some((value) => value !== "")) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
  }

  row = [...row, cell.trim()];
  if (row.some((value) => value !== "")) rows.push(row);
  return rows;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

export function validateStudentRows(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return { validRows: [], errors: [{ row: 0, message: "文件中没有可读取的数据" }] };
  }

  const headers = rows[0].map((header) => String(header ?? "").trim());
  const missing = REQUIRED_STUDENT_COLUMNS.filter((column) => !headers.includes(column));
  if (missing.length > 0) {
    return { validRows: [], errors: [{ row: 1, message: `缺少必填列：${missing.join("、")}` }] };
  }

  const seenStudentNumbers = new Set();
  const validRows = [];
  const errors = [];

  rows.slice(1).forEach((cells, rowIndex) => {
    const rowNumber = rowIndex + 2;
    const record = Object.fromEntries(headers.map((header, index) => [header, String(cells[index] ?? "").trim()]));
    const rowErrors = [];

    REQUIRED_STUDENT_COLUMNS.forEach((column) => {
      if (!record[column]) rowErrors.push(`${column}不能为空`);
    });
    if (record["性别"] && !["男", "女"].includes(record["性别"])) rowErrors.push("性别只能填写男或女");
    if (record["入学年级"] && !/^\d{4}$/.test(record["入学年级"])) rowErrors.push("入学年级必须为四位年份");
    if (record["出生日期"] && !isValidDate(record["出生日期"])) rowErrors.push("出生日期格式应为 YYYY-MM-DD");
    if (record["学制"] && (!/^\d+$/.test(record["学制"]) || Number(record["学制"]) < 1 || Number(record["学制"]) > 8)) rowErrors.push("学制必须为 1 至 8 年");
    if (record["移动电话"] && !/^1\d{10}$/.test(record["移动电话"])) rowErrors.push("移动电话必须为 11 位号码");
    if (record["学号"] && seenStudentNumbers.has(record["学号"])) rowErrors.push(`重复学号：${record["学号"]}`);
    if (record["学号"]) seenStudentNumbers.add(record["学号"]);

    if (rowErrors.length > 0) {
      rowErrors.forEach((message) => errors.push({ row: rowNumber, message }));
    } else {
      validRows.push(record);
    }
  });

  if (rows.length === 1) errors.push({ row: 1, message: "模板中没有学生数据行" });
  return { validRows, errors };
}

export function createStudentTemplateCsv() {
  const example = ["20260088", "顾明澈", "男", "信息工程学院", "软件技术", "软件2601", "2026", "2008-03-12", "汉族", "3", "13800001234"];
  return `\uFEFF${REQUIRED_STUDENT_COLUMNS.join(",")}\r\n${example.join(",")}\r\n`;
}
