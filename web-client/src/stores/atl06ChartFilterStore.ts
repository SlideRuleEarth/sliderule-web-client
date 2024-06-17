import { defineStore } from 'pinia'

export const useAtl06ChartFilterStore = defineStore('atl06ChartFilter', {

    state: () => ({
        tracks:  ['Track 1', 'Track 2', 'Track 3'],
        tracksOptions: [
          { name: 'Track 1' ,value: 1 }, 
          { name: 'Track 2' , value: 2 },
          { name: 'Track 3' , value: 3 }
        ] as SrMultiSelectNumberItem[],
        selectAllTracks: false,
        beams: ['gt1l', 'gt1r', 'gt2l', 'gt2r', 'gt3l', 'gt3r'],
        beamsOptions: ['gt1l', 'gt1r', 'gt2l', 'gt2r', 'gt3l', 'gt3r'], 
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
    },
})


