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

/** localStorage keys for runtime URL overrides (editable in Settings > Advanced) */
export const LOGIN_BASE_URL_KEY = 'sliderule_login_base_url'
export const PROVISIONER_BASE_URL_KEY = 'sliderule_provisioner_base_url'

/** Hostnames allowed for URL overrides (ALLOWED_DOMAINS + localhost) */
const ALLOWED_OVERRIDE_HOSTS = [...ALLOWED_DOMAINS, 'localhost', '127.0.0.1']

/**
 * Validate a service URL against the allowlist.
 * Returns null if valid, or an error message if not.
 */
export function validateServiceUrl(url: string): string | null {
  try {
    const parsed = new URL(url)
    const hostname = parsed.hostname
    const isAllowed = ALLOWED_OVERRIDE_HOSTS.some(
      (allowed) => hostname === allowed || hostname.endsWith('.' + allowed)
    )
    if (!isAllowed) {
      return `Host "${hostname}" not allowed. Must be: ${ALLOWED_OVERRIDE_HOSTS.join(', ')}`
    }
    return null
  } catch {
    return 'Invalid URL'
  }
}

/**
 * Get the login/auth server base URL.
 * Priority: validated localStorage override > VITE_LOGIN_BASE_URL env var > derived from domain.
 */
export function getLoginBaseUrl(): string {
  const runtimeOverride = localStorage.getItem(LOGIN_BASE_URL_KEY)
  if (runtimeOverride && !validateServiceUrl(runtimeOverride)) return runtimeOverride
  const envOverride = import.meta.env.VITE_LOGIN_BASE_URL
  if (envOverride) return envOverride
  return `https://login.${getBaseDomain()}`
}

/**
 * Get the provisioner base URL.
 * Priority: validated localStorage override > derived from domain.
 */
export function getProvisionerBaseUrl(): string {
  const runtimeOverride = localStorage.getItem(PROVISIONER_BASE_URL_KEY)
  if (runtimeOverride && !validateServiceUrl(runtimeOverride)) return runtimeOverride
  return `https://provisioner.${getBaseDomain()}`
}
