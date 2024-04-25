<template>
    <div class="sr-map-view-params-container">
        <span>currentZoom: {{  mapParamsStore.getZoom().toFixed(2) }} </span><br>
        <span>currentCenter: {{  mapParamsStore.getCenterLonLat() }}</span><br>
        <span>currentRotation: {{  mapParamsStore.getRotation() }}</span><br>
        <span>currentProjection: {{  mapParamsStore.getProjection()}}</span><br>
        <span>currentExtent: {{  mapParamsStore.getExtent() }}</span>
    </div>
</template>
<script setup lang="ts">
import { useMapParamsStore } from '@/stores/mapParamsStore';
const mapParamsStore = useMapParamsStore();
</script>
<style scoped>
    .sr-map-view-params-container {
        padding: 0;
        border: transparent;
        margin: 0;
    }

</style>