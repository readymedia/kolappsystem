// Integrasjonstester mot ekte Postgres. Kjøres bare når TEST_DATABASE_URL er satt, f.eks.:
//   TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5432/kolapp_test npm run test:integration
// ADVARSEL: testene sletter alle data i databasen de peker på. Bruk aldri produksjonsdatabasen.

import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("kølogikk mot Postgres", () => {
  let q: typeof import("@/lib/queue");
  let sql: import("@/lib/db").Sql;
  let rl: typeof import("@/lib/rate-limit");
  const keys: Record<string, string> = {};

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    execFileSync("node", ["scripts/migrate.mjs"], { env: { ...process.env, DATABASE_URL: url }, stdio: "ignore" });
    q = await import("@/lib/queue");
    rl = await import("@/lib/rate-limit");
    sql = (await import("@/lib/db")).getSql();
  });

  beforeEach(async () => {
    for (const s of ["A", "B", "C"] as const) await q.resetStation(s);
    await sql`UPDATE stations SET active = true, closed_message = ''`;
    for (const r of await sql<{ id: string; join_key: string }[]>`SELECT id, join_key FROM stations`) {
      keys[r.id] = r.join_key;
    }
  });

  afterAll(async () => {
    await sql?.end({ timeout: 5 });
  });

  const join = (station: "A" | "B" | "C", existingTicketId?: string) =>
    q.joinQueue({ station, key: keys[station]!, existingTicketId });

  it("avviser feil nøkkel og stengt stasjon", async () => {
    expect(await q.joinQueue({ station: "A", key: "feil" })).toEqual({ ok: false, error: "invalid_link" });
    await q.setStationActive("A", false);
    expect(await join("A")).toEqual({ ok: false, error: "closed" });
  });

  it("melding ved stengt stasjon er offentlig bare mens den er stengt, og hemmeligheter lekker ikke", async () => {
    await q.setStationActive("A", false, "Tilbake kl. 14.00");
    let st = (await q.getPublicState()).stations.find((x) => x.id === "A")!;
    expect(st).toMatchObject({ active: false, closedMessage: "Tilbake kl. 14.00" });
    expect((await q.getOperatorView("A")).closedMessage).toBe("Tilbake kl. 14.00");
    await q.setClosedMessage("A", "Pause til 13");
    expect((await q.getAdminStations())!.find((x) => x.id === "A")!.closedMessage).toBe("Pause til 13");
    await q.setStationActive("A", true);
    st = (await q.getPublicState()).stations.find((x) => x.id === "A")!;
    expect(st).toMatchObject({ active: true, closedMessage: "" });
    // Meldingen huskes til neste stenging uten ny melding.
    await q.setStationActive("A", false);
    expect((await q.getPublicState()).stations.find((x) => x.id === "A")!.closedMessage).toBe("Pause til 13");
    expect(JSON.stringify(await q.getPublicState())).not.toContain(keys.A!);
  });

  it("nøkler for signering av skjermlenker", async () => {
    expect(await q.getJoinKeys()).toEqual(keys);
  });

  it("gir 200 unike, sammenhengende nummer ved samtidige skann", async () => {
    const results = await Promise.all(Array.from({ length: 200 }, () => join("A")));
    expect(results.every((r) => r.ok)).toBe(true);
    const numbers = (await sql<{ number: number }[]>`SELECT number FROM tickets WHERE station = 'A' ORDER BY number`).map(
      (r) => r.number,
    );
    expect(numbers).toEqual(Array.from({ length: 200 }, (_, i) => i + 1));
  });

  it("nummererer hver stasjon for seg", async () => {
    await join("A");
    await join("A");
    const b = await join("B");
    const t = b.ok ? await q.getTicket(b.ticketId) : null;
    expect(t?.station).toBe("B");
    expect(t?.number).toBe(1);
  });

  it("gjenbruker enhetens aktive lapp", async () => {
    const first = await join("C");
    if (!first.ok) throw new Error("forventet lapp");
    const again = await join("C", first.ticketId);
    expect(again).toEqual({ ok: true, ticketId: first.ticketId, reused: true });
  });

  it("NESTE, Hopp over og Angre i flere steg", async () => {
    for (let i = 0; i < 4; i++) await join("A");
    await q.advance("A", "done"); // kaller 1
    await q.advance("A", "done"); // 1 ferdig, kaller 2
    await q.advance("A", "skipped"); // 2 hoppet over, kaller 3
    let v = await q.getOperatorView("A");
    expect(v.current?.number).toBe(3);
    expect(v.skipped.map((s) => s.number)).toEqual([2]);
    expect(v.waitingCount).toBe(1);

    expect(await q.undoLast("A")).toBe(true); // 2 kalt igjen, 3 tilbake i kø
    v = await q.getOperatorView("A");
    expect(v.current?.number).toBe(2);
    expect(v.next.map((n) => n.number)).toEqual([3, 4]);

    expect(await q.undoLast("A")).toBe(true); // 1 kalt igjen, 2 tilbake i kø
    v = await q.getOperatorView("A");
    expect(v.current?.number).toBe(1);
    expect(v.next.map((n) => n.number)).toEqual([2, 3, 4]);
  });

  it("setter overhoppet lapp tilbake først i køen", async () => {
    for (let i = 0; i < 3; i++) await join("B");
    await q.advance("B", "done"); // kaller 1
    await q.advance("B", "skipped"); // 1 hoppet over, kaller 2
    const v = await q.getOperatorView("B");
    expect(await q.requeueSkipped("B", v.skipped[0]!.id)).toBe(true);
    const after = await q.getOperatorView("B");
    expect(after.next.map((n) => n.number)).toEqual([1, 3]);
  });

  it("samtidige NESTE gir aldri to kalte lapper eller hopper over noen", async () => {
    for (let i = 0; i < 20; i++) await join("A");
    await Promise.all(Array.from({ length: 10 }, () => q.advance("A", "done")));
    const called = await sql`SELECT number FROM tickets WHERE station = 'A' AND status = 'called'`;
    const done = await sql`SELECT number FROM tickets WHERE station = 'A' AND status = 'done'`;
    expect(called).toHaveLength(1);
    expect(called[0]!.number).toBe(10);
    expect(done).toHaveLength(9);
  });

  it("dobbelt trykk på NESTE (samme forventede lapp) flytter køen bare ett steg", async () => {
    for (let i = 0; i < 4; i++) await join("A");
    await q.advance("A", "done", null); // kaller 1
    const v = await q.getOperatorView("A");
    const seen = v.current!.id;
    await Promise.all([q.advance("A", "done", seen), q.advance("A", "done", seen)]);
    const after = await q.getOperatorView("A");
    expect(after.current?.number).toBe(2);
    expect(after.next.map((n) => n.number)).toEqual([3, 4]);
  });

  it("angre etter «sett tilbake i kø» kaller den overhoppede igjen", async () => {
    for (let i = 0; i < 3; i++) await join("B");
    await q.advance("B", "done"); // kaller 1
    await q.advance("B", "skipped"); // 1 hoppet over, kaller 2
    const v = await q.getOperatorView("B");
    await q.requeueSkipped("B", v.skipped[0]!.id); // 1 venter igjen
    await q.undoLast("B"); // 2 tilbake i kø, 1 kalt
    const after = await q.getOperatorView("B");
    expect(after.current?.number).toBe(1);
    expect(after.next.map((n) => n.number)).toEqual([2, 3]);
  });

  it("samme requestId gir samme lapp (svar som forsvant på dårlig nett)", async () => {
    const requestId = "11111111-2222-4333-8444-555555555555";
    const a = await q.joinQueue({ station: "A", key: keys.A!, requestId });
    const b = await q.joinQueue({ station: "A", key: keys.A!, requestId });
    expect(a.ok && b.ok && a.ticketId === b.ticketId).toBe(true);
    expect(b).toMatchObject({ reused: true });
  });

  it("aktiv lapp vises selv om stasjonen er stengt etterpå", async () => {
    const first = await join("C");
    if (!first.ok) throw new Error("forventet lapp");
    await q.setStationActive("C", false);
    expect(await join("C", first.ticketId)).toEqual({ ok: true, ticketId: first.ticketId, reused: true });
    expect(await join("C")).toEqual({ ok: false, error: "closed" });
  });

  it("maks ventende per nettverk stopper flom", async () => {
    const { MAX_WAITING_PER_NETWORK } = await import("@/lib/config");
    const flood = await Promise.all(
      Array.from({ length: MAX_WAITING_PER_NETWORK }, () => q.joinQueue({ station: "B", key: keys.B!, ipHash: "nett-1" })),
    );
    expect(flood.every((r) => r.ok)).toBe(true);
    expect(await q.joinQueue({ station: "B", key: keys.B!, ipHash: "nett-1" })).toEqual({ ok: false, error: "too_many_waiting" });
    // Et annet nettverk påvirkes ikke.
    expect((await q.joinQueue({ station: "B", key: keys.B!, ipHash: "nett-2" })).ok).toBe(true);
  });

  it("fjerner bare ventende lapper i valgt område", async () => {
    for (let i = 0; i < 6; i++) await join("A");
    await q.advance("A", "done"); // kaller 1
    const removed = await q.removeWaitingRange("A", 1, 4); // 1 er kalt og røres ikke
    expect(removed).toBe(3);
    const v = await q.getOperatorView("A");
    expect(v.current?.number).toBe(1);
    expect(v.next.map((n) => n.number)).toEqual([5, 6]);
  });

  it("dobbelt trykk på «Angre» (samme forventede handling) angrer bare ett steg", async () => {
    for (let i = 0; i < 3; i++) await join("A");
    await q.advance("A", "done");
    await q.advance("A", "done");
    const v = await q.getOperatorView("A");
    await Promise.all([q.undoLast("A", v.lastActionId), q.undoLast("A", v.lastActionId)]);
    const after = await q.getOperatorView("A");
    expect(after.current?.number).toBe(1);
    expect(after.next.map((n) => n.number)).toEqual([2, 3]);
  });

  it("nullstilling starter på 1 og ugyldiggjør gamle lapper", async () => {
    const old = await join("A");
    await join("A");
    await q.resetStation("A");
    expect(old.ok && (await q.getTicket(old.ticketId))).toBeNull();
    const fresh = await join("A");
    const t = fresh.ok ? await q.getTicket(fresh.ticketId) : null;
    expect(t?.number).toBe(1);
  });

  it("offentlig status inneholder aldri nøkler", async () => {
    await join("A");
    const state = await q.getPublicState();
    const json = JSON.stringify(state);
    for (const k of Object.values(keys)) expect(json).not.toContain(k);
    expect(state.stations.find((s) => s.id === "A")?.waiting).toEqual([1]);
  });

  it("antall foran telles riktig", async () => {
    const ids = [];
    for (let i = 0; i < 3; i++) {
      const r = await join("C");
      if (r.ok) ids.push(r.ticketId);
    }
    expect((await q.getTicket(ids[2]!))?.ahead).toBe(2);
    await q.advance("C", "done");
    expect((await q.getTicket(ids[2]!))?.ahead).toBe(1);
  });

  it("forsøksgrense teller og sperrer", async () => {
    await rl.clearRateLimit("test:ip");
    for (let i = 0; i < 3; i++) expect((await rl.hitRateLimit("test:ip", 3, 60)).allowed).toBe(true);
    expect((await rl.hitRateLimit("test:ip", 3, 60)).allowed).toBe(false);
    expect(await rl.isRateLimited("test:ip", 3, 60)).toBe(true);
  });
});
