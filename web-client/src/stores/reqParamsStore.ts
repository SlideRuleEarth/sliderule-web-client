import { defineStore } from 'pinia'
import type { SrRadioBtnCategory } from '@/components/SrRadioButtonBox.vue';
import type { SrMultiSelectItem } from '@/components/SrMultiSelect.vue';
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
          { name: 'Land', code:'L' },
          { name: 'Ocean', code:'O' },
          { name: 'Sea Ice', code:'S'},
          { name: 'Land Ice', code:'I'},
          { name: 'Inland Water',code:'W' },
        ] as SrMultiSelectItem[],
        surfaceType: 'Land',
        signalConfidenceOptions: [
          { name: 'TEP', key: '-2' },
          { name: 'Not Considered', key: '0' },
          { name: 'Background', key: '1' },
          { name: 'Within 10m', key: '?' },
          { name: 'Low', key: '2' },
          { name: 'Medium', key: '3' },
          { name: 'High', key: '4' },
        ] as SrRadioBtnCategory[],
        signalConfidence: 'Terrain Echo Photon (TEP)',
        landTypeOptions: ['noise', 'ground', 'canopy', 'Top of Canopy','unclasified'],
        landType: 'noise',
        YAPC: 0.0,
    }),
    actions: {
        setRasterizePolygon(value:boolean) {
          this.rasterizePolygon = value;
        },
      },
})


