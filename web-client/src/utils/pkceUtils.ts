/**
 * PKCE (Proof Key for Code Exchange) utilities for OAuth 2.1
 * Uses the Web Crypto API for cryptographic operations.
 */

function base64UrlEncode(bytes: Uint8Array): string {
  const binString = Array.from(bytes, (b) => String.fromCharCode(b)).join('')
  return btoa(binString).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Generate a cryptographically random code_verifier (43-128 chars).
 */
export function generateCodeVerifier(): string {
  const array = new Uint8Array(32) // 32 bytes → 43 base64url chars
  crypto.getRandomValues(array)
  return base64UrlEncode(array)
}

/**
 * Compute code_challenge = BASE64URL(SHA-256(code_verifier))
 */
export async function generateCodeChallenge(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return base64UrlEncode(new Uint8Array(digest))
}
