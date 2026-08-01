import { ApiError } from "./api";

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Purge expired entries every 60 seconds to prevent unbounded memory growth
const CLEANUP_INTERVAL = 60_000;
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
  }, CLEANUP_INTERVAL);
}

export function enforceRateLimit(key: string, limit = 60, windowMs = 60_000) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return;
  }
  if (current.count >= limit) throw new ApiError(429, "请求过于频繁，请稍后重试");
  buckets.set(key, { ...current, count: current.count + 1 });
}

