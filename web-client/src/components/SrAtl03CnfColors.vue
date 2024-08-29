<template>
    <SrMenu
        v-for="(cnfValue, index) in cnfValues"
        :key="index"
        :label="`Color for ${cnfValue.label} (${cnfValue.value})`"
        :menuOptions="atl03ColorMapStore.getNamedColorPalette()"
        :setSelectedMenuItem="(color:string) =>  atl03ColorMapStore.setColorForAtl03CnfValue(cnfValue.value, color)"
        :getSelectedMenuItem="() => atl03ColorMapStore.getColorForAtl03CnfValue(cnfValue.value)"
    />
</template>

<script setup lang="ts">
import SrMenu from './SrMenu.vue';
import { useAtl03ColorMapStore } from '@/stores/atl03ColorMapStore';

const atl03ColorMapStore = useAtl03ColorMapStore();

// Define CNF values to be used for the menus
const cnfValues = [{label:'atl03_tep',value:-2}, {label:'atl03_not_considered',value:-1}, {label:'atl03_background',value:0}, {label:'atl03_within_10m',value:1}, {label:'atl03_low',value:2}, {label:'atl03_medium',value:3}, {label:'atl03_high',value:4}];

</script>
