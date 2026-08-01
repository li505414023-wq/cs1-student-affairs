"use client";

import React from "react";

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "60vh", padding: "40px", textAlign: "center" }}>
          <h1 style={{ fontSize: "24px", marginBottom: "12px" }}>页面出现异常</h1>
          <p style={{ color: "var(--color-text-secondary)", marginBottom: "20px" }}>
            {this.state.error?.message ?? "未知错误"}
          </p>
          <button
            className="primary"
            onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
          >
            刷新页面
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
