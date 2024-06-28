import { defineStore } from 'pinia'
import { getBeamsAndTracksWithGt } from '@/utils/parmUtils'
import { beamsOptions,tracksOptions } from '@/utils/parmUtils';
import { getHeightFieldname } from '@/utils/SrParquetUtils';

export const useAtl06ChartFilterStore = defineStore('atl06ChartFilter', {

    state: () => ({
        tracks:  [1,2,3] as number[],
        selectAllTracks: true as boolean,
        beams: [10,20,30,40,50,60] as number[],
        rgtValue: 1 as number,
        cycleValue: 1 as number,
        regionValue: 1 as number,
        currentFile: '' as string,
        currentReqId: 0 as number,
        min_x: 0 as number,
        max_x: 0 as number,
        min_y: 0 as number,
        max_y: 0 as number,
        updateScatterPlot: false as boolean,
        elevationDataOptions:[{name:'h_mean',value:'h_mean'},{name:'rms_misfit',value:'rms_misfit'}] as {name:string,value:string}[],
        yDataForChart:[] as string[],
        ndxOfelevationDataOptionsForHeight: 0,
        debugCnt: 0 as number,
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
        },
        async setElevationDataOptionsFromFieldNames(fieldNames: string[]) {
          const elevationDataOptions = [] as {name:string,value:string}[];
          const heightFieldname = await getHeightFieldname(this.currentReqId);
          let ndx=0;
          for (const fieldName of fieldNames) {
            if (fieldName === heightFieldname) {
              this.ndxOfelevationDataOptionsForHeight = ndx++;
            }
            elevationDataOptions.push({name:fieldName,value:fieldName});
          }
          this.setElevationDataOptions(elevationDataOptions);
          console.log('setElevationDataOptionsFromFieldNames:', elevationDataOptions);
        },
        getElevationDataOptions() {
          console.log('getElevationDataOptions:', this.elevationDataOptions);
          return this.elevationDataOptions
        },
        setElevationDataOptions(elevationDataOptions: {name:string,value:string}[]) {
          this.elevationDataOptions = elevationDataOptions;
        },  
        getYDataForChartValues() {
          const yDataForChartValues = [];
          console.log('yDataForChart:', this.yDataForChart);
          for (const yData of this.yDataForChart) {
            //console.log('getYDataForChartValues:', yData);
            yDataForChartValues.push(yData);
          }
          console.log('yDataForChart',this.yDataForChart,'yDataForChartValues:', yDataForChartValues);
          return yDataForChartValues;
        },
        getNdxOfelevationDataOptionsForHeight() {
          return this.ndxOfelevationDataOptionsForHeight;
        }
    },
})


