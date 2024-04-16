<script setup lang="ts">
import { useAdvancedModeStore } from '@/stores/advancedModeStore.js';
import SrToggleButton from './SrToggleButton.vue';
import { NavigationFailureType, isNavigationFailure } from 'vue-router'
import { useRouter } from 'vue-router';
import {useToast} from 'primevue/usetoast';

const toast = useToast();
const router = useRouter();

const advancedModeStore = useAdvancedModeStore();
const toggleLabel = 'Advanced Mode';
// Handle the toggle state change
const handleToggle = async (newValue: boolean) => {
    advancedModeStore.advanced = newValue;
    console.log('advancedModeStore.advanced:', advancedModeStore.advanced);
    if (advancedModeStore.advanced) {
        const failure = await router.push('/advanced-user');
        if (isNavigationFailure(failure, NavigationFailureType.aborted)) {
            // show a small notification to the user
            toast.add({severity:'info',summary:'Save?',detail:'You have unsaved changes, discard and leave anyway?'})
        }    
    } else {
        const failure = await router.push('/general-user');
        if (isNavigationFailure(failure, NavigationFailureType.aborted)) {
            // show a small notification to the user
            toast.add({severity:'info',summary:'Save?',detail:'You have unsaved changes, discard and leave anyway?'})
        }    
    }

};
</script>

<template>
    <div class="mode-box">
        <SrToggleButton :value="advancedModeStore.advanced" :label="toggleLabel" @input="handleToggle" />
    </div>
</template>

<style scoped>
    .mode-box {
        display: flex;
        justify-content: center;
        align-items: center;
        margin: 1rem;
    }
</style>