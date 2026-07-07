import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { repositoryForTable } from "../repositories/repository-registry.js";
import { badRequest, notFound, unauthorized } from "../utils/app-error.js";

/**
 * Partner API key management (ADD-ONLY) using the existing api_keys table.
 * Keys are shown once at creation; only a SHA-256 hash is stored. Supports
 * scopes, rotation (new secret, same id), revocation, and per-key rate limits.
 */

const repo = repositoryForTable("api_keys");
const now = () => new Date().toISOString();
const makeId = (p) => `${p}_${randomUUID().slice(0, 10)}`;
const hash = (raw) => `scrypt:${scryptSync(String(raw), `aura-api-key:${env.jwtSecret}`, 32).toString("hex")}`;

function generateKey() {
  const prefix = randomBytes(4).toString("hex"); // 8 chars
  const secret = randomBytes(24).toString("base64url");
  return { prefix, secret, full: `aura_${prefix}_${secret}` };
}

const rlWindows = new Map();

export class ApiKeyService {
  scope(access) { return { tenantId: access.tenantId }; }

  list(access) {
    return repo.list({ limit: 1000 }, this.scope(access)).map((k) => ({
      id: k.id, name: k.name, keyPrefix: k.keyPrefix, scopes: k.scopes, rateLimits: k.rateLimits,
      status: k.status, lastUsedAt: k.lastUsedAt, createdAt: k.createdAt
    }));
  }

  create(payload, access) {
    if (!payload.name) throw badRequest("name is required");
    const { prefix, full } = generateKey();
    const record = repo.create({
      id: makeId("apikey"), name: payload.name, keyPrefix: prefix, keyHash: hash(full),
      scopes: payload.scopes || ["bookings:read"], rateLimits: payload.rateLimits || { perMinute: 120 },
      status: "active", lastUsedAt: "", metadata: payload.metadata || {}
    }, this.scope(access));
    return { id: record.id, name: record.name, apiKey: full, scopes: record.scopes, rateLimits: record.rateLimits };
  }

  rotate(id, access) {
    const existing = repo.getById(id, this.scope(access));
    if (!existing) throw notFound("API key not found");
    const { prefix, full } = generateKey();
    repo.update(id, { keyPrefix: prefix, keyHash: hash(full), updatedAt: now() }, this.scope(access));
    return { id, apiKey: full, rotated: true };
  }

  revoke(id, access) {
    const existing = repo.getById(id, this.scope(access));
    if (!existing) throw notFound("API key not found");
    repo.update(id, { status: "revoked", updatedAt: now() }, this.scope(access));
    return { id, status: "revoked" };
  }

  /** Authenticate a raw key. Returns the key record or throws. */
  verify(rawKey) {
    if (!rawKey || !rawKey.startsWith("aura_")) throw unauthorized("Invalid API key");
    const prefix = rawKey.split("_")[1] || "";
    const candidates = repo.list({ limit: 100000 }, {}).filter((k) => k.keyPrefix === prefix && k.status === "active");
    const target = hash(rawKey);
    const match = candidates.find((k) => {
      const a = Buffer.from(String(k.keyHash || ""));
      const b = Buffer.from(target);
      return a.length === b.length && timingSafeEqual(a, b);
    });
    if (!match) throw unauthorized("Invalid or revoked API key");
    this.enforceRateLimit(match);
    repo.update(match.id, { lastUsedAt: now() }, { tenantId: match.tenantId });
    return match;
  }

  enforceRateLimit(key) {
    const perMinute = Number(key.rateLimits?.perMinute || 0);
    if (!perMinute) return;
    const bucketKey = key.id;
    const t = Date.now();
    const bucket = rlWindows.get(bucketKey) || { count: 0, resetAt: t + 60000 };
    if (bucket.resetAt <= t) { bucket.count = 0; bucket.resetAt = t + 60000; }
    bucket.count += 1;
    rlWindows.set(bucketKey, bucket);
    if (bucket.count > perMinute) throw unauthorized("API key rate limit exceeded");
  }

  hasScope(key, scope) {
    const scopes = key.scopes || [];
    return scopes.includes("*") || scopes.includes(scope);
  }
}

export const apiKeyService = new ApiKeyService();
