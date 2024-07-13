<template>
    <div class="sr-listbox-wrapper">
        <SrListbox
            label="Spot(s)"
            v-model="atlChartFilterStore.spots"
            :menuOptions="atlChartFilterStore.spotsOptions"
            :getSelectedMenuItem="atlChartFilterStore.getSpots"
            :setSelectedMenuItem="atlChartFilterStore.setSpots" 
            :insensitive="insensitive"
            :tooltipText="tooltipTextStr"
            :tooltipUrl="tooltipUrlStr"
            :labelFontSize="labelFontSize"
            :justify_center="true"
        />
    </div>
</template>
  
<script setup lang="ts">
    import {  onMounted,computed,watch,nextTick } from 'vue';
    import { useAtlChartFilterStore } from '@/stores/atlChartFilterStore';
    import { processFileForReq } from '@/utils/SrParquetUtils';
    import { useCurReqSumStore } from '@/stores/curReqSumStore';
    import SrListbox from './SrListbox.vue';

    const atlChartFilterStore = useAtlChartFilterStore();
    const labelStr = 'Spot(s)';
    const tooltipUrlStr = "https://slideruleearth.io/web/rtd/user_guide/Background.html";
    const tooltipTextStr = "Laser pulses from ATLAS illuminate three left/right pairs of spots on the surface that \
trace out six approximately 14 m wide ground tracks as ICESat-2 orbits Earth. Each ground track is \
numbered according to the laser spot number that generates it, with ground track 1L (GT1L) on the \
far left and ground track 3R (GT3R) on the far right. Left/right spots within each pair are \
approximately 90 m apart in the across-track direction and 2.5 km in the along-track \
direction.";

    const props = defineProps({ // runtime declaration here
        insensitive: {
            type: Boolean,
            default: false
        },
        labelFontSize: {
            type: String,
            default: 'small'
        }
    });

    
    const handleSelectionChange = async (event: Event) => {
        const target = event.target as HTMLSelectElement;
        const newValue = Array.from(target.selectedOptions).map(option => Number(option.value));
        atlChartFilterStore.setScOrient(-1);
        atlChartFilterStore.setBeams([]);
        atlChartFilterStore.setTracks([]);
        await processFileForReq(useCurReqSumStore().getReqId());

        console.log('SrFilterSpots handleSelectionChange newValue:', newValue);
    };

    onMounted(() => {
        console.log('Mounted Menu:', labelStr);
    });

    const computedMenuClass = computed(() => ({
        'sr-menu-default': true,
        'sr-menu-insensitive': props.insensitive
    }));


    watch(() => atlChartFilterStore.spots, (newSpots, oldSpots) => {
        nextTick(() => {
            console.log('SrFilterSpots watch atlChartFilterStore oldSpots:', oldSpots);
            console.log('SrFilterSpots watch atlChartFilterStore newSpots:', newSpots);
        });
    });

</script>

<style scoped>
.sr-listbox-wrapper {
    display: flex;
    flex-direction: column;
    align-items: center;
    border: 1px solid transparent;
    border-radius: var(--p-border-radius);
}

:deep(.p-button.p-button-icon-only.p-button-rounded.p-button-text.p-button-plain.sr-info-button) {
    margin-left: 0.25rem;
    padding: 0rem;
    height: 1rem;
    width: 1rem;
    color: var(--p-primary-300);
}
:deep(.sr-info-button .pi) {
    margin-left: 0rem;
    padding: 0rem;
    padding-left: 0rem;
    height: 0.75rem;
    width: 0.75rem;
    font-size: smaller;
    color: var(--p-primary-300);
}
</style>
