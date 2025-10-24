<template>
    <Fieldset v-if="atl24ClassColorMapStore" legend="Atl24 Class Colors" class="sr-legend-box" :toggleable="true" :collapsed="false">
        <div class="sr-restore-defaults">
            <Button 
                icon="pi pi-refresh"
                label="Restore Defaults" 
                class="sr-glow-button" 
                @click="restoreDefaultAtl24ClassColorMap"
                variant="text"
                rounded
            ></Button>
        </div>
        <div class="sr-menu-container" v-for="(classValue, index) in atl24ClassColorMapStore.atl24ClassOptions" :key="index">
            <div class="color-preview" :style="{ backgroundColor: atl24ClassColorMapStore.getColorForAtl24ClassValue(classValue.value) }"></div>
            <SrMenu
                :label="`${classValue.label} (${classValue.value})`"
                :menuOptions="colorMapStore.getNamedColorPalette()"
                :setSelectedMenuItem="(color: string) => atl24ClassColorMapStore.setColorForAtl24ClassValue(classValue.value, color)"
                :getSelectedMenuItem="() => atl24ClassColorMapStore.getColorForAtl24ClassValue(classValue.value)"
                @update:modelValue="handleSelectionChanged(classValue.label, $event)"
            />
        </div>
    </Fieldset>
    <div v-else>
        Loading atl24ClassColorMap...
    </div>
</template>

<script setup lang="ts">
import SrMenu from './SrMenu.vue';
import Fieldset from 'primevue/fieldset';
import Button from 'primevue/button';
import { useAtl24ClassColorMapStore } from '@/stores/atl24ClassColorMapStore';
import { useColorMapStore } from '@/stores/colorMapStore';
import { onMounted, ref } from 'vue';
import { createLogger } from '@/utils/logger';

const logger = createLogger('SrAtl24ClassColorSelection');

const props = defineProps({
    reqIdStr: {
        type: String,
        required: true
    }
});

const atl24ClassColorMapStore = ref<any>(null);
const colorMapStore = useColorMapStore();
const emit = defineEmits(['atl24selectionChanged', 'atl24defaultsChanged']);

// Function to handle when any SrMenu selection changes
const handleSelectionChanged = (label: string, color: string) => {
    logger.debug('Selection changed', { label, color });
    emit('atl24selectionChanged', { label, color });
};

const restoreDefaultAtl24ClassColorMap = () => {
    atl24ClassColorMapStore.value?.restoreDefaultAtl24ClassColorMap();
    emit('atl24defaultsChanged', {});
};

onMounted( async () => {
    logger.debug('SrAtl24ClassColorSelection mounted');
    atl24ClassColorMapStore.value = await useAtl24ClassColorMapStore(props.reqIdStr);
});

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
