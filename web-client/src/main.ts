import 'primevue/resources/themes/lara-dark-blue/theme.css'
import 'primeicons/primeicons.css'
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import PrimeVue from 'primevue/config';
import Menubar from 'primevue/menubar';
import ToastService from 'primevue/toastservice';
import Ripple from 'primevue/ripple';
import App from './App.vue'
import router from './router'

import OpenLayersMap from "vue3-openlayers";
//import "vue3-openlayers/styles.css"; // vue3-openlayers version < 1.0.0-*


const app = createApp(App)
app.use(PrimeVue);
app.use(OpenLayersMap /* options */);
app.use(createPinia())
app.directive('ripple', Ripple);

app.use(ToastService);
app.use(router)
app.component('menu-bar', Menubar)

app.mount('#app')
