<script setup lang="ts">

    import Button from 'primevue/button';
    import { Ref,ref } from 'vue';

    const geocoderContainer: Ref<HTMLElement | null> = ref(null);

    const emit = defineEmits(['logo-click','tool-button-click','popular-button-click','about-button-click']);

    const handleLogoClick = () => {
    emit('logo-click');
    };
    const handleToolButtonClick = () => {
    emit('tool-button-click');
    };
    const handlePopularButtonClick = () => {
    emit('popular-button-click');
    };
    const handleAboutButtonClick = () => {
    emit('about-button-click');
    };

</script>

<template>
    <div class="container">
        <img src="/IceSat-2_SlideRule_logo.png" alt="SlideRule logo" @click="handleLogoClick" class="logo" />
        <div class="center-content">
            <div ref="geocoderContainer" class="geocoder">
            </div>
        </div>
        <div class="right-content">
            <Button icon="pi pi-sliders-h" label="tool" class="p-button-rounded p-button-text" @click="handleToolButtonClick" />
            <Button icon="pi pi-map" label="Popular" class="p-button-rounded p-button-text" @click="handlePopularButtonClick" />
            <Button icon="pi pi-info-circle" label="About" class="p-button-rounded p-button-text" @click="handleAboutButtonClick" />
        </div>
    </div>
</template>
  
<style scoped>
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
  