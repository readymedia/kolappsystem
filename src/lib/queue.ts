import "server-only";
import { timingSafeEqual } from "node:crypto";
import { MAX_WAITING_PER_NETWORK, OPERATOR_NEXT_COUNT, type StationId } from "./config";
import { MAX_ACTIVE_STATIONS, nextFreeColor, nextFreeStationId, StationNotFoundError } from "./stations";
import { capacity, MEASURE_CALLS, measuredMinutes, type WaitMode } from "./wait";
import { getSql, type Tx } from "./db";
import { randomToken } from "./pin-hash.mjs";
import type { PublicState, PublicStation, PublicTicket, TicketStatus } from "./public-state";

// All forretningslogikk for køen. Hver endring skjer i ÉN transaksjon som låser stasjonsraden,
// slik at samtidige skann og samtidige trykk på NESTE aldri gir duplikater eller to kalte lapper.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const isUuid = (v: unknown): v is string => typeof v === "string" && UUID.test(v);

interface StationRow {
  id: StationId;
  description: string;
  active: boolean;
  join_key: string;
  next_number: number;
  generation: number;
}

interface TicketRow {
  id: string;
  station: StationId;
  number: number;
  generation: number;
  status: TicketStatus;
  called_at: Date | null;
  finished_at: Date | null;
}

function keysMatch(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Transaksjon med tidsgrenser, så en hengende spørring aldri blokkerer en stasjon lenge.
 * SET LOCAL gjelder bare denne transaksjonen og fungerer gjennom Neon sin pooler (PgBouncer).
 */
function begin<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return getSql().begin(async (tx) => {
    await tx.unsafe("SET LOCAL lock_timeout = '5s'; SET LOCAL statement_timeout = '10s'");
    return fn(tx);
  }) as Promise<T>;
}

async function lockStation(tx: Tx, station: StationId): Promise<StationRow> {
  const [row] = await tx<StationRow[]>`
    SELECT id, description, active, join_key, next_number, generation
    FROM stations WHERE id = ${station} FOR UPDATE`;
  if (!row) throw new StationNotFoundError(station);
  return row;
}

// ---------------------------------------------------------------- Publikum

export type JoinResult =
  | { ok: true; ticketId: string; reused: boolean }
  | { ok: false; error: "invalid_station" | "invalid_link" | "closed" | "too_many_waiting" | "queue_full" };

/**
 * Lager en ny kølapp, eller gjenbruker en eksisterende:
 * - samme enhet (existingTicketId fra localStorage) får sin aktive lapp tilbake, også om stasjonen er stengt
 * - samme forespørsel (requestId) gir samme lapp, så et svar som forsvant på dårlig nett ikke gir dobbeltlapp
 * Nøkkelen sjekkes FØR stasjonen låses, så ugyldige forsøk aldri bremser ekte skann eller operatører.
 */
export async function joinQueue(input: {
  station: StationId;
  key: string;
  existingTicketId?: string | null;
  requestId?: string | null;
  ipHash?: string | null;
}): Promise<JoinResult> {
  // Arkiverte stasjoner (v1.6) tar ikke imot skann, selv med gammel QR.
  const [pre] = await getSql()<{ join_key: string }[]>`
    SELECT join_key FROM stations WHERE id = ${input.station} AND archived_at IS NULL`;
  if (!pre) return { ok: false, error: "invalid_station" };
  if (!keysMatch(input.key, pre.join_key)) return { ok: false, error: "invalid_link" };

  return begin(async (tx) => {
    const st = await lockStation(tx, input.station);
    // Nøkkelen kan ha blitt byttet mellom sjekken over og låsen.
    if (!keysMatch(input.key, st.join_key)) return { ok: false, error: "invalid_link" } as const;

    if (isUuid(input.existingTicketId)) {
      const [existing] = await tx<{ id: string }[]>`
        SELECT id FROM tickets
        WHERE id = ${input.existingTicketId} AND station = ${st.id}
          AND generation = ${st.generation} AND status IN ('waiting', 'called')`;
      if (existing) return { ok: true, ticketId: existing.id, reused: true } as const;
    }
    const requestId = isUuid(input.requestId) ? input.requestId : null;
    if (requestId) {
      const [same] = await tx<{ id: string }[]>`
        SELECT id FROM tickets WHERE station = ${st.id} AND generation = ${st.generation} AND request_id = ${requestId}`;
      if (same) return { ok: true, ticketId: same.id, reused: true } as const;
    }

    if (!st.active) return { ok: false, error: "closed" } as const;

    // Sluttid og maks i kø (v1.8). Samme utregning som /api/state. Eksisterende lapper over er ikke berørt.
    const [limits] = await tx<{ end_at: Date | null; max_waiting: number | null; waiting: number; now: Date }[]>`
      SELECT ${tx.unsafe(END_AT_SQL)} AS end_at, max_waiting, now() AS now,
        (SELECT count(*)::int FROM tickets t WHERE t.station = ${st.id} AND t.generation = ${st.generation} AND t.status = 'waiting') AS waiting
      FROM stations WHERE id = ${st.id}`;
    if (limits && (limits.end_at || limits.max_waiting !== null)) {
      const m = await minutesPerPerson(tx, st.id);
      const cap = capacity({
        waiting: limits.waiting,
        minutesPerPerson: m.byStation.get(st.id) ?? m.fallback,
        endAt: limits.end_at,
        maxWaiting: limits.max_waiting,
        now: limits.now,
      });
      if (cap.full) return { ok: false, error: "queue_full" } as const;
    }

    if (input.ipHash) {
      const [c] = await tx<{ n: number }[]>`
        SELECT count(*)::int AS n FROM tickets
        WHERE station = ${st.id} AND generation = ${st.generation} AND status = 'waiting' AND ip_hash = ${input.ipHash}`;
      if ((c?.n ?? 0) >= MAX_WAITING_PER_NETWORK) return { ok: false, error: "too_many_waiting" } as const;
    }

    const number = st.next_number;
    await tx`UPDATE stations SET next_number = next_number + 1, updated_at = now() WHERE id = ${st.id}`;
    const [ticket] = await tx<{ id: string }[]>`
      INSERT INTO tickets (station, number, generation, request_id, ip_hash)
      VALUES (${st.id}, ${number}, ${st.generation}, ${requestId}, ${input.ipHash ?? null})
      RETURNING id`;
    return { ok: true, ticketId: ticket!.id, reused: false } as const;
  });
}

