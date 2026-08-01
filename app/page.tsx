import type { Metadata } from "next";
import StudentAffairsApp from "./StudentAffairsApp";

export const metadata: Metadata = {
  title: "智慧学工管理系统 · 本地原型",
  description: "智慧学工管理系统全模块本地交互原型",
};

export default function Home() {
  return <StudentAffairsApp />;
}
