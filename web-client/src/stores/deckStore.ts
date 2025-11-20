import { defineStore } from 'pinia'
import { ref } from 'vue'
import { SELECTED_LAYER_NAME_PREFIX } from '@/types/SrTypes'
import { createLogger } from '@/utils/logger'

const logger = createLogger('DeckStore')

type DeckViewMode = 'map' | 'orthographic'
type DeckInstance = any

interface DeckStoreApi {
  setDeckInstance(_instance: DeckInstance): void
  getDeckInstance(): DeckInstance | null
  clearDeckInstance(): void
  replaceOrAddLayer(_layer: any, _name: string): boolean
  deleteLayer(_layerId: string): boolean
  deleteSelectedLayer(): boolean
  getLayers(): any[]
  setPointSize(_size: number): void
  getPointSize(): number
  setIsDragging(_value: boolean): void
  getIsDragging(): boolean
  setViewMode(_mode: DeckViewMode): void
  getViewMode(): DeckViewMode
  isOrthographicMode(): boolean
}

export const useDeckStore = defineStore('deck', (): DeckStoreApi => {
  const deckInstance = ref<DeckInstance | null>(null)
  const deckLayers = ref<any[]>([])
  const pointSize = ref(3)
  const isDragging = ref(false)
  const viewMode = ref<DeckViewMode>('map')

  function setDeckInstance(instance: DeckInstance) {
    deckInstance.value = instance
  }

  function getDeckInstance() {
    return deckInstance.value
  }

  function clearDeckInstance() {
    const startTime = performance.now()
    if (deckInstance.value) {
      logger.debug('clearDeckInstance start')
      deckLayers.value = []
      deckInstance.value.setProps({ layers: getLayers() })
      deckInstance.value.finalize()
      deckInstance.value = null
      viewMode.value = 'map'
    } else {
      logger.debug('clearDeckInstance: deckInstance is null')
    }
    const now = performance.now()
    logger.debug('clearDeckInstance completed', { durationMs: now - startTime, endTime: now })
  }

  function setViewMode(mode: DeckViewMode) {
    viewMode.value = mode
  }

  function getViewMode() {
    return viewMode.value
  }

  function isOrthographicMode() {
    return viewMode.value === 'orthographic'
  }

  function replaceOrAddLayer(layer: any, name: string): boolean {
    for (let i = 0; i < deckLayers.value.length; i++) {
      if (deckLayers.value[i].id === name) {
        deckLayers.value[i] = layer
        return true
      }
    }
    deckLayers.value.push(layer)
    return false
  }

  function deleteLayer(layerId: string) {
    for (let i = 0; i < deckLayers.value.length; i++) {
      if (deckLayers.value[i].id === layerId) {
        deckLayers.value.splice(i, 1)
        deckInstance.value?.setProps({ layers: getLayers() })
        return true
      }
    }
    return false
  }

  function deleteSelectedLayer() {
    return deleteLayer(SELECTED_LAYER_NAME_PREFIX)
  }

  function getLayers() {
    return deckLayers.value.map((layer) => layer)
  }

  function setPointSize(size: number) {
    pointSize.value = size
  }

  function getPointSize() {
    return pointSize.value
  }

  function setIsDragging(value: boolean) {
    isDragging.value = value
  }

  function getIsDragging() {
    return isDragging.value
  }

  const api: DeckStoreApi = {
    setDeckInstance,
    getDeckInstance,
    clearDeckInstance,
    replaceOrAddLayer,
    deleteLayer,
    deleteSelectedLayer,
    getLayers,
    setPointSize,
    getPointSize,
    setIsDragging,
    getIsDragging,
    setViewMode,
    getViewMode,
    isOrthographicMode
  }

  return api
})
