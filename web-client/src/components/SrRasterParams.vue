<template>
    <div class="sr-raster-params-wrapper">
        <div class="sr-raster-params-header">
            <SrLabelInfoIconButton
                label="Add new raster parameters" 
                labelFontSize='larger'
                tooltipText='SlideRule supports sampling raster datasets at the latitude and longitude of each calculated result from SlideRule processing. When raster sampling is requested, the DataFrame returned by SlideRule includes columns for each requested raster with their associated values.To request raster sampling, the "samples" parameter must be populated as a dictionary in the request. Each key in the dictionary is used to label the data returned for that raster in the returned DataFrame.' 
                tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/raster_sampling.html"
            />
        </div>
        <div class="sr-add-raster-fields">
            <div class="sr-add-raster-params-btn">
                <Button
                    size='small' 
                    @click="addRasterParams()">Add New Raster Params
                </Button>
            </div>
            <SrTextInput 
                label="Key" 
                v-model="rasterParamsStore.key" 
            />
            <Select 
                v-model="rasterParamsStore.asset"
                label="Asset" 
                :options="rasterParamsStore.assetOptions"
                optionLabel="name"
                optionValue="value" 
                size="small"
                placeholder="Select Asset"
            />
            <Select 
                v-model="rasterParamsStore.algorithm"
                label="Algorithm" 
                :options="rasterParamsStore.algorithmOptions" 
                optionLabel="name"
                optionValue="value"
                size="small"
                placeholder="Select Algorithm"
            />
            <SrSliderInput 
                label="Radius" 
                v-model="rasterParamsStore.radius" 
            />
            <SrCheckbox 
                label="Zonal Stats" 
                v-model="rasterParamsStore.zonalStats" 
            />
            <SrCheckbox 
                label="With Flags" 
                v-model="rasterParamsStore.withFlags" 
            />
            <Sr32BitFlag   
                :disabled="!rasterParamsStore.withFlags"
            />
            <div class="sr-time-filter">
                <SrCheckbox
                    label="Use Time Filter"
                    v-model="rasterParamsStore.useTimeFilter"
                />
                <SrCalendar 
                    label="T0" 
                    v-model="rasterParamsStore.t0"
                    :insensitive="!rasterParamsStore.useTimeFilter"
                    :getValue="rasterParamsStore.getT0"
                    :setValue="rasterParamsStore.setT0"
                />
                <SrCalendar 
                    label="T1" 
                    v-model="rasterParamsStore.t1" 
                    :insensitive="!rasterParamsStore.useTimeFilter"
                    :getValue="rasterParamsStore.getT1"
                    :setValue="rasterParamsStore.setT1"
                />
            </div>
            <SrTextInput 
                label="Substring" 
                v-model="rasterParamsStore.substring" 
            />
            <SrCheckbox
                label="Use Closest Time"
                v-model="rasterParamsStore.useClosetTime"
            />     
            <SrCalendar 
                label="Closest" 
                v-model="rasterParamsStore.closestTime"
                :insensitive="!rasterParamsStore.useClosetTime"
                :getValue="rasterParamsStore.getClosestTime"
                :setValue="rasterParamsStore.setClosestTime" 
            />
            <SrCheckbox 
                label="Use POI Time"
                v-model="rasterParamsStore.use_poi_time"
            />
            <div class="sr-raster-params-catalog">
                <SrLabelInfoIconButton 
                    label="Catalog" 
                    labelFontSize='large'
                    tooltipText='geojson formatted stac query response (obtained through the sliderule.earthdata.stac Python API)' 
                    tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#raster-sampling"
                />
                <TextArea  
                    v-model="rasterParamsStore.catalog" 
                    rows="3" 
                    cols="20" 
                />
                <SrCatalogFileUpload 
                />
            </div>
            <div class="sr-bands-select">
                <SrCheckbox 
                    label="Use Bands"
                    v-model="rasterParamsStore.useBands"
                />
                <SrMultiSelectText 
                    v-model="rasterParamsStore.bands"                         
                    label="Bands" 
                    :insensitive="!rasterParamsStore.useBands"
                    :menuOptions="rasterParamsStore.bandOptions" 
                    :default="[rasterParamsStore.bandOptions[0]]"
                    tooltipText="List of bands to read out of the raster, or a predefined algorithm that combines bands for a given dataset"
                    tooltipUrl="https://slideruleearth.io/web/rtd/user_guide/SlideRule.html#raster-sampling"
                />
            </div>
        </div>
    </div>
