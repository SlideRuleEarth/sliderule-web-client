/**
 * OAuth 2.1 Authorization Server Discovery (RFC 8414).
 * Fetches and caches AS metadata from /.well-known/oauth-authorization-server.
 */

import { getLoginBaseUrl } from '@/utils/domainUtils'
import { createLogger } from '@/utils/logger'

const logger = createLogger('OAuthDiscovery')

export interface ASMetadata {
  issuer: string
  authorization_endpoint: string
  token_endpoint: string
  registration_endpoint?: string
  jwks_uri: string
  scopes_supported: string[]
  response_types_supported: string[]
  token_endpoint_auth_methods_supported: string[]
  code_challenge_methods_supported: string[]
  grant_types_supported: string[]
}

let cachedMetadata: ASMetadata | null = null
let fetchPromise: Promise<ASMetadata> | null = null

/**
 * Fetch AS metadata from the well-known endpoint.
 * Caches the result for the lifetime of the page.
 * Concurrent calls share the same in-flight request.
 */
export async function getASMetadata(): Promise<ASMetadata> {
  if (cachedMetadata) return cachedMetadata

  // Deduplicate concurrent fetches
  if (fetchPromise) return await fetchPromise

  fetchPromise = (async () => {
    const baseUrl = getLoginBaseUrl()

    // Try RFC 8414 first, then fall back to OIDC Discovery (used by Keycloak and others)
    const wellKnownPaths = [
      '/.well-known/oauth-authorization-server',
      '/.well-known/openid-configuration'
    ]

    let metadata: ASMetadata | null = null
    for (const path of wellKnownPaths) {
      const url = `${baseUrl}${path}`
      logger.debug('Trying AS metadata endpoint', { url })

      const response = await fetch(url)
      if (response.ok) {
        metadata = await response.json()
        logger.info('AS metadata discovered', {
          url,
          issuer: metadata!.issuer,
          authorization_endpoint: metadata!.authorization_endpoint,
          registration_endpoint: metadata!.registration_endpoint,
          token_endpoint: metadata!.token_endpoint
        })
        break
      }
      logger.debug('AS metadata endpoint not available', { url, status: response.status })
    }

    if (!metadata) {
      throw new Error(`AS discovery failed: no well-known endpoint responded at ${baseUrl}`)
    }

    cachedMetadata = metadata
    return metadata
  })().finally(() => {
    fetchPromise = null
  })

  return fetchPromise
}

/**
 * Clear cached metadata (e.g., on logout or domain change).
 */
export function clearASMetadataCache(): void {
  cachedMetadata = null
  fetchPromise = null
}