/** Én lapp med antall foran. Returnerer null hvis den ikke finnes eller stasjonen er nullstilt. */
export async function getTicket(id: string): Promise<PublicTicket | null> {
  if (!isUuid(id)) return null;
  const sql = getSql();
  const [row] = await sql<(TicketRow & { description: string; station_generation: number; name: string; color: string; left_at: Date | null })[]>`
    SELECT t.id, t.station, t.number, t.generation, t.status, s.description, s.name, s.color, t.left_at,
           s.generation AS station_generation
    FROM tickets t JOIN stations s ON s.id = t.station
    WHERE t.id = ${id}`;
  if (!row || row.generation !== row.station_generation) return null;
  let ahead = 0;
  if (row.status === "waiting") {
    const [c] = await sql<{ n: number }[]>`
      SELECT count(*)::int AS n FROM tickets
      WHERE station = ${row.station} AND generation = ${row.generation}
        AND status = 'waiting' AND number < ${row.number}`;
    ahead = c?.n ?? 0;
  }
  return {
    id: row.id,
    station: row.station,
    number: row.number,
    generation: row.generation,
    status: row.status,
    ahead,
    description: row.description,
    stationName: row.name,
    color: row.color,
    leftAt: row.left_at ? row.left_at.toISOString() : null,
  };
}

type Sql = Tx | ReturnType<typeof getSql>;

/** SQL-uttrykk: dagens sluttid (service_end, norsk tid) som tidspunkt, eller NULL. */
const END_AT_SQL = `CASE WHEN service_end IS NULL THEN NULL
  ELSE ((now() AT TIME ZONE 'Europe/Oslo')::date + service_end) AT TIME ZONE 'Europe/Oslo' END`;

/**
 * Minutter per person for stasjonene (v1.7): fast fra admin, eller målt tempo fra de siste oppropene.
 * Brukes av både /api/state og kapasitetssjekken i joinQueue, så de alltid regner likt.
 */
async function minutesPerPerson(sql: Sql, station?: StationId): Promise<{ fallback: number; byStation: Map<string, number> }> {
  const [cfg] = await sql<{ wait_mode: WaitMode; wait_minutes: string }[]>`
    SELECT wait_mode, wait_minutes FROM site_config WHERE id = 1`;
  const fallback = Number(cfg?.wait_minutes ?? 2);
  const byStation = new Map<string, number>();
  if (cfg?.wait_mode !== "measured") return { fallback, byStation };
  const calls = await sql<{ station: StationId; called_at: Date }[]>`
    SELECT station, called_at FROM (
      SELECT t.station, t.called_at,
        row_number() OVER (PARTITION BY t.station ORDER BY t.called_at DESC) AS rn
      FROM tickets t JOIN stations s ON s.id = t.station AND s.generation = t.generation
      WHERE t.called_at IS NOT NULL AND s.archived_at IS NULL
        AND (${station ?? null}::text IS NULL OR t.station = ${station ?? null})
    ) x WHERE rn <= ${MEASURE_CALLS}`;
  const grouped = new Map<string, Date[]>();
  for (const c of calls) grouped.set(c.station, [...(grouped.get(c.station) ?? []), c.called_at]);
  for (const [id, dates] of grouped) byStation.set(id, measuredMinutes(dates, fallback));
  return { fallback, byStation };
}

