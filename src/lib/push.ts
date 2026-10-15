import "server-only";
import { Agent } from "node:https";
import webpush from "web-push";
import { getSql } from "./db";
import { isAllowedEndpoint, planNotifications, pushMessage, type PushKind } from "./push-rules";
import { stationPlace } from "./stations";

// Push-varsel (v1.5): lagre abonnement på en lapp og sende «nest i køen» / «din tur» / «hoppet over».
// Sendes etter svaret til operatøren (after() i API-ruten), så NESTE blir aldri tregere.

/** Lokal push-mottaker i tester. Aldri i produksjon. */
export function testEndpointPrefix(): string | null {
  return process.env.VERCEL_ENV !== "production" && process.env.PUSH_TEST_ENDPOINT ? process.env.PUSH_TEST_ENDPOINT : null;
}

let testAgent: Agent | null = null;
function testAgentFor(endpoint: string): Agent | null {
  const prefix = testEndpointPrefix();
  if (!prefix || !endpoint.startsWith(prefix)) return null;
  testAgent ??= new Agent({ rejectUnauthorized: false });
  return testAgent;
}

let vapidCache: { publicKey: string; privateKey: string } | null = null;

async function getVapid(): Promise<{ publicKey: string; privateKey: string } | null> {
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    return { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
  }
  if (vapidCache) return vapidCache;
  const [row] = await getSql()<{ vapid_public: string | null; vapid_private: string | null }[]>`
    SELECT vapid_public, vapid_private FROM settings WHERE id = 1`;
  if (!row?.vapid_public || !row.vapid_private) return null;
  vapidCache = { publicKey: row.vapid_public, privateKey: row.vapid_private };
  return vapidCache;
}

/** Offentlig VAPID-nøkkel (trygg å sende til nettleseren). */
export async function getVapidPublicKey(): Promise<string | null> {
  return (await getVapid())?.publicKey ?? null;
}

/** Apple krever «mailto:» eller https-adresse som avsender. */
function vapidSubject(): string {
  if (process.env.VAPID_SUBJECT) return process.env.VAPID_SUBJECT;
  const host = process.env.PUBLIC_BASE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL && `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`);
  return host && host.startsWith("https://") ? host : "https://kolapp.invalid";
}

export async function isPushEnabled(): Promise<boolean> {
  const [row] = await getSql()<{ push_enabled: boolean }[]>`SELECT push_enabled FROM site_config WHERE id = 1`;
  return Boolean(row?.push_enabled);
}

export type SaveResult = "ok" | "disabled" | "not_found" | "finished" | "bad_endpoint";

/** Lagrer abonnement for en lapp som venter eller er kalt. Ny lapp på samme nettleser erstatter ikke andre lapper. */
export async function savePushSubscription(
  ticketId: string,
  sub: { endpoint: string; p256dh: string; auth: string },
): Promise<SaveResult> {
  if (!isAllowedEndpoint(sub.endpoint, testEndpointPrefix())) return "bad_endpoint";
  if (!(await isPushEnabled())) return "disabled";
  const sql = getSql();
  const [t] = await sql<{ status: string; current: boolean }[]>`
    SELECT t.status, t.generation = s.generation AS current
    FROM tickets t JOIN stations s ON s.id = t.station WHERE t.id = ${ticketId}`;
  if (!t || !t.current) return "not_found";
  if (t.status !== "waiting" && t.status !== "called") return "finished";
  await sql`
    INSERT INTO push_subscriptions (ticket_id, endpoint, p256dh, auth)
    VALUES (${ticketId}, ${sub.endpoint}, ${sub.p256dh}, ${sub.auth})
    ON CONFLICT (ticket_id, endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`;
  return "ok";
}

export async function deletePushSubscription(ticketId: string, endpoint: string): Promise<void> {
  await getSql()`DELETE FROM push_subscriptions WHERE ticket_id = ${ticketId} AND endpoint = ${endpoint}`;
}

export async function countPushSubscriptions(): Promise<number> {
  const [row] = await getSql()<{ n: number }[]>`
    SELECT count(DISTINCT ps.ticket_id)::int AS n FROM push_subscriptions ps
    JOIN tickets t ON t.id = ps.ticket_id JOIN stations s ON s.id = t.station
    WHERE t.generation = s.generation AND t.status IN ('waiting', 'called')`;
  return row?.n ?? 0;
}

type Target = { endpoint: string; p256dh: string; auth: string };

