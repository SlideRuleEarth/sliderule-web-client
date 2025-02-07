import { defineStore } from 'pinia';
import type { SrMenuNumberItem } from "@/types/SrTypes";
import { getBeamsAndTracksWithGts } from '@/utils/parmUtils';
import { beamsOptions, tracksOptions } from '@/utils/parmUtils';
import { type SrListNumberItem } from '@/stores/chartStore';
import { ref } from 'vue';
import VChart from "vue-echarts";



export const useAtlChartFilterStore = defineStore('atlChartFilter', {
  state: () => ({
    debugCnt: 0 as number,
    tracksOptions: tracksOptions as SrListNumberItem[],
    spotsOptions: [{label:'1',value:1},{label:'2',value:2},{label:'3',value:3},{label:'4',value:4},{label:'5',value:5},{label:'6',value:6}] as SrListNumberItem[],
    pairOptions: [{ label: '0', value: 0 }, { label: '1', value: 1 }] as SrListNumberItem[],
    scOrientOptions: [{ label: '0', value: 0 }, { label: '1', value: 1 }] as SrListNumberItem[],
    isLoading: false as boolean,
    chartDataRef: ref<number[][]>([]),
    largeData: false as boolean,
    largeDataThreshold: 1000000 as number,
    plotRef: null as InstanceType<typeof VChart> | null, 
    selectedOverlayedReqIds: [] as number[],
    message: '' as string,
    isWarning: true as boolean,
    showMessage: false as boolean,
    showPhotonCloud: false as boolean,
  }),

  getters: {

  },
  actions: {
    setTrackOptions(trackOptions: SrListNumberItem[]) {
      this.tracksOptions = trackOptions;
    },
    getTrackOptions():SrListNumberItem[] {
      return this.tracksOptions;
    },
    setTrackOptionsWithNumbers(tracks: number[]) {
      this.setTrackOptions(tracks.map(track => ({ label: track.toString(), value: track })));
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
    setPairOptions(pairs: SrListNumberItem[]) {
      this.pairOptions = pairs;
    },
    setPairOptionsWithNumbers(pairs: number[]) {
      this.pairOptions = pairs.map(pair => ({ label: pair.toString(), value: pair }));
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
    setPlotRef(ref: InstanceType<typeof VChart> | null) {
      this.plotRef = ref;
    },
    getPlotRef() {
      return this.plotRef;
    },
    getSelectedOverlayedReqIds() {
      return this.selectedOverlayedReqIds;
    },
    setSelectedOverlayedReqIds(selectedOverlayedReqIds: number[]) {
      this.selectedOverlayedReqIds = selectedOverlayedReqIds;
    },
    appendToSelectedOverlayedReqIds(reqId: number) {
      const reqIdExists = this.selectedOverlayedReqIds.includes(reqId);
      if(!reqIdExists){
        this.selectedOverlayedReqIds.push(reqId);
      } else {
        console.warn('appendToSelectedOverlayedReqIds: reqId:', reqId, 'already exists in selectedOverlayedReqIds:', this.selectedOverlayedReqIds);
      }
    },
    setShowMessage(showMessage: boolean) { 
        this.showMessage = showMessage;
    },
    getShowMessage(): boolean {
        return this.showMessage;
    },
    setMessage(message: string) {
        this.message = message;
    },
    getMessage() {
        return this.message;
    },
    setIsWarning(isWarning: boolean) {
        this.isWarning = isWarning;
    },
    getIsWarning() {
        return this.isWarning;
    },
    setShowPhotonCloud(showPhotonCloud: boolean) {
        this.showPhotonCloud = showPhotonCloud;
    },
    getShowPhotonCloud() {
        return this.showPhotonCloud;
    },
    // getSelectedReqIdMenuItem() : SrMenuNumberItem {
    //   return this.selectedReqIdMenuItem;
    // },
    // setSelectedReqIdMenuItem(selectedReqIdMenuItem: SrMenuNumberItem) {
    //   this.selectedReqIdMenuItem = selectedReqIdMenuItem;
    // },
}
});
