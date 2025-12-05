import { ref, computed } from 'vue'

export interface SrOverlayConfig {
  layerName: string
  opacity: number
  visible?: boolean // defaults to true if not specified
}

export interface SrView {
  hide: boolean
  view: string
  projectionName: string
  baseLayerName: string
  overlays?: SrOverlayConfig[] // optional preset overlays with opacities
}

// srViews is now an object with keys as view names
export const srViews = ref<{ [key: string]: SrView }>({
  'Global Mercator Esri': {
    hide: false,
    view: 'Global Mercator',
    projectionName: 'EPSG:3857',
    baseLayerName: 'Esri World Topo'
  },
  'Global Mercator Esri Imagery': {
    hide: false,
    view: 'Global Mercator',
    projectionName: 'EPSG:3857',
    baseLayerName: 'Esri World Imagery'
  },
  'Global Mercator Google': {
    hide: false,
    view: 'Global Mercator',
    projectionName: 'EPSG:3857',
    baseLayerName: 'Google Satellite'
  },
  'Global Mercator OSM': {
    hide: false,
    view: 'Global Mercator',
    projectionName: 'EPSG:3857',
    baseLayerName: 'OpenStreetMap Standard'
  },
  'Global Mercator NASA Topo': {
    hide: false,
    view: 'Global Mercator',
    projectionName: 'EPSG:3857',
    baseLayerName: 'NASA Blue Marble Topo'
  },
  'Global Mercator EOX Terrain': {
    hide: false,
    view: 'Global Mercator',
    projectionName: 'EPSG:3857',
    baseLayerName: 'EOX Terrain Light',
    overlays: [
      { layerName: 'NASA ASTER Color Relief', opacity: 0.5 },
      { layerName: 'NASA ASTER Color Index', opacity: 0.4 }
    ]
  },
  'Global Mercator OpenTopo': {
    hide: false,
    view: 'Global Mercator',
    projectionName: 'EPSG:3857',
    baseLayerName: 'OpenTopoMap'
  },
  'Global Sentinel-2': {
    hide: false,
    view: 'Global Mercator',
    projectionName: 'EPSG:3857',
    baseLayerName: 'Sentinel-2 Cloudless'
  },
  'Global VIIRS': {
    hide: false,
    view: 'Global Mercator',
    projectionName: 'EPSG:3857',
    baseLayerName: 'NASA VIIRS True Color'
  },
  'North Alaska': {
    hide: false,
    view: 'North Alaska',
    projectionName: 'EPSG:5936',
    baseLayerName: 'Arctic Ocean Base'
  },
  'North Sea Ice': {
    hide: false,
    view: 'North Sea Ice',
    projectionName: 'EPSG:3413',
    baseLayerName: 'Arctic Imagery NSIDC'
  },
  'North Sea Ice Blue Marble': {
    hide: false,
    view: 'North Sea Ice',
    projectionName: 'EPSG:3413',
    baseLayerName: 'NASA Blue Marble Arctic'
  },
  'North Sea Ice Shaded Relief': {
    hide: false,
    view: 'North Sea Ice',
    projectionName: 'EPSG:3413',
    baseLayerName: 'NASA Blue Marble Shaded Relief Arctic'
  },
  'North Sea Ice MODIS': {
    hide: false,
    view: 'North Sea Ice',
    projectionName: 'EPSG:3413',
    baseLayerName: 'NASA MODIS Arctic'
  },
  'North Sea Ice VIIRS': {
    hide: false,
    view: 'North Sea Ice',
    projectionName: 'EPSG:3413',
    baseLayerName: 'NASA VIIRS Arctic'
  },
  'South Antarctic Imagery': {
    hide: false,
    view: 'South',
    projectionName: 'EPSG:3031',
    baseLayerName: 'Antarctic Imagery'
  },
  'South LIMA': {
    hide: false,
    view: 'South',
    projectionName: 'EPSG:3031',
    baseLayerName: 'LIMA'
  },
  'South MOA': {
    hide: false,
    view: 'South',
    projectionName: 'EPSG:3031',
    baseLayerName: 'MOA'
  },
  'South RadarMosaic': {
    hide: false,
    view: 'South',
    projectionName: 'EPSG:3031',
    baseLayerName: 'RadarMosaic'
  },
  'South VIIRS': {
    hide: false,
    view: 'South',
    projectionName: 'EPSG:3031',
    baseLayerName: 'NASA VIIRS Antarctic'
  }
})

