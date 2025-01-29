<script setup lang="ts">
import { useRoute,useRouter } from 'vue-router';
import TwoColumnLayout from "@/layouts/TwoColumnLayout.vue";
import { onMounted, ref, watch, computed } from 'vue';
import SrAnalyzeOptSidebar from "@/components/SrAnalyzeOptSidebar.vue";
import SrScatterPlot from "@/components/SrScatterPlot.vue";
import { useRecTreeStore } from "@/stores/recTreeStore";
import { useSrToastStore } from "@/stores/srToastStore";
import { useToast } from "primevue/usetoast";
const router = useRouter();

const recTreeStore = useRecTreeStore();
const route = useRoute();
const reqId = computed(() => Number(route.params.id) || 0);
const srToastStore = useSrToastStore();
const toast = useToast();


const shouldDisplay = computed(() => {
    return ((recTreeStore.selectedReqId > 0)&&(recTreeStore.allReqIds.includes(reqId.value)));
}); 

onMounted(async () => {
    console.log('AnalyzeView onMounted Loading AnalyzeView with route specified reqId:', reqId.value, ' route.params.id:', route.params.id, 'recTreeStore.selectedReqId:', recTreeStore.selectedReqId, 'recTreeStore.allReqIds:', recTreeStore.allReqIds);
    if(recTreeStore.allReqIds.length > 0){
        console.log('AnalyzeView onMounted: recTreeStore.selectedReqId:', recTreeStore.selectedReqId, 'recTreeStore.allReqIds:', recTreeStore.allReqIds);
        if(recTreeStore.allReqIds.includes(reqId.value)){
            console.warn('AnalyzeView onMounted: GOOD route setting to reqId:', reqId.value);
        } else {
            console.warn('AnalyzeView onMounted: BAD route setting to first record recTreeStore.selectedReqId:', recTreeStore.selectedReqId, 'recTreeStore.allReqIds:', recTreeStore.allReqIds, ' router.params.id:', route.params.id);
            recTreeStore.initToFirstRecord();
            router.replace({ name: route.name, params: { id: recTreeStore.selectedReqId.toString() } });
            toast.add({ severity: 'warn', summary: 'Reset Record Selection', detail: `The record specified in the route was INVALID setting to first record`, life: srToastStore.getLife()});
        }
    } else {
        console.error('AnalyzeView onMounted: recTreeStore.selectedReqId:', recTreeStore.selectedReqId, 'recTreeStore.allReqIds:', recTreeStore.allReqIds);
    }
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
                v-if="shouldDisplay" 
                :startingReqId="reqId"
            />
        </template>
        <template v-slot:main>
            <SrScatterPlot 
                v-if="shouldDisplay" 
                :startingReqId="reqId"
            />
        </template>
    </TwoColumnLayout>
</template>

<style scoped>
/* Add any required styles here */
</style>
