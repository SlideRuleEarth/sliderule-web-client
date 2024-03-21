import { defineStore } from 'pinia';

export const useGeoJsonStore = defineStore('geoJson', {
  state: () => ({
    geoJsonData: null,
  }),
  actions: {
    setGeoJsonData(data: any) {
      this.geoJsonData = data;
    },
  },
});
