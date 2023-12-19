<script setup>
import { useAdvancedModeStore } from '@/stores/advancedModeStore';
import ToggleButton from 'primevue/togglebutton'; 

const emits = defineEmits(['advancedClick']);
const advancedModeStore = useAdvancedModeStore();

const handleAdvancedClick = () => {
    emits('advancedClick');
    //advancedModeStore.toggleAdvanced();
};
</script>

<template>
    <div class="container">
        <ToggleButton v-model="advancedModeStore.advanced" onIcon="pi pi-angle-double-right" offIcon="pi pi-angle-double-left" onLabel="Advanced" offLabel="Regular" @update:modelValue="handleAdvancedClick" />
    </div>
</template>
<style scoped>
    .p-togglebutton {
        width: 10rem;
        height: 2rem;
        font-size: 1rem;
        font-weight: bold;
        border-radius: 4rem;

    }
    .container {
        display: flex;
        justify-content: center;
        align-items: center;
    }
</style>