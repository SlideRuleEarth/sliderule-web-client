import { defineStore } from 'pinia';

export const useCatalogStore = defineStore('catalog', {
  state: () => ({
    catalogData: null,
  }),
  actions: {
    setCatalogData(data: any) {
      this.catalogData = data;
    },
  },
});