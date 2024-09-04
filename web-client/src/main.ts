//import 'primevue/resources/themes/lara-dark-blue/theme.css'
//import 'primevue/resources/primevue.min.css'; // core css
import './assets/app.css'
import Lara from '@primevue/themes/lara';
import 'primeicons/primeicons.css'
import 'primeflex/primeflex.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'
import PrimeVue from 'primevue/config';
import { definePreset } from '@primevue/themes';
import Tooltip from 'primevue/tooltip';

import Menubar from 'primevue/menubar';
import ToastService from 'primevue/toastservice';
import Toast from 'primevue/toast';
import Ripple from 'primevue/ripple';
import App from './App.vue'
import router from './router'
import 'echarts/lib/chart/scatter';
import StyleClass from 'primevue/styleclass';
import ConfirmationService from 'primevue/confirmationservice';
import OpenLayersMap, {
    type Vue3OpenlayersGlobalOptions,
} from "vue3-openlayers";

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
      fontFamily: '"Roboto", sans-serif;'
  }
});

export const app = createApp(App)
app.config.errorHandler = (err, vm, info) => {
  console.error('Global Vue Error Handler:', err, info);
};
const options: Vue3OpenlayersGlobalOptions = {
    debug: false,
};
const pinia = createPinia();
pinia.use(createPersistedState({
  //auto: true, // all pinia stores are saved to the storage
  storage: sessionStorage // session is per tab and not persistent when tab is closed
}))

app.use(pinia);
app.use(OpenLayersMap, options );
app.directive('ripple', Ripple);
app.directive('styleclass', StyleClass);
app.use(PrimeVue, {
    theme: {
      preset: SrPreset,
      //preset: Lara,
      options: {
        prefix: 'p',
        darkModeSelector: 'system',
        cssLayer: false
      }
    },
    csp: {
        nonce: 'nonce-SR-test-nonce'
    }
});
app.use(ConfirmationService);
app.use(ToastService);
app.component('SrToast', Toast);

app.use(router)
app.directive('tooltip', Tooltip);
app.component('menu-bar', Menubar)
app.mount('#app')
console.log("Vue mode:",process.env.NODE_ENV);
console.log("BASE_URL:",import.meta.env.BASE_URL); // Outputs the base URL of the app

