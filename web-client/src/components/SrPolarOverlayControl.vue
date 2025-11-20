<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Control } from 'ol/control'
import Checkbox from 'primevue/checkbox'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrPolarOverlayControl')

const polarOverlayControlElement = ref<HTMLElement | null>(null)
const isPolarOverlayVisible = ref(false)

const emit = defineEmits<{
  (_e: 'polar-overlay-control-created', _control: Control): void
  (_e: 'polar-overlay-toggled', _visible: boolean): void
}>()

let customControl: Control | null = null

onMounted(() => {
  if (polarOverlayControlElement.value) {
    customControl = new Control({ element: polarOverlayControlElement.value })
    emit('polar-overlay-control-created', customControl)
  }
})

onUnmounted(() => {
  if (customControl) {
    customControl.setMap(null) // Clean up control on unmount
  }
})

function handlePolarOverlayToggle() {
  logger.debug('handlePolarOverlayToggle', { isPolarOverlayVisible: isPolarOverlayVisible.value })
  emit('polar-overlay-toggled', isPolarOverlayVisible.value)
}
</script>

<template>
  <div ref="polarOverlayControlElement" class="sr-polar-overlay-control ol-unselectable ol-control">
    <div class="polar-overlay-checkbox-container" title="Toggle Polar Region Overlay (lat > 88°)">
      <Checkbox
        v-model="isPolarOverlayVisible"
        :binary="true"
        @change="handlePolarOverlayToggle"
        inputId="polar-overlay-toggle"
        size="small"
      />
      <label for="polar-overlay-toggle" class="polar-overlay-label">Polar 88°+</label>
    </div>
  </div>
</template>

<style scoped>
.sr-polar-overlay-control {
  background-color: transparent;
  border-radius: var(--p-border-radius);
  padding: 0.375rem 0.5rem;
}

.polar-overlay-checkbox-container {
  display: flex;
  align-items: center;
  gap: 0.35rem;
  cursor: pointer;
}

.polar-overlay-label {
  font-size: 0.75rem;
  font-weight: 500;
  color: black;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  margin: 0;
}
</style>
