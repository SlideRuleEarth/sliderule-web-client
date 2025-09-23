<template>
    <div class="sr-rgt-filter">
        <div class="sr-header">
            <p class="sr-select-box-hdr">{{ rgtLabel }}</p>
        </div>

        <Listbox
            class="sr-select-lists"
            v-model="selectedRgtReactive"
            optionLabel="label"
            optionValue="value"
            :multiple="false"
            :options="computedRgtOptions"
            @change="handleValueChange"
        />
        <div class="sr-checkbox-container">
            <Checkbox 
                v-model="globalChartStore.use_rgt_in_filter"
                binary
                inputId="useRgtCheckbox"
                size="small"
                :aria-label="`Use ${rgtLabel} in filter`"
                @change="handleValueChange"
            />
            <label for="useRgtCheckbox" class="sr-checkbox-label">
                Use {{ rgtLabel }} in filter
            </label>
        </div>
    </div>
</template>

<script setup lang="ts">
import { computed, nextTick } from "vue";
import { useRecTreeStore } from "@/stores/recTreeStore";
import { useGlobalChartStore } from "@/stores/globalChartStore";
import { selectedRgtReactive, updatePlotAndSelectedTrackMapLayer } from "@/utils/plotUtils";

import Listbox from "primevue/listbox";
import Checkbox from "primevue/checkbox";

const props = defineProps<{
    rgtLabel: string;
}>();

const recTreeStore = useRecTreeStore();
const globalChartStore = useGlobalChartStore();
const computedRgtOptions = computed(() => globalChartStore.getRgtOptions());

function handleValueChange(_: any) {
    const reqId = recTreeStore.selectedReqIdStr;
    if (reqId) {
        nextTick(() => {
            updatePlotAndSelectedTrackMapLayer("SrRgtFilter:handleValueChange - RGT");
        });
    } else {
        console.warn("SrRgtFilter:handleValueChange - RGT reqId is undefined");
    }
}
</script>

<style scoped>
.sr-rgt-filter {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    gap: 0.25rem;
}
.sr-header {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    font-size: small;
    font-weight: bold;
    color: var(--color-text);
}
.sr-checkbox-label {
    font-size: small;
    margin-left: 0.25rem;
}
.sr-checkbox-container {
    display: flex;
    align-items: center;
    margin-top: 0.25rem;
}

.sr-select-box-hdr{
    display: flex;
    justify-content:center;
    align-items:center;
    margin: 0.125rem;
    padding: 0.125rem;
    width: auto;
    max-width: 10rem;
    font-size:medium;
    font-weight: bold;
    color: var(--color-text);
    background-color: var(--color-bg);
    border-radius: 0.25rem;
}

.sr-select-lists {
    display: flex;
    flex-direction: column;
    justify-content:center;
    align-items:flex-start;
    margin: 0.5rem;
    padding: 0.5rem;
    width: auto;
    max-width: 10rem;
}


</style>
