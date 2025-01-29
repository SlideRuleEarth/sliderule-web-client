<script setup lang="ts">
import { ref,onMounted,watch } from 'vue';
import { useToast } from "primevue/usetoast";
import SrToast from 'primevue/toast';
import SrAppBar from "./components/SrAppBar.vue";
import SrBuildDate from './components/SrBuildDate.vue';
import SrUserAgent from './components/SrUserAgent.vue';
import Dialog from 'primevue/dialog';
import router from './router/index.js';
import { useSrToastStore } from "@/stores/srToastStore";
import { useDeviceStore } from '@/stores/deviceStore';

import { useRecTreeStore } from "@/stores/recTreeStore";

const srToastStore = useSrToastStore();
const recTreeStore = useRecTreeStore();
const toast = useToast();
const deviceStore = useDeviceStore();
import { useRoute } from 'vue-router';

const route = useRoute();
const showVersionDialog = ref(false); // Reactive state for controlling dialog visibility
const showUnsupportedDialog = ref(false); // Reactive state for controlling dialog visibility

const checkUnsupported = () =>{
  console.log('checkUnsupported browser:', deviceStore.getBrowser(), 'OS:', deviceStore.getOS());
  if (
    (deviceStore.getBrowser() === 'Unknown Browser' || deviceStore.getOS() === 'Unknown OS')
  ) {
    showUnsupportedDialog.value = true;
  }
}

watch(() => route.params.id, async (newId) => {
    let newReqId = Number(newId) || 0;
    try{
        if(newReqId > 0){
            recTreeStore.findAndSelectNode(newReqId);
            console.log('App watch Route ID changed to:', newReqId);
        } else {
            console.warn("App watch ignoring newId:",newId,"newReqId:", newReqId);
            toast.add({ severity: 'warn', summary: 'No records', detail: `There are no records. Make a request first`, life: srToastStore.getLife()});
        }
    } catch (error) {
        console.error('App watch Error processing route ID change:', error);
        console.error("App watch exception setting route parameter for 'id':", newReqId);
        toast.add({ severity: 'error', summary: 'exception', detail: `Invalid (exception) route parameter for record:${newReqId}`, life: srToastStore.getLife()});
    }
});
// Function to detect browser and OS from userAgent string
const detectBrowserAndOS = () => {
  deviceStore.setUserAgent(navigator.userAgent);
  deviceStore.setLanguage(navigator.language);
  deviceStore.setOnlineStatus(navigator.onLine);

  // Detect OS
  if (deviceStore.getUserAgent().includes('Win')) deviceStore.setOS('Windows');
  else if (deviceStore.getUserAgent().includes('Mac')) deviceStore.setOS('MacOS');
  else if (deviceStore.getUserAgent().includes('Linux')) deviceStore.setOS('Linux');
  else if (deviceStore.getUserAgent().includes('Android')) deviceStore.setOS('Android');
  else if (deviceStore.getUserAgent().includes('iPhone')) deviceStore.setOS('iOS');
  else deviceStore.setOS('Unknown OS');

  // Detect Browser
  if (deviceStore.getUserAgent().includes('Chrome') && !deviceStore.getUserAgent().includes('Edg'))
    deviceStore.setBrowser('Chrome');
  else if (deviceStore.getUserAgent().includes('Firefox')) deviceStore.setBrowser('Firefox');
  else if (deviceStore.getUserAgent().includes('Safari') && !deviceStore.getUserAgent().includes('Chrome'))
    deviceStore.setBrowser('Safari');
  else if (deviceStore.getUserAgent().includes('Edg')) deviceStore.setBrowser('Edge');
  else if (deviceStore.getUserAgent().includes('Opera') || deviceStore.getUserAgent().includes('OPR'))
    deviceStore.setBrowser('Opera');
  else deviceStore.setBrowser('Unknown Browser');

};

onMounted(async () => {
    //const reqId = await recTreeStore.updateRecMenu('from App');// 
    // Get the computed style of the document's root element
    const rootStyle = window.getComputedStyle(document.documentElement);
    // Extract the font size from the computed style
    const fontSize = rootStyle.fontSize;
    // Log the font size to the console
    const firstReqId = await recTreeStore.updateRecMenu('from App');
    console.log(`App.vue onMounted Current root font size: ${fontSize} recTreeStore.selectedReqId:`, recTreeStore.selectedReqId, 'firstReqId:', firstReqId);
    detectBrowserAndOS();
    checkUnsupported();
});

