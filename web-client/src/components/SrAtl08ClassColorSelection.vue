<template>
    <Fieldset legend="Atl08 Class Colors" class="sr-legend-box" :toggleable="true" :collapsed="false">
        <div class="sr-restore-defaults">
            <Button label="Restore Defaults" @click="restoreDefaultAtl08ClassColorMap" />
        </div>
        <div class="sr-menu-container" v-for="(classValue, index) in colorMapStore.atl08ClassOptions" :key="index">
            <div class="color-preview" :style="{ backgroundColor: getColorForAtl08ClassValue(classValue.value) }"></div>
            <SrMenu
                :label="`${classValue.label} (${classValue.value})`"
                :menuOptions="colorMapStore.getNamedColorPalette()"
                :setSelectedMenuItem="(color: string) => colorMapStore.setColorForAtl08ClassValue(classValue.value, color)"
                :getSelectedMenuItem="() => getColorForAtl08ClassValue(classValue.value)"
                @update:modelValue="handleSelectionChanged(classValue.label, $event)"
            />
        </div>
    </Fieldset>
</template>

<script setup lang="ts">
import SrMenu from './SrMenu.vue';
import Fieldset from 'primevue/fieldset';
import Button from 'primevue/button';
import { useColorMapStore } from '@/stores/colorMapStore';
import { getColorForAtl08ClassValue } from '@/utils/colorUtils';

const colorMapStore = useColorMapStore();
const emit = defineEmits(['selectionChanged', 'defaultsChanged']);

// Function to handle when any SrMenu selection changes
const handleSelectionChanged = (label: string, color: string) => {
    console.log(`Selection changed for ${label}: ${color}`);
    emit('selectionChanged', { label, color });
};

const restoreDefaultAtl08ClassColorMap = () => {
    colorMapStore.restoreDefaultAtl08ClassColorMap();
    emit('defaultsChanged', {});
};

const onMounted = () => {
    console.log('SrAtl08ClassColorSelection mounted');
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
