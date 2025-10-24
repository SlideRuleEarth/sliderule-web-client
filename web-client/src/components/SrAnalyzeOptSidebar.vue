<script setup lang="ts">
import { onMounted, ref, computed } from 'vue'
import SrAnalysisMap from '@/components/SrAnalysisMap.vue'
import SrRecIdReqDisplay from '@/components/SrRecIdReqDisplay.vue'
import { useAnalysisMapStore } from '@/stores/analysisMapStore'
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore'
import SrEditDesc from '@/components/SrEditDesc.vue'
import SrPlotConfig from '@/components/SrPlotConfig.vue'
import SrCustomTooltip from '@/components/SrCustomTooltip.vue'
import SrFilterCntrlIceSat2 from '@/components/SrFilterCntrlIceSat2.vue'
import SrFilterCntrlGedi from '@/components/SrFilterCntrlGedi.vue'
import { useRecTreeStore } from '@/stores/recTreeStore'
import SrImportParquetFile from '@/components/SrImportParquetFile.vue'
import { useFieldNameStore } from '@/stores/fieldNameStore'
import SrExportBtnDlg from './SrExportBtnDlg.vue'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrAnalyzeOptSidebar')

const atlChartFilterStore = useAtlChartFilterStore()
const analysisMapStore = useAnalysisMapStore()
const recTreeStore = useRecTreeStore()
const fieldNameStore = useFieldNameStore()

const props = defineProps({
  startingReqId: {
    type: Number,
    default: 0
  }
})
const tooltipRef = ref()
const loadingThisSFC = ref(true)
const isMounted = ref(false)

const computedInitializing = computed(() => {
  return (
    !isMounted.value ||
    loadingThisSFC.value ||
    recTreeStore.reqIdMenuItems.length == 0 ||
    recTreeStore.selectedReqId <= 0
  )
})
const mission = computed(() => {
  return fieldNameStore.getMissionForReqId(props.startingReqId)
})

onMounted(() => {
  // the router sets the startingReqId and the recTreeStore.reqIdMenuItems
  logger.debug('onMounted SrAnalyzeOptSidebar', { startingReqId: props.startingReqId })
  loadingThisSFC.value = false
  isMounted.value = true
})

const handleFileImported = (_reqId: string) => {
  logger.debug('File import completed', { reqId: _reqId })
}
</script>

<template>
  <div class="sr-analysis-opt-sidebar">
    <SrCustomTooltip ref="tooltipRef" id="sideBarTooltip" />
    <div class="sr-analysis-opt-sidebar-container" v-if="loadingThisSFC">Loading...</div>
    <div class="sr-analysis-opt-sidebar-container" v-else>
      <div class="sr-map-descr">
        <div class="sr-analysis-opt-sidebar-map" ID="AnalysisMapDiv">
          <div v-if="computedInitializing">Loading...{{ recTreeStore.selectedApi }}</div>
          <SrAnalysisMap
            v-else-if="recTreeStore.selectedReqId > 0"
            :selectedReqId="recTreeStore.selectedReqId"
          />
        </div>
        <div class="sr-req-description">
          <SrImportParquetFile @file-imported="handleFileImported" />
          <SrEditDesc :reqId="recTreeStore.selectedReqId" />
          <SrExportBtnDlg
            v-if="recTreeStore.selectedReqId > 0"
            :reqId="recTreeStore.selectedReqId"
          />
        </div>
      </div>
      <div class="sr-sidebar-analysis-opt">
        <div class="sr-analysis-rec-parms">
          <SrRecIdReqDisplay
            :reqId="recTreeStore.selectedReqId"
            :label="`Request Parameters Record:${recTreeStore.selectedReqId}`"
          />
        </div>
        <div class="sr-filter-cntrl-container">
          <SrFilterCntrlIceSat2 v-if="mission === 'ICESat-2'"></SrFilterCntrlIceSat2>
          <SrFilterCntrlGedi v-if="mission === 'GEDI'"></SrFilterCntrlGedi>
        </div>
        <div class="sr-scatterplot-cfg-container">
          <!-- SrPlotConfig for the main req_id -->
          <div class="sr-scatterplot-cfg">
            <SrPlotConfig
              v-if="analysisMapStore.analysisMapInitialized"
              :reqId="recTreeStore.selectedReqId"
            />
          </div>

          <!-- SrPlotConfig for each overlayed req_id -->
          <div
            class="sr-scatterplot-cfg"
            v-for="overlayedReqId in atlChartFilterStore.selectedOverlayedReqIds"
            :key="overlayedReqId"
          >
            <SrPlotConfig
              v-if="analysisMapStore.analysisMapInitialized"
              :reqId="overlayedReqId"
              :isOverlay="true"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<style scoped>
.sr-analysis-opt-sidebar {
  display: flex;
  flex-direction: column;
  width: auto;
  overflow: auto;
}
.sr-analysis-opt-sidebar-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  min-width: 20vw;
  min-height: 20vh;
  max-width: 75vw;
}
.sr-map-descr {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
.sr-analysis-opt-sidebar-map {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  min-height: 200px; /* or any suitable value */
  min-width: 200px; /* or any suitable value */
  width: 100%;
  height: 100%;
  overflow: auto;
}

.sr-req-description {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 0rem;
  margin: 0rem;
  margin-top: 1rem;
  font-size: medium;
  width: 100%;
}

.sr-import-export-btn {
  margin: 1rem;
  width: 10rem;
}

:deep(.sr-import-export-btn:hover) {
  border-width: 1px;
  border-color: var(--primary-color);
  box-shadow:
    0 0 12px var(--p-button-primary-border-color),
    0 0 20px var(--p-button-primary-border-color);
  transition: box-shadow 0.3s ease;
}

.sr-sidebar-analysis-opt {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
  width: 100%;
  margin-top: 1rem;
}

.sr-filter-cntrl-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.sr-pnts-colormap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
}
.sr-analysis-max-pnts {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
}
.sr-analysis-color-map {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;
}
.sr-debug-fieldset-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.5rem;
}
.sr-fieldset {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
}
.sr-user-guide-link {
  display: flex;
  flex-direction: col;
  justify-content: center;
}
.sr-tracks-beams {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
}
.sr-pair-sc-orient {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
}
.sr-sc-orientation {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  font-size: smaller;
}

:deep(.sr-listbox-control) {
  min-height: fit-content;
}

.sr-tracks-beams-panel {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-start;
}

:deep(.sr-analyze-filters) {
  display: flex;
  flex-direction: row;
  justify-content: center;
  min-height: fit-content;
}
.sr-sc-orient-panel {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: center;
}
.sr-link-small-text {
  font-size: smaller;
}

.sr-analysis-rec-parms {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  margin: 0.5rem;
}
:deep(.p-multiselect-option) {
  font-size: smaller;
}
:deep(.p-multiselect) {
  font-size: smaller;
}
:deep(.optionLabel) {
  font-size: smaller;
}
:deep(.p-multiselect-option) {
  font-size: smaller;
}
.sr-analysis-rec-parms {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  margin: 0.5rem;
}
.sr-fieldset {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  margin: 0.25rem;
}
.sr-scatterplot-cfg-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: space-between;
  width: fit-content;
  max-width: 100%;
  margin: 0.25rem;
}
.sr-scatterplot-cfg {
  margin: 0 auto; /*  center it */
}
</style>
