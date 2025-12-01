import { ref } from 'vue'
import TileLayer from 'ol/layer/Tile.js'
import ImageLayer from 'ol/layer/Image.js'
import TileWMS from 'ol/source/TileWMS' // Import the TileWMS module
import ImageArcGISRest from 'ol/source/ImageArcGISRest.js'
import type ImageSource from 'ol/source/Image.js'
import { useMapStore } from '@/stores/mapStore.js'
import { useGoogleApiKeyStore } from '@/stores/googleApiKeyStore'
import type { ServerType } from 'ol/source/wms.js'
import { XYZ } from 'ol/source.js'
import TileGrid from 'ol/tilegrid/TileGrid.js'
import type OLMap from 'ol/Map.js'
// import { srViews } from "./SrViews"; // Unused import
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrLayers')

// Cache for NASA GIBS layer metadata (layerId -> metadata)
const gibsMetadataCache: Map<string, { dateRange?: string; ongoing?: boolean; fetchedAt: number }> =
  new Map()
const GIBS_CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

/**
 * Fetch NASA GIBS layer metadata to get available date information
 * @param layerId - The GIBS layer identifier (e.g., 'VIIRS_SNPP_CorrectedReflectance_TrueColor')
 * @returns Promise with layer metadata including date range
 */
export const fetchGibsLayerMetadata = async (
  layerId: string
): Promise<{ ongoing: boolean; startDate?: string; endDate?: string } | null> => {
  // Check cache first
  const cached = gibsMetadataCache.get(layerId)
  if (cached && Date.now() - cached.fetchedAt < GIBS_CACHE_TTL) {
    return { ongoing: cached.ongoing ?? false }
  }

  try {
    const response = await fetch(
      `https://gibs.earthdata.nasa.gov/layer-metadata/v1.0/${layerId}.json`
    )
    if (!response.ok) {
      logger.warn(`Failed to fetch GIBS metadata for ${layerId}: ${response.status}`)
      return null
    }
    const data = await response.json()
    const metadata = {
      ongoing: data.ongoing ?? false,
      startDate: data.startDate,
      endDate: data.endDate,
      fetchedAt: Date.now()
    }
    gibsMetadataCache.set(layerId, metadata)
    return metadata
  } catch (error) {
    logger.error(`Error fetching GIBS metadata for ${layerId}:`, { error })
    return null
  }
}

/**
 * Get the best date to use for a NASA GIBS layer
 * For ongoing layers, uses 3 days ago (to account for processing delay)
 * For polar regions, uses a summer date to avoid polar night gaps
 * @param layerId - The GIBS layer identifier
 * @param preferSummer - Use a fixed summer date for polar regions
 * @param hemisphere - 'north' for Arctic (July), 'south' for Antarctic (January)
 */
