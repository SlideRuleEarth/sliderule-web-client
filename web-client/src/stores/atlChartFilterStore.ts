import { defineStore } from 'pinia';
import { getBeamsAndTracksWithGt } from '@/utils/parmUtils';
import { beamsOptions, tracksOptions } from '@/utils/parmUtils';
import { getHeightFieldname } from '@/utils/SrParquetUtils';
import type { SrScatterOptionsParms } from '@/utils/parmUtils';
import { ref } from 'vue';

export interface SrListNumberItem {
  label: string;
  value: number;
}

export const useAtlChartFilterStore = defineStore('atlChartFilter', {
  state: () => ({
    debugCnt: 0 as number,
    tracks: [] as SrListNumberItem[],
    selectAllTracks: true as boolean,
    beams: [] as SrListNumberItem[],
    spotsOptions: [{label:'1',value:1},{label:'2',value:2},{label:'3',value:3},{label:'4',value:4},{label:'5',value:5},{label:'6',value:6}] as SrListNumberItem[],
    spots: [] as SrListNumberItem[],
    rgts: [] as SrListNumberItem[],
    rgtOptions: [] as SrListNumberItem[], // Ensure rgtOptions is an array
    cycles: [] as SrListNumberItem[],
    cycleOptions: [] as SrListNumberItem[],
    regionValue: 1 as number,
    currentFile: '' as string,
    currentReqId: 0 as number,
    min_x: 0 as number,
    max_x: 0 as number,
    min_y: 0 as number,
    max_y: 0 as number,
    updateScatterPlotCnt: 0 as number,
    elevationDataOptions: [{ name: 'not_set', value: 'not_set' }] as { name: string, value: string }[],
    yDataForChart: [] as string[],
    ndxOfelevationDataOptionsForHeight: 0,
    func: 'xxx' as string,
    pair: 0 as number,
    scOrient: -1 as number,
    size: NaN as number,
    isLoading: false as boolean,
    clearPlot: false as boolean,
    chartDataRef: ref<number[][]>([]),
    atl03QuerySql: '' as string,
    atl06QuerySql: '' as string,  
    atl08QuerySql: '' as string,
  }),

  actions: {
    setRegion(regionValue: number) {
      this.regionValue = regionValue;
    },
    getRegion() {
      return this.regionValue;
    },
    setBeams(beams: SrListNumberItem[]) {
      this.beams = beams;
    },
    getBeams() {
      return this.beams;
    },
    getBeamValues() { 
      return this.beams.map(beam => beam.value);
    },
    setSpots(spots: SrListNumberItem[]) {
      this.spots = spots;
    },
    getSpots(): SrListNumberItem[] {
      return this.spots;
    },
    setSpotWithNumber(spot: number) {
      //console.log('atlChartFilterStore.setSpotWithNumber():', spot);
      this.setSpots([{ label: spot.toString(), value: spot }]);
    },
    setRgts(rgts: SrListNumberItem[]) {
      console.log('atlChartFilterStore setRgts:', rgts);
      this.rgts = rgts;
    },
    getRgts() {
      //console.log('atlChartFilterStore getRgts:', this.rgts);
      return this.rgts;
    },
    getRgtValues() {
      return this.rgts.map(rgt => rgt.value);
    },
    getCycleValues() {
      return this.cycles.map(cycle => cycle.value);
    },
    setRgtOptionsWithNumbers(rgtOptions: number[]) {
      if (!Array.isArray(rgtOptions)) {
        console.error('rgtOptions is not an array:', rgtOptions);
        return;
      }
      this.rgtOptions = rgtOptions.map(option => ({ label: option.toString(), value: option }));
      console.log('atlChartFilterStore.setRgtOptionsWithNumbers():', rgtOptions,' this.rgtOptions:', this.rgtOptions);
    },
    getRgtOptions() {
      //console.log('atlChartFilterStore.getRgtOptions():', this.rgtOptions);
      return this.rgtOptions;
    },
    setRgtWithNumber(rgt: number) {
      console.log('atlChartFilterStore.setRgtWithNumber():', rgt);
      this.setRgts([{ label: rgt.toString(), value: rgt }]);
    },
    setCycleOptionsWithNumbers(cycleOptions: number[]) {
      if (!Array.isArray(cycleOptions)) {
        console.error('cycleOptions is not an array:', cycleOptions);
        return;
      }
      this.cycleOptions = cycleOptions.map(option => ({ label: option.toString(), value: option }));
      //console.log('atlChartFilterStore.setCycleOptionsWithNumbers():', cycleOptions, ' this.cycleOptions:', this.cycleOptions);
    },
    getCycleOptions() {
      //console.log('atlChartFilterStore.getCycleOptions():', this.cycleOptions);
      return this.cycleOptions;
    },
    setCycleWithNumber(cycle: number) {
      console.log('atlChartFilterStore.setCycleWithNumber():', cycle);
      this.setCycles([{ label: cycle.toString(), value: cycle }]);
    },
    setCycles(cycles: SrListNumberItem[]) {
      console.log('atlChartFilterStore.setCycles():', cycles);
      this.cycles = cycles;
    },
    getCycles() {
      //console.log('atlChartFilterStore.getCycles():', this.cycles);
      return this.cycles;
    },
    setTracks(tracks: SrListNumberItem[]) {
      this.tracks = tracks;
    },
    getTracks() {
      return this.tracks;
    },
    setTrackWithNumber(track: number) {
      this.setTracks([{ label: track.toString(), value: track }]);
      //console.log('atlChartFilterStore.setTrackWithNumber(', track,') tracks:', this.tracks);
    },
    getTrackValues() {
      return this.tracks.map(track => track.value);
    },
    setSelectAllTracks(selectAllTracks: boolean) {
      this.selectAllTracks = selectAllTracks;
    },
    getSelectAllTracks() {
      return this.selectAllTracks;
    },
    setBeamsAndTracksWithGt(gt: number) {
      //console.log('atlChartFilterStore.setBeamsAndTracksWithGt(',gt,')');
      const parms = getBeamsAndTracksWithGt(gt);
      this.setBeams(parms.beams);
      this.setTracks(parms.tracks);
    },
    setTracksForBeams(input_beams: SrListNumberItem[]) {    
      const tracks = input_beams
        .map(beam => tracksOptions.find(track => Number(beam.label.charAt(2)) === track.value))
        .filter((track): track is SrListNumberItem => track !== undefined);
        this.setTracks(tracks);
    },
    setBeamsForTracks(input_tracks: SrListNumberItem[]) {
      const beams = input_tracks
        .map(track => beamsOptions.find(option => Number(track) === Number(option.label.charAt(2))))
        .filter((beam): beam is SrListNumberItem => beam !== undefined);
      this.setBeams(beams);
      //console.log('atlChartFilterStore.setBeamsForTracks(',input_tracks,') beams:', beams);
    },
    setBeamWithNumber(beam: number) {
      this.setBeams([{ label: beamsOptions.find(option => option.value === beam)?.label || '', value: beam }]);
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
    incrementDebugCnt() {
      return ++this.debugCnt;
    },
    getDebugCnt() {
      return this.debugCnt;
    },
    setDebugCnt(cnt: number) {
      this.debugCnt = cnt;
    },
    async setElevationDataOptionsFromFieldNames(fieldNames: string[]) {
      const elevationDataOptions = fieldNames.map(fieldName => ({ name: fieldName, value: fieldName }));
      const heightFieldname = await getHeightFieldname(this.currentReqId);
      this.ndxOfelevationDataOptionsForHeight = fieldNames.indexOf(heightFieldname);
      this.setElevationDataOptions(elevationDataOptions);
    },
    getElevationDataOptions() {
      return this.elevationDataOptions;
    },
    setElevationDataOptions(elevationDataOptions: { name: string, value: string }[]) {
      this.elevationDataOptions = elevationDataOptions;
    },
    getYDataForChart() {
      return this.yDataForChart;
    },
    getNdxOfelevationDataOptionsForHeight() {
      return this.ndxOfelevationDataOptionsForHeight;
    },
    setFunc(func: string) {
      this.func = func;
    },
    getFunc() {
      return this.func;
    },
    setPair(pair: number) {
      this.pair = pair;
    },
    getPair() {
      return this.pair;
    },
    setScOrient(scOrient: number) {
      this.scOrient = scOrient;
    },
    getScOrient() {
      return this.scOrient;
    },
    setSize(size: number) {
      this.size = size;
    },
    getSize() {
      return this.size;
    },
    getScatterOptionsParms(): SrScatterOptionsParms {
      console.log('atlChartFilterStore.getScatterOptionsParms() this.rgts[0]?.value:',this.rgts[0]?.value);
      const sop =  {
        rgt: this.rgts[0]?.value || -1,
        cycle: this.cycles[0]?.value || -1,
        fileName: this.currentFile,
        func: this.func,
        y: this.yDataForChart,
        x: 'x_atc',
        beams: this.beams.map(beam => beam.value),
        pair: this.pair,
        scOrient: this.scOrient,
        tracks: this.tracks.map(track => track.value),
      };
      console.log('atlChartFilterStore.getScatterOptionsParms():', sop);
      return sop;
    },
    updateScatterPlot() {
      this.updateScatterPlotCnt += 1;
      console.log('atlChartFilterStore.updateScatterPlot():', this.updateScatterPlotCnt);
    },
    setIsLoading() {
      console.log('atlChartFilterStore.setIsLoading()');
      this.isLoading = true;
    },
    resetIsLoading() {
      console.log('atlChartFilterStore.resetIsLoading()');
      this.isLoading = false;
    },
    getIsLoading() {
      console.log('atlChartFilterStore.getIsLoading():', this.isLoading);
      return this.isLoading;
    },
    setClearPlot() {
      this.clearPlot = true;
    },
    resetClearPlot() {
      this.clearPlot = false;
    },
    getClearPlot() {
      return this.clearPlot;
    },
    setAtl03QuerySql(sql: string) {
      this.atl03QuerySql = sql;
    },
    getAtl03QuerySql() {
      return this.atl03QuerySql;
    },
    setAtl06QuerySql(sql: string) {
      this.atl06QuerySql = sql;
    },
    getAtl06QuerySql() {
      return this.atl06QuerySql;
    },
    setAtl08QuerySql(sql: string) {
      this.atl08QuerySql = sql;
    },
    getAtl08QuerySql() {
      return this.atl08QuerySql;
    },
    getSqlStmnt(func: string) {
      switch (func) {
        case 'atl03':
          return this.atl03QuerySql;
        case 'atl06':
          return this.atl06QuerySql;
        case 'atl08':
          return this.atl08QuerySql;
        default:
          return '';
      }
    }
  },
});
