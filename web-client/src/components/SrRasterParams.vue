<template>
    <div class="sr-raster-params_wrapper">
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
        <div class="Catalog">
            <TextArea label="Catalog" v-model="rasterParamsStore.catalog" rows="3" cols="15" />
        </div>
        <SrMultiSelect label="Bands" :menuOptions="rasterParamsStore.bandOptions" v-model="rasterParamsStore.bands" />
    </div>
</template>
<script setup lang="ts">
    import TextArea from 'primevue/textarea';
    import SrTextInput from '@/components/SrTextInput.vue';
    import SrMenuInput from '@/components/SrMenuInput.vue';
    import SrSliderInput from '@/components/SrSliderInput.vue';
    import SrCheckbox from '@/components/SrCheckbox.vue';
    import SrCalendar from '@/components/SrCalendar.vue';
    import SrMultiSelect from '@/components/SrMultiSelect.vue';
    import { useRasterParamsStore } from '@/stores/rasterParamsStore';

    const rasterParamsStore = useRasterParamsStore();


</script>
<style scoped>

</style>