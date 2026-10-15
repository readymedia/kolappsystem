// Fritt antall stasjoner (v1.6) mot ekte Postgres (krever TEST_DATABASE_URL). Sletter data!

import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("stasjoner", () => {
  let q: typeof import("@/lib/queue");
  let sql: import("@/lib/db").Sql;

  async function restoreDefaults() {
    await sql`DELETE FROM tickets WHERE station NOT IN ('A', 'B', 'C')`;
    await sql`DELETE FROM queue_actions WHERE station NOT IN ('A', 'B', 'C')`;
    await sql`DELETE FROM stations WHERE id NOT IN ('A', 'B', 'C')`;
    await sql`
      UPDATE stations SET archived_at = NULL, name = '', active = true,
        color = CASE id WHEN 'A' THEN 'sky' WHEN 'B' THEN 'violet' ELSE 'emerald' END,
        sort_order = ascii(id) - 64`;
    for (const s of ["A", "B", "C"]) await q.resetStation(s);
  }

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    execFileSync("node", ["scripts/migrate.mjs"], { env: { ...process.env, DATABASE_URL: url }, stdio: "ignore" });
    q = await import("@/lib/queue");
    sql = (await import("@/lib/db")).getSql();
  });
  beforeEach(restoreDefaults);
  afterAll(async () => {
    await restoreDefaults().catch(() => {});
    await sql?.end({ timeout: 5 });
  });

  it("A, B og C er som før: farger, rekkefølge, ingen navn", async () => {
    const st = (await q.getPublicState()).stations;
    expect(st.map((s) => [s.id, s.name, s.color])).toEqual([
      ["A", "", "sky"],
      ["B", "", "violet"],
      ["C", "", "emerald"],
    ]);
  });

  it("ny stasjon får neste bokstav, ledig farge og havner sist", async () => {
    const r = await q.createStation({ name: "Hovedscenen" });
    expect(r).toEqual({ ok: true, value: "D" });
    const st = (await q.getPublicState()).stations;
    expect(st.at(-1)).toMatchObject({ id: "D", name: "Hovedscenen", color: "amber", active: true, waiting: [] });
    // Kan ta imot skann med en gang.
    const [d] = await sql<{ join_key: string }[]>`SELECT join_key FROM stations WHERE id = 'D'`;
    expect(await q.joinQueue({ station: "D", key: d!.join_key })).toMatchObject({ ok: true });
    const [ticket] = await sql<{ id: string }[]>`SELECT id FROM tickets WHERE station = 'D'`;
    expect(await q.getTicket(ticket!.id)).toMatchObject({ station: "D", number: 1, stationName: "Hovedscenen", color: "amber" });
  });

  it("grensen på 12 holder også ved samtidige opprettelser, og bokstaver dobles aldri", async () => {
    const results = await Promise.all(Array.from({ length: 15 }, () => q.createStation()));
    const ok = results.filter((r) => r.ok).map((r) => (r as { value: string }).value);
    expect(ok).toHaveLength(9);
    expect(new Set(ok).size).toBe(9);
    expect(results.filter((r) => !r.ok).every((r) => !r.ok && r.error === "station_limit")).toBe(true);
    expect((await q.getPublicState()).stations).toHaveLength(12);
  });

  it("arkivering krever tom kø; arkivert stasjon er skjult og tar ikke imot skann", async () => {
    const [b] = await sql<{ join_key: string }[]>`SELECT join_key FROM stations WHERE id = 'B'`;
    await q.joinQueue({ station: "B", key: b!.join_key });
    expect(await q.archiveStation("B")).toEqual({ ok: false, error: "station_not_empty" });
    await q.advance("B", "done"); // B1 kalles – fortsatt ikke tom
    expect(await q.archiveStation("B")).toEqual({ ok: false, error: "station_not_empty" });
    await q.advance("B", "done"); // B1 ferdig
    expect(await q.archiveStation("B")).toEqual({ ok: true, value: undefined });

    expect((await q.getPublicState()).stations.map((s) => s.id)).toEqual(["A", "C"]);
    expect((await q.getAdminStations()).map((s) => s.id)).toEqual(["A", "C"]);
    expect((await q.getArchivedStations()).map((s) => s.id)).toEqual(["B"]);
    expect(Object.keys(await q.getJoinKeys())).toEqual(["A", "C"]);
    expect(await q.joinQueue({ station: "B", key: b!.join_key })).toEqual({ ok: false, error: "invalid_station" });
    // Bokstaven gjenbrukes ikke.
    expect(await q.createStation()).toEqual({ ok: true, value: "D" });
  });

  it("gjenoppretting gir tom kø og ny nøkkel (gammel QR virker ikke), og respekterer grensen", async () => {
    const [old] = await sql<{ join_key: string }[]>`SELECT join_key FROM stations WHERE id = 'C'`;
    expect(await q.archiveStation("C")).toMatchObject({ ok: true });
    expect(await q.restoreStation("C")).toMatchObject({ ok: true });
    const [now] = await sql<{ join_key: string }[]>`SELECT join_key FROM stations WHERE id = 'C'`;
    expect(now!.join_key).not.toBe(old!.join_key);
    expect((await q.getPublicState()).stations.map((s) => s.id)).toEqual(["A", "B", "C"]);

    expect(await q.archiveStation("C")).toMatchObject({ ok: true });
    for (let i = 0; i < 10; i++) await q.createStation();
    expect(await q.restoreStation("C")).toEqual({ ok: false, error: "station_limit" });
    expect(await q.restoreStation("Q")).toEqual({ ok: false, error: "invalid_station" });
  });

  it("rekkefølge, navn og farge", async () => {
    expect(await q.moveStation("C", -1)).toBe(true);
    expect((await q.getPublicState()).stations.map((s) => s.id)).toEqual(["A", "C", "B"]);
    expect(await q.moveStation("A", -1)).toBe(false);
    expect(await q.updateStationMeta("A", { name: "Signering", color: "#123456" })).toBe(true);
    expect((await q.getPublicState()).stations[0]).toMatchObject({ name: "Signering", color: "#123456" });
    await expect(sql`UPDATE stations SET color = 'red;' WHERE id = 'A'`).rejects.toThrow();
    await expect(sql`UPDATE stations SET name = ${"x".repeat(41)} WHERE id = 'A'`).rejects.toThrow();
  });

  it("ukjent stasjon gir StationNotFoundError (API: invalid_station)", async () => {
    const { StationNotFoundError } = await import("@/lib/stations");
    await expect(q.advance("Q", "done")).rejects.toBeInstanceOf(StationNotFoundError);
    await expect(q.getOperatorView("Q")).rejects.toBeInstanceOf(StationNotFoundError);
  });
});
