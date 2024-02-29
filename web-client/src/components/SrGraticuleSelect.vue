<script setup lang="ts">
import SrToggleButton from './SrToggleButton.vue';
import { useMapStore } from '@/stores/mapStore';

const mapStore = useMapStore();

const emits = defineEmits(['graticule-click']);
const toggleLabel = 'Graticule';
// Handle the toggle state change
const handleToggle = (newValue: boolean) => {
    // console.log('graticuleStore.graticule:', graticuleStore.graticule);
    emits('graticule-click', newValue);
};

</script>

<template>
    <div class="mode-box">
        <SrToggleButton :value="mapStore.graticuleState" :label="toggleLabel" @input="handleToggle" />
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