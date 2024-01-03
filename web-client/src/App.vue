<script setup lang="ts">
import {useToast} from "primevue/usetoast";
import Toast from 'primevue/toast';
import SrAppBar from "./components/SrAppBar.vue";
import router from './router/index.js';
import { useAdvancedModeStore } from '@/stores/advancedModeStore.js';

const advancedModeStore = useAdvancedModeStore();

const toast = useToast();

const logoClick = () => {
  // console.log('logoClick');
  toast.add({ severity: 'info', summary: 'Logo', detail: 'Logo was clicked', life: 3000 });
  router.push('/');
};

const searchButtonClick = (inputValue: number) => {
  console.log('searchButtonClick',inputValue);
  toast.add({ severity: 'info', summary: 'Search Button', detail: 'Search button was pushed', life: 3000 });
};

const toolButtonClick = () => {
  // console.log('toolButtonClick');
  toast.add({ severity: 'info', summary: 'Tool Button', detail: 'Tool button was pushed', life: 3000 });
  advancedModeStore.advanced = true;
  router.push('/advanced-user');
};

const popularButtonClick = () => {
  // console.log('popularButtonClick');
  toast.add({ severity: 'info', summary: 'Popular Button', detail: 'Popular button was pushed', life: 3000 });
};

const aboutButtonClick = () => {
  // console.log('aboutButtonClick');
  toast.add({ severity: 'info', summary: 'About Button', detail: 'About button was pushed', life: 3000 });
  router.push('/about');
};
</script>

<template>
  <Toast />
  <header>
    <SrAppBar 
      @logoClick="logoClick"
      @searchButtonClick="searchButtonClick"
      @toolButtonClick="toolButtonClick"
      @popularButtonClick="popularButtonClick"
      @aboutButtonClick="aboutButtonClick"
    />
  </header>
  <RouterView />
</template>

<style scoped>
header {
  line-height: 1.5;
  max-height: 100vh;
}

</style>
