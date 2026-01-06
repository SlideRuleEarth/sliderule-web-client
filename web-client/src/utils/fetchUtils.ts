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
  cluster: string
  data: any
}

export interface CurrentNodesResult {
  success: boolean
  nodes: number
}

/**
 * CloudFormation stack status values.
 * Used to determine if a cluster can be selected for deployment.
 */
export type StackStatus =
  | 'NOT_FOUND' // Stack doesn't exist - can deploy
  | 'CREATE_IN_PROGRESS' // Starting - disable
  | 'CREATE_COMPLETE' // Up - disable
  | 'UPDATE_IN_PROGRESS' // Updating - disable
  | 'DELETE_IN_PROGRESS' // Deleting - disable
  | 'DELETE_COMPLETE' // Deleted - can deploy
  | 'FAILED' // Failed state - can deploy (retry)
  | 'UNKNOWN' // Error fetching - allow with warning

export interface StackStatusResult {
  success: boolean
  status: StackStatus
}

/**
 * Cluster status response from the provisioner API.
 */
export interface ClusterStatusResponse {
  status: boolean
  stack_name?: string
  response?: {
    StackId?: string
    StackName?: string
    StackStatus?: string
    CreationTime?: string
    Parameters?: Array<{ ParameterKey: string; ParameterValue: string }>
    [key: string]: unknown
  }
  auto_shutdown?: string | null
  current_nodes?: number
  version?: string
  is_public?: string
  node_capacity?: string
}

export interface ClusterStatusResult {
  success: boolean
  data: ClusterStatusResponse | null
  error?: string
}

/**
 * Deploy cluster response from the provisioner API.
 */
export interface DeployClusterResponse {
  status: boolean
  stack_name?: string
  response?: Record<string, unknown>
}

export interface DeployClusterResult {
  success: boolean
  data: DeployClusterResponse | null
  error?: string
}

export interface DeployClusterOptions {
  cluster: string
  is_public: boolean
  node_capacity: number
  ttl: number
  version?: string
  region?: string
}

/**
 * Fetch server version info from the SlideRule API.
 * Returns version data that can be used by any store.
 */
export async function fetchServerVersionInfo(
  cluster: string,
  domain: string
): Promise<ServerVersionResult> {
  const url = `https://${cluster}.${domain}/source/version`
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
      cluster: data.server.cluster,
      data
    }
  } catch (error) {
    logger.info('Error fetching server version', {
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      success: false,
      version: 'Unknown',
      cluster: 'Unknown',
      data: null
    }
  }
}

/**
 * Fetch current nodes count from the SlideRule discovery API.
 * Returns node count that can be used by any store.
 */
export async function fetchCurrentNodes(
  cluster: string,
  domain: string
): Promise<CurrentNodesResult> {
  const url = `https://${cluster}.${domain}/discovery/status`
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
    logger.info('Error fetching current nodes', {
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      success: false,
      nodes: -1
    }
  }
}

/**
 * Fetch CloudFormation stack status for a cluster.
 * Used to determine if a cluster can be selected for deployment.
 *
 * TODO: Wire to actual endpoint when available.
 * Expected endpoint: GET https://deploy.{domain}/stack/{cluster}/status
 *
 * @param cluster - The cluster name
 * @param domain - The domain (e.g., 'slideruleearth.io')
 * @returns Stack status result
 */
export async function fetchStackStatus(
  cluster: string,
  domain: string
): Promise<StackStatusResult> {
  // TODO: Wire to actual endpoint when available
  // Expected: GET https://deploy.{domain}/stack/{cluster}/status
  //
  // const url = `https://deploy.${domain}/stack/${cluster}/status`
  // try {
  //   const response = await fetch(url)
  //   if (!response.ok) throw new Error(`HTTP error: ${response.status}`)
  //   const data = await response.json()
  //   return { success: true, status: data.status }
  // } catch (error) {
  //   logger.info('Error fetching stack status', { cluster, domain, error })
  //   return { success: false, status: 'UNKNOWN' }
  // }

  // For now, return UNKNOWN to allow all selections until the endpoint is available
  logger.debug('fetchStackStatus placeholder called', { cluster, domain })
  return await Promise.resolve({ success: false, status: 'UNKNOWN' })
}

