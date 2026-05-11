import type { SrMenuItem, SrMultiSelectTextItem } from '@/types/SrTypes'
import { defineStore } from 'pinia'
import { createLogger } from '@/utils/logger'
import { useSrToastStore } from '@/stores/srToastStore'

const logger = createLogger('RasterParamsStore')
const ASSETS_FETCHED_AT_KEY = 'rasterAssetsLastFetchedAt'
const ASSETS_LIST_KEY = 'rasterAssetsList'

// Built-in fallback raster asset list, used only when both the live fetch from
// /source/assets fails AND no cached list is available in localStorage.
// Mirrored against `rasters` in the /source/assets response, sorted alphabetically.
// Last synced from sliderule.slideruleearth.io on 2026-05-08.
const FALLBACK_ASSET_NAMES = [
  '3dep1m',
  'arcticdem-mosaic',
  'arcticdem-strips',
  'bluetopo-bathy',
  'esa-copernicus-30meter',
  'esa-worldcover-10meter',
  'gebco-s3',
  'gedil3-canopy',
  'gedil3-canopy-stddev',
  'gedil3-counts',
  'gedil3-elevation',
  'gedil3-elevation-stddev',
  'gedil4b',
  'gedtm-30meter',
  'gedtm-dfm',
  'gedtm-std',
  'landsat-hls',
  'merit-s3',
  'meta-globalcanopy-1meter',
  'nisar-L2-geoff',
  'rema-mosaic',
  'rema-strips',
  'usgs3dep-10meter-dem',
  'usgs3dep-1meter-dem',
  'user-url-raster'
]

function loadCachedAssetNames(): string[] | null {
  const raw = localStorage.getItem(ASSETS_LIST_KEY)
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.every((s) => typeof s === 'string')) {
      return parsed
    }
  } catch {
    // Fall through to null on parse error
  }
  return null
}

function namesToMenuItems(names: string[]): SrMenuItem[] {
  return names.map((r) => ({ name: r, value: r }))
}

export type RasterParams = {
  key: string
  asset: string
  algorithm: string
  force_single_sample: string // Sampling mode: 'first', 'last', 'min', 'max'
  radius: number
  zonalStats: boolean
  withFlags: boolean
  t0: Date | null // t0 is optional, can be null if not set
  t1: Date | null // t1 is optional, can be null if not set
  substring: string
  closestTime: Date | null // closestTime is optional, can be null if not set
  use_poi_time: boolean
  catalog: string
  bands: string[]
  slope_aspect: boolean
  slope_scale_length: number
}
export const RasterParamsCols = [
  { field: 'key', header: 'Key' },
  { field: 'asset', header: 'asset' },
  { field: 'algorithm', header: 'algorithm' },
  { field: 'force_single_sample', header: 'force_single_sample' },
  { field: 'radius', header: 'radius' },
  { field: 'zonalStats', header: 'zonalStats' },
  { field: 'withFlags', header: 'withFlags' },
  { field: 't0', header: 't0' },
  { field: 't1', header: 't1' },
  { field: 'substring', header: 'substring' },
  { field: 'closestTime', header: 'closestTime' },
  { field: 'catalog', header: 'catalog' },
  { field: 'use_poi_time', header: 'use_poi_time' },
  { field: 'bands', header: 'bands' },
  { field: 'slope_aspect', header: 'slope_aspect' },
  { field: 'slope_scale_length', header: 'slope_scale_length' }
]

