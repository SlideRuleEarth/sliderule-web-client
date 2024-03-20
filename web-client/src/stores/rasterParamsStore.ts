export type RasterParams = {
    key: string; 
    asset: string;
    algorithm: string;
    radius: number;
    zonalStats: string;
    withFlag: boolean;
    t0: Date;
    t1: Date;
    substring: string; 
    closestTime: boolean;
    catalog: string;
    bands: string[];
}
export const RasterParamsCols = [
  { field: 'key', header: 'Key' },
  { field: 'asset', header: 'asset' },
  { field: 'algorithm', header: 'algorithm' }, 
  { field: 'radius', header: 'radius' },
  { field: 'zonalStats', header: 'zonalStats' },
  { field: 'withFlag', header: 'withFlag' },
  { field: 't0', header: 't0' },
  { field: 't1', header: 't1' },
  { field: 'substring', header: 'substring' },
  { field: 'closestTime', header: 'closestTime' },
  { field: 'catalog', header: 'catalog' },
  { field: 'bands', header: 'bands' }
];

import type { SrMenuItem } from '@/components/SrMenuInput.vue';
import type { SrMultiSelectItem } from '@/components/SrMultiSelect.vue';
// Define the store
import { defineStore } from 'pinia';

export const useRasterParamsStore = defineStore('rasterParams', {
  state: () => ({
    dataTable: [] as RasterParams[], // Array to hold a sets of raster parameters
    key: '' as RasterParams['key'],
    asset: '' as RasterParams['asset'],
    algorithm: '' as RasterParams['algorithm'],
    radius: 0 as RasterParams['radius'],
    zonalStats: '' as RasterParams['zonalStats'],
    withFlag: false as RasterParams['withFlag'],
    t0: new Date() as RasterParams['t0'],
    t1: new Date() as RasterParams['t1'],
    substring: '' as RasterParams['substring'],
    closestTime: false as RasterParams['closestTime'],
    catalog: '' as RasterParams['catalog'],
    bands: [] as RasterParams['bands'],
    assetOptions: 
    [
      {name:'gedil3-elevation', value:'gedil3-elevation'},
      {name:'gedil3-canopy', value:'gedil3-canopy'},
      {name:'gedil3-elevation-stddev', value:'gedil3-elevation-stddev'},
      {name:'gedil3-canopy-stddev', value:'gedil3-canopy-stddev'},
      {name:'gedil3-counts', value:'gedil3-counts'},
      {name:'merit-dem', value:'merit-dem'},
      {name:'swot-sim-ecco-llc4320', value:'swot-sim-ecco-llc4320'},
      {name:'swot-sim-glorys', value:'swot-sim-glorys'},
      {name:'usgs3dep-1meter-dem', value:'usgs3dep-1meter-dem'},
      {name:'esa-worldcover-10meter', value:'esa-worldcover-10meter'},
      {name:'landsat-hls', value:'landsat-hls'},
      {name:'arcticdem-mosaic', value:'arcticdem-mosaic'},
      {name:'arcticdem-strips', value:'arcticdem-strips'},
      {name:'rema-mosaic', value:'rema-mosaic'},
      {name:'rema-strips', value:'rema-strips'},
    ] as SrMenuItem[],
    algorithmOptions: 
    [
      {name:'NearestNeighbor', value:'NearestNeighbor'},
      {name:'Bilinear', value:'Bilinear'},
      {name:'Cubic', value:'Cubic'},
      {name:'CubicSpline', value:'CubicSpline'},
      {name:'Lanczos', value:'Lanczos'},
      {name:'Average', value:'Average'},
      {name:'Mode', value:'Mode'},
      {name:'Gauss', value:'Gauss'},
    ] as SrMenuItem[],
    bandOptions:
    [
      {name:'B1', value:'B1'},
      {name:'B2', value:'B2'},
      {name:'B3', value:'B3'},
    ] as SrMultiSelectItem[],
  }),
  actions: {
    addRasterParams(rasterParams: RasterParams) {
      this.dataTable.push(rasterParams); // Method to add a new raster parameter
    },
    clearRasterParams() {
      this.dataTable = []; // Method to clear all raster parameters
    }
  }
});
