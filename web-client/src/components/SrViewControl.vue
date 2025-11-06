<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { Control } from 'ol/control'
import { useMapStore } from '@/stores/mapStore'
import SrMenu from './SrMenu.vue'
import { createLogger } from '@/utils/logger'
import { srProjections } from '@/composables/SrProjections'
import { getDefaultBaseLayerForProjection, getLayer } from '@/composables/SrLayers'
import { get as getProjection, getTransform } from 'ol/proj.js'
import { applyTransform } from 'ol/extent'
import View from 'ol/View'
import type OLlayer from 'ol/layer/Layer'

const logger = createLogger('SrViewControl')

const mapStore = useMapStore()
const viewControlElement = ref(null)
const emit = defineEmits(['view-control-created', 'update-view'])

// Create menu options from srProjections with user-friendly labels
const projectionMenuOptions = computed(() => {
  return Object.values(srProjections.value)
    .filter(proj => !proj.name.startsWith('EPSG:7912') && !proj.name.startsWith('EPSG:9')) // Filter out ITRF variants for now
    .map(proj => proj.label)
})

// Compute tooltip text showing current projection
const projectionTooltip = computed(() => {
  const srViewObj = mapStore.getSrViewObj()
  if (!srViewObj) {
    return 'No projection selected'
  }
  const projName = srViewObj.projectionName
  const projInfo = srProjections.value[projName]
  if (projInfo) {
    return `${projInfo.label} (${projName})`
  }
  return `${projName}`
})

onMounted(() => {
  if (viewControlElement.value) {
    const customControl = new Control({ element: viewControlElement.value })
    emit('view-control-created', customControl)
  }
})

// Get projection name from label
function getProjectionNameFromLabel(label: string): string | null {
  const proj = Object.values(srProjections.value).find(p => p.label === label)
  return proj ? proj.name : null
}

// Get label from projection name
function getLabelFromProjectionName(projectionName: string): string {
  const proj = srProjections.value[projectionName]
  return proj ? proj.label : projectionName
}

function updateView() {
  const selectedLabel = mapStore.getSelectedView()
  const projectionName = getProjectionNameFromLabel(selectedLabel)

  if (!projectionName) {
    logger.error('updateView: Could not find projection for label', { selectedLabel })
    return
  }

  const map = mapStore.getMap()
  if (!map) {
    logger.error('updateView: map is null')
    return
  }

  const srProjObj = srProjections.value[projectionName]
  if (!srProjObj) {
    logger.error('updateView: projection config not found', { projectionName })
    return
  }

  try {
    // Get the default base layer for this projection
    const defaultBaseLayer = getDefaultBaseLayerForProjection(projectionName)
    if (defaultBaseLayer) {
      mapStore.setSelectedBaseLayer(defaultBaseLayer)
    } else {
      logger.warn('updateView: No compatible base layer found for projection', { projectionName })
    }

    // Get the projection object
    let newProj = getProjection(projectionName)
    if (!newProj) {
      logger.error('updateView: Could not get projection', { projectionName })
      return
    }

    // Remove all existing layers
    map.getAllLayers().forEach((layer: OLlayer) => {
      map.removeLayer(layer)
    })

    // Add the base layer
    if (defaultBaseLayer) {
      const layer = getLayer(projectionName, defaultBaseLayer)
      if (layer) {
        map.addLayer(layer)
      } else {
        logger.error('updateView: No layer found', {
          projectionName,
          baseLayerTitle: defaultBaseLayer
        })
      }
    }

    // Set up extent and worldExtent for the projection
    const fromLonLatFn = getTransform('EPSG:4326', newProj)
    let extent = newProj.getExtent()

    if (extent === undefined || extent === null) {
      if (srProjObj.extent) {
        extent = srProjObj.extent
        newProj.setExtent(extent)
      } else {
        let bbox = [...srProjObj.bbox]
        if (srProjObj.bbox[0] > srProjObj.bbox[2]) {
          bbox[2] += 360
        }
        if (newProj.getUnits() === 'degrees') {
          extent = bbox
        } else {
          extent = applyTransform(bbox, fromLonLatFn, undefined, undefined)
        }
        newProj.setExtent(extent)
      }
    }

    let worldExtent = newProj.getWorldExtent()
    if (
      worldExtent === undefined ||
      worldExtent === null ||
      worldExtent.some((value: number) => !Number.isFinite(value))
    ) {
      let bbox = [...srProjObj.bbox]
      if (srProjObj.bbox[0] > srProjObj.bbox[2]) {
        bbox[2] += 360
      }
      if (newProj.getUnits() === 'degrees') {
        worldExtent = bbox
      } else {
        worldExtent = applyTransform(bbox, fromLonLatFn, undefined, undefined)
      }
      if (worldExtent.some((value: number) => !Number.isFinite(value))) {
        logger.warn('worldExtent is still invalid after transformation, falling back to extent')
        worldExtent = extent
        newProj.setWorldExtent(worldExtent)
      } else {
        newProj.setWorldExtent(worldExtent)
      }
    }

    // Get center from projection config or calculate from extent
    let center = srProjObj.center || [
      (extent[0] + extent[2]) / 2,
      (extent[1] + extent[3]) / 2
    ]

    // Check if this is a polar projection
    const isPolarProjection =
      projectionName === 'EPSG:5936' ||
      projectionName === 'EPSG:3413' ||
      projectionName === 'EPSG:3031'

    // Create new View with the selected projection
    const newView = new View({
      projection: newProj,
      extent: isPolarProjection ? undefined : extent,
      center: center,
      zoom: srProjObj.default_zoom,
      minZoom: srProjObj.min_zoom,
      maxZoom: srProjObj.max_zoom
    })

    map.setView(newView)
    mapStore.setExtentToRestore(extent)

    logger.debug('updateView: Successfully updated map view', {
      projectionName,
      label: srProjObj.label,
      baseLayer: defaultBaseLayer
    })

    emit('update-view')
  } catch (error) {
    logger.error('updateView failed', {
      projectionName,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}
</script>

<template>
  <div ref="viewControlElement" class="sr-view-control ol-unselectable ol-control">
    <SrMenu
      v-model="mapStore.selectedView"
      @change="updateView"
      :menuOptions="projectionMenuOptions"
      :getSelectedMenuItem="mapStore.getSelectedView"
      :setSelectedMenuItem="mapStore.setSelectedView"
      :tooltipText="projectionTooltip"
    />
  </div>
</template>

<style scoped>
.ol-control.sr-view-control .select-view select {
  color: white;
  background-color: black;
  border-radius: var(--p-border-radius);
}

.sr-view-control .sr-view-button-box {
  display: flex; /* Aligns children (input and icon) in a row */
  flex-direction: row; /* Stack children horizonally */
  align-items: center; /* Centers children vertically */
  justify-content: center; /* Centers children horizontally */
  margin: 0px;
}
</style>
