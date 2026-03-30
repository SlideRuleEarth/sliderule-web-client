<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, computed } from 'vue'
import { Control } from 'ol/control'
import { getBaseLayersForView } from '@/composables/SrViews'
import { isGoogleLayerAvailable } from '@/composables/SrLayers'
import { useHelperMapStore } from '@/stores/helperMapStore'
import Select from 'primevue/select'
import { useToast } from 'primevue/usetoast'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrHelperBaseLayerControl')

const helperStore = useHelperMapStore()
const toast = useToast()
const baseLayerControlElement = ref<HTMLElement | null>(null)
const previousBaseLayer = ref<string>(helperStore.selectedBaseLayer)
const selectedBaseLayer = ref(helperStore.selectedBaseLayer)

const emit = defineEmits<{
  (_e: 'baselayer-control-created', _control: Control): void
  (_e: 'update-baselayer', _baseLayer: string): void
}>()

let customControl: Control | null = null

const baseLayerOptions = computed(() => getBaseLayersForView(helperStore.selectedView).value)

onMounted(() => {
  if (baseLayerControlElement.value) {
    customControl = new Control({ element: baseLayerControlElement.value })
    emit('baselayer-control-created', customControl)
  }
  previousBaseLayer.value = helperStore.selectedBaseLayer
  selectedBaseLayer.value = helperStore.selectedBaseLayer
})

onUnmounted(() => {
  if (customControl) {
    customControl.setMap(null)
  }
})

watch(selectedBaseLayer, (newLayer) => {
  if (newLayer === 'Google' && !isGoogleLayerAvailable()) {
    logger.warn('Google base layer selected but no API key configured')
    toast.add({
      severity: 'warn',
      summary: 'API Key Required',
      detail:
        'Please add your Google API key in Settings → Map Provider API Keys to use Google satellite imagery.',
      life: 6000
    })
    selectedBaseLayer.value = previousBaseLayer.value
    return
  }

  helperStore.setSelectedBaseLayer(newLayer)
  previousBaseLayer.value = newLayer

  emit('update-baselayer', newLayer)
  logger.debug('updateBaseLayer', { selectedBaseLayer: newLayer })
})

watch(
  () => helperStore.selectedBaseLayer,
  (newLayer) => {
    if (newLayer !== selectedBaseLayer.value) {
      selectedBaseLayer.value = newLayer
    }
  }
)
</script>

<template>
  <div ref="baseLayerControlElement" class="sr-baselayer-control ol-unselectable ol-control">
    <Select
      v-model="selectedBaseLayer"
      :options="baseLayerOptions"
      title="Base Map Layer"
      class="sr-baselayer-select"
      size="small"
    />
  </div>
</template>

<style scoped>
.sr-baselayer-control {
  background-color: transparent;
}

.sr-baselayer-select {
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
