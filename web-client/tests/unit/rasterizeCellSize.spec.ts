// tests/unit/rasterizeCellSize.spec.ts
//
// The server sizes the region_mask raster as int(extent / cellsize) rows and
// columns, so an uploaded region smaller than the rasterize cell size (default
// 0.01°) got a mask with no rows and the request failed (issue #1125). Uploading
// or rasterizing a region now lowers the cell size to fit it, and a run is
// blocked if the cell size is later raised past the region's size.
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'

const { toastInfo } = vi.hoisted(() => ({ toastInfo: vi.fn() }))

vi.mock('@/stores/srToastStore', () => ({
  useSrToastStore: () => ({ info: toastInfo, error: vi.fn(), warn: vi.fn() })
}))

import {
  shorterSideOf,
  fitCellSize,
  cellSizeFits,
  fitRasterizeCellSizeToRegionMask,
  checkRasterizeCellSizeError
} from '@/utils/rasterizeCellSize'
import { useGeoJsonStore } from '@/stores/geoJsonStore'
import { useReqParamsStore } from '@/stores/reqParamsStore'

function box(lon: number, lat: number, width: number, height: number) {
  return {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [
        [
          [lon, lat],
          [lon + width, lat],
          [lon + width, lat + height],
          [lon, lat + height],
          [lon, lat]
        ]
      ]
    }
  }
}

const collection = (...features: object[]) => ({ type: 'FeatureCollection', features })

// The region from the #1118 live test at Goddard: 0.0244° wide, 0.0074° tall
const goddard = collection(box(-76.8596, 38.9931, 0.0244, 0.0074))

describe('shorterSideOf', () => {
  it("returns the region's narrower dimension", () => {
    expect(shorterSideOf(goddard)).toBeCloseTo(0.0074, 10)
  })

  it('spans every feature in the file, as the server does', () => {
    const twoBoxes = collection(box(0, 0, 0.01, 0.01), box(1, 0.5, 0.01, 0.01))
    expect(shorterSideOf(twoBoxes)).toBeCloseTo(0.51, 10)
  })

  it("returns null for something that isn't GeoJSON", () => {
    expect(shorterSideOf(null)).toBeNull()
    expect(shorterSideOf({})).toBeNull()
  })
})

describe('fitCellSize', () => {
  it('lowers a cell size that is too coarse to ten cells across, on the slider steps', () => {
    expect(fitCellSize(0.01, 0.0074)).toBe(0.0007)
  })

  it('keeps a cell size that already fits', () => {
    expect(fitCellSize(0.0005, 0.0074)).toBe(0.0005)
    expect(fitCellSize(0.01, 0.5)).toBe(0.01)
  })

  it('never goes below the slider minimum', () => {
    expect(fitCellSize(0.01, 0.0005)).toBe(0.0001)
  })
})

describe('cellSizeFits', () => {
  it("is false when the cell is larger than the region's shorter side", () => {
    expect(cellSizeFits(0.01, 0.0074)).toBe(false)
  })

  it('is true at and below it', () => {
    expect(cellSizeFits(0.0074, 0.0074)).toBe(true)
    expect(cellSizeFits(0.0007, 0.0074)).toBe(true)
  })
})

describe('fitting the cell size to the region mask', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    toastInfo.mockClear()
  })

  it('lowers the slider, and says so, when the region is too small for it', () => {
    useGeoJsonStore().setReqGeoJsonData(goddard)
    fitRasterizeCellSizeToRegionMask()
    expect(useReqParamsStore().getRasterizePolyCellSize()).toBe(0.0007)
    expect(toastInfo).toHaveBeenCalledWith(
      'Rasterize cell size',
      'Lowered from 0.01° to 0.0007° to fit the region.'
    )
  })

  it('leaves the slider alone for a region it already fits', () => {
    useGeoJsonStore().setReqGeoJsonData(collection(box(-77, 38, 0.5, 0.5)))
    fitRasterizeCellSizeToRegionMask()
    expect(useReqParamsStore().getRasterizePolyCellSize()).toBe(0.01)
    expect(toastInfo).not.toHaveBeenCalled()
  })

  it('ignores uploads without polygons, which are not sent as a mask', () => {
    const points = collection({
      type: 'Feature',
      properties: {},
      geometry: { type: 'Point', coordinates: [-76.85, 38.99] }
    })
    useGeoJsonStore().setReqGeoJsonData(points)
    fitRasterizeCellSizeToRegionMask()
    expect(useReqParamsStore().getRasterizePolyCellSize()).toBe(0.01)
  })
})

describe('checkRasterizeCellSizeError', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })

  it('blocks a run when the cell size is larger than the region', () => {
    useGeoJsonStore().setReqGeoJsonData(goddard)
    const rsp = checkRasterizeCellSizeError()
    expect(rsp.ok).toBe(false)
    expect(rsp.msg).toContain('(0.01°)')
    expect(rsp.msg).toContain('0.0074°')
  })

  it('allows the fitted cell size', () => {
    useGeoJsonStore().setReqGeoJsonData(goddard)
    useReqParamsStore().setRasterizePolyCellSize(0.0007)
    expect(checkRasterizeCellSizeError()).toEqual({ ok: true })
  })

  it('allows runs without a region mask', () => {
    expect(checkRasterizeCellSizeError()).toEqual({ ok: true })
  })
})
