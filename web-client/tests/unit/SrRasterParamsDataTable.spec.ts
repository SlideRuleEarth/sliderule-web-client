// tests/unit/SrRasterParamsDataTable.spec.ts
//
// The Raster Sampling table printed every field of a row, including the whole
// catalog, so a large catalog made the row so tall that the panel looked blank
// (issue #1126). The catalog column now shows a summary instead of the text.
import { mount } from '@vue/test-utils'
import { describe, it, expect, beforeEach } from 'vitest'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import PrimeVue from 'primevue/config'
import SrRasterParamsDataTable from '@/components/SrRasterParamsDataTable.vue'
import {
  useRasterParamsStore,
  RasterParamsCols,
  type RasterParams
} from '@/stores/rasterParamsStore'

function row(catalog: string): RasterParams {
  return {
    key: 'threedep',
    asset: 'usgs3dep-1meter-dem',
    algorithm: 'NearestNeighbour',
    force_single_sample: 'first',
    radius: 0,
    zonalStats: false,
    withFlags: false,
    t0: null,
    t1: null,
    substring: '',
    closestTime: null,
    use_poi_time: false,
    catalog,
    bands: [],
    slope_aspect: false,
    slope_scale_length: 0
  }
}

const tile = {
  type: 'Feature',
  geometry: {
    type: 'Polygon',
    coordinates: [
      [
        [-77, 38],
        [-76, 38],
        [-76, 39],
        [-77, 39],
        [-77, 38]
      ]
    ]
  },
  properties: { url: 'https://prd-tnm.s3.amazonaws.com/USGS_1M_example.tif' }
}

const catalogOf = (count: number) =>
  JSON.stringify({ type: 'FeatureCollection', features: Array.from({ length: count }, () => tile) })

// The Remove column comes first, then one column per RasterParamsCols entry
const catalogColumn = RasterParamsCols.findIndex((c) => c.field === 'catalog') + 1

let pinia: Pinia

function mountTableWith(catalog: string) {
  useRasterParamsStore().addRasterParams(row(catalog))
  const wrapper = mount(SrRasterParamsDataTable, {
    global: { plugins: [pinia, [PrimeVue, { unstyled: true }]] }
  })
  const cells = wrapper.findAll('tbody tr')[0].findAll('td')
  return { wrapper, cells, catalogCell: cells[catalogColumn].text() }
}

describe('SrRasterParamsDataTable', () => {
  beforeEach(() => {
    pinia = createPinia()
    setActivePinia(pinia)
  })

  it('shows a summary of a large catalog instead of its text', () => {
    const catalog = catalogOf(3000)
    const { wrapper, catalogCell } = mountTableWith(catalog)
    expect(catalogCell).toMatch(/^3,000 features, [\d.]+ KB$/)
    expect(wrapper.text()).not.toContain('FeatureCollection')
    expect(wrapper.text()).not.toContain('USGS_1M_example.tif')
  })

  it('says "feature" for a catalog with one', () => {
    expect(mountTableWith(catalogOf(1)).catalogCell).toMatch(/^1 feature, [\d.]+ Bytes$/)
  })

  it('shows only the size for text that is not a GeoJSON catalog', () => {
    expect(mountTableWith('not a catalog').catalogCell).toBe('13 Bytes')
  })

  it('leaves the cell empty without a catalog and still shows the other fields', () => {
    const { cells, catalogCell } = mountTableWith('')
    expect(catalogCell).toBe('')
    expect(cells[1].text()).toBe('threedep')
    expect(cells[2].text()).toBe('usgs3dep-1meter-dem')
  })
})
