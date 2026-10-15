import { describe, expect, it } from "vitest";
import { capacity, capacityText, clockAt, formatQueueShort, formatWait } from "@/lib/wait";

// 12:00 norsk sommertid (UTC+2) = 10:00 UTC. Oktober 2026 er fortsatt sommertid til 25.10.
const noon = new Date("2026-10-16T10:00:00Z");

describe("klokkeslett", () => {
  it("runder opp til nærmeste 5 minutter, norsk tid", () => {
    expect(clockAt(noon, 0)).toBe("12:00");
    expect(clockAt(noon, 1)).toBe("12:05");
    expect(clockAt(noon, 25)).toBe("12:25");
    expect(clockAt(noon, 26)).toBe("12:30");
    expect(clockAt(new Date("2026-10-16T21:58:00Z"), 10)).toBe("00:10"); // over midnatt
    expect(clockAt(new Date("2026-12-01T13:00:00Z"), 0)).toBe("14:00"); // vintertid (UTC+1)
  });
});

describe("ventetid som tid, klokkeslett eller begge", () => {
  it("varighet er som før (standard)", () => {
    expect(formatWait(0, 2, "duration", noon)).toBe("Under 2 minutter");
    expect(formatWait(5, 2, "duration", noon)).toBe("Ca. 10 minutter");
    expect(formatWait(5, 2, undefined, noon)).toBe("Ca. 10 minutter");
  });

  it("klokkeslett og begge", () => {
    expect(formatWait(12, 2, "clock", noon)).toBe("Din tur ca. kl. 12:25");
    expect(formatWait(12, 2, "both", noon)).toBe("Ca. 24 minutter – ca. kl. 12:25");
  });

  it("under 5 minutter vises bare varighet", () => {
    expect(formatWait(0, 2, "clock", noon)).toBe("Under 2 minutter");
    expect(formatWait(2, 2, "both", noon)).toBe("Ca. 4 minutter");
  });

  it("kort variant for storskjerm", () => {
    expect(formatQueueShort(0, 2, "duration", noon)).toBe("Ingen kø");
    expect(formatQueueShort(12, 2, "duration", noon)).toBe("12 i kø · ca. 24 min");
    expect(formatQueueShort(12, 2, "clock", noon)).toBe("12 i kø · ca. kl. 12:25");
    expect(formatQueueShort(12, 2, "both", noon)).toBe("12 i kø · ca. 24 min (kl. 12:25)");
    expect(formatQueueShort(40, 2, "duration", noon)).toBe("40 i kø · ca. 1 t 20 min");
    expect(formatQueueShort(1, 2, "clock", noon)).toBe("1 i kø · ca. 2 min");
  });
});

describe("sluttid og kapasitet", () => {
  const at = (hh: number, mm = 0) => new Date(Date.UTC(2026, 9, 16, hh - 2, mm));

  it("ingen grense: aldri full", () => {
    expect(capacity({ waiting: 500, minutesPerPerson: 2, endAt: null, maxWaiting: null, now: noon })).toEqual({ full: false, left: null });
  });

  it("maks i kø", () => {
    expect(capacity({ waiting: 9, minutesPerPerson: 2, endAt: null, maxWaiting: 10, now: noon })).toEqual({ full: false, left: 1 });
    expect(capacity({ waiting: 10, minutesPerPerson: 2, endAt: null, maxWaiting: 10, now: noon })).toEqual({ full: true, left: 0 });
  });

  it("sluttid: rekker en ny gjest fram før siste betjening?", () => {
    // 12:00, slutt 13:00, 2 min per person → posisjon 0..30 rekker = 31 plasser.
    expect(capacity({ waiting: 0, minutesPerPerson: 2, endAt: at(13), maxWaiting: null, now: noon })).toEqual({ full: false, left: 31 });
    expect(capacity({ waiting: 30, minutesPerPerson: 2, endAt: at(13), maxWaiting: null, now: noon })).toEqual({ full: false, left: 1 });
    expect(capacity({ waiting: 31, minutesPerPerson: 2, endAt: at(13), maxWaiting: null, now: noon })).toEqual({ full: true, left: 0 });
    // Etter sluttid: alltid full.
    expect(capacity({ waiting: 0, minutesPerPerson: 2, endAt: at(11), maxWaiting: null, now: noon }).full).toBe(true);
  });

  it("strengeste grense gjelder", () => {
    expect(capacity({ waiting: 5, minutesPerPerson: 2, endAt: at(13), maxWaiting: 8, now: noon })).toEqual({ full: false, left: 3 });
  });

  it("tekst til funksjonærene", () => {
    expect(capacityText(false, 18, "16:00")).toBe("Plass til ca. 18 til før kl. 16:00");
    expect(capacityText(false, 3, null)).toBe("Plass til ca. 3 til");
    expect(capacityText(true, 0, "16:00")).toBe("Full – siste betjening kl. 16:00");
    expect(capacityText(true, 0, null)).toBe("Full – maks antall i kø er nådd");
  });
});
