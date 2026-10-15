import { Suspense } from "react";
import { CenteredMessage, Spinner } from "@/components/ui";
import { JoinClient } from "./JoinClient";

export const metadata = { title: "Henter kølapp" };

export default function JoinPage() {
  return (
    <Suspense fallback={<CenteredMessage icon={<Spinner />} title="Henter kølappen din …" />}>
      <JoinClient />
    </Suspense>
  );
}
