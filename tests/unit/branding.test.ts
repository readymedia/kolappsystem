import { describe, expect, it } from "vitest";
import { brandingVars, DEFAULT_BRANDING, FONT_IDS, FONTS } from "@/lib/branding";
import { contrastRatio, contrastWarning, normalizeHex, textOn } from "@/lib/color";
import { buildDisplayQuery, DEFAULT_DISPLAY_OPTIONS, hasThemeParam } from "@/lib/display-options";
import { detectImageType, svgProblem } from "@/lib/media";

const enc = (s: string) => new TextEncoder().encode(s);
const bytes = (...b: number[]) => new Uint8Array([...b, ...Array(16).fill(0)]);

describe("farger og kontrast", () => {
  it("normaliserer hex", () => {
    expect(normalizeHex("#ABC")).toBe("#aabbcc");
    expect(normalizeHex("0f172a")).toBe("#0f172a");
    expect(normalizeHex(" #0F172A ")).toBe("#0f172a");
    for (const bad of ["", "#12", "#gggggg", "red", "#0f172a00", "url(x)"]) expect(normalizeHex(bad)).toBeNull();
  });

  it("regner kontrast etter WCAG", () => {
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 0);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("velger lesbar tekstfarge og varsler ved lav kontrast", () => {
    expect(textOn("#0f172a")).toBe("#ffffff");
    expect(textOn("#fde047")).toBe("#0f172a");
    expect(contrastWarning("#0f172a")).toBeNull();
    expect(contrastWarning("#ff6b6b")).toBeNull(); // mørk tekst gir nok kontrast
    expect(contrastWarning("#7a7a7a")).toMatch(/^Lav kontrast \(4,3:1\)/);
  });
});

describe("utseende", () => {
  it("standard gir dagens utseende", () => {
    expect(DEFAULT_BRANDING).toEqual({
      eventName: "Meet & Greet",
      logoUrl: null,
      primaryColor: "#0f172a",
      displayBackground: "dark",
      fontDisplay: "space-grotesk",
      fontBody: "inter",
    });
    const v = brandingVars(DEFAULT_BRANDING);
    expect(v["--brand-primary"]).toBe("#0f172a");
    expect(v["--brand-on-primary"]).toBe("#ffffff");
    expect(v["--brand-font-display"]).toMatch(/^"Space Grotesk Variable"/);
    expect(v["--brand-font-body"]).toMatch(/^"Inter Variable"/);
  });

  it("har alle fontene fra planen", () => {
    expect(FONT_IDS).toHaveLength(8);
    expect(Object.values(FONTS).map((f) => f.label.split(" (")[0])).toEqual([
      "Space Grotesk",
      "Inter",
      "Manrope",
      "DM Sans",
      "Source Sans 3",
      "Work Sans",
      "Atkinson Hyperlegible",
      "Systemfont",
    ]);
  });

  it("skjermlenken tar bare med tema når det avviker fra storskjermbakgrunnen", () => {
    const light = { ...DEFAULT_DISPLAY_OPTIONS, theme: "light" as const };
    expect(buildDisplayQuery(light)).toBe("?theme=light");
    expect(buildDisplayQuery(light, "light")).toBe("");
    expect(buildDisplayQuery(DEFAULT_DISPLAY_OPTIONS, "light")).toBe("?theme=dark");
    expect(hasThemeParam(new URLSearchParams("theme=dark"))).toBe(true);
    expect(hasThemeParam(new URLSearchParams("theme=blå"))).toBe(false);
  });
});

describe("logo: filtyper på innhold", () => {
  it("gjenkjenner PNG, JPEG, WebP og SVG", () => {
    expect(detectImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe("image/png");
    expect(detectImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe("image/jpeg");
    expect(detectImageType(enc("RIFF\0\0\0\0WEBPVP8 xxxx"))).toBe("image/webp");
    expect(detectImageType(enc('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"></svg>'))).toBe("image/svg+xml");
    expect(detectImageType(enc('﻿<?xml version="1.0"?>\n<!-- laget i Illustrator -->\n<svg width="1">'))).toBe("image/svg+xml");
  });

  it("avviser alt annet", () => {
    expect(detectImageType(enc("GIF89a............"))).toBeNull();
    expect(detectImageType(enc("<html><body><svg></svg></body></html>"))).toBeNull();
    expect(detectImageType(enc("RIFF\0\0\0\0WAVEfmt "))).toBeNull();
    expect(detectImageType(new Uint8Array(4))).toBeNull();
  });
});

describe("SVG-vern", () => {
  const ok = '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"><defs><linearGradient id="g"/></defs><rect fill="url(#g)"/><use href="#g"/><image href="data:image/png;base64,AAAA"/></svg>';

  it("godtar en vanlig logo (navnerom, interne lenker, innebygde bilder)", () => {
    expect(svgProblem(enc(ok))).toBeNull();
  });

  it.each([
    ['<svg><script>alert(1)</script></svg>', "skript"],
    ['<svg onload="alert(1)"></svg>', "hendelser"],
    ['<svg><rect onclick = "x()"/></svg>', "hendelser"],
    ["<svg><foreignObject><div/></foreignObject></svg>", "foreignObject"],
    ['<!DOCTYPE svg [<!ENTITY x "y">]><svg/>', "entiteter"],
    ['<svg><a href="javascript:alert(1)"/></svg>', "javascript"],
    ['<svg><image href="https://evil.example/x.png"/></svg>', "eksterne lenker"],
    ['<svg><use xlink:href="//evil.example/s.svg#a"/></svg>', "eksterne lenker"],
    ['<svg><image href="data:image/svg+xml;base64,AAAA"/></svg>', "eksterne lenker"],
    ['<svg><rect style="fill:url(https://evil.example/)"/></svg>', "url()"],
    ["<svg><iframe/></svg>", "innebygde"],
  ])("avviser %s", (svg, why) => {
    expect(svgProblem(enc(svg))).toContain(why);
  });
});