/**
 * Fetch cluster status from the provisioner API.
 * Returns comprehensive status including CloudFormation state, nodes, version, etc.
 * Requires GitHub OAuth authentication.
 *
 * @param cluster - The cluster name
 * @returns Cluster status result with full response data
 */
export async function fetchClusterStatus(cluster: string): Promise<ClusterStatusResult> {
  const url = 'https://provisioner.slideruleearth.io/status'

  // Get GitHub auth token - provisioner only accepts GitHub JWT
  const githubAuthStore = useGitHubAuthStore()
  const githubToken = githubAuthStore.authToken

  if (!githubToken) {
    logger.info('No GitHub token available for provisioner API', { cluster })
    return {
      success: false,
      data: null,
      error: 'GitHub authentication required'
    }
  }

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${githubToken}`
      },
      body: JSON.stringify({ cluster })
    })

    if (!response.ok) {
      logger.error('Non-OK HTTP response fetching cluster status', {
        cluster,
        status: response.status
      })
      throw new Error(`HTTP error: ${response.status}`)
    }

    const data: ClusterStatusResponse = await response.json()
    return {
      success: true,
      data
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.info('Error fetching cluster status', { cluster, error: errorMessage })
    return {
      success: false,
      data: null,
      error: errorMessage
    }
  }
}

/**
 * Deploy a cluster via the provisioner API.
 * Requires GitHub OAuth authentication.
 * Includes a single retry with backoff for 401 errors (handles JWKS latency).
 *
 * @param options - Deploy options including cluster name, nodes, ttl, and is_public
 * @returns Deploy result with response data
 */
export async function deployCluster(options: DeployClusterOptions): Promise<DeployClusterResult> {
  const url = 'https://provisioner.slideruleearth.io/deploy'
  const RETRY_DELAY_MS = 1000

  // Get GitHub auth token - provisioner only accepts GitHub JWT
  const githubAuthStore = useGitHubAuthStore()
  const githubToken = githubAuthStore.authToken

  if (!githubToken) {
    logger.info('No GitHub token available for provisioner API', { cluster: options.cluster })
    return {
      success: false,
      data: null,
      error: 'GitHub authentication required'
    }
  }

  const makeRequest = async (): Promise<Response> => {
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${githubToken}`
      },
      body: JSON.stringify({
        cluster: options.cluster,
        is_public: options.is_public,
        node_capacity: options.node_capacity,
        ttl: options.ttl,
        ...(options.version && { version: options.version }),
        ...(options.region && { region: options.region })
      })
    })
  }

  try {
    let response = await makeRequest()

    // Retry once on 401 with backoff (handles JWKS latency issue)
    if (response.status === 401) {
      logger.info('Got 401, retrying after backoff', { cluster: options.cluster })
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
      response = await makeRequest()
    }

    if (!response.ok) {
      logger.error('Non-OK HTTP response deploying cluster', {
        cluster: options.cluster,
        status: response.status
      })
      throw new Error(`HTTP error: ${response.status}`)
    }

    const data: DeployClusterResponse = await response.json()
    return {
      success: true,
      data
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.info('Error deploying cluster', { cluster: options.cluster, error: errorMessage })
    return {
      success: false,
      data: null,
      error: errorMessage
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
  const org = sysConfigStore.subdomain

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
    (sysConfigStore.subdomain && sysConfigStore.subdomain + '.' + sysConfigStore.domain) ||
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
    const srJWT = legacyJwtStore.getJwt(sysConfigStore.domain, sysConfigStore.subdomain)
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
