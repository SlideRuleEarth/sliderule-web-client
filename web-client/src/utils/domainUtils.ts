/**
 * Shared domain detection utilities for SlideRule services.
 * Derives the base domain from the browser hostname, validated against an allowlist.
 *
 * For local OAuth2.1 testing (e.g. Keycloak), set VITE_LOGIN_BASE_URL in .env.local:
 *   VITE_LOGIN_BASE_URL=http://localhost:8080/realms/sliderule
 */

const ALLOWED_DOMAINS = ['slideruleearth.io', 'testsliderule.org']
const DEFAULT_DOMAIN = 'slideruleearth.io'

/**
 * Derive the base domain from the current browser hostname, validated
 * against an allowlist to prevent auth against untrusted servers.
 * e.g. "client.testsliderule.org" → "testsliderule.org"
 *      "client.slideruleearth.io" → "slideruleearth.io"
 *      "localhost" or unknown      → "slideruleearth.io" (fallback)
 */
export function getBaseDomain(): string {
  const hostname = window.location.hostname
  for (const allowed of ALLOWED_DOMAINS) {
    if (hostname === allowed || hostname.endsWith('.' + allowed)) {
      return allowed
    }
  }
  return DEFAULT_DOMAIN
}

/**
 * Get the login/auth server base URL.
 * Overridable via VITE_LOGIN_BASE_URL for local testing (e.g. Keycloak).
 */
export function getLoginBaseUrl(): string {
  const override = import.meta.env.VITE_LOGIN_BASE_URL
  if (override) return override
  return `https://login.${getBaseDomain()}`
}

export function getProvisionerBaseUrl(): string {
  return `https://provisioner.${getBaseDomain()}`
}
