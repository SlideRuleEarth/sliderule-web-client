<script setup lang="ts">
import { useAdvancedModeStore } from '@/stores/advancedModeStore.js';
import { NavigationFailureType, isNavigationFailure } from 'vue-router'
import { useRouter, useRoute } from 'vue-router';
import { useToast } from 'primevue/usetoast';
import { ref, computed, onMounted } from 'vue';

const toast = useToast();
const router = useRouter();
const route = useRoute();

const advancedModeStore = useAdvancedModeStore();
const selectedMode = ref(advancedModeStore.advanced ? 'Advance' : 'General');
const isLoading = ref(false);

// Sync the UI with the current route on component mount
onMounted(() => {
    syncModeWithRoute();
});

// Function to sync the mode with the current route
function syncModeWithRoute() {
    const isAdvancedRoute = route.path === '/advanced-user';
    selectedMode.value = isAdvancedRoute ? 'Advance' : 'General';
    advancedModeStore.setAdvanced(isAdvancedRoute);
}

// Handle the mode change
async function handleModeChange(mode: string) {
    if (isLoading.value) return; // Prevent multiple clicks while loading
    
    const newRoute = mode === 'Advance' ? '/advanced-user' : '/general-user';
    
    // Check if we're already on the correct route
    if (route.path === newRoute) {
        // Just update the store and UI without navigation
        selectedMode.value = mode;
        advancedModeStore.setAdvanced(mode === 'Advance');
        return;
    }
    
    isLoading.value = true;
    selectedMode.value = mode;
    advancedModeStore.setAdvanced(mode === 'Advance');
    
    try {
        await router.push(newRoute);
    } catch (error) {
        if (isNavigationFailure(error, NavigationFailureType.aborted)) {
            toast.add({severity:'info', summary:'Save?', detail:'You have unsaved changes, discard and leave anyway?'});
        } else {
            console.error('Navigation error:', error);
            toast.add({severity:'error', summary:'Error', detail:'Failed to switch mode. Please try again.'});
        }
    } finally {
        isLoading.value = false;
    }
}

const buttonClass = computed(() => (mode: string) => [
    'sr-segment-button',
    { active: selectedMode.value === mode },
    { disabled: isLoading.value }
]);
</script>

<template>
    <div class="sr-mode-box">
        <div class="sr-segment-control" :class="{ 'is-loading': isLoading }">
            <div class="sr-segment-background" :class="{ 'right': selectedMode === 'Advance' }"></div>
            <button 
                :class="buttonClass('General')"
                @click="handleModeChange('General')"
                :disabled="isLoading"
            >
                General
            </button>
            <button 
                :class="buttonClass('Advance')"
                @click="handleModeChange('Advance')"
                :disabled="isLoading"
            >
                Advance
            </button>
        </div>
    </div>
</template>

<style scoped>
.sr-mode-box {
    display: flex;
    justify-content: left;
    align-items: left;
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

.sr-segment-button.active {
    color: #A4DEEB;
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