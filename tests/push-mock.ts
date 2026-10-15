// Lokal push-mottaker for tester: tar imot det serveren sender til «push-tjenesten», og kan dekryptere innholdet
// med abonnentens nøkler (samme kryptering som Google/Apple/Mozilla får, RFC 8291 aes128gcm).

import { execFileSync } from "node:child_process";
import { createECDH, randomBytes, type ECDH } from "node:crypto";
import { mkdtempSync, readFileSync } from "node:fs";
import { createServer, type Server } from "node:https";
import { tmpdir } from "node:os";
import path from "node:path";
// @ts-expect-error – http_ece har ikke typer
import ece from "http_ece";

export interface Received {
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: Buffer;
}

export interface MockPush {
  prefix: string;
  received: Received[];
  /** Svarkode neste forespørsler får (f.eks. 410 = abonnement borte). */
  status: number;
  subscription(name: string): { endpoint: string; keys: { p256dh: string; auth: string }; decrypt(body: Buffer): unknown };
  close(): Promise<void>;
}

export async function startMockPush(port = 0): Promise<MockPush> {
  const received: Received[] = [];
  const state = { status: 201 };
  // Push-tjenester bruker alltid https (web-push støtter bare det). Selvsignert sertifikat, kun for tester.
  const dir = mkdtempSync(path.join(tmpdir(), "kolapp-push-"));
  execFileSync("openssl", ["req", "-x509", "-newkey", "ec", "-pkeyopt", "ec_paramgen_curve:prime256v1", "-nodes", "-days", "1",
    "-subj", "/CN=127.0.0.1", "-keyout", path.join(dir, "key.pem"), "-out", path.join(dir, "cert.pem")], { stdio: "ignore" });
  const tls = { key: readFileSync(path.join(dir, "key.pem")), cert: readFileSync(path.join(dir, "cert.pem")) };
  const server: Server = createServer(tls, (req, res) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      received.push({ path: req.url ?? "", headers: req.headers, body: Buffer.concat(chunks) });
      res.writeHead(state.status).end();
    });
  });
  await new Promise<void>((r) => server.listen(port, "127.0.0.1", () => r()));
  const actualPort = (server.address() as { port: number }).port;
  const prefix = `https://127.0.0.1:${actualPort}/`;
  return {
    prefix,
    received,
    get status() {
      return state.status;
    },
    set status(v: number) {
      state.status = v;
    },
    subscription(name: string) {
      const ecdh: ECDH = createECDH("prime256v1");
      ecdh.generateKeys();
      const auth = randomBytes(16);
      return {
        endpoint: `${prefix}${name}`,
        keys: { p256dh: ecdh.getPublicKey().toString("base64url"), auth: auth.toString("base64url") },
        decrypt(body: Buffer) {
          const plain: Buffer = ece.decrypt(body, { version: "aes128gcm", privateKey: ecdh, authSecret: auth.toString("base64url") });
          return JSON.parse(plain.toString("utf8"));
        },
      };
    },
    close: () => new Promise<void>((r) => server.close(() => r())),
  };
}
