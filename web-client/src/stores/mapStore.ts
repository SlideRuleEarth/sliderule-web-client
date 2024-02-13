// src/stores/mapStore.js
import { defineStore } from 'pinia';
import { Map as OLMap } from 'ol';
export const useMapStore = defineStore('map', {
  state: () => ({
    map: null as OLMap | null,
    wmsCap: null,
  }),
  actions: {
    setMap(mapInstance: OLMap) {
      this.map = mapInstance;
    },
    getMap() {
      return this.map;
    },
    setWmsCap(wmsCapInstance: any) {
      this.wmsCap = wmsCapInstance;
    },
    getWmsCap() {
      return this.wmsCap;
    },
    updateWmsCap(projectionName: string) {
      console.log('updateWmsCap:', projectionName);
      if (this.wmsCap) {
        this.map?.removeControl(this.wmsCap);
        this.setWmsCap(projectionName);
      }
    }
  },
});
