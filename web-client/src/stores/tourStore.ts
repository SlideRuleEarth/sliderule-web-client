import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useTourStore = defineStore('tour', () => {
  const hasSeenIntro = ref(false)
  /** Set by MCP tool to request a tour; App.vue watches and starts it. */
  const requestedTour = ref<'quick' | 'long' | null>(null)

  function markSeen() {
    hasSeenIntro.value = true
    localStorage.setItem('srTourSeen', 'true')
  }

  function checkSeen() {
    hasSeenIntro.value = localStorage.getItem('srTourSeen') === 'true'
  }

  function resetTour() {
    hasSeenIntro.value = false
    localStorage.removeItem('srTourSeen')
  }

  /** Called by MCP toolExecutor to trigger a tour from outside the component. */
  function requestTour(type: 'quick' | 'long') {
    requestedTour.value = type
  }

  function clearTourRequest() {
    requestedTour.value = null
  }

  return {
    hasSeenIntro,
    requestedTour,
    markSeen,
    checkSeen,
    resetTour,
    requestTour,
    clearTourRequest
  }
})
