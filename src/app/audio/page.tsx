import { Suspense } from "react";
import { AudioClient } from "./AudioClient";

export const metadata = { title: "Lydsignal" };

export default function AudioPage() {
  return (
    <Suspense fallback={null}>
      <AudioClient />
    </Suspense>
  );
}
