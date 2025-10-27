<script setup lang="ts">
    import SrToggleButton from './SrToggleButton.vue';
    import { useMapStore } from '@/stores/mapStore';
    import { createLogger } from '@/utils/logger';

    const logger = createLogger('SrGraticuleSelect');

    const mapStore = useMapStore();
    // Handle the toggle state change
    function handleGraticuleChanged() {
        logger.debug('handleGraticuleChanged', { graticuleState: mapStore.graticuleState });
        mapStore.setGraticuleForMap();
    }

</script>

<template>
    <div class="sr-graticule-panel">
        <SrToggleButton 
            :value="mapStore.graticuleState"
            :getValue="mapStore.getGraticuleState"
            :setValue="mapStore.setGraticuleState"
            label="Use Map Graticule"
            tooltipText="Toggle the graticule on and off"
            tooltipUrl="https://openlayers.org/en/latest/apidoc/module-ol_layer_Graticule-Graticule.html"
            @change="handleGraticuleChanged"
        />
    </div>
</template>

<style scoped>
    .sr-graticule-panel {
        display: flex;
        flex-direction: row;
        justify-content:flex-start;
        align-items: center;
        margin: 1rem;
    }
</style>