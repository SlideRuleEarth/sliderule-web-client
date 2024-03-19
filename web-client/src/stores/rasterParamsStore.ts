export type RasterParams = {
    key: string;
    t0: string;
    t1: string;
}
export const RasterParamsCols = [
  { field: 'key', header: 'Key' },
  { field: 't0', header: 'T0 Value' },
  { field: 't1', header: 'T1 Value' }  
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
