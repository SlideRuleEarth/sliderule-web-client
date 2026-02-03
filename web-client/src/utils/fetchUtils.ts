import { db } from '@/db/SlideRuleDb'
import { useSysConfigStore } from '@/stores/sysConfigStore'
import { useGitHubAuthStore } from '@/stores/githubAuthStore'
import { useSrToastStore } from '@/stores/srToastStore'
import { Buffer } from 'buffer/'
import { createLogger } from '@/utils/logger'

const logger = createLogger('FetchUtils')

// Retry configuration for 401 errors (handles JWKS latency)
const RETRY_DELAY_MS = 1000
const MAX_401_RETRIES = 2

/**
 * Options for provisioner API fetch requests.
 */
interface ProvisionerFetchOptions {
  url: string
  body: Record<string, unknown>
  context: string // For logging (e.g., 'fetching cluster status', 'deploying cluster')
}

/**
 * Result from provisionerFetch utility.
 */
interface ProvisionerFetchResult<T> {
  success: boolean
  data: T | null
  error?: string
  errorDetails?: string // Raw error for tooltips
}

/**
 * Make an authenticated request to the provisioner API.
 * Handles GitHub OAuth authentication and 401 retry with backoff.
 *
 * @param options - Fetch options including URL, body, and context for logging
 * @returns Result with parsed JSON data or error
 */
async function provisionerFetch<T>(
  options: ProvisionerFetchOptions
): Promise<ProvisionerFetchResult<T>> {
  const { url, body, context } = options

  // Get GitHub auth token - provisioner only accepts GitHub JWT
  const githubAuthStore = useGitHubAuthStore()
  const githubToken = githubAuthStore.authToken

  if (!githubToken) {
    logger.debug(`No GitHub token available for ${context}`, body)
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
      body: JSON.stringify(body)
    })
  }

  try {
    let response = await makeRequest()

    // Retry on 401 with backoff (handles JWKS latency issue)
    let retryCount = 0
    while (response.status === 401 && retryCount < MAX_401_RETRIES) {
      retryCount++
      logger.debug(`Got 401, retry ${retryCount}/${MAX_401_RETRIES} after backoff`, body)
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS))
      response = await makeRequest()
    }

    if (!response.ok) {
      logger.error(`Non-OK HTTP response ${context}`, {
        ...body,
        status: response.status
      })
      throw new Error(`HTTP error: ${response.status}`)
    }

    const data: T = await response.json()
    return {
      success: true,
      data
    }
  } catch (error) {
    const rawError = error instanceof Error ? error.message : String(error)
    logger.debug(`Error ${context}`, { ...body, error: rawError })

    // Provide user-friendly error messages while preserving raw error for tooltips
    let userMessage: string
    const clusterName = body.cluster as string | undefined
    if (rawError.toLowerCase().includes('failed to fetch')) {
      userMessage = 'Unable to connect to server. Please check your network connection.'
      const toastStore = useSrToastStore()
      const toastTitle = clusterName ? `Network Error (${clusterName})` : 'Network Error'
      toastStore.warn(toastTitle, userMessage)
    } else if (rawError.includes('HTTP error: 401')) {
      // Check if token is expired based on local timestamp
      const currentTimestamp = Math.floor(Date.now() / 1000)
      const tokenExpiry = githubAuthStore.tokenExpiresAtTimestamp

      if (tokenExpiry !== null && currentTimestamp >= tokenExpiry) {
        // Token is actually expired - logout and show message
        const toastStore = useSrToastStore()
        toastStore.warn(
          'Session Expired',
          'Your authentication token has expired. Please log in again to continue.'
        )
        userMessage = 'Your session has expired. Please log in again.'
        githubAuthStore.logout()
      } else {
        // Token still valid locally - likely JWKS latency, don't logout
        // Next polling cycle will retry
        userMessage = 'Authentication pending. Retrying...'
        logger.debug('401 with valid local token - likely JWKS latency, not logging out')
      }
    } else if (rawError.includes('HTTP error: 403')) {
      userMessage = 'Access denied. You may not have permission for this operation.'
    } else if (rawError.includes('HTTP error: 404')) {
      userMessage = 'Resource not found.'
    } else if (rawError.includes('HTTP error: 5')) {
      userMessage = 'Server error. Please try again later.'
    } else {
      userMessage = rawError
    }

    return {
      success: false,
      data: null,
      error: userMessage,
      errorDetails: rawError !== userMessage ? rawError : undefined
    }
  }
}

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
  | 'CREATE_IN_PROGRESS'
  | 'CREATE_COMPLETE'
  | 'CREATE_FAILED'
  | 'UPDATE_IN_PROGRESS'
  | 'UPDATE_COMPLETE'
  | 'UPDATE_COMPLETE_CLEANUP_IN_PROGRESS'
  | 'UPDATE_FAILED'
  | 'UPDATE_ROLLBACK_IN_PROGRESS'
  | 'UPDATE_ROLLBACK_COMPLETE'
  | 'UPDATE_ROLLBACK_FAILED'
  | 'DELETE_IN_PROGRESS'
  | 'DELETE_COMPLETE'
  | 'DELETE_FAILED'
  | 'ROLLBACK_IN_PROGRESS'
  | 'ROLLBACK_COMPLETE'
  | 'ROLLBACK_FAILED'
  | 'NOT_FOUND'
  | 'UNKNOWN'
  | 'FAILED'

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
  exception?: string
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
  errorDetails?: string
}

