<script setup lang="ts">
import { onMounted } from 'vue';
import { useAnalyzeStore } from '@/stores/analyzeStore.js';
import SrAnalysisMap from './SrAnalysisMap.vue';

const analyzeStore = useAnalyzeStore();

onMounted(() => {

    console.log('AnalyzeView onMounted');

});

</script>
<template>
    <div class="sr-analysis-opt-sidebar-container">
       <SrAnalysisMap />
    </div>
</template>
<style scoped>
    .sr-analysis-opt-sidebar-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        margin-top: 1rem;
    }
</style>