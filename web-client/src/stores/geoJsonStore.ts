import { defineStore } from 'pinia';

export const useGeoJsonStore = defineStore('geoJson', {
  state: () => ({
    reqGeoJsonData: null,
    featuresGeoJsonData: null,
  }),
  actions: {
    setReqGeoJsonData(data: any) {
      this.reqGeoJsonData = data;
    },
    setFeaturesGeoJsonData(data: any) {
      this.featuresGeoJsonData = data;
    },
  },
});
