import { defineStore } from 'pinia';

export const useDeviceStore = defineStore({
  id: 'deviceStore',
  state: () => ({
    browser: '',
    os: '',
    userAgent: '',
    language: '',
    online: false,
    webGLSupported: false,
  }),
  actions: {
    getBrowser() {
      return this.browser;
    },
    setBrowser(browser: string) {
      this.browser = browser;
    },
    getOS() {
      return this.os;
    },
    setOS(os: string) {
      this.os = os;
    },
    getUserAgent() {
      return this.userAgent;
    },
    setUserAgent(userAgent: string) {
      this.userAgent = userAgent;
    },
    getLanguage() {
      return this.language;
    },
    setLanguage(language: string) {
      this.language = language;
    },
    getOnlineStatus() {
      return this.online;
    },
    setOnlineStatus(online: boolean) {
      this.online = online;
    },
    getWebGLSupported() {
      return this.webGLSupported;
    },
    setWebGLSupported(webGLSupported: boolean) {
      this.webGLSupported = webGLSupported;
    },
  },
});
