// src/stores/mapStore.js
import { defineStore } from 'pinia';
import { Map as OLMap } from 'ol';
export const useMapStore = defineStore('map', {
  state: () => ({
    map: null as OLMap | null,
  }),
  actions: {
    setMap(mapInstance: OLMap) {
      this.map = mapInstance;
    },
    getMap() {
      return this.map;
    },
  },
});
