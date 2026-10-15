import "server-only";
import QRCode from "qrcode";
import type { StationId } from "./config";

// Felles for admin-QR og storskjerm-QR: samme lenke, samme QR-oppsett.

export function joinUrl(origin: string, station: StationId, joinKey: string): string {
  return `${origin}/join?station=${station}&key=${encodeURIComponent(joinKey)}`;
}

export function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { type: "svg", errorCorrectionLevel: "M", margin: 1 });
}