export const useRasterParamsStore = defineStore('rasterParams', {
  state: () => ({
    dataTable: [] as RasterParams[], // Array to hold a sets of raster parameters
    key: '' as RasterParams['key'],
    asset: '' as RasterParams['asset'],
    algorithm: '' as RasterParams['algorithm'],
    force_single_sample: 'first' as RasterParams['force_single_sample'], // Sampling mode: 'first', 'last', 'min', 'max'
    useForceSingleSample: true as boolean, // Flag to indicate if force_single_sample is enabled
    forceSingleSampleOptions: [
      { name: 'first', value: 'first' },
      { name: 'last', value: 'last' },
      { name: 'min', value: 'min' },
      { name: 'max', value: 'max' }
    ] as SrMenuItem[],
    radius: 0 as RasterParams['radius'],
    zonalStats: false as RasterParams['zonalStats'],
    withFlags: false as RasterParams['withFlags'],
    flags: [] as boolean[], // Array to hold flags if needed
    useTimeFilter: false as boolean, // Flag to indicate if time filter is used
    // Default values for time filter
    t0: new Date() as RasterParams['t0'],
    t1: new Date() as RasterParams['t1'],
    substring: '' as RasterParams['substring'],
    useClosetTime: false as boolean, // Flag to indicate if closest time filter is used
    closestTime: new Date() as RasterParams['closestTime'],
    use_poi_time: false as RasterParams['use_poi_time'],
    catalog: '' as RasterParams['catalog'],
    useBands: false as boolean, // Flag to indicate if bands are used
    bands: [] as RasterParams['bands'],
    slope_aspect: false as RasterParams['slope_aspect'],
    useSlopeScaleLength: false as boolean, // Flag to indicate if slope_scale_length is used
    slope_scale_length: 0 as RasterParams['slope_scale_length'],
    // Initial raster asset list. Prefers (in order):
    //   1. The cached list from a prior successful /source/assets fetch
    //      (kept in localStorage so degraded-server scenarios still show
    //      the user's last known good list).
    //   2. The built-in FALLBACK_ASSET_NAMES — only hit on a brand-new
    //      machine that has never successfully fetched.
    // setAssetOptions() refreshes this from the live endpoint on app load.
    assetOptions: namesToMenuItems(loadCachedAssetNames() ?? FALLBACK_ASSET_NAMES),
    // Timestamp of the last successful /source/assets fetch (ms since epoch),
    // restored from localStorage so we can surface a useful "stale list" warning
    // even on the first failed fetch of a new session.
    lastAssetsFetchedAt: (() => {
      const stored = localStorage.getItem(ASSETS_FETCHED_AT_KEY)
      const n = stored ? Number(stored) : NaN
      return Number.isFinite(n) ? n : null
    })() as number | null,
    algorithmOptions: [
      { name: 'NearestNeighbour', value: 'NearestNeighbour' },
      { name: 'Bilinear', value: 'Bilinear' },
      { name: 'Cubic', value: 'Cubic' },
      { name: 'CubicSpline', value: 'CubicSpline' },
      { name: 'Lanczos', value: 'Lanczos' },
      { name: 'Average', value: 'Average' },
      { name: 'Mode', value: 'Mode' },
      { name: 'Gauss', value: 'Gauss' }
    ] as SrMenuItem[],
    bandOptions: [
      { name: 'B1', value: 'B1' },
      { name: 'B2', value: 'B2' },
      { name: 'B3', value: 'B3' }
    ] as SrMultiSelectTextItem[]
  }),
  actions: {
    addRasterParams(rasterParams: RasterParams) {
      this.dataTable.push(rasterParams) // Method to add a new raster parameter
    },
    clearRasterParams() {
      this.dataTable = [] // Method to clear all raster parameters
    },
    getT0() {
      return this.t0
    },
    getT1() {
      return this.t1
    },
    setT0(t0: Date) {
      this.t0 = t0
    },
    setT1(t1: Date) {
      this.t1 = t1
    },
    getClosestTime() {
      return this.closestTime
    },
    setClosestTime(closestTime: Date) {
      this.closestTime = closestTime
    },
    removeRasterParams(idx: number) {
      if (this.dataTable.length > 0 && this.dataTable.length > idx) {
        this.dataTable.splice(idx, 1) // Method to remove a raster parameter by index
      } else {
        logger.warn('Index is out of bounds for dataTable', {
          idx,
          dataTableLength: this.dataTable.length
        })
      }
    },
    getFormattedParms() {
      const samples: Record<string, any> = {}

      this.dataTable.forEach((row) => {
        const entry: Record<string, any> = {}

        if (row.asset) entry.asset = row.asset
        if (row.algorithm) entry.algorithm = row.algorithm
        if (row.force_single_sample) entry.force_single_sample = row.force_single_sample
        if (row.radius) entry.radius = row.radius
        if (row.zonalStats) entry.zonal_stats = row.zonalStats
        if (row.withFlags) entry.with_flags = row.withFlags
        if (row.t0) entry.t0 = row.t0.toISOString()
        if (row.t1) entry.t1 = row.t1.toISOString()
        if (row.substring) entry.substring = row.substring
        if (row.closestTime) entry.closest_time = row.closestTime.toISOString()
        if (row.use_poi_time) entry.use_poi_time = row.use_poi_time
        if (row.catalog) entry.catalog = row.catalog
        if (row.bands?.length) entry.bands = row.bands
        if (row.slope_aspect) entry.slope_aspect = row.slope_aspect
        if (row.slope_scale_length > 0) entry.slope_scale_length = row.slope_scale_length

        samples[row.key] = entry
      })
      return samples
    },
    setParmsFromJson(samples: Record<string, any>) {
      this.dataTable = Object.entries(samples).map(([key, entry]) => ({
        key,
        asset: entry.asset ?? '',
        algorithm: entry.algorithm ?? '',
        force_single_sample:
          entry.force_single_sample === true ? 'first' : (entry.force_single_sample ?? 'first'),
        radius: entry.radius ?? 0,
        zonalStats: entry.zonal_stats ?? false,
        withFlags: entry.with_flags ?? false,
        t0: entry.t0 ? new Date(entry.t0) : null,
        t1: entry.t1 ? new Date(entry.t1) : null,
        substring: entry.substring ?? '',
        closestTime: entry.closest_time ? new Date(entry.closest_time) : null,
        use_poi_time: entry.use_poi_time ?? false,
        catalog: entry.catalog ?? '',
        bands: Array.isArray(entry.bands) ? entry.bands : [],
        slope_aspect: entry.slope_aspect ?? false,
        slope_scale_length: entry.slope_scale_length ?? 0
      }))
    },
    async setAssetOptions() {
      try {
        const response = await fetch('https://sliderule.slideruleearth.io/source/assets')
        if (!response.ok) {
          throw new Error(`Failed to fetch assets: ${response.statusText}`)
        }

        const result = await response.json()
        const rasters: string[] = result.rasters || []

        this.assetOptions = namesToMenuItems(rasters)
        this.lastAssetsFetchedAt = Date.now()
        localStorage.setItem(ASSETS_FETCHED_AT_KEY, String(this.lastAssetsFetchedAt))
        localStorage.setItem(ASSETS_LIST_KEY, JSON.stringify(rasters))
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error)
        logger.error('Error loading asset options', { error: errMsg })
        // assetOptions is already populated from cache or built-in fallback during
        // state init; nothing to swap in here. Surface a toast so the user knows
        // what they're seeing isn't necessarily current.
        const usingCache = loadCachedAssetNames() !== null
        const sourceLabel = usingCache ? 'cached raster assets' : 'built-in fallback raster assets'
        const lastFetched = this.lastAssetsFetchedAt
          ? `Last successful sync: ${new Date(this.lastAssetsFetchedAt).toLocaleString()}.`
          : 'No prior successful sync recorded.'
        useSrToastStore().warn(
          `Using ${sourceLabel}`,
          `Could not reach the SlideRule asset list (${errMsg}). ${lastFetched}`,
          8000
        )
      }
    }
  }
})
