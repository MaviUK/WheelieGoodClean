import crypto from "crypto";

function getKey(): Buffer {
  const raw = process.env.TOKEN_ENCRYPTION_KEY;
  if (!raw) throw new Error("Missing env: TOKEN_ENCRYPTION_KEY");

  // Accept base64, hex, or plain text (hashed to 32 bytes)
  if (/^[A-Za-z0-9+/=]+$/.test(raw) && raw.length >= 43) {
    const b = Buffer.from(raw, "base64");
    if (b.length === 32) return b;
  }
  if (/^[0-9a-fA-F]+$/.test(raw) && raw.length >= 64) {
    const b = Buffer.from(raw, "hex");
    if (b.length === 32) return b;
  }

  return crypto.createHash("sha256").update(raw).digest();
}

export function encryptString(plaintext: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString("base64url"),
    tag.toString("base64url"),
    enc.toString("base64url"),
  ].join(".");
}

export function decryptString(payload: string): string {
  const key = getKey();
  const [ivB64, tagB64, dataB64] = payload.split(".");
  if (!ivB64 || !tagB64 || !dataB64) throw new Error("Invalid encrypted payload");

  const iv = Buffer.from(ivB64, "base64url");
  const tag = Buffer.from(tagB64, "base64url");
  const data = Buffer.from(dataB64, "base64url");

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
}
