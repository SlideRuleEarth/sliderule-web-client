<template>
  <div class="sr-layout-wrapper">
    <div class="sr-main-content card">
      <!-- v-model binds to activeIndex so we know which tab is selected -->
      <Tabs v-model:value="activeTabStore.activeTab">
        <TabList>
          <Tab value="0">{{ activeTabStore.getTabLabelByIndex('0') }}</Tab>
          <Tab value="1" v-if="mission === 'ICESat-2'">{{
            activeTabStore.getTabLabelByIndex('1')
          }}</Tab>
          <Tab value="2">{{ activeTabStore.getTabLabelByIndex('2') }}</Tab>
          <Tab value="3">{{ activeTabStore.getTabLabelByIndex('3') }}</Tab>
        </TabList>

        <TabPanels>
          <TabPanel value="0">
            <!-- Only render SrElevationPlot if active tab is '0' AND your other condition is met -->
            <SrElevationPlot v-if="shouldDisplayElevationPlot" :startingReqId="reqId" />
          </TabPanel>
          <TabPanel
            value="1"
            v-if="mission === 'ICESat-2' && recTreeStore.selectedApi.includes('atl08')"
          >
            <!-- Only render SrTimeSeries if active tab is '1' AND your other condition is met -->
            <SrTimeSeries v-if="shouldDisplayTimeSeries" :startingReqId="reqId" />
          </TabPanel>
          <TabPanel value="2">
            <SrDeck3DView v-if="shouldDisplay3DView" />
          </TabPanel>
          <TabPanel value="3">
            <!-- Only render SrRawAnalysis if active tab is '3' -->
            <SrRawAnalysis v-if="shouldDisplayShell" />
          </TabPanel>
        </TabPanels>
      </Tabs>
    </div>
    <div class="sr-elrng3d-panel">
      <SrElRng3D v-if="shouldDisplay3DView" />
      <SrCycleSelect v-if="shouldDisplayCycleSelect" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import Tabs from 'primevue/tabs'
import TabList from 'primevue/tablist'
import Tab from 'primevue/tab'
import TabPanels from 'primevue/tabpanels'
import TabPanel from 'primevue/tabpanel'
import SrElevationPlot from '@/components/SrElevationPlot.vue'
import SrRawAnalysis from '@/components/SrRawAnalysis.vue'
import { useRecTreeStore } from '@/stores/recTreeStore'
import { useActiveTabStore } from '@/stores/activeTabStore'
import { useGlobalChartStore } from '@/stores/globalChartStore'
import { useChartStore } from '@/stores/chartStore'
import { useFieldNameStore } from '@/stores/fieldNameStore'
import { useRoute } from 'vue-router'
import SrTimeSeries from '@/components/SrTimeSeries.vue'
import SrDeck3DView from '@/components/SrDeck3DView.vue'
import SrElRng3D from '@/components/SrElRng3D.vue'
import SrCycleSelect from './SrCycleSelect.vue'
import { createLogger } from '@/utils/logger'

const logger = createLogger('SrAnalysis')

const route = useRoute()
const recTreeStore = useRecTreeStore()
const activeTabStore = useActiveTabStore()
const globalChartStore = useGlobalChartStore()
const fieldNameStore = useFieldNameStore()
const chartStore = useChartStore()

// The reqId from the route
const reqId = computed(() => Number(route.params.id) || 0)
const mission = computed(() => {
  return fieldNameStore.getMissionForReqId(reqId.value)
})

// In each "shouldDisplay" computed, also check the active tab
const shouldDisplayElevationPlot = computed(() => {
  return (
    activeTabStore.getActiveTab === '0' && // Only show on tab 0
    recTreeStore.selectedReqId > 0 &&
    recTreeStore.allReqIds.includes(reqId.value) &&
    globalChartStore.getSelectedElevationRec() !== null
  )
})

const shouldDisplayTimeSeries = computed(() => {
  return (
    activeTabStore.getActiveTab === '1' && // Only show on tab 1
    recTreeStore.selectedReqId > 0 &&
    recTreeStore.allReqIds.includes(reqId.value)
  )
})

const shouldDisplayShell = computed(() => {
  return (
    activeTabStore.getActiveTab === '3' //&& // Only show on tab 3
    //chartStore.getQuerySql(recTreeStore.selectedReqIdStr) !== ''
  )
})

const shouldDisplay3DView = computed(() => {
  return (
    activeTabStore.getActiveTab === '2' && // Only show on tab 2
    recTreeStore.selectedReqId > 0 &&
    recTreeStore.allReqIds.includes(reqId.value)
  )
})

const shouldDisplayCycleSelect = computed(() => {
  if (reqId.value <= 0 || !recTreeStore.selectedReqIdStr) {
    return false
  }
  const selectedColorEncodeData = chartStore.getSelectedColorEncodeData(
    recTreeStore.selectedReqIdStr
  )
  return shouldDisplay3DView.value && selectedColorEncodeData === 'cycle'
})

onMounted(() => {
  logger.debug('onMounted for SrAnalysis', { reqId: reqId.value })
  activeTabStore.setActiveTab('0')
})

onUnmounted(() => {
  logger.debug('onUnmounted for SrAnalysis')
  activeTabStore.setActiveTab('0') // reset when we leave this component
})
</script>

<style scoped>
:deep(.p-tab) {
  font-size: smaller;
  padding: 0.5rem 2rem;
}

:deep(.p-tabpanels) {
  margin: 0;
  padding-top: 0.5rem;
  padding-right: 0rem;
  padding-bottom: 0rem;
  padding-left: 0rem;
}
.sr-layout-wrapper {
  display: flex;
  flex-direction: row;
  width: 100%;
  height: 100%;
}

.sr-main-content {
  flex: 0 1 95%;
  min-width: 0;
}

.sr-elrng3d-panel {
  flex: 0 1 15%;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  height: 60%;
}

/* SrCycleSelect no-wrap + ellipsize */
:deep(.p-listbox),
:deep(.p-listbox .p-listbox-list),
:deep(.p-listbox .p-listbox-item),
:deep(.p-listbox .p-listbox-header) {
  white-space: nowrap;
}

:deep(.p-listbox .p-listbox-item) {
  overflow: hidden;
  text-overflow: ellipsis; /* if an item is still too long */
}

/* optional: make the header (“Cycles (1)”) stay on one line */
:deep(.p-listbox .p-listbox-header .p-listbox-header-label) {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
