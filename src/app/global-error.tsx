"use client";

// Siste skanse hvis selve rammen (layout) krasjer. Må ha egen <html>/<body> og enkel stil.

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="nb">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#fbfaf8", margin: 0 }}>
        <main style={{ minHeight: "100dvh", display: "grid", placeItems: "center", padding: 24, textAlign: "center" }}>
          <div>
            <p style={{ fontSize: 22, color: "#0f172a" }}>Noe gikk galt</p>
            <p style={{ color: "#64748b" }}>Prøv igjen. Hjelper ikke det, spør en funksjonær.</p>
            <button
              type="button"
              onClick={() => reset()}
              style={{ marginTop: 16, height: 44, padding: "0 24px", borderRadius: 999, border: 0, background: "#0f172a", color: "#fff" }}
            >
              Prøv igjen
            </button>
          </div>
        </main>
      </body>
    </html>
  );
}
