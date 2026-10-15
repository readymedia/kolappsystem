import { TicketClient } from "./TicketClient";

export const metadata = { title: "Din kølapp" };

export default async function TicketPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TicketClient id={id} />;
}
