<template>
    <div class="sr-raster-params_wrapper">
        <div class="sr-raster-params-header">
            <SrLabelInfoIconButton label="Add new raster parameters" 
                                labelFontSize='large'
                                tooltipText='SlideRule supports sampling raster datasets at the latitude and longitude of each calculated result from SlideRule processing. When raster sampling is requested, the DataFrame returned by SlideRule includes columns for each requested raster with their associated values.To request raster sampling, the "samples" parameter must be populated as a dictionary in the request. Each key in the dictionary is used to label the data returned for that raster in the returned DataFrame.' 
                                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#raster-sampling"
            />
        </div>
        <SrTextInput label="Key" v-model="rasterParamsStore.key" 
            tooltipText="user supplied name used to identify results returned from sampling this raster"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#raster-sampling"
        />
        <SrMenuInput label="Asset" :menuOptions="rasterParamsStore.assetOptions" v-model="rasterParamsStore.asset"
            tooltipText="name of the raster (as supplied in the Asset Directory) to be sampleds"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#raster-sampling"
        />
        <SrMenuInput label="Algorithm" :menuOptions="rasterParamsStore.algorithmOptions" v-model="rasterParamsStore.algorithm"
            tooltipText="algorithm to use to sample the raster; the available algorithms for sampling rasters are: NearestNeighbour, Bilinear, Cubic, CubicSpline, Lanczos, Average, Mode, Gauss"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#raster-sampling"
        />
        <SrSliderInput label="Radius" v-model="rasterParamsStore.radius" 
            tooltipText="the size of the kernel in meters when sampling a raster; the size of the region in meters for zonal statistics"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#raster-sampling"
        />
        <SrCheckbox label="Zonal Stats" v-model="rasterParamsStore.zonalStats" 
            tooltipText="boolean whether to calculate and return zonal statistics for the region around the location being sampled"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#raster-sampling"
        />
        <SrCheckbox label="With Flags" v-model="rasterParamsStore.withFlag" 
            tooltipText="boolean whether to include auxiliary information about the sampled pixel in the form of a 32-bit flag"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#raster-sampling"
        />
        <SrCalendar label="T0" v-model="rasterParamsStore.t0"
            tooltipText="Start time for filtering rasters to be sampled (format %Y-%m-%dT%H:%M:%SZ, e.g. 2018-10-13T00:00:00Z)"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#raster-sampling"
        />
        <SrCalendar label="T1" v-model="rasterParamsStore.t1" 
            tooltipText="Stop time for filtering rasters to be sampled (format %Y-%m-%dT%H:%M:%SZ, e.g. 2018-10-13T00:00:00Z)"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#raster-sampling"
        />
        <SrTextInput label="Substring" 
            v-model="rasterParamsStore.substring" 
            tooltipText="substring filter for rasters to be sampled; the raster will only be sampled if the name of the raster includes the provided substring (useful for datasets that have multiple rasters for a given geolocation to be sampled)"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#raster-sampling"
        />
        <SrCalendar label="Closest Time" v-model="rasterParamsStore.closestTime" 
            tooltipText="Time used to filter rasters to be sampled; only the raster that is closest in time to the provided time will be sampled - can be multiple rasters if they all share the "
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#raster-sampling"      
        />
        <SrCheckbox label="Use POI Time"
            v-model="rasterParamsStore.usePoiTime"
            tooltipText="Overrides the “closest_time” setting (or provides one if not set) with the time associated with the point of interest being sampled"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#raster-sampling"
        />
        <div class="sr-raster-params-catalog">
            <SrLabelInfoIconButton label="Catalog" 
                                labelFontSize='small'
                                tooltipText='geojson formatted stac query response (obtained through the sliderule.earthdata.stac Python API)' 
                                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#raster-sampling"
            />
            <TextArea  v-model="rasterParamsStore.catalog" rows="3" cols="35" />
            <SrCatalogFileUpload />
        </div>
        <SrMultiSelect label="Bands" 
            :menuOptions="rasterParamsStore.bandOptions" 
            v-model="rasterParamsStore.bands"                         
            :default="[rasterParamsStore.bandOptions[0]]"
            tooltipText="List of bands to read out of the raster, or a predefined algorithm that combines bands for a given dataset"
            tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#raster-sampling"
        />
        <div class="sr-add-raster-params-btn">
            <Button size='small' @click="addRasterParams()">Add New Raster Params</Button>
        </div>
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
    import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';

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
    margin: 0.125rem;
    padding: 0.125rem;
    border-radius: var(--border-radius);
    border: 2px solid var(--surface-d);
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}
.sr-raster-params-header {
    display: flex;
    justify-content: center; 
    align-items: center;
    background-color: transparent;
    margin: 0.5rem;
}
.sr-raster-params-catalog {
    margin: 1rem;
}
.sr-add-raster-params-btn {
    margin: 1rem;
}
</style>