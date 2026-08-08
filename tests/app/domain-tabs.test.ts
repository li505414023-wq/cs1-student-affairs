import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { DOMAIN_TABS } from "@/app/domain-tabs";

describe("domain tabs", () => {
  it("keeps DOMAIN_TABS sub-features in sync with the seed script", async () => {
    const seedSource = await readFile(new URL("../../scripts/seed-full-test-data.mjs", import.meta.url), "utf8");
    const block = seedSource.match(/domainSubFeatures = \[([\s\S]*?)\];/);
    expect(block).not.toBeNull();
    const seeded = new Set([...(block?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((match) => match[1]));

    const configured = new Set<string>();
    for (const [entryId, tabs] of Object.entries(DOMAIN_TABS)) {
      for (const tab of tabs) {
        if (tab.featureId !== entryId) configured.add(tab.featureId);
      }
    }

    expect([...configured].filter((id) => !seeded.has(id))).toEqual([]);
    expect([...seeded].filter((id) => !configured.has(id))).toEqual([]);
  });
});