/** Offentlig køstatus for alle stasjoner. Inneholder aldri nøkler. */
export async function getPublicState(): Promise<PublicState> {
  // Alle spørringene i samme øyeblikksbilde, så en samtidig nullstilling aldri gir blandet svar.
  const { stations, tickets, minutes, now } = await getSql().begin("isolation level repeatable read read only", async (sql) => {
    const stations = await sql<
      (Omit<StationRow, "join_key"> & {
        closed_message: string;
        name: string;
        color: string;
        service_end_text: string | null;
        end_at: Date | null;
        max_waiting: number | null;
      })[]
    >`
    SELECT id, name, color, description, active, closed_message, next_number, generation,
      to_char(service_end, 'HH24:MI') AS service_end_text, ${sql.unsafe(END_AT_SQL)} AS end_at, max_waiting
    FROM stations WHERE archived_at IS NULL ORDER BY sort_order, id`;
    const tickets = await sql<{ station: StationId; number: number; status: TicketStatus }[]>`
    SELECT t.station, t.number, t.status
    FROM tickets t JOIN stations s ON s.id = t.station AND s.generation = t.generation
    WHERE t.status IN ('waiting', 'called', 'skipped')
    ORDER BY t.number`;
    const [{ now }] = (await sql<{ now: Date }[]>`SELECT now() AS now`) as unknown as [{ now: Date }];
    return { stations, tickets, minutes: await minutesPerPerson(sql), now };
  });

  const result: PublicStation[] = stations.map((s) => {
    const mine = tickets.filter((t) => t.station === s.id);
    const waiting = mine.filter((t) => t.status === "waiting").map((t) => t.number);
    const m = minutes.byStation.get(s.id) ?? minutes.fallback;
    const cap = capacity({ waiting: waiting.length, minutesPerPerson: m, endAt: s.end_at, maxWaiting: s.max_waiting, now });
    return {
      id: s.id,
      name: s.name,
      color: s.color,
      description: s.description,
      active: s.active,
      closedMessage: s.active ? "" : s.closed_message,
      generation: s.generation,
      nextNumber: s.next_number,
      current: mine.find((t) => t.status === "called")?.number ?? null,
      minutesPerPerson: m,
      serviceEnd: s.service_end_text,
      endAt: s.end_at ? s.end_at.toISOString() : null,
      full: cap.full,
      capacityLeft: cap.left,
      waiting,
      skipped: mine.filter((t) => t.status === "skipped").map((t) => t.number),
    };
  });
  return { stations: result, generatedAt: now.toISOString() };
}

// ---------------------------------------------------------------- Operator

/** Sluttid, full og plass igjen for én stasjon (samme regel som /api/state og joinQueue). */
async function stationCapacity(sql: Sql, station: StationId, waiting: number) {
  const [lim] = await sql<{ end_at: Date | null; max_waiting: number | null; service_end_text: string | null; now: Date }[]>`
    SELECT ${sql.unsafe(END_AT_SQL)} AS end_at, max_waiting, to_char(service_end, 'HH24:MI') AS service_end_text, now() AS now
    FROM stations WHERE id = ${station}`;
  if (!lim || (!lim.end_at && lim.max_waiting === null)) return { serviceEnd: null, full: false, capacityLeft: null };
  const m = await minutesPerPerson(sql, station);
  const cap = capacity({ waiting, minutesPerPerson: m.byStation.get(station) ?? m.fallback, endAt: lim.end_at, maxWaiting: lim.max_waiting, now: lim.now });
  return { serviceEnd: lim.service_end_text, full: cap.full, capacityLeft: cap.left };
}

export interface OperatorView {
  station: StationId;
  active: boolean;
  closedMessage: string;
  description: string;
  current: { id: string; number: number } | null;
  next: { id: string; number: number }[];
  waitingCount: number;
  skipped: { id: string; number: number }[];
  canUndo: boolean;
  /** Id for siste handling som kan angres. Sendes med «Angre» som vern mot dobbelt trykk. */
  lastActionId: string | null;
  /** Antall som har gitt fra seg plassen siden siste nullstilling (v1.7). */
  leftCount: number;
  /** Den sist kalte ga fra seg plassen og ingen er kalt nå – operatøren bør trykke NESTE (v1.7). */
  calledLeft: { id: string; number: number } | null;
  /** Sluttid og kapasitet (v1.8). */
  serviceEnd: string | null;
  full: boolean;
  capacityLeft: number | null;
}

