"use client";

// Vises hvis en side krasjer. Publikum skal aldri se tekniske detaljer.

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-paper px-6">
      <div className="w-full max-w-sm rounded-[2rem] border border-slate-200 bg-white p-8 text-center">
        <p className="font-display text-xl text-slate-900">Noe gikk galt</p>
        <p className="mt-2 text-sm text-slate-500">Prøv igjen. Hjelper ikke det, spør en funksjonær.</p>
        <button
          type="button"
          onClick={() => reset()}
          className="mt-6 inline-flex h-11 items-center rounded-full bg-slate-900 px-6 text-sm font-medium text-white"
        >
          Prøv igjen
        </button>
      </div>
    </main>
  );
}
