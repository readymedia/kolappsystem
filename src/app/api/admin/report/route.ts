import { NextResponse } from "next/server";
import { handle, ok } from "@/lib/http";
import { getReport, type StationStats } from "@/lib/queue";

// Admin: rapport (v1.8). JSON, eller CSV med ?format=csv (semikolon og UTF-8 med BOM – åpnes riktig i norsk Excel).
// Bare tall og tider – ingen persondata.

const HEAD = [
  "Runde",
  "Stasjon",
  "Kode",
  "Start",
  "Slutt",
  "Delt ut",
  "Betjent",
  "Hoppet over",
  "Ga fra seg plassen",
  "Venter",
  "Snitt ventetid (min)",
  "Lengste ventetid (min)",
  "Minutter per person",
  "Travleste time",
];

const time = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("nb-NO", { timeZone: "Europe/Oslo", dateStyle: "short", timeStyle: "short" }) : "";
const minutes = (s: number | null) => (s === null ? "" : (s / 60).toFixed(1).replace(".", ","));
const cell = (v: string | number) => {
  const t = String(v);
  return /[;"\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
};

function row(kind: string, s: StationStats): string {
  return [
    kind,
    s.label,
    s.station,
    time(s.startedAt),
    time(s.endedAt),
    s.issued,
    s.served,
    s.skipped,
    s.left,
    s.waiting,
    minutes(s.avgWaitSeconds),
    minutes(s.maxWaitSeconds),
    s.minutesPerPerson === null ? "" : String(s.minutesPerPerson).replace(".", ","),
    s.busiestHour ?? "",
  ]
    .map(cell)
    .join(";");
}

export async function GET(req: Request) {
  return handle(req, { requireSession: true }, async () => {
    const report = await getReport();
    if (new URL(req.url).searchParams.get("format") !== "csv") return ok(report);
    const lines = [HEAD.join(";"), ...report.current.map((s) => row("Nå", s)), ...report.history.map((s) => row("Tidligere", s))];
    const date = new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" });
    return new NextResponse("\uFEFF" + lines.join("\r\n"), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="kolapp-rapport-${date}.csv"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
