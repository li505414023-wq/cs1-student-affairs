import type { Metadata, Viewport } from "next";
import { AppWrapper } from "./components/AppWrapper";
import "./globals.css";

export const metadata: Metadata = {
  title: "智慧学工 · 学生事务管理平台",
  description: "面向高校学生事务的一体化工作平台:学籍、流程审批、助困奖助、宿舍与运维调度。",
  icons: { icon: "/favicon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#1b2a4a" },
    { media: "(prefers-color-scheme: dark)", color: "#0a1120" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <head>
      </head>
      <body>
        <AppWrapper>{children}</AppWrapper>
      </body>
    </html>
  );
}
