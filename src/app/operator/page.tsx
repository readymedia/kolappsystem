import { CenteredMessage } from "@/components/ui";
import { PinGate } from "@/components/PinGate";
import { hasValidSession } from "@/lib/auth";
import { parseStationId } from "@/lib/config";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { listActiveStations } from "@/lib/queue";
import { ERROR_TEXT } from "@/lib/texts";
import { OperatorClient } from "./OperatorClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Operator" };

export default async function OperatorPage({ searchParams }: { searchParams: Promise<{ station?: string }> }) {
  const wanted = parseStationId((await searchParams).station);
  let authed = false;
  try {
    authed = await hasValidSession();
  } catch (err) {
    if (err instanceof DatabaseNotConfiguredError) return <CenteredMessage title="Databasen mangler" text={ERROR_TEXT.db_missing} />;
    throw err;
  }
  if (!authed) return <PinGate title="Operator" />;
  // Stasjonene kommer fra databasen (v1.6). Ukjent eller arkivert stasjon i adressen: første aktive.
  const stations = await listActiveStations();
  const station = stations.find((s) => s.id === wanted)?.id ?? stations[0]?.id;
  if (!station) return <CenteredMessage title="Ingen stasjoner" text="Opprett en stasjon i admin først." />;
  // key={station}: ny, tom visning ved bytte av stasjon, så tall fra forrige stasjon aldri vises.
  return <OperatorClient key={station} station={station} stations={stations} />;
}
