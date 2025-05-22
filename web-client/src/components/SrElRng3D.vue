<template>
    <div class="sr-3d-elrange-col">
        <InputNumber
            v-model="elRange[1]"
            size="small"
            :min="elRange[0]"
            :max="100"
            :step="1"
            :minFractionDigits="0"
            :maxFractionDigits="0"
            :showButtons="true"
            buttonLayout="vertical"
            inputClass="sr-elrange-input"
            @input="handleChange"
        />

        <Slider
            v-if="Array.isArray(elRange) && elRange.length === 2"
            class="sr-el-range-slider"
            v-model="elRange"
            range
            orientation="vertical"
            :min="0"
            :max="100"
            :step="1"
            @change="handleChange"
        />

        <InputNumber
            v-model="elRange[0]"
            size="small"
            :min="0"
            :max="elRange[1]"
            :step="1"
            :minFractionDigits="0"
            :maxFractionDigits="0"
            :showButtons="true"
            buttonLayout="vertical"
            inputClass="sr-elrange-input"
            @input="handleChange"
        />
    </div>
</template>


<script setup lang="ts">
import Slider from 'primevue/slider';
import InputNumber from 'primevue/inputnumber';
import { toRefs, computed } from 'vue';
import { useDeck3DConfigStore } from '@/stores/deck3DConfigStore';
import { update3DPointCloud } from '@/utils/deck3DPlotUtils';
import { useRecTreeStore } from '@/stores/recTreeStore';

const recTreeStore = useRecTreeStore();

const emit = defineEmits(['change']);

const deck3DConfigStore = useDeck3DConfigStore();
const { elRange } = toRefs(deck3DConfigStore);
const deckContainerStored = computed(() => deck3DConfigStore.deckContainer);
const reqId = computed(() => recTreeStore.selectedReqId);

async function handleChange() {
    console.log('ElRange3D handleChange:', elRange.value);
    await update3DPointCloud(reqId.value,deckContainerStored);
}

</script>

<style scoped>
.sr-3d-elrange-col {
    flex: 0 0 auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem;
    background-color: var(--surface-b);
    border-radius: 0.5rem;
}
.sr-el-range-slider {
    width: auto;
    height: 90%;
    margin-top: 5.5rem;
    margin-bottom: 0.5rem;
    padding: 0.5rem;
    background-color: var(--surface-b);
    border-radius: 0.5rem;
}

.sr-elrange-input {
    max-width: 6rem; /* Total width of the input wrapper */
    height: 2.5rem; /* Height of the input field */
    text-align: center;
}

:deep(.p-inputnumber) {
    height: 2rem; /* Height of the input field */
    width: 3rem;       /* Width for ~3 digits */
}

:deep(.p-inputnumber-input) {
    height: 2rem; /* Height of the input field */
}

</style>
