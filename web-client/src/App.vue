<script setup lang="ts">
import { ref,onMounted,watch,nextTick } from 'vue';
import { useToast } from "primevue/usetoast";
import SrToast from 'primevue/toast';
import SrAppBar from '@/components/SrAppBar.vue';
import SrBuildDate from '@/components/SrBuildDate.vue';
import SrUserAgent from '@/components/SrUserAgent.vue';
import Dialog from 'primevue/dialog';
import router from './router/index.js';
import { useSrToastStore } from "@/stores/srToastStore";
import { useDeviceStore } from '@/stores/deviceStore';
import { initChartStore } from "@/utils/plotUtils";
import { useRecTreeStore } from "@/stores/recTreeStore";
import { useRoute } from 'vue-router';
import SrClearCache from '@/components/SrClearCache.vue';
import { useSysConfigStore } from '@/stores/sysConfigStore';
import SrJsonDisplayDialog from '@/components/SrJsonDisplayDialog.vue';
import introJs from 'intro.js';
import { useTourStore } from '@/stores/tourStore.js';

const srToastStore = useSrToastStore();
const recTreeStore = useRecTreeStore();
const toast = useToast();
const deviceStore = useDeviceStore();
const tourStore = useTourStore();
const route = useRoute();
const showServerVersionDialog = ref(false); // Reactive state for controlling dialog visibility
const showClientVersionDialog = ref(false); // Reactive state for controlling dialog visibility
const showUnsupportedDialog = ref(false); // Reactive state for controlling dialog visibility
const serverVersionInfo = ref(''); // Reactive state for server version info
// Flag to indicate if the component has been mounted
const isMounted = ref(false);

const checkUnsupported = () =>{
  console.log('checkUnsupported browser:', deviceStore.getBrowser(), 'OS:', deviceStore.getOS());
  if (
    (deviceStore.getBrowser() === 'Unknown Browser' || deviceStore.getOS() === 'Unknown OS')
  ) {
    showUnsupportedDialog.value = true;
  }
}

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

  // Check for WebGL support
  deviceStore.setWebGLSupported(!!window.WebGLRenderingContext); // Should be `true` if WebGL is supported
};

// Watcher (initially inactive)
let stopWatching: (() => void) | null = null;


function getCommonSteps(): ReturnType<typeof introJs>['_options']['steps'] {
    return [
        {
            intro: `
                <span class="intro-nowrap"><b>Welcome to SlideRule Earth!</b></span><br><br>
                We’re going to take a quick tour of how to use the app.<br><br>
                The process has <b>four simple steps</b>:<br>
                <ol>
                    <li>Zoom in</li>
                    <li>Select a draw tool</li>
                    <li>Draw a region</li>
                    <li>Click <b>Run SlideRule</b></li>
                </ol>
                That’s it!<br>
                Now click <b>Next</b> to see each step.
            `,
        },
        {
            element: document.querySelector('.ol-zoom-in') as HTMLElement,
            intro: `
                <b>Step 1: Zoom In</b><br><br>
                Use this button,<br> <b><em>OR</em> <br>your touchpad or mouse wheel</b> to zoom in to an area a few miles or kilometers wide.
            `
        },
        {
            element: document.querySelector('.sr-draw-button-box') as HTMLElement,
            intro: `
                <b>Step 2: Select a draw tool</b><br><br>
                Use this draw toolbox to define your region of interest.<br>
                For this example, select the <b>rectangle</b> tool.
            `
        },
        {
            element: document.querySelector('#map-center-highlight') as HTMLElement,
            intro: `
                <b>Step 3: Draw a region</b><br><br>
                With the rectangle tool selected, <b>click and drag</b> on the map to define your region of interest.
            `
        },
        {
            element: document.querySelector('.sr-run-abort-button') as HTMLElement,
            intro: `
                <b>Step 4: Run SlideRule</b><br><br>
                Click this button to submit your request.<br>
                It may take a few minutes to run, depending on the size of your region and other factors.<br>
            `
        },
        {
            element: document.querySelector('#sr-analysis-button') as HTMLElement,
            intro: `
                <b>That's it!</b><br><br>
                When the data has been delivered you’ll be taken to the analysis page --which you can also get to by clicking this button-- to view elevation profiles and more.
            `
        }
    ];
}


