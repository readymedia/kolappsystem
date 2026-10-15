import type { Metadata } from "next";
import { TicketClient } from "./TicketClient";

// Eget manifest per lapp: «Legg til på Hjem-skjerm» (iPhone) åpner denne lappen. Trengs for push på iPhone.
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  return {
    title: "Din kølapp",
    manifest: /^[0-9a-f-]{36}$/i.test(id) ? `/ticket/${id}/manifest.webmanifest` : undefined,
    appleWebApp: { capable: true, title: "Kølapp", statusBarStyle: "default" },
  };
}

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TicketClient id={id} />;
}