export async function getOperatorView(station: StationId): Promise<OperatorView> {
  const sql = getSql();
  const [st] = await sql<(StationRow & { closed_message: string })[]>`
    SELECT id, description, active, closed_message, next_number, generation FROM stations WHERE id = ${station}`;
  if (!st) throw new StationNotFoundError(station);
  const [current] = await sql<{ id: string; number: number }[]>`
    SELECT id, number FROM tickets
    WHERE station = ${station} AND generation = ${st.generation} AND status = 'called'`;
  const next = await sql<{ id: string; number: number }[]>`
    SELECT id, number FROM tickets
    WHERE station = ${station} AND generation = ${st.generation} AND status = 'waiting'
    ORDER BY number LIMIT ${OPERATOR_NEXT_COUNT}`;
  const [count] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM tickets
    WHERE station = ${station} AND generation = ${st.generation} AND status = 'waiting'`;
  const skipped = await sql<{ id: string; number: number }[]>`
    SELECT id, number FROM tickets
    WHERE station = ${station} AND generation = ${st.generation} AND status = 'skipped'
    ORDER BY finished_at DESC NULLS LAST LIMIT 10`;
  const [undo] = await sql<{ id: string }[]>`
    SELECT id FROM queue_actions WHERE station = ${station} AND NOT undone ORDER BY id DESC LIMIT 1`;
  const [left] = await sql<{ n: number }[]>`
    SELECT count(*)::int AS n FROM tickets WHERE station = ${station} AND generation = ${st.generation} AND status = 'left'`;
  // Sist kalte lapp: er den gitt fra seg (og ingen er kalt nå), vis beskjed til operatøren.
  const [lastCalled] = current
    ? []
    : await sql<{ id: string; number: number; status: TicketStatus }[]>`
      SELECT id, number, status FROM tickets
      WHERE station = ${station} AND generation = ${st.generation} AND called_at IS NOT NULL
      ORDER BY called_at DESC LIMIT 1`;
  return {
    station,
    active: st.active,
    closedMessage: st.active ? "" : st.closed_message,
    description: st.description,
    current: current ?? null,
    next: [...next],
    waitingCount: count?.n ?? 0,
    skipped: [...skipped],
    leftCount: left?.n ?? 0,
    ...(await stationCapacity(sql, station, count?.n ?? 0)),
    calledLeft: lastCalled?.status === "left" ? { id: lastCalled.id, number: lastCalled.number } : null,
    canUndo: Boolean(undo),
    lastActionId: undo ? String(undo.id) : null,
  };
}

/**
 * NESTE («done») eller Hopp over («skipped»): avslutter lappen som betjenes og kaller neste ventende.
 * Alt skjer i én transaksjon med låst stasjon.
 */
export async function advance(
  station: StationId,
  finishAs: "done" | "skipped",
  /** Lappen operatøren så som «betjenes nå» (null = ingen). Avviker den, gjøres ingenting (dobbelt trykk). */
  expectedCurrentId?: string | null,
): Promise<void> {
  await begin(async (tx) => {
    const st = await lockStation(tx, station);
    if (expectedCurrentId !== undefined) {
      const [now] = await tx<{ id: string }[]>`
        SELECT id FROM tickets WHERE station = ${station} AND generation = ${st.generation} AND status = 'called'`;
      if ((now?.id ?? null) !== expectedCurrentId) {
        // Har den kalte gitt fra seg plassen (v1.7), viser operatøren fortsatt lappen. Da skal NESTE kalle neste.
        const [gone] = expectedCurrentId && !now
          ? await tx`SELECT 1 FROM tickets WHERE id = ${expectedCurrentId} AND status = 'left'`
          : [];
        if (!gone) return;
      }
    }
    const [current] = await tx<{ id: string }[]>`
      UPDATE tickets SET status = ${finishAs}::ticket_status, finished_at = now()
      WHERE station = ${station} AND generation = ${st.generation} AND status = 'called'
      RETURNING id`;
    const [next] = await tx<{ id: string }[]>`
      UPDATE tickets SET status = 'called', called_at = now()
      WHERE id = (
        SELECT id FROM tickets
        WHERE station = ${station} AND generation = ${st.generation} AND status = 'waiting'
        ORDER BY number LIMIT 1
      )
      RETURNING id`;
    if (!current && !next) return; // Ingenting å gjøre – ikke logg.
    await tx`
      INSERT INTO queue_actions (station, kind, finished_ticket, called_ticket)
      VALUES (${station}, ${finishAs === "done" ? "next" : "skip"}, ${current?.id ?? null}, ${next?.id ?? null})`;
  });
}

/** Angre siste NESTE/Hopp over. Kan trykkes flere ganger for å gå flere steg tilbake. */
export async function undoLast(
  station: StationId,
  /** Handlingen operatøren så som «siste». Avviker den, gjøres ingenting (dobbelt trykk). */
  expectedActionId?: string | null,
): Promise<boolean> {
  return begin(async (tx) => {
    await lockStation(tx, station);
    const [action] = await tx<{ id: string; finished_ticket: string | null; called_ticket: string | null }[]>`
      SELECT id, finished_ticket, called_ticket FROM queue_actions
      WHERE station = ${station} AND NOT undone
      ORDER BY id DESC LIMIT 1`;
    if (!action) return false;
    if (expectedActionId !== undefined && String(action.id) !== expectedActionId) return false;
    if (action.called_ticket) {
      await tx`
        UPDATE tickets SET status = 'waiting', called_at = NULL
        WHERE id = ${action.called_ticket} AND status = 'called'`;
    }
    if (action.finished_ticket) {
      // Fjern eventuell annen kalt lapp først (unik-indeksen tillater bare én).
      await tx`
        UPDATE tickets SET status = 'waiting', called_at = NULL
        WHERE station = ${station} AND status = 'called' AND id <> ${action.finished_ticket}`;
      await tx`
        UPDATE tickets SET status = 'called', finished_at = NULL
        WHERE id = ${action.finished_ticket} AND status IN ('done', 'skipped', 'waiting')`;
    }
    await tx`UPDATE queue_actions SET undone = true WHERE id = ${action.id}`;
    return true;
  });
}

/** Setter en overhoppet lapp tilbake i køen. Den beholder nummeret sitt og kommer derfor først. */
export async function requeueSkipped(station: StationId, ticketId: string): Promise<boolean> {
  if (!isUuid(ticketId)) return false;
  return begin(async (tx) => {
    const st = await lockStation(tx, station);
    const rows = await tx`
      UPDATE tickets SET status = 'waiting', finished_at = NULL, called_at = NULL
      WHERE id = ${ticketId} AND station = ${station} AND generation = ${st.generation} AND status = 'skipped'
      RETURNING id`;
    return rows.length > 0;
  });
}

// ---------------------------------------------------------------- Admin

export interface AdminStation {
  id: StationId;
  name: string;
  color: string;
  /** v1.8: sluttid «16:00» og maks i kø, eller null. */
  serviceEnd: string | null;
  maxWaiting: number | null;
  description: string;
  active: boolean;
  closedMessage: string;
  joinKey: string;
  waitingCount: number;
  /** Har gitt fra seg plassen siden siste nullstilling (v1.7). */
  leftCount: number;
  issued: number;
}

export async function getAdminStations(): Promise<AdminStation[]> {
  const sql = getSql();
  const rows = await sql<
    (StationRow & { waiting: number; left_count: number; closed_message: string; name: string; color: string; service_end_text: string | null; max_waiting: number | null })[]
  >`
    SELECT s.id, s.name, s.color, to_char(s.service_end, 'HH24:MI') AS service_end_text, s.max_waiting, s.description, s.active, s.closed_message, s.join_key, s.next_number, s.generation,
      (SELECT count(*)::int FROM tickets t
        WHERE t.station = s.id AND t.generation = s.generation AND t.status = 'waiting') AS waiting,
      (SELECT count(*)::int FROM tickets t
        WHERE t.station = s.id AND t.generation = s.generation AND t.status = 'left') AS left_count
    FROM stations s WHERE s.archived_at IS NULL ORDER BY s.sort_order, s.id`;
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    color: r.color,
    serviceEnd: r.service_end_text,
    maxWaiting: r.max_waiting,
    description: r.description,
    active: r.active,
    closedMessage: r.closed_message,
    joinKey: r.join_key,
    waitingCount: r.waiting,
    leftCount: r.left_count,
    issued: r.next_number - 1,
  }));
}

/** Tømmer køen for en stasjon og starter nummereringen på 1 igjen. */
// ---------------------------------------------------------------- Rapport (v1.8)

export interface StationStats {
  station: StationId;
  label: string;
  startedAt: string | null;
  endedAt: string | null;
  issued: number;
  served: number;
  skipped: number;
  left: number;
  waiting: number;
  avgWaitSeconds: number | null;
  maxWaitSeconds: number | null;
  minutesPerPerson: number | null;
  busiestHour: string | null;
}

/** Sammendrag for stasjonens nåværende runde (siden siste nullstilling). Bare tall – ingen persondata. */
async function computeStats(sql: Sql, station: StationId): Promise<StationStats | null> {
  const [st] = await sql<{ id: string; name: string; generation: number; next_number: number }[]>`
    SELECT id, name, generation, next_number FROM stations WHERE id = ${station}`;
  if (!st) return null;
  const [agg] = await sql<
    {
      started: Date | null;
      served: number;
      skipped: number;
      left_count: number;
      waiting: number;
      avg_wait: number | null;
      max_wait: number | null;
    }[]
  >`
    SELECT min(created_at) AS started,
      count(*) FILTER (WHERE status = 'done')::int AS served,
      count(*) FILTER (WHERE status = 'skipped')::int AS skipped,
      count(*) FILTER (WHERE status = 'left')::int AS left_count,
      count(*) FILTER (WHERE status = 'waiting')::int AS waiting,
      round(avg(extract(epoch FROM called_at - created_at)) FILTER (WHERE called_at IS NOT NULL))::int AS avg_wait,
      round(max(extract(epoch FROM called_at - created_at)) FILTER (WHERE called_at IS NOT NULL))::int AS max_wait
    FROM tickets WHERE station = ${station} AND generation = ${st.generation}`;
  const [busy] = await sql<{ hour: string }[]>`
    SELECT to_char(date_trunc('hour', created_at AT TIME ZONE 'Europe/Oslo'), 'HH24:00') AS hour
    FROM tickets WHERE station = ${station} AND generation = ${st.generation}
    GROUP BY 1 ORDER BY count(*) DESC, 1 LIMIT 1`;
  const calls = await sql<{ called_at: Date }[]>`
    SELECT called_at FROM tickets WHERE station = ${station} AND generation = ${st.generation} AND called_at IS NOT NULL`;
  const pace = measuredMinutes(
    calls.map((c) => c.called_at),
    Number.NaN,
  );
  return {
    station: st.id,
    label: st.name.trim() || `Stasjon ${st.id}`,
    startedAt: agg?.started ? agg.started.toISOString() : null,
    endedAt: null,
    issued: st.next_number - 1,
    served: agg?.served ?? 0,
    skipped: agg?.skipped ?? 0,
    left: agg?.left_count ?? 0,
    waiting: agg?.waiting ?? 0,
    avgWaitSeconds: agg?.avg_wait ?? null,
    maxWaitSeconds: agg?.max_wait ?? null,
    minutesPerPerson: Number.isNaN(pace) ? null : pace,
    busiestHour: busy?.hour ?? null,
  };
}

/** Rapport: nåværende runde for aktive stasjoner, og lagrede sammendrag fra tidligere runder (nyeste først). */
export async function getReport(): Promise<{ current: StationStats[]; history: StationStats[] }> {
  const sql = getSql();
  const ids = await sql<{ id: string }[]>`SELECT id FROM stations WHERE archived_at IS NULL ORDER BY sort_order, id`;
  const current = (await Promise.all(ids.map((r) => computeStats(sql, r.id)))).filter((s): s is StationStats => s !== null);
  const rows = await sql<
    {
      station: string;
      station_label: string;
      started_at: Date | null;
      ended_at: Date;
      issued: number;
      served: number;
      skipped: number;
      left_count: number;
      waiting: number;
      avg_wait_seconds: number | null;
      max_wait_seconds: number | null;
      minutes_per_person: string | null;
      busiest_hour: string | null;
    }[]
  >`SELECT * FROM station_stats ORDER BY ended_at DESC, station LIMIT 200`;
  const history = rows.map((r) => ({
    station: r.station,
    label: r.station_label,
    startedAt: r.started_at ? r.started_at.toISOString() : null,
    endedAt: r.ended_at.toISOString(),
    issued: r.issued,
    served: r.served,
    skipped: r.skipped,
    left: r.left_count,
    waiting: r.waiting,
    avgWaitSeconds: r.avg_wait_seconds,
    maxWaitSeconds: r.max_wait_seconds,
    minutesPerPerson: r.minutes_per_person === null ? null : Number(r.minutes_per_person),
    busiestHour: r.busiest_hour,
  }));
  return { current, history };
}

/** Tømmer køen for en stasjon og starter nummereringen på 1 igjen. Lagrer rapport-sammendrag først (v1.8). */
export async function resetStation(station: StationId): Promise<void> {
  await begin(async (tx) => {
    await lockStation(tx, station);
    const stats = await computeStats(tx, station);
    if (stats && stats.issued > 0) {
      await tx`
        INSERT INTO station_stats (station, station_label, started_at, issued, served, skipped, left_count, waiting,
          avg_wait_seconds, max_wait_seconds, minutes_per_person, busiest_hour)
        VALUES (${stats.station}, ${stats.label}, ${stats.startedAt}, ${stats.issued}, ${stats.served}, ${stats.skipped},
          ${stats.left}, ${stats.waiting}, ${stats.avgWaitSeconds}, ${stats.maxWaitSeconds}, ${stats.minutesPerPerson},
          ${stats.busiestHour})`;
    }
    await tx`DELETE FROM queue_actions WHERE station = ${station}`;
    await tx`DELETE FROM tickets WHERE station = ${station}`;
    await tx`
      UPDATE stations SET next_number = 1, generation = generation + 1, updated_at = now()
      WHERE id = ${station}`;
  });
}

/** Nullstiller alle aktive stasjoner, hver i sin egen låste transaksjon (fast rekkefølge – ingen vranglås). */
export async function resetAllStations(): Promise<number> {
  const ids = await getSql()<{ id: string }[]>`SELECT id FROM stations WHERE archived_at IS NULL ORDER BY id`;
  for (const { id } of ids) await resetStation(id);
  return ids.length;
}

/**
 * Fjerner ventende lapper i et nummerområde (f.eks. falske lapper fra en delt QR-kode).
 * Lappene slettes; eierne ser «Fant ikke kølappen». Kalte og ferdige lapper røres ikke.
 */
export async function removeWaitingRange(station: StationId, from: number, to: number): Promise<number> {
  return begin(async (tx) => {
    const st = await lockStation(tx, station);
    const rows = await tx`
      DELETE FROM tickets
      WHERE station = ${station} AND generation = ${st.generation} AND status = 'waiting'
        AND number BETWEEN ${from} AND ${to}
      RETURNING id`;
    return rows.length;
  });
}

/** Åpner eller stenger en stasjon. Ved stenging kan en melding til publikum settes (beholdes ved åpning). */
export async function setStationActive(station: StationId, active: boolean, closedMessage?: string): Promise<void> {
  if (closedMessage !== undefined) {
    await getSql()`UPDATE stations SET active = ${active}, closed_message = ${closedMessage}, updated_at = now() WHERE id = ${station}`;
  } else {
    await getSql()`UPDATE stations SET active = ${active}, updated_at = now() WHERE id = ${station}`;
  }
}

export async function setClosedMessage(station: StationId, message: string): Promise<void> {
  await getSql()`UPDATE stations SET closed_message = ${message}, updated_at = now() WHERE id = ${station}`;
}

/** Nøklene for aktive stasjoner – kun til signering av skjermlenker på serveren. */
export async function getJoinKeys(): Promise<Record<string, string>> {
  const rows = await getSql()<{ id: string; join_key: string }[]>`
    SELECT id, join_key FROM stations WHERE archived_at IS NULL ORDER BY sort_order, id`;
  return Object.fromEntries(rows.map((r) => [r.id, r.join_key]));
}

export async function rotateStationKey(station: StationId): Promise<void> {
  await getSql()`UPDATE stations SET join_key = ${randomToken()}, updated_at = now() WHERE id = ${station}`;
}

export async function setStationDescription(station: StationId, description: string): Promise<void> {
  await getSql()`UPDATE stations SET description = ${description}, updated_at = now() WHERE id = ${station}`;
}

// ---------------------------------------------------------------- Gi fra seg plassen (v1.7)

/** Hvor lenge gjesten kan angre etter å ha gitt fra seg plassen. */
export const LEAVE_UNDO_SECONDS = 60;

export type LeaveResult =
  | { ok: true; station: StationId; number: number; wasCalled: boolean }
  | { ok: false; error: "not_found" | "leave_disabled" };

/**
 * Gjesten gir fra seg plassen (venter, er kalt eller er hoppet over). I stasjonens lås, så det aldri krysser NESTE.
 * Idempotent: allerede gitt fra seg → samme svar. Abonnement på push slettes.
 */
export async function leaveQueue(ticketId: string): Promise<LeaveResult> {
  if (!isUuid(ticketId)) return { ok: false, error: "not_found" };
  const sql = getSql();
  const [pre] = await sql<{ station: string; allow: boolean }[]>`
    SELECT t.station, c.allow_leave AS allow FROM tickets t, site_config c WHERE t.id = ${ticketId} AND c.id = 1`;
  if (!pre) return { ok: false, error: "not_found" };
  if (!pre.allow) return { ok: false, error: "leave_disabled" };
  return begin(async (tx) => {
    const st = await lockStation(tx, pre.station);
    const [t] = await tx<{ number: number; status: TicketStatus }[]>`
      SELECT number, status FROM tickets WHERE id = ${ticketId} AND generation = ${st.generation} FOR UPDATE`;
    if (!t) return { ok: false, error: "not_found" } as const;
    if (t.status === "left") return { ok: true, station: st.id, number: t.number, wasCalled: false } as const;
    if (t.status === "done") return { ok: false, error: "not_found" } as const;
    await tx`UPDATE tickets SET status = 'left', left_at = now() WHERE id = ${ticketId}`;
    await tx`DELETE FROM push_subscriptions WHERE ticket_id = ${ticketId}`;
    return { ok: true, station: st.id, number: t.number, wasCalled: t.status === "called" } as const;
  });
}

export type RejoinResult = { ok: true; station: StationId } | { ok: false; error: "not_found" | "too_late" };

/**
 * Angre (innen LEAVE_UNDO_SECONDS): plassen tilbake, men bare hvis nummeret ikke er passert
 * (ingen med høyere nummer er kalt eller ferdig). Lappen settes som ventende.
 */
export async function rejoinQueue(ticketId: string): Promise<RejoinResult> {
  if (!isUuid(ticketId)) return { ok: false, error: "not_found" };
  const [pre] = await getSql()<{ station: string }[]>`SELECT station FROM tickets WHERE id = ${ticketId}`;
  if (!pre) return { ok: false, error: "not_found" };
  return begin(async (tx) => {
    const st = await lockStation(tx, pre.station);
    const [t] = await tx<{ number: number; status: TicketStatus; recent: boolean }[]>`
      SELECT number, status, left_at > now() - make_interval(secs => ${LEAVE_UNDO_SECONDS}) AS recent
      FROM tickets WHERE id = ${ticketId} AND generation = ${st.generation} FOR UPDATE`;
    if (!t) return { ok: false, error: "not_found" } as const;
    if (t.status !== "left") return t.status === "done" ? ({ ok: false, error: "too_late" } as const) : ({ ok: true, station: st.id } as const);
    if (!t.recent) return { ok: false, error: "too_late" } as const;
    const [passed] = await tx`
      SELECT 1 FROM tickets
      WHERE station = ${st.id} AND generation = ${st.generation} AND number > ${t.number}
        AND called_at IS NOT NULL LIMIT 1`;
    if (passed) return { ok: false, error: "too_late" } as const;
    await tx`UPDATE tickets SET status = 'waiting', left_at = NULL, called_at = NULL WHERE id = ${ticketId}`;
    return { ok: true, station: st.id } as const;
  });
}

// ---------------------------------------------------------------- Stasjoner (v1.6)

const STATION_LOCK = 4_202_610; // pg_advisory_xact_lock for opprettelse/gjenoppretting/rekkefølge

export interface ArchivedStation {
  id: StationId;
  name: string;
  color: string;
  archivedAt: string;
}

/** Aktive stasjoner (kode, navn, farge) i admin-rekkefølge. Uten nøkler. */
export async function listActiveStations(): Promise<{ id: StationId; name: string; color: string }[]> {
  return getSql()<{ id: string; name: string; color: string }[]>`
    SELECT id, name, color FROM stations WHERE archived_at IS NULL ORDER BY sort_order, id`;
}

export async function getArchivedStations(): Promise<ArchivedStation[]> {
  const rows = await getSql()<{ id: string; name: string; color: string; archived_at: Date }[]>`
    SELECT id, name, color, archived_at FROM stations WHERE archived_at IS NOT NULL ORDER BY archived_at DESC`;
  return rows.map((r) => ({ id: r.id, name: r.name, color: r.color, archivedAt: r.archived_at.toISOString() }));
}

export type StationResult<T = void> = { ok: true; value: T } | { ok: false; error: "station_limit" | "no_free_station" | "station_not_empty" | "invalid_station" };

/**
 * Ny stasjon: neste ledige bokstav (aldri gjenbrukt, heller ikke fra arkiverte), første ledige farge, sist i rekkefølgen.
 * Låst med advisory lock, så to samtidige opprettelser aldri får samme bokstav eller går over grensen.
 */
export async function createStation(input: { name?: string; color?: string } = {}): Promise<StationResult<StationId>> {
  return begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(${STATION_LOCK})`;
    const all = await tx<{ id: string; color: string; archived: boolean; sort_order: number }[]>`
      SELECT id, color, archived_at IS NOT NULL AS archived, sort_order FROM stations`;
    const active = all.filter((s) => !s.archived);
    if (active.length >= MAX_ACTIVE_STATIONS) return { ok: false, error: "station_limit" } as const;
    const id = nextFreeStationId(all.map((s) => s.id));
    if (!id) return { ok: false, error: "no_free_station" } as const;
    const color = input.color ?? nextFreeColor(active.map((s) => s.color));
    const order = Math.max(0, ...active.map((s) => s.sort_order)) + 1;
    await tx`
      INSERT INTO stations (id, name, color, sort_order, description, join_key)
      VALUES (${id}, ${input.name ?? ""}, ${color}, ${order}, '', ${randomToken()})`;
    return { ok: true, value: id } as const;
  });
}

