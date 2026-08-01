"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Animates a number toward `target` with an ease-out curve. Honors
 * prefers-reduced-motion. Re-animates from the previous value when the
 * target changes (so refreshed stats glide instead of jumping).
 */
export function useCountUp(target: number, durationMs = 700): number {
  const [value, setValue] = useState(0);
  const fromRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    if (reduce || from === target) {
      setValue(target);
      fromRef.current = target;
      return;
    }
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        fromRef.current = target;
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      fromRef.current = target;
    };
  }, [target, durationMs]);

  return value;
}

export function CountUp({ value, suffix = "" }: { value: number; suffix?: string }) {
  const n = useCountUp(value);
  return <>{n}{suffix}</>;
}
