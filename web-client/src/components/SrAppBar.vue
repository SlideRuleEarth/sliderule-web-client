<script setup lang="ts">
import Button from 'primevue/button';
import OverlayBadge from 'primevue/overlaybadge';
import Menu from 'primevue/menu';
import { ref, computed,onMounted } from 'vue';
const build_env = import.meta.env.VITE_BUILD_ENV;
const docsMenu = ref<InstanceType<typeof Menu> | null>(null);

const docMenuItems = [
    {
        label: 'Documentation',
        icon: 'pi pi-book',
        items: [
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

// Remove this unused function
// const toggleMenu = (event: Event) => {
//     menu.value?.toggle(event);
// };

const toggleDocsMenu = (event: Event) => {
    docsMenu.value?.toggle(event);
};

const emit = defineEmits(['version-button-click','request-button-click', 'popular-button-click', 'record-button-click', 'analysis-button-click', 'settings-button-click', 'about-button-click']);


const handleRequestButtonClick = () => {
    emit('request-button-click');
};
const handleRecordButtonClick = () => {
    emit('record-button-click');
};
const handleAnalysisButtonClick = () => {
    emit('analysis-button-click');
};
const handleAboutButtonClick = () => {
    emit('about-button-click');
};
const handleSettingsButtonClick = () => {
    emit('settings-button-click');
};
const handleVersionButtonClick = () => {
    emit('version-button-click');
};

function getVersionString(input: string): string {
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

const formattedVersion = computed(() => {
    console.log('build_env:', build_env);
    //console.log('typeof build_env:', (typeof build_env));
    if (typeof build_env === 'string') {
        const version = getVersionString(build_env);
        const formattedVersion = isThisClean(build_env) ? version : `${version}*`;
        console.log('formattedVersion:', formattedVersion);
        return formattedVersion
    } else {
        return 'v?.?.?';
    }
});


const buttonBadge = computed(() => {
    return isThisClean(build_env) ? '' : 'Beta';
});
const mobileMenu = ref<InstanceType<typeof Menu> | null>(null);

const mobileMenuItems = [
    {
        label: 'Request',
        icon: 'pi pi-sliders-h',
        command: handleRequestButtonClick
    },
    {
        label: 'Records',
        icon: 'pi pi-list',
        command: handleRecordButtonClick
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
        command: handleAboutButtonClick
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

onMounted(() => {
    setDarkMode();
});

</script>

<template>
    <div class="sr-nav-container">
        <div class="left-content">
            <Button icon="pi pi-bars" class="p-button-rounded p-button-text mobile-menu-button"
                @click="toggleMobileMenu"></Button>
            <Menu :model="mobileMenuItems" popup ref="mobileMenu" />
            <img src="/IceSat-2_SlideRule_logo.png" alt="SlideRule logo" class="logo" />
            <span class = "sr-title">SlideRule</span>
            <Button
                type="button"
                :label=formattedVersion
                class="p-button-rounded p-button-text desktop-only"
                :badge=buttonBadge
                badgeSeverity="danger"
                @click="handleVersionButtonClick"
            >
                
            </Button>
        </div>
        <div class="right-content">
            <Button icon="pi pi-sliders-h" label="Request" 
                    class="p-button-rounded p-button-text desktop-only"
                    @click="handleRequestButtonClick"></Button>
            <Button icon="pi pi-list" label="Records" 
                    class="p-button-rounded p-button-text desktop-only"
                    @click="handleRecordButtonClick"></Button>
            <Button icon="pi pi-chart-line" label="Analysis" 
                    class="p-button-rounded p-button-text desktop-only"
                    @click="handleAnalysisButtonClick"></Button>
            <Button icon="pi pi-book" label="Docs" 
                    class="p-button-rounded p-button-text desktop-only"
                    @click="toggleDocsMenu"></Button>
            <Menu :model="docMenuItems" popup ref="docsMenu" />
            <Button icon="pi pi-cog" label="Settings" 
                    class="p-button-rounded p-button-text desktop-only"
                    @click="handleSettingsButtonClick"></Button>
            <Button icon="pi pi-info-circle" label="About" 
                    class="p-button-rounded p-button-text desktop-only"
                    @click="handleAboutButtonClick"></Button>
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

.sr-version-text {
    display: flex;
    align-items: center;
    height: 2rem;
    margin: 0.5rem;
    font-weight: 600;
    font-size: 0.7rem;
    white-space: nowrap;
    background-color: var(--p-button-text-primary-color);
    color: #333;
    border-radius: 1rem;
    padding: 0.5rem 0.75rem;
}

.mobile-menu-button {
    display: none;
    /* Hide by default for desktop */
}

/* Add this to your existing styles */
:deep(.p-button-rounded:hover) {
    border-width: 1px;
    border-color: var(--p-border-color); /* Change this to the desired border color */
    box-shadow: 0 0 10px var(--p-border-shadow); /*  Add a glow effect */
}

</style>
