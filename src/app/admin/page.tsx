import { CenteredMessage } from "@/components/ui";
import { PinGate } from "@/components/PinGate";
import { hasValidSession } from "@/lib/auth";
import { DatabaseNotConfiguredError } from "@/lib/db";
import { ERROR_TEXT } from "@/lib/texts";
import { APP_COMMIT, APP_VERSION } from "@/lib/version";
import { AdminClient } from "./AdminClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin – Meet & Greet" };

export default async function AdminPage() {
  let authed = false;
  try {
    authed = await hasValidSession();
  } catch (err) {
    if (err instanceof DatabaseNotConfiguredError) return <CenteredMessage title="Databasen mangler" text={ERROR_TEXT.db_missing} />;
    throw err;
  }
  return authed ? <AdminClient version={APP_VERSION} commit={APP_COMMIT} /> : <PinGate title="Admin" />;
}
