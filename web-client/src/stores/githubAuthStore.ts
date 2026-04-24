import { defineStore } from 'pinia'
import { createLogger } from '@/utils/logger'
import { generateCodeVerifier, generateCodeChallenge } from '@/utils/pkceUtils'
import { getProvisionerBaseUrl } from '@/utils/domainUtils'
import { getASMetadata, clearASMetadataCache } from '@/utils/oauthDiscovery'

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
    // OAuth 2.1 Dynamic Client Registration
    clientId: null as string | null,
    // Flag to indicate user just completed authentication (not persisted)
    justAuthenticated: false
  }),
  persist: {
    // Use sessionStorage - persists within tab until closed
    storage: sessionStorage,
    // Persist membership info, token, metadata, and timestamp (justAuthenticated intentionally not persisted)
    paths: [
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
      'tokenIssuer',
      'clientId'
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
      // Check client-side window
      if (Date.now() - state.authTimestamp >= AUTH_VALIDITY_MS) return false
      // Also honor server-provided expiry if available
      if (state.tokenExpiresAtTimestamp !== null) {
        const nowSecs = Math.floor(Date.now() / 1000)
        if (nowSecs >= state.tokenExpiresAtTimestamp) return false
      }
      return true
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
     * Dynamic Client Registration (RFC 7591).
     * Registers this web client with the auth server and stores the client_id.
     */
    async registerClient(): Promise<string> {
      // If a static client_id is configured, use it directly (skips DCR).
      // This is needed for AS servers where DCR has CORS restrictions (e.g. Keycloak).
      const staticClientId = import.meta.env.VITE_OAUTH_CLIENT_ID
      if (staticClientId) {
        this.clientId = staticClientId
        logger.info('Using static client_id', { clientId: this.clientId })
        return staticClientId
      }

      const metadata = await getASMetadata()

      if (!metadata.registration_endpoint) {
        throw new Error('AS does not support DCR and no VITE_OAUTH_CLIENT_ID configured')
      }

      const redirectUri = window.location.origin + '/auth/github/callback'
      const dcrBody = {
        redirect_uris: [redirectUri],
        client_name: 'SlideRule Web Client',
        grant_types: ['authorization_code'],
        response_types: ['code'],
        token_endpoint_auth_method: 'none',
        code_challenge_method: 'S256',
        scope: 'sliderule:access provisioner:access'
      }

      // Try standards-compliant JSON POST body first (RFC 7591)
      let response = await fetch(metadata.registration_endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(dcrBody)
      })

      // Fallback: some AS implementations read from query string instead of POST body
      if (!response.ok) {
        logger.warn('DCR via POST body failed, retrying with query string params (non-standard)', {
          status: response.status
        })
        const fallbackUrl = new URL(metadata.registration_endpoint)
        fallbackUrl.searchParams.set('redirect_uris', redirectUri)
        fallbackUrl.searchParams.set('client_name', dcrBody.client_name)
        fallbackUrl.searchParams.set('grant_types', 'authorization_code')
        fallbackUrl.searchParams.set('response_types', 'code')
        fallbackUrl.searchParams.set('token_endpoint_auth_method', 'none')
        fallbackUrl.searchParams.set('code_challenge_method', 'S256')
        fallbackUrl.searchParams.set('scope', 'sliderule:access provisioner:access')
        response = await fetch(fallbackUrl.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        })
      }

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Client registration failed: ${response.status} ${errorText}`)
      }

      const data = await response.json()
      if (!data.client_id) {
        throw new Error('Client registration response missing client_id')
      }

      this.clientId = data.client_id
      logger.info('Dynamic client registration successful', { clientId: this.clientId })
      return data.client_id
    },

    /**
     * Initiate the GitHub OAuth 2.1 login flow with PKCE.
     */
    async initiateLogin() {
      try {
        this.authStatus = 'authenticating'

        // Step 1: Discover AS endpoints
        const metadata = await getASMetadata()

        // Step 2: Dynamic client registration (if not already registered this session)
        if (!this.clientId) {
          await this.registerClient()
        }

        // Step 3: Generate PKCE parameters
        const codeVerifier = generateCodeVerifier()
        const codeChallenge = await generateCodeChallenge(codeVerifier)

        // Store code_verifier in sessionStorage for use after redirect
        sessionStorage.setItem('github_oauth_code_verifier', codeVerifier)

        // Generate CSRF state
        const state = this.generateState()

        // Store current path to return to after authentication
        sessionStorage.setItem('github_oauth_return_path', window.location.pathname)
        logger.debug('Stored return path', { path: window.location.pathname })

        // Step 4: Build authorization URL with OAuth 2.1 params
        const loginUrl = new URL(metadata.authorization_endpoint)
        loginUrl.searchParams.set('response_type', 'code')
        loginUrl.searchParams.set('client_id', this.clientId!)
        loginUrl.searchParams.set('redirect_uri', window.location.origin + '/auth/github/callback')
        loginUrl.searchParams.set('state', state)
        loginUrl.searchParams.set('scope', 'sliderule:access provisioner:access')
        loginUrl.searchParams.set('code_challenge', codeChallenge)
        loginUrl.searchParams.set('code_challenge_method', 'S256')

        logger.debug('Initiating OAuth with PKCE', { loginUrl: loginUrl.toString() })

        // Redirect to authorization endpoint
        window.location.href = loginUrl.toString()
      } catch (error) {
        this.authStatus = 'error'
        this.lastError = error instanceof Error ? error.message : 'Login initialization failed'
        logger.error('Failed to initiate login', { error: this.lastError })
      }
    },

    /**
     * Exchange authorization code for token (OAuth 2.1 PKCE token exchange).
     * Called from the callback view after receiving the authorization code.
     */
    async exchangeCodeForToken(params: {
      code?: string
      state?: string
      error?: string
    }): Promise<boolean> {
      logger.debug('Processing OAuth callback', {
        hasCode: !!params.code,
        hasState: !!params.state
      })

      // Check for errors from authorization server
      if (params.error) {
        this.authStatus = 'error'
        this.lastError = params.error
        logger.error('Authorization error', { error: params.error })
        return false
      }

      // Validate state parameter
      if (!params.state || !this.validateState(params.state)) {
        this.authStatus = 'error'
        this.lastError = 'Missing or invalid state parameter - possible CSRF attack'
        return false
      }

      // Validate code
      if (!params.code) {
        this.authStatus = 'error'
        this.lastError = 'Missing authorization code'
        return false
      }

      // Retrieve PKCE code_verifier
      const codeVerifier = sessionStorage.getItem('github_oauth_code_verifier')
      sessionStorage.removeItem('github_oauth_code_verifier')
      if (!codeVerifier) {
        this.authStatus = 'error'
        this.lastError = 'Missing PKCE code_verifier - auth flow may have been interrupted'
        return false
      }

      // Validate client_id is available
      if (!this.clientId) {
        this.authStatus = 'error'
        this.lastError = 'Missing client_id - registration may have failed'
        return false
      }

      // Token exchange via POST with form-encoded body (RFC 6749 / OAuth 2.1)
      try {
        const metadata = await getASMetadata()
        const tokenParams = {
          grant_type: 'authorization_code',
          code: params.code,
          redirect_uri: window.location.origin + '/auth/github/callback',
          client_id: this.clientId,
          code_verifier: codeVerifier
        }

        // Try standards-compliant form-encoded POST body first
        let response = await fetch(metadata.token_endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams(tokenParams).toString()
        })

        // Fallback: some AS implementations read from query string instead of POST body
        if (!response.ok) {
          logger.warn(
            'Token exchange via POST body failed, retrying with query string params (non-standard)',
            { status: response.status }
          )
          const fallbackUrl = new URL(metadata.token_endpoint)
          for (const [key, value] of Object.entries(tokenParams)) {
            fallbackUrl.searchParams.set(key, value)
          }
          response = await fetch(fallbackUrl.toString(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
          })
        }

        if (!response.ok) {
          const errorText = await response.text()
          throw new Error(`Token exchange failed: ${response.status} ${errorText}`)
        }

        const data = await response.json()

        // Extract token
        this.token = data.access_token || null
        if (!this.token) {
          throw new Error('Token exchange response missing access_token')
        }

        // Extract user info from the 'info' object
        const info = data.info || {}
        this.username = info.username || null
        this.isOrgMember = info.isOrgMember === 'true'
        this.isOrgOwner = info.isOrgOwner === 'true'
        this.orgRoles = info.orgRoles ? info.orgRoles.split(',').filter((r: string) => r) : []
        this.org = info.org || null
        this.tokenIssuedAt = info.tokenIssuedAt ? parseInt(info.tokenIssuedAt, 10) : null
        this.tokenExpiresAtTimestamp = info.tokenExpiresAt
          ? parseInt(info.tokenExpiresAt, 10)
          : null
        this.tokenIssuer = info.tokenIssuer || null

        this.authTimestamp = Date.now()
        this.authStatus = 'authenticated'
        this.lastError = null
        this.justAuthenticated = true

        logger.info('Token exchange successful', {
          username: this.username,
          isOrgMember: this.isOrgMember,
          isOrgOwner: this.isOrgOwner,
          orgRoles: this.orgRoles,
          hasToken: true
        })

        // Fetch cluster/profile info from provisioner (non-blocking, non-fatal)
        void this.fetchUserProfile()

        return true
      } catch (error) {
        this.authStatus = 'error'
        this.lastError = error instanceof Error ? error.message : 'Token exchange failed'
        logger.error('Token exchange failed', { error: this.lastError })
        return false
      }
    },

    /**
     * Fetch user profile/cluster info from the provisioner.
     * Non-fatal: if this fails, auth still works but cluster info will be empty.
     */
    async fetchUserProfile() {
      try {
        if (!this.token) return

        const url = `${getProvisionerBaseUrl()}/info`
        const makeRequest = async () =>
          fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${this.token}`
            },
            body: JSON.stringify({})
          })

        let response = await makeRequest()

        // Retry on 401 with backoff (handles JWKS latency after fresh login)
        if (response.status === 401) {
          logger.debug('Provisioner returned 401, retrying after 1s backoff')
          await new Promise((resolve) => setTimeout(resolve, 1000))
          response = await makeRequest()
        }

        if (!response.ok) {
          logger.warn('Failed to fetch user profile from provisioner', { status: response.status })
          return
        }

        const data = await response.json()

        // Populate cluster info
        if (data.knownClusters) {
          const allClusters = Array.isArray(data.knownClusters)
            ? data.knownClusters
            : data.knownClusters.split(',').filter((c: string) => c)
          this.knownSubdomains = allClusters
          this.knownClusters = allClusters.filter((c: string) => c !== 'sliderule')
        }
        if (data.deployableClusters) {
          this.deployableClusters = Array.isArray(data.deployableClusters)
            ? data.deployableClusters
            : data.deployableClusters.split(',').filter((c: string) => c)
        }
        if (data.maxNodes != null) {
          this.maxNodes =
            typeof data.maxNodes === 'number' ? data.maxNodes : parseInt(data.maxNodes, 10)
        }
        if (data.maxTTL != null) {
          this.maxTTL = typeof data.maxTTL === 'number' ? data.maxTTL : parseInt(data.maxTTL, 10)
        }

        logger.info('User profile fetched from provisioner', {
          knownClusters: this.knownClusters,
          deployableClusters: this.deployableClusters,
          maxNodes: this.maxNodes,
          maxTTL: this.maxTTL
        })
      } catch (error) {
        logger.warn('Error fetching user profile from provisioner', { error: String(error) })
      }
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
      // Clear OAuth 2.1 state
      this.clientId = null
      clearASMetadataCache()
      sessionStorage.removeItem('github_oauth_code_verifier')
      logger.info('Auth cleared')
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
      if (this.authStatus === 'authenticating') {
        // If we're starting up with 'authenticating' status, the redirect already happened
        // and we're back — reset to not_authenticated so the spinner doesn't show
        logger.debug('Clearing stale authenticating status on startup')
        this.authStatus = 'not_authenticated'
      } else if (this.authStatus === 'authenticated') {
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
    }
  }
})
