import { defineStore } from 'pinia'
import { useSysConfigStore } from '@/stores/sysConfigStore'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrLegacyJwtStore')

interface SrJWT {
  accessToken: string
  refreshToken: string
  expiration: Date
}

interface JwtStoreState {
  isPublicMap: Record<string, Record<string, boolean>>
  jwtMap: Record<string, Record<string, SrJWT>>
  isRefreshing: Record<string, Promise<boolean> | null>
  lastRefreshTime: Record<string, number> // Track last refresh to prevent loops
  refreshAttemptCount: Record<string, number> // Count consecutive refresh attempts
}

// Minimum time between refresh attempts (30 seconds) - prevents rapid refresh loops
const MIN_REFRESH_INTERVAL_MS = 30 * 1000
// Maximum consecutive refresh attempts before forcing re-login
const MAX_REFRESH_ATTEMPTS = 3

export const useLegacyJwtStore = defineStore('legacyJwtStore', {
  state: (): JwtStoreState => ({
    isPublicMap: {},
    jwtMap: {},
    isRefreshing: {},
    lastRefreshTime: {},
    refreshAttemptCount: {}
  }),
  actions: {
    setIsPublic(domain: string, org: string, isPublic: boolean) {
      if (!this.isPublicMap[domain]) {
        this.isPublicMap[domain] = {}
      }
      this.isPublicMap[domain][org] = isPublic
    },
    getIsPublic(domain: string, org: string): boolean {
      return this.isPublicMap[domain]?.[org] || false
    },
    setJwt(domain: string, org: string, jwt: SrJWT) {
      if (!this.jwtMap[domain]) {
        this.jwtMap[domain] = {}
      }
      this.jwtMap[domain][org] = jwt
      // Note: No proactive refresh scheduling - tokens refresh on-demand via 401 retry
      // If the session is idle and token expires, user must log in again
    },
    getJwt(domain: string, org: string): SrJWT | null {
      return this.jwtMap[domain]?.[org] || null
    },
    removeJwt(domain: string, org: string) {
      // Clear any pending refresh state
      const key = this._getKey(domain, org)
      delete this.isRefreshing[key]
      delete this.lastRefreshTime[key]
      delete this.refreshAttemptCount[key]

      if (this.jwtMap[domain] && this.jwtMap[domain][org]) {
        delete this.jwtMap[domain][org]
        if (Object.keys(this.jwtMap[domain]).length === 0) {
          delete this.jwtMap[domain]
        }
      }
    },
    clearAllJwts() {
      this.jwtMap = {}
    },
    getCredentials(): SrJWT | null {
      const sysConfigStore = useSysConfigStore()
      let jwt: SrJWT | null = null
      try {
        jwt = this.getJwt(sysConfigStore.getDomain(), sysConfigStore.getOrganization())
        if (jwt) {
          const nowInUnixTime = Math.floor(Date.now() / 1000)
          const expTime = new Date(jwt.expiration).getTime() / 1000
          logger.debug('Checking JWT expiration', { nowInUnixTime, expTime })
          if (expTime < nowInUnixTime) {
            logger.debug('JWT expired')
            this.removeJwt(sysConfigStore.getDomain(), sysConfigStore.getOrganization())
            jwt = null
          } else {
            logger.debug('No authentication needed: JWT is valid')
          }
        }
      } catch (error) {
        logger.error('Error during getCredentials', {
          error: error instanceof Error ? error.message : String(error)
        })
      }
      return jwt
    },

    // Get a unique key for domain/org combination
    _getKey(domain: string, org: string): string {
      return `${domain}:${org}`
    },

    // Refresh access token using refresh token
    async refreshAccessToken(domain: string, org: string): Promise<boolean> {
      const key = this._getKey(domain, org)

      // If already refreshing, return the existing promise to prevent duplicate requests
      if (this.isRefreshing[key]) {
        logger.debug('Refresh already in progress, waiting', { domain, org })
        return this.isRefreshing[key]!
      }

      // Safeguard: prevent rapid refresh attempts (protects against loops)
      const lastRefresh = this.lastRefreshTime[key] || 0
      const timeSinceLastRefresh = Date.now() - lastRefresh
      if (timeSinceLastRefresh < MIN_REFRESH_INTERVAL_MS) {
        logger.warn('Refresh attempted too soon, skipping to prevent loop', {
          domain,
          org,
          timeSinceLastRefreshMs: timeSinceLastRefresh,
          minIntervalMs: MIN_REFRESH_INTERVAL_MS
        })
        return false
      }

      // Safeguard: limit total refresh attempts - force re-login if exceeded
      const attemptCount = (this.refreshAttemptCount[key] || 0) + 1
      if (attemptCount > MAX_REFRESH_ATTEMPTS) {
        logger.error('Max refresh attempts exceeded, forcing re-login', {
          domain,
          org,
          attempts: attemptCount,
          maxAttempts: MAX_REFRESH_ATTEMPTS
        })
        this.removeJwt(domain, org)
        this.refreshAttemptCount[key] = 0
        return false
      }
      this.refreshAttemptCount[key] = attemptCount

      const jwt = this.getJwt(domain, org)
      if (!jwt?.refreshToken) {
        logger.error('No refresh token available', { domain, org })
        return false
      }

      // Record refresh attempt time
      this.lastRefreshTime[key] = Date.now()

      const refreshPromise = (async (): Promise<boolean> => {
        const psHost = `https://ps.${domain}`

        try {
          logger.debug('Refreshing access token', { domain, org })

          const response = await fetch(`${psHost}/api/org_token/refresh/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              refresh: jwt.refreshToken
            })
          })

          if (response.ok) {
            const result = await response.json()
            // Update tokens - API returns access and refresh tokens
            // Note: refresh endpoint does NOT return expiration, so we calculate it
            // Access tokens are typically 1 hour (60 minutes)
            const ACCESS_TOKEN_LIFETIME_MS = 60 * 60 * 1000
            const newExpiration = result.expiration
              ? new Date(result.expiration)
              : new Date(Date.now() + ACCESS_TOKEN_LIFETIME_MS)

            const updatedJwt: SrJWT = {
              accessToken: result.access,
              refreshToken: result.refresh || jwt.refreshToken,
              expiration: newExpiration
            }
            this.setJwt(domain, org, updatedJwt)
            // Reset attempt counter on success
            this.refreshAttemptCount[key] = 0
            logger.debug('Access token refreshed successfully', {
              domain,
              org,
              expiresAt: newExpiration.toISOString()
            })
            return true
          } else {
            logger.error('Failed to refresh token', {
              domain,
              org,
              status: response.status
            })
            // If refresh fails with 401, the refresh token is invalid - remove JWT
            if (response.status === 401) {
              this.removeJwt(domain, org)
            }
            return false
          }
        } catch (error) {
          logger.error('Token refresh error', {
            error: error instanceof Error ? error.message : String(error)
          })
          return false
        } finally {
          delete this.isRefreshing[key]
        }
      })()

      this.isRefreshing[key] = refreshPromise
      return refreshPromise
    },

    /**
     * Ensure the access token has enough remaining lifetime for a long-running job.
     * If the token will expire within the threshold, refresh it proactively.
     * Default threshold is 9 minutes (default request timeout is 10 minutes).
     * @returns The fresh access token, or null if not authenticated
     */
    async ensureFreshToken(): Promise<string | null> {
      const sysConfigStore = useSysConfigStore()
      const domain = sysConfigStore.getDomain()
      const org = sysConfigStore.getOrganization()
      const jwt = this.getJwt(domain, org)

      if (!jwt) {
        logger.debug('ensureFreshToken: No JWT available')
        return null
      }

      const now = Date.now()
      const expTime = new Date(jwt.expiration).getTime()
      const remainingMs = expTime - now
      const thresholdMs = 9 * 60 * 1000 // 9 minutes

      if (remainingMs < thresholdMs) {
        logger.debug('ensureFreshToken: Token expires soon, refreshing proactively', {
          remainingMinutes: Math.round(remainingMs / 60000)
        })

        const refreshed = await this.refreshAccessToken(domain, org)
        if (refreshed) {
          const freshJwt = this.getJwt(domain, org)
          return freshJwt?.accessToken ?? null
        } else {
          logger.error('ensureFreshToken: Failed to refresh token')
          return null
        }
      }

      logger.debug('ensureFreshToken: Token is fresh', {
        remainingMinutes: Math.round(remainingMs / 60000)
      })
      return jwt.accessToken
    }
  },
  persist: {
    // Use sessionStorage - persists within tab until closed
    storage: sessionStorage,
    pick: ['jwtMap', 'isPublicMap']
  }
})
