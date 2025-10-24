<template>
    <Fieldset v-if="atl08ClassColorMapStore" legend="Atl08 Class Colors" class="sr-legend-box" :toggleable="true" :collapsed="false">
        <div class="sr-restore-defaults">
            <Button 
                icon="pi pi-refresh"
                label="Restore Defaults" 
                class="sr-glow-button" 
                @click="restoreDefaultAtl08ClassColorMap"
                variant="text"
                rounded
            ></Button>
        </div>
        <div class="sr-menu-container" v-for="(classValue, index) in atl08ClassColorMapStore.atl08ClassOptions" :key="index">
            <div class="color-preview" :style="{ backgroundColor: atl08ClassColorMapStore.getColorForAtl08ClassValue(classValue.value) }"></div>
            <SrMenu
                :label="`${classValue.label} (${classValue.value})`"
                :menuOptions="colorMapStore.getNamedColorPalette()"
                :setSelectedMenuItem="(color: string) => atl08ClassColorMapStore.setColorForAtl08ClassValue(classValue.value, color)"
                :getSelectedMenuItem="() => atl08ClassColorMapStore.getColorForAtl08ClassValue(classValue.value)"
                @update:modelValue="handleSelectionChanged(classValue.label, $event)"
            />
        </div>
    </Fieldset>
    <div v-else>
        Loading atl08ClassColorMap...
    </div>
</template>

<script setup lang="ts">
import SrMenu from './SrMenu.vue';
import Fieldset from 'primevue/fieldset';
import Button from 'primevue/button';
import { useAtl08ClassColorMapStore } from '@/stores/atl08ClassColorMapStore';
import { useColorMapStore } from '@/stores/colorMapStore';
import { onMounted, ref } from 'vue';
import { createLogger } from '@/utils/logger';

const logger = createLogger('SrAtl08ClassColorSelection');

const props = defineProps({
    reqIdStr: {
        type: String,
        required: true
    }
});

const atl08ClassColorMapStore = ref<any>(null);
const colorMapStore = useColorMapStore();
const emit = defineEmits(['atl08selectionChanged', 'atl08defaultsChanged']);

// Function to handle when any SrMenu selection changes
const handleSelectionChanged = (label: string, color: string) => {
    logger.debug('Selection changed', { label, color });
    emit('atl08selectionChanged', { label, color });
};

const restoreDefaultAtl08ClassColorMap = () => {
    atl08ClassColorMapStore.value?.restoreDefaultAtl08ClassColorMap();
    emit('atl08defaultsChanged', {});
};

onMounted( async () => {
    logger.debug('SrAtl08ClassColorSelection mounted');
    atl08ClassColorMapStore.value = await useAtl08ClassColorMapStore(props.reqIdStr);
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
