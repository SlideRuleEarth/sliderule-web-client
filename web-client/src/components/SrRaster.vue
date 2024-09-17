<script setup lang="ts">
import SrRasterParams from './SrRasterParams.vue';
import SrRasterParamsDataTable from './SrRasterParamsDataTable.vue';
</script>
<template>
    <div class="sr-raster-sampling-table-section">
        <div class="sr-raster-sampling-table-head">
            <h3>Raster Sampling Parameters Table</h3>
        </div>  
        <div class="sr-raster-sampling-table">
            <SrRasterParamsDataTable  storeNamePrefix="rasterParams"/>
        </div> 
    </div>
    <SrRasterParams />
</template>