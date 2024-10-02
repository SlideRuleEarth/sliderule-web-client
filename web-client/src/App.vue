<script setup lang="ts">
import { ref } from 'vue';
import { useToast } from "primevue/usetoast";
import SrToast from 'primevue/toast';
import SrAppBar from "./components/SrAppBar.vue";
import SrBuildDate from './components/SrBuildDate.vue';
import SrNavigatorInfo from './components/SrNavigatorInfo.vue';
import SrUserAgent from './components/SrUserAgent.vue';
import Dialog from 'primevue/dialog';
import router from './router/index.js';
import { useSrToastStore } from "@/stores/srToastStore";
import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
import { useRequestsStore } from "@/stores/requestsStore";

const srToastStore = useSrToastStore();
const atlChartFilterStore = useAtlChartFilterStore();
const requestsStore = useRequestsStore();
const toast = useToast();

const showVersionDialog = ref(false); // Reactive state for controlling dialog visibility

const mapButtonClick = () => {
  router.push('/map'); 
};

const recordButtonClick = () => {
  router.push('/record');
};

const analysisButtonClick = async () => {
  if (atlChartFilterStore.getReqId()) {
    router.push(`/analyze/${atlChartFilterStore.getReqId()}`);
  } else {
    const items = await requestsStore.getMenuItems();
    if (items.length === 0) {
      toast.add({ severity: 'warn', summary: 'No Requests Found', detail: 'Please create a request first', life: srToastStore.getLife() });
      return;
    }  
    const reqIdStr = items[0].value;
    const reqId = Number(reqIdStr);
    if (reqId > 0) {
      atlChartFilterStore.setReqId(reqId);
      router.push(`/analyze/${reqId}`);
    } else {
      toast.add({ severity: 'warn', summary: 'No Requests Found', detail: 'Please create a request first', life: srToastStore.getLife() });
    }
  }
};

const aboutButtonClick = () => {
  router.push('/about');
};

// Function to handle the version button click and show the dialog
const handleVersionButtonClick = () => {
  showVersionDialog.value = true; // Show the dialog
};
</script>

<template>
  <div class="app-layout">
    <div>
      <SrToast position="top-center"/>
    </div>  
    <header class="app-header">
      <SrAppBar 
        @map-button-click="mapButtonClick"
        @record-button-click="recordButtonClick"
        @analysis-button-click="analysisButtonClick"
        @about-button-click="aboutButtonClick"
        @version-button-click="handleVersionButtonClick"
      />
    </header>
    <div class="content">
      <RouterView />
    </div>
    
    <!-- Dialog for displaying version information -->
    <Dialog v-model:visible="showVersionDialog" header="About This Application" :modal="true" :closable="true" style="width: 50vw;">
      <div class="sr-about">
        <SrBuildDate />
        <SrNavigatorInfo />
        <SrUserAgent />
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
.app-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  z-index: 1000;
}

.content {
  margin-top: 60px;
  overflow-y: auto;
  height: calc(100vh - 60px);
}

.sr-about {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
</style>
