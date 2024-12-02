import { defineStore } from 'pinia';
import { getBeamsAndTracksWithGts } from '@/utils/parmUtils';
import { beamsOptions, tracksOptions } from '@/utils/parmUtils';
import { ref } from 'vue';
import VChart from "vue-echarts";
import { get, set } from 'lodash';

export interface SrListNumberItem {
  label: string;
  value: number;
}

export const useAtlChartFilterStore = defineStore('atlChartFilter', {
  state: () => ({
    debugCnt: 0 as number,
    tracks: [] as SrListNumberItem[],
    tracksOptions: tracksOptions as SrListNumberItem[],
    selectAllTracks: true as boolean,
    beams: [] as SrListNumberItem[],
    spotsOptions: [{label:'1',value:1},{label:'2',value:2},{label:'3',value:3},{label:'4',value:4},{label:'5',value:5},{label:'6',value:6}] as SrListNumberItem[],
    spots: [] as SrListNumberItem[],
    rgts: [] as SrListNumberItem[],
    rgtOptions: [] as SrListNumberItem[], // Ensure rgtOptions is an array
    cycles: [] as SrListNumberItem[],
    cycleOptions: [] as SrListNumberItem[],
    regionValue: 1 as number,
    currentReqId: 0 as number,
    updateScatterPlotCnt: 0 as number,
    func:  {} as Record<string, string>, // Keyed by req_id
    pairs: [] as SrListNumberItem[],
    pairOptions: [{ label: '0', value: 0 }, { label: '1', value: 1 }] as SrListNumberItem[],
    scOrients: [] as SrListNumberItem[],
    scOrientOptions: [{ label: '0', value: 0 }, { label: '1', value: 1 }] as SrListNumberItem[],
    isLoading: false as boolean,
    clearScatterPlotFlag: false as boolean,
    chartDataRef: ref<number[][]>([]),
    atl03spSymbolSize: 1 as number,
    atl03vpSymbolSize: 5 as number,
    atl06SymbolSize: 5 as number,
    atl08SymbolSize: 5 as number,
    largeData: false as boolean,
    largeDataThreshold: 1000000 as number,
    numOfPlottedPnts: 0 as number,
    plotRef: null as InstanceType<typeof VChart> | null, 
    selectedAtl03YapcColorMap: {name:'viridis', value:'viridis'} as {name:string, value:string},
    selectedOverlayedReqIds: [] as number[],
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
      //console.log('atlChartFilterStore setSpots:', spots);
      this.spots = spots;
    },
    getSpots(): SrListNumberItem[] {
      return this.spots;
    },
    getSpotValues() {
      return this.spots.map(spot => spot.value);
    },
    setSpotWithNumber(spot: number) {
      //console.log('atlChartFilterStore.setSpotWithNumber():', spot);
      this.setSpots([{ label: spot.toString(), value: spot }]);
    },
    setRgts(rgts: SrListNumberItem[]) {
      //console.log('atlChartFilterStore setRgts:', rgts);
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
      //console.log('atlChartFilterStore.setRgtOptionsWithNumbers():', rgtOptions,' this.rgtOptions:', this.rgtOptions);
    },
    getRgtOptions() {
      //console.log('atlChartFilterStore.getRgtOptions():', this.rgtOptions);
      return this.rgtOptions;
    },
    setRgtWithNumber(rgt: number) {
      //console.log('atlChartFilterStore.setRgtWithNumber():', rgt);
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
      //console.log('atlChartFilterStore.setCycleWithNumber():', cycle);
      this.setCycles([{ label: cycle.toString(), value: cycle }]);
    },
    setCycles(cycles: SrListNumberItem[]) {
      //console.log('atlChartFilterStore.setCycles():', cycles);
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
    setTrackOptions(trackOptions: SrListNumberItem[]) {
      this.tracksOptions = trackOptions;
    },
    getTrackOptions() {
      return this.tracksOptions;
    },
    setTrackWithNumber(track: number) {
      this.setTracks([{ label: track.toString(), value: track }]);
      //console.log('atlChartFilterStore.setTrackWithNumber(', track,') tracks:', this.tracks);
    },
    setTrackOptionsWithNumbers(tracks: number[]) {
      this.setTrackOptions(tracks.map(track => ({ label: track.toString(), value: track })));
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
    appendTrackWithNumber(track: number) {
      // Check if the track already exists in the list
      const trackExists = this.tracks.some(t => t.value === track);
      // If it doesn't exist, append it
      if (!trackExists) {
        this.tracks.push({ label: track.toString(), value: track });
      }
    },    
    setBeamsAndTracksWithGts(gts: SrListNumberItem[]) {
      //console.log('atlChartFilterStore.setBeamsAndTracksWithGts(',gt,')');
      const parms = getBeamsAndTracksWithGts(gts);
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
    getReqId(): number {
      return this.currentReqId;
    },
    getReqIdStr():string {
      return this.currentReqId.toString();
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
    setFunc(req_id:string, func: string) {
      this.func[req_id] = func;
    },
    getFunc(req_id?:string) {
      if(req_id){
        return this.func[req_id];
      }
      const values = Object.values(this.func);
      return values.length === 1 ? values[0] : values.join(',');
    },
    setPairs(pairs: SrListNumberItem[]) {
      this.pairs = pairs;
    },
    getPairs() {
      return this.pairs;
    },
    setPairOptions(pairs: SrListNumberItem[]) {
      this.pairOptions = pairs;
    },
    getPairOptions() {
      return this.pairOptions;
    },
    setPairOptionsWithNumbers(pairs: number[]) {
      this.pairOptions = pairs.map(pair => ({ label: pair.toString(), value: pair }));
    },
    setPairWithNumber(pair: number) {
      this.pairs = [{ label: pair.toString(), value: pair }];
    },
    appendPairWithNumber(pair: number) {
      const pairExists = this.pairs.some(p => p.value === pair);
      if(!pairExists){
        this.pairs.push({ label: pair.toString(), value: pair });
      }
    },
    getPairValues() {
      return this.pairs.map(pair => pair.value);
    },
    setScOrients(scOrients: SrListNumberItem[]) {
      this.scOrients = scOrients;
    },
    getScOrients() {
      return this.scOrients;
    },
    setScOrientOptions(scOrientOptions: SrListNumberItem[]) {
      this.scOrientOptions = scOrientOptions;
    },
    getScOrientOptions() {
      return this.scOrientOptions;
    },
    setScOrientOptionsWithNumbers(scOrientOptions: number[]) {
      this.scOrientOptions = scOrientOptions.map(option => ({ label: option.toString(), value: option }));
    },
    setScOrientWithNumber(scOrient: number) {
      this.scOrients = [{ label: scOrient.toString(), value: scOrient }];
    },
    getScOrientValues() {
      return this.scOrients.map(scOrient => scOrient.value);
    },
    appendScOrientWithNumber(scOrient: number) {
      const scoExists = this.scOrients.some(sco => sco.value === scOrient);
      if(!scoExists && (scOrient >= 0)){
        this.scOrients.push({ label: scOrient.toString(), value: scOrient });
      }
    },
    updateScatterPlot() {
      this.updateScatterPlotCnt += 1;
      //console.log('atlChartFilterStore.updateScatterPlot():', this.updateScatterPlotCnt);
    },
    setIsLoading() {
      //console.log('atlChartFilterStore.setIsLoading()');
      this.isLoading = true;
    },
    resetIsLoading() {
      //console.log('atlChartFilterStore.resetIsLoading()');
      this.isLoading = false;
    },
    getIsLoading() {
      //console.log('atlChartFilterStore.getIsLoading():', this.isLoading);
      return this.isLoading;
    },
    resetTheScatterPlot() {
      this.clearScatterPlotFlag = true;
    },
    resetClearScatterPlotFlag() {
      this.clearScatterPlotFlag = false;
    },
    getClearPlot() {
      return this.clearScatterPlotFlag;
    },
    setAtl03spSymbolSize(size: number) {
      this.atl03spSymbolSize = size;
    },
    getAtl03spSymbolSize() {
      return this.atl03spSymbolSize;
    },
    setAtl03vpSymbolSize(size: number) {
      this.atl03vpSymbolSize = size;
    },
    getAtl03vpSymbolSize() {
      return this.atl03vpSymbolSize;
    },
    setAtl06SymbolSize(size: number) {
      this.atl06SymbolSize = size;
    },
    getAtl06SymbolSize() {
      return this.atl06SymbolSize;
    },
    setAtl08SymbolSize(size: number) {
      this.atl08SymbolSize = size;
    },
    getAtl08SymbolSize() {
      return this.atl08SymbolSize;
    },
    getSymbolSize(func:string) {
      if(func.includes('atl03sp')){
        return this.atl03spSymbolSize;
      } else if(func.includes('atl03vp')){
        return this.atl03vpSymbolSize;
      } else if(func.includes('atl06')){
        return this.atl06SymbolSize;
      } else if(func.includes('atl08')){
        return this.atl08SymbolSize;
      } else {
        console.warn('getSymbolSize() unknown function:',func);
        return 5;
      }        
    },
    getLargeData() {
      return this.largeData;
    },
    setLargeData(largeData: boolean) {
        this.largeData = largeData;
    },
    getLargeDataThreshold() {
        return this.largeDataThreshold;
    },
    setLargeDataThreshold(largeDataThreshold: number) {
        this.largeDataThreshold = largeDataThreshold;
    },
    getNumOfPlottedPnts() {
      return this.numOfPlottedPnts;
    },
    setNumOfPlottedPnts(numOfPlottedPnts: number) {
        this.numOfPlottedPnts = numOfPlottedPnts;
    },
    setPlotRef(ref: InstanceType<typeof VChart> | null) {
      this.plotRef = ref;
    },
    getPlotRef() {
      return this.plotRef;
    },
    getSelectedAtl03ColorMap() {
      return this.selectedAtl03YapcColorMap;
    },
    setSelectedAtl03ColorMap(selectedAtl03YapcColorMap: {name:string, value:string}) {
      this.selectedAtl03YapcColorMap = selectedAtl03YapcColorMap;
    },
    getSelectedOverlayedReqIds() {
      return this.selectedOverlayedReqIds;
    },
    setSelectedOverlayedReqIds(selectedOverlayedReqIds: number[]) {
      this.selectedOverlayedReqIds = selectedOverlayedReqIds;
    },
  }
});
