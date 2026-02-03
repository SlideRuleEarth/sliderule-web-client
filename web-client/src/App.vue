<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useToast } from 'primevue/usetoast'
import SrToast from 'primevue/toast'
import Image from 'primevue/image'
import buzzImg from '@/assets/BuzzSlideRule.jpg'
import SrAppBar from '@/components/SrAppBar.vue'
import SrBuildDate from '@/components/SrBuildDate.vue'
import SrUserAgent from '@/components/SrUserAgent.vue'
import Dialog from 'primevue/dialog'
import router from './router/index.js'
import { useSrToastStore } from '@/stores/srToastStore'
import { useDeviceStore } from '@/stores/deviceStore'
import { initChartStore } from '@/utils/plotUtils'
import { useRecTreeStore } from '@/stores/recTreeStore'
import { useRoute } from 'vue-router'
import SrClearCache from '@/components/SrClearCache.vue'
import { useGoogleApiKeyStore } from '@/stores/googleApiKeyStore'
import SrServerInfoDialog from '@/components/SrServerInfoDialog.vue'
import SrGoogleApiKeyInput from '@/components/SrGoogleApiKeyInput.vue'
import introJs from 'intro.js'
import { useTourStore } from '@/stores/tourStore.js'
import { useViewportHeight } from '@/composables/useViewportHeight'
import { useSlideruleDefaults } from '@/stores/defaultsStore'
import { createLogger } from '@/utils/logger'
import { usePrivacyConsentStore } from '@/stores/privacyConsentStore'
import SrConsentBanner from '@/components/SrConsentBanner.vue'
import SrMobileWarning from '@/components/SrMobileWarning.vue'
import DOMPurify from 'dompurify'

const logger = createLogger('App')

// Sanitize toast message details to prevent XSS
const sanitizeToastDetail = (detail: string | undefined): string => {
  if (!detail) return ''
  return DOMPurify.sanitize(detail)
}

const srToastStore = useSrToastStore()
const recTreeStore = useRecTreeStore()
const toast = useToast()
const deviceStore = useDeviceStore()
const tourStore = useTourStore()
const googleApiKeyStore = useGoogleApiKeyStore()
const privacyConsentStore = usePrivacyConsentStore()
const route = useRoute()

const showServerVersionDialog = ref(false)
const showClientVersionDialog = ref(false)
const showUnsupportedDialog = ref(false)
const showBuzzDialog = ref(false)
const isMounted = ref(false)

const checkUnsupported = () => {
  logger.debug('Checking browser support', {
    browser: deviceStore.getBrowser(),
    os: deviceStore.getOS()
  })
  if (deviceStore.getBrowser() === 'Unknown Browser' || deviceStore.getOS() === 'Unknown OS') {
    showUnsupportedDialog.value = true
  }
}

// Watcher (initially inactive)
let stopWatching: (() => void) | null = null
useViewportHeight()

// eslint-disable-next-line @typescript-eslint/promise-function-async
function waitForElement(selector: string, timeout = 5000): Promise<void> {
  const start = performance.now()
  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      const el = document.querySelector(selector)
      if (el) {
        clearInterval(interval)
        resolve()
      } else if (performance.now() - start > timeout) {
        clearInterval(interval)
        logger.warn('Timeout waiting for element', { selector, timeout })
        reject(new Error(`Timeout waiting for ${selector}`))
      }
    }, 100)
  })
}

