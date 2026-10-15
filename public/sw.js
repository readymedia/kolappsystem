/* Service worker for push-varsel (v1.5). Viser varsel og åpner kølappen ved trykk.
   Ingen mellomlagring av sider – appen trenger nett uansett. */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: event.data ? event.data.text() : "Kølapp" };
  }
  const title = data.title || "Kølapp";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      tag: data.tag || "kolapp",
      // Nytt varsel med samme tag (f.eks. «nest» → «din tur») skal lage lyd/vibrering igjen.
      renotify: true,
      requireInteraction: data.kind === "called",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      vibrate: data.kind === "called" ? [300, 150, 300, 150, 500] : [200],
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(url);
    })(),
  );
});
