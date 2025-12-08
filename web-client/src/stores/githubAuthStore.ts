import { defineStore } from 'pinia'
import { createLogger } from '@/utils/logger'

const logger = createLogger('GitHubAuthStore')

type AuthStatus = 'unknown' | 'authenticating' | 'authenticated' | 'not_authenticated' | 'error'

// Auth validity duration (1 hour in milliseconds)
const AUTH_VALIDITY_MS = 60 * 60 * 1000

export const useGitHubAuthStore = defineStore('githubAuth', {
  state: () => ({
    authStatus: 'unknown' as AuthStatus,
    isMember: false,
    isOwner: false,
    username: null as string | null,
    lastError: null as string | null,
    authTimestamp: null as number | null
  }),
  persist: {
    // Use sessionStorage - persists within tab until closed
    storage: sessionStorage,
    // Persist membership info and timestamp
    pick: ['isMember', 'isOwner', 'username', 'authTimestamp', 'authStatus']
  },
  getters: {
    /**
     * Check if user is a SlideRuleEarth organization member
     */
    isSlideRuleOrgMember: (state) => state.isMember || state.isOwner,

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
      isMember?: string
      isOwner?: string
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
      this.isMember = params.isMember === 'true'
      this.isOwner = params.isOwner === 'true'
      this.authTimestamp = Date.now()
      this.authStatus = 'authenticated'
      this.lastError = null

      logger.info('GitHub auth successful', {
        username: this.username,
        isMember: this.isMember,
        isOwner: this.isOwner
      })

      return true
    },

    /**
     * Clear authentication state (logout)
     */
    logout() {
      this.authStatus = 'not_authenticated'
      this.isMember = false
      this.isOwner = false
      this.username = null
      this.authTimestamp = null
      this.lastError = null
      logger.info('GitHub auth cleared')
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
            isMember: this.isMember
          })
        } else {
          logger.debug('Stored GitHub auth expired, clearing')
          this.logout()
        }
      }
    }
  }
})
