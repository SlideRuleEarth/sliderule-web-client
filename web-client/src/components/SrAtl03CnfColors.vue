<template>
    <Fieldset legend="Atl03 Confidence Colors" class="sr-legend-box" :toggleable="true" :collapsed="false">
        <div class="sr-restore-defaults">
            <Button label="Restore Defaults" @click="restoreDefaultAtl03CnfColorMap" />
        </div>
        <div class="sr-menu-container" v-for="(cnfValue, index) in colorMapStore.atl03CnfOptions" :key="index">
            <div class="color-preview" :style="{ backgroundColor: getColorForAtl03CnfValue(cnfValue.value) }"></div>
            <SrMenu
                :label="`${cnfValue.label} (${cnfValue.value})`"
                :menuOptions="colorMapStore.namedColorPalette"
                :setSelectedMenuItem="(color:string) =>  colorMapStore.setColorForAtl03CnfValue(cnfValue.value, color)"
                :getSelectedMenuItem="() => getColorForAtl03CnfValue(cnfValue.value)"
                @update:modelValue="handleSelectionChanged(cnfValue.label, $event)"
            />
        </div>
    </Fieldset>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import SrMenu from './SrMenu.vue';
import Fieldset from 'primevue/fieldset';
import Button from 'primevue/button';
import { useColorMapStore } from '@/stores/colorMapStore';
import { getColorForAtl03CnfValue } from '@/utils/colorUtils';

const colorMapStore = useColorMapStore();
const emit = defineEmits(['selectionChanged', 'defaultsChanged']);

// Initialize the store
onMounted(async () => {
  await colorMapStore.initializeColorMapStore();
});

// Handle menu selection changes
const handleSelectionChanged = (label: string, color: string) => {
    emit('selectionChanged', { label, color });
};

const restoreDefaultAtl03CnfColorMap = () => {
    colorMapStore.restoreDefaultAtl03CnfColorMap();
    emit('defaultsChanged', {});
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

.sr-menu-container {
    display: flex;
    align-items: center;
    margin-bottom: 0.5rem;
}

.color-preview {
    width: 1rem;
    height: 1rem;
    margin-right: 0.5rem;
    border: 1px solid var(--p-border-color);
    border-radius: 2px;
}
</style>
