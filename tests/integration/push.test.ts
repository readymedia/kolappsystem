// Push-varsel mot ekte Postgres og en lokal push-mottaker (krever TEST_DATABASE_URL). Sletter data!

import { execFileSync } from "node:child_process";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { startMockPush, type MockPush } from "../push-mock";

const url = process.env.TEST_DATABASE_URL;
const run = url ? describe : describe.skip;

run("push-varsel", () => {
  let q: typeof import("@/lib/queue");
  let push: typeof import("@/lib/push");
  let sql: import("@/lib/db").Sql;
  let mock: MockPush;
  const keys: Record<string, string> = {};

  beforeAll(async () => {
    process.env.DATABASE_URL = url;
    execFileSync("node", ["scripts/migrate.mjs"], { env: { ...process.env, DATABASE_URL: url }, stdio: "ignore" });
    mock = await startMockPush();
    process.env.PUSH_TEST_ENDPOINT = mock.prefix;
    q = await import("@/lib/queue");
    push = await import("@/lib/push");
    sql = (await import("@/lib/db")).getSql();
  });

  beforeEach(async () => {
    for (const s of ["A", "B", "C"] as const) await q.resetStation(s);
    await sql`UPDATE stations SET active = true`;
    await sql`UPDATE site_config SET push_enabled = true WHERE id = 1`;
    await sql`DELETE FROM push_subscriptions`;
    for (const r of await sql<{ id: string; join_key: string }[]>`SELECT id, join_key FROM stations`) keys[r.id] = r.join_key;
    mock.received.length = 0;
    mock.status = 201;
  });

  afterAll(async () => {
    if (sql) await sql`UPDATE site_config SET push_enabled = false WHERE id = 1`;
    await mock?.close();
    await sql?.end({ timeout: 5 });
  });

  const join = async () => {
    const r = await q.joinQueue({ station: "A", key: keys.A! });
    if (!r.ok) throw new Error(r.error);
    return r.ticketId;
  };

  it("varsler «nest», «din tur» og «hoppet over» med kryptert innhold – én gang hver", async () => {
    const t1 = await join();
    const t2 = await join();
    const sub2 = mock.subscription("t2");
    expect(await push.savePushSubscription(t2, { endpoint: sub2.endpoint, ...sub2.keys })).toBe("ok");

    await q.advance("A", "done"); // A1 kalles → A2 er nest
    expect(await push.notifyStation("A")).toBe(1);
    expect(await push.notifyStation("A")).toBe(0); // ingen dobbel utsending
    await q.advance("A", "done"); // A2 kalles
    expect(await push.notifyStation("A")).toBe(1);
    await q.advance("A", "skipped"); // A2 hoppes over
    expect(await push.notifyStation("A")).toBe(1);

    const msgs = mock.received.map((r) => sub2.decrypt(r.body) as { title: string; url: string; kind: string });
    expect(msgs.map((m) => m.kind)).toEqual(["next", "called", "skipped"]);
    expect(msgs[1]).toMatchObject({ title: "Det er din tur! A2", url: `/ticket/${t2}` });
    const h = mock.received[0]!.headers;
    expect(h["content-encoding"]).toBe("aes128gcm");
    expect(String(h.authorization)).toMatch(/^vapid t=.+, k=.+/);
    expect(h.urgency).toBe("high");
    void t1;
  });

  it("samtidige kjøringer sender aldri dobbelt", async () => {
    await join();
    const t2 = await join();
    const s = mock.subscription("par");
    await push.savePushSubscription(t2, { endpoint: s.endpoint, ...s.keys });
    await q.advance("A", "done");
    const sent = await Promise.all([1, 2, 3, 4, 5].map(() => push.notifyStation("A")));
    expect(sent.reduce((a, b) => a + b, 0)).toBe(1);
    expect(mock.received).toHaveLength(1);
  });

  it("av i admin: lagrer ikke og sender ingenting", async () => {
    const t = await join();
    const s = mock.subscription("av");
    await push.savePushSubscription(t, { endpoint: s.endpoint, ...s.keys });
    await sql`UPDATE site_config SET push_enabled = false WHERE id = 1`;
    expect(await push.savePushSubscription(t, { endpoint: s.endpoint + "2", ...s.keys })).toBe("disabled");
    await q.advance("A", "done");
    expect(await push.notifyStation("A")).toBe(0);
    expect(mock.received).toHaveLength(0);
  });

  it("avviser ukjente push-adresser, ferdige og ukjente lapper", async () => {
    const t = await join();
    const s = mock.subscription("x");
    expect(await push.savePushSubscription(t, { endpoint: "https://evil.example/x", ...s.keys })).toBe("bad_endpoint");
    expect(await push.savePushSubscription("00000000-0000-4000-8000-000000000000", { endpoint: s.endpoint, ...s.keys })).toBe("not_found");
    await q.advance("A", "done");
    await q.advance("A", "done");
    expect(await push.savePushSubscription(t, { endpoint: s.endpoint, ...s.keys })).toBe("finished");
  });

  it("abonnementet slettes når push-tjenesten sier det er borte (410), og ved nullstilling", async () => {
    await join();
    const t2 = await join();
    const s = mock.subscription("borte");
    await push.savePushSubscription(t2, { endpoint: s.endpoint, ...s.keys });
    mock.status = 410;
    await q.advance("A", "done");
    await push.notifyStation("A");
    expect((await sql`SELECT 1 FROM push_subscriptions`).length).toBe(0);

    const t3 = await join();
    mock.status = 201;
    await push.savePushSubscription(t3, { endpoint: s.endpoint, ...s.keys });
    await q.resetStation("A");
    await push.notifyStation("A");
    expect((await sql`SELECT 1 FROM push_subscriptions`).length).toBe(0);
  });

  it("midlertidig feil hos push-tjenesten: prøves igjen ved neste handling", async () => {
    await join();
    const t2 = await join();
    const s = mock.subscription("retry");
    await push.savePushSubscription(t2, { endpoint: s.endpoint, ...s.keys });
    mock.status = 503;
    await q.advance("A", "done");
    expect(await push.notifyStation("A")).toBe(0);
    mock.status = 201;
    expect(await push.notifyStation("A")).toBe(1);
    expect((s.decrypt(mock.received.at(-1)!.body) as { kind: string }).kind).toBe("next");
  });

  it("velkomstvarsel bekrefter at det virker", async () => {
    const t = await join();
    const s = mock.subscription("hei");
    expect(await push.sendWelcome(t, { endpoint: s.endpoint, ...s.keys })).toBe(true);
    expect(s.decrypt(mock.received[0]!.body)).toMatchObject({ kind: "welcome", title: "Varsel er på – A1" });
  });

  it("teller gjester med varsel", async () => {
    const t = await join();
    const s = mock.subscription("telle");
    await push.savePushSubscription(t, { endpoint: s.endpoint, ...s.keys });
    expect(await push.countPushSubscriptions()).toBe(1);
  });
});
