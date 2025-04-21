<template>
    <div class="card">
        <!-- v-model binds to activeIndex so we know which tab is selected -->
        <Tabs v-model:value="activeTabStore.activeTab">
            <TabList>
                <Tab value="0">{{ activeTabStore.getTabLabelByIndex('0') }}</Tab>
                <Tab value="1">{{ activeTabStore.getTabLabelByIndex('1') }}</Tab>
                <Tab value="2">{{ activeTabStore.getTabLabelByIndex('2') }}</Tab>
                <Tab value="3">{{ activeTabStore.getTabLabelByIndex('3') }}</Tab>
            </TabList>

            <TabPanels>
                <TabPanel value="0">
                    <!-- Only render SrElevationPlot if active tab is '0' AND your other condition is met -->
                    <SrElevationPlot 
                        v-if="shouldDisplayElevationPlot" 
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
                <TabPanel value="3">
                    <SrDeck3DView v-if="shouldDisplay3DView" />
                </TabPanel>
            </TabPanels>
        </Tabs>
    </div>
</template>
  
<script setup lang="ts">
    import { computed, onMounted, onUnmounted } from 'vue'
    import Tabs from 'primevue/tabs';
    import TabList from 'primevue/tablist';
    import Tab from 'primevue/tab';
    import TabPanels from 'primevue/tabpanels';
    import TabPanel from 'primevue/tabpanel';
    import SrElevationPlot from '@/components/SrElevationPlot.vue';
    import SrDuckDbShell from '@/components/SrDuckDbShell.vue';
    import { useRecTreeStore } from '@/stores/recTreeStore';
    import { useChartStore } from '@/stores/chartStore';
    import { useActiveTabStore } from '@/stores/activeTabStore';
    import { useGlobalChartStore } from '@/stores/globalChartStore';
    import { useRoute } from 'vue-router';
    import SrTimeSeries from './SrTimeSeries.vue';
    import SrDeck3DView from './SrDeck3DView.vue';

    const route = useRoute();
    const recTreeStore = useRecTreeStore();
    const chartStore = useChartStore();
    const activeTabStore = useActiveTabStore();
    const globalChartStore = useGlobalChartStore();


    // The reqId from the route
    const reqId = computed(() => Number(route.params.id) || 0);

    // In each "shouldDisplay" computed, also check the active tab
    const shouldDisplayElevationPlot = computed(() => {
        return (
            activeTabStore.getActiveTab === '0' && // Only show on tab 0
            recTreeStore.selectedReqId > 0 &&
            recTreeStore.allReqIds.includes(reqId.value) &&
            globalChartStore.getSelectedElevationRec() !== null

        );
    });

    const shouldDisplayTimeSeries = computed(() => {
        return (
            activeTabStore.getActiveTab === '1' && // Only show on tab 1
            recTreeStore.selectedReqId > 0 &&
            recTreeStore.allReqIds.includes(reqId.value)
        );
    });

    const shouldDisplayShell = computed(() => {
        return (
            activeTabStore.getActiveTab === '2' && // Only show on tab 2
            chartStore.getQuerySql(recTreeStore.selectedReqIdStr) !== ''
        );
    });

    const shouldDisplay3DView = computed(() => {
        return (
            activeTabStore.getActiveTab === '3' && // Only show on tab 3
            recTreeStore.selectedReqId > 0 &&
            recTreeStore.allReqIds.includes(reqId.value)
        );
    });
    onMounted(async () => {
        console.log('onMounted for SrAnalysis with reqId:', reqId.value);
        activeTabStore.setActiveTab('0');
    });

    onUnmounted(() => {
        console.log('onUnmounted for SrAnalysis');
        activeTabStore.setActiveTab('0'); // reset when we leave this component
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
