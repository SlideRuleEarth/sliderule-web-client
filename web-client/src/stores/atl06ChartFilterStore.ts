import { defineStore } from 'pinia'
import { getBeamsAndTracksWithGt } from '@/utils/parmUtils'
import { beamsOptions,tracksOptions } from '@/utils/parmUtils';

export const useAtl06ChartFilterStore = defineStore('atl06ChartFilter', {

    state: () => ({
        tracks:  [1,2,3] as number[],
        selectAllTracks: true,
        beams: [10,20,30,40,50,60] as number[],
        rgtValue: 1,
        cycleValue: 1,
        regionValue: 1,
        currentFile: '',
        currentReqId: 0,
        min_x: 0,
        max_x: 0,
        min_y: 0,
        max_y: 0,
        updateScatterPlot: false,
        debugCnt: 0,
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
          console.log('atl06ChartFilterStore setBeams:', beams);
        },
        getBeams() {
          return this.beams;
        },
        setTracks(tracks:number[]) {
          this.tracks = tracks;
          console.log('atl06ChartFilterStore setTracks:', tracks);
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
        setBeamsAndTracksWithGt(gt:number) {
          const parms = getBeamsAndTracksWithGt(gt);
          console.log('setBeamsAndTracksWithGt:', gt, 'parms.beams:', parms.beams, 'parms.tracks:', parms.tracks);
          this.setBeams(parms.beams);
          this.setTracks(parms.tracks);
          console.log('setBeamsAndTracksWithGt:', gt, 'beams:', this.beams);
          console.log('setBeamsAndTracksWithGt:', gt, 'tracks:', this.tracks);
        },
        setTracksForBeams(input_beams:number[]) {
          const selectedBeamsOptions = [] as {name:string,value:number}[];
          for (const input_beam of input_beams) {
            for (const beamOption of beamsOptions) {
              if (input_beam === beamOption.value) {
                selectedBeamsOptions.push(beamOption);
                break;
              }
            }
          }
          console.log('setTracksForBeams selectedBeamsOptions:', selectedBeamsOptions);
          const tracks = [] as number[];
          for (const beam of selectedBeamsOptions) {
            for (const trackOption of tracksOptions) {
              if (Number(beam.name.charAt(2)) === trackOption.value) {
                tracks.push(trackOption.value);
                break;
              }
            }
          }
          console.log('setTracksForBeams tracks:', tracks);
          this.setTracks(tracks);
        },
        setBeamsForTracks(input_tracks:number[]) {
          const beams = [] as number[];
          for (const track of input_tracks) {
            for (const beamOption of beamsOptions) {
              if (Number(track) === Number(beamOption.name.charAt(2))) {
                beams.push(beamOption.value);
              }
            }
          }
          console.log('setBeamsForTracks input_tracks:', input_tracks);
          console.log('setBeamsForTracks beams:', beams);
          this.setBeams(beams);
        },
        setReqId(req_id: number) {
          this.currentReqId = req_id;
        },
        getReqId() {
          return this.currentReqId;
        },
        setFileName(filename: string) {
          this.currentFile = filename;
        },
        getFileName() {
          return this.currentFile;
        },
        setMinX(min_x: number) {
          this.min_x = min_x;
        },
        getMinX() {
          return this.min_x;
        },
        setMaxX(max_x: number) {
          this.max_x = max_x;
        },
        getMaxX() {
          return this.max_x;
        },
        setMinY(min_y: number) {
          this.min_y = min_y;
        },
        getMinY() {
          return this.min_y;
        },
        setMaxY(max_y: number) {
          this.max_y = max_y;
        },
        getMaxY() {
          return this.max_y;
        },
        setUpdateScatterPlot(){
          this.updateScatterPlot = true;
        },
        getUpdateScatterPlot() {
          return this.updateScatterPlot;
        },
        resetUpdateScatterPlot() {
          this.updateScatterPlot = false;
        },
        incrementDebugCnt() {
          return ++this.debugCnt;
        },
        getDebugCnt() {
          return this.debugCnt;
        },
        setDebugCnt(cnt:number) {
          this.debugCnt = cnt;
        }
    },
})


