<template>
    <Fieldset v-if="atl03CnfColorMapStore" legend="Atl03 Confidence Colors" class="sr-legend-box" :toggleable="true" :collapsed="false">
        <div class="sr-restore-defaults">
            <Button
                icon="pi pi-refresh"
                class="sr-glow-button" 
                label="Restore Defaults" 
                @click="restoreDefaultAtl03CnfColorMap"
                variant="text"
                rounded
            ></Button>
        </div>
        <div class="sr-menu-container" v-for="(cnfValue, index) in atl03CnfColorMapStore.atl03CnfOptions" :key="index">
            <div class="color-preview" :style="{ backgroundColor: atl03CnfColorMapStore.getColorForAtl03CnfValue(cnfValue.value) }"></div>
            <SrMenu
                :label="`${cnfValue.label} (${cnfValue.value})`"
                :menuOptions="colorMapStore.namedColorPalette"
                :setSelectedMenuItem="(color:string) =>  atl03CnfColorMapStore.setColorForAtl03CnfValue(cnfValue.value, color)"
                :getSelectedMenuItem="() => atl03CnfColorMapStore.getColorForAtl03CnfValue(cnfValue.value)"
                @update:modelValue="handleSelectionChanged(cnfValue.label, $event)"
            />
        </div>
    </Fieldset>
    <div v-else>
        Loading atl03CnfColorMap...
    </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import SrMenu from './SrMenu.vue';
import Fieldset from 'primevue/fieldset';
import Button from 'primevue/button';
import { useColorMapStore } from '@/stores/colorMapStore';
import { useAtl03CnfColorMapStore } from '@/stores/atl03CnfColorMapStore';

const props = defineProps({
    reqIdStr: {
        type: String,
        required: true
    }
});

const colorMapStore = useColorMapStore();
let atl03CnfColorMapStore = ref<any>(null);
const emit = defineEmits(['atl03selectionChanged', 'atl03defaultsChanged']);

// Initialize the store
onMounted(async () => {
    atl03CnfColorMapStore.value = await useAtl03CnfColorMapStore(props.reqIdStr);
});

// Handle menu selection changes
const handleSelectionChanged = (label: string, color: string) => {
    emit('atl03selectionChanged', { label, color });
};

const restoreDefaultAtl03CnfColorMap = () => {
    if(atl03CnfColorMapStore.value){
        atl03CnfColorMapStore.value.restoreDefaultAtl03CnfColorMap();
        emit('atl03defaultsChanged', {});
    } else {
        console.error('atl03CnfColorMapStore is not initialized');
    }
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
