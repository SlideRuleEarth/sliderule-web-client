<template>
    <div class="sr-color-palette">
        <Fieldset legend="Color Palette" class="sr-color-palette-content" :toggleable="true" :collapsed="false">
            <h2>Select Your Color Palette</h2>
            <PickList v-model="srColorTable" dataKey="label">
                <!-- Custom source header with different background color -->
                <template #sourceheader>
                    <div class="source-header">Available Colors</div>
                </template>
                <!-- Custom target header with different background color -->
                <template #targetheader>
                    <div class="target-header">Selected Colors</div>
                </template>
                <template #item="slotProps">
                        {{ slotProps.item.label }}
                </template>
            </PickList>
            <div class="sr-restore-defaults">
                <Button label="Restore Defaults" @click="restoreDefaultColors" />
            </div>
        </Fieldset>
    </div>
    <div class="sr-select-color-map-panel">
        <div class="sr-select-atl03-colors">
            <SrAtl03CnfColors 
                @selectionChanged="atl03CnfColorChanged"
                @defaultsChanged="atl03CnfColorChanged"
            />
        </div>  
        <div class="sr-select-atl08-colors">
            <SrAtl08ClassColors 
                @selectionChanged="atl08ClassColorChanged"
                @defaultsChanged="atl08ClassColorChanged"
            />
        </div>
        <div class="sr-select-yapc-color-map">
            <SrMenu 
                label="YAPC Color Map" 
                v-model="atl03ColorMapStore.selectedAtl03YapcColorMapName"
                :menuOptions="srColorMapNames" 
                :getSelectedMenuItem="atl03ColorMapStore.getSelectedAtl03YapcColorMapName"
                :setSelectedMenuItem="atl03ColorMapStore.setSelectedAtl03YapcColorMapName"
                tooltipText="YAPC Color Map for atl03 scatter plot"
            />
        </div>
    </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import PickList from 'primevue/picklist';
import Button from 'primevue/button';
import { useAtl03ColorMapStore } from '@/stores/atl03ColorMapStore';
import Fieldset from 'primevue/fieldset';
import SrAtl03CnfColors from './SrAtl03CnfColors.vue';
import SrAtl08ClassColors from './SrAtl08ClassColors.vue';
import SrMenu from './SrMenu.vue';
import { srColorMapNames,srColorTable } from '@/utils/colorUtils';

const atl03ColorMapStore = useAtl03ColorMapStore();

interface AtColorChangeEvent {
  label: string;
  color?: string; // color can be undefined
}

onMounted(() => {
    atl03ColorMapStore.initializeAtl03ColorMapStore();
    srColorTable.value[1] = atl03ColorMapStore.getNamedColorPalette().map(color => ({ label: color, value: color }));
    console.log('Mounted SrColorPalette colors:', srColorTable.value);
});

const restoreDefaultColors = async () => {
    await restoreDefaultColors();
    console.log('SrColorPalette colors:', srColorTable.value);
};  

const atl03CnfColorChanged = async (colorKey:string): Promise<void> =>{
    console.log(`atl03CnfColorChanged:`,colorKey);
};

const atl08ClassColorChanged = async ({ label, color }:AtColorChangeEvent): Promise<void> => {
    //console.log(`atl08ClassColorChanged received selection change: ${label} with color ${color}`);
    if (color) {
      console.log('atl08ClassColorChanged');
    } else {
      console.warn('atl08ClassColorChanged color is undefined');
    }
};

</script>

<style scoped>
.sr-color-palette {
    display: flex;
    justify-content: center;
    margin:0.125rem;
}
.sr-color-palette-content {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: center;
    font-size: smaller;
    padding: 0.25rem;
}

h2 {
    text-align: center;
    margin-bottom: 1rem;
}

/* Custom styles for the headers */
.source-header {
    background-color: white;
    color : black;
    padding: 10px;
    text-align: center;
    font-weight: bold;
}

.target-header {
    background-color: white;
    color : black;
    padding: 10px;
    text-align: center;
    font-weight: bold;
}
.sr-restore-defaults {
    display: flex;
    justify-content: center;
    margin-top: 1rem;
}
</style>
