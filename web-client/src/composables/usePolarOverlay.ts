import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Polygon } from 'ol/geom'
import { Feature } from 'ol'
import { Style, Fill } from 'ol/style'
import { fromLonLat } from 'ol/proj'
import { ref } from 'vue'
import type { Map as OLMap } from 'ol'

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

  /**
   * Creates a polygon feature representing the polar region above the specified latitude
   */
  const createPolarPolygon = (projectionName: string, isNorthPole: boolean = true): Feature => {
    const latThreshold = config.latitudeThreshold
    const lonValues: number[] = []
    const latValues: number[] = []

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
      removePolarOverlay(map)
    }

    polarLayer.value = createPolarLayer(projectionName)
    map.addLayer(polarLayer.value as any)
    console.log(`Polar overlay added for projection ${projectionName}`)
  }

  /**
   * Removes the polar overlay from the map
   */
  const removePolarOverlay = (map: OLMap): void => {
    if (polarLayer.value && map) {
      map.removeLayer(polarLayer.value as any)
      polarLayer.value = null
      console.log('Polar overlay removed')
    }
  }

  /**
   * Toggles the visibility of the polar overlay
   */
  const togglePolarOverlay = (): void => {
    isVisible.value = !isVisible.value
    if (polarLayer.value) {
      polarLayer.value.setVisible(isVisible.value)
      console.log(`Polar overlay visibility: ${isVisible.value}`)
    }
  }

  /**
   * Sets the visibility of the polar overlay
   */
  const setPolarOverlayVisibility = (visible: boolean): void => {
    isVisible.value = visible
    if (polarLayer.value) {
      polarLayer.value.setVisible(visible)
    }
  }

  /**
   * Updates the overlay opacity
   */
  const setPolarOverlayOpacity = (opacity: number): void => {
    config.opacity = Math.max(0, Math.min(1, opacity))
    if (polarLayer.value) {
      const style = new Style({
        fill: new Fill({
          color: `${config.color}${Math.round(config.opacity * 255)
            .toString(16)
            .padStart(2, '0')}`
        })
      })
      polarLayer.value.setStyle(style)
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
