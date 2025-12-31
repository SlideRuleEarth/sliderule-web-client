/**
 * Unit test setup file
 * Mocks modules that cause issues in test environment
 */
import { vi } from 'vitest'

// Mock CSS imports from node_modules
vi.mock('ol-contextmenu/dist/ol-contextmenu.css', () => ({}))
vi.mock('ol-contextmenu', () => ({
  default: class MockContextMenu {
    constructor() {}
    extend() {}
    clear() {}
    close() {}
    enable() {}
    disable() {}
  }
}))

// Mock vue3-openlayers to avoid CSS import issues
vi.mock('vue3-openlayers', () => ({
  default: {},
  Map: {},
  MapControls: {}
}))
vi.mock('vue3-openlayers/vue3-openlayers.css', () => ({}))
