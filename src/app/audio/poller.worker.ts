// Web Worker for lydsiden: henter køstatus og konfig i bakgrunnen.
// Tidtakere i workere dempes mye mindre enn i en bakgrunnsfane, så lydsiden fortsetter å
// lytte selv om den ligger bak andre vinduer (f.eks. på PC-en som spiller musikk).

type Msg = { type: "start"; stateMs: number; configMs: number } | { type: "stop" } | { type: "now" };

const scope = self as unknown as {
  postMessage(msg: unknown): void;
  onmessage: ((e: MessageEvent<Msg>) => void) | null;
};

let stateTimer: ReturnType<typeof setTimeout> | undefined;
let configTimer: ReturnType<typeof setTimeout> | undefined;
let stateMs = 3000;
let configMs = 15000;
let running = false;

async function getJson(url: string): Promise<{ ok: boolean; data: unknown }> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(url, { signal: controller.signal, credentials: "same-origin" });
    return { ok: res.ok, data: res.ok ? await res.json() : null };
  } catch {
    return { ok: false, data: null };
  } finally {
    clearTimeout(t);
  }
}

async function pollState() {
  clearTimeout(stateTimer);
  const r = await getJson("/api/state");
  scope.postMessage({ type: "state", ...r, at: Date.now() });
  if (running) stateTimer = setTimeout(pollState, stateMs);
}

async function pollConfig() {
  clearTimeout(configTimer);
  const r = await getJson("/api/config");
  scope.postMessage({ type: "config", ...r });
  if (running) configTimer = setTimeout(pollConfig, configMs);
}

scope.onmessage = (e) => {
  const msg = e.data;
  if (msg.type === "start") {
    stateMs = msg.stateMs;
    configMs = msg.configMs;
    running = true;
    void pollState();
    void pollConfig();
  } else if (msg.type === "now") {
    void pollState();
  } else if (msg.type === "stop") {
    running = false;
    clearTimeout(stateTimer);
    clearTimeout(configTimer);
  }
};
