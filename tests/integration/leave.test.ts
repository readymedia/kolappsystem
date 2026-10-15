// Gi fra seg plassen og ventetid (v1.7) mot ekte Postgres (krever TEST_DATABASE_URL). Sletter data!

import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("gi fra seg plassen", () => {
  let q: typeof import("@/lib/queue");
  let sql: import("@/lib/db").Sql;
  const keys: Record<string, string> = {};

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    execFileSync("node", ["scripts/migrate.mjs"], { env: { ...process.env, DATABASE_URL: url }, stdio: "ignore" });
    q = await import("@/lib/queue");
    sql = (await import("@/lib/db")).getSql();
  });
  beforeEach(async () => {
    for (const s of ["A", "B", "C"]) await q.resetStation(s);
    await sql`UPDATE stations SET active = true`;
    await sql`UPDATE site_config SET allow_leave = true, wait_mode = 'fixed', wait_minutes = 2 WHERE id = 1`;
    for (const r of await sql<{ id: string; join_key: string }[]>`SELECT id, join_key FROM stations`) keys[r.id] = r.join_key;
  });
  afterAll(async () => {
    try {
      await sql`UPDATE site_config SET allow_leave = true, wait_mode = 'fixed', wait_minutes = 2 WHERE id = 1`;
    } catch {
      // Oppsettet feilet – ingenting å rydde.
    }
    await sql?.end({ timeout: 5 });
  });

  const join = async () => {
    const r = await q.joinQueue({ station: "A", key: keys.A! });
    if (!r.ok) throw new Error(r.error);
    return r.ticketId;
  };
  const stateA = async () => (await q.getPublicState()).stations.find((s) => s.id === "A")!;

  it("ventende gir fra seg plassen: ute av køen, de bak rykker fram, telles hos operatør og admin", async () => {
    const t1 = await join();
    const t2 = await join();
    expect(await q.leaveQueue(t1)).toMatchObject({ ok: true, station: "A", number: 1, wasCalled: false });
    expect((await stateA()).waiting).toEqual([2]);
    expect(await q.getTicket(t2)).toMatchObject({ status: "waiting", ahead: 0 });
    expect(await q.getTicket(t1)).toMatchObject({ status: "left" });
    expect((await q.getTicket(t1))!.leftAt).toBeTruthy();
    expect((await q.getOperatorView("A")).leftCount).toBe(1);
    expect((await q.getAdminStations()).find((s) => s.id === "A")!.leftCount).toBe(1);
    // Idempotent.
    expect(await q.leaveQueue(t1)).toMatchObject({ ok: true });
    // NESTE kaller A2, ikke den som gikk.
    await q.advance("A", "done");
    expect((await stateA()).current).toBe(2);
  });

  it("kalt gir fra seg plassen: operatøren får beskjed, og NESTE med gammel visning kaller neste", async () => {
    const t1 = await join();
    await join();
    await q.advance("A", "done"); // A1 kalles
    const before = await q.getOperatorView("A");
    expect(before.current?.number).toBe(1);
    expect(await q.leaveQueue(t1)).toMatchObject({ ok: true, wasCalled: true });
    const after = await q.getOperatorView("A");
    expect(after.current).toBeNull();
    expect(after.calledLeft).toMatchObject({ number: 1 });
    expect((await stateA()).current).toBeNull();
    // Operatøren trykker NESTE med det hun så (A1) – skal likevel kalle A2.
    await q.advance("A", "done", before.current!.id);
    expect((await stateA()).current).toBe(2);
    expect((await q.getOperatorView("A")).calledLeft).toBeNull();
  });

  it("operatørens «Angre siste» vekker aldri en lapp som er gitt fra seg", async () => {
    await join();
    const t2 = await join();
    await q.advance("A", "done"); // A1 kalt
    await q.advance("A", "done"); // A1 ferdig, A2 kalt
    await q.leaveQueue(t2);
    await q.undoLast("A"); // angrer siste NESTE: A1 kalles igjen, A2 skal IKKE tilbake
    expect(await q.getTicket(t2)).toMatchObject({ status: "left" });
    expect((await stateA()).current).toBe(1);
    const [called] = await sql<{ n: number }[]>`SELECT count(*)::int AS n FROM tickets WHERE station = 'A' AND status = 'called'`;
    expect(called!.n).toBe(1);
  });

  it("angre innen 60 s gir plassen tilbake når nummeret ikke er passert", async () => {
    const t1 = await join();
    await join();
    await q.leaveQueue(t1);
    expect(await q.rejoinQueue(t1)).toEqual({ ok: true, station: "A" });
    expect(await q.getTicket(t1)).toMatchObject({ status: "waiting", ahead: 0, leftAt: null });
  });

  it("angre er for sent når nummeret er passert eller tiden er ute", async () => {
    const t1 = await join();
    await join();
    await q.leaveQueue(t1);
    await q.advance("A", "done"); // A2 kalles – A1 er passert
    expect(await q.rejoinQueue(t1)).toEqual({ ok: false, error: "too_late" });

    await q.resetStation("A");
    const t3 = await join();
    await q.leaveQueue(t3);
    await sql`UPDATE tickets SET left_at = now() - interval '61 seconds' WHERE id = ${t3}`;
    expect(await q.rejoinQueue(t3)).toEqual({ ok: false, error: "too_late" });
  });

  it("hoppet over kan gi fra seg plassen; ferdige og ukjente kan ikke", async () => {
    const t1 = await join();
    await q.advance("A", "done");
    await q.advance("A", "skipped");
    expect(await q.leaveQueue(t1)).toMatchObject({ ok: true, wasCalled: false });
    expect((await stateA()).skipped).toEqual([]);

    const t2 = await join();
    await q.advance("A", "done");
    await q.advance("A", "done");
    expect(await q.leaveQueue(t2)).toEqual({ ok: false, error: "not_found" });
    expect(await q.leaveQueue("00000000-0000-4000-8000-000000000000")).toEqual({ ok: false, error: "not_found" });
    expect(await q.leaveQueue("ikke-en-id")).toEqual({ ok: false, error: "not_found" });
  });

  it("slått av i admin: ingen kan gi fra seg plassen", async () => {
    const t = await join();
    await sql`UPDATE site_config SET allow_leave = false WHERE id = 1`;
    expect(await q.leaveQueue(t)).toEqual({ ok: false, error: "leave_disabled" });
  });

  it("push-abonnementet slettes når plassen gis fra seg", async () => {
    const t = await join();
    await sql`INSERT INTO push_subscriptions (ticket_id, endpoint, p256dh, auth) VALUES (${t}, 'https://fcm.googleapis.com/x', 'p', 'a')`;
    await q.leaveQueue(t);
    expect((await sql`SELECT 1 FROM push_subscriptions WHERE ticket_id = ${t}`).length).toBe(0);
  });

  it("samtidig «gi fra seg» og NESTE gir aldri to kalte eller en kalt som har gått", async () => {
    for (let round = 0; round < 10; round++) {
      await q.resetStation("A");
      const t1 = await join();
      await join();
      await join();
      await q.advance("A", "done"); // A1 kalt
      await Promise.all([q.leaveQueue(t1), q.advance("A", "done"), q.leaveQueue(t1)]);
      const rows = await sql<{ number: number; status: string }[]>`SELECT number, status FROM tickets WHERE station = 'A' ORDER BY number`;
      expect(rows.filter((r) => r.status === "called")).toHaveLength(1);
      expect(rows[0]!.status === "left" || rows[0]!.status === "done").toBe(true);
    }
  });

  it("ventetid: fast verdi fra admin, eller målt tempo", async () => {
    expect((await stateA()).minutesPerPerson).toBe(2);
    await sql`UPDATE site_config SET wait_minutes = 4.5 WHERE id = 1`;
    expect((await stateA()).minutesPerPerson).toBe(4.5);

    for (let i = 0; i < 6; i++) await join();
    for (let i = 0; i < 5; i++) await q.advance("A", "done");
    // Opprop med 3 minutters mellomrom.
    const called = await sql<{ id: string }[]>`
      SELECT id FROM tickets WHERE station = 'A' AND called_at IS NOT NULL ORDER BY number`;
    for (const [i, r] of called.entries()) {
      await sql`UPDATE tickets SET called_at = now() - make_interval(mins => ${(called.length - 1 - i) * 3}) WHERE id = ${r.id}`;
    }
    await sql`UPDATE site_config SET wait_mode = 'measured' WHERE id = 1`;
    expect((await stateA()).minutesPerPerson).toBe(3);
    // B har ingen opprop → fast verdi.
    expect((await q.getPublicState()).stations.find((s) => s.id === "B")!.minutesPerPerson).toBe(4.5);
  });
});
