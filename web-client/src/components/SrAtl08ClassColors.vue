<template>
    <Fieldset legend="Atl08 Class Colors" class="sr-legend-box" :toggleable="true" :collapsed="false">
        <div class="sr-restore-defaults">
            <Button label="Restore Defaults" @click="restoreDefaultAtl08ClassColorMap" />
        </div>
        <SrMenu
            v-for="(classValue, index) in atl03ColorMapStore.atl08ClassOptions"
            :key="index"
            :label="`${classValue.label} (${classValue.value})`"
            :menuOptions="atl03ColorMapStore.getNamedColorPalette()"
            :setSelectedMenuItem="(color:string) =>  atl03ColorMapStore.setColorForAtl08ClassValue(classValue.value, color)"
            :getSelectedMenuItem="() => atl03ColorMapStore.getColorForAtl08ClassValue(classValue.value)"
            @update:modelValue="handleSelectionChanged(classValue.label, $event)"
        />
    </Fieldset>

</template>

<script setup lang="ts">
import SrMenu from './SrMenu.vue';
import Fieldset  from 'primevue/fieldset';
import Button from 'primevue/button';
import { useAtl03ColorMapStore } from '@/stores/atl03ColorMapStore';

const atl03ColorMapStore = useAtl03ColorMapStore();


const emit = defineEmits(['selectionChanged','defaultsChanged']);

// Function to handle when any SrMenu selection changes
const handleSelectionChanged = (label: string, color: string) => {
    console.log(`Selection changed for ${label}: ${color}`);
    emit('selectionChanged', { label, color });
};

const restoreDefaultAtl08ClassColorMap = () => {
    atl03ColorMapStore.restoreDefaultAtl08ClassColorMap();
    emit('defaultsChanged', { }); 
};

const onMounted = () => {
    console.log('SrAtl08ClassColors mounted');
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
