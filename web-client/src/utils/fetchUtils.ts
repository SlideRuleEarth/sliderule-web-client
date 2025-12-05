import { db } from '@/db/SlideRuleDb'
import { useSysConfigStore } from '@/stores/sysConfigStore'
import { useJwtStore } from '@/stores/SrJWTStore'
import { Buffer } from 'buffer/'
import { createLogger } from '@/utils/logger'

const logger = createLogger('FetchUtils')
//
// System Configuration
//
const sysConfigStore = useSysConfigStore()
const jwtStore = useJwtStore()

/**
 * Authenticated fetch wrapper with automatic 401 retry.
 * - Adds JWT Authorization header if available
 * - On 401, attempts to refresh the token and retry once
 * - Returns the Response object for further processing
 */
export async function authenticatedFetch(
  url: string,
  options: RequestInit = {},
  isRetry = false
): Promise<Response> {
  const domain = sysConfigStore.getDomain()
  const org = sysConfigStore.getOrganization()

  // Add Authorization header if JWT is available
  const jwt = jwtStore.getJwt(domain, org)
  if (jwt) {
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${jwt.accessToken}`
    }
  }

  logger.debug('authenticatedFetch', { url, isRetry, hasJwt: !!jwt })

  const response = await fetch(url, options)

  // Handle 401 Unauthorized - attempt refresh and retry once
  if (response.status === 401 && !isRetry && jwt) {
    logger.debug('Received 401, attempting token refresh', { url })

    const refreshed = await jwtStore.refreshAccessToken(domain, org)

    if (refreshed) {
      logger.debug('Token refreshed, retrying request', { url })
      // Get the new token and update headers
      const newJwt = jwtStore.getJwt(domain, org)
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
  let api = await db.getFunc(reqid)
  if (api === 'atl03x-surface' || api === 'atl03x-phoreal') {
    api = 'atl03x'
  }
  let parm = await db.getReqParams(reqid)
  if (forceAsGeo) {
    parm = forceGeoParquet(parm)
  }
  const host =
    (sysConfigStore.getOrganization() &&
      sysConfigStore.getOrganization() + '.' + sysConfigStore.getDomain()) ||
    sysConfigStore.getDomain()
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
  // add JWT for Authorization header if present
  let srJWT = useJwtStore().getJwt(sysConfigStore.getDomain(), sysConfigStore.getOrganization())
  if (srJWT) {
    options.headers = {
      ...options.headers,
      Authorization: `Bearer ${srJWT.accessToken}`
    }
  }
  logger.debug('fetch request', { url, options })
  return { url, options }
}