/**
 * Deploy cluster response from the provisioner API.
 */
export interface DeployClusterResponse {
  status: boolean
  stack_name?: string
  response?: Record<string, unknown>
  exception?: string
}

export interface DeployClusterResult {
  success: boolean
  data: DeployClusterResponse | null
  error?: string
  errorDetails?: string
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
    // =====================================================================
    // TEMPORARY HACK: Use vanilla fetch for 'sliderule' cluster
    // Remove this when sliderule cluster is upgraded to latest server code
    // =====================================================================
    const response = cluster === 'sliderule' ? await fetch(url) : await authenticatedFetch(url)
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
    logger.warn('Error fetching server version', {
      cluster,
      url,
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
    // =====================================================================
    // TEMPORARY HACK: Use vanilla fetch for 'sliderule' cluster
    // Remove this when sliderule cluster is upgraded to latest server code
    // =====================================================================
    const fetchOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: 'sliderule' })
    }
    const response =
      cluster === 'sliderule'
        ? await fetch(url, fetchOptions)
        : await authenticatedFetch(url, fetchOptions)

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
    logger.warn('Error fetching current nodes', {
      cluster,
      url,
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      success: false,
      nodes: -1
    }
  }
}

/**
 * Fetch cluster status from the provisioner API.
 * Returns comprehensive status including CloudFormation state, nodes, version, etc.
 * Requires GitHub OAuth authentication.
 * Includes a single retry with backoff for 401 errors (handles JWKS latency).
 *
 * @param cluster - The cluster name
 * @returns Cluster status result with full response data
 */
export async function fetchClusterStatus(cluster: string): Promise<ClusterStatusResult> {
  return provisionerFetch<ClusterStatusResponse>({
    url: 'https://provisioner.slideruleearth.io/status',
    body: { cluster },
    context: 'fetching cluster status'
  })
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
  return provisionerFetch<DeployClusterResponse>({
    url: 'https://provisioner.slideruleearth.io/deploy',
    body: {
      cluster: options.cluster,
      is_public: options.is_public,
      node_capacity: options.node_capacity,
      ttl: options.ttl,
      ...(options.version && { version: options.version }),
      ...(options.region && { region: options.region })
    },
    context: 'deploying cluster'
  })
}

/**
 * Response from the destroy cluster API.
 */
export interface DestroyClusterResponse {
  status: boolean
  stack_name?: string
  response?: Record<string, unknown>
  exception?: string
}

/**
 * Result from destroyCluster function.
 */
export interface DestroyClusterResult {
  success: boolean
  data: DestroyClusterResponse | null
  error?: string
  errorDetails?: string
}

