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
    teams: [] as string[],
    teamRoles: {} as Record<string, string>,
    orgRoles: [] as string[],
    allowedClusters: [] as string[],
    token: null as string | null,
    lastError: null as string | null,
    authTimestamp: null as number | null,
    // Flag to indicate user just completed authentication (not persisted)
    justAuthenticated: false
  }),
  persist: {
    // Use sessionStorage - persists within tab until closed
    storage: sessionStorage,
    // Persist membership info, token, and timestamp (justAuthenticated intentionally not persisted)
    pick: [
      'isOrgMember',
      'isOrgOwner',
      'username',
      'teams',
      'teamRoles',
      'orgRoles',
      'allowedClusters',
      'token',
      'authTimestamp',
      'authStatus'
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
     * Get the JWT token for server requests (null if not authenticated or expired)
     */
    authToken(): string | null {
      if (!this.hasValidAuth) return null
      return this.token
    },

    /**
     * Get the user's team memberships
     */
    userTeams: (state) => state.teams,

    /**
     * Check if user belongs to a specific team
     */
    isInTeam: (state) => (teamSlug: string) => state.teams.includes(teamSlug),

    /**
     * Check if user is allowed to access a specific cluster
     */
    isAllowedCluster: (state) => (cluster: string) => state.allowedClusters.includes(cluster),

    /**
     * Get decoded JWT payload (for display purposes)
     * Returns null if no token or invalid token format
     */
    decodedToken(): Record<string, unknown> | null {
      if (!this.token) return null
      try {
        // JWT format: header.payload.signature
        const parts = this.token.split('.')
        if (parts.length !== 3) return null

        // Decode the payload (middle part) - base64url to base64
        const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/')
        const decoded = atob(payload)
        return JSON.parse(decoded)
      } catch (e) {
        logger.warn('Failed to decode JWT token', e)
        return null
      }
    },

    /**
     * Get formatted expiration time from token
     */
    tokenExpiresAt(): Date | null {
      const decoded = this.decodedToken
      if (!decoded || typeof decoded.exp !== 'number') return null
      return new Date(decoded.exp * 1000)
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
      const clientId = import.meta.env.VITE_GITHUB_CLIENT_ID
      const apiUrl = import.meta.env.VITE_GITHUB_OAUTH_API_URL

      if (!clientId || !apiUrl) {
        logger.error('GitHub OAuth not configured', { clientId: !!clientId, apiUrl: !!apiUrl })
        this.lastError = 'GitHub OAuth is not configured'
        this.authStatus = 'error'
        return
      }

      this.authStatus = 'authenticating'

      // Store current path to return to after authentication
      sessionStorage.setItem('github_oauth_return_path', window.location.pathname)
      logger.debug('Stored return path', { path: window.location.pathname })

      // Build the login URL - the Lambda will handle the redirect to GitHub
      const loginUrl = new URL(`${apiUrl}/auth/github/login`)
      loginUrl.searchParams.set('state', state)
      // Pass the frontend callback URL so Lambda knows where to redirect back
      loginUrl.searchParams.set('redirect_uri', window.location.origin)

      logger.debug('Initiating GitHub OAuth', { loginUrl: loginUrl.toString() })

      // Redirect to the Lambda which will redirect to GitHub
      window.location.href = loginUrl.toString()
    },

    /**
     * Handle the OAuth callback from the Lambda
     */
    handleCallback(params: {
      state?: string
      username?: string
      isOrgMember?: string
      isOrgOwner?: string
      teams?: string
      teamRoles?: string
      orgRoles?: string
      allowedClusters?: string
      token?: string
      error?: string
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
      this.teams = params.teams ? params.teams.split(',').filter((t) => t) : []
      this.teamRoles = params.teamRoles ? JSON.parse(params.teamRoles) : {}
      this.orgRoles = params.orgRoles ? params.orgRoles.split(',').filter((r) => r) : []
      this.allowedClusters = params.allowedClusters
        ? params.allowedClusters.split(',').filter((c) => c)
        : []
      this.token = params.token || null
      this.authTimestamp = Date.now()
      this.authStatus = 'authenticated'
      this.lastError = null
      this.justAuthenticated = true

      logger.info('GitHub auth successful', {
        username: this.username,
        isOrgMember: this.isOrgMember,
        isOrgOwner: this.isOrgOwner,
        teams: this.teams,
        teamRoles: this.teamRoles,
        orgRoles: this.orgRoles,
        allowedClusters: this.allowedClusters,
        hasToken: !!this.token
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
      this.teams = []
      this.teamRoles = {}
      this.orgRoles = []
      this.allowedClusters = []
      this.token = null
      this.authTimestamp = null
      this.lastError = null
      this.justAuthenticated = false
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
