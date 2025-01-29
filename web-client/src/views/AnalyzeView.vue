<script setup lang="ts">
import { useRoute } from 'vue-router';
import TwoColumnLayout from "@/layouts/TwoColumnLayout.vue";
import { onMounted, ref, watch } from 'vue';
import SrAnalyzeOptSidebar from "@/components/SrAnalyzeOptSidebar.vue";
import SrScatterPlot from "@/components/SrScatterPlot.vue";
import { useRecTreeStore } from "@/stores/recTreeStore";

const recTreeStore = useRecTreeStore();
const route = useRoute();
const reqId = ref(Number(route.params.id));

onMounted(async () => {
    console.log('AnalyzeView onMounted Loading AnalyzeView with route specified reqId:', reqId.value, ' route.params.id:', route.params.id, 'recTreeStore.selectedReqId:', recTreeStore.selectedReqId);
    
});

watch(() => route.params.id, async (newId) => {
    let newReqId = Number(newId) || 0;
    reqId.value = newReqId;
    console.log('AnalyzeView watch: Route ID changed to:', newId,' reqId.value:', reqId.value);
});

</script>

<template>
    <TwoColumnLayout>
        <template v-slot:sidebar-col>
            <SrAnalyzeOptSidebar
                v-if="(recTreeStore.selectedReqId > 0)" 
                :startingReqId="reqId"
            />
        </template>
        <template v-slot:main>
            <SrScatterPlot 
                v-if="(recTreeStore.selectedReqId > 0)" 
                :startingReqId="reqId"
            />
        </template>
    </TwoColumnLayout>
</template>

<style scoped>
/* Add any required styles here */
</style>
