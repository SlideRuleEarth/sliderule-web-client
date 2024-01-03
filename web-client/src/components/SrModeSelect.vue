<script setup lang="ts">
import { useAdvancedModeStore } from '@/stores/advancedModeStore.js';
import SrToggleButton from './SrToggleButton.vue';
const emits = defineEmits(['advancedClick']);
const advancedModeStore = useAdvancedModeStore();
const toggleLabel = 'Advanced Mode';
// Handle the toggle state change
const handleToggle = (newValue: boolean) => {
    advancedModeStore.advanced = newValue;
    // console.log('advancedModeStore.advanced:', advancedModeStore.advanced);
    emits('advancedClick');
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