import { defineStore } from 'pinia'
import type { SrRadioBtnCategory } from '@/components/SrRadioButtonBox.vue';
export const useReqParamsStore = defineStore('reqParams', {

    state: () => ({
        rasterizePolygon: false,
        ignorePolygon: false,
        missionValue: {name:'mission', value:'IceSat-2'},
        iceSat2SelectedAPI: {name:'IceSat-2 Api', value:'atl06'},
        gediSelectedAPI: {name:'GEDI Api', value:'gedi01b'},
        urlValue: 'slideruleearth.io',
        surfaceTypeValue: {name:'SurfaceType', value:'Land'},
        tracks:  ['Track 1', 'Track 2', 'Track 3'],
        tracksOptions: ['Track 1', 'Track 2', 'Track 3'],
        beams: ['gt1l', 'gt1r', 'gt2l', 'gt2r', 'gt3l', 'gt3r'],
        beamsOptions: ['gt1l', 'gt1r', 'gt2l', 'gt2r', 'gt3l', 'gt3r'], 
        rgtValue: 1,
        cycleValue: 1,
        regionValue: 1,
        t0Value: '2020-01-01',
        t1Value: '2020-01-01',
        reqTimeoutValue: 60,
        lengthValue: 40,
        stepValue: 20,
        confidenceValue: 4,
        iterationsValue: 6,
        spreadValue: 20.0,
        PE_CountValue: 10,
        windowValue: 3.0,
        sigmaValue: 5.0,
        surfaceTypeOptions: [
          { name: 'Land', key:'L' },
          { name: 'Ocean', key:'O' },
          { name: 'Sea Ice', key:'S'},
          { name: 'Land Ice', key:'I'},
          { name: 'Inland Water',key:'W' },
        ] as SrRadioBtnCategory[],
        surfaceType: 'Land',   
    }),
    actions: {
        setRasterizePolygon(value:boolean) {
          this.rasterizePolygon = value;
        },
      },
})


