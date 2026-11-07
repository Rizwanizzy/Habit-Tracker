/**
 * Byte-for-byte validation against RFC 8291 Appendix B (the "When I grow up,
 * I want to be a watermelon" example). Any deviation from the RFC here means
 * user agents will silently discard our pushes (decryption failure → no
 * banner), so this test is the correctness gate for Pass 3.
 */
import { describe, expect, it } from 'vitest'
import {
  b64urlDecode,
  b64urlEncode,
  deriveContentKeys,
  deriveWebPushIkm,
  encryptPushPayload,
} from './encrypt'
import { ecdhPublicJwk } from './vapid'

// RFC 8291 §5 + Appendix A — exact values from the published RFC.
const RFC = {
  plaintext: 'When I grow up, I want to be a watermelon',

  /** "Receiver" in the RFC = user agent. */
  ua_public:
    'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  ua_private: 'q1dXpw3UpT5VOmu_cf_v6ih07Aems3njxI-JWgLcM94',

  /** "Sender" in the RFC = application server. */
  as_public:
    'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  as_private: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw',

  auth_secret: 'BTBZMqHH6r4Tts7J_aSIgg',
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',

  // Appendix A intermediate values (base64url).
  ecdh_secret: 'kyrL1jIIOHEzg3sM2ZWRHDRB62YACZhhSlknJ672kSs',
  ikm: 'S4lYMb_L0FxCeq0WhDx813KgSYqU26kOyzWUdsXYyrg',
  prk: '09_eUZGrsvxChDCGRCdkLiDXrReGOEVeSCdCcPBSJSc',
  cek: 'oIhVW04MRdy2XN9CiKLxTg',
  nonce: '4h_95klXJ5E_qnoN',

  /** §5 — the complete aes128gcm message body (three RFC lines rejoined). */
  body:
    'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27ml' +
    'mlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPT' +
    'pK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN',
}

async function importPrivJwk(privateB64: string, publicB64: string): Promise<CryptoKey> {
  const jwk = { ...ecdhPublicJwk(publicB64), d: privateB64 }
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDH', namedCurve: 'P-256' }, true, [
    'deriveBits',
  ])
}

describe('RFC 8291 Appendix B test vector', () => {
  it('derives the published ECDH shared secret', async () => {
    const asPriv = await importPrivJwk(RFC.as_private, RFC.as_public)
    const uaPublic = b64urlDecode(RFC.ua_public)
    const shared = b64urlEncode(
      new Uint8Array(
        await crypto.subtle.deriveBits(
          {
            name: 'ECDH',
            public: await crypto.subtle.importKey(
              'jwk',
              ecdhPublicJwk(RFC.ua_public),
              { name: 'ECDH', namedCurve: 'P-256' },
              false,
              [],
            ),
          },
          asPriv,
          256,
        ),
      ),
    )
    expect(shared).toBe(RFC.ecdh_secret)
  })

  it('derives the published IKM ("WebPush: info" step)', async () => {
    const asPriv = await importPrivJwk(RFC.as_private, RFC.as_public)
    const shared = await crypto.subtle.deriveBits(
      {
        name: 'ECDH',
        public: await crypto.subtle.importKey(
          'jwk',
          ecdhPublicJwk(RFC.ua_public),
          { name: 'ECDH', namedCurve: 'P-256' },
          false,
          [],
        ),
      },
      asPriv,
      256,
    )
    const ikm = await deriveWebPushIkm(
      b64urlDecode(RFC.auth_secret),
      new Uint8Array(shared),
      b64urlDecode(RFC.ua_public),
      b64urlDecode(RFC.as_public),
    )
    expect(b64urlEncode(ikm)).toBe(RFC.ikm)
  })

  it('derives the published CEK and NONCE', async () => {
    const { cek, nonce } = await deriveContentKeys(b64urlDecode(RFC.salt), b64urlDecode(RFC.ikm))
    expect(b64urlEncode(cek)).toBe(RFC.cek)
    expect(b64urlEncode(nonce)).toBe(RFC.nonce)
  })

  it('produces the published aes128gcm body byte-for-byte', async () => {
    const asKeys: CryptoKeyPair = {
      privateKey: await importPrivJwk(RFC.as_private, RFC.as_public),
      publicKey: await crypto.subtle.importKey(
        'jwk',
        ecdhPublicJwk(RFC.as_public),
        { name: 'ECDH', namedCurve: 'P-256' },
        true,
        [],
      ),
    }
    const body = await encryptPushPayload(
      RFC.plaintext,
      { p256dh: RFC.ua_public, auth: RFC.auth_secret },
      { salt: b64urlDecode(RFC.salt), asKeys },
    )
    // Compare only the ciphertext part: the header should equal the RFC's
    // published header bytes; then check the whole body too.
    const expected = b64urlDecode(RFC.body)
    const publishedCipher = b64urlDecode(
      '8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ',
    )
    // Header = 16 salt + 4 rs + 1 idlen + 65 key.
    const headerLength = body.length - publishedCipher.length
    expect(headerLength).toBe(86)
    expect(Array.from(body.slice(headerLength))).toEqual(Array.from(publishedCipher))
    expect(b64urlEncode(body)).toBe(RFC.body)
    expect(Array.from(body)).toEqual(Array.from(expected))
  })

  it('records the RFC salt decoding sanity (16 bytes)', () => {
    expect(b64urlDecode(RFC.salt).length).toBe(16)
    expect(b64urlDecode(RFC.auth_secret).length).toBe(16)
    expect(b64urlDecode(RFC.ua_public).length).toBe(65)
    expect(b64urlDecode(RFC.as_public).length).toBe(65)
  })
})
