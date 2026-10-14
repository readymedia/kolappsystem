import { TicketClient } from "./TicketClient";

export const metadata = { title: "Din kølapp – Meet & Greet" };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TicketClient id={id} />;
}
