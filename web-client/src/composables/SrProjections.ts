import { ref, computed } from 'vue'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrProjections')

export interface SrProjection {
  title: string
  name: string
  label: string
  proj4def: string
  default_zoom?: number
  min_zoom?: number
  max_zoom?: number
  center?: number[]
  extent?: number[]
  bbox: number[]
}
export const srProjections = ref<{ [key: string]: SrProjection }>({
  'EPSG:3857': {
    // This is the default projection for openlayers (coordinate units in meters)
    title: 'Web Mercator',
    label: 'Web Mercator',
    name: 'EPSG:3857',
    proj4def:
      '+proj=merc +a=6378137 +b=6378137 +lat_ts=0.0 +lon_0=0.0 +x_0=0 +y_0=0 +k=1.0 +units=m +nadgrids=@null +wktext +no_defs +type=crs',
    default_zoom: 2,
    min_zoom: 0,
    max_zoom: 19,
    bbox: [-180.0, -85.06, 180.0, 85.06]
  },
  'EPSG:4326': {
    // Web Mercator -- This is the 'standard' projection for web maps (coordinate units in lon lat)
    title: 'WGS 84',
    label: 'WGS 84',
    name: 'EPSG:4326',
    proj4def: '+proj=longlat +datum=WGS84 +no_defs +type=crs',
    default_zoom: 2.85,
    min_zoom: 0, // really 1 because
    max_zoom: 16,
    bbox: [-180.0, -90.0, 180.0, 90.0]
  },
  'EPSG:7912': {
    // ITRF2014 (3D) - used for high-precision geodetic data (e.g., ICESat-2)
    title: 'ITRF2014',
    label: 'ITRF2014',
    name: 'EPSG:7912',
    proj4def: '+proj=longlat +ellps=GRS80 +no_defs +type=crs',
    default_zoom: 2.85,
    min_zoom: 0,
    max_zoom: 16,
    bbox: [-180.0, -90.0, 180.0, 90.0]
  },
  'EPSG:9000': {
    // ITRF2014 (2D) - horizontal component for compound CRS
    title: 'ITRF2014 (2D)',
    label: 'ITRF2014 (2D)',
    name: 'EPSG:9000',
    proj4def: '+proj=longlat +ellps=GRS80 +no_defs +type=crs',
    default_zoom: 2.85,
    min_zoom: 0,
    max_zoom: 16,
    bbox: [-180.0, -90.0, 180.0, 90.0]
  },
  'EPSG:9989': {
    // ITRF2014 (height) - vertical component for compound CRS, use 2D for map display
    title: 'ITRF2014 (height)',
    label: 'ITRF2014 (height)',
    name: 'EPSG:9989',
    proj4def: '+proj=longlat +ellps=GRS80 +no_defs +type=crs',
    default_zoom: 2.85,
    min_zoom: 0,
    max_zoom: 16,
    bbox: [-180.0, -90.0, 180.0, 90.0]
  },
  'EPSG:5936': {
    title: 'North: Alaska Polar Stereographic',
    name: 'EPSG:5936',
    label: 'North Alaska',
    proj4def:
      '+proj=stere +lat_0=90 +lat_ts=90 +lon_0=-150 +k=0.994 +x_0=2000000 +y_0=2000000 +datum=WGS84 +units=m +no_defs +type=crs',
    default_zoom: 4,
    min_zoom: 0,
    max_zoom: 10, // Limited by Arctic Ocean Base tile availability
    extent: [-1390458.63, -1402023.01, 5390458.63, 5402023.01],
    bbox: [-180.0, 60.0, 180.0, 89.9] // minx, miny, maxx, maxy - avoid pole singularity
  },
  'EPSG:3413': {
    title: 'NSIDC Sea Ice Polar Stereographic North',
    name: 'EPSG:3413',
    label: 'North Sea Ice',
    proj4def:
      '+proj=stere +lat_0=90 +lat_ts=70 +lon_0=-45 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs +type=crs',
    default_zoom: 4,
    min_zoom: 0,
    max_zoom: 10, // Limited by Arctic Ocean Base tile availability
    extent: [-3314693.24, -3314693.24, 3314693.24, 3314693.24],
    bbox: [-180.0, 60.0, 180.0, 89.9] // minx, miny, maxx, maxy - avoid pole singularity
  },
  'EPSG:3031': {
    title: 'South: Antarctic Polar Stereographic',
    name: 'EPSG:3031',
    label: 'South',
    proj4def:
      '+proj=stere +lat_0=-90 +lat_ts=-71 +lon_0=0 +x_0=0 +y_0=0 +datum=WGS84 +units=m +k=1 +no_defs',
    default_zoom: 1,
    min_zoom: 0,
    max_zoom: 10, // Limited by Antarctic Imagery tile availability
    extent: [-3299207.53, -3333134.03, 3299207.53, 3333134.03],
    bbox: [-180.0, -89.9, 180.0, -60.0] // minx, miny, maxx, maxy - avoid pole singularity
  }
})

export const useProjectionNames = () => {
  const projectionNames = computed(() =>
    Object.values(srProjections.value)
      .map((p) => p.name)
      .concat(['EPSG:3857', 'EPSG:4326'])
  )
  logger.debug('useProjectionNames projectionNames', { projectionNames: projectionNames.value })
  return projectionNames
}

// export const getDefaultProjection = () => {
//   return srProjections.value['EPSG:3857'];
// };