/**
 * Destroy a cluster via the provisioner API.
 * Requires GitHub OAuth authentication.
 * Includes a single retry with backoff for 401 errors (handles JWKS latency).
 *
 * @param cluster - The cluster name to destroy
 * @returns Destroy result with response data
 */
export async function destroyCluster(cluster: string): Promise<DestroyClusterResult> {
  return provisionerFetch<DestroyClusterResponse>({
    url: 'https://provisioner.slideruleearth.io/destroy',
    body: { cluster },
    context: 'destroying cluster'
  })
}

/**
 * Response from the cluster extend API.
 */
export interface ExtendClusterResponse {
  status: boolean
  stack_name?: string
  response?: Record<string, unknown>
  exception?: string
}

/**
 * Result from extendCluster function.
 */
export interface ExtendClusterResult {
  success: boolean
  data: ExtendClusterResponse | null
  error?: string
  errorDetails?: string
}

/**
 * Extend a cluster's TTL via the provisioner API.
 * Requires GitHub OAuth authentication.
 * Includes a single retry with backoff for 401 errors (handles JWKS latency).
 *
 * @param cluster - The cluster name to extend
 * @param ttl - The new TTL in minutes
 * @returns Extend result with response data
 */
export async function extendCluster(cluster: string, ttl: number): Promise<ExtendClusterResult> {
  return provisionerFetch<ExtendClusterResponse>({
    url: 'https://provisioner.slideruleearth.io/extend',
    body: { cluster, ttl },
    context: 'extending cluster TTL'
  })
}

/**
 * CloudFormation stack event from the events API.
 */
export interface StackEvent {
  StackId: string
  EventId: string
  StackName: string
  LogicalResourceId: string
  PhysicalResourceId: string
  ResourceType: string
  Timestamp: string
  ResourceStatus: string
  ResourceStatusReason?: string
  ResourceProperties?: string // JSON string containing resource configuration
}

/**
 * Response from the cluster events API.
 */
export interface ClusterEventsResponse {
  status: boolean
  stack_name?: string
  response?: StackEvent[] // API returns events in 'response' field
  error?: string
  exception?: string
}

/**
 * Result from fetchClusterEvents function.
 */
export interface ClusterEventsResult {
  success: boolean
  data: ClusterEventsResponse | null
  error?: string
  errorDetails?: string
}

/**
 * Fetch cluster events from the provisioner API.
 * Returns CloudFormation stack events for the cluster.
 * Requires GitHub OAuth authentication.
 * Includes a single retry with backoff for 401 errors (handles JWKS latency).
 *
 * @param cluster - The cluster name
 * @returns Cluster events result with stack events
 */
export async function fetchClusterEvents(cluster: string): Promise<ClusterEventsResult> {
  return provisionerFetch<ClusterEventsResponse>({
    url: 'https://provisioner.slideruleearth.io/events',
    body: { cluster },
    context: 'fetching cluster events'
  })
}

/**
 * Response from the provisioner report API.
 */
export interface ProvisionerReportResponse {
  status: boolean
  [key: string]: unknown
}

/**
 * Result from fetchProvisionerReport function.
 */
export interface ProvisionerReportResult {
  success: boolean
  data: ProvisionerReportResponse | null
  error?: string
  errorDetails?: string
}

/**
 * Fetch report from the provisioner API.
 * Requires GitHub OAuth authentication.
 * Includes a single retry with backoff for 401 errors (handles JWKS latency).
 *
 * @returns Report result with response data
 */
export async function fetchProvisionerReport(): Promise<ProvisionerReportResult> {
  return provisionerFetch<ProvisionerReportResponse>({
    url: 'https://provisioner.slideruleearth.io/report',
    body: {},
    context: 'fetching provisioner report'
  })
}

/**
 * Response from the discovery status API.
 */
export interface DiscoveryStatusResponse {
  nodes: number
  [key: string]: unknown
}

/**
 * Result from fetchDiscoveryStatus function.
 */
