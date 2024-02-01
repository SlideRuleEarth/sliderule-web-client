// src/stores/geoCoderStore.ts
import { defineStore } from 'pinia';
import Geocoder from 'ol-geocoder';

export const useGeoCoderStore = defineStore('geocoder', {
  state: () => ({
    // @ts-ignore
    geocoder: null as Geocoder | null , // Initially, there's no geocoder instance
  }),
  actions: {
    // Method to initialize and set the geocoder instance
    initGeocoder(options:any) {
      // @ts-ignore
      this.geocoder = new Geocoder('nominatim', options);
    },
    // Method to get the geocoder instance
    getGeocoder() {
      return this.geocoder;
    },
    isInitialized() {
        return this.geocoder !== null;
    }
  },
});
