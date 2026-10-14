// Ren hjelpefunksjon for nettverksadresser (testet i tests/unit/logic.test.ts).

/**
 * Normaliserer en klient-IP til «nettverket» den hører til:
 * - IPv4 beholdes som den er
 * - IPv4 i IPv6-form (::ffff:1.2.3.4) blir vanlig IPv4
 * - IPv6 kuttes til /64, fordi én enhet/husstand gjerne har et helt /64-nett og kan bytte adresse fritt
 */
export function normalizeIp(ip: string): string {
  const trimmed = ip.trim();
  if (!trimmed.includes(":")) return trimmed;
  const v4mapped = trimmed.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i);
  if (v4mapped?.[1]) return v4mapped[1];
  const lower = trimmed.toLowerCase();
  const [head = "", tail = ""] = lower.split("::");
  const h = head ? head.split(":") : [];
  const t = tail ? tail.split(":") : [];
  const groups = lower.includes("::") ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill("0"), ...t] : h;
  return `${groups.slice(0, 4).join(":")}::/64`;
}
