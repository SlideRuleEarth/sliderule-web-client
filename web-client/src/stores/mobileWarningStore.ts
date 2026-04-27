import { defineStore } from 'pinia'
import { useDeviceStore } from '@/stores/deviceStore'

const DEFAULT_THRESHOLD = 2

/**
 * Mobile Warning Store
 *
 * Tracks unique visits where the mobile warning was shown.
 * Shows warning for phones (not tablets) until threshold visits reached.
 * Each visit only counts once, regardless of how many times user clicks.
 */
export const useMobileWarningStore = defineStore('mobileWarning', {
  state: () => ({
    // Persisted: counts unique visits where warning was dismissed
    visitCount: 0,
    threshold: DEFAULT_THRESHOLD,
    // Session-only: tracks if warning was dismissed this visit
    dismissedThisSession: false
  }),
  persist: {
    storage: localStorage,
    // Only persist visitCount and threshold, NOT dismissedThisSession
    pick: ['visitCount', 'threshold']
  },
  getters: {
    /**
     * Whether to show the mobile warning
     * Show for phones (not iPads/tablets) until threshold visits reached
     * Only show once per session
     */
    shouldShowWarning: (state) => {
      const deviceStore = useDeviceStore()
      return (
        !state.dismissedThisSession &&
        state.visitCount < state.threshold &&
        deviceStore.isMobile &&
        !deviceStore.isAniPad
      )
    },
    // Expose visitCount as dismissCount for UI compatibility
    dismissCount: (state) => state.visitCount
  },
  actions: {
    /**
     * User dismisses the warning - counts as one visit
     */
    dismiss() {
      if (!this.dismissedThisSession) {
        this.visitCount++
        this.dismissedThisSession = true
      }
    },

    /**
     * Reset the visit counter (for testing or settings)
     */
    resetCounter() {
      this.visitCount = 0
      this.dismissedThisSession = false
    },

    /**
     * Reset the threshold to default
     */
    resetThreshold() {
      this.threshold = DEFAULT_THRESHOLD
    }
  }
})
