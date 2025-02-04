<template>
    <div class="card">
    <Tabs value="0">
        <TabList>
            <Tab value="0">Scatter Plot</Tab>
            <Tab value="1">Sql Query</Tab>
        </TabList>
        <TabPanels>
            <!-- First Tab: Scatter Plot -->
            <TabPanel value="0" >
                <SrScatterPlot 
                    v-if="shouldDisplayScatterPlot" 
                        :startingReqId="reqId"
                />
            </TabPanel>
        
            <!-- Second Tab: DuckDB Shell -->
            <TabPanel value="1">
                <SrDuckDbShell v-if="shouldDisplayShell"/>
            </TabPanel>
        </TabPanels>
    </Tabs>
    </div>
</template>

<script setup lang="ts">
import Tabs from 'primevue/tabs';
import TabList from 'primevue/tablist';
import Tab from 'primevue/tab';
import TabPanel from 'primevue/tabpanel';
import TabPanels from 'primevue/tabpanels';
import { computed } from 'vue';
import SrScatterPlot from '@/components/SrScatterPlot.vue';
import SrDuckDbShell from '@/components/SrDuckDbShell.vue';
import { useRecTreeStore } from '@/stores/recTreeStore';
import { useRoute } from 'vue-router';
import { useChartStore } from '@/stores/chartStore';


const route = useRoute();
const recTreeStore = useRecTreeStore();
const chartStore = useChartStore();
const reqId = computed(() => Number(route.params.id) || 0);

const shouldDisplayScatterPlot = computed(() => {
    return ((recTreeStore.selectedReqId > 0)&&(recTreeStore.allReqIds.includes(reqId.value)));
});

const shouldDisplayShell = computed(() => {
    return (chartStore.getQuerySql(recTreeStore.selectedReqIdStr) !== '');
});

</script>
  
  
<style scoped>
</style>
  