export interface DiscoveryStatusResult {
  success: boolean
  data: DiscoveryStatusResponse | null
  error?: string
}

/**
 * Fetch discovery status from the SlideRule discovery API.
 * Returns the full response (not just node count).
 *
 * @param cluster - The cluster subdomain
 * @param domain - The domain name
 * @returns Discovery status result with full response data
 */
export async function fetchDiscoveryStatus(
  cluster: string,
  domain: string
): Promise<DiscoveryStatusResult> {
  const url = `https://${cluster}.${domain}/discovery/status`
  try {
    const fetchOptions = {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ service: 'sliderule' })
    }
    const response =
      cluster === 'sliderule'
        ? await fetch(url, fetchOptions)
        : await authenticatedFetch(url, fetchOptions)

    if (!response.ok) throw new Error(`HTTP error: ${response.status}`)

    const data = await response.json()
    return {
      success: true,
      data
    }
  } catch (error) {
    logger.warn('Error fetching discovery status', {
      cluster,
      url,
      error: error instanceof Error ? error.message : String(error)
    })
    return {
      success: false,
      data: null,
      error: error instanceof Error ? error.message : String(error)
    }
  }
}

/**
 * Response from the provisioner status API (global, without cluster param).
 */
export interface ProvisionerStatusResponse {
  status: boolean
  [key: string]: unknown
}

/**
 * Result from fetchProvisionerStatus function.
 */
export interface ProvisionerStatusResult {
  success: boolean
  data: ProvisionerStatusResponse | null
  error?: string
  errorDetails?: string
}

/**
 * Fetch provisioner status from the provisioner API.
 * Requires GitHub OAuth authentication and org membership.
 * Includes a single retry with backoff for 401 errors (handles JWKS latency).
 *
 * @param cluster - The cluster name to get status for
 * @returns Provisioner status result with response data
 */
export async function fetchProvisionerStatus(cluster: string): Promise<ProvisionerStatusResult> {
  return provisionerFetch<ProvisionerStatusResponse>({
    url: 'https://provisioner.slideruleearth.io/status',
    body: { cluster },
    context: 'fetching provisioner status'
  })
}

/**
 * Response from the provisioner test report API.
 */
export interface ProvisionerTestReportResponse {
  status: boolean
  [key: string]: unknown
}

/**
 * Result from fetchProvisionerTestReport function.
 */
export interface ProvisionerTestReportResult {
  success: boolean
  data: ProvisionerTestReportResponse | null
  error?: string
  errorDetails?: string
}

/**
 * Fetch test report from the provisioner API.
 * Requires GitHub OAuth authentication and org membership.
 * Includes a single retry with backoff for 401 errors (handles JWKS latency).
 *
 * @returns Test report result with response data
 */
export async function fetchProvisionerTestReport(): Promise<ProvisionerTestReportResult> {
  return provisionerFetch<ProvisionerTestReportResponse>({
    url: 'https://provisioner.slideruleearth.io/report/tests',
    body: {},
    context: 'fetching provisioner test report'
  })
}

/**
 * Wrapper around fetch that adds GitHub OAuth authentication header if available.
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const githubAuthStore = useGitHubAuthStore()
  const githubToken = githubAuthStore.authToken

  if (githubToken) {
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${githubToken}`
    }
    logger.debug('authenticatedFetch using GitHub OAuth JWT', { url })
  } else {
    logger.debug('authenticatedFetch without auth', { url })
  }

  return fetch(url, options)
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
  const sysConfigStore = useSysConfigStore()
  const githubAuthStore = useGitHubAuthStore()

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
    }
    options.body = body
  }

  // Add Authorization header if GitHub OAuth token available
  const githubToken = githubAuthStore.authToken
  if (githubToken) {
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${githubToken}`
    }
    logger.debug('getArrowFetchUrlAndOptions using GitHub OAuth JWT', { url })
  } else {
    logger.debug('getArrowFetchUrlAndOptions without auth', { url })
  }

  logger.debug('fetch request', { url, options })
  return { url, options }
}
