<script setup lang="ts">
import { useRoute } from 'vue-router';
import TwoColumnLayout from "@/layouts/TwoColumnLayout.vue";
import { onMounted, ref, watch } from 'vue';
import SrAnalyzeOptSidebar from "@/components/SrAnalyzeOptSidebar.vue";
import SrScatterPlot from "@/components/SrScatterPlot.vue";

const route = useRoute();
const reqId = ref(Number(route.params.id));

onMounted(async () => {
    console.log('AnalyzeView onMounted Loading AnalyzeView with ID:', reqId.value);
    
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
            <SrAnalyzeOptSidebar :startingReqId="reqId"/>
        </template>
        <template v-slot:main>
            <SrScatterPlot :startingReqId="reqId"/>
        </template>
    </TwoColumnLayout>
</template>

<style scoped>
/* Add any required styles here */
</style>
