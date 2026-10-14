import { fail, handle, ok } from "@/lib/http";
import { getTicket } from "@/lib/queue";

// Én kølapp. Id-en er en tilfeldig UUID og fungerer som «adgangsbevis» til lappen.

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(req, {}, async () => {
    const ticket = await getTicket((await params).id);
    return ticket ? ok(ticket) : fail("not_found");
  });
}
