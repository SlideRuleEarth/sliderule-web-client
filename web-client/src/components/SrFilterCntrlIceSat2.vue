<template>
    <SrFilterCntrlBase
        tooltipId="fltr_icesat2"
        rgtLabel="Rgt"
        :beamPatternComponent="SrBeamPattern"
        :showYAtc="true"
        :yAtcComponent="SrYatcFilterCntrl"
        :cycleSelectComponent="SrCycleSelect"
        :cycleSelectProps="{}"
        :detailsLine1="details1"
        :detailsLine2="details2"
    />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGlobalChartStore } from '@/stores/globalChartStore';
import { useRecTreeStore } from '@/stores/recTreeStore';
import { useActiveTabStore } from '@/stores/activeTabStore';
import SrFilterCntrlBase from './SrFilterCntrlBase.vue';
import SrCycleSelect from '@/components/SrCycleSelect.vue';
import SrBeamPattern from '@/components/SrBeamPattern.vue';
import SrYatcFilterCntrl from '@/components/SrYatcFilterCntrl.vue';

const recTreeStore = useRecTreeStore();
const global = useGlobalChartStore();
const activeTabStore = useActiveTabStore();

const computedApi = computed(() => recTreeStore.selectedApi);

const details1 = computed(() => {
    const base = [
        `cycles: ${global.getCycles()}`,
        // include rgt only if not atl13x
        (global.use_rgt_in_filter) ? `rgt: ${global.getRgt()}` : `rgt: all`,
        `spots: ${global.getSpots()}`,
        `beams: ${global.getGtLabels()}`,
        `tracks: ${global.getTracks()}`,
        `pairs: ${global.getPairs()}`
    ].filter(Boolean); // remove nulls
    return base.join(' ');
});

const details2 = computed(() => {
    const scLabels = global.getScOrientsLabels();
    const useY = global.use_y_atc_filter ? 'uses y_atc filter' : '';
    return `sc_orients: ${scLabels} ${useY}`;
});
</script>

