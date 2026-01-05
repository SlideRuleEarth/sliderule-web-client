<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Control } from 'ol/control'
import { useMapStore } from '@/stores/mapStore'
import Checkbox from 'primevue/checkbox'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrGraticuleControl')

const mapStore = useMapStore()
const graticuleControlElement = ref<HTMLElement | null>(null)
const emit = defineEmits<{
  (_e: 'graticule-control-created', _control: Control): void
}>()

let customControl: Control | null = null

onMounted(() => {
  if (graticuleControlElement.value) {
    customControl = new Control({ element: graticuleControlElement.value })
    emit('graticule-control-created', customControl)
  }
})

onUnmounted(() => {
  if (customControl) {
    customControl.setMap(null) // Clean up control on unmount
  }
})

function handleGraticuleChanged() {
  logger.debug('handleGraticuleChanged', { graticuleState: mapStore.graticuleState })
  mapStore.setGraticuleForMap()
}
</script>

<template>
  <div ref="graticuleControlElement" class="sr-graticule-control ol-unselectable ol-control">
    <div class="graticule-checkbox-container" title="Toggle Graticule">
      <Checkbox
        v-model="mapStore.graticuleState"
        :binary="true"
        @change="handleGraticuleChanged"
        inputId="graticule-toggle"
        size="small"
        :pt="{
          box: { class: 'graticule-checkbox-box' }
        }"
      />
      <label for="graticule-toggle" class="graticule-label">Grid</label>
    </div>
  </div>
</template>

<style scoped>
.sr-graticule-control {
  background: color-mix(in srgb, var(--p-primary-color) 20%, transparent);
  border: 1px solid var(--p-primary-color);
  border-radius: var(--p-border-radius);
  padding: 0.375rem 0.5rem;
}

.sr-graticule-control:hover {
  background: color-mix(in srgb, var(--p-primary-color) 40%, transparent);
}

.graticule-checkbox-container {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  cursor: pointer;
}

.graticule-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: black;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  margin: 0;
}

:deep(.graticule-checkbox-box) {
  background: rgba(255, 255, 255, 0.3);
  border-color: var(--p-primary-color);
}

.graticule-checkbox-container:hover :deep(.graticule-checkbox-box) {
  background: rgba(255, 255, 255, 0.5);
}
</style>
