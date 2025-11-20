import { defineStore } from 'pinia'

export const useDebugStore = defineStore('debugStore', {
  state: () => ({
    enableSpotPatternDetails: false as boolean,
    useMetersForMousePosition: false as boolean,
    // Restore debug settings from localStorage, default to false
    showZoomDebug: localStorage.getItem('showZoomDebug') === 'true',
    showDebugPanel: localStorage.getItem('showDebugPanel') === 'true'
  }),
  actions: {
    setEnableSpotPatternDetails(enable: boolean = true) {
      this.enableSpotPatternDetails = enable
    },
    getEnableSpotPatternDetails() {
      return this.enableSpotPatternDetails
    },
    setShowZoomDebug(show: boolean = true) {
      this.showZoomDebug = show
      // Persist to localStorage
      localStorage.setItem('showZoomDebug', String(show))
    },
    getShowZoomDebug() {
      return this.showZoomDebug
    },
    setShowDebugPanel(show: boolean = true) {
      this.showDebugPanel = show
      // Persist to localStorage
      localStorage.setItem('showDebugPanel', String(show))
    },
    getShowDebugPanel() {
      return this.showDebugPanel
    }
  }
})
