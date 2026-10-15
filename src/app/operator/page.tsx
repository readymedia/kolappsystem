import { CenteredMessage } from "@/components/ui";
import { PinGate } from "@/components/PinGate";
import { hasValidSession } from "@/lib/auth";
import { parseStationId } from "@/lib/config";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { ERROR_TEXT } from "@/lib/texts";
import { OperatorClient } from "./OperatorClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Operator – Meet & Greet" };

export default async function OperatorPage({ searchParams }: { searchParams: Promise<{ station?: string }> }) {
  const station = parseStationId((await searchParams).station) ?? "A";
  let authed = false;
  try {
    authed = await hasValidSession();
  } catch (err) {
    if (err instanceof DatabaseNotConfiguredError) return <CenteredMessage title="Databasen mangler" text={ERROR_TEXT.db_missing} />;
    throw err;
  }
  // key={station}: ny, tom visning ved bytte av stasjon, så tall fra forrige stasjon aldri vises.
  return authed ? <OperatorClient key={station} station={station} /> : <PinGate title="Operator" />;
}
