// Registers a module resolution hook so the node:test track (tests/*.test.mjs)
// can import TypeScript sources that use the "@/" path alias
// (e.g. lib/security.ts imports "@/db"). Loaded via `node --import`.
import { register } from "node:module";

const root = new URL("../", import.meta.url).href;

const hookSource = `
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = ${JSON.stringify(root)};

export function resolve(specifier, context, nextResolve) {
  if (specifier === "@" || specifier.startsWith("@/")) {
    const relative = specifier === "@" ? "" : specifier.slice(2);
    for (const candidate of [relative + ".ts", relative + "/index.ts", relative + ".tsx", relative + ".js"]) {
      const url = new URL(candidate, root);
      try {
        if (existsSync(fileURLToPath(url))) return nextResolve(url.href, context);
      } catch {
        // ignore and try the next candidate
      }
    }
  }
  // Extensionless relative imports from TypeScript sources (e.g. "./schema").
  if ((specifier.startsWith("./") || specifier.startsWith("../")) && !/\\.[a-z]+$/i.test(specifier) && context.parentURL && /\\.tsx?$/.test(context.parentURL)) {
    const base = new URL(specifier + "/", context.parentURL);
    for (const suffix of [".ts", ".tsx", "/index.ts"]) {
      try {
        const url = new URL(base.href.slice(0, -1) + suffix);
        if (existsSync(fileURLToPath(url))) return nextResolve(url.href, context);
      } catch {
        // ignore and try the next candidate
      }
    }
  }
  return nextResolve(specifier, context);
}
`;

register(`data:text/javascript,${encodeURIComponent(hookSource)}`, import.meta.url);
