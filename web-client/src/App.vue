<script setup lang="ts">
import { ref,onMounted } from 'vue';
import { useToast } from "primevue/usetoast";
import SrToast from 'primevue/toast';
import SrAppBar from "./components/SrAppBar.vue";
import SrBuildDate from './components/SrBuildDate.vue';
import SrUserAgent from './components/SrUserAgent.vue';
import Dialog from 'primevue/dialog';
import router from './router/index.js';
import { useSrToastStore } from "@/stores/srToastStore";
import { useAtlChartFilterStore } from "@/stores/atlChartFilterStore";
import { useRequestsStore } from "@/stores/requestsStore";
import { useDeviceStore } from '@/stores/deviceStore';

const srToastStore = useSrToastStore();
const atlChartFilterStore = useAtlChartFilterStore();
const requestsStore = useRequestsStore();
const toast = useToast();
const deviceStore = useDeviceStore();

const showVersionDialog = ref(false); // Reactive state for controlling dialog visibility
const showUnsupportedDialog = ref(false); // Reactive state for controlling dialog visibility

const checkUnsupported = () =>{
  console.log('checkUnsupported browser:', deviceStore.getBrowser(), 'OS:', deviceStore.getOS());
  if (
    (deviceStore.getBrowser() === 'Unknown Browser' || deviceStore.getOS() === 'Unknown OS') ||
    (deviceStore.getBrowser() === 'Edge' && ((deviceStore.getOS() !== 'Android')))  
  ) {
    showUnsupportedDialog.value = true;
  }
}

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

onMounted(() => {
    // Get the computed style of the document's root element
    const rootStyle = window.getComputedStyle(document.documentElement);
    // Extract the font size from the computed style
    const fontSize = rootStyle.fontSize;
    // Log the font size to the console
    console.log(`App.vue onMounted Current root font size: ${fontSize}`);
    detectBrowserAndOS();
    checkUnsupported();
});

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
              <td class="sr-red-txt">No</td> <!-- Firefox -->
              <td>-</td>  <!-- Safari -->
              <td>Yes</td> <!-- Edge -->
            </tr>
            <tr>
              <td class="sr-bold-data">macOS</td>
              <td>Yes</td> <!-- Chrome -->
              <td class="sr-red-txt">No</td> <!-- Firefox -->
              <td>Yes</td> <!-- Safari -->
              <td>Yes</td> <!-- Edge -->
            </tr>
            <tr>
              <td class="sr-bold-data">Linux</td>
              <td>Yes</td> <!-- Chrome -->
              <td class="sr-red-txt">No</td> <!-- Firefox -->
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
              <td class="sr-red-txt">No</td> <!-- Firefox -->
              <td>-</td> <!-- Safari -->
              <td class="sr-yellow-txt">Unknown</td> <!-- Edge -->
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
  height: calc(100vh - 4rem);
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
