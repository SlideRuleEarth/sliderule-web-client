<template>
    <SrFilterCntrlBase
        tooltipId="fltr_gedi"
        rgtLabel="Tracks"
        :beamPatternComponent="SrBeamPatternGedi"
        :showYAtc="false"
        :cycleSelectComponent="SrCycleSelect"
        :cycleSelectProps="{ label: 'Orbits' }"
        :detailsLine1="details1"
    />
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useGlobalChartStore } from '@/stores/globalChartStore';

import SrFilterCntrlBase from './SrFilterCntrlBase.vue';
import SrCycleSelect from '@/components/SrCycleSelect.vue';
import SrBeamPatternGedi from '@/components/SrBeamPatternGedi.vue';

const global = useGlobalChartStore();

const details1 = computed(() =>
    `orbits: ${global.getCycles()} track: ${global.getRgt()} beams: ${global.getSpots()}`
);
</script>
