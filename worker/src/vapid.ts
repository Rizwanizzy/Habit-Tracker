/**
 * VAPID (RFC 8292) helpers for the Web Push sender, Web Crypto only
 * (native in Cloudflare Workers — zero external dependencies).
 *
 * `npx web-push generate-vapid-keys` outputs RAW base64url strings:
 * private = 32-byte scalar d, public = 65-byte uncompressed point 04||X||Y.
 */

export interface VapidKeys {
  /** 65-byte raw public key, base64url (same value the frontend used to subscribe). */
  public: string
  /** 32-byte raw private key, base64url. SECRET — env/secret only, never logs. */
  private: string
}

export function b64urlEncode(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

export function b64urlDecode(s: string): Uint8Array {
  const pad = '='.repeat((4 - (s.length % 4)) % 4)
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/') + pad)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function assertRawPublic(raw: Uint8Array): void {
  if (raw.length !== 65 || raw[0] !== 0x04) {
    throw new Error('VAPID public key must be the 65-byte uncompressed P-256 point (base64url), as returned by npx web-push generate-vapid-keys')
  }
}

/** P-256 JWK built from the raw 65-byte public point (x/y slices + private scalar). */
export function ecdhPublicJwk(rawB64: string): JsonWebKey & { x: string; y: string } {
  const raw = b64urlDecode(rawB64)
  assertRawPublic(raw)
  return {
    kty: 'EC',
    crv: 'P-256',
    x: b64urlEncode(raw.slice(1, 33)),
    y: b64urlEncode(raw.slice(33, 65)),
    ext: true,
  }
}

/**
 * Build the `Authorization: vapid t=<jwt>, k=<key>` header:
 * an ES256 JWT with { aud: <origin>, exp: +12 h, sub: mailto/<subject> }.
 */
export async function vapidAuthorization(
  keys: VapidKeys,
  audienceOrigin: string,
  subject: string,
): Promise<string> {
  const enc = new TextEncoder()
  const header = b64urlEncode(enc.encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' })))
  const claims = b64urlEncode(
    enc.encode(
      JSON.stringify({ aud: audienceOrigin, exp: Math.floor(Date.now() / 1000) + 60 * 60 * 12, sub: subject }),
    ),
  )
  const privJwk = { ...ecdhPublicJwk(keys.public), d: keys.private }
  const key = await crypto.subtle.importKey(
    'jwk',
    privJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  )
  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    key,
    enc.encode(`${header}.${claims}`),
  )
  const jwt = `${header}.${claims}.${b64urlEncode(new Uint8Array(sig))}`
  return `vapid t=${jwt}, k=${keys.public}`
}
