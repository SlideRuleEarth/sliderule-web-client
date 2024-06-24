import { defineStore } from 'pinia'
import { getBeamsAndTracksWithGt } from '@/utils/parmUtils'
import type { get } from 'http';
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
        }
    },
})


