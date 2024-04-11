<script setup lang="ts">
    import { useAdvancedModeStore } from "@/stores/advancedModeStore";  
    import Button from 'primevue/button';

    const advancedModeStore = useAdvancedModeStore();

    const emit = defineEmits(['logo-click','tool-button-click','popular-button-click','record-button-click','about-button-click']);

    const handleLogoClick = () => {
    emit('logo-click');
    };
    const handleToolButtonClick = () => {
    emit('tool-button-click');
    };
    const handlePopularButtonClick = () => {
    emit('popular-button-click');
    };
    const handleRecordButtonClick = () => {
    emit('record-button-click');
    };
    const handleAboutButtonClick = () => {
    emit('about-button-click');
    };

</script>

<template>
    <div class="container">
        <img src="/IceSat-2_SlideRule_logo.png" alt="SlideRule logo" @click="handleLogoClick" class="logo" />
        <div class="under-construction-banner">
            <p class="under-construction-text">This website is under construction</p>
        </div>
        <div class="right-content">
            <Button icon="pi pi-sliders-h" label="tool" class="p-button-rounded p-button-text" @click="handleToolButtonClick"></Button> 
            <Button v-if="!advancedModeStore.advanced" icon="pi pi-map" label="Popular" class="p-button-rounded p-button-text" @click="handlePopularButtonClick"></Button> 
            <Button v-if="advancedModeStore.advanced" icon="pi pi-list" label="Record" class="p-button-rounded p-button-text" @click="handleRecordButtonClick"></Button>
            <Button icon="pi pi-info-circle" label="About" class="p-button-rounded p-button-text" @click="handleAboutButtonClick"></Button>
        </div>
    </div>
</template>
  
<style scoped>
    .under-construction-banner {
        background-color: #ffc107; /* Yellow background color */
        color: #333; /* Text color */
        text-align: center; /* Center align text */
        align-items: center;
        padding: 0rem; /* Add some padding */
        margin: 0rem;
    }

    .container {
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .center-content {
        display: flex;
        align-items: center;
    }
    
    .ol-geocoder {
        display: flex;
        align-items: center;
        background-color: red;        
    }

    .gcd-gl-container {
        width: 100%;
    }

    .right-content {
        display: flex;
        align-items: right;
    }

    .logo {
        height: 50px; /* Adjust as needed */
    }
    .responsive-input {
        width: 100%; /* Full width on smaller screens */
        min-width: 21rem;
    }

    @media (min-width: 600px) { /* Adjust the breakpoint as needed */
        .responsive-input {
            width: 300px; /* Fixed width on larger screens */
        }
    }

    @media (max-width: 768px) {
        .container {
            flex-direction: column;
            align-items: flex-start;
        }

        .right-content {
            width: 100%;
            justify-content: flex-end; /* Align items to the end (right) */
            margin-top: 10px;
        }
    }

    @media (max-width: 480px) {
        .logo {
            height: 40px;
        }

        .right-content {
            flex-direction: column;
            align-items: flex-end; /* Align items to the end (right) */
        }
    }

</style>
  