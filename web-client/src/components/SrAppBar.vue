<script setup lang="ts">
import Button from 'primevue/button';
import Menu from 'primevue/menu';
import { ref, computed,onMounted } from 'vue';
import { useSysConfigStore } from '@/stores/sysConfigStore';
import { useRoute } from 'vue-router';
import { useDeviceStore } from '@/stores/deviceStore';
import SrCustomTooltip from '@/components/SrCustomTooltip.vue';

const build_env = import.meta.env.VITE_BUILD_ENV;
const sysConfigStore = useSysConfigStore();
const deviceStore = useDeviceStore();
const route = useRoute();
const tooltipRef = ref();

const docsMenu = ref<InstanceType<typeof Menu> | null>(null);
const displayTour = computed(() => {
    return (route.name === 'home') || (route.name === 'request');
});

const tourMenu = ref<InstanceType<typeof Menu> | null>(null);

const tourMenuItems = [
    {
        label: 'Quick Tour',
        icon: 'pi pi-bolt',
        command: () => {
            emit('quick-tour-button-click');
        }
    },
    {
        label: 'Long Tour',
        icon: 'pi pi-compass',
        command: () => {
            emit('long-tour-button-click');
        }
    }
];

const toggleTourMenu = (event: Event) => {
    tourMenu.value?.toggle(event);
};

const docMenuItems = [
    {
        label: 'Documentation',
        icon: 'pi pi-book',
        items: [
            {
                label: 'About SlideRule',
                icon: 'pi pi-info-circle',
                command: () => {
                    window.open('https://slideruleearth.io');
                }
            },
            {
                label: 'SlideRule Python Client Doumentation',
                icon: 'pi pi-book',
                command: () => {
                    window.open('https://slideruleearth.io/web/rtd/');
                }
            },
            {
                label: 'ATLAS/ICESat-2 Photon Data User Guide',
                icon: 'pi pi-book',
                command: () => {
                    window.open('https://nsidc.org/sites/default/files/documents/user-guide/atl03-v006-userguide.pdf');
                }
            },
            {
                label: 'Algorithm Theoretical Basis Document Atl03',
                icon: 'pi pi-book',
                command: () => {
                    window.open('https://nsidc.org/sites/default/files/documents/technical-reference/icesat2_atl03_atbd_v006.pdf');
                }
            },
        ]
    }
];

const aboutMenu = ref<InstanceType<typeof Menu> | null>(null);
    const aboutMenuItems = [
    {
        label: 'About SlideRule Web Client',
        icon: 'pi pi-info-circle',
        command: () => {
            emit('client-version-button-click');
        }
    },
    {
        label: 'About SlideRule Server',
        icon: 'pi pi-info-circle',
        command: () => {
            emit('server-version-button-click');
        }
    },
    {
        label: 'About SlideRule',
        icon: 'pi pi-info-circle',
        command: () => {
            window.open('https://slideruleearth.io');
        }
    },
    {
        label: 'SlideRule Buzz',
        icon: 'pi pi-calculator',
        command: () => {
            emit('sliderule-buzz-button-click');
        }
    },
    {
        label: 'Report an Issue',
        icon: 'pi pi-exclamation-circle',
        command: () => {
            window.open('https://github.com/SlideRuleEarth/sliderule-web-client/issues', '_blank');
        }
    },
    {
        label: 'Contact Support',
        icon: 'pi pi-envelope',
        command: () => {
            window.location.href = 'mailto:support@mail.slideruleearth.io';
        }
    }
];

const toggleDocsMenu = (event: Event) => {
    docsMenu.value?.toggle(event);
};

const toggleAboutMenu = (event: Event) => {
    aboutMenu.value?.toggle(event);
};

const emit = defineEmits([
    'server-version-button-click',
    'client-version-button-click',
    'request-button-click',
    'record-button-click',
    'rectree-button-click',
    'analysis-button-click',
    'settings-button-click',
    'about-button-click',
    'sliderule-buzz-button-click',
    'quick-tour-button-click',
    'long-tour-button-click' 
]);

const nodeBadgeSeverity = computed(() => {
    const canGetVersion = sysConfigStore.getCanConnectVersion();
    const canGetNodes = sysConfigStore.getCanConnectNodes();

    //console.log('nodeBadgeSeverity canGetNodes:', canGetNodes, 'canGetVersion:', canGetVersion, 'current_nodes:', sysConfigStore.current_nodes);
    if (sysConfigStore.current_nodes <= 0) return 'warning'; // no nodes available
    if (canGetNodes !== 'yes' && canGetVersion !== 'yes') return 'danger';     // both failed
    if (canGetNodes === 'no' || canGetVersion === 'no') return 'danger';       // one failed
    if (canGetNodes === 'unknown' || canGetVersion === 'unknown') return 'warning'; // one or both unknown
    return 'info'; // both yes and >0
});

