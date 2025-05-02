import { defineStore } from 'pinia';
import { ref,computed } from 'vue';

export const useDeviceStore = defineStore('deviceStore', () => {
    const browser = ref('');
    const os = ref('');
    const userAgent = ref('');
    const language = ref('');
    const online = ref(false);
    const webGLSupported = ref(false);
    const screenSize = ref({ width: window.innerWidth, height: window.innerHeight });
    const screenWidth = computed(() => screenSize.value.width);
    const screenHeight = computed(() => screenSize.value.height);
    
    function setScreenSize(size: { width: number; height: number }) {
        screenSize.value = size;
    }
    
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

    const isMobile = computed(() =>
        userAgent.value.includes('Android') ||
        userAgent.value.includes('iPhone') ||
        userAgent.value.includes('Mobile')
    );

    const isAniPad = computed(() =>
        userAgent.value.includes('iPad')
    );

    function init() {
        if (typeof navigator !== 'undefined') {
            userAgent.value = navigator.userAgent;
            language.value = navigator.language;
            online.value = navigator.onLine;

            // Optional: very basic browser detection
            if (userAgent.value.includes('Chrome')) browser.value = 'Chrome';
            else if (userAgent.value.includes('Safari')) browser.value = 'Safari';
            else if (userAgent.value.includes('Firefox')) browser.value = 'Firefox';
            else browser.value = 'Unknown';

            // Optional: check WebGL
            try {
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                webGLSupported.value = !!gl;
            } catch {
                webGLSupported.value = false;
            }
        }
    }
    function startListeningToResize() {
        detect(); // initial screen size
        window.addEventListener('resize', () => {
            setScreenSize({ width: window.innerWidth, height: window.innerHeight });
        });
    }
    function stopListeningToResize() {
        window.removeEventListener('resize', () => {
            setScreenSize({ width: window.innerWidth, height: window.innerHeight });
        });
    }
        
    function detect() {
        const ua = navigator.userAgent;
        const lang = navigator.language;
    
        setUserAgent(ua);
        setLanguage(lang);
        setOnlineStatus(navigator.onLine);
    
        // Detect OS
        if (ua.includes('Win')) setOS('Windows');
        else if (ua.includes('Mac') && !ua.includes('iPhone') && !ua.includes('iPad')) setOS('MacOS');
        else if (ua.includes('Linux')) setOS('Linux');
        else if (ua.includes('Android')) setOS('Android');
        else if (ua.includes('iPhone') || ua.includes('iPod')) setOS('iOS');
        else if (ua.includes('iPad')) setOS('iPadOS');
        else setOS('Unknown OS');
    
        // Detect Browser
        if (ua.includes('Edg')) setBrowser('Edge');
        else if (ua.includes('OPR') || ua.includes('Opera')) setBrowser('Opera');
        else if (ua.includes('Chrome') && !ua.includes('Edg')) setBrowser('Chrome');
        else if (ua.includes('Safari') && !ua.includes('Chrome')) setBrowser('Safari');
        else if (ua.includes('Firefox')) setBrowser('Firefox');
        else setBrowser('Unknown Browser');
    
        // Check for WebGL
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
            setWebGLSupported(!!gl);
        } catch {
            setWebGLSupported(false);
        }

        setScreenSize({ width: window.innerWidth, height: window.innerHeight });

    }
    
    const deviceType = computed(() => {
        if (isAniPad.value) return 'tablet';
        if (isMobile.value) return 'mobile';
        return 'desktop';
    });
    
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
        isMobile,
        isAniPad,
        init,
        detect,
        deviceType,
        screenSize,
        screenWidth,
        screenHeight,
        setScreenSize,
        startListeningToResize,
        stopListeningToResize,
    };

});