export const getGibsDate = async (
  layerId: string,
  preferSummer: boolean = false,
  hemisphere: 'north' | 'south' = 'north'
): Promise<string> => {
  const now = new Date()
  const year = now.getFullYear()

  // For polar regions, prefer a summer date to ensure visibility
  if (preferSummer) {
    if (hemisphere === 'north') {
      return `${year}-07-15` // Arctic summer
    } else {
      return `${year}-01-15` // Antarctic summer
    }
  }

  // Try to fetch metadata to confirm layer is ongoing
  const metadata = await fetchGibsLayerMetadata(layerId)

  if (metadata?.ongoing) {
    // For ongoing layers, use 3 days ago to account for processing delay
    const date = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
    const yyyy = date.getFullYear()
    const mm = String(date.getMonth() + 1).padStart(2, '0')
    const dd = String(date.getDate()).padStart(2, '0')
    return `${yyyy}-${mm}-${dd}`
  }

  // Fallback: use 3 days ago anyway
  const date = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * Get a GIBS date synchronously (without API call) - uses calculated date
 * @param preferSummer - Use a fixed summer date for polar regions
 * @param hemisphere - 'north' for Arctic (July), 'south' for Antarctic (January)
 */
export const getGibsDateSync = (
  preferSummer: boolean = false,
  hemisphere: 'north' | 'south' = 'north'
): string => {
  const now = new Date()
  const year = now.getFullYear()

  if (preferSummer) {
    return hemisphere === 'north' ? `${year}-07-15` : `${year}-01-15`
  }

  // Use 3 days ago for near-real-time data
  const date = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000)
  const yyyy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

// Cache for EOX Sentinel-2 Cloudless available years
let sentinel2CloudlessYears: number[] | null = null
let sentinel2FetchPromise: Promise<number[]> | null = null

/**
 * Fetch available Sentinel-2 Cloudless years from EOX WMTS capabilities
 * @returns Promise with array of available years (e.g., [2016, 2017, ..., 2024])
 */
export const fetchSentinel2CloudlessYears = async (): Promise<number[]> => {
  // Return cached result if available
  if (sentinel2CloudlessYears) {
    return sentinel2CloudlessYears
  }

  // Return existing promise if fetch is in progress
  if (sentinel2FetchPromise) {
    return sentinel2FetchPromise
  }

  sentinel2FetchPromise = (async () => {
    try {
      const response = await fetch('https://tiles.maps.eox.at/wmts/1.0.0/WMTSCapabilities.xml')
      if (!response.ok) {
        logger.warn(`Failed to fetch EOX WMTS capabilities: ${response.status}`)
        return getDefaultSentinel2Years()
      }

      const text = await response.text()
      const years: number[] = []

      // Parse layer identifiers to extract years
      // Pattern: s2cloudless-YYYY_3857 or s2cloudless_3857 (for 2016)
      const layerMatches = text.matchAll(/s2cloudless(?:-(\d{4}))?_3857/g)
      for (const match of layerMatches) {
        const year = match[1] ? parseInt(match[1]) : 2016 // No suffix means 2016
        if (!years.includes(year)) {
          years.push(year)
        }
      }

      // Sort years in descending order (newest first)
      years.sort((a, b) => b - a)

      if (years.length === 0) {
        logger.warn('No Sentinel-2 Cloudless layers found in capabilities')
        return getDefaultSentinel2Years()
      }

      sentinel2CloudlessYears = years
      logger.debug('Fetched Sentinel-2 Cloudless years:', { years })
      return years
    } catch (error) {
      logger.error('Error fetching EOX WMTS capabilities:', { error })
      return getDefaultSentinel2Years()
    } finally {
      sentinel2FetchPromise = null
    }
  })()

  return sentinel2FetchPromise
}

/**
 * Get default Sentinel-2 Cloudless years (fallback if fetch fails)
 */
const getDefaultSentinel2Years = (): number[] => {
  const currentYear = new Date().getFullYear()
  // Return last 5 years as fallback
  return [currentYear, currentYear - 1, currentYear - 2, currentYear - 3, currentYear - 4]
}

/**
 * Get the latest available Sentinel-2 Cloudless year synchronously
 * Uses current year as default, actual availability checked via fetchSentinel2CloudlessYears
 */
export const getLatestSentinel2Year = (): number => {
  if (sentinel2CloudlessYears && sentinel2CloudlessYears.length > 0) {
    return sentinel2CloudlessYears[0]
  }
  return new Date().getFullYear()
}

/**
 * Generate a Sentinel-2 Cloudless layer configuration for a given year
 */
export const createSentinel2CloudlessLayer = (year: number): SrLayer => ({
  title: `Sentinel-2 Cloudless ${year}`,
  type: 'xyz',
  isBaseLayer: true,
  url: `https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-${year}_3857/default/g/{z}/{y}/{x}.jpg`,
  attributionKey: 'sentinel2_eox',
  source_projection: 'EPSG:3857',
  allowed_reprojections: ['EPSG:3857', 'EPSG:4326'],
  init_visibility: true,
  init_opacity: 1,
  max_zoom: 14
})

/**
 * Add Sentinel-2 Cloudless layers dynamically after fetching available years
 * Call this on app initialization to populate all available years
 */
export const initSentinel2CloudlessLayers = async (): Promise<void> => {
  const years = await fetchSentinel2CloudlessYears()

  for (const year of years) {
    const layerTitle = `Sentinel-2 Cloudless ${year}`
    // Only add if not already present
    if (!layers.value[layerTitle]) {
      layers.value[layerTitle] = createSentinel2CloudlessLayer(year)
    }
  }

  logger.debug('Initialized Sentinel-2 Cloudless layers:', {
    count: years.length,
    years
  })
}

export const srAttributions = {
  esri: 'Tiles © Esri contributors',
  openStreetMap: '© OpenStreetMap contributors',
  google: 'Map data © Google',
  usgs: 'USGS National Map 3D Elevation Program (3DEP)',
  usgs_antartic:
    'U.S. Geological Survey (USGS), British Antarctic Survey (BAS), National Aeronautics and Space Administration (NASA)',
  glims: 'GLIMS Glacier Data © Contributors',
  nasa_gibs: 'NASA GIBS',
  ahocevar: 'Ahocevar',
  sentinel2_eox:
    'Sentinel-2 cloudless - https://s2maps.eu by EOX IT Services GmbH (Contains modified Copernicus Sentinel data)'
}

export interface SrLayer {
  type: string
  isBaseLayer: boolean
  url: string
  title: string // unique title for the layer
  attributionKey: keyof typeof srAttributions // Use the keys from the srAttributions object
  source_projection: string // if view is different from source an automatic reprojection will be attempted
  allowed_reprojections: string[] // List of allowed reprojections
  layerName?: string
  serverType?: ServerType //  WMS server type
  init_visibility: boolean
  init_opacity: number
  max_zoom?: number // Maximum zoom level for this layer
}

// EPSG:3031 (Antarctic Polar Stereographic) tile grid configuration
// Based on ArcGIS Antarctic Imagery service metadata
// Limited to zoom 0-10 (tiles not available beyond zoom 10)
const antarticTileGrid = new TileGrid({
  origin: [-3.369955099203e7, 3.369955101703e7],
  resolutions: [
    238810.813354, // Zoom 0
    119405.406677, // Zoom 1
    59702.7033384999, // Zoom 2
    29851.3516692501, // Zoom 3
    14925.675834625, // Zoom 4
    7462.83791731252, // Zoom 5
    3731.41895865626, // Zoom 6
    1865.70947932813, // Zoom 7
    932.854739664063, // Zoom 8
    466.427369832032, // Zoom 9
    233.213684916016 // Zoom 10 - last resolution, enables overzooming beyond this
  ],
  tileSize: [256, 256]
})

// EPSG:5936 (Alaska Polar Stereographic) tile grid configuration
// Based on ArcGIS Arctic Ocean Base/Reference service metadata
// Limited to zoom 0-10 for overzooming (tiles not available everywhere beyond zoom 10)
const arcticTileGrid = new TileGrid({
  origin: [-28567784.109255, 32567784.109255],
  resolutions: [
    238810.813354,
    119405.406677,
    59702.7033384999,
    29851.3516692501,
    14925.675834625,
    7462.83791731252,
    3731.41895865626,
    1865.70947932813,
    932.854739664063,
    466.427369832032,
    233.213684916016 // Zoom 10 - last resolution, enables overzooming beyond this
  ],
  tileSize: [256, 256]
})

// EPSG:3413 (NSIDC Sea Ice Polar Stereographic North) tile grid configuration
// Based on ArcGIS Arctic Imagery service metadata
const nsidcTileGrid = new TileGrid({
  origin: [-4194304, 4194304],
  resolutions: [16384, 8192, 4096, 2048, 1024, 512, 256, 128, 64, 32, 16, 8, 4, 2, 1, 0.5],
  tileSize: [256, 256]
})

// NASA GIBS EPSG:3413 tile grid configuration for 500m TileMatrixSet
// Origin and resolutions from NASA GIBS GetCapabilities
const nasaGibs500mArcticTileGrid = new TileGrid({
  origin: [-4194304, 4194304],
  resolutions: [8192.0, 4096.0, 2048.0, 1024.0, 512.0],
  tileSize: [512, 512]
})

// NASA GIBS EPSG:3413 tile grid configuration for 250m TileMatrixSet
const nasaGibs250mArcticTileGrid = new TileGrid({
  origin: [-4194304, 4194304],
  resolutions: [8192.0, 4096.0, 2048.0, 1024.0, 512.0, 256.0],
  tileSize: [512, 512]
})

// NASA GIBS EPSG:3031 tile grid configuration for 250m TileMatrixSet (Antarctic)
const nasaGibs250mAntarcticTileGrid = new TileGrid({
  origin: [-4194304, 4194304],
  resolutions: [8192.0, 4096.0, 2048.0, 1024.0, 512.0, 256.0],
  tileSize: [512, 512]
})

export const layers = ref<{ [key: string]: SrLayer }>({
  'Esri World Topo': {
    title: 'Esri World Topo',
    type: 'xyz',
    isBaseLayer: true,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    attributionKey: 'esri',
    source_projection: 'EPSG:3857',
    allowed_reprojections: ['EPSG:3857', 'EPSG:4326'],
    init_visibility: true,
    init_opacity: 1,
    max_zoom: 19
  },
  OpenStreet: {
    title: 'OpenStreet',
    type: 'xyz',
    isBaseLayer: true,
    url: 'https://{a-c}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attributionKey: 'openStreetMap',
    source_projection: 'EPSG:3857',
    allowed_reprojections: ['EPSG:4326', 'EPSG:3857'],
    init_visibility: true,
    init_opacity: 1,
    max_zoom: 19
  },
  Google: {
    title: 'Google',
    type: 'google', // Special type for Google Maps API
    isBaseLayer: true,
    url: 'https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}', // Official Google Map Tiles API
    attributionKey: 'google',
    source_projection: 'EPSG:3857',
    allowed_reprojections: ['EPSG:3857', 'EPSG:4326'],
    init_visibility: true,
    init_opacity: 1,
    max_zoom: 22
  },
  'USGS 3DEP': {
    title: 'USGS 3DEP',
    type: 'wms',
    serverType: 'mapserver',
    isBaseLayer: false,
    url: 'https://elevation.nationalmap.gov/arcgis/services/3DEPElevation/ImageServer/WMSServer?',
    attributionKey: 'usgs',
    source_projection: 'EPSG:3857',
    allowed_reprojections: ['EPSG:3857', 'EPSG:4326'],
    layerName: '3DEPElevation:Hillshade Gray',
    init_visibility: false, // Note: This layer is not visible by default
    init_opacity: 0.2
  },
  'Nasa Shaded Relief': {
    title: 'Nasa Shaded Relief',
    type: 'xyz',
    isBaseLayer: false,
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/ASTER_GDEM_Greyscale_Shaded_Relief/default/GoogleMapsCompatible_Level12/{z}/{y}/{x}.jpg',
    attributionKey: 'nasa_gibs',
    source_projection: 'EPSG:3857',
    allowed_reprojections: ['EPSG:3857'],
    init_visibility: false,
    init_opacity: 0.5
  },
  'Arctic Ocean Base': {
    title: 'Arctic Ocean Base',
    type: 'xyz',
    isBaseLayer: true,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Polar/Arctic_Ocean_Base/MapServer/tile/{z}/{y}/{x}',
    attributionKey: 'esri',
    source_projection: 'EPSG:5936',
    allowed_reprojections: ['EPSG:5936', 'EPSG:4326'],
    init_visibility: true,
    init_opacity: 1,
    max_zoom: 23
  },
  'Arctic Imagery NSIDC': {
    title: 'Arctic Imagery NSIDC',
    type: 'xyz',
    isBaseLayer: true,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Polar/Arctic_Imagery/MapServer/tile/{z}/{y}/{x}',
    attributionKey: 'esri',
    source_projection: 'EPSG:5936', // Actual projection of ArcGIS Arctic Imagery tiles
    allowed_reprojections: ['EPSG:5936', 'EPSG:3413'], // Allow use in both projections
    init_visibility: true,
    init_opacity: 1,
    max_zoom: 23
  },
  'NASA GIBS HLS Arctic': {
    title: 'NASA GIBS HLS Arctic',
    type: 'xyz',
    isBaseLayer: false,
    // NASA GIBS Harmonized Landsat Sentinel-2 (HLS) - 30m resolution Arctic imagery
    // Using summer date for Arctic to ensure sunlight
    url: `https://gibs.earthdata.nasa.gov/wmts/epsg3413/best/HLS_S30_Nadir_BRDF_Adjusted_Reflectance/default/${getGibsDateSync(true, 'north')}/250m/{z}/{y}/{x}.jpg`,
    attributionKey: 'nasa_gibs',
    source_projection: 'EPSG:3413',
    allowed_reprojections: ['EPSG:3413'],
    init_visibility: false,
    init_opacity: 0.7,
    max_zoom: 15
  },
  'NASA Blue Marble Arctic': {
    title: 'NASA Blue Marble Arctic',
    type: 'xyz',
    isBaseLayer: true,
    // NASA GIBS Blue Marble Next Generation - monthly global imagery mosaic
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3413/best/BlueMarble_NextGeneration/default/2004-12-01/500m/{z}/{y}/{x}.jpeg',
    attributionKey: 'nasa_gibs',
    source_projection: 'EPSG:3413',
    allowed_reprojections: ['EPSG:3413'],
    init_visibility: true,
    init_opacity: 1,
    max_zoom: 8
  },
  'NASA Blue Marble Shaded Relief Arctic': {
    title: 'NASA Blue Marble Shaded Relief Arctic',
    type: 'xyz',
    isBaseLayer: true,
    // NASA GIBS Blue Marble with shaded relief and bathymetry
    url: 'https://gibs.earthdata.nasa.gov/wmts/epsg3413/best/BlueMarble_ShadedRelief_Bathymetry/default/2004-12-01/500m/{z}/{y}/{x}.jpeg',
    attributionKey: 'nasa_gibs',
    source_projection: 'EPSG:3413',
    allowed_reprojections: ['EPSG:3413'],
    init_visibility: true,
    init_opacity: 1,
    max_zoom: 8
  },
  'NASA MODIS Arctic': {
    title: 'NASA MODIS Arctic',
    type: 'xyz',
    isBaseLayer: true,
    // NASA GIBS MODIS Terra Corrected Reflectance - daily true color imagery
    // Using summer date (July) when Arctic has sunlight - winter dates show no data due to polar night
    url: `https://gibs.earthdata.nasa.gov/wmts/epsg3413/best/MODIS_Terra_CorrectedReflectance_TrueColor/default/${getGibsDateSync(true, 'north')}/250m/{z}/{y}/{x}.jpg`,
    attributionKey: 'nasa_gibs',
    source_projection: 'EPSG:3413',
    allowed_reprojections: ['EPSG:3413'],
    init_visibility: true,
    init_opacity: 1,
    max_zoom: 5
  },
  'Artic Reference': {
    title: 'Artic Reference',
    type: 'xyz',
    isBaseLayer: false,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Polar/Arctic_Ocean_Reference/MapServer/tile/{z}/{y}/{x}',
    attributionKey: 'esri',
    source_projection: 'EPSG:5936',
    allowed_reprojections: ['EPSG:5936'],
    init_visibility: true,
    init_opacity: 1,
    max_zoom: 23
  },
  'Antarctic Imagery': {
    title: 'Antarctic Imagery',
    type: 'xyz',
    isBaseLayer: true,
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Polar/Antarctic_Imagery/MapServer/tile/{z}/{y}/{x}',
    attributionKey: 'esri',
    source_projection: 'EPSG:3031',
    allowed_reprojections: ['EPSG:3031'],
    init_visibility: true,
    init_opacity: 1,
    max_zoom: 10
  },
  LIMA: {
    title: 'LIMA',
    type: 'wms',
    serverType: 'mapserver',
    isBaseLayer: true,
    url: 'https://nimbus.cr.usgs.gov/arcgis/services/Antarctica/USGS_EROS_Antarctica_Reference/MapServer/WmsServer',
    attributionKey: 'usgs_antartic',
    source_projection: 'EPSG:3031',
    allowed_reprojections: ['EPSG:3031'],
    layerName: 'LIMA_Full_1km',
    init_visibility: true,
    init_opacity: 1
  },
  MOA: {
    title: 'MOA',
    type: 'wms',
    serverType: 'mapserver',
    isBaseLayer: true,
    url: 'https://nimbus.cr.usgs.gov/arcgis/services/Antarctica/USGS_EROS_Antarctica_Reference/MapServer/WmsServer',
    attributionKey: 'usgs_antartic',
    source_projection: 'EPSG:3031',
    allowed_reprojections: ['EPSG:3031'],
    layerName: 'MOA_125_HP1_090_230',
    init_visibility: true,
    init_opacity: 1
  },
  REMA: {
    title: 'REMA',
    type: 'imagearcgisrest',
    isBaseLayer: false,
    url: 'https://elevation2.arcgis.com/arcgis/rest/services/Polar/AntarcticDEM/ImageServer',
    attributionKey: 'usgs_antartic',
    source_projection: 'EPSG:3031',
    allowed_reprojections: ['EPSG:3031'],
    init_visibility: true,
    init_opacity: 0.99
  },
  RadarMosaic: {
    title: 'RadarMosaic',
    type: 'wms',
    serverType: 'mapserver',
    isBaseLayer: true,
    url: 'https://nimbus.cr.usgs.gov/arcgis/services/Antarctica/USGS_EROS_Antarctica_Reference/MapServer/WmsServer',
    attributionKey: 'usgs_antartic',
    source_projection: 'EPSG:3031',
    allowed_reprojections: ['EPSG:3031'],
    layerName: 'Radarsat_Mosaic',
    init_visibility: true,
    init_opacity: 1
  },
  'GLIMS Glacier': {
    title: 'GLIMS Glacier',
    type: 'wms',
    isBaseLayer: false,
    url: 'https://www.glims.org/geoserver/GLIMS/wms',
    attributionKey: 'glims',
    source_projection: 'EPSG:4326',
    allowed_reprojections: ['EPSG:3857', 'EPSG:4326'],
    layerName: 'GLIMS_GLACIER',
    init_visibility: false,
    init_opacity: 0.2
  },
  // Sentinel-2 Cloudless imagery from EOX - high resolution (10m) yearly composites
  // Additional years (2016-2023) are loaded dynamically via initSentinel2CloudlessLayers()
  // This default layer uses current year; call initSentinel2CloudlessLayers() on app init for all available years
  [`Sentinel-2 Cloudless ${new Date().getFullYear()}`]: createSentinel2CloudlessLayer(
    new Date().getFullYear()
  ),
  // NASA VIIRS True Color imagery - daily satellite imagery
  // Date is calculated dynamically (3 days ago) to ensure availability
  'NASA VIIRS True Color': {
    title: 'NASA VIIRS True Color',
    type: 'xyz',
    isBaseLayer: true,
    url: `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${getGibsDateSync()}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`,
    attributionKey: 'nasa_gibs',
    source_projection: 'EPSG:3857',
    allowed_reprojections: ['EPSG:3857', 'EPSG:4326'],
    init_visibility: true,
    init_opacity: 1,
    max_zoom: 9
  },
  'NASA VIIRS Arctic': {
    title: 'NASA VIIRS Arctic',
    type: 'xyz',
    isBaseLayer: true,
    // NASA GIBS VIIRS True Color for Arctic - using summer date when Arctic has sunlight
    url: `https://gibs.earthdata.nasa.gov/wmts/epsg3413/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${getGibsDateSync(true, 'north')}/250m/{z}/{y}/{x}.jpg`,
    attributionKey: 'nasa_gibs',
    source_projection: 'EPSG:3413',
    allowed_reprojections: ['EPSG:3413'],
    init_visibility: true,
    init_opacity: 1
  },
  'NASA VIIRS Antarctic': {
    title: 'NASA VIIRS Antarctic',
    type: 'xyz',
    isBaseLayer: true,
    // NASA GIBS VIIRS True Color for Antarctic - using January date (Antarctic summer)
    url: `https://gibs.earthdata.nasa.gov/wmts/epsg3031/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/${getGibsDateSync(true, 'south')}/250m/{z}/{y}/{x}.jpg`,
    attributionKey: 'nasa_gibs',
    source_projection: 'EPSG:3031',
    allowed_reprojections: ['EPSG:3031'],
    init_visibility: true,
    init_opacity: 1
  }
})

// Check if Google Maps layer is available (has valid API key)
export const isGoogleLayerAvailable = (): boolean => {
  const googleApiKeyStore = useGoogleApiKeyStore()
  return googleApiKeyStore.hasValidKey()
}

export const getSrLayersForCurrentView = () => {
  const mapStore = useMapStore()
  const srViewObj = mapStore.getSrViewObj()
  const projName = srViewObj.projectionName
  return Object.values(layers.value).filter((layer) =>
    layer.allowed_reprojections.includes(projName)
  )
}

export const getSrLayersForCurrentProjection = () => {
  const mapStore = useMapStore()
  return Object.values(layers.value).filter((layer) =>
    layer.allowed_reprojections.includes(mapStore.getSrViewObj().projectionName)
  )
}

export const getSrBaseLayersForCurrentView = () => {
  //logger.debug('getSrBaseLayersForCurrentView', view);
  const allLayersList = getSrLayersForCurrentView()
  const layerList = Object.values(allLayersList).filter((layer) => layer.isBaseLayer)
  //logger.debug('getSrBaseLayersForCurrentView', layerList);
  return layerList
}

export const addLayersForCurrentView = (map: OLMap, projectionName: string) => {
  //logger.debug('--------------------addLayersForCurrentView--------------------');
  try {
    const srLayersForView = getSrLayersForCurrentView()
    srLayersForView.forEach((srLayerForView) => {
      if (!srLayerForView.isBaseLayer) {
        // base layer is managed by baseLayerControl
        //logger.debug(`adding non base layer:`,srLayerForView.title);
        const newLayer = getLayer(projectionName, srLayerForView.title)
        if (newLayer) {
          if (map) {
            logger.debug('addLayersForCurrentView adding layer', { title: srLayerForView.title })
            map.addLayer(newLayer)
          } else {
            logger.error('addLayersForCurrentView map not available', { map })
          }
        } else {
          logger.error(
            `addLayersForCurrentView SKIPPING - No layer found for title: ${srLayerForView.title} projection: ${projectionName}`
          )
        }
      } else {
        logger.debug('addLayersForCurrentView SKIPPING - base layer', {
          title: srLayerForView.title
        })
      }
    })
  } catch (error) {
    logger.error('addLayersForCurrentView error', {
      error: error instanceof Error ? error.message : String(error)
    })
  }
}

export const getLayer = (
  projectionName: string,
  title: string
): TileLayer | ImageLayer<ImageSource> | undefined => {
  //logger.debug(`getLayer ${title}`);

  const srLayer = Object.values(layers.value).find((layer) => layer.title === title)
  let layerInstance
  if (srLayer) {
    // Temporarily disable caching to debug black screen issue
    // const mapStore = useMapStore()
    // const cachedLayer = mapStore.getLayerFromCache(projectionName, title)
    const cachedLayer = null
    let lname = srLayer.title
    if (srLayer.isBaseLayer) {
      lname = 'Base Layer'
    } else {
      lname = srLayer.layerName || srLayer.title
    }
    const localTileLayerOptions: any = {
      title: title,
      name: lname,
      opacity: srLayer.init_opacity,
      visible: srLayer.init_visibility
    }

    // Set maxZoom on layer if specified in layer definition
    // EXCEPT for NASA GIBS layers - they need source maxZoom for tile limiting but no layer maxZoom for overzooming
    const isNasaGibsLayer = srLayer.url.includes('gibs.earthdata.nasa.gov')
    if (srLayer.max_zoom !== undefined && !isNasaGibsLayer) {
      localTileLayerOptions.maxZoom = srLayer.max_zoom
      logger.debug('[SrLayers] Setting layer maxZoom:', {
        layerTitle: title,
        layerMaxZoom: srLayer.max_zoom,
        sourceProjection: srLayer.source_projection
      })
    }
    if (cachedLayer) {
      layerInstance = cachedLayer // Return the cached layer if it exists
      logger.debug('Using cached layer', { title, projectionName })
    } else {
      if (srLayer.type === 'wmts') {
        logger.debug('WMTS Layer TBD')
      } else if (srLayer.type === 'wms') {
        // Handle WMS layers
        //logger.debug(`WMS serverType?:${srLayer.serverType} Layer: url: ${srLayer.url} layer:${srLayer.layerName} proj:${mapStore.getProjection()}`);
        layerInstance = new TileLayer({
          // if we specify it, the layer will be reprojected to the view's projection
          // if we don't specify it we assume it is in the view's projection
          // note: projection is defaulted to the View's projection
          source: new TileWMS({
            url: srLayer.url,
            attributions: srAttributions[srLayer.attributionKey],
            params: {
              LAYERS: srLayer.layerName, // the WMS layer name(s) to load
              TILED: true
              //'CRS': srLayer.source_projection, // TBD verify this !!!!
            },
            //projection:srLayer.source_projection,  // TBD verify this !!!!
            serverType: srLayer.serverType, //  WMS server type
            //crossOrigin: '', // Consider CORS policies
            crossOrigin: 'anonymous' // Consider CORS policies
            //referrerPolicy: 'no-referrer',
          }),
          ...localTileLayerOptions
        })
      } else if (srLayer.type === 'xyz') {
        //logger.debug(`XYZ ${srLayer.serverType} Layer: url: ${srLayer.url} layer:${(srLayer.layerName || srLayer.title)} proj:${mapStore.getProjection()}`);
        // Disable tile wrapping for polar projections
        const isPolarProjection =
          srLayer.source_projection === 'EPSG:5936' ||
          srLayer.source_projection === 'EPSG:3413' ||
          srLayer.source_projection === 'EPSG:3031'
        const isNasaGibs = srLayer.url.includes('gibs.earthdata.nasa.gov')
        const xyzOptions: any = {
          url: srLayer.url,
          //extent: mapStore.extent,
          projection: srLayer.source_projection,
          attributions: srAttributions[srLayer.attributionKey],
          wrapX: !isPolarProjection && !isNasaGibs, // Don't wrap tiles for polar projections or NASA GIBS
          crossOrigin: 'anonymous' // Required for NASA GIBS
        }

        // NASA GIBS layers - allow natural tile loading and overzooming
        // Don't set maxZoom on source or layer - OpenLayers will handle 404s gracefully
        // and automatically scale available tiles when zooming beyond their availability
        if (isNasaGibs) {
          logger.debug('[SrLayers] Configuring NASA GIBS layer for natural overzooming:', {
            layerTitle: title,
            sourceProjection: srLayer.source_projection,
            url: srLayer.url,
            note: 'No maxZoom set - tiles beyond availability will be scaled automatically'
          })
        }
        // Add custom tile grid for EPSG:5936 to ensure proper tile loading
        if (srLayer.source_projection === 'EPSG:5936') {
          xyzOptions.tileGrid = arcticTileGrid
          // Set source maxZoom to 10 to enable overzooming beyond tile availability
          // The layer maxZoom (23) controls view limits, but tiles are only requested up to zoom 10
          // When zooming beyond 10, OpenLayers will scale/stretch the zoom 10 tiles
          xyzOptions.maxZoom = 10
          logger.debug('[SrLayers] EPSG:5936 configured for overzooming:', {
            layerTitle: title,
            layerMaxZoom: srLayer.max_zoom,
            sourceMaxZoom: 10,
            tileGridResolutions: arcticTileGrid.getResolutions().length,
            overzooming: 'enabled beyond zoom 10'
          })
        }
        // Add custom tile grid for EPSG:3413 ArcGIS tiles only (not for OSM tiles)
        if (srLayer.source_projection === 'EPSG:3413' && srLayer.url.includes('arcgisonline')) {
          xyzOptions.tileGrid = nsidcTileGrid
          // Set maxZoom on source if defined in layer
          if (srLayer.max_zoom !== undefined) {
            xyzOptions.maxZoom = srLayer.max_zoom
            logger.debug('[SrLayers] Setting EPSG:3413 source maxZoom:', {
              layerTitle: title,
              sourceMaxZoom: srLayer.max_zoom,
              tileGridResolutions: nsidcTileGrid.getResolutions().length
            })
          }
        }
        // Add custom tile grid for NASA GIBS EPSG:3413 layers
        // Use 250m grid for layers with 250m in URL, otherwise use 500m grid
        if (srLayer.source_projection === 'EPSG:3413' && isNasaGibs) {
          const is250m = srLayer.url.includes('/250m/')
          xyzOptions.tileGrid = is250m ? nasaGibs250mArcticTileGrid : nasaGibs500mArcticTileGrid
          logger.debug('[SrLayers] NASA GIBS EPSG:3413 configured:', {
            layerTitle: title,
            tileMatrixSet: is250m ? '250m' : '500m',
            tileGridResolutions: xyzOptions.tileGrid.getResolutions().length,
            maxZoom: srLayer.max_zoom
          })
        }
        // Add custom tile grid for NASA GIBS EPSG:3031 layers (Antarctic)
        if (srLayer.source_projection === 'EPSG:3031' && isNasaGibs) {
          xyzOptions.tileGrid = nasaGibs250mAntarcticTileGrid
          logger.debug('[SrLayers] NASA GIBS EPSG:3031 configured:', {
            layerTitle: title,
            tileMatrixSet: '250m',
            tileGridResolutions: xyzOptions.tileGrid.getResolutions().length,
            maxZoom: srLayer.max_zoom
          })
        }
        // Add custom tile grid for EPSG:3031 to ensure proper tile loading
        // Skip tile grid for NASA GIBS layers as they have their own tile grid above
        if (srLayer.source_projection === 'EPSG:3031' && !isNasaGibs) {
          xyzOptions.tileGrid = antarticTileGrid
          // Set source maxZoom to 10 to enable overzooming beyond tile availability
          // The layer maxZoom (defined in layer config) controls view limits
          // When zooming beyond 10, OpenLayers will scale/stretch the zoom 10 tiles
          xyzOptions.maxZoom = 10
          logger.debug('[SrLayers] EPSG:3031 configured for overzooming:', {
            layerTitle: title,
            layerMaxZoom: srLayer.max_zoom,
            sourceMaxZoom: 10,
            tileGridResolutions: antarticTileGrid.getResolutions().length,
            overzooming: 'enabled beyond zoom 10'
          })
        }

        // Create XYZ source with tile load debugging for polar projections
        const xyzSource = new XYZ(xyzOptions)

        // Add tile load debugging for NASA GIBS layers
        if (isNasaGibs) {
          xyzSource.on('tileloaderror', (event: any) => {
            const tile = event.tile
            const tileCoord = tile.getTileCoord()
            logger.error('[SrLayers] NASA GIBS Tile load error:', {
              layerTitle: title,
              zoom: tileCoord[0],
              x: tileCoord[1],
              y: tileCoord[2],
              url: tile.src_
            })
          })

          // Log successful tile loads
          xyzSource.on('tileloadstart', (event: any) => {
            const tile = event.tile
            const tileCoord = tile.getTileCoord()
            logger.debug('[SrLayers] NASA GIBS Tile load start:', {
              layerTitle: title,
              zoom: tileCoord[0],
              x: tileCoord[1],
              y: tileCoord[2],
              url: tile.src_
            })
          })

          xyzSource.on('tileloadend', (event: any) => {
            const tile = event.tile
            const tileCoord = tile.getTileCoord()
            logger.debug('[SrLayers] NASA GIBS Tile loaded successfully:', {
              layerTitle: title,
              zoom: tileCoord[0],
              x: tileCoord[1],
              y: tileCoord[2]
            })
          })
        }

        // Add tile load debugging for EPSG:5936
        if (srLayer.source_projection === 'EPSG:5936') {
          xyzSource.on('tileloaderror', (event: any) => {
            const tile = event.tile
            const tileCoord = tile.getTileCoord()
            logger.error('[SrLayers] EPSG:5936 Tile load error:', {
              layerTitle: title,
              zoom: tileCoord[0],
              x: tileCoord[1],
              y: tileCoord[2],
              url: tile.src_
            })
          })

          // Log tile URL requests at zoom > 7
          const originalTileUrlFunction = xyzSource.getTileUrlFunction()
          xyzSource.setTileUrlFunction((tileCoord: any, pixelRatio: any, projection: any) => {
            const zoom = tileCoord[0]
            const url = originalTileUrlFunction?.call(xyzSource, tileCoord, pixelRatio, projection)
            if (zoom > 7) {
              logger.debug('[SrLayers] EPSG:5936 Requesting tile:', {
                zoom,
                x: tileCoord[1],
                y: tileCoord[2],
                url
              })
            }
            return url
          })
        }

        layerInstance = new TileLayer({
          source: xyzSource,
          ...localTileLayerOptions
        })

        // Log NASA GIBS layer creation details
        if (isNasaGibs) {
          logger.debug('[SrLayers] Created NASA GIBS TileLayer:', {
            layerTitle: title,
            visible: layerInstance.getVisible(),
            opacity: layerInstance.getOpacity(),
            zIndex: layerInstance.getZIndex(),
            sourceProjection: srLayer.source_projection,
            hasSource: !!layerInstance.getSource()
          })
        }
      } else if (srLayer.type === 'google') {
        // Handle Google Maps API with user-provided API key
        const googleApiKeyStore = useGoogleApiKeyStore()

        if (!googleApiKeyStore.hasValidKey()) {
          logger.warn('[SrLayers] Google layer requested but no valid API key configured')
          // Return undefined - the UI will prompt the user for an API key
          return undefined
        }

        const apiKey = googleApiKeyStore.getApiKey()
        const sessionToken = googleApiKeyStore.getSessionToken()

        // Session should exist from when the key was validated
        // If not, the user needs to re-enter their key in Settings
        if (!sessionToken) {
          logger.error(
            '[SrLayers] No Google session token available - please re-validate your API key in Settings'
          )
          return undefined
        }

        // Build the tile URL with session token and API key
        const googleTileUrl = `https://tile.googleapis.com/v1/2dtiles/{z}/{x}/{y}?session=${sessionToken}&key=${apiKey}`

        const googleXyzOptions: any = {
          url: googleTileUrl,
          projection: srLayer.source_projection,
          attributions: srAttributions[srLayer.attributionKey],
          wrapX: true,
          crossOrigin: 'anonymous',
          maxZoom: srLayer.max_zoom
        }

        const googleXyzSource = new XYZ(googleXyzOptions)

        // Add error handling for tile load errors
        googleXyzSource.on('tileloaderror', (event: any) => {
          const tile = event.tile
          const tileCoord = tile.getTileCoord()
          logger.error('[SrLayers] Google tile load error:', {
            zoom: tileCoord[0],
            x: tileCoord[1],
            y: tileCoord[2]
          })
        })

        layerInstance = new TileLayer({
          source: googleXyzSource,
          ...localTileLayerOptions
        })

        logger.debug('[SrLayers] Created Google TileLayer with official API:', {
          layerTitle: title,
          hasSession: !!sessionToken
        })
      } else if (srLayer.type === 'imagearcgisrest') {
        // Handle ArcGIS Image Services (dynamic image layers, not tiled)
        const imageLayerOptions: any = {
          title: title,
          name: lname,
          opacity: srLayer.init_opacity,
          visible: srLayer.init_visibility
        }

        layerInstance = new ImageLayer({
          source: new ImageArcGISRest({
            url: srLayer.url,
            attributions: srAttributions[srLayer.attributionKey],
            projection: srLayer.source_projection,
            params: {
              // For elevation services, use hillshade rendering function
              renderingRule: {
                rasterFunction: 'Hillshade Elevation Tinted'
              }
            },
            crossOrigin: 'anonymous'
          }),
          ...imageLayerOptions
        })
        logger.debug('[SrLayers] Created ImageArcGISRest layer:', {
          layerTitle: title,
          sourceProjection: srLayer.source_projection
        })
        // } else if(srLayer.type === "ArcGisRest"){
        //   logger.debug(`XYZ ${srLayer.serverType} Layer: url: ${srLayer.url} layer:${(srLayer.layerName || srLayer.title)} proj:${mapStore.getProjection()}`);
        //   const arcGisRestOptions = {
        //     url: srLayer.url,
        //     //extent: mapStore.extent,
        //     attributions: srAttributions[srLayer.attributionKey],
        //   }
        //   layerInstance = new TileLayer({
        //     source: new TileArcGISRest(arcGisRestOptions),
        //     ... localTileLayerOptions
        //   });
      }
      if (layerInstance) {
        //logger.debug('Caching layer', title);
        // Temporarily disable caching to debug black screen issue
        // mapStore.addLayerToCache(projectionName, title, layerInstance)
      }
    }
    //logger.debug (`getLayer returning: ${lname} isBaseLayer:${srLayer.isBaseLayer} title:${title}`);
  } else {
    logger.debug('Layer not found with this title', { title })
  }
  //logger.debug('getLayer returning:', layerInstance);
  return layerInstance
}