const badgeLabel = computed(() => {
    return sysConfigStore.current_nodes >= 0 ? `server ${sysConfigStore.current_nodes}` : 'server ?';
});

const handleRequestButtonClick = () => {
    emit('request-button-click');
};
const handleRecTreeButtonClick = () => {
    emit('rectree-button-click');
};
const handleAnalysisButtonClick = () => {
    emit('analysis-button-click');
};
const handleSettingsButtonClick = () => {
    emit('settings-button-click');
};
const handleServerVersionButtonClick = () => {
    emit('server-version-button-click');
};
const handleClientVersionButtonClick = () => {
    emit('client-version-button-click');
};


function getClientVersionString(input: string): string {
    // Find the index of the first "-"
    const dashIndex = input.indexOf('-');

    // If a dash is found, return the substring up to that point
    // If no dash is found, return the full input
    return dashIndex !== -1 ? input.substring(0, dashIndex) : input;
}

function isThisClean(input: string): boolean {
    // Split the string by dashes
    const parts = input.split('-');
    //console.log('input:', input);
    //console.log('parts:', parts);
    // Check if the string has enough parts to contain a number after the first dash
    if (parts.length < 2) {
        console.log('parts.length < 2, parts:', parts);
        return false;
    }

    // Check if the number following the dash is zero
    const numberAfterDash = parseInt(parts[1], 10);
    if (numberAfterDash !== 0) {
        //console.log('numberAfterDash !== 0, numberAfterDash:', numberAfterDash);
        return false;
    }

    // Check if the string does not end with 'dirty'
    return !input.endsWith('dirty');
}

const formattedClientVersion = computed(() => {
    console.log('build_env:', build_env);
    //console.log('typeof build_env:', (typeof build_env));
    if (typeof build_env === 'string') {
        const version = getClientVersionString(build_env);
        const formattedVersion = isThisClean(build_env) ? version : `${version}*`;
        console.log('formattedVersion:', formattedVersion);
        return formattedVersion
    } else {
        return 'v?.?.?';
    }
});

const testVersionWarning = computed(() => {
    //const tvw = isThisClean(build_env) ? '' : (deviceStore.isMobile? `TEST `:`WebClient Test Version`);
    const tvw = isThisClean(build_env) ? '' : (deviceStore.isMobile? `TEST ${deviceStore.screenWidth}`:`WebClient Test Version`);
    return tvw;
});

const computedServerVersionLabel = computed(() => {
    return sysConfigStore.version || 'v?.?.?';
});

const mobileMenu = ref<InstanceType<typeof Menu> | null>(null);

const mobileMenuItems = [
    {
        label: 'Request',
        icon: 'pi pi-sliders-h',
        command: handleRequestButtonClick
    },
    {
        label: 'RecordTree',
        icon: 'pi pi-list',
        command: handleRecTreeButtonClick
    },
    {
        label: 'Analysis',
        icon: 'pi pi-chart-line',
        command: handleAnalysisButtonClick
    },
    {
        label: 'Documentation',
        icon: 'pi pi-book',
        items: docMenuItems[0].items
    },
    {
        label: 'Settings',
        icon: 'pi pi-cog',
        command: handleSettingsButtonClick
    },
    {
        label: 'About',
        icon: 'pi pi-info-circle',
        command: aboutMenuItems[0].command
    },
];

const toggleMobileMenu = (event: Event) => {
    mobileMenu.value?.toggle(event);
};

function setDarkMode() {
    const element = document.querySelector('html');
    if(element){
        element.classList.add('sr-app-dark');
    } else {
        console.error('Could not find html element to set dark mode  ');
    }
}

function dumpRouteInfo() {
    console.log('Route name:', route.name);
    console.log('Route route:', route.fullPath);
    console.log('Route path:', route.path);
    console.log('Route params:', route.params);
    console.log('Route query:', route.query);
}

onMounted(async () => {
    setDarkMode();
    await sysConfigStore.fetchServerVersionInfo();
    await sysConfigStore.fetchCurrentNodes();
    dumpRouteInfo();
});

const openMailClient = () => {
    window.location.href = 'mailto:support@mail.slideruleearth.io';
};

