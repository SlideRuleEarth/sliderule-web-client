<script setup lang="ts">
import {useToast} from "primevue/usetoast";
import Toast from 'primevue/toast';
import SrAppBar from "./components/SrAppBar.vue";
import router from './router/index.js';
import { useAdvancedModeStore } from '@/stores/advancedModeStore.js';
import { useSrToastStore } from "@/stores/srToastStore";

const srToastStore = useSrToastStore

const advancedModeStore = useAdvancedModeStore();

const toast = useToast();

const logoClick = () => {
  // console.log('logoClick');
  toast.add({ severity: 'info', summary: 'Logo', detail: 'Logo was clicked', life: srToastStore.getLife()});
  router.push('/');
};

const searchButtonClick = (inputValue: number) => {
  console.log('searchButtonClick',inputValue);
  toast.add({ severity: 'info', summary: 'Search Button', detail: 'Search button was pushed', life: srToastStore.getLife()});
};

const toolButtonClick = () => {
  // console.log('toolButtonClick');
  toast.add({ severity: 'info', summary: 'Tool Button', detail: 'Tool button was pushed',life: srToastStore.getLife()});
  advancedModeStore.advanced = true;
  router.push('/advanced-user');
};

const popularButtonClick = () => {
  // console.log('popularButtonClick');
  toast.add({ severity: 'info', summary: 'Popular Button', detail: 'Popular button was pushed', life: srToastStore.getLife()});
};

const aboutButtonClick = () => {
  // console.log('about-button-click');
  toast.add({ severity: 'info', summary: 'About Button', detail: 'About button was pushed',  life: srToastStore.getLife()});
  router.push('/about');
};
</script>

<template>
  <div>
    <Toast position="top-left"/>
  </div>  
  <header>
    <SrAppBar 
      @logo-click="logoClick"
      @search-button-click="searchButtonClick"
      @tool-button-click="toolButtonClick"
      @popular-button-click="popularButtonClick"
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