export async function updateStationMeta(station: StationId, input: { name?: string; color?: string }): Promise<boolean> {
  const rows = await getSql()`
    UPDATE stations SET
      name = COALESCE(${input.name ?? null}, name),
      color = COALESCE(${input.color ?? null}, color),
      updated_at = now()
    WHERE id = ${station} AND archived_at IS NULL RETURNING id`;
  return rows.length > 0;
}

/**
 * Sluttid («16:00», tom streng = ingen) og maks i kø (null = ingen) (v1.8).
 * station = null: alle aktive stasjoner («Bruk på alle»). undefined-felt endres ikke.
 */
export async function updateStationLimits(
  station: StationId | null,
  input: { serviceEnd?: string; maxWaiting?: number | null },
): Promise<number> {
  const sql = getSql();
  const setEnd = input.serviceEnd !== undefined;
  const setMax = input.maxWaiting !== undefined;
  if (!setEnd && !setMax) return 0;
  const end = input.serviceEnd ? input.serviceEnd : null;
  const rows = await sql`
    UPDATE stations SET
      service_end = CASE WHEN ${setEnd} THEN ${end}::time ELSE service_end END,
      max_waiting = CASE WHEN ${setMax} THEN ${input.maxWaiting ?? null}::int ELSE max_waiting END,
      updated_at = now()
    WHERE archived_at IS NULL AND (${station}::text IS NULL OR id = ${station}) RETURNING id`;
  return rows.length;
}