const showServerTooltip = async (event: MouseEvent) => {
    //console.log(`showServerTooltip using ${computedStatusUrl.value} called with event:`, event);
    if (!tooltipRef.value) {
        console.error('Tooltip reference is not defined');
        return;
    }

    try {
        const nodesStr = await sysConfigStore.fetchCurrentNodes();
        tooltipRef.value.showTooltip(
            event,
            `Server Version: ${sysConfigStore.getVersion()}<br>Nodes: ${nodesStr}<br>Click to see server details`
        );
    } catch (error) {
        console.error('Failed to fetch server status:', error);
        tooltipRef.value.showTooltip(
            event,
            `Server Version: ${sysConfigStore.getVersion()}<br>Nodes: unknown<br>Click to see server details`
        );
    }
};

</script>

<template>
    <div class="sr-nav-container" id="sr-nav-container">
        <div class="left-content">
            <Button icon="pi pi-bars" 
                class="p-button-rounded p-button-text mobile-menu-button"
                id="sr-mobile-menu-button"
                @click="toggleMobileMenu">
            </Button>
            <Menu :model="mobileMenuItems" popup ref="mobileMenu" />
            <img src="/IceSat-2_SlideRule_logo.png" alt="SlideRule logo" class="logo" />
            <span class = "sr-title">SlideRule</span>
            <div class="sr-show-server-version"
                @mouseover="showServerTooltip($event)"
                @mouseleave="tooltipRef.hideTooltip()"
            >
                <Button
                    type="button"
                    :label=computedServerVersionLabel
                    :class="['p-button-text', 'desktop-only', 'sr-server-version', nodeBadgeSeverity]"
                    id="sr-server-version-button"
                    :badge="badgeLabel"
                    @click="handleServerVersionButtonClick">
                </Button>
            </div>
            <Button
                type="button"
                :label=formattedClientVersion
                class="p-button-text desktop-only sr-client-version"
                id="sr-client-version-button"
                badge="web_client"
                @click="handleClientVersionButtonClick"> 
            </Button>
            

            <span class="sr-tvw">{{ testVersionWarning }}</span>
        </div>
        <div class="middle-content">
            <Button icon="pi pi-map"
                id="sr-tour-button"
                v-if="displayTour"
                label="Tour"
                class="p-button-rounded p-button-text desktop-only"
                @click="toggleTourMenu">
            </Button>
            <Menu :model="tourMenuItems" popup ref="tourMenu" />
            <div class="sr-megaphone"
                @mouseover="tooltipRef.showTooltip($event,'Got a question about SlideRule?<br>Something not working?<br>Want a new feature?<br>Click here to send us an email.<br>We want to hear from you!<br><br>Remember: The squeaky wheel gets the oil!')"
                @mouseleave="tooltipRef.hideTooltip()"
            >
                <Button icon="pi pi-megaphone"
                    label="Feedback"
                    id="sr-feedback-button"
                    class="p-button-rounded p-button-text desktop-only"
                    @click="openMailClient"
                ></Button>
            </div>
            <div class="sr-tooltip-style" id="tooltip">
                <SrCustomTooltip 
                    ref="tooltipRef"
                    id="appBarTooltip"
                />
            </div>

        </div>
        <div class="right-content" id="sr-appbar-right-content">
            <Button icon="pi pi-sliders-h"
                id="sr-request-button" 
                label="Request" 
                class="p-button-rounded p-button-text desktop-only"
                @click="handleRequestButtonClick">
            </Button>
            <Button icon="pi pi-align-left" 
                id="sr-records-button"
                label="Records" 
                class="p-button-rounded p-button-text desktop-only"
                @click="handleRecTreeButtonClick">
            </Button>
            <Button icon="pi pi-chart-line"
                id="sr-analysis-button" 
                label="Analysis" 
                class="p-button-rounded p-button-text desktop-only"
                @click="handleAnalysisButtonClick">
            </Button>
            <Button icon="pi pi-book"
                id="sr-docs-button" 
                label="Docs" 
                class="p-button-rounded p-button-text desktop-only"
                @click="toggleDocsMenu">
            </Button>
            <Menu :model="docMenuItems" popup ref="docsMenu" />
            <Button icon="pi pi-cog"
                id="sr-settings-button" 
                label="Settings" 
                class="p-button-rounded p-button-text desktop-only"
                @click="handleSettingsButtonClick">
            </Button>
            <Button icon="pi pi-info-circle"
                id="sr-about-button" 
                label="About"
                class="p-button-rounded p-button-text desktop-only"
                @click="toggleAboutMenu">
            </Button>
            <Menu :model="aboutMenuItems" popup ref="aboutMenu" />
        </div>
    </div>