onMounted(async () => {
    console.log('App onMounted');
    const reqId = await recTreeStore.updateRecMenu('from App');
    initChartStore();
    if ((reqId <= 0) && (recTreeStore.allReqIds.length > 0)) {
      // this covers the case that the user types a bad URL
      recTreeStore.initToFirstRecord();
    }

    detectBrowserAndOS();
    checkUnsupported();
    tourStore.checkSeen(); 
    await nextTick(); // wait for DOM to fully render

    if (!tourStore.hasSeenIntro) {
        handleQuickTourButtonClick();
    }

    // Mark as mounted
    isMounted.value = true;

    // Start watching only after mounted
    stopWatching = watch(() => route.params.id, async (newId) => {
        let newReqId = Number(newId) || 0;
        try {
            if (newReqId > 0) {
                const first = recTreeStore.findAndSelectNode(newReqId);
                if (!first && recTreeStore.allReqIds.length === 0) {
                    console.warn("Ignoring newId:", newId, "newReqId:", newReqId);
                    toast.add({ severity: 'warn', summary: 'No records', detail: `There are no records. Make a request first`, life: srToastStore.getLife() });
                }
            } else {
                if (recTreeStore.allReqIds.length === 0) {
                    console.warn("Ignoring newId:", newId, "newReqId:", newReqId);
                    toast.add({ severity: 'warn', summary: 'No records', detail: `There are no records. Make a request first`, life: srToastStore.getLife() });
                }
            }
        } catch (error) {
            console.error('Error processing route ID change:', error);
            console.error("App watch exception setting route parameter for 'id':", newReqId);
            toast.add({ severity: 'error', summary: 'Exception', detail: `Invalid (exception) route parameter for record:${newReqId}`, life: srToastStore.getLife() });
        }
    });
    console.log('App onMounted done');
});

function dumpRouteInfo() {
    console.log('Route name:', route.name);
    console.log('Route route:', route.fullPath);
    console.log('Route path:', route.path);
    console.log('Route params:', route.params);
    console.log('Route query:', route.query);
}

const requestButtonClick = async () => {
    //console.log('Request button clicked');
    router.push('/request'); 
};

const recordButtonClick = () => {
  router.push('/record');
};

const rectreeButtonClick = () => {
  router.push('/rectree');
};

const analysisButtonClick = async () => {
    try{
        if(recTreeStore.allReqIds.length===0){
            toast.add({ severity: 'warn', summary: 'No Records Found', detail: 'Please first create a new record by making a request', life: srToastStore.getLife() });
        }
        const reqId =recTreeStore.selectedReqId;
        if (reqId > 0) {
            router.push(`/analyze/${reqId.toString()}`);
        } else {
            if(recTreeStore.allReqIds.length > 0){
                //console.log('analysisButtonClick num req_ids:',recTreeStore.allReqIds.length, 'recTreeStore.selectedReqId:',recTreeStore.selectedReqId);
                toast.add({ severity: 'warn', summary: 'Invalid Record specified', detail: ' Setting to first record Id', life: srToastStore.getLife() });
                recTreeStore.initToFirstRecord();   
            }
        }
    } catch (error) {
        console.error(`Failed analysisButtonClick`, error);
        throw error;
    }
};

const settingsButtonClick = () => {
  router.push('/settings');
};

const aboutButtonClick = () => {
  showClientVersionDialog.value = true; // Show the dialog
};

// Function to handle the server version button click and show the dialog
const handleServerVersionButtonClick = async () => {
  const info = await useSysConfigStore().fetchServerVersionInfo(); 
  serverVersionInfo.value = JSON.stringify(info, null, 2);
  showServerVersionDialog.value = true; // Show the dialog
};

// Function to handle the client version button click and show the dialog
const handleClientVersionButtonClick = () => {
  showClientVersionDialog.value = true; // Show the dialog
};

function isInViewport(el: HTMLElement): boolean {
    const rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight)
    );
}

async function waitForElement(selector: string, timeout = 5000): Promise<void> {
    const start = performance.now();
    return new Promise((resolve, reject) => {
        const interval = setInterval(() => {
            const el = document.querySelector(selector);
            if (el) {
                clearInterval(interval);
                resolve();
            } else if (performance.now() - start > timeout) {
                clearInterval(interval);
                console.warn(`Timeout waiting for ${selector}`);
                reject(new Error(`Timeout waiting for ${selector}`));
            }
        }, 100);
    });
}

