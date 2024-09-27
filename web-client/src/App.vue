<script setup lang="ts">
import {useToast} from "primevue/usetoast";
import SrToast from 'primevue/toast';
import SrAppBar from "./components/SrAppBar.vue";
import router from './router/index.js';
import { useSrToastStore } from "@/stores/srToastStore";
import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
import { useRequestsStore } from "@/stores/requestsStore";

const srToastStore = useSrToastStore()
const atlChartFilterStore = useAtlChartFilterStore();
const requestsStore = useRequestsStore();
const toast = useToast();

const mapButtonClick = () => {
  // console.log('mapButtonClick');
  //toast.add({ severity: 'info', summary: 'Tool Button', detail: 'Tool button was pushed',life: srToastStore.getLife()});
  router.push('/map'); 
};

const recordButtonClick = () => {
  router.push('/record');
};

const analysisButtonClick = async () => {
  console.log('analysisButtonClick req_id: ', atlChartFilterStore.getReqId());
  if (atlChartFilterStore.getReqId()){
    router.push(`/analyze/${atlChartFilterStore.getReqId()}`);
  } else {
    const items =  await requestsStore.getMenuItems();
    if(items.length === 0){ 
        console.warn('No requests found');
        toast.add({ severity: 'warn', summary: 'No Requests Found', detail: 'Please create a request first', life: srToastStore.getLife()});
        return;
    }  
    const reqIdStr = items[0].value;
    const reqId = Number(reqIdStr);
    if(reqId > 0){
      atlChartFilterStore.setReqId(reqId);
      router.push(`/analyze/${reqId}`);
      console.log('analysisButtonClick changed to req_id: ', reqId);
    } else {
      console.warn('No requests found');
      toast.add({ severity: 'warn', summary: 'No Requests Found', detail: 'Please create a request first', life: srToastStore.getLife()});
    }
  }
};

const aboutButtonClick = () => {
  router.push('/about');
};
</script>

<template>
  <div>
    <SrToast position="top-center"/>
  </div>  
  <header class="app-header">
    <SrAppBar 
      @map-button-click="mapButtonClick"
      @record-button-click="recordButtonClick"
      @analysis-button-click="analysisButtonClick"
      @about-button-click="aboutButtonClick"
    />
  </header >
  <div class="content">
    <RouterView />
  </div>
</template>

<style scoped>
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  z-index: 1000; /* Adjust z-index to ensure it stays above other elements */
}

.content {
  margin-top: 60px; /* Adjust margin based on the height of your SrAppBar */
  padding: 16px; /* Optional padding for better content spacing */
  overflow-y: auto;
  height: calc(100vh - 60px); /* Full height minus the SrAppBar height */
}
/* Global style for toast popups */
.p-toast-message {
  opacity: 1.0 !important;
}
</style>

<style>
/* Global styles */
body, #app {
  margin: 0;
}
</style>
