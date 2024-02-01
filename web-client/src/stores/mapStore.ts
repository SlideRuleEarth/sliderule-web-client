// src/stores/mapStore.js
import { defineStore } from 'pinia';
import { Map } from 'ol';
export const useMapStore = defineStore('map', {
  state: () => ({
    map: null as Map | null,
  }),
  actions: {
    setMap(mapInstance: Map) {
      this.map = mapInstance;
    },
    getMap() {
      return this.map;
    },
  },
});
