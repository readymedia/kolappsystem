import { CenteredMessage } from "@/components/ui";
import { PinGate } from "@/components/PinGate";
import { hasValidSession } from "@/lib/auth";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { ERROR_TEXT } from "@/lib/texts";
import { UtseendeClient } from "./UtseendeClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Utseende" };

export default async function UtseendePage() {
  let authed = false;
  try {
    authed = await hasValidSession();
  } catch (err) {
    if (err instanceof DatabaseNotConfiguredError) return <CenteredMessage title="Databasen mangler" text={ERROR_TEXT.db_missing} />;
    throw err;
  }
  return authed ? <UtseendeClient /> : <PinGate title="Admin" />;
}
