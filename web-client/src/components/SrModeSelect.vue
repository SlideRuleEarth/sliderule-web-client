<script setup lang="ts">
import { useAdvancedModeStore } from '@/stores/advancedModeStore.js';
import { ref, computed, onMounted } from 'vue';


const advancedModeStore = useAdvancedModeStore();
const isLoading = ref(false);

// Sync the UI with the current route on component mount
onMounted(() => {
});



// Handle the mode change
async function handleModeChange(mode: string) {
    isLoading.value = true;
    if(mode === 'Advanced') {
        advancedModeStore.setAdvanced(true);
    } else {
        advancedModeStore.setAdvanced(false);
    }
    isLoading.value = false;
}

const isButtonActive = computed(() => (mode: string) => {
    if(((mode === 'Advanced') && (advancedModeStore.getAdvanced())) || ((mode === 'General') && (!advancedModeStore.getAdvanced()))) {
        return true;
    } else {
        return false;
    }
});

const buttonClass = computed(() => (mode: string) => [
    'sr-segment-button',
    { active: isButtonActive.value(mode) },
    { disabled: isLoading.value }
]);
</script>

<template>
    <div class="sr-mode-box p-button-rounded p-button-text">
        <div class="sr-segment-control" :class="{ 'is-loading': isLoading }">
            <div class="sr-segment-background" :class="{ 'right': advancedModeStore.getAdvanced() }"></div>
            <button 
                :class="buttonClass('General')"
                @click="handleModeChange('General')"
                :disabled="isLoading"
            >
                General
            </button>
            <button 
                :class="buttonClass('Advanced')"
                @click="handleModeChange('Advanced')"
                :disabled="isLoading"
            >
                Advanced
            </button>
        </div>
    </div>
</template>

<style scoped>
.sr-mode-box {
    display: flex;
    flex-direction: column;
    justify-content: flex-start;
}

.sr-segment-control {
    position: relative;
    display: flex;
    background-color: #333;
    border-radius: 1rem;
    padding: 4px;
    width: 200px;
    height: 3rem;
}

.sr-segment-background {
    position: absolute;
    top: 4px;
    left: 4px;
    width: calc(50% - 4px);
    height: calc(3rem - 8px);
    background-color: #4a4a4a;
    border-radius: 0.75rem;
    transition: transform 0.3s ease;
}

.sr-segment-background.right {
    transform: translateX(100%);
}

.sr-segment-button {
    flex: 1;
    padding: 8px 16px;
    border: none;
    background-color: transparent;
    color: #fff;
    cursor: pointer;
    z-index: 1;
    transition: color 0.3s;
    position: relative;
}

.sr-segment-button::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background-color: rgba(255, 255, 255, 0.1);
    opacity: 0;
    transition: opacity 0.3s ease;
    border-radius: 0.75rem;
}

.sr-segment-button:hover::after {
    opacity: 1;
}

/* :deep(.p-button-rounded:hover) {
    border-width: 1px;
    border-color: var(--primary-color);
    box-shadow: 0 0 12px var(--p-button-primary-border-color), 0 0 20px var(--p-button-primary-border-color);
    transition: box-shadow 0.3s ease;
} */

.sr-segment-button.active {
    color: var(--p-button-text-primary-color);
}

.sr-segment-button.disabled {
    cursor: not-allowed;
    opacity: 0.6;
}

.sr-segment-control.is-loading {
    opacity: 0.7;
}

/* Add a loading indicator */
.sr-segment-control.is-loading::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 20px;
    height: 20px;
    border: 2px solid #fff;
    border-top: 2px solid transparent;
    border-radius: 50%;
    animation: spin 1s linear infinite;
}

@keyframes spin {
    0% { transform: translate(-50%, -50%) rotate(0deg); }
    100% { transform: translate(-50%, -50%) rotate(360deg); }
}
</style>