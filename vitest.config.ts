import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["lib/**", "app/**/*.{js,ts,tsx}"],
      exclude: ["node_modules", ".next", "build"],
      // Baseline thresholds: deliberately set slightly below the measured
      // coverage (statements 28.5% / branches 27.1% / functions 30.5% /
      // lines 29.3% on 2026-08) so they guard against regressions without
      // blocking. Raise them as component test coverage grows.
      thresholds: {
        statements: 25,
        branches: 24,
        functions: 28,
        lines: 26,
      },
    },
  },
});
