<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { Control } from 'ol/control'
import { getDefaultBaseLayerForView, getUniqueViews } from '@/composables/SrViews'
import { useMapStore } from '@/stores/mapStore'
import Select from 'primevue/select'
import { createLogger } from '@/utils/logger'
import { srProjections } from '@/composables/SrProjections'

const logger = createLogger('SrViewControl')

const mapStore = useMapStore()
const viewControlElement = ref<HTMLElement | null>(null)
const selectedView = ref(mapStore.selectedView)
const emit = defineEmits(['view-control-created', 'update-view'])

let customControl: Control | null = null

// Compute tooltip text showing current projection
const projectionTooltip = computed(() => {
  const srViewObj = mapStore.getSrViewObj()
  const projName = srViewObj.projectionName
  const projInfo = srProjections.value[projName]
  if (projInfo) {
    return `${projInfo.label} (${projName})`
  }
  return `${projName}`
})

const viewOptions = computed(() => getUniqueViews().value)

onMounted(() => {
  if (viewControlElement.value) {
    customControl = new Control({ element: viewControlElement.value })
    emit('view-control-created', customControl)
  }
  selectedView.value = mapStore.selectedView
})

onUnmounted(() => {
  if (customControl) {
    customControl.setMap(null)
  }
})

// Watch for local selection changes
watch(selectedView, (newView) => {
  mapStore.setSelectedView(newView)
  const baseLayer = getDefaultBaseLayerForView(newView)
  if (baseLayer.value) {
    mapStore.setSelectedBaseLayer(baseLayer.value)
  } else {
    logger.error('updateView Error: defaulted baseLayer is null')
  }
  logger.debug('updateView', { view: newView })
  emit('update-view')
})

// Watch for external changes to the store
watch(
  () => mapStore.selectedView,
  (newView) => {
    if (newView !== selectedView.value) {
      selectedView.value = newView
    }
  }
)
</script>

<template>
  <div ref="viewControlElement" class="sr-view-control ol-unselectable ol-control">
    <Select
      v-model="selectedView"
      :options="viewOptions"
      :title="projectionTooltip"
      class="sr-view-select"
      size="small"
    />
  </div>
</template>

<style scoped>
.sr-view-control {
  background-color: transparent;
}

.sr-view-select {
  min-width: 8rem;
}

:deep(.p-select) {
  background: color-mix(in srgb, var(--p-primary-color) 20%, transparent);
  border: 1px solid var(--p-primary-color);
  padding: 0 0.25rem;
  min-height: 0;
  height: 1.4rem;
  display: flex;
  align-items: center;
}

:deep(.p-select:hover) {
  background: color-mix(in srgb, var(--p-primary-color) 80%, transparent);
}

:deep(.p-select-label) {
  color: black;
  font-weight: 500;
  font-size: 0.7rem;
  padding: 0;
  display: flex;
  align-items: center;
}

:deep(.p-select-dropdown) {
  color: black;
  width: 1.25rem;
  padding: 0;
  display: flex;
  align-items: center;
}
</style>
