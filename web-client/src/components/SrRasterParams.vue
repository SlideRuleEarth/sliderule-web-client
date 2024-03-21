<template>
    <div class="sr-raster-params_wrapper">
        <h3>Add new Raster Parameters</h3>
        <SrTextInput label="Key" v-model="rasterParamsStore.key" />
        <SrMenuInput label="Asset" :menuOptions="rasterParamsStore.assetOptions" v-model="rasterParamsStore.asset"/>
        <SrMenuInput label="Algorithm" :menuOptions="rasterParamsStore.algorithmOptions" v-model="rasterParamsStore.algorithm"/>
        <SrSliderInput label="Radius" v-model="rasterParamsStore.radius" />
        <SrCheckbox label="Zonal Stats" v-model="rasterParamsStore.zonalStats" />
        <SrCheckbox label="With Flag" v-model="rasterParamsStore.withFlag" />
        <SrCalendar label="T0" v-model="rasterParamsStore.t0" />
        <SrCalendar label="T1" v-model="rasterParamsStore.t1" />
        <SrTextInput label="Substring" v-model="rasterParamsStore.substring" />
        <SrCheckbox label="Closest Time" v-model="rasterParamsStore.closestTime" />
        <div class="sr-raster-params-catalog">
            <FloatLabel>
                <TextArea  v-model="rasterParamsStore.catalog" rows="3" cols="35" />
                <label>Catalog</label>
            </FloatLabel>
            <SrCatalogFileUpload />
        </div>
        <SrMultiSelect label="Bands" 
            :menuOptions="rasterParamsStore.bandOptions" 
            v-model="rasterParamsStore.bands"                         
            :default="[rasterParamsStore.bandOptions[0]]"
/>
        <Button @click="addRasterParams()">Add</Button>
    </div>
</template>
<script setup lang="ts">
    import TextArea from 'primevue/textarea';
    import Button from 'primevue/button';
    import FloatLabel from 'primevue/floatlabel';
    import SrTextInput from '@/components/SrTextInput.vue';
    import SrMenuInput from '@/components/SrMenuInput.vue';
    import SrSliderInput from '@/components/SrSliderInput.vue';
    import SrCheckbox from '@/components/SrCheckbox.vue';
    import SrCalendar from '@/components/SrCalendar.vue';
    import SrMultiSelect from '@/components/SrMultiSelect.vue';
    import { useRasterParamsStore } from '@/stores/rasterParamsStore';
    import type { RasterParams } from '@/stores/rasterParamsStore';
    import SrCatalogFileUpload from './SrCatalogFileUpload.vue';

    const rasterParamsStore = useRasterParamsStore();
    const addRasterParams = () => {
        const rasterParams: RasterParams = {
            key: rasterParamsStore.key,
            asset: rasterParamsStore.asset,
            algorithm: rasterParamsStore.algorithm,
            radius: rasterParamsStore.radius,
            zonalStats: rasterParamsStore.zonalStats,
            withFlag: rasterParamsStore.withFlag,
            t0: rasterParamsStore.t0,
            t1: rasterParamsStore.t1,
            substring: rasterParamsStore.substring,
            closestTime: rasterParamsStore.closestTime,
            catalog: rasterParamsStore.catalog,
            bands: rasterParamsStore.bands,
        };
        rasterParamsStore.addRasterParams(rasterParams);
    };

</script>
<style scoped>
.sr-raster-params_wrapper {
    display: flex;
    max-width: 30rem;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    margin: 0.5rem;
    padding: 0.5rem;
    border-radius: 2rem;
    border: 2px solid var(--surface-d);
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}
.sr-raster-params-catalog {
    margin: 1rem;
}
</style>