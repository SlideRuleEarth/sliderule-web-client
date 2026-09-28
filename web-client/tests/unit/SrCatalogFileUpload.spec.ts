// tests/unit/SrCatalogFileUpload.spec.ts
//
// "Upload a Catalog File" used to store the parsed file in a store nothing read,
// so an uploaded catalog never reached the request (issue #1124). It now fills
// the Catalog field that "Add New Raster Params" copies into the sampler row.
import { mount, type VueWrapper } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { defineComponent, h } from 'vue'
import { createPinia, setActivePinia } from 'pinia'

const { toastAdd } = vi.hoisted(() => ({ toastAdd: vi.fn() }))

vi.mock('primevue/usetoast', () => ({
  useToast: () => ({ add: toastAdd })
}))

// Stand-in for PrimeVue's FileUpload: exposes the accept prop and lets a test
// fire "uploader" the way the real component does after a file is chosen.
vi.mock('primevue/fileupload', () => ({
  default: defineComponent({
    name: 'FileUpload',
    props: { accept: { type: String, default: '' } },
    emits: ['uploader'],
    setup() {
      return () => h('div')
    }
  })
}))

vi.mock('primevue/toast', () => ({
  default: defineComponent({ setup: () => () => h('div') })
}))

import SrCatalogFileUpload from '@/components/SrCatalogFileUpload.vue'
import { useRasterParamsStore } from '@/stores/rasterParamsStore'

// Shaped like a usgs3dep-1meter-dem catalog returned by /source/earthdata
const catalogText = JSON.stringify({
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      id: '5eacec9b82cefae35a24aabb',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-76.9, 38.9],
            [-76.8, 38.9],
            [-76.8, 39.0],
            [-76.9, 39.0],
            [-76.9, 38.9]
          ]
        ]
      },
      properties: {
        datetime: '2020-11-17T20:07:01.878+00:00',
        url: 'https://prd-tnm.s3.amazonaws.com/USGS_1M_example.tif'
      }
    }
  ]
})

function uploadFile(wrapper: VueWrapper, text: string) {
  const file = new File([text], 'catalog.geojson', { type: 'application/geo+json' })
  wrapper.findComponent({ name: 'FileUpload' }).vm.$emit('uploader', { files: [file] })
}

describe('SrCatalogFileUpload', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    toastAdd.mockClear()
  })

  it('puts the uploaded catalog in the Catalog field', async () => {
    const wrapper = mount(SrCatalogFileUpload)
    uploadFile(wrapper, catalogText)
    await vi.waitFor(() => expect(useRasterParamsStore().catalog).toBe(catalogText))
    expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'info' }))
  })

  it('leaves the Catalog field alone when the file is not JSON', async () => {
    const store = useRasterParamsStore()
    store.catalog = 'previous catalog'
    const wrapper = mount(SrCatalogFileUpload)
    uploadFile(wrapper, '{"type": "FeatureCollection", ')
    await vi.waitFor(() =>
      expect(toastAdd).toHaveBeenCalledWith(expect.objectContaining({ severity: 'error' }))
    )
    expect(store.catalog).toBe('previous catalog')
  })

  it('lets the file picker choose GeoJSON and JSON files', () => {
    const wrapper = mount(SrCatalogFileUpload)
    expect(wrapper.findComponent({ name: 'FileUpload' }).props('accept')).toBe('.geojson,.json')
  })
})