async function handleQuickTourButtonClick() {
    const isMobile = deviceStore.getUserAgent().includes('Android') || deviceStore.getUserAgent().includes('iPhone') ;
    const isAniPad = deviceStore.getUserAgent().includes('iPad');
    console.log('handleQuickTourButtonClick','isMobile:', isMobile, 'isAniPad:', isAniPad);


    const tour = introJs();
    let steps = getCommonSteps();
    if(isMobile && !isAniPad){
        const mobileIntroStep = {
            intro: `
                <span class="intro-nowrap"><b>Welcome to SlideRule Earth!</b></span><br><br>
                This app requires a large screen. 
                It is not meant to be used on small mobile devices<br><br>
            `
        }
        steps.unshift(mobileIntroStep);
    } 
    tour.setOptions({
        scrollToElement: true,
        scrollTo: 'element',
        steps: steps,
    });
    
    // 👉 Run the tour and listen for completion
    tour.oncomplete(() => {
        tourStore.markSeen();
    });

    // 👉 Optional: also mark seen if user exits early
    tour.onexit(() => {
        tourStore.markSeen();
    });

    await waitForElement('.ol-zoom-in');
    await waitForElement('.sr-draw-button-box');
    await waitForElement('#map-center-highlight');
    await waitForElement('.sr-run-abort-button');
    await waitForElement('#sr-analysis-button');
    // Ensure map-center-highlight is in view (before tour starts)
    const mapHighlightEl = document.querySelector('#map-center-highlight') as HTMLElement;
    // if (mapHighlightEl && !isInViewport(mapHighlightEl)) {
    //     mapHighlightEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    //     await new Promise(resolve => setTimeout(resolve, 300)); // Let scroll finish
    // }
    tour.start();
}

async function handleLongTourButtonClick() {
    const isMobile = deviceStore.getUserAgent().includes('Android') || deviceStore.getUserAgent().includes('iPhone') ;
    const isAniPad = deviceStore.getUserAgent().includes('iPad');
    console.log('handleQuickTourButtonClick','isMobile:', isMobile, 'isAniPad:', isAniPad);


    const tour = introJs();
    let steps = getCommonSteps();
    if(isMobile && !isAniPad){
        const mobileIntroStep = {
            intro: `
                <span class="intro-nowrap"><b>Welcome to SlideRule Earth!</b></span><br><br>
                This app requires a large screen. 
                It is not meant to be used on small mobile devices<br><br>
            `
        }
        steps.unshift(mobileIntroStep);
    } 
    tour.setOptions({
        scrollToElement: true,
        scrollTo: 'element',
        steps: steps,
    });
    
    // 👉 Run the tour and listen for completion
    tour.oncomplete(() => {
        tourStore.markSeen();
    });

    // 👉 Optional: also mark seen if user exits early
    tour.onexit(() => {
        tourStore.markSeen();
    });

    await waitForElement('.ol-zoom-in');
    await waitForElement('.sr-draw-button-box');
    await waitForElement('#map-center-highlight');
    await waitForElement('.sr-run-abort-button');
    await waitForElement('#sr-analysis-button');
    // Ensure map-center-highlight is in view (before tour starts)
    const mapHighlightEl = document.querySelector('#map-center-highlight') as HTMLElement;
    // if (mapHighlightEl && !isInViewport(mapHighlightEl)) {
    //     mapHighlightEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    //     await new Promise(resolve => setTimeout(resolve, 300)); // Let scroll finish
    // }
    tour.start();
}

</script>

<template>
  <div class="app-layout">
    <div>
      <SrToast position="top-left" />
    </div>  
    <header class="app-header">
      <SrAppBar 
        @request-button-click="requestButtonClick"
        @record-button-click="recordButtonClick"
        @rectree-button-click="rectreeButtonClick"
        @analysis-button-click="analysisButtonClick"
        @about-button-click="aboutButtonClick"
		@settings-button-click="settingsButtonClick"
        @server-version-button-click="handleServerVersionButtonClick"
        @client-version-button-click="handleClientVersionButtonClick"
        @quick-tour-button-click="handleQuickTourButtonClick"
        @long-tour-button-click="handleLongTourButtonClick"
      />
    </header>
    <div class="content">
      <RouterView />
    </div>
    
    <!-- Dialog for displaying version information -->
    <Dialog v-model:visible="showClientVersionDialog" :modal="true" :closable="true" style="width: 50vw;">
        <template #header>
            <h2 class="dialog-header">About This Client Application</h2>
        </template>

        <div class="sr-about">
            <SrBuildDate />
            <SrUserAgent />
            <SrClearCache />
        </div>
    </Dialog>
    <SrJsonDisplayDialog 
        v-model:visible="showServerVersionDialog"
        :jsonData="serverVersionInfo" 
        title="About the SlideRule Server"
    >
    </SrJsonDisplayDialog>

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
.dialog-header {
  width: 100%;
  text-align: center;
  margin: 0;
  font-size: 1.5rem;
  color: var(--p-primary-color);
}

</style>
