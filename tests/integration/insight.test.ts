// Kø-innsikt (v1.8) mot ekte Postgres: sluttid og kapasitet, statistikk ved nullstilling, nullstill alle, rapport.
// Krever TEST_DATABASE_URL. Sletter data!

import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("kø-innsikt", () => {
  let q: typeof import("@/lib/queue");
  let sql: import("@/lib/db").Sql;
  const keys: Record<string, string> = {};

  const clear = async () => {
    await sql`UPDATE stations SET service_end = NULL, max_waiting = NULL, active = true`;
    await sql`UPDATE site_config SET wait_mode = 'fixed', wait_minutes = 2 WHERE id = 1`;
  };

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    execFileSync("node", ["scripts/migrate.mjs"], { env: { ...process.env, DATABASE_URL: url }, stdio: "ignore" });
    q = await import("@/lib/queue");
    sql = (await import("@/lib/db")).getSql();
  });
  beforeEach(async () => {
    await clear();
    for (const s of ["A", "B", "C"]) await q.resetStation(s);
    await sql`DELETE FROM station_stats`;
    for (const r of await sql<{ id: string; join_key: string }[]>`SELECT id, join_key FROM stations`) keys[r.id] = r.join_key;
  });
  afterAll(async () => {
    try {
      await clear();
      await sql`DELETE FROM station_stats`;
    } catch {
      // Oppsettet feilet – ingenting å rydde.
    }
    await sql?.end({ timeout: 5 });
  });

  const join = (station = "A", existingTicketId?: string) => q.joinQueue({ station, key: keys[station]!, existingTicketId });
  const pub = async (id = "A") => (await q.getPublicState()).stations.find((s) => s.id === id)!;
  /** Klokkeslett «HH:MM» i norsk tid, minutter fra nå. */
  const osloIn = async (minutes: number) => {
    const [r] = await sql<{ t: string }[]>`
      SELECT to_char((now() AT TIME ZONE 'Europe/Oslo') + make_interval(mins => ${minutes}), 'HH24:MI') AS t`;
    return r!.t;
  };

  it("standard: ingen grenser, aldri full", async () => {
    const s = await pub();
    expect(s).toMatchObject({ serviceEnd: null, endAt: null, full: false, capacityLeft: null });
    expect((await q.getOperatorView("A")).full).toBe(false);
  });

  it("maks i kø: nye får queue_full, de som står beholder plassen", async () => {
    await q.updateStationLimits("A", { maxWaiting: 2 });
    const t1 = await join();
    const t2 = await join();
    expect(t1.ok && t2.ok).toBe(true);
    expect(await join()).toEqual({ ok: false, error: "queue_full" });
    // Samme mobil får fortsatt lappen sin.
    expect(await join("A", t1.ok ? t1.ticketId : undefined)).toMatchObject({ ok: true, reused: true });
    expect(await pub()).toMatchObject({ full: true, capacityLeft: 0 });
    expect(await q.getOperatorView("A")).toMatchObject({ full: true, capacityLeft: 0 });
    // Én kalles → plass til én til.
    await q.advance("A", "done");
    expect(await pub()).toMatchObject({ full: false, capacityLeft: 1 });
    expect((await join()).ok).toBe(true);
    // Andre stasjoner er ikke berørt.
    expect((await pub("B")).full).toBe(false);
  });

  it("samtidige skann ved grensen gir aldri flere enn maks", async () => {
    await q.updateStationLimits("A", { maxWaiting: 5 });
    const results = await Promise.all(Array.from({ length: 20 }, () => join()));
    expect(results.filter((r) => r.ok)).toHaveLength(5);
    expect(results.filter((r) => !r.ok && r.error === "queue_full")).toHaveLength(15);
    expect((await pub()).waiting).toEqual([1, 2, 3, 4, 5]);
  });

  it("sluttid: rekker ikke fram → full; etter sluttid er stasjonen full", async () => {
    // 2 min per person, sluttid om ca. 10 min → plass til omtrent 5–6.
    await q.updateStationLimits("A", { serviceEnd: await osloIn(11) });
    const s = await pub();
    expect(s.serviceEnd).toMatch(/^\d\d:\d\d$/);
    expect(s.endAt).toBeTruthy();
    expect(s.capacityLeft).toBeGreaterThanOrEqual(5);
    expect(s.capacityLeft).toBeLessThanOrEqual(6);
    let ok = 0;
    for (let i = 0; i < 10; i++) if ((await join()).ok) ok++;
    expect(ok).toBe(s.capacityLeft);
    expect((await pub()).full).toBe(true);

    // Sluttid passert (i dag) → full med en gang.
    await q.updateStationLimits("B", { serviceEnd: await osloIn(-2) });
    // Unngå midnatt-kanten: hopp over sjekken hvis «for to minutter siden» var i går.
    const [{ wrapped }] = (await sql<{ wrapped: boolean }[]>`
      SELECT ((now() AT TIME ZONE 'Europe/Oslo') - interval '2 minutes')::date <> (now() AT TIME ZONE 'Europe/Oslo')::date AS wrapped`) as unknown as [
      { wrapped: boolean },
    ];
    if (!wrapped) {
      expect(await pub("B")).toMatchObject({ full: true, capacityLeft: 0 });
      expect(await join("B")).toEqual({ ok: false, error: "queue_full" });
    }
  });

  it("stengt vinner over full, og sluttid/maks kan fjernes igjen", async () => {
    await q.updateStationLimits("A", { maxWaiting: 1 });
    await join();
    await q.setStationActive("A", false);
    expect(await join()).toEqual({ ok: false, error: "closed" });
    await q.setStationActive("A", true);
    expect(await join()).toEqual({ ok: false, error: "queue_full" });
    await q.updateStationLimits("A", { maxWaiting: null, serviceEnd: "" });
    expect(await pub()).toMatchObject({ full: false, capacityLeft: null, serviceEnd: null });
    expect((await join()).ok).toBe(true);
  });

  it("«Bruk på alle» setter grensen på alle aktive stasjoner, og bare feltene som sendes", async () => {
    await q.updateStationLimits("A", { serviceEnd: "16:00" });
    expect(await q.updateStationLimits(null, { maxWaiting: 50 })).toBe(3);
    const admin = await q.getAdminStations();
    expect(admin.map((s) => s.maxWaiting)).toEqual([50, 50, 50]);
    expect(admin.find((s) => s.id === "A")!.serviceEnd).toBe("16:00");
    expect(admin.find((s) => s.id === "B")!.serviceEnd).toBeNull();
  });

  it("nullstilling lagrer et sammendrag i rapporten – bare tall, ingen lapper", async () => {
    for (let i = 0; i < 4; i++) await join();
    await q.advance("A", "done"); // A1 kalt
    await q.advance("A", "done"); // A1 ferdig, A2 kalt
    await q.advance("A", "skipped"); // A2 hoppet over, A3 kalt
    const t4 = (await sql<{ id: string }[]>`SELECT id FROM tickets WHERE station = 'A' AND number = 4`)[0]!.id;
    await q.leaveQueue(t4);

    const before = await q.getReport();
    const cur = before.current.find((s) => s.station === "A")!;
    expect(cur).toMatchObject({ issued: 4, served: 1, skipped: 1, left: 1, waiting: 0, endedAt: null, label: "Stasjon A" });
    expect(cur.avgWaitSeconds).not.toBeNull();
    expect(cur.busiestHour).toMatch(/^\d\d:00$/);
    expect(before.history).toEqual([]);

    await q.resetStation("A");
    await q.resetStation("B"); // tom stasjon → ingen rad
    const after = await q.getReport();
    expect(after.history).toHaveLength(1);
    expect(after.history[0]).toMatchObject({ station: "A", issued: 4, served: 1, skipped: 1, left: 1 });
    expect(after.history[0]!.endedAt).toBeTruthy();
    expect(after.current.find((s) => s.station === "A")).toMatchObject({ issued: 0, served: 0 });
    // Ingen lapp-id-er eller nøkler i rapporten.
    expect(JSON.stringify(after)).not.toMatch(/join_key|[0-9a-f]{8}-[0-9a-f]{4}-/);
  });

  it("nullstill alle tømmer alle aktive køer og lagrer sammendrag per stasjon", async () => {
    await join("A");
    await join("B");
    await join("B");
    expect(await q.resetAllStations()).toBe(3);
    for (const id of ["A", "B", "C"]) expect((await pub(id)).waiting).toEqual([]);
    const { history } = await q.getReport();
    expect(history.map((h) => [h.station, h.issued]).sort()).toEqual([
      ["A", 1],
      ["B", 2],
    ]);
    // Nummereringen starter på 1 igjen.
    const r = await join("A");
    expect(r.ok && (await q.getTicket(r.ticketId))?.number).toBe(1);
  });
});
