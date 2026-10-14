"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client-api";
import { buttonClass } from "./ui";

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      type="button"
      className={buttonClass("ghost", "sm")}
      onClick={async () => {
        await api("/api/auth/logout", { method: "POST" });
        router.refresh();
      }}
    >
      <LogOut className="h-4 w-4" aria-hidden />
      Logg ut
    </button>
  );
}
