import { defineStore } from 'pinia';
import { getBeamsAndTracksWithGt } from '@/utils/parmUtils';
import { beamsOptions, tracksOptions } from '@/utils/parmUtils';
import { getHeightFieldname } from '@/utils/SrParquetUtils';
import type { SrScatterOptionsParms } from '@/utils/parmUtils';
import { ref } from 'vue';
import type { SrMenuItem } from '@/components/SrMenuInput.vue';
import { set } from 'lodash';

export interface SrListNumberItem {
  label: string;
  value: number;
}

export const useAtlChartFilterStore = defineStore('atlChartFilter', {
  state: () => ({
    debugCnt: 0 as number,
    tracks: [1, 2, 3] as number[],
    selectAllTracks: true as boolean,
    beams: [10, 20, 30, 40, 50, 60] as number[],
    spots: [1, 2, 3, 4, 5, 6] as number[],
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
    updateScatterPlot: false as boolean,
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
  }),

  actions: {
    setRegion(regionValue: number) {
      this.regionValue = regionValue;
    },
    getRegion() {
      return this.regionValue;
    },
    setBeams(beams: number[]) {
      this.beams = beams;
    },
    getBeams() {
      return this.beams;
    },
    setSpots(spots: number[]) {
      this.spots = spots;
    },
    getSpots() {
      return this.spots;
    },
    setRgts(rgts: SrListNumberItem[]) {
      console.log('atlChartFilterStore setRgts:', rgts);
      this.rgts = rgts;
    },
    getRgts() {
      console.log('atlChartFilterStore getRgts:', this.rgts);
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
      console.log('atlChartFilterStore.getRgtOptions():', this.rgtOptions);
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
      console.log('atlChartFilterStore.setCycleOptionsWithNumbers():', cycleOptions, ' this.cycleOptions:', this.cycleOptions);
    },
    getCycleOptions() {
      console.log('atlChartFilterStore.getCycleOptions():', this.cycleOptions);
      return this.cycleOptions;
    },
    setCycleWithNumber(cycle: number) {
      console.log('atlChartFilterStore.setCycleWithNumber():', cycle);
      this.setCycles([{ label: cycle.toString(), value: cycle }]);
    },
    setCycles(cycles: SrListNumberItem[]) {
      console.log('atlChartFilterStore.setCycle():', cycles);
      this.cycles = cycles;
    },
    getCycles() {
      console.log('atlChartFilterStore.getCycles():', this.cycles);
      return this.cycles;
    },
    setTracks(tracks: number[]) {
      this.tracks = tracks;
    },
    getTracks() {
      return this.tracks;
    },
    setSelectAllTracks(selectAllTracks: boolean) {
      this.selectAllTracks = selectAllTracks;
    },
    getSelectAllTracks() {
      return this.selectAllTracks;
    },
    setBeamsAndTracksWithGt(gt: number) {
      const parms = getBeamsAndTracksWithGt(gt);
      this.setBeams(parms.beams);
      this.setTracks(parms.tracks);
    },
    setTracksForBeams(input_beams: number[]) {
      const selectedBeamsOptions = input_beams.map(beam => beamsOptions.find(option => option.value === beam)).filter(Boolean) as { name: string, value: number }[];
      const tracks = selectedBeamsOptions.map(beam => tracksOptions.find(track => Number(beam.name.charAt(2)) === track.value)).filter(Boolean).map(track => track!.value);
      this.setTracks(tracks);
    },
    setBeamsForTracks(input_tracks: number[]) {
      const beams = input_tracks.map(track => beamsOptions.find(option => Number(track) === Number(option.name.charAt(2)))).filter(Boolean).map(beam => beam!.value);
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
      return {
        rgt: this.rgts[0]?.value || 1,
        cycle: this.cycles[0]?.value || 1,
        fileName: this.currentFile,
        func: this.func,
        y: this.yDataForChart,
        x: 'x_atc',
        beams: this.beams,
        pair: this.pair,
        scOrient: this.scOrient,
        tracks: this.tracks,
      };
    },
    setUpdateScatterPlot() {
      this.updateScatterPlot = true;
    },
    getUpdateScatterPlot() {
      return this.updateScatterPlot;
    },
    resetUpdateScatterPlot() {
      this.updateScatterPlot = false;
    },
    setIsLoading() {
      this.isLoading = true;
    },
    resetIsLoading() {
      this.isLoading = false;
    },
    getIsLoading() {
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
  },
});
