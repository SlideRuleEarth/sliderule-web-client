import { defineStore } from 'pinia'

export const useReqParamsStore = defineStore('reqParams', {

    state: () => ({
        rasterizePolygon: false
    }),
    actions: {
        setRasterizePolygon(value:boolean) {
          this.rasterizePolygon = value;
        },
      },
})
