import { defineStore } from 'pinia'

export const useReqParamsStore = defineStore('reqParams', {

    state: () => ({
        rasterizePolygon: false,
        ignorePolygon: false,
        missionValue: {name:'mission', value:'IceSat-2'},
        iceSat2SelectedAPI: {name:'IceSat-2 Api', value:'atl06'},
        gediSelectedAPI: {name:'GEDI Api', value:'gedi01b'},
        urlValue: 'slideruleearth.io',
        surfaceTypeValue: {name:'SurfaceType', value:'Land'},
        reqTimeoutValue: 60,
        lengthValue: 40,
        stepValue: 20,
        confidenceValue: 4,
        iterationsValue: 6,
        spreadValue: 20.0,
        PE_CountValue: 10,
        windowValue: 3.0,
        sigmaValue: 5.0,    
    }),
    actions: {
        setRasterizePolygon(value:boolean) {
          this.rasterizePolygon = value;
        },
      },
})


