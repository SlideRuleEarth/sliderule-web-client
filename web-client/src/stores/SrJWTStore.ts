import { defineStore } from 'pinia'
import { useSysConfigStore } from '@/stores/sysConfigStore'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrJWTStore')
const sysConfigStore = useSysConfigStore()

// Refresh access token when 80% of its lifetime has passed (48 min for 1-hour token)
const REFRESH_THRESHOLD = 0.8
// Minimum time before expiry to trigger refresh (5 minutes in ms)
const MIN_REFRESH_BUFFER_MS = 5 * 60 * 1000

interface SrJWT {
  accessToken: string
  refreshToken: string
  expiration: Date
}

interface JwtStoreState {
  isPublicMap: Record<string, Record<string, boolean>>
  jwtMap: Record<string, Record<string, SrJWT>>
  refreshTimers: Record<string, ReturnType<typeof setTimeout>>
  isRefreshing: Record<string, Promise<boolean> | null>
}

export const useJwtStore = defineStore('jwtStore', {
  state: (): JwtStoreState => ({
    isPublicMap: {},
    jwtMap: {},
    refreshTimers: {},
    isRefreshing: {}
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
      // Schedule proactive refresh for the new token
      this.scheduleRefresh(domain, org)
    },
    getJwt(domain: string, org: string): SrJWT | null {
      return this.jwtMap[domain]?.[org] || null
    },
    removeJwt(domain: string, org: string) {
      // Cancel any scheduled refresh first
      this.cancelRefresh(domain, org)
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

    // Schedule proactive token refresh before expiration
    scheduleRefresh(domain: string, org: string) {
      const key = this._getKey(domain, org)
      const jwt = this.getJwt(domain, org)

      if (!jwt) {
        logger.debug('No JWT to schedule refresh for', { domain, org })
        return
      }

      // Cancel any existing timer
      this.cancelRefresh(domain, org)

      const now = Date.now()
      const expTime = new Date(jwt.expiration).getTime()
      const timeUntilExpiry = expTime - now

      // Calculate refresh time: either at REFRESH_THRESHOLD (80%) of lifetime, or MIN_REFRESH_BUFFER before expiry
      const tokenLifetime = 60 * 60 * 1000 // Assume 1 hour access token lifetime
      const refreshAtThreshold = tokenLifetime * REFRESH_THRESHOLD
      const refreshTime = Math.min(timeUntilExpiry - MIN_REFRESH_BUFFER_MS, refreshAtThreshold)

      if (refreshTime <= 0) {
        // Token is about to expire or already expired, refresh immediately
        logger.debug('Token near expiry, refreshing immediately', { domain, org })
        void this.refreshAccessToken(domain, org)
        return
      }

      logger.debug('Scheduling token refresh', {
        domain,
        org,
        refreshInMs: refreshTime,
        refreshInMinutes: Math.round(refreshTime / 60000)
      })

      this.refreshTimers[key] = setTimeout(() => {
        void this.refreshAccessToken(domain, org)
      }, refreshTime)
    },

    // Cancel scheduled refresh
    cancelRefresh(domain: string, org: string) {
      const key = this._getKey(domain, org)
      if (this.refreshTimers[key]) {
        clearTimeout(this.refreshTimers[key])
        delete this.refreshTimers[key]
        logger.debug('Cancelled refresh timer', { domain, org })
      }
      // Also clear any pending refresh promise
      delete this.isRefreshing[key]
    },

    // Refresh access token using refresh token
    async refreshAccessToken(domain: string, org: string): Promise<boolean> {
      const key = this._getKey(domain, org)

      // If already refreshing, return the existing promise to prevent duplicate requests
      if (this.isRefreshing[key]) {
        logger.debug('Refresh already in progress, waiting', { domain, org })
        return this.isRefreshing[key]!
      }

      const jwt = this.getJwt(domain, org)
      if (!jwt?.refreshToken) {
        logger.error('No refresh token available', { domain, org })
        return false
      }

      const refreshPromise = (async (): Promise<boolean> => {
        const psHost = `https://ps.${domain}`

        try {
          logger.debug('Refreshing access token', { domain, org })

          const response = await fetch(`${psHost}/api/token/refresh/`, {
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
            // Update only the access token and expiration, keep the refresh token
            const updatedJwt: SrJWT = {
              accessToken: result.access,
              refreshToken: jwt.refreshToken, // Keep existing refresh token
              expiration: result.expiration
            }
            this.setJwt(domain, org, updatedJwt)
            logger.debug('Access token refreshed successfully', { domain, org })
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

    // Initialize refresh timers for existing tokens on startup
    initializeRefreshTimers() {
      const domain = sysConfigStore.getDomain()
      const org = sysConfigStore.getOrganization()

      if (this.getJwt(domain, org)) {
        this.scheduleRefresh(domain, org)
      }
    },

    /**
     * Ensure the access token has enough remaining lifetime for a long-running job.
     * If the token will expire within the threshold, refresh it proactively.
     * Default threshold is 9 minutes (default request timeout is 10 minutes).
     * @returns The fresh access token, or null if not authenticated
     */
    async ensureFreshToken(): Promise<string | null> {
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
