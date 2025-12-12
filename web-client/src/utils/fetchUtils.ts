import { db } from '@/db/SlideRuleDb'
import { useSysConfigStore } from '@/stores/sysConfigStore'
import { useLegacyJwtStore } from '@/stores/SrLegacyJwtStore'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'
import { Buffer } from 'buffer/'
import { createLogger } from '@/utils/logger'

const logger = createLogger('FetchUtils')

export interface ServerVersionResult {
  success: boolean
  version: string
  data: any
}

export interface CurrentNodesResult {
  success: boolean
  nodes: number
}

/**
 * Fetch server version info from the SlideRule API.
 * Returns version data that can be used by any store.
 */
export async function fetchServerVersionInfo(
  organization: string,
  domain: string
): Promise<ServerVersionResult> {
  const url = `https://${organization}.${domain}/source/version`
  try {
    const response = await fetch(url)
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`)

    const data = await response.json()
    if (data === null || typeof data?.server.version !== 'string') {
      logger.error('Invalid response format from server version', { data })
      throw new Error('Invalid response format')
    }
    return {
      success: true,
      version: data.server.version,
      data
    }
  } catch (error) {
    logger.error('Error fetching server version', {
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      success: false,
      version: 'Unknown',
      data: null
    }
  }
}

/**
 * Fetch current nodes count from the SlideRule discovery API.
 * Returns node count that can be used by any store.
 */
export async function fetchCurrentNodes(
  organization: string,
  domain: string
): Promise<CurrentNodesResult> {
  const url = `https://${organization}.${domain}/discovery/status`
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: 'sliderule' })
    })

    if (!response.ok) throw new Error(`HTTP error: ${response.status}`)

    const data = await response.json()
    if (typeof data?.nodes === 'number') {
      return {
        success: true,
        nodes: data.nodes
      }
    } else {
      logger.error('Invalid response format from current nodes', { data })
      throw new Error('Invalid response format')
    }
  } catch (error) {
    logger.error('Error fetching current nodes', {
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      success: false,
      nodes: -1
    }
  }
}

/**
 * Authenticated fetch wrapper with automatic 401 retry.
 * Authentication priority:
 * 1. New GitHub OAuth JWT (if available and valid)
 * 2. Legacy JWT (if available)
 * 3. No auth header
 *
 * On 401 with legacy JWT, attempts to refresh the token and retry once.
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
  isRetry = false
): Promise<Response> {
  // Get stores lazily to avoid circular dependency issues
  const sysConfigStore = useSysConfigStore()
  const legacyJwtStore = useLegacyJwtStore()
  const githubAuthStore = useGitHubAuthStore()

  const domain = sysConfigStore.domain
  const org = sysConfigStore.organization

  // Check for new GitHub OAuth JWT first
  const githubToken = githubAuthStore.authToken
  // Fall back to legacy JWT if GitHub token not available
  const legacyJwt = legacyJwtStore.getJwt(domain, org)

  if (githubToken) {
    // Use new GitHub OAuth JWT
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${githubToken}`
    }
    logger.debug('authenticatedFetch using GitHub OAuth JWT', { url, isRetry })
  } else if (legacyJwt) {
    // Fall back to legacy JWT
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${legacyJwt.accessToken}`
    }
    logger.debug('authenticatedFetch using legacy JWT', { url, isRetry })
  } else {
    logger.debug('authenticatedFetch without auth', { url, isRetry })
  }

  const response = await fetch(url, options)

  // Handle 401 Unauthorized - attempt refresh and retry once (only for legacy JWT)
  // GitHub OAuth JWT doesn't support refresh - user must re-authenticate
  if (response.status === 401 && !isRetry && !githubToken && legacyJwt) {
    logger.debug('Received 401 with legacy JWT, attempting token refresh', { url })

    const refreshed = await legacyJwtStore.refreshAccessToken(domain, org)

    if (refreshed) {
      logger.debug('Token refreshed, retrying request', { url })
      // Get the new token and update headers
      const newJwt = legacyJwtStore.getJwt(domain, org)
      if (newJwt) {
        options.headers = {
          ...options.headers,
          Authorization: `Bearer ${newJwt.accessToken}`
        }
      }
      // Retry the request with the new token
      return authenticatedFetch(url, options, true)
    } else {
      logger.error('Token refresh failed, returning 401 response', { url })
    }
  }

  return response
}
export function forceGeoParquet(inputReqParms: any): any {
  //There are different shapes for legacy atl06 and atl03x-surface
  logger.debug('forceGeoParquet', { inputReqParms })

  if (inputReqParms.as_geo !== undefined) {
    inputReqParms.as_geo = true
  } else {
    if (inputReqParms.parms) {
      if (inputReqParms.parms.output) {
        inputReqParms.parms.output.as_geo = true
      } else {
        logger.warn('forceGeoParquet: unrecognized shape for inputReqParms', { inputReqParms })
      }
    } else {
      logger.warn('forceGeoParquet: unrecognized shape for inputReqParms', { inputReqParms })
    }
  }
  logger.debug('forceGeoParquet', { inputReqParms })
  return inputReqParms
}

export async function getArrowFetchUrlAndOptions(
  reqid: number,
  forceAsGeo: boolean = false
): Promise<{ url: string; options: RequestInit }> {
  // Get stores lazily to avoid circular dependency issues
  const sysConfigStore = useSysConfigStore()
  const legacyJwtStore = useLegacyJwtStore()

  let api = await db.getFunc(reqid)
  if (api === 'atl03x-surface' || api === 'atl03x-phoreal') {
    api = 'atl03x'
  }
  let parm = await db.getReqParams(reqid)
  if (forceAsGeo) {
    parm = forceGeoParquet(parm)
  }
  const host =
    (sysConfigStore.organization && sysConfigStore.organization + '.' + sysConfigStore.domain) ||
    sysConfigStore.domain
  const api_path = `arrow/${api}`
  const url = 'https://' + host + '/' + api_path
  //console.log('getArrowFetchUrlAndOptions source url:', url);
  // Setup Request Options
  let body = null
  const options: RequestInit = {
    method: 'POST',
    mode: 'cors'
  }

  if (parm != null) {
    body = JSON.stringify(parm)
    options.headers = {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(body).toString()
      //'x-sliderule-streaming': '0', // TBD is this neccessary?
    }
    options.body = body
  }

  // Add Authorization header - priority: GitHub OAuth JWT > Legacy JWT > None
  const githubAuthStore = useGitHubAuthStore()
  const githubToken = githubAuthStore.authToken

  if (githubToken) {
    // Use new GitHub OAuth JWT
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${githubToken}`
    }
    logger.debug('getArrowFetchUrlAndOptions using GitHub OAuth JWT', { url })
  } else {
    // Fall back to legacy JWT if present
    const srJWT = legacyJwtStore.getJwt(sysConfigStore.domain, sysConfigStore.organization)
    if (srJWT) {
      options.headers = {
        ...options.headers,
        Authorization: `Bearer ${srJWT.accessToken}`
      }
      logger.debug('getArrowFetchUrlAndOptions using legacy JWT', { url })
    } else {
      logger.debug('getArrowFetchUrlAndOptions without auth', { url })
    }
  }

  logger.debug('fetch request', { url, options })
  return { url, options }
}
