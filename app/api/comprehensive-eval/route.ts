import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";
import { getDb } from "@/db";
import { businessRecords, counselorClasses, students } from "@/db/schema";
import { requirePermission } from "@/lib/auth";
import { fail, ok } from "@/lib/api";
import { comprehensiveEval, CONDUCT_BASE_SCORE } from "@/lib/handbook-rules";

export const runtime = "nodejs";

type Row = { dataJson: unknown };
const str = (value: unknown): string => (typeof value === "number" ? String(value) : typeof value === "string" ? value.trim() : "");
const data = (row: Row): Record<string, unknown> => (row.dataJson ?? {}) as Record<string, unknown>;

function currentTerm(): string {
  const now = new Date();
  const year = now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1;
  return `${year}-${year + 1}学年${now.getMonth() >= 1 && now.getMonth() <= 6 ? "第二学期" : "第一学期"}`;
}

export async function GET(request: NextRequest) {
  try {
    const session = await requirePermission(request, "read");
    const db = getDb();

    // 学生范围与记录列表共用同一数据权限(辅导员/院系管理员只看所带区队)。
    let classNames: string[] | null = null;
    let ownStudentNo: string | null = null;
    if (session.user.role === "counselor" || session.user.role === "department_admin") {
      const bindings = await db.select({ className: counselorClasses.className })
        .from(counselorClasses).where(eq(counselorClasses.userId, session.user.id));
      classNames = [...new Set(bindings.map((b) => b.className))];
    } else if (session.user.role === "student") {
      const [stu] = await db.select({ no: students.no }).from(students).where(eq(students.userId, session.user.id)).limit(1);
      ownStudentNo = stu?.no ?? "__none__";
    }

    const studentRows = await db.select().from(students);
    const scopedStudents = studentRows.filter((s) => {
      if (ownStudentNo) return s.no === ownStudentNo;
      if (classNames) return classNames.includes(s.className);
      return true;
    });
    const nos = scopedStudents.map((s) => s.no).filter(Boolean);

    const fetchFeature = async (featureId: string): Promise<Row[]> => {
      if (nos.length === 0) return [];
      const all = await db.select({ dataJson: businessRecords.dataJson })
        .from(businessRecords).where(eq(businessRecords.featureId, featureId));
      return all.filter((row) => nos.includes(str(data(row)["学号"])));
    };
    const [conductRows, scoreRows, physicalRows] = await Promise.all([
      fetchFeature("conduct-score"),
      fetchFeature("course-scores"),
      fetchFeature("physical-test"),
    ]);

    const term = currentTerm();
    const items = scopedStudents.map((student) => {
      // 德育:操行量化分 = 基础70 ± 加减分。
      let conductScore = CONDUCT_BASE_SCORE;
      for (const row of conductRows) {
        const d = data(row);
        if (str(d["学号"]) !== student.no) continue;
        const value = Number(str(d["分值"])) || 0;
        conductScore += str(d["加减分"]) === "扣分" ? -value : value;
      }
      // 智育:学年课程平均分。
      const scores = scoreRows
        .filter((row) => str(data(row)["学号"]) === student.no)
        .map((row) => Number(str(data(row)["课程成绩"])))
        .filter((value) => Number.isFinite(value));
      const courseAverage = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
      // 体育:学年两次体测,一项不合格该项计0分;无记录按合格处理。
      const passList = physicalRows
        .filter((row) => str(data(row)["学号"]) === student.no)
        .map((row) => str(data(row)["成绩评定"]) !== "不合格");
      const physicalPasses: [boolean, boolean] = [passList[0] ?? true, passList[1] ?? true];

      const result = comprehensiveEval({ conductScore, courseAverage, courseScores: scores, physicalPasses });
      return {
        学年: term, 姓名: student.name, 学号: student.no, 年级: student.grade, 专业: student.major,
        区队: student.className,
        德育分: result.moralScore, 智育分: result.academicScore, 体育分: result.physicalScore,
        总分: result.totalScore, 排名: 0,
        考核结果: result.vetoReasons.length > 0 ? `一票否决(${result.vetoReasons.join(";")})` : "合格",
      };
    });

    // 手册规定按年级×专业排名,作为评优与发展党员的依据。
    const groups = new Map<string, typeof items>();
    for (const item of items) {
      const key = `${item.年级}|${item.专业}`;
      const list = groups.get(key) ?? [];
      list.push(item);
      groups.set(key, list);
    }
    for (const list of groups.values()) {
      list.sort((a, b) => b.总分 - a.总分);
      list.forEach((item, index) => { item.排名 = index + 1; });
    }
    items.sort((a, b) => b.总分 - a.总分);

    return ok({ items, term, scope: { students: items.length, groups: groups.size } });
  } catch (error) {
    return fail(error, request);
  }
}
