import 'primevue/resources/themes/lara-dark-blue/theme.css'
import 'primevue/resources/primevue.min.css'; // core css
import 'primeicons/primeicons.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createPersistedState } from 'pinia-plugin-persistedstate'
import PrimeVue from 'primevue/config';
import Tooltip from 'primevue/tooltip';

import Menubar from 'primevue/menubar';
import Accordion from 'primevue/accordion';
import AccordionTab from 'primevue/accordiontab';
import ToastService from 'primevue/toastservice';
import Ripple from 'primevue/ripple';
import App from './App.vue'
import router from './router'
import StyleClass from 'primevue/styleclass';
import OpenLayersMap, {
    type Vue3OpenlayersGlobalOptions,
  } from "vue3-openlayers";

const app = createApp(App)
app.config.errorHandler = (err, vm, info) => {
  console.error('Global Vue Error Handler:', err, info);
};
const options: Vue3OpenlayersGlobalOptions = {
    debug: false,
};
app.use(OpenLayersMap, options );
const pinia = createPinia();
pinia.use(createPersistedState({
  //auto: true, // all pinia stores are saved to the storage
  storage: sessionStorage // session is per tab and not persistent when tab is closed
}))

app.use(pinia);
app.directive('ripple', Ripple);
app.directive('styleclass', StyleClass);
app.use(PrimeVue, {
    csp: {
        nonce: 'nonce-SR-test-nonce'
    }
});
app.use(ToastService);
app.use(router)
app.directive('tooltip', Tooltip);
app.component('menu-bar', Menubar)
app.component('accordion-bar', Accordion)
app.component('accordion-tab', AccordionTab)
app.mount('#app')
console.log("Vue mode:",process.env.NODE_ENV);
console.log("BASE_URL:",import.meta.env.BASE_URL); // Outputs the base URL of the app

