import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useDeviceStore = defineStore('deviceStore', () => {
  const browser = ref('');
  const os = ref('');
  const userAgent = ref('');
  const language = ref('');
  const online = ref(false);
  const webGLSupported = ref(false);

  function getBrowser() {
    return browser.value;
  }
  function setBrowser(val: string) {
    browser.value = val;
  }

  function getOS() {
    return os.value;
  }
  function setOS(val: string) {
    os.value = val;
  }

  function getUserAgent() {
    return userAgent.value;
  }
  function setUserAgent(val: string) {
    userAgent.value = val;
  }

  function getLanguage() {
    return language.value;
  }
  function setLanguage(val: string) {
    language.value = val;
  }

  function getOnlineStatus() {
    return online.value;
  }
  function setOnlineStatus(val: boolean) {
    online.value = val;
  }

  function getWebGLSupported() {
    return webGLSupported.value;
  }
  function setWebGLSupported(val: boolean) {
    webGLSupported.value = val;
  }

  return {
    browser,
    os,
    userAgent,
    language,
    online,
    webGLSupported,
    getBrowser,
    setBrowser,
    getOS,
    setOS,
    getUserAgent,
    setUserAgent,
    getLanguage,
    setLanguage,
    getOnlineStatus,
    setOnlineStatus,
    getWebGLSupported,
    setWebGLSupported,
  };
});
