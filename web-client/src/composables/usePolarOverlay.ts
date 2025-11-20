import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Polygon } from 'ol/geom'
import { Feature } from 'ol'
import { Style, Fill } from 'ol/style'
import { fromLonLat } from 'ol/proj'
import { ref } from 'vue'
import type { Map as OLMap } from 'ol'
import { createLogger } from '@/utils/logger'

const logger = createLogger('usePolarOverlay')

export interface PolarOverlayOptions {
  latitudeThreshold?: number
  color?: string
  opacity?: number
  zIndex?: number
}

const DEFAULT_OPTIONS: Required<PolarOverlayOptions> = {
  latitudeThreshold: 88,
  color: '#FF0000',
  opacity: 0.25,
  zIndex: 100
}

export function usePolarOverlay(options: PolarOverlayOptions = {}) {
  const config = { ...DEFAULT_OPTIONS, ...options }
  const polarLayer = ref<VectorLayer<VectorSource> | null>(null)
  const isVisible = ref(true) // Always visible by default

  logger.debug('Initializing polar overlay', { config })

  /**
   * Creates a polygon feature representing the polar region above the specified latitude
   */
  const createPolarPolygon = (projectionName: string, isNorthPole: boolean = true): Feature => {
    const latThreshold = config.latitudeThreshold
    const lonValues: number[] = []
    const latValues: number[] = []

    logger.debug('Creating polar polygon', {
      projectionName,
      isNorthPole,
      latThreshold
    })

    // Create a circle of points around the pole at the threshold latitude
    const numPoints = 360 // One point per degree for smooth circle
    for (let i = 0; i <= numPoints; i++) {
      const lon = (i * 360) / numPoints - 180 // -180 to 180
      const lat = isNorthPole ? latThreshold : -latThreshold
      lonValues.push(lon)
      latValues.push(lat)
    }

    // Transform coordinates to the target projection
    const coordinates: number[][] = []
    for (let i = 0; i < lonValues.length; i++) {
      const transformed = fromLonLat([lonValues[i], latValues[i]], projectionName)
      coordinates.push(transformed)
    }

    // Close the ring to complete the polygon
    coordinates.push(coordinates[0])

    const polygon = new Polygon([coordinates])
    const feature = new Feature({
      geometry: polygon,
      name: isNorthPole ? 'North Polar Region' : 'South Polar Region'
    })

    logger.debug('Polar polygon created', {
      numCoordinates: coordinates.length,
      featureName: feature.get('name')
    })

    return feature
  }

  /**
   * Creates the vector layer with the polar overlay
   */
  const createPolarLayer = (projectionName: string): VectorLayer<VectorSource> => {
    // Determine if we should show north or south polar region based on projection
    const isNorthPole = !projectionName.includes('3031') // EPSG:3031 is Antarctic

    const feature = createPolarPolygon(projectionName, isNorthPole)

    const source = new VectorSource({
      features: [feature]
    })

    const style = new Style({
      fill: new Fill({
        color: `${config.color}${Math.round(config.opacity * 255)
          .toString(16)
          .padStart(2, '0')}`
      })
    })

    const layer = new VectorLayer({
      source: source,
      style: style,
      zIndex: config.zIndex,
      properties: {
        name: 'polar-overlay',
        title: 'Polar Region Overlay'
      }
    })

    layer.setVisible(isVisible.value)
    return layer
  }

  /**
   * Adds the polar overlay to the map
   */
  const addPolarOverlay = (map: OLMap, projectionName: string): void => {
    if (polarLayer.value) {
      logger.debug('Removing existing polar overlay before adding new one')
      removePolarOverlay(map)
    }

    polarLayer.value = createPolarLayer(projectionName)
    map.addLayer(polarLayer.value as any)
    logger.info('Polar overlay added', {
      projectionName,
      latitudeThreshold: config.latitudeThreshold,
      isVisible: isVisible.value
    })
  }

  /**
   * Removes the polar overlay from the map
   */
  const removePolarOverlay = (map: OLMap): void => {
    if (polarLayer.value && map) {
      map.removeLayer(polarLayer.value as any)
      polarLayer.value = null
      logger.debug('Polar overlay removed from map')
    }
  }

  /**
   * Toggles the visibility of the polar overlay
   */
  const togglePolarOverlay = (): void => {
    isVisible.value = !isVisible.value
    if (polarLayer.value) {
      polarLayer.value.setVisible(isVisible.value)
      logger.debug('Polar overlay visibility toggled', { isVisible: isVisible.value })
    }
  }

  /**
   * Sets the visibility of the polar overlay
   */
  const setPolarOverlayVisibility = (visible: boolean): void => {
    isVisible.value = visible
    if (polarLayer.value) {
      polarLayer.value.setVisible(visible)
      logger.debug('Polar overlay visibility set', { visible })
    }
  }

  /**
   * Updates the overlay opacity
   */
  const setPolarOverlayOpacity = (opacity: number): void => {
    const clampedOpacity = Math.max(0, Math.min(1, opacity))
    config.opacity = clampedOpacity
    if (polarLayer.value) {
      const style = new Style({
        fill: new Fill({
          color: `${config.color}${Math.round(config.opacity * 255)
            .toString(16)
            .padStart(2, '0')}`
        })
      })
      polarLayer.value.setStyle(style)
      logger.debug('Polar overlay opacity updated', { opacity: clampedOpacity })
    }
  }

  return {
    polarLayer,
    isVisible,
    addPolarOverlay,
    removePolarOverlay,
    togglePolarOverlay,
    setPolarOverlayVisibility,
    setPolarOverlayOpacity
  }
}
