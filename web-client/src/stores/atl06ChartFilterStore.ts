import { defineStore } from 'pinia'
import { getBeamsAndTracksWithGt } from '@/utils/parmUtils'

export const useAtl06ChartFilterStore = defineStore('atl06ChartFilter', {

    state: () => ({
        tracks:  [] as number[],
        selectAllTracks: false,
        beams: [] as number[],
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
        setBeams(beams:number[]) {
          this.beams = beams;
        },
        getBeams() {
          return this.beams;
        },
        setTracks(tracks:number[]) {
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
          const parms = getBeamsAndTracksWithGt(gt);
          console.log('setBeamsAndTracksWithGt:', gt, 'parms.beams:', parms.beams, 'parms.tracks:', parms.tracks);
          this.setBeams(parms.beams);
          this.setTracks(parms.tracks);
          console.log('setBeamsAndTracksWithGt:', gt, 'beams:', this.beams);
          console.log('setBeamsAndTracksWithGt:', gt, 'tracks:', this.tracks);
        },
    },
})


