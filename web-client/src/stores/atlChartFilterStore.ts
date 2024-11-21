import { ref, computed } from 'vue';
import { defineStore } from 'pinia';
import { getBeamsAndTracksWithGts } from '@/utils/parmUtils';
import { beamsOptions as importedBeamsOptions, tracksOptions as importedTracksOptions } from '@/utils/parmUtils';
import { getHeightFieldname } from '@/utils/SrParquetUtils';
import VChart from 'vue-echarts';
import type { SrScatterOptionsParms } from '@/utils/parmUtils';
import type { get } from 'lodash';

export interface SrListNumberItem {
  label: string;
  value: number;
}

export interface ElevationDataOption {
  name: string;
  value: string;
}

export const useAtlChartFilterStore = defineStore('atlChartFilter', () => {
  // State
  const debugCnt = ref<number>(0);
  const tracks = ref<SrListNumberItem[]>([]);
  const tracksOptions = ref<SrListNumberItem[]>(importedTracksOptions);
  const selectAllTracks = ref<boolean>(true);
  const beams = ref<SrListNumberItem[]>([]);
  const spots = ref<SrListNumberItem[]>([]);
  const rgts = ref<SrListNumberItem[]>([]);
  const rgtOptions = ref<SrListNumberItem[]>([]);
  const cycles = ref<SrListNumberItem[]>([]);
  const cycleOptions = ref<SrListNumberItem[]>([]);
  const regionValue = ref<number>(1);
  const currentFile = ref<string>('');
  const currentReqId = ref<number>(0);
  const min_x = ref<number>(0);
  const max_x = ref<number>(0);
  const min_y = ref<number>(0);
  const max_y = ref<number>(0);
  const updateScatterPlotCnt = ref<number>(0);
  const elevationDataOptions = ref<ElevationDataOption[]>([{ name: 'not_set', value: 'not_set' }]);
  const ndxOfElevationDataOptionsForHeight = ref<number>(0);
  const yDataForChart = ref<string[]>([]);
  const xDataForChart = ref<string>('x_atc');
  const func = ref<string>('xxx');
  const pairs = ref<SrListNumberItem[]>([]);
  const pairOptions = ref<SrListNumberItem[]>([{ label: '0', value: 0 }, { label: '1', value: 1 }]);
  const scOrients = ref<SrListNumberItem[]>([]);
  const scOrientOptions = ref<SrListNumberItem[]>([{ label: '0', value: 0 }, { label: '1', value: 1 }]);
  const size = ref<number>(0);
  const isLoading = ref<boolean>(false);
  const clear_scatter_plot_flag = ref<boolean>(false);
  const atl03QuerySql = ref<string>('');
  const atl03spWhereClause = ref<string>('');
  const atl03vpWhereClause = ref<string>('');
  const atl06WhereClause = ref<string>('');
  const atl08WhereClause = ref<string>('');
  const atl06QuerySql = ref<string>('');
  const atl08QuerySql = ref<string>('');
  const atl03spSymbolSize = ref<number>(1);
  const atl03vpSymbolSize = ref<number>(5);
  const atl06SymbolSize = ref<number>(5);
  const atl08SymbolSize = ref<number>(5);
  const message = ref<string>('Failed to load data. Please try again later.');
  const isWarning = ref<boolean>(false);
  const showMessage = ref<boolean>(false);
  const recCnt = ref<number>(0);
  const largeData = ref<boolean>(false);
  const largeDataThreshold = ref<number>(1000000);
  const numOfPlottedPnts = ref<number>(0);
  const plotRef = ref<InstanceType<typeof VChart> | null>(null);
  const selectedAtl03YapcColorMap = ref<ElevationDataOption>({ name: 'viridis', value: 'viridis' });
  const xLegend = ref<string>('Meters');

  // Computed properties
  const region = computed(() => regionValue.value);
  const beamValues = computed(() => beams.value.map((beam) => beam.value));
  const spotValues = computed(() => spots.value.map((spot) => spot.value));
  const rgtValues = computed(() => rgts.value.map((rgt) => rgt.value));
  const cycleValues = computed(() => cycles.value.map((cycle) => cycle.value));
  const trackValues = computed(() => tracks.value.map((track) => track.value));
  const pairValues = computed(() => pairs.value.map((pair) => pair.value));
  const scOrientValues = computed(() => scOrients.value.map((scOrient) => scOrient.value));

  // Methods
  function setRegion(value: number) {
    regionValue.value = value;
  }

  function setReqId(reqId: number) {
    currentReqId.value = reqId;
  }

  function setMinX(value: number) {
    min_x.value = value;
  }

  function setMaxX(value: number) {
    max_x.value = value;
  }

  function setNumOfPlottedPnts(count: number) {
    numOfPlottedPnts.value = count;
  }

  function setBeams(value: SrListNumberItem[]) {
    beams.value = value;
  }

  function setTracks(value: SrListNumberItem[]) {
    tracks.value = value;
  }

  function setTracksWithNumber(track: number) {
    setTracks([{ label: track.toString(), value: track }]);
  }

  function setBeamsForTracks(input_tracks: SrListNumberItem[]) {
    const beams = input_tracks
      .map(track => importedBeamsOptions.find(option => Number(track) === Number(option.label.charAt(2))))
      .filter((beam): beam is SrListNumberItem => beam !== undefined);
    setBeams(beams);
    //console.log('atlChartFilterStore.setBeamsForTracks(',input_tracks,') beams:', beams);
  };
  
  function setBeamsAndTracksWithGts(gts: SrListNumberItem[]) {
    //console.log('atlChartFilterStore.setBeamsAndTracksWithGts(',gt,')');
    const parms = getBeamsAndTracksWithGts(gts);
    setBeams(parms.beams);
    setTracks(parms.tracks);
  };

  function setPairOptionsWithNumbers(pairsInput: number[]) {
    pairOptions.value = pairsInput.map((pair) => ({
      label: pair.toString(),
      value: pair,
    }));
  }

  function setTrackOptionsWithNumbers(tracksInput: number[]) {
    tracksOptions.value = tracksInput.map((track) => ({
      label: track.toString(),
      value: track,
    }));
  }

  function setScOrientOptionsWithNumbers(options: number[]) {
    scOrientOptions.value = options.map((option) => ({
      label: option.toString(),
      value: option,
    }));
  }

  function setCycleOptionsWithNumbers(cycleOptionsInput: number[]) {
    if (!Array.isArray(cycleOptionsInput)) {
      console.error('cycleOptionsInput is not an array:', cycleOptionsInput);
      return;
    }
    cycleOptions.value = cycleOptionsInput.map((option) => ({
      label: option.toString(),
      value: option,
    }));
  }

  function setXLegend(value: string) {
    xLegend.value = value;
  }

  function getSymbolSize(funcInput: string): number {
    if (funcInput.includes('atl03sp')) {
      return atl03spSymbolSize.value;
    } else if (funcInput.includes('atl03vp')) {
      return atl03vpSymbolSize.value;
    } else if (funcInput.includes('atl06')) {
      return atl06SymbolSize.value;
    } else if (funcInput.includes('atl08')) {
      return atl08SymbolSize.value;
    } else {
      console.warn('getSymbolSize() unknown function:', funcInput);
      return 5;
    }
  }

  function setAtl08QuerySql(sql: string) {
    atl08QuerySql.value = sql;
  }

  async function setElevationDataOptionsFromFieldNames(fieldNames: string[]) {
    const tmpElevationDataOptions = fieldNames.map((fieldName) => ({
      name: fieldName,
      value: fieldName,
    }));
    const heightFieldname = await getHeightFieldname(currentReqId.value);
    ndxOfElevationDataOptionsForHeight.value = tmpElevationDataOptions.findIndex((option) => option.name === heightFieldname);
    elevationDataOptions.value = tmpElevationDataOptions;
  };
  
  function getElevationDataOptions() {
    return elevationDataOptions;
  };

  function setAtl03QuerySql(sql: string) {
    atl03QuerySql.value = sql;
  };

  function setRgtOptionsWithNumbers(tmpRgtOptions: number[]) {
    if (!Array.isArray(tmpRgtOptions)) {
      console.error('rgtOptions is not an array:', rgtOptions);
      return;
    }
    rgtOptions.value = tmpRgtOptions.map(option => ({ label: option.toString(), value: option }));
    //console.log('atlChartFilterStore.setRgtOptionsWithNumbers():', rgtOptions,' rgtOptions:', rgtOptions);
  };

  function setAtl06QuerySql(sql: string) {
    atl06QuerySql.value = sql;
  }

  function getRgts() : SrListNumberItem[] {
    return rgts.value;
  }

  function setRgts(value: SrListNumberItem[]) {
    rgts.value = value;
  }

  function getCycles() : SrListNumberItem[] {
    return cycles.value;
  }

  function setCycles(value: SrListNumberItem[]) {
    cycles.value = value;
  }

  function getScOrients() : SrListNumberItem[] {
    return scOrients.value;
  }

  function setScOrients(value: SrListNumberItem[]) {
    scOrients.value = value;
  }
  function getTracks() : SrListNumberItem[] {
    return tracks.value;
  }

  function getBeams() : SrListNumberItem[] {
    return beams.value;
  }

  function getPairs() : SrListNumberItem[] {
    return pairs.value;
  }

  function setPairs(value: SrListNumberItem[]) :  void {
    pairs.value = value;
  }

  function getSpots() : SrListNumberItem[] {
    return spots.value;
  }

  function setSpots(value: SrListNumberItem[]) {
    spots.value = value;
  }

  function setRecCnt(value: number) {
    recCnt.value = value;
  }

  function setSize(value: number) {
    size.value = value;
  }

  function setFileName(value: string) {
    currentFile.value = value;
  }

  function setFunc(funcInput: string) {
    func.value = funcInput;
  }

  function getFunc() : string {
    return func.value;
  }

  function appendScOrientWithNumber(scOrient: number) : void {
    const scoExists = scOrients.value.some(sco => sco.value === scOrient);
    if(!scoExists && (scOrient >= 0)){
      scOrients.value.push({ label: scOrient.toString(), value: scOrient });
    }
  };

  function appendPairWithNumber(pair: number) : void {
    const pairExists = pairs.value.some(p => p.value === pair);
    if(!pairExists){
      pairs.value.push({ label: pair.toString(), value: pair });
    }
  };

  function appendTrackWithNumber(track: number) : void {
    // Check if the track already exists in the list
    const trackExists = tracks.value.some(t => t.value === track);
    // If it doesn't exist, append it
    if (!trackExists) {
      tracks.value.push({ label: track.toString(), value: track });
    }
  };   

  function setAtl03spWhereClause(whereClause: string) : void {
    atl03spWhereClause.value = whereClause;
  }

  function setAtl03vpWhereClause(whereClause: string) : void {
    atl03vpWhereClause.value = whereClause;
  }

  function setAtl08WhereClause(whereClause: string) : void {
    atl08WhereClause.value = whereClause;
  }

  function setAtl06WhereClause(whereClause: string) : void {
    atl06WhereClause.value = whereClause;
  }

  function incrementUpdateScatterPlotCnt() : void {
    updateScatterPlotCnt.value += 1;
  }

  function setDebugCnt(value: number) : void {
    debugCnt.value = value;
  }

  function getCycleOptions(): SrListNumberItem[] {
    return cycleOptions.value;
  }

  function getNdxOfElevationDataOptionsForHeight(): number {
    return ndxOfElevationDataOptionsForHeight.value;
  }

  function setPlotRef(ref: InstanceType<typeof VChart> | null) {
    plotRef.value = ref;
  };

  function getPlotRef(): InstanceType<typeof VChart> | null {
    return plotRef.value;
  }

  function getReqId(): number {
    return currentReqId.value;
  }

  function resetClearScatterPlotFlag(){
    clear_scatter_plot_flag.value = false;
  }

  function getLargeData(): boolean {
    return largeData.value;
  }

  function setLargeData(value: boolean) {
    largeData.value = value;
  }

  function getLargeDataThreshold(): number {
    return largeDataThreshold.value;
  }

  function setLargeDataThreshold(value: number) {
    largeDataThreshold.value = value;
  }

  function getSqlStmnt(func: string) {
    switch (func) {
      case 'atl03sp':
        return atl03QuerySql.value;
      case 'atl03vp':
        return atl03QuerySql.value;
      case 'atl06p':
        return atl06QuerySql.value;
      case 'atl06sp':
        return atl06QuerySql.value;
      case 'atl08p':
        return atl08QuerySql.value;
      default:
        return '';
    }
  };

  function setScOrientWithNumber(scOrient: number) {
    scOrients.value = [{ label: scOrient.toString(), value: scOrient }];
  }

  function setPairWithNumber(pair: number) {
    pairs.value = [{ label: pair.toString(), value: pair }];
  };

  function setSpotsWithNumber(spot: number) {
    //console.log('atlChartFilterStore.setSpotsWithNumber():', spot);
    setSpots([{ label: spot.toString(), value: spot }]);
  }

  function setRgtWithNumber(rgt: number) {
    //console.log('atlChartFilterStore.setRgtWithNumber():', rgt);
    setRgts([{ label: rgt.toString(), value: rgt }]);
  };

  function setCyclesWithNumber(cycle: number) {
    //console.log('atlChartFilterStore.setCyclesWithNumber():', cycle);
    setCycles([{ label: cycle.toString(), value: cycle }]);
  };

  function setBeamsWithNumber(beam: number) {
    setBeams([{ label: importedBeamsOptions.find(option => option.value === beam)?.label || '', value: beam }]);
  };

  function setShowMessage(value: boolean) {
    showMessage.value = value;
  }

  function getShowMessage() {
    return showMessage;
  };

  function setIsWarning(value: boolean) {
    isWarning.value = value;
  }

  function setMessage(value: string) {
    message.value = value;
  }

  function setIsLoading() {
    isLoading.value = true;
  }

  function resetIsLoading() {
    //console.log('atlChartFilterStore.resetIsLoading()');
    isLoading.value = false;
  };

  function setXDataForChartUsingFunc(func: string) {
    if (func.includes('atl03')) {
      xDataForChart.value ='x_atc';
      if (func.includes('atl03vp')) {
        xDataForChart.value ='segment_dist_x';
      }
    } else if (func.includes('atl06')) {
      xDataForChart.value = 'x_atc';
    } else if (func.includes('atl08')) {
      xDataForChart.value = 'x_atc';
    } else {
      console.error('setXDataForChartFromFunc() unknown function:', func);
    }
  }

  function getCycleValues() {
    return cycles.value.map(cycle => cycle.value);
  };

  function getSpotValues() {
    return spots.value.map(spot => spot.value);
  }

  function getRgtValues() {
    return rgts.value.map(rgt => rgt.value);
  }

  function getRecCnt() {  
    return recCnt.value;
  }

  function getSize() {
    return size.value;
  }

  function getScatterOptionsParms(): SrScatterOptionsParms {
    //console.log('atlChartFilterStore.getScatterOptionsParms() rgts[0]?.value:',rgts[0]?.value);
    const sop =  {
      rgts: rgts.value.map(rgt => rgt?.value).filter(value => value !== undefined),
      cycles: cycles.value.map(cycle => cycle?.value).filter(value => value !== undefined),
      fileName: currentFile.value,
      func: func.value,
      y: yDataForChart.value,
      x: xDataForChart.value,
      beams: beams.value.map(beam => beam.value),
      spots: spots.value.map(spot => spot.value),
      pairs: pairs.value.map(pair => pair.value).filter(value => value !== undefined),
      scOrients: scOrients.value.map(scOrient => scOrient.value).filter(value => value !== undefined),
      tracks: tracks.value.map(track => track.value),
    };
    //console.log('atlChartFilterStore.getScatterOptionsParms():', sop);
    return sop;
  };

  return {
    debugCnt,
    tracks,
    tracksOptions,
    selectAllTracks,
    beams,
    spots,
    rgts,
    rgtOptions,
    cycles,
    cycleOptions,
    regionValue,
    currentFile,
    currentReqId,
    min_x,
    max_x,
    min_y,
    max_y,
    updateScatterPlotCnt,
    elevationDataOptions,
    yDataForChart,
    xDataForChart,
    func,
    pairs,
    pairOptions,
    scOrients,
    scOrientOptions,
    size,
    isLoading,
    clear_scatter_plot_flag,
    atl03QuerySql,
    atl03spWhereClause,
    atl03vpWhereClause,
    atl06WhereClause,
    atl08WhereClause,
    atl06QuerySql,
    atl08QuerySql,
    atl03spSymbolSize,
    atl03vpSymbolSize,
    atl06SymbolSize,
    atl08SymbolSize,
    message,
    isWarning,
    showMessage,
    recCnt,
    largeData,
    largeDataThreshold,
    numOfPlottedPnts,
    plotRef,
    selectedAtl03YapcColorMap,
    xLegend,
    region,
    beamValues,
    spotValues,
    rgtValues,
    cycleValues,
    trackValues,
    pairValues,
    scOrientValues,
    setRegion,
    setReqId,
    setMinX,
    setMaxX,
    setNumOfPlottedPnts,
    getBeams,
    setBeams,
    getTracks,
    setTracks,
    setTracksWithNumber,
    setPairOptionsWithNumbers,
    setTrackOptionsWithNumbers,
    setScOrientOptionsWithNumbers,
    setCycleOptionsWithNumbers,
    setAtl08QuerySql,
    setXLegend,
    getSymbolSize,
    setElevationDataOptionsFromFieldNames,
    getElevationDataOptions,
    setAtl03QuerySql,
    setRgtOptionsWithNumbers,
    setAtl06QuerySql,
    getRgts,
    setRgts,
    getCycles,
    setCycles,
    getScOrients,
    setScOrients,
    getPairs,
    setPairs,
    getSpots,
    setSpots,
    setRecCnt,
    setSize,
    setFileName,
    setFunc,
    appendScOrientWithNumber,
    appendPairWithNumber,
    appendTrackWithNumber,
    setAtl03spWhereClause,
    setAtl03vpWhereClause,
    setAtl08WhereClause,
    setAtl06WhereClause,
    incrementUpdateScatterPlotCnt,
    setDebugCnt,
    getCycleOptions,
    getNdxOfElevationDataOptionsForHeight,
    setPlotRef,
    getReqId,
    resetClearScatterPlotFlag,
    getLargeData,
    setLargeData,
    getLargeDataThreshold,
    setLargeDataThreshold,
    getSqlStmnt,
    setBeamsForTracks,
    setBeamsAndTracksWithGts,
    setScOrientWithNumber,
    setPairWithNumber,
    setSpotsWithNumber,
    setRgtWithNumber,
    setCyclesWithNumber,
    setBeamsWithNumber,
    setShowMessage,
    setIsWarning,
    setMessage,
    setIsLoading,
    setXDataForChartUsingFunc,
    getScatterOptionsParms,
    resetIsLoading,
    getFunc,
    getCycleValues,
    getSpotValues,
    getRgtValues,
    getRecCnt,
    getSize,
    getShowMessage,
    getPlotRef,
  };
});
