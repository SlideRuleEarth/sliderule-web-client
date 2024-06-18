import { defineStore } from 'pinia'
import { tracksOptions, beamsOptions,getBeamsAndTracksWithGt } from '@/utils/parmUtils'

export const useAtl06ChartFilterStore = defineStore('atl06ChartFilter', {

    state: () => ({
        tracks:  [] as SrMultiSelectNumberItem[],
        selectAllTracks: false,
        beams: [] as SrMultiSelectNumberItem[],
        selectAllBeams: false,
        rgtValue: 1,
        cycleValue: 1,
        regionValue: 1
    }),
    actions: {
        setReqion(reqionValue:number) {
          this.regionValue = reqionValue;
        },
        getRegion() { 
          return this.regionValue;
        },
        setRgt(rgtValue:number) {
          this.rgtValue = rgtValue;
        },
        getRgt() {
          return this.rgtValue;
        },
        setCycle(cycleValue:number) {
          this.cycleValue = cycleValue;
        },
        getCycle() {
          return this.cycleValue;
        },
        setBeams(beams:string[]) {
          this.beams = beams;
        },
        getBeams() {
          return this.beams;
        },
        setTracks(tracks:string[]) {
          this.tracks = tracks;
        },
        getTracks() {
          return this.tracks;
        },
        setSelectAllTracks(selectAllTracks:boolean) {
          this.selectAllTracks = selectAllTracks;
        },
        getSelectAllTracks() {
          return this.selectAllTracks;
        },
        setSelectAllBeams(selectAllBeams:boolean) {
          this.selectAllBeams = selectAllBeams;
        },
        getSelectAllBeams() {
          return this.selectAllBeams;
        },
        setBeamsAndTracksWithGt(gt:number) {
          console.log('setBeamsAndTracksWithGt:', gt);
          const parms = getBeamsAndTracksWithGt(gt);
          this.beams = parms.beams;
          this.tracks = parms.tracks;
        },
    },
})


