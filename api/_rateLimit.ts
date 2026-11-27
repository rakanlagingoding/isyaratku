// Fixed-window rate limiter shared by the api/ handlers (PRD §10). The leading underscore keeps
// Vercel from exposing this file as a route.

export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  // shortcut: per-process memory, so each server instance counts separately; fine for a class demo,
  // use a shared store (e.g. Vercel KV) if the app gets real traffic.
  const hits = new Map<string, { start: number; count: number }>();

  /** Counts one request from `ip`; true when it is over the limit. */
  return (ip: string): boolean => {
    const t = now();
    const entry = hits.get(ip);
    if (!entry || t - entry.start > windowMs) {
      hits.set(ip, { start: t, count: 1 });
      return false;
    }
    entry.count++;
    return entry.count > limit;
  };
}

/** Client IP for rate limiting (first hop of x-forwarded-for). */
export const clientIp = (request: Request): string =>
  request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
