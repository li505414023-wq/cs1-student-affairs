"use client";

import React from "react";
import { ErrorBoundary } from "./ErrorBoundary";

export function AppWrapper({ children }: { children: React.ReactNode }) {
  return <ErrorBoundary>{children}</ErrorBoundary>;
}
