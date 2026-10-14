// PIN-hashing med scrypt fra Node sitt innebygde crypto-bibliotek.
// Ren JavaScript (.mjs) fordi den også brukes av scripts/migrate.mjs, som kjøres uten TypeScript.
// Format: scrypt$N$r$p$<salt base64url>$<hash base64url>

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";

const N = 16384;
const R = 8;
const P = 1;
const KEYLEN = 32;

/**
 * @param {string} password
 * @param {Buffer} salt
 * @param {number} n
 * @param {number} r
 * @param {number} p
 * @returns {Promise<Buffer>}
 */
function scrypt(password, salt, n, r, p) {
  return new Promise((resolve, reject) => {
    scryptCb(password, salt, KEYLEN, { N: n, r, p, maxmem: 64 * 1024 * 1024 }, (err, key) =>
      err ? reject(err) : resolve(key),
    );
  });
}

/**
 * Lager en hash som kan lagres i settings.pin_hash.
 * @param {string} pin
 * @returns {Promise<string>}
 */
export async function hashPin(pin) {
  const salt = randomBytes(16);
  const key = await scrypt(pin, salt, N, R, P);
  return ["scrypt", N, R, P, salt.toString("base64url"), key.toString("base64url")].join("$");
}

/**
 * Sammenligner en PIN mot lagret hash i konstant tid.
 * @param {string} pin
 * @param {string} stored
 * @returns {Promise<boolean>}
 */
export async function verifyPin(pin, stored) {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const [, n, r, p, saltB64, keyB64] = parts;
  const expected = Buffer.from(keyB64 ?? "", "base64url");
  const actual = await scrypt(pin, Buffer.from(saltB64 ?? "", "base64url"), Number(n), Number(r), Number(p));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Kryptografisk sterk, URL-trygg nøkkel. 16 byte = 128 bit = 22 tegn.
 * @param {number} [bytes]
 * @returns {string}
 */
export function randomToken(bytes = 16) {
  return randomBytes(bytes).toString("base64url");
}
