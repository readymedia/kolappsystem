import { describe, expect, it } from "vitest";
import { isAllowedEndpoint, isValidKeys, planNotifications, pushMessage, type SubscriptionState } from "@/lib/push-rules";
import { detectPushSupport, iosVersion, urlBase64ToBytes, type PushEnv } from "@/lib/push-support";

describe("SSRF-vern: bare kjente push-tjenester", () => {
  it.each([
    "https://fcm.googleapis.com/fcm/send/abc:def",
    "https://updates.push.services.mozilla.com/wpush/v2/gAAA",
    "https://web.push.apple.com/QGx2b",
    "https://wns2-par02p.notify.windows.com/w/?token=abc",
  ])("godtar %s", (url) => expect(isAllowedEndpoint(url)).toBe(true));

  it.each([
    "http://fcm.googleapis.com/fcm/send/x",
    "https://fcm.googleapis.com.evil.example/x",
    "https://evil.example/fcm.googleapis.com",
    "https://169.254.169.254/latest/meta-data",
    "https://localhost/x",
    "https://user:pw@fcm.googleapis.com/x",
    "https://fcm.googleapis.com:8443/x",
    "https://notify.windows.com.evil.example/x",
    "file:///etc/passwd",
    "ikke en adresse",
    "https://fcm.googleapis.com/" + "a".repeat(2000),
  ])("avviser %s", (url) => expect(isAllowedEndpoint(url)).toBe(false));

  it("lokal testmottaker bare med eksplisitt prefiks", () => {
    expect(isAllowedEndpoint("https://127.0.0.1:3299/sub/1")).toBe(false);
    expect(isAllowedEndpoint("https://127.0.0.1:3299/sub/1", "https://127.0.0.1:3299/")).toBe(true);
  });

  it("sjekker formen på nøklene", () => {
    const p256dh = "B" + "A".repeat(86);
    expect(isValidKeys(p256dh, "a".repeat(22))).toBe(true);
    expect(isValidKeys("kort", "a".repeat(22))).toBe(false);
    expect(isValidKeys(p256dh, "<script>")).toBe(false);
    expect(isValidKeys(undefined, undefined)).toBe(false);
  });
});

describe("hvem som får varsel", () => {
  const s = (p: Partial<SubscriptionState>): SubscriptionState => ({ id: "x", status: "waiting", first: false, lastKind: null, ...p });

  it("nest i køen én gang, deretter «din tur» én gang", () => {
    expect(planNotifications([s({ first: true })])).toEqual([{ id: "x", kind: "next" }]);
    expect(planNotifications([s({ first: true, lastKind: "next" })])).toEqual([]);
    expect(planNotifications([s({ status: "called", lastKind: "next" })])).toEqual([{ id: "x", kind: "called" }]);
    expect(planNotifications([s({ status: "called", lastKind: "called" })])).toEqual([]);
  });

  it("ingen varsel for de bak i køen eller ferdige", () => {
    expect(planNotifications([s({}), s({ status: "done", lastKind: "called" })])).toEqual([]);
  });

  it("hoppet over bare etter å ha blitt kalt; angre gir nytt «din tur»", () => {
    expect(planNotifications([s({ status: "skipped", lastKind: "called" })])).toEqual([{ id: "x", kind: "skipped" }]);
    expect(planNotifications([s({ status: "skipped", lastKind: null })])).toEqual([]);
    expect(planNotifications([s({ status: "called", lastKind: "skipped" })])).toEqual([{ id: "x", kind: "called" }]);
    // Satt tilbake i kø etter «hoppet over» og nå først: nytt «nest».
    expect(planNotifications([s({ first: true, lastKind: "skipped" })])).toEqual([{ id: "x", kind: "next" }]);
  });

  it("tekstene", () => {
    expect(pushMessage("called", "A12", "A")).toEqual({ title: "Det er din tur! A12", body: "Gå til stasjon A nå." });
    expect(pushMessage("next", "A12", "A").title).toBe("Du er nest i køen – A12");
    expect(pushMessage("skipped", "A12", "A").title).toBe("Du ble hoppet over – A12");
  });
});

describe("push-støtte per plattform", () => {
  const base: PushEnv = { userAgent: "", maxTouchPoints: 0, standalone: false, hasServiceWorker: true, hasPushManager: true, hasNotification: true };
  const iphone = (v: string) => `Mozilla/5.0 (iPhone; CPU iPhone OS ${v} like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1`;
  const android = "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36";

  it("leser iOS-versjon", () => {
    expect(iosVersion(iphone("17_4"))).toBeCloseTo(17.04);
    expect(iosVersion(iphone("16_3"))).toBeCloseTo(16.03);
    expect(iosVersion(android)).toBeNull();
  });

  it("Android og PC med push: støttet", () => {
    expect(detectPushSupport({ ...base, userAgent: android })).toBe("supported");
    expect(detectPushSupport({ ...base, userAgent: "Mozilla/5.0 (Windows NT 10.0) Chrome/129" })).toBe("supported");
  });

  it("iPhone i Safari: veiviser for Hjem-skjerm (16.4+), ingenting for eldre", () => {
    const safari = { ...base, hasPushManager: false };
    expect(detectPushSupport({ ...safari, userAgent: iphone("17_4") })).toBe("ios-homescreen");
    expect(detectPushSupport({ ...safari, userAgent: iphone("16_4") })).toBe("ios-homescreen");
    expect(detectPushSupport({ ...safari, userAgent: iphone("16_3") })).toBe("unsupported");
  });

  it("iPhone fra Hjem-skjerm: støttet når nettleseren har push", () => {
    expect(detectPushSupport({ ...base, standalone: true, userAgent: iphone("17_4") })).toBe("supported");
    expect(detectPushSupport({ ...base, standalone: true, hasPushManager: false, userAgent: iphone("16_1") })).toBe("unsupported");
  });

  it("iPad som later som Mac gjenkjennes som iOS", () => {
    const ipad = { ...base, hasPushManager: false, maxTouchPoints: 5, userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Version/17.4 Safari/605.1.15" };
    expect(detectPushSupport(ipad)).toBe("ios-homescreen");
  });

  it("nettleser uten push: ingenting", () => {
    expect(detectPushSupport({ ...base, hasPushManager: false, userAgent: android })).toBe("unsupported");
  });

  it("dekoder VAPID-nøkkel", () => {
    expect(Array.from(urlBase64ToBytes("AQID_-8"))).toEqual([1, 2, 3, 255, 239]);
  });
});
