<template>
  <div v-if="hasPolygon" class="sr-rasterize-wrapper" title="Rasterize polygon region">
    <input
      id="rasterize-checkbox"
      v-model="rasterizeEnabled"
      type="checkbox"
      class="sr-custom-checkbox"
      :disabled="disabled"
      @change="handleRasterizeChange"
    />
    <label for="rasterize-checkbox" class="sr-rasterize-label">Rasterize</label>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useReqParamsStore } from '@/stores/reqParamsStore'
import { useGeoJsonStore } from '@/stores/geoJsonStore'
import { isClockwise } from '@/composables/SrTurfUtils'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrRasterize')

defineProps({
  disabled: {
    type: Boolean,
    default: false
  }
})

const emit = defineEmits<{
  (_e: 'rasterize-changed', _enabled: boolean): void
}>()

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

// Watch for geoJsonStore changes (e.g., when loading a previous request with rasterize enabled)
watch(
  () => geoJsonStore.getReqGeoJsonData(),
  (newData) => {
    // If geoJsonData is set, check the rasterize checkbox
    if (newData && hasPolygon.value) {
      rasterizeEnabled.value = true
      logger.debug('Rasterize enabled from geoJsonStore change', { hasGeoJson: !!newData })
    } else if (!newData) {
      rasterizeEnabled.value = false
      logger.debug('Rasterize disabled from geoJsonStore cleared')
    }
  },
  { immediate: true } // Check immediately when component mounts
)

// Handle rasterize checkbox change
function handleRasterizeChange() {
  logger.debug('Rasterize checkbox changed', { enabled: rasterizeEnabled.value })

  if (rasterizeEnabled.value) {
    // Use the RAW drawn polygon (not convex hull) for rasterization
    const poly = reqParamsStore.poly
    if (poly && poly.length > 0) {
      // Validate and ensure counter-clockwise direction
      let validatedPoly = [...poly]

      // If polygon IS clockwise, reverse it to make it counter-clockwise
      if (isClockwise(validatedPoly)) {
        logger.debug('Polygon is clockwise, reversing to make it counter-clockwise')
        validatedPoly = validatedPoly.reverse()
      }

      // Convert to coordinate array [lon, lat]
      const coordinates = validatedPoly.map((point) => [point.lon, point.lat])

      // Ensure polygon is closed (first and last points are the same)
      if (coordinates.length > 0) {
        const first = coordinates[0]
        const last = coordinates[coordinates.length - 1]
        if (first[0] !== last[0] || first[1] !== last[1]) {
          coordinates.push([...first])
          logger.debug('Closed polygon by adding first point at end')
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
      logger.debug('Stored RAW polygon (counter-clockwise) as GeoJSON for rasterization', {
        pointCount: coordinates.length,
        wasReversed: isClockwise(poly)
      })
    }
  } else {
    // Clear the GeoJSON data when unchecked
    geoJsonStore.clearReqGeoJsonData()
    logger.debug('Cleared GeoJSON data (rasterize disabled)')
  }

  // Emit the rasterize state change
  emit('rasterize-changed', rasterizeEnabled.value)
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
  align-items: center;
  gap: 0.25rem;
  cursor: pointer;
}

.sr-rasterize-label {
  font-size: 0.7rem;
  font-weight: 500;
  color: black;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;
  margin: 0;
}

/* Custom checkbox styling - matches Grid toggle */
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

/* Inner checkmark - smaller with padding from border */
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

.sr-custom-checkbox:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.sr-custom-checkbox:disabled + .sr-rasterize-label {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
