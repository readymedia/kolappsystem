"use client";

import { Bell, BellOff, Share, SquarePlus } from "lucide-react";
import { useEffect, useState } from "react";
import { buttonClass } from "@/components/ui";
import { api } from "@/lib/client-api";
import { detectPushSupport, urlBase64ToBytes, type PushSupport } from "@/lib/push-support";

// «Varsle meg» på kølappen (v1.5). Vises bare når admin har slått på push OG nettleseren støtter det.
// iPhone i Safari får en kort veiviser (push på iPhone virker bare fra Hjem-skjerm).
// Den åpne kølappen (grønn skjerm, vibrering) er fortsatt hovedløsningen – push er et tillegg.

type View = "hidden" | "ios-guide" | "off" | "working" | "on" | "denied" | "error";

const storageKey = (ticketId: string) => `kolapp_push_${ticketId}`;

function currentSupport(): PushSupport {
  return detectPushSupport({
    userAgent: navigator.userAgent,
    maxTouchPoints: navigator.maxTouchPoints ?? 0,
    standalone:
      window.matchMedia?.("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true,
    hasServiceWorker: "serviceWorker" in navigator,
    hasPushManager: "PushManager" in window,
    hasNotification: "Notification" in window,
  });
}

export function PushPrompt({ ticketId, publicKey }: { ticketId: string; publicKey: string }) {
  const [view, setView] = useState<View>("hidden");
  const [guideOpen, setGuideOpen] = useState(false);

  // Finn utgangspunktet: støtte, tillatelse og om denne lappen allerede har varsel.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const support = currentSupport();
      let next: View = "hidden";
      if (support === "ios-homescreen") next = "ios-guide";
      else if (support === "supported") {
        if (Notification.permission === "denied") next = "denied";
        else {
          next = "off";
          try {
            // Registrer service worker med en gang, så «Varsle meg» går raskt (og innenfor brukerens trykk på iPhone).
            const reg = await navigator.serviceWorker.register("/sw.js");
            const sub = await reg.pushManager.getSubscription();
            const saved = localStorage.getItem(storageKey(ticketId));
            if (sub && saved === sub.endpoint && Notification.permission === "granted") next = "on";
          } catch {
            // Ingen tilgang til lagring o.l. – vis knappen.
          }
        }
      }
      if (!cancelled) setView(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [ticketId]);

  async function enable() {
    setView("working");
    try {
      // Må være første await i trykket (Safari krever brukerhandling for tillatelse).
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setView(permission === "denied" ? "denied" : "off");
        return;
      }
      const reg = await navigator.serviceWorker.register("/sw.js");
      await navigator.serviceWorker.ready;
      const key = urlBase64ToBytes(publicKey);
      let sub = await reg.pushManager.getSubscription();
      // Abonnement laget med en annen nøkkel kan ikke brukes – lag nytt.
      if (sub && !sameKey(sub, key)) {
        await sub.unsubscribe().catch(() => {});
        sub = null;
      }
      sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });
      const json = sub.toJSON();
      const res = await api(`/api/tickets/${ticketId}/push`, {
        method: "POST",
        json: { endpoint: json.endpoint, keys: json.keys },
      });
      if (!res.ok) {
        setView("error");
        return;
      }
      try {
        localStorage.setItem(storageKey(ticketId), json.endpoint ?? "");
      } catch {
        // Ignorer.
      }
      setView("on");
    } catch (err) {
      console.warn("[push] kunne ikke slå på varsel", err);
      setView("error");
    }
  }

  async function disable() {
    setView("working");
    try {
      const reg = await navigator.serviceWorker.getRegistration("/sw.js");
      const sub = await reg?.pushManager.getSubscription();
      // Behold abonnementet i nettleseren (kan gjelde andre lapper), men fjern det for denne lappen.
      if (sub) await api(`/api/tickets/${ticketId}/push`, { method: "DELETE", json: { endpoint: sub.endpoint } });
      localStorage.removeItem(storageKey(ticketId));
    } catch {
      // Ignorer – vis av uansett.
    }
    setView("off");
  }

  if (view === "hidden") return null;

  if (view === "ios-guide") {
    return (
      <div className="mt-6 rounded-3xl border border-slate-200 bg-white p-5" data-testid="push-ios-guide">
        <button
          type="button"
          className="flex w-full items-center gap-3 text-left"
          onClick={() => setGuideOpen((o) => !o)}
          aria-expanded={guideOpen}
        >
          <Bell className="h-5 w-5 shrink-0 text-slate-400" aria-hidden />
          <span className="flex-1 font-medium text-slate-800">Vil du få varsel på iPhone når det er din tur?</span>
          <span className="text-sm text-slate-500">{guideOpen ? "Skjul" : "Vis"}</span>
        </button>
        {guideOpen && (
          <ol className="mt-4 space-y-3 text-sm text-slate-700">
            <li className="flex items-start gap-2">
              <span className="font-semibold">1.</span>
              <span>
                Trykk på <Share className="inline h-4 w-4 align-text-bottom" aria-label="Del" /> <strong>Del</strong> nederst (eller øverst) i
                Safari.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold">2.</span>
              <span>
                Velg <SquarePlus className="inline h-4 w-4 align-text-bottom" aria-hidden /> <strong>Legg til på Hjem-skjerm</strong>, og trykk{" "}
                <strong>Legg til</strong>.
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-semibold">3.</span>
              <span>
                Åpne <strong>Kølapp</strong> fra Hjem-skjermen og trykk <strong>Varsle meg</strong>. Du beholder samme plass i køen.
              </span>
            </li>
            <li className="text-slate-500">Vil du ikke det, holder det å ha denne siden åpen.</li>
          </ol>
        )}
      </div>
    );
  }

  if (view === "denied") {
    return (
      <p className="mt-6 rounded-2xl bg-slate-100 px-4 py-3 text-center text-sm text-slate-600" data-testid="push-denied">
        Varsler er blokkert for denne siden i nettleseren. Ha siden åpen, så ser du når det er din tur.
      </p>
    );
  }

  if (view === "on") {
    return (
      <div className="mt-6 flex items-center gap-3 rounded-3xl border border-emerald-200 bg-emerald-50 p-4" data-testid="push-on">
        <Bell className="h-5 w-5 shrink-0 text-emerald-600" aria-hidden />
        <p className="flex-1 text-sm text-emerald-900">
          <strong>Varsel er på.</strong> Du får beskjed når du er nest og når det er din tur – også med låst skjerm.
        </p>
        <button type="button" onClick={disable} className={buttonClass("ghost", "sm")} aria-label="Slå av varsel">
          <BellOff className="h-4 w-4" aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={enable}
        disabled={view === "working"}
        className={`${buttonClass("primary", "lg")} w-full`}
        data-testid="push-enable"
      >
        <Bell className="h-5 w-5" aria-hidden />
        {view === "working" ? "Slår på …" : "Varsle meg når det er min tur"}
      </button>
      <p className="mt-2 text-center text-xs text-slate-500">
        {view === "error"
          ? "Klarte ikke å slå på varsel. Ha siden åpen, så ser du når det er din tur."
          : "Da kan du låse skjermen. Du får beskjed når du er nest og når det er din tur."}
      </p>
    </div>
  );
}

function sameKey(sub: PushSubscription, key: Uint8Array): boolean {
  const current = sub.options?.applicationServerKey;
  if (!current) return true;
  const a = new Uint8Array(current);
  return a.length === key.length && a.every((v, i) => v === key[i]);
}