const requestButtonClick = async () => {
    console.log('Request button clicked');
    router.push('/request'); 
};

const recordButtonClick = () => {
  router.push('/record');
};

const analysisButtonClick = async () => {
    try{
        const reqId =recTreeStore.selectedReqId;
        if (reqId>0) {
            router.push(`/analyze/${reqId.toString()}`);
        } else { 
            if (reqId > 0) {
                router.push(`/analyze/${reqId.toString()}`);
            } else {
                toast.add({ severity: 'warn', summary: 'No Requests Found', detail: 'Please create a request first', life: srToastStore.getLife() });
            }
        }
    } catch (error) {
        console.error(`Failed analysisButtonClick`, error);
        throw error;
    }
  };

const aboutButtonClick = () => {
  //router.push('/about');
  window.location.href = 'https://slideruleearth.io';
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
        @request-button-click="requestButtonClick"
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
        <SrUserAgent />
      </div>
    </Dialog>
    <Dialog v-model:visible="showUnsupportedDialog" header="Browser/OS Support" :modal="true" :closable="true" style="width: 50vw;">
      <div class="sr-unsupported-panel">
        <div>
        <p>
          Detected OS: {{ deviceStore.getOS() }}<br>
          Detected Browser: {{ deviceStore.getBrowser() }}
        </p>
        </div>
        <p>This web based application uses advanced features that might not be supported on your current browser/OS.</p>

        <table class="sr-os-browser-support-table">
          <thead class="sr-os-browser-tbl-header">
            <tr>
              <th></th>
              <th>Chrome</th>
              <th>Firefox</th>
              <th>Safari</th>
              <th>Edge</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="sr-bold-data">Windows</td>
              <td>Yes</td> <!-- Chrome -->
              <td>Yes</td> <!-- Firefox -->
              <td>-</td>  <!-- Safari -->
              <td>Yes</td> <!-- Edge -->
            </tr>
            <tr>
              <td class="sr-bold-data">macOS</td>
              <td>Yes</td> <!-- Chrome -->
              <td>Yes</td> <!-- Firefox -->
              <td>Yes</td> <!-- Safari -->
              <td>Yes</td> <!-- Edge -->
            </tr>
            <tr>
              <td class="sr-bold-data">Linux</td>
              <td>Yes</td> <!-- Chrome -->
              <td>Yes</td> <!-- Firefox -->
              <td>-</td>  <!-- Safari -->
              <td>Yes</td>  <!-- Edge -->
            </tr>
            <tr>
              <td class="sr-bold-data">iOS</td>
              <td>Yes</td> <!-- Chrome -->
              <td>Yes</td> <!-- Firefox -->
              <td>Yes</td> <!-- Safari -->
              <td>Yes</td> <!-- Edge -->
            </tr>
            <tr>
              <td class="sr-bold-data">Android</td>
              <td>Yes</td> <!-- Chrome -->
              <td>Yes</td> <!-- Firefox -->
              <td>-</td> <!-- Safari -->
              <td>Yes</td> <!-- Edge -->
            </tr>
          </tbody>
        </table>
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
  height: 4rem;
  z-index: 1000;
}

.content {
  margin-top: 4rem;
  overflow-y: auto;
  height: calc(100vh - 5rem);
}

.sr-unsupported-panel {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
}

.sr-os-browser-support-table {
  width: 100%;
  border-collapse: collapse;
  font-weight:lighter;
  font-size: smaller;
}

.sr-os-browser-tbl-header th {
  text-align: left; /* Left justify the header cells */
  padding-bottom: 0.5rem; /* Optional: Add padding for better spacing */
  font-weight: bolder; /* Optional: Make the header cells bold */
  font-size: large;
}

.sr-os-browser-tbl-header td {
  text-align: left; /* Left justify the header cells */
  padding: 0.5rem; /* Optional: Add padding for better spacing */
  font-weight:normal;
}

.sr-bold-data {
  font-size: large;
  font-weight:bolder;
}

.sr-red-txt {
  color: red;
}

.sr-yellow-txt {
  color: yellow;
}

</style>
