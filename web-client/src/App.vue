<script setup lang="ts">
import {useToast} from "primevue/usetoast";
import SrToast from 'primevue/toast';
import SrAppBar from "./components/SrAppBar.vue";
import router from './router/index.js';
import { useAdvancedModeStore } from '@/stores/advancedModeStore.js';
import { useSrToastStore } from "@/stores/srToastStore";
import { useCurReqSumStore } from "@/stores/curReqSumStore";

const srToastStore = useSrToastStore()

const advancedModeStore = useAdvancedModeStore();

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

const analysisButtonClick = () => {
  console.log('analysisButtonClick req_id: ', useCurReqSumStore().req_id);
  router.push(`/analyze/${useCurReqSumStore().req_id}`);
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