async function getCommonSteps(
  type: string
): Promise<ReturnType<typeof introJs>['_options']['steps']> {
  await waitForElement('.ol-zoom-in')
  await waitForElement('.sr-draw-button-box')
  await waitForElement('#map-center-highlight')
  await waitForElement('.sr-run-abort-button')
  await waitForElement('#sr-analysis-button')

  if (!document.querySelector('.ol-zoom-in')) {
    alert('Tour cannot start: Zoom In button not found!')
  }
  const steps = [
    {
      intro:
        type === 'quick'
          ? `
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
            `
          : `
                <span class="intro-nowrap"><b>Welcome to SlideRule Earth!</b></span><br><br>
                We’re going to take a tour of how to use the app.<br><br>
                First the quick way. <br><br>
                The quick process has <br><b>Four Simple Steps</b>:<br>
                <ol>
                    <li>Zoom in</li>
                    <li>Select a draw tool</li>
                    <li>Draw a region</li>
                    <li>Click <b>Run SlideRule</b></li>
                </ol>
                Then we’ll explain the other controls.<br>
                <br>
                Now click <b>Next</b> to see each step.
            `
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
                The simplest is the <b>rectangle</b> tool.
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
                When the data has been delivered you’ll be taken to the analysis page (which you can also get to by clicking this button) to view elevation profiles and more.
            `
    }
  ]
  if (deviceStore.isMobile || deviceStore.isAniPad) {
    const mobileSteps = [
      {
        intro: `
                    <span class="intro-nowrap"><b>Welcome to SlideRule Earth!</b></span><br><br>
                    This app requires a large screen. 
                    It is not meant to be used on small mobile devices<br><br>
                    The process has <b>four simple steps</b>:<br>
                    <ol>
                        <li>Zoom in</li>
                        <li>Select a draw tool</li>
                        <li>Draw a region</li>
                        <li>Click <b>Run SlideRule</b></li>
                    </ol>
                    That’s it!<br>
                `
      }
    ]
    return mobileSteps
  }

  return steps
}

onMounted(async () => {
  logger.debug('App component mounted')
  const startTime = performance.now()
  const defaultsStore = useSlideruleDefaults()
  await defaultsStore.fetchDefaults()
  //logger.debug('Defaults loaded');
  const reqId = await recTreeStore.updateRecMenu('from App')
  await initChartStore()
  //logger.debug('ChartStore initialized', { duration: `${(performance.now() - startTime).toFixed(2)}ms` });
  if (reqId <= 0 && recTreeStore.allReqIds.length > 0) {
    // this covers the case that the user types a bad URL
    recTreeStore.initToFirstRecord()
  }

  deviceStore.detect()
  deviceStore.startListeningToResize() // <== ✅ Needed for screenWidth to update
  // watch(() => deviceStore.screenWidth, width => {
  //     console.log('Screen width changed:', width);
  // });

  checkUnsupported()
  tourStore.checkSeen()
  privacyConsentStore.initializeOnStartup()
  await nextTick()

  if (!tourStore.hasSeenIntro) {
    void handleQuickTourButtonClick()
  }

  // Mark as mounted
  isMounted.value = true

  // Start watching only after mounted
  stopWatching = watch(
    () => route.params.id,
    (newId) => {
      let newReqId = Number(newId) || 0
      try {
        if (newReqId > 0) {
          const first = recTreeStore.findAndSelectNode(newReqId)
          if (!first && recTreeStore.allReqIds.length === 0) {
            logger.warn('Ignoring invalid route ID', { newId, newReqId, reason: 'no records' })
            toast.add({
              severity: 'warn',
              summary: 'No records',
              detail: `There are no records. Make a request first`,
              life: srToastStore.getLife()
            })
          }
        } else {
          if (recTreeStore.allReqIds.length === 0) {
            logger.warn('Ignoring invalid route ID', { newId, newReqId, reason: 'no records' })
            toast.add({
              severity: 'warn',
              summary: 'No records',
              detail: `There are no records. Make a request first`,
              life: srToastStore.getLife()
            })
          }
        }
      } catch (error) {
        logger.error('Error processing route ID change', {
          newReqId,
          error: error instanceof Error ? error.message : String(error)
        })
        toast.add({
          severity: 'error',
          summary: 'Exception',
          detail: `Invalid (exception) route parameter for record:${newReqId}`,
          life: srToastStore.getLife()
        })
      }
    }
  )
  logger.info('App mounted', { duration: `${(performance.now() - startTime).toFixed(2)}ms` })
})

onUnmounted(() => {
  if (stopWatching) {
    stopWatching()
  }
})

const requestButtonClick = () => {
  //logger.debug('Request button clicked');
  void router.push('/request')
}

const recordButtonClick = () => {
  void router.push('/record')
}

const rectreeButtonClick = () => {
  void router.push('/rectree')
}

const analysisButtonClick = async () => {
  try {
    if (recTreeStore.allReqIds.length === 0) {
      toast.add({
        severity: 'warn',
        summary: 'No Records Found',
        detail: 'Please first create a new record by making a request',
        life: srToastStore.getLife()
      })
    }
    const reqId = recTreeStore.selectedReqId
    if (reqId > 0) {
      await router.push(`/analyze/${reqId.toString()}`)
    } else {
      if (recTreeStore.allReqIds.length > 0) {
        //logger.debug('Setting to first record', { numReqIds: recTreeStore.allReqIds.length, selectedReqId: recTreeStore.selectedReqId });
        toast.add({
          severity: 'warn',
          summary: 'Invalid Record specified',
          detail: ' Setting to first record Id',
          life: srToastStore.getLife()
        })
        recTreeStore.initToFirstRecord()
      }
    }
  } catch (error) {
    logger.error('Failed to navigate to analysis', {
      error: error instanceof Error ? error.message : String(error)
    })
    throw error
  }
}

const settingsButtonClick = () => {
  void router.push('/settings')
}

const aboutButtonClick = () => {
  showClientVersionDialog.value = true // Show the dialog
}

const slideruleBuzzButtonClick = () => {
  showBuzzDialog.value = true
}

// Function to handle the server version button click and show the dialog
const handleServerVersionButtonClick = () => {
  showServerVersionDialog.value = true
}

// Function to handle the client version button click and show the dialog
const handleClientVersionButtonClick = () => {
  showClientVersionDialog.value = true // Show the dialog
}

async function handleQuickTourButtonClick() {
  const tour = introJs.tour()
  let steps = await getCommonSteps('quick')

  tour.setOptions({
    scrollToElement: true,
    scrollTo: 'element',
    steps: steps
  })

  // 👉 Run the tour and listen for completion
  tour.onComplete(() => {
    tourStore.markSeen()
  })

  // 👉 Optional: also mark seen if user exits early
  tour.onExit(() => {
    tourStore.markSeen()
  })

  void tour.start()
}

async function handleLongTourButtonClick() {
  const isMobile =
    deviceStore.getUserAgent().includes('Android') || deviceStore.getUserAgent().includes('iPhone')
  const isAniPad = deviceStore.getUserAgent().includes('iPad')
  logger.debug('Starting long tour', { isMobile, isAniPad })

  const tour = introJs.tour()
  let steps = await getCommonSteps('long')

  const srRadioBoxContainerGenEl = document.querySelector('#sr-radio-box-container-gen')
  const srReqDisplayBtn = document.querySelector('#sr-req-display-btn')
  const srAppBarRightContentEl = document.querySelector('#sr-appbar-right-content')
  const srRequestButtonEl = document.querySelector('#sr-request-button')
  const srRecordsButtonEl = document.querySelector('#sr-records-button')
  const srAnalysisButtonEl = document.querySelector('#sr-analysis-button')
  const srDocsButton = document.querySelector('#sr-docs-button')
  const srSettingsButton = document.querySelector('#sr-settings-button')
  const srAboutButton = document.querySelector('#sr-about-button')
  const srLoginButton = document.querySelector('#sr-login-button')

  // 👉 Append additional steps here

  if (srAppBarRightContentEl instanceof HTMLElement) {
    steps.push({
      element: srAppBarRightContentEl,
      intro: `This is the <b>SlideRule Earth</b> App Bar.<br>
            It contains buttons to access the different views of the app.<br>
            `
    })
  } else {
    logger.warn('Tour element not found', { element: 'srAppBarRightContentEl' })
  }

  if (srRequestButtonEl instanceof HTMLElement) {
    steps.push({
      element: srRequestButtonEl,
      intro: `This is the <b>Request</b> button.<br>
            It takes you to <em><b>this</b></em> <b>Request View</b> where you can make a new request.<br>
            The Request view is also the default view when you first open the app.<br>
            `
    })
  } else {
    logger.warn('Tour element not found', { element: 'srRequestButtonEl' })
  }

  if (srRecordsButtonEl instanceof HTMLElement) {
    steps.push({
      element: srRecordsButtonEl,
      intro: `This is the <b>Records</b> button.<br>
            It takes you to the <b>Records View</b> where you can see record summaries of your requests.<br>
            `
    })
  } else {
    logger.warn('Tour element not found', { element: 'srRecordsButtonEl' })
  }

  if (srAnalysisButtonEl instanceof HTMLElement) {
    steps.push({
      element: srAnalysisButtonEl,
      intro: `This is the <b>Analysis</b> button.<br>
            It takes you to the <b>Analysis View</b> where you can see the results of your requests.<br>
            The analysis view has different subviews to see elevation profiles of selected tracks and 3D views of the region you selected.<br>
            `
    })
  } else {
    logger.warn('Tour element not found', { element: 'srAnalysisButtonEl' })
  }

  if (srDocsButton instanceof HTMLElement) {
    steps.push({
      element: srDocsButton,
      intro: `This is the <b>Documentation</b> button.<br>
            This is where you can find documentation for SlideRule.<br>
            `
    })
  } else {
    logger.warn('Tour element not found', { element: 'srDocsButton' })
  }

  if (srSettingsButton instanceof HTMLElement) {
    steps.push({
      element: srSettingsButton,
      intro: `This is the <b>Settings</b> button.<br>
            This is where you can find global settings for this web client.<br>
            `
    })
  } else {
    logger.warn('Tour element not found', { element: 'srSettingsButton' })
  }
  if (srAboutButton instanceof HTMLElement) {
    steps.push({
      element: srAboutButton,
      intro: `This is the <b>About</b> button.<br>
            This is where you can find information about this web client and about the SlideRule server.<br>
            `
    })
  } else {
    logger.warn('Tour element not found', { element: 'srAboutButton' })
  }

  if (srLoginButton instanceof HTMLElement) {
    steps.push({
      element: srLoginButton,
      intro: `This is the <b>GitHub Login</b> button.<br>
            Click here to log in with your GitHub account.<br>
            Logging in gives you access to slideruleearth.io member features such as deploying private clusters and managing tokens.<br>
            `
    })
  } else {
    logger.warn('Tour element not found', { element: 'srLoginButton' })
  }

  if (srReqDisplayBtn instanceof HTMLElement) {
    steps.push({
      element: srReqDisplayBtn,
      intro: `This button displays the current request parameters.<br>
            When the "Run SlideRule" button is pressed this client sends a request to the SlideRule server.<br>
            The server then runs the request and sends the results back to this client.<br>
            The results are displayed in the "Analysis Display".<br>
            To see the parameters it will use to make the request click the "Show Request Parameters" button.<br>
            `
    })
  } else {
    logger.warn('Tour element not found', { element: 'srReqDisplayBtn' })
  }
  if (srRadioBoxContainerGenEl instanceof HTMLElement) {
    steps.push({
      element: srRadioBoxContainerGenEl,
      intro: `Before you click Run SlideRule you can click on one of these to preset the request parameters to values that match the request type in the description supplied.<br>
            You can change the parameters used by clicking one of these. Then as always: click the "Run SlideRule" button to make a new request.<br>
            `
    })
  } else {
    logger.warn('Tour element not found', { element: 'srRadioBoxContainerGenEl' })
  }
  steps.push({
    intro: `
            <span class="intro-nowrap"><b>Enjoy using SlideRule Earth!</b></span><br><br>
            Please contact us if you have any questions or suggestions.<br><br>
            You can reach us directly at <a href="mailto:support@mail.slideruleearth.io">support@mail.slideruleearth.io</a>.<br><br>
            We are completely open source and we welcome contributions.<br><br>
            You can find the source code for all SlideRule code at <a href="https://github.com/SlideRuleEarth" target="_blank">https://github.com/SlideRuleEarth</a>.<br><br>
            Feel free to open an issue if you find a bug or have a suggestion for improvement.<br><br>
            Also feel free to contribute to the project by submitting a pull request.<br><br>
        `
  })

  tour.setOptions({
    scrollToElement: true,
    scrollTo: 'element',
    steps: steps
  })

  // 👉 Run the tour and listen for completion
  tour.onComplete(() => {
    tourStore.markSeen()
  })

  // 👉 Optional: also mark seen if user exits early
  tour.onExit(() => {
    tourStore.markSeen()
  })

  void tour.start()
}
</script>

<template>
  <div class="app-layout">
    <div>
      <SrToast position="top-left">
        <template #message="slotProps">
          <div class="sr-toast-content">
            <span class="sr-toast-summary">{{ slotProps.message.summary }}</span>
            <div
              class="sr-toast-detail"
              v-html="sanitizeToastDetail(slotProps.message.detail)"
            ></div>
          </div>
        </template>
      </SrToast>
    </div>
    <header class="app-header">
      <SrAppBar
        @request-button-click="requestButtonClick"
        @record-button-click="recordButtonClick"
        @rectree-button-click="rectreeButtonClick"
        @analysis-button-click="analysisButtonClick"
        @about-button-click="aboutButtonClick"
        @sliderule-buzz-button-click="slideruleBuzzButtonClick"
        @settings-button-click="settingsButtonClick"
        @server-version-button-click="handleServerVersionButtonClick"
        @client-version-button-click="handleClientVersionButtonClick"
        @quick-tour-button-click="handleQuickTourButtonClick"
        @long-tour-button-click="handleLongTourButtonClick"
      />
    </header>
    <div class="sliderule-content">
      <RouterView />
    </div>
    <SrConsentBanner />
    <SrMobileWarning />

    <!-- Dialog for displaying version information -->
    <Dialog
      v-model:visible="showClientVersionDialog"
      :modal="true"
      :closable="true"
      style="width: 50vw"
    >
      <template #header>
        <h2 class="dialog-header">About This Client Application</h2>
      </template>

      <div class="sr-about">
        <SrBuildDate />
        <SrUserAgent />
        <SrClearCache />
      </div>
    </Dialog>
    <SrServerInfoDialog v-model="showServerVersionDialog" />

    <Dialog
      v-model:visible="showUnsupportedDialog"
      header="Browser/OS Support"
      :modal="true"
      :closable="true"
      style="width: 50vw"
    >
      <div class="sr-unsupported-panel">
        <div>
          <p>
            Detected OS: {{ deviceStore.getOS() }}<br />
            Detected Browser: {{ deviceStore.getBrowser() }}
          </p>
        </div>
        <p>
          This web based application uses advanced features that might not be supported on your
          current browser/OS.
        </p>

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
              <td>Yes</td>
              <!-- Chrome -->
              <td>Yes</td>
              <!-- Firefox -->
              <td>-</td>
              <!-- Safari -->
              <td>Yes</td>
              <!-- Edge -->
            </tr>
            <tr>
              <td class="sr-bold-data">macOS</td>
              <td>Yes</td>
              <!-- Chrome -->
              <td>Yes</td>
              <!-- Firefox -->
              <td>Yes</td>
              <!-- Safari -->
              <td>Yes</td>
              <!-- Edge -->
            </tr>
            <tr>
              <td class="sr-bold-data">Linux</td>
              <td>Yes</td>
              <!-- Chrome -->
              <td>Yes</td>
              <!-- Firefox -->
              <td>-</td>
              <!-- Safari -->
              <td>Yes</td>
              <!-- Edge -->
            </tr>
            <tr>
              <td class="sr-bold-data">iOS</td>
              <td>Yes</td>
              <!-- Chrome -->
              <td>Yes</td>
              <!-- Firefox -->
              <td>Yes</td>
              <!-- Safari -->
              <td>Yes</td>
              <!-- Edge -->
            </tr>
            <tr>
              <td class="sr-bold-data">Android</td>
              <td>Yes</td>
              <!-- Chrome -->
              <td>Yes</td>
              <!-- Firefox -->
              <td>-</td>
              <!-- Safari -->
              <td>Yes</td>
              <!-- Edge -->
            </tr>
          </tbody>
        </table>
      </div>
    </Dialog>
    <Dialog
      v-model:visible="showBuzzDialog"
      :modal="true"
      :closable="true"
      class="buzz-dialog"
      :draggable="false"
    >
      <template #header>
        <h2 class="dialog-header">Buzz Aldrin with a slide rule Gemini XII</h2>
      </template>

      <div class="buzz-image-container">
        <Image :src="buzzImg" alt="Buzz Aldrin with a slide rule Gemini XII" class="buzz-image" />
      </div>
    </Dialog>

    <!-- Google API Key Dialog -->
    <Dialog
      v-model:visible="googleApiKeyStore.dialogVisible"
      header="Google API Key Required"
      :modal="true"
      :closable="true"
      style="width: 600px; max-width: 95vw"
    >
      <SrGoogleApiKeyInput />
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

.sliderule-content {
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
  font-weight: lighter;
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
  font-weight: normal;
}

.sr-bold-data {
  font-size: large;
  font-weight: bolder;
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
.buzz-dialog ::v-deep(.p-dialog-content) {
  overflow-y: auto;
  max-height: 70vh;
  max-width: 650px;
}

.buzz-image-container {
  display: flex;
  justify-content: center;
  align-items: center;
}

.buzz-image {
  width: auto;
  height: auto;
  max-width: 100%;
  max-height: 80vh;
  object-fit: contain;
}
</style>
