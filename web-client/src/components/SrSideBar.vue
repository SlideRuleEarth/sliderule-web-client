<script setup lang="ts">
import { useRouter } from 'vue-router';
import SrModeSelect from "@/components/SrModeSelect.vue";
import { useAdvancedModeStore } from '@/stores/advancedModeStore.js';
import { NavigationFailureType, isNavigationFailure } from 'vue-router'
import {useToast} from 'primevue/usetoast';
const toast = useToast();
const router = useRouter();
const advancedModeStore = useAdvancedModeStore();

const advancedClick = async () => {
    // console.log('advancedModeStore.advanced:', advancedModeStore.advanced);
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
    <div class="sr-sidebar-header">
        <slot name = "sr-sidebar-header"></slot>
    </div>
    <div class="sr-sidebar-body">
        <slot name = "sr-sidebar-body"></slot>
    </div>
    <div class="sr-sidebar-footer">
        <slot name = "sr-sidebar-footer"></slot>
        <SrModeSelect  @advanced-click="advancedClick" /> 
    </div>
</template>

<style scoped>
    .sr-sidebar-header, .sr-sidebar-body, .sr-sidebar-footer {
        box-sizing: border-box; /* Ensures padding and border are included in the total width/height */
    }

    .sr-sidebar-header {
        display: flex;
        justify-content: center;
        align-items: flex-start;
        margin: 1rem;
    }
    .sr-sidebar-body {
        display: flex;
        overflow-x: auto;
        min-height: 80vh;
        min-width: 15vw;
        justify-content: center;
        align-items: flex-start;
        margin: 0.1rem;
    }
    .sr-sidebar-footer {
        display: flex;
        justify-content: right;
        align-items:flex-end;
        margin: 1rem;
        border-top: 2px solid var(--surface-d);
    }
</style>