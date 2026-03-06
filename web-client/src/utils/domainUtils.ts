/**
 * Shared domain detection utilities for SlideRule services.
 * Derives the base domain from the browser hostname, validated against an allowlist.
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

export function getLoginBaseUrl(): string {
  return `https://login.${getBaseDomain()}`
}

export function getProvisionerBaseUrl(): string {
  return `https://provisioner.${getBaseDomain()}`
}
