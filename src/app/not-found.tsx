import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[100dvh] items-center justify-center px-6">
      <div className="w-full max-w-sm rounded-[2rem] border border-slate-200 bg-white p-8 text-center">
        <p className="font-display text-5xl text-slate-300">404</p>
        <p className="mt-4 font-display text-xl text-slate-900">Siden finnes ikke</p>
        <p className="mt-2 text-sm text-slate-500">
          Har du en kølapp? Skann QR-koden ved stasjonen på nytt.
        </p>
        <Link href="/" className="mt-6 inline-flex h-11 items-center rounded-full bg-slate-900 px-6 text-sm font-medium text-white">
          Til forsiden
        </Link>
      </div>
    </main>
  );
}
