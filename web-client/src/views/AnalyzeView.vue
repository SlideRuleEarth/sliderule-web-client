<script setup lang="ts">
import { useRoute } from 'vue-router';
import TwoColumnLayout from "@/layouts/TwoColumnLayout.vue";
import { onMounted, ref } from 'vue';
import SrAnalyzeOptSidebar from "@/components/SrAnalyzeOptSidebar.vue";
import SrScatterPlot from "@/components/SrScatterPlot.vue";
import { useMapStore } from '@/stores/mapStore';

import { useAnalysisMapStore } from '@/stores/analysisMapStore';
const mapStore = useMapStore();
const analysisMapStore = useAnalysisMapStore();
const route = useRoute();
const reqId = ref(Number(route.params.id));

onMounted(async () => {
    console.log('AnalyzeView onMounted Loading AnalyzeView with ID:', reqId.value);
    
});

</script>

<template>
    <TwoColumnLayout>
        <template v-slot:sidebar-col>
            <SrAnalyzeOptSidebar :startingReqId="reqId"/>
        </template>
        <template v-slot:main>
            <SrScatterPlot v-if="!mapStore.getIsLoading() && !analysisMapStore.getIsLoading() && (mapStore.getCurrentRows()>0)"/>
        </template>
    </TwoColumnLayout>
</template>

<style scoped>

</style>
