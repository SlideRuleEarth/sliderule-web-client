import { defineStore } from 'pinia'
import { createLogger } from '@/utils/logger'

const logger = createLogger('GitHubAuthStore')

type AuthStatus = 'unknown' | 'authenticating' | 'authenticated' | 'not_authenticated' | 'error'

// Token expiration hours - must match JWT_EXPIRATION_HOURS in Lambda handler
const TOKEN_EXPIRATION_HOURS = 12
const AUTH_VALIDITY_MS = TOKEN_EXPIRATION_HOURS * 60 * 60 * 1000

export const useGitHubAuthStore = defineStore('githubAuth', {
  state: () => ({
    authStatus: 'unknown' as AuthStatus,
    isOrgMember: false,
    isOrgOwner: false,
    username: null as string | null,
    orgRoles: [] as string[],
    knownSubdomains: [] as string[],
    knownClusters: [] as string[],
    deployableClusters: [] as string[],
    token: null as string | null,
    lastError: null as string | null,
    authTimestamp: null as number | null,
    // Token metadata (returned separately from server, not decoded from JWT)
    org: null as string | null,
    maxNodes: null as number | null,
    maxTTL: null as number | null,
    tokenIssuedAt: null as number | null, // Unix timestamp
    tokenExpiresAtTimestamp: null as number | null, // Unix timestamp
    tokenIssuer: null as string | null,
    // Flag to indicate user just completed authentication (not persisted)
    justAuthenticated: false
  }),
  persist: {
    // Use sessionStorage - persists within tab until closed
    storage: sessionStorage,
    // Persist membership info, token, metadata, and timestamp (justAuthenticated intentionally not persisted)
    pick: [
      'isOrgMember',
      'isOrgOwner',
      'username',
      'orgRoles',
      'knownSubdomains',
      'knownClusters',
      'deployableClusters',
      'token',
      'authTimestamp',
      'authStatus',
      'org',
      'maxNodes',
      'clusterTtlHours',
      'tokenIssuedAt',
      'tokenExpiresAtTimestamp',
      'tokenIssuer'
    ]
  },
  getters: {
    /**
     * Check if user is a SlideRuleEarth organization member
     */
    isSlideRuleOrgMember: (state) => state.isOrgMember || state.isOrgOwner,

    /**
     * Alias for isOrgMember (backward compatibility)
     */
    isMember: (state) => state.isOrgMember,

    /**
     * Alias for isOrgOwner (backward compatibility)
     */
    isOwner: (state) => state.isOrgOwner,

    /**
     * Check if current auth is still valid (within validity window)
     */
    hasValidAuth: (state) => {
      if (!state.authTimestamp) return false
      if (state.authStatus !== 'authenticated') return false
      return Date.now() - state.authTimestamp < AUTH_VALIDITY_MS
    },

    /**
     * Check if user can access member-only features
     */
    canAccessMemberFeatures(): boolean {
      return this.isSlideRuleOrgMember && this.hasValidAuth
    },

    /**
     * Check if user can access owner-only features
     */
    canAccessOwnerFeatures(): boolean {
      return this.isOrgOwner && this.hasValidAuth
    },

    /**
     * Get the JWT token for server requests (null if not authenticated or expired)
     */
    authToken(): string | null {
      if (!this.hasValidAuth) return null
      return this.token
    },

    /**
     * Check if this is a known cluster and should be shown in the UI
     */
    isKnownCluster: (state) => (cluster: string) => state.knownClusters.includes(cluster),

    /**
     * Get formatted expiration time from stored token metadata
     * Note: Token is treated as opaque; expiration comes from server-provided metadata
     */
    tokenExpiresAt(): Date | null {
      if (!this.tokenExpiresAtTimestamp) return null
      return new Date(this.tokenExpiresAtTimestamp * 1000)
    },

    /**
     * Get formatted issued time from stored token metadata
     */
    tokenIssuedAtDate(): Date | null {
      if (!this.tokenIssuedAt) return null
      return new Date(this.tokenIssuedAt * 1000)
    }
  },
  actions: {
    /**
     * Generate a random state parameter for CSRF protection
     */
    generateState(): string {
      const state = crypto.randomUUID()
      sessionStorage.setItem('github_oauth_state', state)
      logger.debug('Generated OAuth state', { state })
      return state
    },

    /**
     * Validate the state parameter returned from OAuth callback
     */
    validateState(state: string): boolean {
      const storedState = sessionStorage.getItem('github_oauth_state')
      sessionStorage.removeItem('github_oauth_state')

      const isValid = state === storedState
      if (!isValid) {
        logger.warn('OAuth state validation failed', { received: state, expected: storedState })
      }
      return isValid
    },

    /**
     * Initiate the GitHub OAuth login flow
     */
    initiateLogin() {
      const state = this.generateState()

      this.authStatus = 'authenticating'

      // Store current path to return to after authentication
      sessionStorage.setItem('github_oauth_return_path', window.location.pathname)
      logger.debug('Stored return path', { path: window.location.pathname })

      // Build the login URL - the Lambda will handle the redirect to GitHub
      // Use the current hostname to determine the domain (e.g., testsliderule.org, slideruleearth.io)
      // const hostname = window.location.hostname
      // Extract base domain from hostname (e.g., "client.testsliderule.org" -> "testsliderule.org")
      // const domainParts = hostname.split('.')
      // const domain = domainParts.length > 2 ? domainParts.slice(-2).join('.') : hostname

      const loginUrl = new URL(`https://login.slideruleearth.io/auth/github/login`)
      loginUrl.searchParams.set('state', state)
      // Pass the frontend callback URL so Lambda knows where to redirect back
      loginUrl.searchParams.set('redirect_uri', window.location.origin)

      logger.debug('Initiating GitHub OAuth', { loginUrl: loginUrl.toString() })

      // Redirect to the Lambda which will redirect to GitHub
      window.location.href = loginUrl.toString()
    },

    /**
     * Handle the OAuth callback from the Lambda
     *
     * The JWT token is treated as opaque - all user info and token metadata
     * are provided separately in URL params for UX purposes.
     */
    handleCallback(params: {
      state?: string
      username?: string
      isOrgMember?: string
      isOrgOwner?: string
      orgRoles?: string
      knownClusters?: string
      deployableClusters?: string
      token?: string
      error?: string
      // Token metadata (returned separately, not decoded from JWT)
      org?: string
      maxNodes?: string
      maxTTL?: string
      tokenIssuedAt?: string
      tokenExpiresAt?: string
      tokenIssuer?: string
    }): boolean {
      logger.debug('Handling OAuth callback', params)

      // Check for errors first
      if (params.error) {
        this.authStatus = 'error'
        this.lastError = params.error
        logger.error('GitHub OAuth error', { error: params.error })
        return false
      }

      // Validate state parameter
      if (params.state && !this.validateState(params.state)) {
        this.authStatus = 'error'
        this.lastError = 'Invalid state parameter - possible CSRF attack'
        return false
      }

      // Update state with results
      this.username = params.username || null
      this.isOrgMember = params.isOrgMember === 'true'
      this.isOrgOwner = params.isOrgOwner === 'true'
      this.orgRoles = params.orgRoles ? params.orgRoles.split(',').filter((r) => r) : []
      // Store all subdomains (includes 'sliderule')
      this.knownSubdomains = params.knownClusters
        ? params.knownClusters.split(',').filter((c) => c)
        : []
      // Filter out 'sliderule' for actual clusters
      this.knownClusters = this.knownSubdomains.filter((c) => c !== 'sliderule')
      this.deployableClusters = params.deployableClusters
        ? params.deployableClusters.split(',').filter((c) => c)
        : []
      this.token = params.token || null
      this.authTimestamp = Date.now()
      this.authStatus = 'authenticated'
      this.lastError = null
      this.justAuthenticated = true

      // Store token metadata (provided separately by server for UX)
      this.org = params.org || null
      this.maxNodes = params.maxNodes ? parseInt(params.maxNodes, 10) : null
      this.maxTTL = params.maxTTL ? parseInt(params.maxTTL, 10) : null
      this.tokenIssuedAt = params.tokenIssuedAt ? parseInt(params.tokenIssuedAt, 10) : null
      this.tokenExpiresAtTimestamp = params.tokenExpiresAt
        ? parseInt(params.tokenExpiresAt, 10)
        : null
      this.tokenIssuer = params.tokenIssuer || null

      logger.info('GitHub auth successful', {
        username: this.username,
        isOrgMember: this.isOrgMember,
        isOrgOwner: this.isOrgOwner,
        orgRoles: this.orgRoles,
        knownClusters: this.knownClusters,
        deployableClusters: this.deployableClusters,
        hasToken: !!this.token,
        maxNodes: this.maxNodes,
        maxTTL: this.maxTTL
      })

      return true
    },

    /**
     * Clear authentication state (logout)
     */
    logout() {
      this.authStatus = 'not_authenticated'
      this.isOrgMember = false
      this.isOrgOwner = false
      this.username = null
      this.orgRoles = []
      this.knownSubdomains = []
      this.knownClusters = []
      this.deployableClusters = []
      this.token = null
      this.authTimestamp = null
      this.lastError = null
      this.justAuthenticated = false
      // Clear token metadata
      this.org = null
      this.maxNodes = null
      this.maxTTL = null
      this.tokenIssuedAt = null
      this.tokenExpiresAtTimestamp = null
      this.tokenIssuer = null
      logger.info('GitHub auth cleared')
    },

    /**
     * Clear the justAuthenticated flag (called after UI has responded to fresh auth)
     */
    clearJustAuthenticated() {
      this.justAuthenticated = false
    },

    /**
     * Check if current auth is still valid, logout if expired
     */
    checkAuthValidity(): boolean {
      if (this.authStatus === 'authenticated' && !this.hasValidAuth) {
        logger.debug('Auth expired, clearing')
        this.logout()
        return false
      }
      return this.hasValidAuth
    },

    /**
     * Initialize on app startup - check if we have valid persisted auth
     */
    initializeOnStartup(): void {
      if (this.authStatus === 'authenticated') {
        if (this.hasValidAuth) {
          logger.debug('Restored valid GitHub auth from storage', {
            username: this.username,
            isOrgMember: this.isOrgMember
          })
        } else {
          logger.debug('Stored GitHub auth expired, clearing')
          this.logout()
        }
      }
    },

    /**
     * Get Authorization header object for API requests.
     * Returns the header object if authenticated, or empty object if not.
     * Usage: fetch(url, { headers: { ...otherHeaders, ...githubAuthStore.getAuthHeader() } })
     */
    getAuthHeader(): Record<string, string> {
      if (!this.hasValidAuth || !this.token) {
        return {}
      }
      return {
        'X-SlideRule-GitHub-Token': this.token
      }
    }
  }
})
