<script setup lang="ts">
    import SrToggleButton from './SrToggleButton.vue';
    import { useMapStore } from '@/stores/mapStore';

    const mapStore = useMapStore();
    // Handle the toggle state change
    function handleGraticuleChanged() {
        console.log('handleGraticuleChanged:', mapStore.graticuleState);
        mapStore.setGraticuleForMap();
    }

</script>

<template>
    <div class="mode-box">
        <SrToggleButton 
            v-model="mapStore.graticuleState"
            label="Graticule"
            @change="handleGraticuleChanged"
        />
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