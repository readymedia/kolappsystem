import { describe, expect, it } from "vitest";
import { detectNewCalls, parseStationFilter, takeSnapshot } from "@/lib/announce";
import { detectAudioType } from "@/lib/media";
import type { PublicStation } from "@/lib/public-state";

const bytes = (...parts: (string | number[])[]) =>
  new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)).concat(Array(16).fill(0)));

describe("gjenkjenning av lydfiler på innhold", () => {
  it("kjenner igjen alle støttede formater", () => {
    expect(detectAudioType(bytes("ID3", [4, 0, 0]))).toBe("audio/mpeg");
    expect(detectAudioType(bytes([0xff, 0xfb, 0x90, 0x64]))).toBe("audio/mpeg");
    expect(detectAudioType(bytes("RIFF", [0, 0, 0, 0], "WAVE"))).toBe("audio/wav");
    expect(detectAudioType(bytes([0, 0, 0, 0x20], "ftypM4A "))).toBe("audio/mp4");
    expect(detectAudioType(bytes("OggS"))).toBe("audio/ogg");
    expect(detectAudioType(bytes("fLaC"))).toBe("audio/flac");
    expect(detectAudioType(bytes("FORM", [0, 0, 0, 0], "AIFF"))).toBe("audio/aiff");
    expect(detectAudioType(bytes("FORM", [0, 0, 0, 0], "AIFC"))).toBe("audio/aiff");
  });
  it("avviser andre filer, også forkledde", () => {
    expect(detectAudioType(bytes("<svg onload=alert(1)>"))).toBeNull();
    expect(detectAudioType(bytes([0x89], "PNG"))).toBeNull();
    expect(detectAudioType(bytes("RIFF", [0, 0, 0, 0], "AVI "))).toBeNull();
    expect(detectAudioType(bytes("FORM", [0, 0, 0, 0], "ILBM"))).toBeNull();
    expect(detectAudioType(new Uint8Array([0x49, 0x44]))).toBeNull();
  });
});

describe("når lydsignal spilles", () => {
  const st = (id: "A" | "B" | "C", current: number | null, generation = 1): PublicStation => ({
    id,
    name: "",
    color: "sky",
    description: "",
    active: true,
    closedMessage: "",
    minutesPerPerson: 2,
    generation,
    nextNumber: 10,
    current,
    waiting: [],
    skipped: [],
  });

  it("ingen lyd ved første innlasting", () => {
    expect(detectNewCalls(null, [st("A", 3)], null)).toEqual([]);
  });
  it("lyd når nytt nummer kalles, ikke når det er uendret", () => {
    const prev = takeSnapshot([st("A", 3), st("B", null)]);
    expect(detectNewCalls(prev, [st("A", 4), st("B", null)], null)).toEqual([{ station: "A", number: 4 }]);
    expect(detectNewCalls(prev, [st("A", 3), st("B", null)], null)).toEqual([]);
  });
  it("lyd også når «Angre» kaller forrige nummer igjen", () => {
    expect(detectNewCalls(takeSnapshot([st("A", 4)]), [st("A", 3)], null)).toEqual([{ station: "A", number: 3 }]);
  });
  it("ingen lyd når ingen er kalt, eller etter nullstilling", () => {
    expect(detectNewCalls(takeSnapshot([st("A", 4)]), [st("A", null)], null)).toEqual([]);
    expect(detectNewCalls(takeSnapshot([st("A", 9, 1)]), [st("A", 1, 2)], null)).toEqual([]);
  });
  it("filter: bare valgte stasjoner, flere samtidig gir flere treff", () => {
    const prev = takeSnapshot([st("A", 1), st("B", 1), st("C", 1)]);
    const now = [st("A", 2), st("B", 2), st("C", 2)];
    expect(detectNewCalls(prev, now, ["B"])).toEqual([{ station: "B", number: 2 }]);
    expect(detectNewCalls(prev, now, null)).toHaveLength(3);
  });
  it("tolker stasjonsfilter fra adressen", () => {
    expect(parseStationFilter("a")).toEqual(["A"]);
    // Fra v1.6 er alle bokstaver gyldige koder; ukjente stasjoner filtreres bort mot køstatusen.
    expect(parseStationFilter("A, c,c,Z")).toEqual(["A", "C", "Z"]);
    expect(parseStationFilter("1,!,AB")).toBeNull();
    expect(parseStationFilter(null)).toBeNull();
  });
});
