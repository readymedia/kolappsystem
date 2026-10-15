import { describe, expect, it } from "vitest";
import { buildDisplayQuery, DEFAULT_DISPLAY_OPTIONS, parseDisplayOptions } from "@/lib/display-options";
import { computeDisplayToken } from "@/lib/display-token";

const parse = (q: string) => parseDisplayOptions(new URLSearchParams(q));

describe("skjermvalg fra adressen", () => {
  it("uten valg = dagens storskjerm", () => {
    expect(parse("")).toEqual(DEFAULT_DISPLAY_OPTIONS);
    expect(DEFAULT_DISPLAY_OPTIONS).toMatchObject({ stations: null, size: "m", next: 3, header: true, title: true, theme: "dark" });
  });

  it("leser alle valg", () => {
    expect(parse("station=a,C&size=xl&title=0&desc=1&next=5&header=0&clock=1&theme=light&sound=1&qr=1&t=abcdefghijklmnop1234")).toEqual({
      stations: ["A", "C"],
      size: "xl",
      title: false,
      desc: true,
      next: 5,
      header: false,
      clock: true,
      theme: "light",
      sound: true,
      qr: true,
      token: "abcdefghijklmnop1234",
    });
  });

  it("ugyldige verdier gir standard, aldri feil", () => {
    const o = parse("station=1&size=huge&next=9&title=ja&theme=blue&t=<script>&clock=");
    expect(o).toEqual({ ...DEFAULT_DISPLAY_OPTIONS });
    expect(parse("next=-1").next).toBe(3);
    expect(parse("next=0").next).toBe(0);
  });

  it("lenkebyggeren utelater standardverdier og kan leses tilbake", () => {
    expect(buildDisplayQuery(DEFAULT_DISPLAY_OPTIONS)).toBe("");
    const o = { ...DEFAULT_DISPLAY_OPTIONS, stations: ["A" as const], size: "xl" as const, next: 0, clock: true };
    const q = buildDisplayQuery(o);
    expect(q).toBe("?station=A&size=xl&next=0&clock=1");
    expect(parse(q.slice(1))).toEqual(o);
  });

  it("QR tas bare med når token finnes", () => {
    expect(buildDisplayQuery({ ...DEFAULT_DISPLAY_OPTIONS, qr: true })).toBe("");
    expect(buildDisplayQuery({ ...DEFAULT_DISPLAY_OPTIONS, qr: true, token: "abcdefghijklmnop" })).toBe("?qr=1&t=abcdefghijklmnop");
  });
});

describe("signert skjermlenke for QR", () => {
  const secret = new TextEncoder().encode("hemmelig-test");
  const keys = { A: "nokkel-a", B: "nokkel-b", C: "nokkel-c" };

  it("er stabil, kort og uavhengig av rekkefølge", () => {
    const t = computeDisplayToken(["A", "C"], keys, secret);
    expect(t).toMatch(/^[A-Za-z0-9_-]{32}$/);
    expect(computeDisplayToken(["C", "A"], keys, secret)).toBe(t);
  });

  it("blir ugyldig ved nøkkelbytte, annet utvalg eller annen hemmelighet", () => {
    const t = computeDisplayToken(["A"], keys, secret);
    expect(computeDisplayToken(["A"], { ...keys, A: "ny" }, secret)).not.toBe(t);
    expect(computeDisplayToken(["B"], keys, secret)).not.toBe(t);
    expect(computeDisplayToken(["A", "B"], keys, secret)).not.toBe(t);
    expect(computeDisplayToken(["A"], keys, new TextEncoder().encode("annen"))).not.toBe(t);
  });

  it("nøkkelbytte på en stasjon utenfor utvalget påvirker ikke", () => {
    expect(computeDisplayToken(["A"], { ...keys, B: "ny" }, secret)).toBe(computeDisplayToken(["A"], keys, secret));
  });

  it("tokenet inneholder ikke nøkkelen", () => {
    expect(computeDisplayToken(["A"], keys, secret)).not.toContain("nokkel");
  });
});
