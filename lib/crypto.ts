import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { need } from "./env";

// AES-256-GCM. Stored format: v1.<iv>.<tag>.<ciphertext> (all base64url).
function key(): Buffer {
  const raw = Buffer.from(need("ENCRYPTION_KEY"), "base64");
  if (raw.length !== 32) {
    throw new Error('ENCRYPTION_KEY must be 32 random bytes, base64-encoded (node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'base64\'))").');
  }
  return raw;
}

export function encrypt(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ct = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64url"), cipher.getAuthTag().toString("base64url"), ct.toString("base64url")].join(".");
}

export function decrypt(stored: string): string {
  const [v, iv, tag, ct] = stored.split(".");
  if (v !== "v1" || !iv || !tag || !ct) throw new Error("Unrecognised token format.");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ct, "base64url")), decipher.final()]).toString("utf8");
}

export const sha256Hex = (s: string) => createHash("sha256").update(s).digest("hex");

/** Random id for public tracking keys: pk_ + 24 lowercase alphanumerics. */
export function newPublicKey(): string {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = randomBytes(24);
  let out = "pk_";
  for (const b of bytes) out += alphabet[b % alphabet.length];
  return out;
}
