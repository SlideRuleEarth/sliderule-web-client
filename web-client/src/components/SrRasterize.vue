<template>
  <div v-if="hasPolygon" class="sr-rasterize-wrapper">
    <Checkbox
      inputId="rasterize-checkbox"
      v-model="rasterizeEnabled"
      @change="handleRasterizeChange"
      :disabled="disabled"
      binary
      size="small"
    />
    <label for="rasterize-checkbox" class="sr-rasterize-label">Rasterize</label>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import Checkbox from 'primevue/checkbox'
import { useReqParamsStore } from '@/stores/reqParamsStore'
import { useGeoJsonStore } from '@/stores/geoJsonStore'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrRasterize')

defineProps({
  disabled: {
    type: Boolean,
    default: false
  }
})

const reqParamsStore = useReqParamsStore()
const geoJsonStore = useGeoJsonStore()

const rasterizeEnabled = ref<boolean>(false)

// Only show rasterize control for polygons drawn with the polygon tool (not box or upload)
const hasPolygon = computed(() => {
  const polygonSource = reqParamsStore.getPolygonSource()
  return reqParamsStore.poly && reqParamsStore.poly.length > 0 && polygonSource === 'polygon'
})

// Watch for polygon changes and update checkbox state
watch(
  () => reqParamsStore.poly,
  () => {
    // If polygon is cleared or source changes, uncheck rasterize
    if (!hasPolygon.value) {
      rasterizeEnabled.value = false
    }
  }
)

// Watch for polygon source changes
watch(
  () => reqParamsStore.getPolygonSource(),
  () => {
    // If source changes to box or cleared, uncheck rasterize
    if (!hasPolygon.value) {
      rasterizeEnabled.value = false
    }
  }
)

// Handle rasterize checkbox change
function handleRasterizeChange() {
  logger.debug('Rasterize checkbox changed', { enabled: rasterizeEnabled.value })

  if (rasterizeEnabled.value) {
    // Convert the drawn polygon to GeoJSON and store it
    const poly = reqParamsStore.poly
    if (poly && poly.length > 0) {
      // Create a GeoJSON FeatureCollection from the polygon
      const coordinates = poly.map((point) => [point.lon, point.lat])
      // Close the polygon if not already closed
      if (coordinates.length > 0) {
        const first = coordinates[0]
        const last = coordinates[coordinates.length - 1]
        if (first[0] !== last[0] || first[1] !== last[1]) {
          coordinates.push([...first])
        }
      }

      const geoJson = {
        type: 'FeatureCollection',
        features: [
          {
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'Polygon',
              coordinates: [coordinates]
            }
          }
        ]
      }

      geoJsonStore.setReqGeoJsonData(geoJson)
      logger.debug('Stored polygon as GeoJSON for rasterization', { geoJson })
    }
  } else {
    // Clear the GeoJSON data when unchecked
    geoJsonStore.clearReqGeoJsonData()
    logger.debug('Cleared GeoJSON data (rasterize disabled)')
  }
}

// Expose reset function for parent components
defineExpose({
  reset() {
    if (rasterizeEnabled.value) {
      rasterizeEnabled.value = false
      geoJsonStore.clearReqGeoJsonData()
      logger.debug('Reset rasterize control')
    }
  }
})
</script>

<style scoped>
.sr-rasterize-wrapper {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  gap: 0.25rem;
  padding: 0.125rem 0.25rem;
}

.sr-rasterize-label {
  font-size: 0.625rem;
  color: var(--p-primary-400);
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  line-height: 1;
}
</style>
