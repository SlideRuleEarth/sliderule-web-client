import { defineStore } from 'pinia';
import { ref } from 'vue';
import VChart from "vue-echarts";



export const useAtlChartFilterStore = defineStore('atlChartFilter', {
  state: () => ({
    debugCnt: 0 as number,
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
    xZoomStart: 0 as number,
    xZoomEnd: 100 as number,
    yZoomStart: 0 as number,
    yZoomEnd: 100 as number,
    showSlopeLines: false as boolean, // Optional property for slope lines
  }),

  getters: {

  },
  actions: {
    incrementDebugCnt() {
      return ++this.debugCnt;
    },
    getDebugCnt() {
      return this.debugCnt;
    },
    setDebugCnt(cnt: number) {
      this.debugCnt = cnt;
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
      const selectedOverlayedReqIds = this.selectedOverlayedReqIds;
      console.log('getSelectedOverlayedReqIds:', selectedOverlayedReqIds, 'length:', selectedOverlayedReqIds.length);
      return selectedOverlayedReqIds;
    },
    setSelectedOverlayedReqIds(selectedOverlayedReqIds: number[]) {
      console.log('setSelectedOverlayedReqIds old:',this.selectedOverlayedReqIds,'new:', selectedOverlayedReqIds);
      console.log('setSelectedOverlayedReqIds old len:',this.selectedOverlayedReqIds.length,'new len:', selectedOverlayedReqIds.length);
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
}
});
