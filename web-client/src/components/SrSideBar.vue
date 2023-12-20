<script setup lang="ts">
import { useRouter } from 'vue-router';
import SrModeSelect from "@/components/SrModeSelect.vue";
import { useAdvancedModeStore } from '@/stores/advancedModeStore';
const router = useRouter();
const advancedModeStore = useAdvancedModeStore();

const advancedClick = () => {
    // console.log('advancedModeStore.advanced:', advancedModeStore.advanced);
    if (advancedModeStore.advanced) {
        router.push('/advanced-user');
    } else {
        router.push('/general-user');
    }
};
</script>

<template>
    <div class="sr-sidebar-header">
        <SrModeSelect 
            @advancedClick="advancedClick"
        /> 
        <slot name = "sr-sidebar-header"></slot>
    </div>
    <div class="sr-sidebar-body">
        <slot name = "sr-sidebar-body"></slot>
    </div>
    <div class="sr-sidebar-footer">
    </div>
</template>

<style scoped>
    .sr-sidebar-body {
        display: flex;
        justify-content: center;
        align-items: flex-start;
        margin: 1rem;
    }
    .sr-sidebar-footer {
        display: flex;
        justify-content: center;
        align-items:flex-end
    }
</style>