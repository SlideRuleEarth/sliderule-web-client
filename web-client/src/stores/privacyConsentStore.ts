import { defineStore } from 'pinia'
import { createLogger } from '@/utils/logger'

const logger = createLogger('PrivacyConsentStore')

/**
 * Privacy Consent Store
 *
 * Manages user consent preferences for GDPR/CCPA compliance.
 * Detects Global Privacy Control (GPC) browser signals.
 */
export const usePrivacyConsentStore = defineStore('privacyConsent', {
  state: () => ({
    // User has made a consent choice
    hasConsented: false,
    // User chose essential-only (declined non-essential storage)
    essentialOnly: false,
    // Timestamp when consent was given
    consentTimestamp: null as number | null,
    // Global Privacy Control signal detected from browser
    gpcDetected: false
  }),
  persist: {
    // Use localStorage - consent should persist across browser sessions
    storage: localStorage,
    // Only persist consent-related fields, not GPC detection (re-check each session)
    pick: ['hasConsented', 'essentialOnly', 'consentTimestamp']
  },
  getters: {
    /**
     * Whether to show the consent banner
     */
    shouldShowBanner: (state) => !state.hasConsented,

    /**
     * Whether non-essential storage/tracking is allowed
     * False if: user hasn't consented, chose essential-only, or GPC signal detected
     */
    canUseNonEssentialStorage: (state) => {
      if (!state.hasConsented) return false
      if (state.essentialOnly) return false
      if (state.gpcDetected) return false
      return true
    },

    /**
     * Human-readable consent status
     */
    consentStatus: (state) => {
      if (!state.hasConsented) return 'Not acknowledged'
      return 'Acknowledged'
    }
  },
  actions: {
    /**
     * User acknowledges the privacy notice
     */
    acknowledge() {
      this.hasConsented = true
      this.consentTimestamp = Date.now()
      logger.info('User acknowledged privacy notice', { timestamp: this.consentTimestamp })
    },

    /**
     * Check for Global Privacy Control (GPC) signal from browser
     * Per California law (CCPA/CPRA), must honor this as opt-out
     * @returns true if GPC signal is detected
     */
    checkGpcSignal(): boolean {
      // @ts-expect-error - globalPrivacyControl is not in standard Navigator types yet
      const gpc = navigator.globalPrivacyControl === true
      this.gpcDetected = gpc

      if (gpc) {
        // Auto-set essential only per California CCPA/CPRA law
        // GPC must be honored as an opt-out request
        this.essentialOnly = true
        this.hasConsented = true
        this.consentTimestamp = Date.now()
        logger.info('Global Privacy Control signal detected - honoring as opt-out', {
          timestamp: this.consentTimestamp
        })
      }

      return gpc
    },

    /**
     * Reset consent to show banner again (e.g., for changing preferences)
     */
    resetConsent() {
      this.hasConsented = false
      this.essentialOnly = false
      this.consentTimestamp = null
      // Don't reset gpcDetected - that's a browser setting
      logger.info('Consent preferences reset')
    },

    /**
     * Clear all user data from the application
     * This clears auth, preferences, and browser storage
     * Note: Does NOT clear OPFS parquet files (science data records)
     */
    async clearAllUserData() {
      logger.info('Clearing all user data (preserving science data files)')

      // Import stores dynamically to avoid circular dependencies
      const { useGitHubAuthStore } = await import('@/stores/githubAuthStore')
      const { useGoogleApiKeyStore } = await import('@/stores/googleApiKeyStore')
      const { useLegacyJwtStore } = await import('@/stores/SrLegacyJwtStore')
      const { useSysConfigStore } = await import('@/stores/sysConfigStore')
      const { useTourStore } = await import('@/stores/tourStore')

      // Clear individual stores
      const githubAuthStore = useGitHubAuthStore()
      const googleApiKeyStore = useGoogleApiKeyStore()
      const legacyJwtStore = useLegacyJwtStore()
      const sysConfigStore = useSysConfigStore()
      const tourStore = useTourStore()

      // Logout/clear auth stores
      if (githubAuthStore.logout) {
        githubAuthStore.logout()
      }
      if (googleApiKeyStore.clearApiKey) {
        googleApiKeyStore.clearApiKey()
      }
      legacyJwtStore.clearAllJwts()
      sysConfigStore.$reset()
      tourStore.resetTour()

      // Clear all browser storage
      localStorage.clear()
      sessionStorage.clear()

      // Reset this store's consent (will show banner again)
      this.hasConsented = false
      this.essentialOnly = false
      this.consentTimestamp = null

      logger.info('User data cleared successfully (science data preserved)')
    },

    /**
     * Initialize store on app startup
     * Checks for GPC signal and logs consent status
     */
    initializeOnStartup() {
      // Check for GPC signal first
      this.checkGpcSignal()

      if (this.hasConsented) {
        logger.debug('Restored consent preferences from storage', {
          essentialOnly: this.essentialOnly,
          consentTimestamp: this.consentTimestamp,
          gpcDetected: this.gpcDetected
        })
      } else {
        logger.debug('No consent preferences found - banner will be shown')
      }
    }
  }
})
