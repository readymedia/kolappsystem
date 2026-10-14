import { describe, expect, it } from "vitest";
import { parseStationId } from "@/lib/config";
import { hashPin, randomToken, verifyPin } from "@/lib/pin-hash.mjs";
import { deriveTicket, type PublicStation } from "@/lib/public-state";
import { aheadText, waitText } from "@/lib/texts";

describe("tekster", () => {
  it("antall foran", () => {
    expect(aheadText(0)).toBe("Du er nest i køen");
    expect(aheadText(1)).toBe("1 person foran deg");
    expect(aheadText(7)).toBe("7 personer foran deg");
  });
  it("ventetid (2 min per person)", () => {
    expect(waitText(0)).toBe("Under 2 minutter");
    expect(waitText(1)).toBe("Ca. 2 minutter");
    expect(waitText(5)).toBe("Ca. 10 minutter");
  });
});

describe("stasjon fra URL", () => {
  it("godtar a/A/B/C og avviser resten", () => {
    expect(parseStationId("a")).toBe("A");
    expect(parseStationId(" C ")).toBe("C");
    expect(parseStationId("D")).toBeNull();
    expect(parseStationId(undefined)).toBeNull();
  });
});

describe("PIN-hash og nøkler", () => {
  it("verifiserer riktig PIN og avviser feil", async () => {
    const h = await hashPin("1234");
    expect(h.startsWith("scrypt$")).toBe(true);
    expect(await verifyPin("1234", h)).toBe(true);
    expect(await verifyPin("4321", h)).toBe(false);
    expect(await verifyPin("1234", "tull")).toBe(false);
  });
  it("lager 128-bits URL-trygge nøkler", () => {
    const k = randomToken();
    expect(k).toMatch(/^[A-Za-z0-9_-]{22}$/);
    expect(randomToken()).not.toBe(k);
  });
});

describe("utledning av lappstatus fra delt køstatus", () => {
  const st = (p: Partial<PublicStation> = {}): PublicStation => ({
    id: "A",
    description: "",
    active: true,
    generation: 1,
    nextNumber: 10,
    current: 4,
    waiting: [5, 6, 8],
    skipped: [2],
    ...p,
  });
  const t = (number: number, generation = 1) => ({ number, generation });

  it("kalt, ventende, hoppet over og ferdig", () => {
    expect(deriveTicket(t(4), st())).toEqual({ kind: "called" });
    expect(deriveTicket(t(8), st())).toEqual({ kind: "waiting", ahead: 2 });
    expect(deriveTicket(t(5), st())).toEqual({ kind: "waiting", ahead: 0 });
    expect(deriveTicket(t(2), st())).toEqual({ kind: "skipped" });
    expect(deriveTicket(t(3), st())).toEqual({ kind: "done" });
  });
  it("tåler at køstatusen er eldre enn lappen", () => {
    expect(deriveTicket(t(10), st())).toEqual({ kind: "waiting", ahead: 3 });
    expect(deriveTicket(t(1, 2), st())).toEqual({ kind: "waiting", ahead: 3 });
  });
  it("lapp fra før nullstilling regnes som borte", () => {
    expect(deriveTicket(t(4, 1), st({ generation: 2 }))).toEqual({ kind: "not_found" });
    expect(deriveTicket(t(4), undefined)).toEqual({ kind: "not_found" });
  });
});

describe("nettverk for forsøksgrenser", async () => {
  const { normalizeIp } = await import("@/lib/net");
  it("beholder IPv4 og pakker ut IPv4-mapped", () => {
    expect(normalizeIp("84.210.1.2")).toBe("84.210.1.2");
    expect(normalizeIp("::ffff:84.210.1.2")).toBe("84.210.1.2");
  });
  it("grupperer IPv6 på /64", () => {
    expect(normalizeIp("2001:db8:1:2:aaaa:bbbb:cccc:dddd")).toBe("2001:db8:1:2::/64");
    expect(normalizeIp("2001:db8:1:2::1")).toBe("2001:db8:1:2::/64");
    expect(normalizeIp("2001:db8::1")).toBe("2001:db8:0:0::/64");
    expect(normalizeIp("2001:DB8:1:2::99")).toBe(normalizeIp("2001:db8:1:2:ffff::1"));
  });
});