/** Flytter en stasjon ett steg opp (-1) eller ned (+1) blant de aktive. */
export async function moveStation(station: StationId, direction: -1 | 1): Promise<boolean> {
  return begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(${STATION_LOCK})`;
    const rows = await tx<{ id: string }[]>`SELECT id FROM stations WHERE archived_at IS NULL ORDER BY sort_order, id`;
    const ids = rows.map((r) => r.id);
    const i = ids.indexOf(station);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= ids.length) return false;
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
    // Skriv rekkefølgen på nytt (1..n), så den alltid er entydig.
    for (const [n, id] of ids.entries()) await tx`UPDATE stations SET sort_order = ${n + 1} WHERE id = ${id}`;
    return true;
  });
}

/** Arkiverer en stasjon (skjules overalt, QR slutter å virke). Bare når ingen venter eller er kalt. Slettes aldri. */
export async function archiveStation(station: StationId): Promise<StationResult> {
  return begin(async (tx) => {
    const st = await lockStation(tx, station);
    const [busy] = await tx<{ n: number }[]>`
      SELECT count(*)::int AS n FROM tickets
      WHERE station = ${station} AND generation = ${st.generation} AND status IN ('waiting', 'called')`;
    if ((busy?.n ?? 0) > 0) return { ok: false, error: "station_not_empty" } as const;
    await tx`UPDATE stations SET archived_at = now(), updated_at = now() WHERE id = ${station} AND archived_at IS NULL`;
    return { ok: true, value: undefined } as const;
  });
}

/** Henter tilbake en arkivert stasjon (sist i rekkefølgen, med ny nøkkel og tom kø). */
export async function restoreStation(station: StationId): Promise<StationResult> {
  return begin(async (tx) => {
    await tx`SELECT pg_advisory_xact_lock(${STATION_LOCK})`;
    const [exists] = await tx`SELECT 1 FROM stations WHERE id = ${station} AND archived_at IS NOT NULL`;
    if (!exists) return { ok: false, error: "invalid_station" } as const;
    const [count] = await tx<{ n: number }[]>`SELECT count(*)::int AS n FROM stations WHERE archived_at IS NULL`;
    if ((count?.n ?? 0) >= MAX_ACTIVE_STATIONS) return { ok: false, error: "station_limit" } as const;
    const [last] = await tx<{ max: number }[]>`
      SELECT COALESCE(max(sort_order), 0)::int AS max FROM stations WHERE archived_at IS NULL`;
    const max = last?.max ?? 0;
    const rows = await tx`
      UPDATE stations SET archived_at = NULL, sort_order = ${max + 1}, join_key = ${randomToken()},
        next_number = 1, generation = generation + 1, updated_at = now()
      WHERE id = ${station} AND archived_at IS NOT NULL RETURNING id`;
    if (!rows.length) return { ok: false, error: "invalid_station" } as const;
    await tx`DELETE FROM queue_actions WHERE station = ${station}`;
    await tx`DELETE FROM tickets WHERE station = ${station}`;
    return { ok: true, value: undefined } as const;
  });
}
