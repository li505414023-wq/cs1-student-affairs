"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api-client";

export type EntityOption = { code: string; name: string };

/**
 * Fetch reference options for an entity feature, optionally filtered by a
 * parent code (for cascading selects). Returns [] on any error so the UI
 * degrades gracefully.
 */
export function useEntityOptions(feature: string, parentCode?: string | null): EntityOption[] {
  const [items, setItems] = useState<EntityOption[]>([]);
  useEffect(() => {
    let active = true;
    const params = new URLSearchParams({ feature });
    if (parentCode) params.set("parentCode", parentCode);
    api.get<{ items: EntityOption[] }>(`/api/reference/options?${params.toString()}`)
      .then((data) => { if (active) setItems(data.items ?? []); })
      .catch(() => { if (active) setItems([]); });
    return () => { active = false; };
  }, [feature, parentCode]);
  return items;
}
