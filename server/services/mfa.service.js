import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual
} from "node:crypto";
import { env } from "../config/env.js";
import { repositories } from "../repositories/repository-registry.js";
import { badRequest, forbidden, unauthorized } from "../utils/app-error.js";

/**
 * MFA service (ADD-ONLY feature).
 *
 * Implements RFC 6238 TOTP (HMAC-SHA1, 6 digits, 30s step) using only the
 * Node.js crypto module — no new dependencies. The TOTP shared secret is
 * stored AES-256-GCM encrypted inside the existing `encrypted_secrets` table
 * (one row per user, name = `mfa-totp:<userId>`). Recovery codes are stored
 * as SHA-256 hashes only. Nothing here modifies existing auth code; it wraps
 * around it.
 */

const TOTP_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
const TOTP_WINDOW = 1; // accept current code +/- 1 step (clock drift)
const SECRET_NAME = (userId) => `mfa-totp:${userId}`;
const SECRET_PURPOSE = "mfa-totp";
const ISSUER = "Aura Salon CRM";

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${randomUUID().slice(0, 10)}`;

// ---- base32 (RFC 4648) -----------------------------------------------------
const B32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

function base32Encode(buffer) {
  let bits = 0;
  let value = 0;
  let output = "";
  for (const byte of buffer) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      output += B32_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) output += B32_ALPHABET[(value << (5 - bits)) & 31];
  return output;
}

function base32Decode(input) {
  const clean = String(input || "").toUpperCase().replace(/=+$/g, "").replace(/\s/g, "");
  let bits = 0;
  let value = 0;
  const bytes = [];
  for (const char of clean) {
    const idx = B32_ALPHABET.indexOf(char);
    if (idx === -1) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      bytes.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(bytes);
}

// ---- AES-256-GCM secret-at-rest -------------------------------------------
function encryptionKey() {
  return scryptSync(String(env.jwtSecret || ""), "aura-mfa-secret-key", 32);
}

function encryptSecret(plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), "utf8"), cipher.final()]);
  return {
    iv: iv.toString("hex"),
    authTag: cipher.getAuthTag().toString("hex"),
    ciphertext: ciphertext.toString("hex")
  };
}

function decryptSecret({ iv, authTag, ciphertext }) {
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), Buffer.from(iv, "hex"));
  decipher.setAuthTag(Buffer.from(authTag, "hex"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertext, "hex")), decipher.final()]).toString("utf8");
}

// ---- TOTP ------------------------------------------------------------------
function hotp(secretBase32, counter) {
  const key = base32Decode(secretBase32);
  const buffer = Buffer.alloc(8);
  // 64-bit big-endian counter
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac("sha1", key).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}

function verifyTotp(secretBase32, code) {
  const clean = String(code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  const counter = Math.floor(Date.now() / 1000 / TOTP_STEP_SECONDS);
  for (let offset = -TOTP_WINDOW; offset <= TOTP_WINDOW; offset += 1) {
    const candidate = hotp(secretBase32, counter + offset);
    if (candidate.length === clean.length && timingSafeEqual(Buffer.from(candidate), Buffer.from(clean))) {
      return true;
    }
  }
  return false;
}

// ---- recovery codes --------------------------------------------------------
function hashCode(code) {
  return createHash("sha256").update(String(code)).digest("hex");
}

function generateRecoveryCodes(count = 10) {
  const codes = [];
  for (let i = 0; i < count; i += 1) {
    const raw = randomBytes(5).toString("hex").toUpperCase(); // 10 hex chars
    codes.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
  }
  return codes;
}

export class MfaService {
  scopeFor(access) {
    return { tenantId: access.tenantId };
  }

  recordFor(access) {
    const userId = access.userId;
    if (!userId) throw badRequest("userId is required");
    return repositories.encryptedSecrets
      .list({ limit: 100000 }, this.scopeFor(access))
      .find((row) => row.name === SECRET_NAME(userId) && row.purpose === SECRET_PURPOSE);
  }

  status(access) {
    const record = this.recordFor(access);
    if (!record) return { enabled: false, pending: false };
    const meta = record.metadata || {};
    return {
      enabled: Boolean(meta.enabled),
      pending: !meta.enabled,
      recoveryCodesRemaining: Array.isArray(meta.recoveryCodeHashes) ? meta.recoveryCodeHashes.length : 0,
      verifiedAt: meta.verifiedAt || ""
    };
  }

  /** Generate (or regenerate) a pending TOTP secret and return enrolment data. */
  setup(access, { accountLabel = "" } = {}) {
    const secret = base32Encode(randomBytes(20));
    const encrypted = encryptSecret(secret);
    const label = encodeURIComponent(accountLabel || access.userId || "user");
    const issuer = encodeURIComponent(ISSUER);
    const otpauthUri =
      `otpauth://totp/${issuer}:${label}?secret=${secret}` +
      `&issuer=${issuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TOTP_STEP_SECONDS}`;

    const existing = this.recordFor(access);
    const payload = {
      name: SECRET_NAME(access.userId),
      purpose: SECRET_PURPOSE,
      algorithm: "aes-256-gcm",
      iv: encrypted.iv,
      authTag: encrypted.authTag,
      ciphertext: encrypted.ciphertext,
      status: "pending",
      metadata: { enabled: false, createdAt: now() }
    };
    if (existing) {
      repositories.encryptedSecrets.update(existing.id, payload, this.scopeFor(access));
    } else {
      repositories.encryptedSecrets.create({ id: makeId("mfasec"), ...payload }, this.scopeFor(access));
    }
    return { secret, otpauthUri, digits: TOTP_DIGITS, period: TOTP_STEP_SECONDS, algorithm: "SHA1" };
  }

  /** Confirm enrolment by verifying the first code, then return recovery codes ONCE. */
  enable(access, code) {
    const record = this.recordFor(access);
    if (!record) throw badRequest("Start MFA setup before enabling");
    if (record.metadata?.enabled) throw badRequest("MFA is already enabled");
    const secret = decryptSecret(record);
    if (!verifyTotp(secret, code)) throw unauthorized("Invalid authenticator code");

    const recoveryCodes = generateRecoveryCodes(10);
    repositories.encryptedSecrets.update(
      record.id,
      {
        status: "active",
        metadata: {
          ...(record.metadata || {}),
          enabled: true,
          verifiedAt: now(),
          recoveryCodeHashes: recoveryCodes.map(hashCode)
        }
      },
      this.scopeFor(access)
    );
    return { enabled: true, recoveryCodes };
  }

  /** Disable MFA — requires a valid current code (or recovery code) as proof. */
  disable(access, code) {
    const record = this.recordFor(access);
    if (!record || !record.metadata?.enabled) throw badRequest("MFA is not enabled");
    if (!this.verifyCodeAgainstRecord(record, code)) throw unauthorized("Invalid authenticator code");
    repositories.encryptedSecrets.delete(record.id, this.scopeFor(access));
    return { enabled: false };
  }

  verifyCodeAgainstRecord(record, code) {
    if (!record || !record.metadata?.enabled) return false;
    const secret = decryptSecret(record);
    if (verifyTotp(secret, code)) return true;
    return this.consumeRecoveryCode(record, code);
  }

  consumeRecoveryCode(record, code) {
    const clean = String(code || "").trim().toUpperCase();
    const hashes = record.metadata?.recoveryCodeHashes || [];
    const target = hashCode(clean);
    const index = hashes.findIndex((h) => h.length === target.length && timingSafeEqual(Buffer.from(h), Buffer.from(target)));
    if (index === -1) return false;
    const remaining = hashes.filter((_, i) => i !== index);
    repositories.encryptedSecrets.update(
      record.id,
      { metadata: { ...(record.metadata || {}), recoveryCodeHashes: remaining, lastRecoveryUsedAt: now() } },
      { tenantId: record.tenantId }
    );
    return true;
  }

  /** Used by the login flow: is MFA enabled for this user? */
  isEnabledForUser({ tenantId, userId }) {
    if (!tenantId || !userId) return false;
    const record = repositories.encryptedSecrets
      .list({ limit: 100000 }, { tenantId })
      .find((row) => row.name === SECRET_NAME(userId) && row.purpose === SECRET_PURPOSE);
    return Boolean(record?.metadata?.enabled);
  }

  /** Used by the login flow: verify a code for a user (TOTP or recovery code). */
  verifyForUser({ tenantId, userId }, code) {
    const record = repositories.encryptedSecrets
      .list({ limit: 100000 }, { tenantId })
      .find((row) => row.name === SECRET_NAME(userId) && row.purpose === SECRET_PURPOSE);
    if (!record) throw forbidden("MFA is not configured");
    return this.verifyCodeAgainstRecord(record, code);
  }
}

export const mfaService = new MfaService();
