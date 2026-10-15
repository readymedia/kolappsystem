import "server-only";
import { timingSafeEqual } from "node:crypto";
import { MAX_WAITING_PER_NETWORK, OPERATOR_NEXT_COUNT, STATION_IDS, type StationId } from "./config";
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
  if (!row) throw new Error(`Stasjon ${station} finnes ikke`);
  return row;
}

// ---------------------------------------------------------------- Publikum

export type JoinResult =
  | { ok: true; ticketId: string; reused: boolean }
  | { ok: false; error: "invalid_link" | "closed" | "too_many_waiting" };

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
  const [pre] = await getSql()<{ join_key: string }[]>`SELECT join_key FROM stations WHERE id = ${input.station}`;
  if (!pre || !keysMatch(input.key, pre.join_key)) return { ok: false, error: "invalid_link" };

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
  const [row] = await sql<(TicketRow & { description: string; station_generation: number })[]>`
    SELECT t.id, t.station, t.number, t.generation, t.status, s.description,
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
  };
}

/** Offentlig køstatus for alle stasjoner. Inneholder aldri nøkler. */
export async function getPublicState(): Promise<PublicState> {
  // Begge spørringene i samme øyeblikksbilde, så en samtidig nullstilling aldri gir blandet svar.
  const { stations, tickets } = await getSql().begin("isolation level repeatable read read only", async (sql) => {
    const stations = await sql<(Omit<StationRow, "join_key"> & { closed_message: string })[]>`
    SELECT id, description, active, closed_message, next_number, generation FROM stations ORDER BY id`;
    const tickets = await sql<{ station: StationId; number: number; status: TicketStatus }[]>`
    SELECT t.station, t.number, t.status
    FROM tickets t JOIN stations s ON s.id = t.station AND s.generation = t.generation
    WHERE t.status IN ('waiting', 'called', 'skipped')
    ORDER BY t.number`;
    return { stations, tickets };
  });

  const result: PublicStation[] = stations.map((s) => {
    const mine = tickets.filter((t) => t.station === s.id);
    return {
      id: s.id,
      description: s.description,
      active: s.active,
      closedMessage: s.active ? "" : s.closed_message,
      generation: s.generation,
      nextNumber: s.next_number,
      current: mine.find((t) => t.status === "called")?.number ?? null,
      waiting: mine.filter((t) => t.status === "waiting").map((t) => t.number),
      skipped: mine.filter((t) => t.status === "skipped").map((t) => t.number),
    };
  });
  return { stations: result, generatedAt: new Date().toISOString() };
}

// ---------------------------------------------------------------- Operator

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
}

export async function getOperatorView(station: StationId): Promise<OperatorView> {
  const sql = getSql();
  const [st] = await sql<(StationRow & { closed_message: string })[]>`
    SELECT id, description, active, closed_message, next_number, generation FROM stations WHERE id = ${station}`;
  if (!st) throw new Error(`Stasjon ${station} finnes ikke`);
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
  return {
    station,
    active: st.active,
    closedMessage: st.active ? "" : st.closed_message,
    description: st.description,
    current: current ?? null,
    next: [...next],
    waitingCount: count?.n ?? 0,
    skipped: [...skipped],
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
      if ((now?.id ?? null) !== expectedCurrentId) return;
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
  description: string;
  active: boolean;
  closedMessage: string;
  joinKey: string;
  waitingCount: number;
  issued: number;
}

export async function getAdminStations(): Promise<AdminStation[]> {
  const sql = getSql();
  const rows = await sql<(StationRow & { waiting: number; closed_message: string })[]>`
    SELECT s.id, s.description, s.active, s.closed_message, s.join_key, s.next_number, s.generation,
      (SELECT count(*)::int FROM tickets t
        WHERE t.station = s.id AND t.generation = s.generation AND t.status = 'waiting') AS waiting
    FROM stations s ORDER BY s.id`;
  return rows.map((r) => ({
    id: r.id,
    description: r.description,
    active: r.active,
    closedMessage: r.closed_message,
    joinKey: r.join_key,
    waitingCount: r.waiting,
    issued: r.next_number - 1,
  }));
}

/** Tømmer køen for en stasjon og starter nummereringen på 1 igjen. */
export async function resetStation(station: StationId): Promise<void> {
  await begin(async (tx) => {
    await lockStation(tx, station);
    await tx`DELETE FROM queue_actions WHERE station = ${station}`;
    await tx`DELETE FROM tickets WHERE station = ${station}`;
    await tx`
      UPDATE stations SET next_number = 1, generation = generation + 1, updated_at = now()
      WHERE id = ${station}`;
  });
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

/** Nøklene for valgte stasjoner – kun til signering av skjermlenker på serveren. */
export async function getJoinKeys(): Promise<Record<string, string>> {
  const rows = await getSql()<{ id: string; join_key: string }[]>`SELECT id, join_key FROM stations`;
  return Object.fromEntries(rows.map((r) => [r.id, r.join_key]));
}

export async function rotateStationKey(station: StationId): Promise<void> {
  await getSql()`UPDATE stations SET join_key = ${randomToken()}, updated_at = now() WHERE id = ${station}`;
}

export async function setStationDescription(station: StationId, description: string): Promise<void> {
  await getSql()`UPDATE stations SET description = ${description}, updated_at = now() WHERE id = ${station}`;
}

export { STATION_IDS };
