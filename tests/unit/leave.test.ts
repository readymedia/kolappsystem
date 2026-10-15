import { describe, expect, it } from "vitest";
import { waitText } from "@/lib/texts";
import { measuredMinutes } from "@/lib/wait";

describe("ventetid-tekst", () => {
  it("standard (2 min per person) er som før", () => {
    expect(waitText(0)).toBe("Under 2 minutter");
    expect(waitText(1)).toBe("Ca. 2 minutter");
    expect(waitText(5)).toBe("Ca. 10 minutter");
    expect(waitText(5, 2)).toBe("Ca. 10 minutter");
  });

  it("annet antall minutter, halve minutter og timer", () => {
    expect(waitText(3, 5)).toBe("Ca. 15 minutter");
    expect(waitText(3, 2.5)).toBe("Ca. 8 minutter"); // 7,5 rundes til 8
    expect(waitText(1, 0.5)).toBe("Ca. 1 minutt");
    expect(waitText(0, 0.5)).toBe("Under 1 minutt");
    expect(waitText(0, 4)).toBe("Under 4 minutter");
    expect(waitText(30, 2)).toBe("Ca. 1 t");
    expect(waitText(45, 3)).toBe("Ca. 2 t 15 min");
  });
});

describe("målt tempo", () => {
  const at = (...minutesAgo: number[]) => minutesAgo.map((m) => new Date(Date.UTC(2026, 9, 15, 12) - m * 60_000));

  it("for få opprop gir fast verdi", () => {
    expect(measuredMinutes([], 2)).toBe(2);
    expect(measuredMinutes(at(0, 3, 6), 2)).toBe(2); // bare 2 intervaller
  });

  it("midtverdi av intervallene, avrundet til halve minutter", () => {
    expect(measuredMinutes(at(0, 3, 6, 9), 2)).toBe(3);
    expect(measuredMinutes(at(0, 2, 5, 9, 12), 2)).toBe(3); // 2,3,4,3 → 3
    expect(measuredMinutes(at(0, 1.2, 2.4, 3.6), 2)).toBe(1); // 1,2 → 1
  });

  it("tåler ett avvikende opprop og ignorerer pauser over 30 min", () => {
    expect(measuredMinutes(at(0, 3, 6, 9, 24), 2)).toBe(3); // ett intervall på 15 påvirker lite
    expect(measuredMinutes(at(0, 3, 6, 50, 53), 2)).toBe(3); // 44 min pause tas ikke med
    expect(measuredMinutes(at(0, 3, 40, 80), 2)).toBe(2); // bare ett gyldig intervall → fast
  });

  it("rekkefølgen på tidspunktene spiller ingen rolle, og grensene holder", () => {
    expect(measuredMinutes(at(9, 0, 6, 3), 2)).toBe(3);
    expect(measuredMinutes(at(0, 0.1, 0.2, 0.3), 2)).toBe(0.5);
    expect(measuredMinutes(at(0, 29, 58, 87), 2)).toBe(29);
  });
});
