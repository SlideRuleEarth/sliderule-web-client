<template>
    <div class="card">
        <!-- v-model binds to activeIndex so we know which tab is selected -->
        <Tabs v-model:value="analysisTabStore.activeTab">
            <TabList>
                <Tab value="0">{{ analysisTabStore.getTabLabelByIndex('0') }}</Tab>
                <Tab value="1">{{ analysisTabStore.getTabLabelByIndex('1') }}</Tab>
                <Tab value="2">{{ analysisTabStore.getTabLabelByIndex('2') }}</Tab>
            </TabList>

            <TabPanels>
                <TabPanel value="0">
                    <!-- Only render SrElevationPlot if active tab is '0' AND your other condition is met -->
                    <SrElevationPlot 
                        v-if="shouldDisplayScatterPlot" 
                        :startingReqId="reqId"
                    />
                </TabPanel>
                <TabPanel value="1">
                    <!-- Only render SrTimeSeries if active tab is '1' AND your other condition is met -->
                    <SrTimeSeries 
                        v-if="shouldDisplayTimeSeries" 
                        :startingReqId="reqId"
                    />
                </TabPanel>
                <TabPanel value="2">
                    <!-- Similarly only render SrDuckDbShell if active tab is '1' AND chartStore has a query -->
                    <SrDuckDbShell v-if="shouldDisplayShell" />
                </TabPanel>
            </TabPanels>
        </Tabs>
    </div>
</template>
  
<script setup lang="ts">
    import { ref, computed, onMounted } from 'vue'
    import Tabs from 'primevue/tabs';
    import TabList from 'primevue/tablist';
    import Tab from 'primevue/tab';
    import TabPanels from 'primevue/tabpanels';
    import TabPanel from 'primevue/tabpanel';
    import SrElevationPlot from '@/components/SrElevationPlot.vue';
    import SrDuckDbShell from '@/components/SrDuckDbShell.vue';
    import { useRecTreeStore } from '@/stores/recTreeStore';
    import { useChartStore } from '@/stores/chartStore';
    import { useAnalysisTabStore } from '@/stores/analysisTabStore';
    import { useRoute } from 'vue-router';
    import SrTimeSeries from './SrTimeSeries.vue';

    const route = useRoute();
    const recTreeStore = useRecTreeStore();
    const chartStore = useChartStore();
    const analysisTabStore = useAnalysisTabStore();


    // The reqId from the route
    const reqId = computed(() => Number(route.params.id) || 0);

    // In each "shouldDisplay" computed, also check the active tab
    const shouldDisplayScatterPlot = computed(() => {
        return (
            analysisTabStore.getActiveTab === '0' && // Only show on tab 0
            recTreeStore.selectedReqId > 0 &&
            recTreeStore.allReqIds.includes(reqId.value)
        );
    });

    const shouldDisplayTimeSeries = computed(() => {
        return (
            analysisTabStore.getActiveTab === '1' && // Only show on tab 1
            recTreeStore.selectedReqId > 0 &&
            recTreeStore.allReqIds.includes(reqId.value)
        );
    });

    const shouldDisplayShell = computed(() => {
        return (
            analysisTabStore.getActiveTab === '2' && // Only show on tab 2
            chartStore.getQuerySql(recTreeStore.selectedReqIdStr) !== ''
        );
    });

    onMounted(async () => {
        console.log('onMounted for SrAnalysis with reqId:', reqId.value);
    });
</script>

<style scoped>
:deep(.p-tab){
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

</style>
