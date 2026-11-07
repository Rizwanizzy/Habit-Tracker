/**
 * RFC 8291 message encryption for Web Push (aes128gcm content encoding),
 * Web Crypto only. We are the "application server":
 * - ephemeral ECDH P-256 key generated per message
 * - HKDF(SHA-256) with the user-agent's p256dh + auth
 * - AES-128-GCM body: [salt 16][rs 4][idlen 1][as public 65][ciphertext]
 *
 * Byte-for-byte validated against the RFC 8291 Appendix B test vector —
 * see encrypt.test.ts. Details that MUST NOT drift from the RFC:
 * §3.3  key_info  = "WebPush: info" || 0x00 || ua_public || as_public
 * §3.4  cek_info  = "Content-Encoding: aes128gcm" || 0x00
 * §3.4  nonce_info = "Content-Encoding: nonce" || 0x00   (lowercase!)
 * §3.4  nonce is NOT XORed with the record seq (single record → seq 0)
 * §4    single record, padding delimiter 0x02, rs > plaintext + 1 + 16
 * RFC 8188 §2  the AEAD additional data is a ZERO-LENGTH octet sequence
 *              (NOT the record header — the header travels in the body
 *              itself so the receiver can reconstruct keyid/rs)
 */

import { b64urlDecode, b64urlEncode } from './vapid'

export interface PushKeys {
  /** User-agent public key (base64url, as stored in push_subscriptions.p256dh). */
  p256dh: string
  /** User-agent auth secret (base64url, as stored in push_subscriptions.auth). */
  auth: string
}

/** Deterministic overrides — used by the RFC 8291 Appendix B test vector. */
export interface EncryptOptions {
  /** 16-byte salt (normally random). */
  salt?: Uint8Array
  /** ECDH key pair of the "application server" (normally generated). */
  asKeys?: CryptoKeyPair
}

function concat(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((n, a) => n + a.length, 0)
  const out = new Uint8Array(total)
  let at = 0
  for (const a of arrs) {
    out.set(a, at)
    at += a.length
  }
  return out
}

async function hkdf(salt: Uint8Array, ikm: Uint8Array, info: Uint8Array, lengthBytes: number): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info },
    key,
    lengthBytes * 8,
  )
  return new Uint8Array(bits)
}

/** RFC 8291 §3.3 — IKM = HKDF(auth_secret, ECDH secret, key_info, 32).
 *  Exported for the Appendix B intermediate-value assertions. */
export async function deriveWebPushIkm(
  uaAuth: Uint8Array,
  shared: Uint8Array,
  uaPublic: Uint8Array,
  asPublic: Uint8Array,
): Promise<Uint8Array> {
  const enc = new TextEncoder()
  // ORDER MATTERS: user-agent public key BEFORE application-server public key.
  const keyInfo = concat(enc.encode('WebPush: info'), new Uint8Array([0x00]), uaPublic, asPublic)
  return hkdf(uaAuth, shared, keyInfo, 32)
}

/** RFC 8188 §2 — CEK (16) and NONCE (12) from the RFC 8291 IKM + header salt.
 *  Exported for the Appendix B intermediate-value assertions. */
export async function deriveContentKeys(
  salt: Uint8Array,
  ikm: Uint8Array,
): Promise<{ cek: Uint8Array; nonce: Uint8Array }> {
  const enc = new TextEncoder()
  const cek = await hkdf(salt, ikm, concat(enc.encode('Content-Encoding: aes128gcm'), new Uint8Array([0x00])), 16)
  const nonce = await hkdf(salt, ikm, concat(enc.encode('Content-Encoding: nonce'), new Uint8Array([0x00])), 12)
  return { cek, nonce }
}

/** RFC 8291 §3.1/§3.4 — ECDH shared secret (AS private x UA public). */
async function ecdhSharedSecret(asPrivateKey: CryptoKey, uaPublicRaw: Uint8Array): Promise<Uint8Array> {
  const uaJwk = {
    kty: 'EC',
    crv: 'P-256',
    x: b64urlEncode(uaPublicRaw.slice(1, 33)),
    y: b64urlEncode(uaPublicRaw.slice(33, 65)),
    ext: true,
  }
  const uaKey = await crypto.subtle.importKey('jwk', uaJwk, { name: 'ECDH', namedCurve: 'P-256' }, false, [])
  return new Uint8Array(
    await crypto.subtle.deriveBits(
      { name: 'ECDH', public: uaKey } as unknown as Parameters<typeof crypto.subtle.deriveBits>[0],
      asPrivateKey,
      256,
    ),
  )
}

/** RFC 8291 §4 — encrypt one record; returns the full aes128gcm body. */
export async function encryptPushPayload(
  payload: string,
  keys: PushKeys,
  opts: EncryptOptions = {},
): Promise<Uint8Array> {
  const uaPublic = b64urlDecode(keys.p256dh)
  if (uaPublic.length !== 65 || uaPublic[0] !== 0x04) {
    throw new Error('p256dh must be a 65-byte uncompressed P-256 point (base64url)')
  }
  const uaAuth = b64urlDecode(keys.auth)
  if (uaAuth.length < 16) {
    throw new Error('auth secret must be at least 16 bytes (base64url)')
  }

  // 1. Ephemeral application-server key pair + ECDH shared secret.
  const asKey =
    opts.asKeys ?? ((await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'])) as CryptoKeyPair)
  const asPublicRaw = await rawPublicFromKey(asKey.publicKey)
  const shared = await ecdhSharedSecret(asKey.privateKey, uaPublic)

  // 2. IKM = HKDF(auth, shared, "WebPush: info" 0x00 ua-public as-public, 32).
  const ikm = await deriveWebPushIkm(uaAuth, shared, uaPublic, asPublicRaw)

  // 3. Random 16-byte salt; CEK (16) and NONCE (12) via RFC 8188 HKDF.
  const salt = opts.salt ?? crypto.getRandomValues(new Uint8Array(16))
  const { cek, nonce } = await deriveContentKeys(salt, ikm)

  // 4. Single record: plaintext || padding delimiter 0x02; rs = 4096.
  const recordSize = 4096
  if (payload.length + 1 > recordSize - 17) throw new Error('payload too large for one aes128gcm record')
  const plaintext = concat(new TextEncoder().encode(payload), new Uint8Array([0x02]))

  // 5. aes128gcm header: salt || rs(4, big-endian) || idlen(1) || as-public.
  const header = new Uint8Array(16 + 4 + 1 + 65)
  header.set(salt, 0)
  new DataView(header.buffer).setUint32(16, recordSize)
  header[20] = 65
  header.set(asPublicRaw, 21)

  // 6. AES-128-GCM (RFC 8188 §2): the additional data is a ZERO-LENGTH
  //    sequence — the record header is carried in the body, not as AD.
  const cekKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce, additionalData: new Uint8Array(0), tagLength: 128 },
      cekKey,
      plaintext,
    ),
  )
  return concat(header, ciphertext)
}

/** Uncompressed-point raw bytes (65) of an exported EC public key. */
async function rawPublicFromKey(publicKey: CryptoKey): Promise<Uint8Array> {
  const jwk = (await crypto.subtle.exportKey('jwk', publicKey)) as JsonWebKey
  if (!jwk.x || !jwk.y) throw new Error('could not export ephemeral ECDH public key')
  return concat(
    new Uint8Array([0x04]),
    b64urlDecode(jwk.x),
    b64urlDecode(jwk.y),
  )
}

export { b64urlDecode, b64urlEncode }
