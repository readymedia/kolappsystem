import { Suspense } from "react";
import { DisplayClient } from "./DisplayClient";

export const metadata = { title: "Storskjerm – Meet & Greet" };

export default function DisplayPage() {
  return (
    <Suspense fallback={<main className="min-h-[100dvh] bg-black" />}>
      <DisplayClient />
    </Suspense>
  );
}
