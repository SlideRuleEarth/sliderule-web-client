<script setup lang="ts">
import { ref } from 'vue';
import Button from 'primevue/button';
import InputText from 'primevue/inputtext';

const searchText = ref('');
const emits = defineEmits(['logoClick','searchButtonClick','toolButtonClick','popularButtonClick','aboutButtonClick']);

const handleLogoClick = () => {
  emits('logoClick');
};
const handleSearchButtonClick = () => {
  emits('searchButtonClick',searchText.value);
};
const handleToolButtonClick = () => {
  emits('toolButtonClick');
};
const handlePopularButtonClick = () => {
  emits('popularButtonClick');
};
const handleAboutButtonClick = () => {
  emits('aboutButtonClick');
};

</script>

<template>
    <div class="container">
        <img src="/IceSat-2_SlideRule_logo.png" alt="SlideRule logo" @click="handleLogoClick" class="logo" />
        <div class="center-content">
            <Button icon="pi pi-search" class="p-button-rounded p-button-text" @click="handleSearchButtonClick" />
            <InputText v-model="searchText" placeholder="Search Location, coordinates and more" class="responsive-input" />
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
  