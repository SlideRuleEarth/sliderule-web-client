/**
 * Unit tests for helpStore (issue #1088)
 *
 * The Help button pulses until the menu is first opened, tips are off by
 * default, and the old tourStore's srTourSeen key is migrated once.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { createApp, nextTick } from 'vue'
import { setActivePinia, createPinia } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'
import { useHelpStore } from '@/stores/helpStore'

// Pinia only applies plugins once it is installed on an app
function freshPinia() {
  const pinia = createPinia()
  pinia.use(createPersistedState())
  createApp({}).use(pinia)
  setActivePinia(pinia)
}

describe('helpStore', () => {
  beforeEach(() => {
    localStorage.clear()
    freshPinia()
  })

  it('starts with the pulse on and tips off', () => {
    const helpStore = useHelpStore()
    expect(helpStore.helpOpened).toBe(false)
    expect(helpStore.showTips).toBe(false)
  })

  it('persists opening the Help menu and the tips setting', async () => {
    const helpStore = useHelpStore()
    helpStore.markHelpOpened()
    helpStore.setShowTips(true)
    await nextTick() // $subscribe writes storage asynchronously

    freshPinia()
    const reloaded = useHelpStore()
    expect(reloaded.helpOpened).toBe(true)
    expect(reloaded.showTips).toBe(true)
  })

  it('resetHelp restores first-visit behavior', () => {
    const helpStore = useHelpStore()
    helpStore.markHelpOpened()
    helpStore.setShowTips(true)
    helpStore.resetHelp()
    expect(helpStore.helpOpened).toBe(false)
    expect(helpStore.showTips).toBe(false)
  })

  it('treats the legacy srTourSeen key as Help already opened, then removes it', () => {
    localStorage.setItem('srTourSeen', 'true')
    const helpStore = useHelpStore()
    expect(helpStore.helpOpened).toBe(true)
    expect(localStorage.getItem('srTourSeen')).toBeNull()

    freshPinia()
    expect(useHelpStore().helpOpened).toBe(true)
  })
})
