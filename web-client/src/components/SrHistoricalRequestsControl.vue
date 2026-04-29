<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { Control } from 'ol/control'
import { useMapStore } from '@/stores/mapStore'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrHistoricalRequestsControl')

const mapStore = useMapStore()
const controlElement = ref<HTMLElement | null>(null)
const emit = defineEmits<{
  (_e: 'historical-requests-control-created', _control: Control): void
}>()

let customControl: Control | null = null

const isChecked = computed({
  get: () => mapStore.historicalPolysVisible,
  set: (value: boolean) => {
    mapStore.historicalPolysVisible = value
  }
})

onMounted(() => {
  if (controlElement.value) {
    customControl = new Control({ element: controlElement.value })
    emit('historical-requests-control-created', customControl)
  }
})

onUnmounted(() => {
  if (customControl) {
    customControl.setMap(null)
  }
})

function handleVisibilityChanged() {
  logger.debug('handleVisibilityChanged', {
    historicalPolysVisible: mapStore.historicalPolysVisible
  })
  mapStore.setHistoricalPolysVisible(mapStore.historicalPolysVisible)
}
</script>

<template>
  <div ref="controlElement" class="sr-historical-requests-control ol-unselectable ol-control">
    <div class="checkbox-container" title="Toggle historical request polygons & reqIds">
      <input
        id="historical-requests-toggle"
        v-model="isChecked"
        type="checkbox"
        class="sr-custom-checkbox"
        @change="handleVisibilityChanged"
      />
      <label for="historical-requests-toggle" class="control-label">Requests</label>
    </div>
  </div>
</template>

<style scoped>
.sr-historical-requests-control {
  background: color-mix(in srgb, var(--p-primary-color) 20%, transparent);
  border: 1px solid var(--p-primary-color);
  border-radius: var(--p-border-radius);
  padding: 0 0.35rem;
  height: 1.4rem;
  display: flex;
  align-items: center;
}

.sr-historical-requests-control:hover {
  background: color-mix(in srgb, var(--p-primary-color) 80%, transparent);
}

.checkbox-container {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  cursor: pointer;
}

.control-label {
  font-size: 0.7rem;
  font-weight: 500;
  color: black;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  margin: 0;
}

.sr-custom-checkbox {
  appearance: none;
  -webkit-appearance: none;
  width: 0.85rem;
  height: 0.85rem;
  border: 1px solid var(--p-primary-color);
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.3);
  cursor: pointer;
  position: relative;
  margin: 0;
  flex-shrink: 0;
}

.sr-custom-checkbox:hover {
  background: rgba(255, 255, 255, 0.5);
}

.sr-custom-checkbox:checked {
  background: rgba(255, 255, 255, 0.5);
}

.sr-custom-checkbox:checked::after {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -60%) rotate(45deg);
  width: 0.2rem;
  height: 0.4rem;
  border: solid var(--p-primary-color);
  border-width: 0 2px 2px 0;
}
</style>