</template>
<script setup lang="ts">
    import TextArea from 'primevue/textarea';
    import Button from 'primevue/button';
    import Select from 'primevue/select';
    import SrTextInput from '@/components/SrTextInput.vue';
    import SrSliderInput from '@/components/SrSliderInput.vue';
    import SrCheckbox from '@/components/SrCheckbox.vue';
    import SrCalendar from '@/components/SrCalendar.vue';
    import SrMultiSelectText from '@/components/SrMultiSelectText.vue';
    import { useRasterParamsStore } from '@/stores/rasterParamsStore';
    import type { RasterParams } from '@/stores/rasterParamsStore';
    import SrCatalogFileUpload from './SrCatalogFileUpload.vue';
    import SrLabelInfoIconButton from './SrLabelInfoIconButton.vue';
    import Sr32BitFlag from './Sr32BitFlag.vue';
    import { onMounted } from 'vue';

    const rasterParamsStore = useRasterParamsStore();

    onMounted(() => {
        rasterParamsStore.setAssetOptions();
    });

    const addRasterParams = () => {

        if(rasterParamsStore.key === '' || rasterParamsStore.asset === '') {
            alert('Key, Asset and Algorithm must be specified for raster parameters!');
            return;
        }

        const rasterParams: RasterParams = {
            key: rasterParamsStore.key,
            asset: rasterParamsStore.asset,
            algorithm: rasterParamsStore.algorithm,
            //Note: force_single_sample is hardcoded to true 
            force_single_sample: rasterParamsStore.force_single_sample,
            radius: rasterParamsStore.radius,
            zonalStats: rasterParamsStore.zonalStats,
            withFlags: rasterParamsStore.withFlags,
            use_poi_time: rasterParamsStore.use_poi_time,
            t0: rasterParamsStore.useTimeFilter? rasterParamsStore.t0  : null,
            t1: rasterParamsStore.useTimeFilter? rasterParamsStore.t1  : null,
            substring: rasterParamsStore.substring,
            closestTime: rasterParamsStore.useClosetTime? rasterParamsStore.closestTime  : null,
            catalog: rasterParamsStore.catalog,
            bands: rasterParamsStore.useBands ? rasterParamsStore.bands : [],
        };
        rasterParamsStore.addRasterParams(rasterParams);
    };
</script>
<style scoped>
.sr-raster-params-wrapper {
    display: flex;
    flex-direction: column;
    max-width: 20rem;
    max-height: 100%; /* or a specific value like 30rem */
    overflow: auto; /* or hidden if you don't want scrollbars */
    padding: 1rem;
    box-sizing: border-box;
    border: 1px solid var(--surface-d);
    border-radius: var(--p-border-radius);
}

.sr-raster-params-header {
    display: flex;
    justify-content: center; 
    align-items: center;
    background-color: transparent;
    margin: 0.5rem;
}
.sr-raster-params-catalog {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    margin: 0.5rem;
    padding: 0.5rem;
    border-radius: var(--p-border-radius);
    border: 1px solid var(--surface-d);
}
.sr-add-raster-params-btn {
    margin: 1rem;
    display: flex;
    justify-content: center;
    align-items: center;
}
.sr-add-raster-fields {
    display: flex;
    flex-direction: column;
    gap: 0.5rem; /* or whatever spacing you want */
    padding: 0.5rem;
    border-radius: var(--p-border-radius);
    border: 2px solid var(--p-surface-600);
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}
.sr-bands-select {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    margin: 0.5rem;
    padding: 0.5rem;

}

</style>