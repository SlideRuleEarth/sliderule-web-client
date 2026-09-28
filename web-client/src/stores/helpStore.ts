import { defineStore } from 'pinia'

// Key written by the old tourStore; migrated once and then removed
const LEGACY_TOUR_SEEN_KEY = 'srTourSeen'

/**
 * Help Store
 *
 * Nothing advice-like opens on its own. The app-bar Help button pulses until
 * it has been opened once, and advice toasts only appear when tips are turned
 * on from the Help menu. Losing this state (e.g. a browser update wiping site
 * storage) only brings the pulse back.
 */
export const useHelpStore = defineStore('help', {
  state: () => ({
    // Persisted: the Help menu has been opened at least once (stops the pulse)
    helpOpened: false,
    // Persisted: show advice toasts
    showTips: false
  }),
  persist: {
    storage: localStorage,
    pick: ['helpOpened', 'showTips'],
    afterHydrate: (ctx) => {
      // Users who already saw the old auto-started tour don't need the pulse
      try {
        if (localStorage.getItem(LEGACY_TOUR_SEEN_KEY) === 'true') {
          ctx.store.$patch((state) => {
            state.helpOpened = true
          })
          // The plugin subscribes to changes only after hydration, so save explicitly
          ctx.store.$persist()
        }
        localStorage.removeItem(LEGACY_TOUR_SEEN_KEY)
      } catch {
        // storage unavailable; nothing to migrate
      }
    }
  },
  actions: {
    markHelpOpened() {
      this.helpOpened = true
    },

    setShowTips(value: boolean) {
      this.showTips = value
    },

    /**
     * Restore first-visit behavior: pulse the Help button, tips off
     */
    resetHelp() {
      this.helpOpened = false
      this.showTips = false
    }
  }
})
