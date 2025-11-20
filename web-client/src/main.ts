import './assets/app.css'
import Lara from '@primeuix/themes/lara'
import 'primeicons/primeicons.css'
import 'primeflex/primeflex.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { piniaMetaPlugin } from '@/composables/piniaMetaPlugin'
import { createPersistedState } from 'pinia-plugin-persistedstate'
import PrimeVue from 'primevue/config'
import { definePreset } from '@primeuix/themes'
import 'intro.js/introjs.css'
import '@/styles/sr-common-styles.css'
import 'vue3-openlayers/vue3-openlayers.css'
import 'ol-ext/dist/ol-ext.css'

import Menubar from 'primevue/menubar'
import ToastService from 'primevue/toastservice'
import Toast from 'primevue/toast'
import Ripple from 'primevue/ripple'
import App from './App.vue'
import router from './router'
import 'echarts/lib/chart/scatter'
import 'echarts-gl'
import StyleClass from 'primevue/styleclass'
import ConfirmationService from 'primevue/confirmationservice'
import OpenLayersMap, { type Vue3OpenlayersGlobalOptions } from 'vue3-openlayers'
import log from './utils/logger'

const SrPreset = definePreset(Lara, {
  semantic: {
    primary: {
      50: '{blue.50}',
      100: '{blue.100}',
      200: '{blue.200}',
      300: '{blue.300}',
      400: '{blue.400}',
      500: '{blue.500}',
      600: '{blue.600}',
      700: '{blue.700}',
      800: '{blue.800}',
      900: '{blue.900}',
      950: '{blue.950}'
    },
    borderRadius: '0.25rem',
    fontFamily: '"Roboto", sans-serif'
  },
  components: {
    toast: {
      colorScheme: {
        dark: {
          info: {
            //background: 'var(--p-toast-info-background)',
            color: 'black',
            background: 'color-mix(in srgb, {blue.800}, transparent 10%)'
          },
          success: {
            color: 'black',
            background: 'color-mix(in srgb, {green.900}, transparent 10%)'
          },
          warn: {
            color: 'black',
            background: 'color-mix(in srgb, {amber.300}, transparent 10%)'
          },
          error: {
            color: 'black',
            background: 'color-mix(in srgb, {red.900}, transparent 10%)'
          }
        }
      }
    }
    // primvue: {
    //   tabs: {
    //     tab: {
    //       background: {
    //         color: {
    //           dark: 'red',
    //           light: 'red'
    //         }
    //       }
    //     },
    //   }
    // }
  }
})
const pinia = createPinia()
pinia.use(
  createPersistedState({
    storage: sessionStorage // session is per tab and not persistent when tab is closed
  })
)
pinia.use(piniaMetaPlugin)

export const app = createApp(App)
app.config.errorHandler = (err, _vm, info) => {
  // Suppress projection errors that occur when zooming beyond projection extent
  const errorMessage = err instanceof Error ? err.message : String(err)
  if (errorMessage.includes('coordinates must be finite numbers')) {
    log.debug('Projection error caught in Vue - likely zoom beyond projection extent', {
      error: errorMessage
    })
    return // Suppress error from propagating
  }
  log.error('Global Vue error', { error: errorMessage, info })
}
const vue3_openlayer_options: Vue3OpenlayersGlobalOptions = {
  debug: false
}

app.use(pinia)
app.use(OpenLayersMap, vue3_openlayer_options)
app.directive('ripple', Ripple)
app.directive('styleclass', StyleClass)
app.use(PrimeVue, {
  theme: {
    preset: SrPreset,
    //preset: Lara,
    options: {
      prefix: 'p',
      darkModeSelector: '.sr-app-dark',
      cssLayer: false
    }
  },
  csp: {
    nonce: 'nonce-SR-test-nonce'
  }
})
app.use(ConfirmationService)
app.use(ToastService)
app.component('SrToast', Toast)

app.use(router)
app.component('menu-bar', Menubar)
//
// adjust vh for mobile devices
// This is a workaround for mobile devices where 100vh doesn't account for the address bar
// const isIOS = () => {
//   return (
//       /iPad|iPhone|iPod/.test(navigator.userAgent) ||
//       (navigator.userAgent.includes("Macintosh") && 'ontouchend' in document)
//   );
// };

// Expose logger to window for dev console access
// Enable in:
// 1. Local development (npm run dev)
// 2. Test domains (testsliderule.org)
// 3. When localStorage flag is set (for debugging production issues)
const isLocalDev = import.meta.env.DEV
const isTestDomain = window.location.hostname.includes('testsliderule.org')
const debugEnabled = localStorage.getItem('enableLogger') === 'true'

if (isLocalDev || isTestDomain || debugEnabled) {
  ;(window as any).log = log
  console.log(
    '🔍 Logger exposed to window.log - Use localStorage.setItem("logLevel", "debug") then reload to enable debug logging'
  )
}

app.mount('#app')
log.info('Vue app mounted', { mode: import.meta.env.MODE, baseUrl: import.meta.env.BASE_URL })
