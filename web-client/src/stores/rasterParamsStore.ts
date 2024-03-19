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

// Define the store
import { defineStore } from 'pinia';

export const useRasterParamsStore = defineStore('rasterParams', {
  state: () => ({
    value: [] as RasterParams[] // Array to hold multiple raster parameters
  }),
  actions: {
    addRasterParams(rasterParams: RasterParams) {
      this.value.push(rasterParams); // Method to add a new raster parameter
    },
    clearRasterParams() {
      this.value = []; // Method to clear all raster parameters
    }
  }
});