export const useViewNames = () => {
  const viewsNames = computed(() =>
    Object.keys(srViews.value).filter((key) => !srViews.value[key].hide)
  )
  return viewsNames
}

export const findViewByName = (name: string) => {
  return computed(() => (srViews.value[name]?.hide ? null : srViews.value[name]))
}

export const getDefaultView = () => {
  const defaultView = srViews.value['Global Mercator Esri']
  return defaultView
}

export const getUniqueViews = () => {
  const uniqueViews = computed(() => {
    const viewSet = new Set<string>(
      Object.values(srViews.value)
        .filter((srView) => !srView.hide)
        .map((srView) => srView.view)
    )
    return Array.from(viewSet)
  })

  return uniqueViews
}

export const getUniqueBaseLayersByView = (view: string) => {
  const uniqueBaseLayers = computed(() => {
    const baseLayerSet = new Set<string>(
      Object.values(srViews.value)
        .filter((srView) => srView.view === view && !srView.hide)
        .map((srView) => srView.baseLayerName)
    )
    return Array.from(baseLayerSet)
  })

  return uniqueBaseLayers
}

export const getBaseLayersForView = (currentView: string) => {
  const baseLayers = computed(() => {
    return Object.values(srViews.value)
      .filter((srView) => srView.view === currentView && !srView.hide)
      .map((srView) => srView.baseLayerName)
  })

  return baseLayers
}

export const getDefaultBaseLayerForView = (currentView: string) => {
  const defaultBaseLayer = computed(() => {
    const baseLayers = getBaseLayersForView(currentView).value
    return baseLayers.length > 0 ? baseLayers[0] : null
  })

  return defaultBaseLayer
}

export const findSrView = (viewName: string, baseLayerName: string) => {
  const srView = computed(() => {
    return (
      Object.values(srViews.value).find(
        (srView) =>
          srView.view === viewName && srView.baseLayerName === baseLayerName && !srView.hide
      ) ||
      Object.values(srViews.value).find((srView) => srView.view === viewName) ||
      null
    )
  })

  return srView
}

export const findSrViewKey = (viewName: string, baseLayerName: string) => {
  return computed(() => {
    const entry = Object.entries(srViews.value).find(
      ([, srView]) =>
        srView.view === viewName && srView.baseLayerName === baseLayerName && !srView.hide
    )
    return entry ? entry[0] : null // Return the key if found, otherwise null
  })
}

/**
 * Apply overlay settings from a view configuration to the map layers
 * This sets visibility and opacity for overlay layers specified in the view
 * @param map - OpenLayers map instance
 * @param srView - The view configuration containing overlay settings
 */
export const applyViewOverlays = (map: any, srView: SrView | null) => {
  if (!map || !srView?.overlays || srView.overlays.length === 0) {
    return
  }

  const layers = map.getLayers().getArray()

  for (const overlayConfig of srView.overlays) {
    const layer = layers.find((l: any) => l.get('title') === overlayConfig.layerName)
    if (layer) {
      layer.setOpacity(overlayConfig.opacity)
      layer.setVisible(overlayConfig.visible !== false) // default to true
    }
  }
}

/**
 * Get the overlay configuration for a view
 * @param viewName - The view name
 * @param baseLayerName - The base layer name
 * @returns The overlay configuration array or undefined
 */
export const getViewOverlays = (
  viewName: string,
  baseLayerName: string
): SrOverlayConfig[] | undefined => {
  const view = findSrView(viewName, baseLayerName).value
  return view?.overlays
}
