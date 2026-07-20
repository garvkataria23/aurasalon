/**
 * Minimal CBOR decoder + COSE-key helper for WebAuthn (ADD-ONLY).
 *
 * Only the subset needed to parse an attestationObject and a COSE EC2 (P-256,
 * ES256) / RSA public key is implemented — no third-party dependency. Returns
 * a Node KeyObject-compatible JWK for crypto.verify().
 */

export function decodeCbor(buffer) {
  let offset = 0;
  const buf = Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);

  function read() {
    const initial = buf[offset++];
    const major = initial >> 5;
    const info = initial & 0x1f;
    const len = readLength(info);
    switch (major) {
      case 0: return len; // unsigned int
      case 1: return -1 - len; // negative int
      case 2: { const b = buf.subarray(offset, offset + len); offset += len; return b; } // bytes
      case 3: { const s = buf.toString("utf8", offset, offset + len); offset += len; return s; } // text
      case 4: { const arr = []; for (let i = 0; i < len; i++) arr.push(read()); return arr; }
      case 5: { const map = new Map(); for (let i = 0; i < len; i++) { const k = read(); map.set(k, read()); } return map; }
      case 7: return len === 20 ? false : len === 21 ? true : len === 22 ? null : len;
      default: throw new Error(`Unsupported CBOR major type ${major}`);
    }
  }

  function readLength(info) {
    if (info < 24) return info;
    if (info === 24) return buf[offset++];
    if (info === 25) { const v = buf.readUInt16BE(offset); offset += 2; return v; }
    if (info === 26) { const v = buf.readUInt32BE(offset); offset += 4; return v; }
    if (info === 27) { const v = Number(buf.readBigUInt64BE(offset)); offset += 8; return v; }
    throw new Error(`Unsupported CBOR length info ${info}`);
  }

  const value = read();
  return { value, bytesRead: offset };
}

/** Convert a COSE key (Map) to a JWK usable by Node crypto. */
export function coseToJwk(coseKey) {
  const kty = coseKey.get(1); // 1=key type: 2=EC2, 3=RSA
  const alg = coseKey.get(3); // -7=ES256, -257=RS256
  if (kty === 2) {
    const x = coseKey.get(-2);
    const y = coseKey.get(-3);
    return {
      jwk: { kty: "EC", crv: "P-256", x: Buffer.from(x).toString("base64url"), y: Buffer.from(y).toString("base64url") },
      alg: alg === -7 ? "ES256" : "ES256"
    };
  }
  if (kty === 3) {
    const n = coseKey.get(-1);
    const e = coseKey.get(-2);
    return {
      jwk: { kty: "RSA", n: Buffer.from(n).toString("base64url"), e: Buffer.from(e).toString("base64url") },
      alg: "RS256"
    };
  }
  throw new Error(`Unsupported COSE key type ${kty}`);
}

/**
 * Parse authenticatorData: rpIdHash(32) | flags(1) | signCount(4) | [attestedCredData].
 * Returns { rpIdHash, flags, signCount, credentialId, credentialPublicKey(coseMap) }.
 */
export function parseAuthData(authData) {
  const buf = Buffer.isBuffer(authData) ? authData : Buffer.from(authData);
  const rpIdHash = buf.subarray(0, 32);
  const flags = buf[32];
  const signCount = buf.readUInt32BE(33);
  const result = { rpIdHash, flags, signCount, userPresent: !!(flags & 0x01), userVerified: !!(flags & 0x04) };
  if (flags & 0x40) {
    // attested credential data present
    let p = 37;
    p += 16; // aaguid
    const credIdLen = buf.readUInt16BE(p); p += 2;
    result.credentialId = buf.subarray(p, p + credIdLen); p += credIdLen;
    const { value } = decodeCbor(buf.subarray(p));
    result.credentialPublicKey = value;
  }
  return result;
}
