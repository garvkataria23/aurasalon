import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const DEFAULT_WINDOW = 1;

function base32Encode(buffer) {
  let bits = "";
  let output = "";
  for (const byte of buffer) bits += byte.toString(2).padStart(8, "0");
  for (let index = 0; index < bits.length; index += 5) {
    const chunk = bits.slice(index, index + 5).padEnd(5, "0");
    output += BASE32_ALPHABET[Number.parseInt(chunk, 2)];
  }
  return output;
}

function base32Decode(secret) {
  const clean = String(secret || "").replace(/=+$/g, "").replace(/\s+/g, "").toUpperCase();
  let bits = "";
  for (const char of clean) {
    const value = BASE32_ALPHABET.indexOf(char);
    if (value === -1) continue;
    bits += value.toString(2).padStart(5, "0");
  }
  const bytes = [];
  for (let index = 0; index + 8 <= bits.length; index += 8) {
    bytes.push(Number.parseInt(bits.slice(index, index + 8), 2));
  }
  return Buffer.from(bytes);
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export class TwoFactorService {
  generateSecret() {
    return base32Encode(randomBytes(20));
  }

  generateProvisioningUri({ secret, accountName, issuer = "Aura Salon" }) {
    const label = `${issuer}:${accountName || "account"}`;
    const params = new URLSearchParams({
      secret,
      issuer,
      algorithm: "SHA1",
      digits: String(TOTP_DIGITS),
      period: String(TOTP_STEP_SECONDS)
    });
    return `otpauth://totp/${encodeURIComponent(label)}?${params.toString()}`;
  }

  generateToken({ secret, counter = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS) }) {
    const key = base32Decode(secret);
    const buffer = Buffer.alloc(8);
    buffer.writeBigUInt64BE(BigInt(counter));
    const hmac = createHmac("sha1", key).update(buffer).digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = ((hmac[offset] & 0x7f) << 24) |
      ((hmac[offset + 1] & 0xff) << 16) |
      ((hmac[offset + 2] & 0xff) << 8) |
      (hmac[offset + 3] & 0xff);
    return String(code % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
  }

  verifyToken({ secret, token, window = DEFAULT_WINDOW }) {
    const cleanToken = String(token || "").replace(/\s+/g, "");
    if (!secret || !/^\d{6}$/.test(cleanToken)) return false;
    const currentCounter = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS);
    for (let offset = -window; offset <= window; offset += 1) {
      if (safeEqual(this.generateToken({ secret, counter: currentCounter + offset }), cleanToken)) return true;
    }
    return false;
  }

  generateRecoveryCodes(count = 10) {
    return Array.from({ length: count }, () => randomBytes(5).toString("hex").toUpperCase().match(/.{1,5}/g).join("-"));
  }
}

export const twoFactorService = new TwoFactorService();
