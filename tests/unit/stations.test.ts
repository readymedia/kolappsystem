import { describe, expect, it } from "vitest";
import { contrastRatio } from "@/lib/color";
import {
  displayColumns,
  isStationColor,
  MAX_ACTIVE_STATIONS,
  nextFreeColor,
  nextFreeStationId,
  PALETTE,
  PALETTE_IDS,
  parseStationId,
  stationLabel,
  stationPlace,
  stationShades,
  stationsIntro,
  stationVars,
} from "@/lib/stations";

describe("stasjonskode", () => {
  it("én bokstav A–Z, små bokstaver godtas", () => {
    expect(parseStationId("a")).toBe("A");
    expect(parseStationId(" Q ")).toBe("Q");
    for (const bad of ["", "AB", "1", "Æ", "-", null, undefined, 5]) expect(parseStationId(bad)).toBeNull();
  });

  it("neste ledige bokstav gjenbruker aldri brukte (også arkiverte)", () => {
    expect(nextFreeStationId(["A", "B", "C"])).toBe("D");
    expect(nextFreeStationId(["A", "C"])).toBe("B");
    expect(nextFreeStationId("ABCDEFGHIJKLMNOPQRSTUVWXYZ".split(""))).toBeNull();
  });

  it("navn og setninger", () => {
    expect(stationLabel({ id: "A", name: "" })).toBe("Stasjon A");
    expect(stationLabel({ id: "D", name: " Hovedscenen " })).toBe("Hovedscenen");
    expect(stationPlace({ id: "A", name: "" })).toBe("stasjon A");
    expect(stationPlace({ id: "D", name: "Hovedscenen" })).toBe("Hovedscenen (stasjon D)");
  });
});

describe("farger", () => {
  it("A, B og C har nøyaktig dagens farger", () => {
    expect(stationShades("sky")).toEqual({ solid: "#0ea5e9", soft: "#f0f9ff", border: "#bae6fd", text: "#0284c7", display: "#38bdf8" });
    expect(stationShades("violet").solid).toBe("#8b5cf6");
    expect(stationShades("emerald").solid).toBe("#10b981");
  });

  it("paletten har 12 farger og leselig storskjermtekst", () => {
    expect(PALETTE_IDS).toHaveLength(12);
    for (const p of Object.values(PALETTE)) expect(contrastRatio(p.display, "#000000")).toBeGreaterThanOrEqual(4.5);
  });

  it("egen farge får utregnede varianter med god kontrast", () => {
    for (const hex of ["#ffeb3b", "#123456", "#ff00ff", "#00ff00", "#777777"]) {
      const s = stationShades(hex);
      expect(s.solid).toBe(hex);
      expect(contrastRatio(s.text, "#ffffff")).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(s.display, "#000000")).toBeGreaterThanOrEqual(4.5);
      expect(s.soft).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it("ukjent farge faller tilbake til grå, ugyldig verdi avvises", () => {
    expect(stationShades("rainbow").solid).toBe(PALETTE.slate!.solid);
    expect(isStationColor("sky")).toBe(true);
    expect(isStationColor("#a1b2c3")).toBe(true);
    for (const bad of ["red;", "#ABC", "#a1b2c3ff", "url(x)", "", 3]) expect(isStationColor(bad)).toBe(false);
  });

  it("CSS-variabler", () => {
    expect(stationVars("sky")).toEqual({
      "--st-solid": "#0ea5e9",
      "--st-soft": "#f0f9ff",
      "--st-border": "#bae6fd",
      "--st-text": "#0284c7",
      "--st-display": "#38bdf8",
    });
  });

  it("neste ledige farge", () => {
    expect(nextFreeColor(["sky", "violet", "emerald"])).toBe("amber");
    expect(nextFreeColor(PALETTE_IDS)).toBe(PALETTE_IDS[0]);
  });
});

describe("forsidetekst", () => {
  it("tre stasjoner gir dagens tekst", () => {
    expect(stationsIntro(3)).toBe("Tre stasjoner, én digital kø.");
    expect(stationsIntro(1)).toBe("Én stasjon, én digital kø.");
    expect(stationsIntro(7)).toBe("Sju stasjoner, én digital kø.");
    expect(stationsIntro(12)).toBe("Tolv stasjoner, én digital kø.");
  });
});

describe("storskjerm fordeler seg etter antall", () => {
  it("1 / 2–3 som før / 4 / 5–8 / 9–12", () => {
    expect([1, 2, 3, 4, 5, 8, 9, 12].map(displayColumns)).toEqual([1, 2, 3, 4, 4, 4, 6, 6]);
    expect(MAX_ACTIVE_STATIONS).toBe(12);
  });
});