</template>

<style scoped>
.sr-nav-container {
    height: 4rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 0.25rem;
    padding-left: 1rem;
}

.center-content {
    display: flex;
    align-items: center;
}

.sr-title {
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--p-button-text-primary-color);
    margin-left: 0.5rem;
}

.ol-geocoder {
    display: flex;
    align-items: center;
    background-color: red;
}

.gcd-gl-sr-nav-container {
    width: 100%;
}

.right-content {
    display: flex;
    align-items: right;
}

.left-content {
    display: flex;
    align-items: center;
    gap: 0.5rem; /* Adds space between items */
    height: 100%;
}
.middle-content {
    display: flex;
    flex-direction: row;
    align-items: center;
    justify-content: center;
    flex-grow: 1; /* Allows this section to take up available space */
}

.logo {
    height: 2.75rem;
    /* Adjust as needed */
    object-fit: contain;
}

.responsive-input {
    width: 100%;
    /* Full width on smaller screens */
    min-width: 21rem;
}
.sr-tvw{
    font-size:smaller;
    color: red;
    margin-left: 0.5rem;
}
@media (min-width: 600px) {

    /* Adjust the breakpoint as needed */
    .responsive-input {
        width: 300px;
        /* Fixed width on larger screens */
    }
}

@media (max-width: 768px) {
    .sr-nav-container {
        flex-direction: row;
        justify-content: space-between;
        align-items: center;
        padding-right: 1rem;
    }

    .right-content {
        display: none;
    }

    .mobile-menu-button {
        display: inline-flex !important;
        /* Force display on mobile */
        order: -1; /* Ensures it's the first item */
    }

    .logo {
        height: 2.5rem; /* Slightly reduce logo size on mobile if needed */
    }
}

@media (max-width: 480px) {
    .logo {
        height: 40px;
    }

    .right-content {
        flex-direction: column;
        align-items: flex-end;
    }
}

.mobile-menu-button {
    display: none;
    /* Hide by default for desktop */
}

:deep(.p-button-rounded:hover) {
    border-width: 1px;
    border-color: var(--primary-color);
    box-shadow: 0 0 12px var(--p-button-primary-border-color), 0 0 20px var(--p-button-primary-border-color);
    transition: box-shadow 0.3s ease;
}

:deep(.p-button-text:hover) {
    border-width: 1px;
    border-color: var(--primary-color);
    box-shadow: 0 0 12px var(--p-button-primary-border-color), 0 0 20px var(--p-button-primary-border-color);
    transition: box-shadow 0.3s ease;
}

:deep(.p-button.sr-server-version) {
    position: relative;
    padding-top: 0.5rem;
    padding-bottom: 0.0625rem;
    padding-left: 0.25rem;
    padding-right: 0.5rem;
    font-size: 0.9rem;
    border-radius: 0;
}

:deep(.p-button.sr-client-version) {
    position: relative;
    padding-top: 0.5rem;
    padding-bottom: 0.0625rem;
    padding-left: 0.25rem;
    padding-right: 0.5rem;
    font-size: 0.9rem;
    border-radius: 0;
}

:deep(.p-button.sr-server-version .p-badge) {
    position: absolute;
    top: -0.2rem;                   /* Adjust vertical placement */
    left: 50%;                     /* Center horizontally */
    transform: translateX(-50%);   /* Perfect centering */
    font-size: 0.6rem;
    padding: 0.25rem 0.4rem;
    color: var(--p-primary-300);
    background-color: transparent;
}

:deep(.p-button.sr-client-version .p-badge) {
    position: absolute;
    top: -0.2rem;                   /* Adjust vertical placement */
    left: 50%;                     /* Center horizontally */
    transform: translateX(-50%);   /* Perfect centering */
    font-size: 0.6rem;
    padding: 0.25rem 0.4rem;
    color: var(--p-primary-300);
    background-color: transparent;
}
:deep(.p-button.sr-server-version.info .p-badge) {
    color: var(--p-primary-300);
    white-space: nowrap; 
}
:deep(.p-button.sr-server-version.warning .p-badge) {
    color: var(--p-yellow-300);
    white-space: nowrap; 
}
:deep(.p-button.sr-server-version.danger .p-badge) {
    white-space: nowrap; 
    color: var(--p-red-300);
}

</style>
