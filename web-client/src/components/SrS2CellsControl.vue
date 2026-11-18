<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { Control } from 'ol/control'
import { useMapStore } from '@/stores/mapStore'
import { VIRIDIS_CSS_GRADIENT, type StatsLegend } from '@/composables/useAtl06StatsOverlay'

const props = defineProps<{
  legend?: StatsLegend | null
  status?: string
}>()

const mapStore = useMapStore()
const controlElement = ref<HTMLElement | null>(null)
const emit = defineEmits<{
  (_e: 's2-cells-control-created', _control: Control): void
}>()

let customControl: Control | null = null

const isChecked = computed({
  get: () => mapStore.s2CellsVisible,
  set: (value: boolean) => mapStore.setS2CellsVisible(value)
})

onMounted(() => {
  if (controlElement.value) {
    customControl = new Control({ element: controlElement.value })
    emit('s2-cells-control-created', customControl)
  }
})

onUnmounted(() => {
  if (customControl) {
    customControl.setMap(null)
  }
})
</script>

<template>
  <div ref="controlElement" class="sr-s2-cells-control ol-unselectable ol-control">
    <div class="checkbox-container" title="Toggle Google S2 cell divisions">
      <input id="s2-cells-toggle" v-model="isChecked" type="checkbox" class="sr-custom-checkbox" />
      <label for="s2-cells-toggle" class="control-label">S2 Cells</label>
    </div>
    <template v-if="isChecked">
      <div v-if="props.legend" class="legend" title="h_li_mean (m), 2nd to 98th percentile in view">
        <span class="control-label">{{ props.legend.min.toFixed(0) }}</span>
        <span class="legend-bar" :style="{ background: VIRIDIS_CSS_GRADIENT }" />
        <span class="control-label">{{ props.legend.max.toFixed(0) }} m</span>
      </div>
      <span v-if="props.status" class="control-label status">{{ props.status }}</span>
    </template>
  </div>
</template>

<style scoped>
.sr-s2-cells-control {
  background: color-mix(in srgb, var(--p-primary-color) 20%, transparent);
  border: 1px solid var(--p-primary-color);
  border-radius: var(--p-border-radius);
  padding: 0 0.35rem;
  height: 1.4rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.legend {
  display: flex;
  align-items: center;
  gap: 0.25rem;
}

.legend-bar {
  display: inline-block;
  width: 5rem;
  height: 0.6rem;
  border-radius: 2px;
}

.status {
  font-style: italic;
}

.sr-s2-cells-control:hover {
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
