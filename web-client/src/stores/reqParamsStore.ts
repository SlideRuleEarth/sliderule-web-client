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
          { name: 'Land', value:'L' },
          { name: 'Ocean', value:'O' },
          { name: 'Sea Ice', value:'S'},
          { name: 'Land Ice', value:'I'},
          { name: 'Inland Water',value:'W' },
        ] as SrMultiSelectItem[],
        surfaceType:[] as string[],
        signalConfidenceOptions: [
          { name: 'TEP', value: '-2' },
          { name: 'Not Considered', value: '0' },
          { name: 'Background', value: '1' },
          { name: 'Within 10m', value: '?' },
          { name: 'Low', value: '2' },
          { name: 'Medium', value: '3' },
          { name: 'High', value: '4' },
        ] as SrRadioBtnCategory[],
        signalConfidence: 'Terrain Echo Photon (TEP)',
        landTypeOptions: [
          { name: 'noise', value: '0' },
          { name: 'ground', value: '1' },
          { name: 'canopy', value: '2' },
          { name: 'Top of Canopy', value: '3' },
          { name: 'unclassified', value: '4' },
        ] as SrMultiSelectItem[],
        landType: 'ground',
        YAPC: 0.0,
    }),
    actions: {
        setRasterizePolygon(value:boolean) {
          this.rasterizePolygon = value;
        },
      },
})


