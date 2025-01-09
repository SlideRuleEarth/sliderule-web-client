<script setup lang="ts">
import { useRoute } from 'vue-router';
import TwoColumnLayout from "@/layouts/TwoColumnLayout.vue";
import { onMounted, ref, watch } from 'vue';
import SrAnalyzeOptSidebar from "@/components/SrAnalyzeOptSidebar.vue";
import SrScatterPlot from "@/components/SrScatterPlot.vue";
import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
import { useRequestsStore } from '@/stores/requestsStore';
import { useToast } from 'primevue/usetoast';
import { useSrToastStore } from "@/stores/srToastStore";
import { useChartStore } from '@/stores/chartStore';
import { db } from '@/db/SlideRuleDb';

const atlChartFilterStore = useAtlChartFilterStore();
const requestsStore = useRequestsStore();
const toast = useToast();
const srToastStore = useSrToastStore();
const chartStore = useChartStore();

// Specify type for route.params
const route = useRoute();
const reqId = ref(Number(route.params.id) || 0);

if (isNaN(reqId.value)) {
    console.error("Invalid route parameter for 'id'");
}

onMounted(async () => {
    console.log('AnalyzeView onMounted: Loading AnalyzeView with ID:', reqId.value);
});

async function initChartStore(){
    for (const reqIdItem of atlChartFilterStore.reqIdMenuItems) {
        const reqIdStr = reqIdItem.value.toString();
        const thisReqId = Number(reqIdItem.value);
        if(thisReqId > 0) {
            try{
                const request = await db.getRequest(thisReqId);
                if(request &&request.file){
                    chartStore.setFile(reqIdStr,request.file);
                } else {
                    console.error('No file found for reqId:',reqIdStr);
                }
                if(request && request.func){
                    await chartStore.setFunc(reqIdStr,request.func);
                } else {
                    console.error('No func found for reqId:',reqIdStr);
                }
                if(request && request.description){
                    chartStore.setDescription(reqIdStr,request.description);
                } else {
                    // this is not an error, just a warning
                    console.warn('No description found for reqId:',reqIdStr);
                }
                if(request && request.num_bytes){
                    useChartStore().setSize(reqIdStr,request.num_bytes);
                } else {
                    console.error('No num_bytes found for reqId:',reqIdStr);
                }
                if(request && request.cnt){
                    useChartStore().setRecCnt(reqIdStr,request.cnt);
                } else {
                    console.error('No num_points found for reqId:',reqIdStr, ' request:', request);
                }
            } catch (error) {
                console.error(`Error in load menu items with reqId: ${reqIdStr}`, error);
            }
        } else {
            console.warn('Invalid request ID:', thisReqId);
        }
    }
}

watch(() => route.params.id, async (newId) => {
    let newReqId = Number(newId) || 0;

    if (isNaN(newReqId)) {
        console.error("Invalid (NaN) route parameter for 'id':", newId);
        toast.add({ severity: 'error', summary: 'Invalid route', detail: `Invalid (NaN) route parameter for record:${newId}`, life: srToastStore.getLife()});
        return;
    }
    try{
        atlChartFilterStore.reqIdMenuItems = await requestsStore.getMenuItems();
        if(atlChartFilterStore.reqIdMenuItems.length === 0){
            console.warn("Invalid (no records) route parameter for 'id':", newId);
            toast.add({ severity: 'warn', summary: 'No records', detail: `There are no records. Make a request first`, life: srToastStore.getLife()});
            return;
        }
        const newMenuItem = atlChartFilterStore.reqIdMenuItems.find(item => item.value === newReqId);
        if(newMenuItem){
            if(atlChartFilterStore.setReqId(newReqId)){
                console.log('Route ID changed to:', newReqId);
                initChartStore();
            } else {
                console.error("Invalid 1 (not in records) route parameter for 'id':", newId);
                toast.add({ severity: 'error', summary: 'Invalid route', detail: `Invalid (not in records) route parameter for record:${newId}`, life: srToastStore.getLife()});
                return;
            }
        } else {
            reqId.value = atlChartFilterStore.reqIdMenuItems[0].value;
            console.error("Invalid (not in records) route parameter for 'id':", newId, "Setting to first record:", reqId.value);
            toast.add({ severity: 'error', summary: 'Invalid route', detail: `Invalid (not in records) route parameter for record:${newId} setting to first record${newId}`, life: srToastStore.getLife()});
            return;
        }
        reqId.value = newReqId;
        console.log('Route ID changed to:', reqId.value);
    } catch (error) {
        console.error('Error processing route ID change:', error);
        console.error("exception setting route parameter for 'id':", newId);
        toast.add({ severity: 'error', summary: 'exception', detail: `Invalid (exception) route parameter for record:${newId}`, life: srToastStore.getLife()});
    }
});
</script>

<template>
    <TwoColumnLayout>
        <template v-slot:sidebar-col>
            <SrAnalyzeOptSidebar :startingReqId="reqId"/>
        </template>
        <template v-slot:main>
            <SrScatterPlot/>
        </template>
    </TwoColumnLayout>
</template>

<style scoped>
/* Add any required styles here */
</style>
