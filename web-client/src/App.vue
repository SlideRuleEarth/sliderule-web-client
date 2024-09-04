<script setup lang="ts">
import {useToast} from "primevue/usetoast";
import SrToast from 'primevue/toast';
import SrAppBar from "./components/SrAppBar.vue";
import router from './router/index.js';
import { useAdvancedModeStore } from '@/stores/advancedModeStore.js';
import { useSrToastStore } from "@/stores/srToastStore";
import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
import { useRequestsStore } from "@/stores/requestsStore";

const srToastStore = useSrToastStore()
const advancedModeStore = useAdvancedModeStore();
const atlChartFilterStore = useAtlChartFilterStore();
const requestsStore = useRequestsStore();
const toast = useToast();

const logoClick = () => {
  // console.log('logoClick');
  //toast.add({ severity: 'info', summary: 'Logo', detail: 'Logo was clicked', life: srToastStore.getLife()});
  router.push('/');
};

const toolButtonClick = () => {
  // console.log('toolButtonClick');
  //toast.add({ severity: 'info', summary: 'Tool Button', detail: 'Tool button was pushed',life: srToastStore.getLife()});
  advancedModeStore.advanced = true;
  router.push('/advanced-user');
};

const popularButtonClick = () => {
  toast.add({ severity: 'info', summary: 'Popular Button', detail: 'Popular button was pushed', life: srToastStore.getLife()});
  router.push('/popular');
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
  <header>
    <SrAppBar 
      @logo-click="logoClick"
      @tool-button-click="toolButtonClick"
      @popular-button-click="popularButtonClick"
      @record-button-click="recordButtonClick"
      @analysis-button-click="analysisButtonClick"
      @about-button-click="aboutButtonClick"
    />
  </header>
  <RouterView />
</template>

<style scoped>
header {
  line-height: 1.5;
  max-height: 100vh;
}

/* .toast-div{ 
  display: flex;
  justify-content: center;
}

:deep(.app .p-toast .p-toast-message.p-toast-message-info)   {
  color:black; 
} 
*/

</style>
