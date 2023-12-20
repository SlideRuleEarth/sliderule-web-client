import 'primevue/resources/themes/lara-dark-blue/theme.css'
import 'primevue/resources/primevue.min.css'; // core css
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
import StyleClass from 'primevue/styleclass';
//import "vue3-openlayers/styles.css"; // vue3-openlayers version < 1.0.0-*


const app = createApp(App)
app.use(OpenLayersMap /* options */);
app.use(createPinia())
app.directive('ripple', Ripple);
app.directive('styleclass', StyleClass);
// app.use(PrimeVue, {
//     csp: {
//         nonce: 'nonce-...'
//     }
// });
app.use(ToastService);
app.use(router)
app.component('menu-bar', Menubar)

app.mount('#app')
