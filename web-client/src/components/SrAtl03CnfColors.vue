<template>
    <Fieldset legend="Atl03 Confidence Colors" class="sr-legend-box" :toggleable="true" :collapsed="false">
        <div class="sr-restore-defaults">
            <Button label="Restore Defaults" @click="restoreDefaultAtl03CnfColorMap" />
        </div>
        <SrMenu
            v-for="(cnfValue, index) in cnfValues"
            :key="index"
            :label="`${cnfValue.label} (${cnfValue.value})`"
            :menuOptions="atl03ColorMapStore.getNamedColorPalette()"
            :setSelectedMenuItem="(color:string) =>  atl03ColorMapStore.setColorForAtl03CnfValue(cnfValue.value, color)"
            :getSelectedMenuItem="() => atl03ColorMapStore.getColorForAtl03CnfValue(cnfValue.value)"
            @update:modelValue="handleSelectionChanged(cnfValue.label, $event)"
        />
    </Fieldset>

</template>

<script setup lang="ts">
import SrMenu from './SrMenu.vue';
import Fieldset  from 'primevue/fieldset';
import Button from 'primevue/button';
import { useAtl03ColorMapStore } from '@/stores/atl03ColorMapStore';

const atl03ColorMapStore = useAtl03ColorMapStore();

// Define CNF values to be used for the menus
const cnfValues = [
    {label:'atl03_tep',value:-2}, 
    {label:'atl03_not_considered',value:-1}, 
    {label:'atl03_background',value:0}, 
    {label:'atl03_within_10m',value:1}, 
    {label:'atl03_low',value:2}, 
    {label:'atl03_medium',value:3}, 
    {label:'atl03_high',value:4}
];
const emit = defineEmits(['selectionChanged']);

// Function to handle when any SrMenu selection changes
const handleSelectionChanged = (label: string, color: string) => {
    console.log(`Selection changed for ${label}: ${color}`);
    emit('selectionChanged', { label, color });
};

const restoreDefaultAtl03CnfColorMap = () => {
    atl03ColorMapStore.restoreDefaultAtl03CnfColorMap();
    emit('selectionChanged', { }); 
};

</script>
<style scoped>
.sr-legend-box {
    padding: 0.3125rem;
    border-radius: var(--p-border-radius);
    display: flex;
    justify-content: center;
    align-items: center;
    flex-direction: column;

}
.sr-restore-defaults {
    display: flex;
    justify-content: center;
    margin-bottom: 0.5rem;
}
</style>