/** Sender ett varsel. Ett nytt forsøk ved midlertidig feil (nett, 429, 5xx). */
async function deliver(
  t: Target,
  payload: string,
  vapid: { publicKey: string; privateKey: string },
  ttl: number,
): Promise<"sent" | "gone" | "failed"> {
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      await webpush.sendNotification({ endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } }, payload, {
        vapidDetails: { subject: vapidSubject(), publicKey: vapid.publicKey, privateKey: vapid.privateKey },
        TTL: ttl,
        urgency: "high",
        timeout: 5000,
        // Lokal testmottaker har selvsignert sertifikat. Bare i tester – testEndpointPrefix() er null i produksjon.
        ...(testAgentFor(t.endpoint) ? { agent: testAgentFor(t.endpoint)! } : {}),
      });
      return "sent";
    } catch (err) {
      const code = (err as { statusCode?: number }).statusCode;
      // Abonnementet finnes ikke lenger (varsler slått av, appen slettet).
      if (code === 404 || code === 410) return "gone";
      // Feil i selve forespørselen (f.eks. ugyldige nøkler): ingen vits å prøve igjen.
      if (code && code >= 400 && code < 500 && code !== 429) {
        console.warn("[push] avvist av push-tjenesten", code);
        return "failed";
      }
      if (attempt === 2) console.warn("[push] sending feilet", code ?? (err as Error).message);
      else await new Promise((r) => setTimeout(r, 800));
    }
  }
  return "failed";
}

/** Bekreftelse rett etter at gjesten har slått på varsel – viser at det virker (viktig på iPhone). */
export async function sendWelcome(ticketId: string, sub: Target): Promise<boolean> {
  try {
    const vapid = await getVapid();
    if (!vapid) return false;
    const [t] = await getSql()<{ station: string; number: number }[]>`SELECT station, number FROM tickets WHERE id = ${ticketId}`;
    if (!t) return false;
    const payload = JSON.stringify({
      title: `Varsel er på – ${t.station}${t.number}`,
      body: "Vi sier ifra når du er nest i køen og når det er din tur.",
      url: `/ticket/${ticketId}`,
      tag: `kolapp-${ticketId}`,
      kind: "welcome",
    });
    return (await deliver(sub, payload, vapid, 600)) === "sent";
  } catch (err) {
    console.error("[push] sendWelcome", err);
    return false;
  }
}

interface Row {
  id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  last_kind: PushKind | null;
  ticket_id: string;
  number: number;
  station: string;
  station_name: string;
  status: "waiting" | "called" | "done" | "skipped";
  first: boolean;
}

/**
 * Sender de varslene stasjonen skal ha nå (se planNotifications). Trygg å kjøre flere ganger og samtidig:
 * hvert varsel «reserveres» med en betinget UPDATE før det sendes.
 * Returnerer antall sendte varsler. Kaster aldri (feil logges).
 */
export async function notifyStation(station: string): Promise<number> {
  try {
    if (!(await isPushEnabled())) return 0;
    const vapid = await getVapid();
    if (!vapid) return 0;
    const sql = getSql();
    // Rydd: abonnementer på ferdige lapper og gamle generasjoner trengs ikke lenger.
    await sql`
      DELETE FROM push_subscriptions ps USING tickets t, stations s
      WHERE ps.ticket_id = t.id AND s.id = t.station AND t.station = ${station}
        AND (t.generation <> s.generation OR t.status IN ('done', 'left') OR (t.status = 'skipped' AND ps.last_kind = 'skipped'))`;
    const rows = await sql<Row[]>`
      SELECT ps.id, ps.endpoint, ps.p256dh, ps.auth, ps.last_kind, t.id AS ticket_id, t.number, t.station, t.status,
        s.name AS station_name,
        (t.status = 'waiting' AND t.number = (
          SELECT min(w.number) FROM tickets w
          WHERE w.station = t.station AND w.generation = t.generation AND w.status = 'waiting')) AS first
      FROM push_subscriptions ps
        JOIN tickets t ON t.id = ps.ticket_id
        JOIN stations s ON s.id = t.station
      WHERE t.station = ${station} AND t.generation = s.generation`;
    const plan = planNotifications(rows.map((r) => ({ id: r.id, status: r.status, first: r.first, lastKind: r.last_kind })));
    let sent = 0;
    await Promise.all(
      plan.map(async ({ id, kind }) => {
        const r = rows.find((x) => x.id === id)!;
        // Reserver: bare én samtidig kjøring får sende dette varselet.
        const claimed = await sql`
          UPDATE push_subscriptions SET last_kind = ${kind}
          WHERE id = ${id} AND last_kind IS NOT DISTINCT FROM ${r.last_kind} RETURNING id`;
        if (!claimed.length) return;
        const label = `${r.station}${r.number}`;
        const msg = pushMessage(kind, label, stationPlace({ id: r.station, name: r.station_name }));
        const payload = JSON.stringify({ ...msg, url: `/ticket/${r.ticket_id}`, tag: `kolapp-${r.ticket_id}`, kind });
        const result = await deliver(r, payload, vapid, kind === "called" ? 300 : 900);
        if (result === "sent") sent++;
        else if (result === "gone") await sql`DELETE FROM push_subscriptions WHERE id = ${id}`;
        // Midlertidig feil: frigi reservasjonen, så neste operatørhandling prøver igjen.
        else await sql`UPDATE push_subscriptions SET last_kind = ${r.last_kind} WHERE id = ${id} AND last_kind = ${kind}`;
      }),
    );
    return sent;
  } catch (err) {
    console.error("[push] notifyStation", err);
    return 0;
  }
}
