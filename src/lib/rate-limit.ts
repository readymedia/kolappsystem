import "server-only";
import { getSql } from "./db";

// Enkel forsøksgrense med fast tidsvindu, lagret i Postgres (ingen ekstra tjeneste på Vercel Hobby).
// Én atomisk spørring: øker telleren, eller starter et nytt vindu hvis det gamle er utløpt.

export async function hitRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<{ allowed: boolean; count: number }> {
  const sql = getSql();
  const [row] = await sql<{ count: number }[]>`
    INSERT INTO rate_limits (key, count, window_start)
    VALUES (${key}, 1, now())
    ON CONFLICT (key) DO UPDATE SET
      count = CASE
        WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) THEN 1
        ELSE rate_limits.count + 1 END,
      window_start = CASE
        WHEN rate_limits.window_start < now() - make_interval(secs => ${windowSeconds}) THEN now()
        ELSE rate_limits.window_start END
    RETURNING count`;
  const count = row?.count ?? 1;
  return { allowed: count <= limit, count };
}

/** Er nøkkelen sperret akkurat nå (uten å telle et nytt forsøk)? */
export async function isRateLimited(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const sql = getSql();
  const [row] = await sql<{ count: number }[]>`
    SELECT count FROM rate_limits
    WHERE key = ${key} AND window_start >= now() - make_interval(secs => ${windowSeconds})`;
  return (row?.count ?? 0) >= limit;
}

export async function clearRateLimit(key: string): Promise<void> {
  await getSql()`DELETE FROM rate_limits WHERE key = ${key}`;
}

/** Rydder gamle rader. Kalles av og til (billig). */
export async function pruneRateLimits(): Promise<void> {
  await getSql()`DELETE FROM rate_limits WHERE window_start < now() - interval '1 day'`;
}
